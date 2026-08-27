// Integração de IA — porte 1:1 de api/_lib/ia.js. A chave nunca vai pro
// navegador; toda chamada roda no servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChaveUsosConfig, getSystemSecret, isUsoHabilitado, type IaUso } from "@/lib/systemSecrets";

type Admin = SupabaseClient;

// Resolve a chave/modelo ativos a cada chamada: banco primeiro (editável na
// tela de Configurações), variável de ambiente como fallback. Sem cache em
// memória de propósito — trocar a chave na UI precisa valer na próxima
// chamada, não depois de um redeploy. `uso` filtra pelas chaves habilitadas
// pra esse contexto em "Chaves de API" (ver USOS_IA em systemSecrets.ts) —
// sem configuração explícita, a chave vale pra qualquer uso.
async function resolveProvider(admin: Admin, uso: IaUso = "chat") {
  const [groqKey, groqModel, groqVisionModel, openrouterKey, openrouterModel, openaiKey, openaiModel, usosConfig] = await Promise.all([
    getSystemSecret(admin, "GROQ_API_KEY"),
    getSystemSecret(admin, "GROQ_MODEL"),
    getSystemSecret(admin, "GROQ_VISION_MODEL"),
    getSystemSecret(admin, "OPENROUTER_API_KEY"),
    getSystemSecret(admin, "OPENROUTER_MODEL"),
    getSystemSecret(admin, "OPENAI_API_KEY"),
    getSystemSecret(admin, "OPENAI_CHAT_MODEL"),
    getChaveUsosConfig(admin),
  ]);
  const providers = {
    groq: {
      baseURL: "https://api.groq.com/openai/v1",
      key: groqKey || "",
      model: groqModel || "llama-3.3-70b-versatile",
      visionModel: groqVisionModel || "llama-3.2-90b-vision-preview",
    },
    openrouter: {
      baseURL: "https://openrouter.ai/api/v1",
      key: openrouterKey || "",
      model: openrouterModel || "anthropic/claude-3.5-sonnet",
      visionModel: openrouterModel || "anthropic/claude-3.5-sonnet",
    },
    openai: {
      baseURL: "https://api.openai.com/v1",
      key: openaiKey || "",
      model: openaiModel || "gpt-4o-mini",
      visionModel: openaiModel || "gpt-4o-mini",
    },
  } as const;
  const habilitada = (chave: string) => {
    const usos = usosConfig[chave];
    return !usos || usos[uso] !== false;
  };
  const chaveDoProvedor = { groq: "GROQ_API_KEY", openrouter: "OPENROUTER_API_KEY", openai: "OPENAI_API_KEY" } as const;
  const preferida = (process.env.IA_PROVIDER === "openrouter" || process.env.IA_PROVIDER === "openai" ? process.env.IA_PROVIDER : "groq") as keyof typeof providers;
  const ordem = [preferida, ...(Object.keys(providers) as (keyof typeof providers)[]).filter((n) => n !== preferida)];
  for (const nome of ordem) {
    if (providers[nome].key && habilitada(chaveDoProvedor[nome])) return providers[nome];
  }
  return providers[preferida];
}

export async function isConfigured(admin: Admin, uso: IaUso = "chat"): Promise<boolean> {
  const active = await resolveProvider(admin, uso);
  return !!active.key;
}

class IaError extends Error {
  code?: string;
  status?: number;
}

// Transcrição de áudio (acessibilidade: cliente/equipe grava por voz em vez
// de digitar, e a mensagem também vira texto pesquisável no chat). Só o
// Whisper da Groq faz isso hoje — não passa por resolveProvider (que
// escolhe entre Groq/OpenRouter pra chat de texto), sempre usa GROQ_API_KEY
// direto. Se a chave não estiver configurada, devolve null e a mensagem de
// áudio segue sem transcrição (o áudio em si continua funcionando).
export async function transcreverAudio(admin: Admin, audio: Buffer, mimeType: string, fileName: string): Promise<string | null> {
  const groqKey = await getSystemSecret(admin, "GROQ_API_KEY");
  if (!groqKey) return null;
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType || "audio/webm" }), fileName);
    form.append("model", "whisper-large-v3");
    form.append("language", "pt");
    form.append("response_format", "text");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const texto = (await res.text()).trim();
    return texto || null;
  } catch {
    return null;
  }
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ClienteContexto = {
  name: string;
  taxType?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  messages: { sender: string; text?: string | null }[];
};

