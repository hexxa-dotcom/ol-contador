import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as ia from "@/lib/ia";
import { adminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

type CopilotMode = "resumo" | "rascunho" | "pergunta" | "pendencias" | "diagnostico" | "relatorio";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    clientId?: string;
    mode?: CopilotMode;
    prompt?: string;
    skillId?: string;
    tipoRelatorio?: "atendimento" | "pendencias";
  } | null;
  const clientId = body?.clientId?.trim();
  const mode = body?.mode;
  const prompt = body?.prompt?.trim().slice(0, 2000) ?? "";
  if (!clientId || !mode || !["resumo", "rascunho", "pergunta", "pendencias", "diagnostico", "relatorio"].includes(mode)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const [{ data: client }, { data: messages }, { data: skillConfig }] = await Promise.all([
    supabase.from("clientes").select("id,name,tax_type,diagnosis,treatment").eq("id", clientId).maybeSingle(),
    supabase.from("mensagens").select("sender,text,created_at").eq("cliente_id", clientId).order("seq", { ascending: true }).limit(120),
    supabase.from("configuracoes").select("valor").eq("chave", "ia_skills").maybeSingle(),
  ]);
  if (!client) return NextResponse.json({ error: "client_not_found" }, { status: 404 });

  const clienteContexto: ia.ClienteContexto = {
    name: client.name,
    taxType: client.tax_type,
    diagnosis: client.diagnosis,
    treatment: client.treatment,
    messages: messages || [],
  };

  if (mode === "diagnostico" || mode === "relatorio") {
    if (!ia.isConfigured()) return NextResponse.json({ error: "ia_not_configured" }, { status: 503 });
    try {
      const result =
        mode === "diagnostico"
          ? await ia.sugerirDiagnostico(clienteContexto)
          : await ia.gerarRelatorioCliente(clienteContexto, {
              tipoRelatorio: body?.tipoRelatorio === "pendencias" ? "pendencias" : "atendimento",
            });
      return NextResponse.json(result);
    } catch (e) {
      const err = e as { code?: string; name?: string; message: string };
      if (err.code === "ia_not_configured") return NextResponse.json({ error: "ia_not_configured" }, { status: 503 });
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return NextResponse.json({ error: "ia_timeout" }, { status: 502 });
      }
      await registrarErro(adminClient(), {
        origem: "copilot_route",
        codigo: err.code || "ia_error",
        mensagem: err.message,
        rota: "/api/copilot",
        severidade: "erro",
        contexto: { clientId, mode },
      });
      return NextResponse.json({ error: "ia_error", detail: err.message }, { status: 502 });
    }
  }

  const provider = process.env.IA_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "openrouter");
  const groq = provider === "groq";
  const apiKey = groq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
  const model = groq ? process.env.GROQ_MODEL || "llama-3.3-70b-versatile" : process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";
  const endpoint = groq ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  if (!apiKey) return NextResponse.json({ error: "ia_not_configured" }, { status: 503 });

  const history = (messages ?? [])
    .filter((item) => item.text)
    .map((item) => `${item.sender === "client" ? "Cliente" : "Contador"}: ${item.text}`)
    .join("\n")
    .slice(-18000);
  const skills = Array.isArray(skillConfig?.valor)
    ? skillConfig.valor.filter((item): item is { id?: string; name?: string; content?: string; active?: boolean } => Boolean(item && typeof item === "object"))
    : [];
  const selectedSkill = skills.find((item) => String(item.id) === body?.skillId && item.active !== false);
  let skillContext = selectedSkill?.content ? `\n\nBase especializada (${String(selectedSkill.name || "skill").slice(0, 120)}):\n${String(selectedSkill.content).slice(0, 12000)}` : "";

  // RAG por PDF indexado (skills_embeddings): filtra pelo assunto do cliente,
  // só entra em jogo pro rascunho de resposta — mesmo comportamento do
  // rascunharResposta do legado.
  if (mode === "rascunho" && !skillContext && client.tax_type) {
    const admin = adminClient();
    if (admin) {
      const ragContext = await ia.getRagContext(client.tax_type, prompt || "Qual a orientação geral?", admin);
      if (ragContext) skillContext = `\n\nBase especializada (${client.tax_type}):\n${ragContext.slice(0, 12000)}`;
    }
  }
  const instructions: Record<Exclude<CopilotMode, "diagnostico" | "relatorio">, string> = {
    resumo: "Resuma o caso em até quatro pontos objetivos para o contador.",
    rascunho: "Escreva uma resposta profissional, acolhedora e clara que o contador possa revisar e enviar ao cliente.",
    pergunta: `Responda à pergunta do contador com objetividade: ${prompt || "Analise o contexto e indique a melhor orientação."}`,
    pendencias: "Liste somente as pendências identificáveis no contexto. Separe fatos de hipóteses e não invente prazos ou valores.",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Ola Contador" },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 650,
        messages: [
          { role: "system", content: "Você auxilia um contador brasileiro. Seja técnico, prudente e claro. Não execute ações, não invente legislação, valores ou prazos e sinalize quando algo exigir confirmação profissional." },
          { role: "user", content: `${instructions[mode]}${skillContext}\n\nCliente: ${client.name}\nAssunto: ${client.tax_type || "não informado"}\nDiagnóstico atual: ${client.diagnosis || "não informado"}\nTratamento atual: ${client.treatment || "não informado"}\n\nHistórico:\n${history || "Sem mensagens."}` },
        ],
      }),
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null;
    if (!response.ok) return NextResponse.json({ error: "ia_error", detail: result?.error?.message || "Falha no provedor." }, { status: 502 });
    return NextResponse.json({ text: result?.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar uma resposta." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "AbortError" ? "ia_timeout" : "ia_error" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
