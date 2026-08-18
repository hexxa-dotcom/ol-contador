import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { sincronizarCobrancaAsaas } from "@/lib/pagamento";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

async function exigirEquipe() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "service_unavailable" }, { status: 503 }) };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const admin = adminClient();
  if (!admin) return { error: NextResponse.json({ error: "service_role_not_configured" }, { status: 503 }) };
  return { admin };
}

// GET — trilha de auditoria: últimos eventos de webhook recebidos (todos os
// provedores), mais recentes primeiro. `webhook_eventos` tem RLS
// service_role-only, então essa é a única forma da equipe enxergar isso.
export async function GET() {
  const ctx = await exigirEquipe();
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.admin
    .from("webhook_eventos")
    .select("*")
    .order("recebido_em", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "webhook_query_failed" }, { status: 500 });

  return NextResponse.json({ eventos: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST — reprocessamento manual de um evento com status 'failed' (ou
// 'processing' travado por queda no meio do processamento). Reconsulta o
// pagamento de verdade no Asaas antes de aplicar qualquer mudança — nunca
// confia só no que está salvo em webhook_eventos.
export async function POST(request: Request) {
  const ctx = await exigirEquipe();
  if (ctx.error) return ctx.error;

  const body = (await request.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  const { data: evento } = await ctx.admin.from("webhook_eventos").select("*").eq("id", id).maybeSingle();
  if (!evento) return NextResponse.json({ error: "evento_not_found" }, { status: 404 });
  if (evento.status === "processed") return NextResponse.json({ error: "ja_processado" }, { status: 409 });
  if (evento.provedor !== "asaas" || !evento.recurso_id) return NextResponse.json({ error: "provedor_nao_suportado" }, { status: 400 });

  const { data: cob } = await ctx.admin.from("cobrancas").select("*").eq("asaas_payment_id", evento.recurso_id).maybeSingle();
  if (!cob) {
    await ctx.admin.from("webhook_eventos").update({ status: "ignored", processado_em: new Date().toISOString(), erro: null }).eq("id", id);
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  try {
    const resultado = await sincronizarCobrancaAsaas(ctx.admin, cob);
    await ctx.admin.from("webhook_eventos").update({ status: "processed", processado_em: new Date().toISOString(), erro: null }).eq("id", id);
    return NextResponse.json({ ok: true, status: "processed", resultado });
  } catch (e) {
    const err = e as Error;
    await registrarErro(ctx.admin, { origem: "webhook_reprocess", codigo: "reprocess_failed", mensagem: err.message, rota: "/api/webhooks/reprocess", severidade: "critico", contexto: { webhookEventoId: id, cobrancaId: cob.id } });
    await ctx.admin.from("webhook_eventos").update({ status: "failed", erro: String(err.message || err), processado_em: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ error: "reprocess_failed", detail: err.message }, { status: 502 });
  }
}
