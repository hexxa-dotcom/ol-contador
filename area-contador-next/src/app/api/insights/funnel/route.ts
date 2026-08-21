import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Mesmo padrão de exigirEquipe() usado em /api/operational-errors.
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

// Funil comercial a partir do que já é gravado em funil_eventos (ver
// lib/metricas.ts) — sem depender de nenhuma API externa. Três estágios:
// iniciou (checkout ou agendamento) -> cobrança gerada -> conversão
// concluída (pagamento confirmado, assinatura ativada ou crédito resgatado).
const EVENTOS_INICIO = ["checkout_iniciado", "agendamento_iniciado"];
const EVENTOS_COBRANCA = ["cobranca_criada"];
const EVENTOS_CONVERSAO = ["pagamento_confirmado", "assinatura_ativada", "credito_resgatado"];

export async function GET(request: Request) {
  const ctx = await exigirEquipe();
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = ctx.admin.from("funil_eventos").select("evento,origem,created_at");
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  const { data, error } = await query.limit(10000);
  if (error) return NextResponse.json({ error: "funil_query_failed" }, { status: 500 });

  const contagemPorEvento: Record<string, number> = {};
  for (const row of data || []) {
    contagemPorEvento[row.evento] = (contagemPorEvento[row.evento] || 0) + 1;
  }
  const somar = (eventos: string[]) => eventos.reduce((soma, evento) => soma + (contagemPorEvento[evento] || 0), 0);

  return NextResponse.json(
    {
      estagios: {
        iniciou: somar(EVENTOS_INICIO),
        cobrancaGerada: somar(EVENTOS_COBRANCA),
        conversaoConcluida: somar(EVENTOS_CONVERSAO),
      },
      porEvento: contagemPorEvento,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