export async function chatCompletion(
  admin: Admin,
  messages: ChatMessage[],
  { temperature = 0.3, maxTokens = 700, uso = "chat" }: { temperature?: number; maxTokens?: number; uso?: IaUso } = {}
): Promise<string> {
  const active = await resolveProvider(admin, uso);
  if (!active.key) {
    const err = new IaError("ia_not_configured");
    err.code = "ia_not_configured";
    throw err;
  }
  const res = await fetch(active.baseURL + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${active.key}`, "Content-Type": "application/json", "X-Title": "Ola Contador" },
    body: JSON.stringify({ model: active.model, messages, temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    const err = new IaError(`ia_error: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data?.choices?.[0]?.message?.content || "";
}

export function historyToText(messages: ClienteContexto["messages"]): string {
  const nome: Record<string, string> = { client: "Cliente", agent: "Contador", system: "Sistema" };
  return (messages || [])
    .filter((m) => m.text)
    .map((m) => `${nome[m.sender] || m.sender}: ${m.text}`)
    .join("\n");
}

export const PERSONA = `Você é o assistente de IA de um escritório de contabilidade brasileiro (plataforma "Olá, Contador").
Você auxilia o CONTADOR (não o cliente) durante o atendimento. Seja técnico, objetivo e correto quanto à legislação
fiscal brasileira (Receita Federal, Simples Nacional, MEI, IRPF, ganho de capital). Não invente valores.
Responda em português do Brasil.`;

function extrairJson<T>(raw: string, fallback: T): T {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return fallback;
  }
}

// Assistente do contador via WhatsApp — recebe a pergunta + um resumo em
// texto da base (clientes, agenda, Express pendente) e responde de forma
// curta, adequada pra WhatsApp (sem markdown elaborado).
export async function responderAssistenteAdmin(admin: Admin, pergunta: string, contextoSistema: string): Promise<string> {
  return chatCompletion(
    admin,
    [
      {
        role: "system",
        content:
          PERSONA +
          "\n\nVocê está respondendo pelo WhatsApp do contador (não é o cliente falando). Seja direto e conciso — poucas frases, sem markdown elaborado (pode usar *negrito* e listas simples com \"-\"). Use os dados do sistema abaixo pra responder; se a informação não estiver lá, diga que não encontrou — nunca invente nome, valor ou status de cliente.",
      },
      { role: "user", content: `Dados do sistema:\n${contextoSistema}\n\nPergunta do contador: ${pergunta}` },
    ],
    { temperature: 0.2, maxTokens: 500 }
  );
}

export type SugestaoDiagnostico = { diagnosis: string; treatment: string };

export async function sugerirDiagnostico(admin: Admin, cliente: ClienteContexto): Promise<SugestaoDiagnostico> {
  const raw = await chatCompletion(
    admin,
    [
      { role: "system", content: PERSONA },
      {
        role: "user",
        content:
          `A partir da conversa abaixo, proponha o Diagnóstico Fiscal e o Tratamento (passos numerados) para a Receita Fiscal.\n` +
          `Responda APENAS um JSON válido, sem markdown, no formato:\n` +
          `{"diagnosis": "resumo do diagnóstico em uma linha", "treatment": "1. passo\\n2. passo\\n3. passo"}\n\n` +
          `Cliente: ${cliente.name} | Tipo: ${cliente.taxType || "-"}\n` +
          `Conversa:\n${historyToText(cliente.messages)}`,
      },
    ],
    { temperature: 0.2, maxTokens: 500 }
  );
  return extrairJson(raw, { diagnosis: "", treatment: raw });
}

export type RelatorioCliente = {
  titulo: string;
  problema: string;
  solucao: string;
  oqueFeito: string;
  comoFeito: string;
  entregas: string;
  pendencias: string;
  responsavelProximoPasso: string;
  prazoProximoPasso: string;
};

