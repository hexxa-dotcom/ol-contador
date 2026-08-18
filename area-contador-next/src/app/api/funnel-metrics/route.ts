import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { checarRateLimit } from "@/lib/rateLimit";
import { registrarEventoFunil } from "@/lib/metricas";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

const EVENTOS_PUBLICOS = ["precos_visualizados", "agendamento_iniciado", "checkout_iniciado"];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// POST — telemetria pública (sem login) do funil comercial: chamada pelas
// páginas de marketing/checkout pra registrar em que passo cada visitante
// desistiu. Rate-limited porque é um endpoint público sem autenticação.
export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  if (!(await checarRateLimit(admin, request, "funil-publico", 30, 15))) return NextResponse.json({ error: "muitas_tentativas" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { evento?: string; sessaoRef?: string; servicoId?: string; origem?: string } | null;
  const evento = String(body?.evento || "");
  const sessaoRef = String(body?.sessaoRef || "");
  if (!EVENTOS_PUBLICOS.includes(evento) || !UUID_V4.test(sessaoRef)) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  await registrarEventoFunil(admin, evento, {
    sessaoRef,
    servicoId: String(body?.servicoId || "").slice(0, 80) || undefined,
    origem: String(body?.origem || "site").slice(0, 80),
  });
  return NextResponse.json({ ok: true });
}

// Contagem de sessões únicas (Set por sessao_ref) para os passos do funil que
// fazem sentido contar uma vez por visitante; pagamento_confirmado usa
// contagem simples (pode ocorrer mais de uma vez por sessão/cliente).
function contarUnicos(eventos: { evento: string; sessao_ref: string | null }[], nome: string) {
  const set = new Set<string>();
  for (const e of eventos) {
    if (e.evento === nome && e.sessao_ref) set.add(e.sessao_ref);
  }
  return set.size;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const dias = Math.min(365, Math.max(1, Number(searchParams.get("dias")) || 30));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const [{ data: eventos, error }, { data: cobrancas }] = await Promise.all([
    admin.from("funil_eventos").select("evento,sessao_ref").gte("created_at", desde),
    admin.from("cobrancas").select("valor_cents,desconto_cents,status").gte("created_at", desde),
  ]);
  if (error) {
    await registrarErro(admin, { origem: "api/funnel-metrics", codigo: "funnel_query_failed", mensagem: error.message, rota: "/api/funnel-metrics" });
    return NextResponse.json({ error: "funnel_query_failed" }, { status: 500 });
  }

  const ev = eventos || [];
  const precosVisualizados = contarUnicos(ev, "precos_visualizados");
  const agendamentoIniciado = contarUnicos(ev, "agendamento_iniciado");
  const checkoutIniciado = contarUnicos(ev, "checkout_iniciado");
  const pagamentoConfirmado = ev.filter((e) => e.evento === "pagamento_confirmado").length;

  const pagas = (cobrancas || []).filter((c) => c.status === "paid");
  const totalDescontosCents = pagas.reduce((acc, c) => acc + (c.desconto_cents || 0), 0);
  const receitaPagaCents = pagas.reduce((acc, c) => acc + (c.valor_cents || 0), 0);

  const taxa = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  return NextResponse.json(
    {
      dias,
      contagens: {
        precos_visualizados: precosVisualizados,
        agendamento_iniciado: agendamentoIniciado,
        checkout_iniciado: checkoutIniciado,
        pagamento_confirmado: pagamentoConfirmado,
      },
      totalDescontosCents,
      receitaPagaCents,
      conversoes: {
        visitaParaAgendamento: taxa(agendamentoIniciado, precosVisualizados),
        agendamentoParaCheckout: taxa(checkoutIniciado, agendamentoIniciado),
        checkoutParaPagamento: taxa(pagamentoConfirmado, checkoutIniciado),
      },
      abandonos: {
        antesAgendamento: Math.max(0, precosVisualizados - agendamentoIniciado),
        antesCheckout: Math.max(0, agendamentoIniciado - checkoutIniciado),
        antesPagamento: Math.max(0, checkoutIniciado - pagamentoConfirmado),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
