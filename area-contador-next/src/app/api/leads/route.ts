import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/notify";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

// Formulário de contato da categoria "Empresas 2" — avaliação gratuita,
// sem checkout pago. Vira uma linha em leads_empresariais pro contador ver
// e responder manualmente (depois, se fechar, gera um crédito em
// Financeiro → Gerar crédito).
export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    nome?: string;
    email?: string;
    telefone?: string;
    empresa?: string;
    servicoSlug?: string;
    mensagem?: string;
  } | null;

  const nome = String(body?.nome || "").trim().slice(0, 120);
  const email = String(body?.email || "").trim().slice(0, 180);
  const telefone = String(body?.telefone || "").trim().slice(0, 40);
  const mensagem = String(body?.mensagem || "").trim().slice(0, 2000);

  if (nome.length < 2) return NextResponse.json({ error: "informe_nome" }, { status: 400 });
  if (!email.includes("@") && telefone.length < 8) {
    return NextResponse.json({ error: "informe_contato" }, { status: 400 });
  }
  if (mensagem.length < 5) return NextResponse.json({ error: "descreva_o_caso" }, { status: 400 });

  const { data, error } = await admin
    .from("leads_empresariais")
    .insert({
      nome,
      email: email || null,
      telefone: telefone || null,
      empresa: String(body?.empresa || "").trim().slice(0, 160) || null,
      servico_slug: String(body?.servicoSlug || "").trim().slice(0, 160) || null,
      mensagem,
    })
    .select("id")
    .single();

  if (error || !data) {
    await registrarErro(admin, {
      origem: "api/leads",
      codigo: "insert_falhou",
      mensagem: error?.message || "sem dados retornados",
      rota: "/api/leads",
      severidade: "erro",
    });
    return NextResponse.json({ error: "nao_foi_possivel_enviar" }, { status: 502 });
  }

  if (emailConfigured()) {
    const html = `<p><strong>Nome:</strong> ${nome}</p>
      <p><strong>E-mail:</strong> ${email || "—"}</p>
      <p><strong>Telefone:</strong> ${telefone || "—"}</p>
      <p><strong>Empresa:</strong> ${String(body?.empresa || "—")}</p>
      <p><strong>Serviço de interesse:</strong> ${String(body?.servicoSlug || "—")}</p>
      <p><strong>Mensagem:</strong><br>${mensagem.replace(/\n/g, "<br>")}</p>`;
    await sendEmail("ola@olacontador.com.br", `Novo pedido de avaliação — ${nome}`, html).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: data.id });
}