export async function gerarRelatorioCliente(
  admin: Admin,
  cliente: ClienteContexto,
  { tipoRelatorio = "atendimento" }: { tipoRelatorio?: "atendimento" | "pendencias" } = {}
): Promise<RelatorioCliente> {
  const relatorioPendencias = tipoRelatorio === "pendencias";
  const instrucaoTipo = relatorioPendencias
    ? `Produza um RELATÓRIO DE PENDÊNCIAS conciso. Declare que a análise se baseia no Relatório de Pendências da Receita Federal e nas demais evidências levantadas. Liste somente pendências efetivamente identificadas, as evidências analisadas, a conclusão técnica e orientações de regularização. Não atribua responsabilidade nem invente prazos.`
    : `Produza um RELATÓRIO DE ATENDIMENTO de uma única página, destinado a atestar o que ocorreu e como o caso foi resolvido. Limite-se à descrição objetiva do caso, às providências realizadas e à resolução. Não mencione pendências, responsáveis, prazos, próximos passos ou arquivos entregues.`;
  const raw = await chatCompletion(
    admin,
    [
      { role: "system", content: PERSONA },
      {
        role: "user",
        content:
          `Com base na conversa e no diagnóstico, escreva um RELATÓRIO DE ATENDIMENTO para ENTREGAR AO CLIENTE ` +
          `(pessoa leiga). Linguagem clara, acolhedora e sem jargão — quando um termo técnico for inevitável, ` +
          `explique em uma frase. Não invente valores nem prazos que não estejam na conversa. Fale do caso na ` +
          `terceira pessoa ("o cliente", "sua declaração"). ${instrucaoTipo}\n\n` +
          `Responda APENAS um JSON válido, sem markdown, no formato:\n` +
          `{"titulo":"título curto do atendimento, ex.: Regularização de Malha Fina 2024",` +
          `"problema":"qual era o problema do cliente, 1-2 frases",` +
          `"solucao":"o resultado obtido, a conclusão ou a orientação efetivamente fornecida, 1-2 frases",` +
          `"oqueFeito":"o que foi feito, em itens separados por \\n começando com '- '",` +
          `"comoFeito":"orientações para regularização, em itens por \\n, somente no relatório de pendências; vazio no relatório de atendimento",` +
          `"entregas":"sempre vazio",` +
          `"pendencias":"itens efetivamente identificados, separados por \\n, somente no relatório de pendências; vazio no relatório de atendimento",` +
          `"responsavelProximoPasso":"sempre vazio",` +
          `"prazoProximoPasso":"sempre vazio"}\n\n` +
          `Cliente: ${cliente.name} | Tipo: ${cliente.taxType || "-"}\n` +
          `Diagnóstico do contador: ${cliente.diagnosis || "(vazio)"}\n` +
          `Tratamento/prescrição: ${cliente.treatment || "(vazio)"}\n` +
          `Conversa:\n${historyToText(cliente.messages)}`,
      },
    ],
    { temperature: 0.3, maxTokens: 700 }
  );
  return extrairJson(raw, {
    titulo: "",
    problema: raw,
    solucao: "",
    oqueFeito: "",
    comoFeito: "",
    entregas: "",
    pendencias: "",
    responsavelProximoPasso: "",
    prazoProximoPasso: "",
  });
}

export async function chatVision(
  admin: Admin,
  promptText: string,
  imageDataUrl: string,
  { maxTokens = 700 }: { maxTokens?: number } = {}
): Promise<string> {
  const active = await resolveProvider(admin, "documentos");
  if (!active.key) {
    const err = new IaError("ia_not_configured");
    err.code = "ia_not_configured";
    throw err;
  }
  const res = await fetch(active.baseURL + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${active.key}`, "Content-Type": "application/json", "X-Title": "Ola Contador" },
    body: JSON.stringify({
      model: active.visionModel,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: PERSONA },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    const err = new IaError(`ia_error: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data?.choices?.[0]?.message?.content || "";
}

const PROMPT_DOC = `Analise este documento fiscal brasileiro (ex.: intimação da Receita, DARF, DAS, extrato, comprovante).
Responda APENAS um JSON válido, sem markdown, no formato:
{"tipo":"tipo do documento","resumo":"o que é e o que exige, em 1-2 linhas","diagnostico":"problema fiscal identificado","dados":"campos-chave extraídos (valores, datas, códigos, competência)"}`;

export async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text || "";
}

