import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as notify from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;
const actions = { "finalize-report": "finalizar-pos-atendimento" } as const;

// Textos "estilo rastreio de encomenda" — cada etapa do Kanban de
// Acompanhamento vira um e-mail curto avisando o cliente que o caso avançou.
const KANBAN_EMAIL_POR_ETAPA: Record<string, { titulo: string; corpo: string }> = {
  pending: { titulo: "Seu caso entrou em acompanhamento", corpo: "Seu atendimento não termina por aqui — o contador vai continuar acompanhando a resolução do seu caso, e você recebe um aviso a cada etapa." },
  active: { titulo: "Seu caso está em análise", corpo: "O contador começou a analisar o seu caso. Assim que houver novidade, você é avisado por aqui." },
  docs: { titulo: "Precisamos de mais alguns documentos seus", corpo: 'Estamos com o seu caso, mas para continuar precisamos de documentos adicionais. Acesse sua área de cliente e confira o que falta em "Documentos".' },
  ready: { titulo: "Seu caso está pronto", corpo: "Está tudo encaminhado — a entrega final do seu atendimento está sendo preparada." },
  done: { titulo: "Seu atendimento foi concluído!", corpo: "Seu caso foi concluído. Acesse sua área de cliente para conferir o relatório e os detalhes." },
};

const EXPRESS_AVISO_POR_STATUS: Record<string, [string, string]> = {
  em_analise: ["Seu Atendimento Express entrou em análise", "Recebemos sua triagem e o contador iniciou a análise do caso."],
  em_execucao: ["Seu Atendimento Express está em execução", "A análise foi concluída e o serviço contratado está sendo executado."],
  aguardando_documentos: ["Precisamos de um documento para continuar", "Acesse sua Área do Cliente e confira os documentos do caso. Assim que recebermos o complemento, o serviço continuará."],
  pronto_envio: ["Seu resultado está sendo preparado", "A execução terminou e o relatório final está sendo preparado para entrega."],
};

function horaPainel(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id,role,name,nome,email").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "express-assign") {
    const id = Number(body?.id);
    const requestedId = typeof body?.responsavelId === "string" ? body.responsavelId : "";
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_case" }, { status: 400 });
    if (requestedId && requestedId !== userId && staff.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const target = requestedId ? (await supabase.from("staff").select("id,name,nome,email").eq("id", requestedId).maybeSingle()).data : null;
    if (requestedId && !target) return NextResponse.json({ error: "staff_not_found" }, { status: 404 });
    const responsibleName = target ? target.nome || target.name || target.email : null;
    const { data, error } = await supabase
      .from("atendimentos_express")
      .update({ responsavel_id: target?.id || null, responsavel_nome: responsibleName, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,responsavel_id,responsavel_nome")
      .single();
    if (error || !data) return NextResponse.json({ error: "assignment_failed" }, { status: 400 });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Move um cliente entre as etapas do Kanban de Acompanhamento — e manda o
  // e-mail de "seu caso avançou" (por isso passa pelo servidor, não pelo
  // navegador direto: depende da RESEND_API_KEY).
  if (action === "kanban-stage") {
    const admin = adminClient();
    if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
    const clientId = typeof body?.clientId === "string" ? body.clientId : "";
    const status = typeof body?.status === "string" ? body.status : "";
    if (!clientId || !["pending", "active", "docs", "ready", "done", "recorrencia"].includes(status)) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }
    const { data: linha } = await admin.from("configuracoes").select("valor").eq("chave", "kanban_etapas").maybeSingle();
    const etapas = (linha?.valor && typeof linha.valor === "object" && !Array.isArray(linha.valor) ? linha.valor : {}) as Record<string, string>;
    etapas[clientId] = status;
    const { error } = await admin.from("configuracoes").upsert({ chave: "kanban_etapas", valor: etapas as never }, { onConflict: "chave" });
    if (error) return NextResponse.json({ error: "kanban_update_failed" }, { status: 500 });

    const copy = KANBAN_EMAIL_POR_ETAPA[status];
    if (copy) {
      const { data: cliente } = await admin.from("clientes").select("*").eq("id", clientId).single();
      if (cliente) void notify.notifyCliente(cliente, copy.titulo, copy.corpo);
    }
    return NextResponse.json({ ok: true, status });
  }

  // Centraliza as mudanças do Atendimento Express no servidor: registra o
  // responsável e envia os avisos sem expor as credenciais dos provedores ao
  // navegador.
  if (action === "express-status") {
    const admin = adminClient();
    if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
    const id = Number(body?.id);
    const status = typeof body?.status === "string" ? body.status : "";
    const permitidos = ["aguardando_triagem", "em_analise", "em_execucao", "aguardando_documentos", "pronto_envio", "concluido", "cancelado"];
    if (!id || !permitidos.includes(status)) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

    const { data: atual, error: atualError } = await admin.from("atendimentos_express").select("*").eq("id", id).maybeSingle();
    if (atualError || !atual) return NextResponse.json({ error: "atendimento_express_not_found" }, { status: 404 });
    if (status === "concluido") {
      const { data: entrega } = await admin.from("relatorios").select("id").eq("atendimento_express_id", id).eq("status", "entregue").order("entregue_em", { ascending: false }).limit(1).maybeSingle();
      if (!entrega) return NextResponse.json({ error: "resultado_ainda_nao_entregue" }, { status: 409 });
    }

    const agora = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: agora };
    if (status === "em_execucao") {
      patch.iniciado_em = atual.iniciado_em || agora;
      patch.responsavel_id = atual.responsavel_id || userId;
      patch.responsavel_nome = atual.responsavel_nome || staff.nome || staff.name || staff.email || "Equipe Olá, Contador";
    }
    if (status === "concluido") patch.concluido_em = atual.concluido_em || agora;
    const { data, error } = await admin
      .from("atendimentos_express")
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "express_update_failed", detail: error.message }, { status: 500 });

    if (atual.status !== status) {
      const { data: cliente } = await admin.from("clientes").select("*").eq("id", atual.cliente_ref).maybeSingle();
      const copy = EXPRESS_AVISO_POR_STATUS[status];
      if (cliente && copy) void notify.notifyCliente(cliente, copy[0], copy[1]);
      await admin.from("notificacoes").insert({
        text: `Atendimento Express #${id}: ${status.replaceAll("_", " ")}${patch.responsavel_nome ? ` · ${patch.responsavel_nome}` : ""}.`,
        time: horaPainel(),
        unread: true,
        cliente_ref: atual.cliente_ref,
      });
    }
    return NextResponse.json({ ok: true, atendimento: data });
  }

  // finalize-report ainda não foi portado nativamente (entrega multicanal com
  // retry + RPC transacional finalizar_pos_atendimento) — continua no legado
  // por enquanto.
  if (!(action in actions)) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = { ...body };
  delete payload.action;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(`https://www.olacontador.com.br/api/status?acao=${actions[action as keyof typeof actions]}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "AbortError" ? "operation_timeout" : "operation_unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