export type AnaliseDocumento = { tipo: string; resumo: string; diagnostico: string; dados: string };

export async function analisarDocumento(admin: Admin, buffer: Buffer, mime: string | null): Promise<AnaliseDocumento> {
  let raw: string;
  if (mime && mime.startsWith("image/")) {
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    raw = await chatVision(admin, PROMPT_DOC, dataUrl, { maxTokens: 600 });
  } else if (mime === "application/pdf") {
    let texto = "";
    try {
      texto = (await extrairTextoPDF(buffer)).slice(0, 8000);
    } catch {
      return { tipo: "PDF", resumo: "Não consegui extrair o texto deste PDF automaticamente.", diagnostico: "", dados: "" };
    }
    raw = await chatCompletion(
      admin,
      [
        { role: "system", content: PERSONA },
        { role: "user", content: `${PROMPT_DOC}\n\nConteúdo extraído do PDF:\n${texto}` },
      ],
      { temperature: 0.2, maxTokens: 600, uso: "documentos" }
    );
  } else {
    return { tipo: "Desconhecido", resumo: "Formato não suportado para leitura automática (envie imagem ou PDF).", diagnostico: "", dados: "" };
  }
  return extrairJson(raw, { tipo: "", resumo: raw, diagnostico: "", dados: "" });
}

// skills_embeddings ainda não está nos tipos gerados do Supabase (nunca foi
// consultada do lado Next antes) — usamos o client admin sem o generic
// Database só nesta função, igual ao legado, que usa um client próprio aqui.
export async function uploadSkillPDF(
  admin: SupabaseClient,
  skillName: string,
  base64: string
): Promise<{ success: true; chunksProcessed: number }> {
  if (!skillName || !base64) throw new Error("Faltam parâmetros.");
  const OPENAI_API_KEY = await getSystemSecret(admin, "OPENAI_API_KEY");
  if (!OPENAI_API_KEY || !(await isUsoHabilitado(admin, "OPENAI_API_KEY", "embeddings"))) {
    const e = new IaError("OPENAI_API_KEY_MISSING");
    e.code = "ia_not_configured";
    throw e;
  }

  const buffer = Buffer.from(base64.split(",")[1] || base64, "base64");
  const text = await extrairTextoPDF(buffer);
  if (text.length < 50) throw new Error("PDF sem texto legível.");

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";
  for (const p of paragraphs) {
    if (currentChunk.length + p.length > 1200 && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += p + "\n\n";
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());

  let successCount = 0;
  for (const chunk of chunks) {
    if (chunk.length < 50) continue;
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: chunk }),
    });
    const embData = await embRes.json();
    const embedding = embData?.data?.[0]?.embedding;
    if (embedding) {
      await admin.from("skills_embeddings").insert({ skill_name: skillName, chunk_text: chunk, embedding });
      successCount++;
    }
  }
  return { success: true, chunksProcessed: successCount };
}

async function generateEmbeddingForQuery(admin: Admin, text: string): Promise<number[] | null> {
  const OPENAI_API_KEY = await getSystemSecret(admin, "OPENAI_API_KEY");
  if (!OPENAI_API_KEY || !(await isUsoHabilitado(admin, "OPENAI_API_KEY", "embeddings"))) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding error", e);
    return null;
  }
}

// Busca por similaridade nos PDFs indexados (skills_embeddings via
// match_skills) — porte 1:1 de getRagContext em api/_lib/ia.js. skillName
// filtra pela mesma categoria usada no upload (ex.: o taxType do cliente).
export async function getRagContext(skillName: string | null | undefined, query: string, admin: SupabaseClient): Promise<string> {
  if (!skillName) return "";
  const embedding = await generateEmbeddingForQuery(admin, query);
  if (!embedding) return "";

  const { data, error } = await admin.rpc("match_skills", {
    query_embedding: embedding,
    match_threshold: 0.1,
    match_count: 5,
    skill_filter: skillName,
  });
  if (error || !data || !data.length) return "";
  return (data as { chunk_text: string }[]).map((d) => d.chunk_text).join("\n\n");
}
