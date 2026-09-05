import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { obterContaInstagram, renovarTokenDeLongaDuracao, salvarContaInstagram } from "@/lib/instagram";

export const runtime = "nodejs";

// Renovação diária do token de longa duração do Instagram (~60 dias de vida
// — diferente do token de System User do WhatsApp, que não expira). Roda
// todo dia (ver vercel.json); só renova de fato quando falta pouco pra
// vencer, mas rodar diário não tem custo — a chamada em si é barata.

export async function GET(request: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const isCron = !!(process.env.CRON_SECRET && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);
  if (!isCron) {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
    if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const conta = await obterContaInstagram(admin);
  if (!conta) return NextResponse.json({ ok: true, motivo: "conta_nao_conectada" });

  // Só renova se faltar menos de 10 dias pro vencimento — a Meta exige pelo
  // menos 24h de vida restante no token pra aceitar renovar, e não há motivo
  // pra chamar a API todo dia sem necessidade.
  const faltamDias = (new Date(conta.expiraEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (faltamDias > 10) return NextResponse.json({ ok: true, motivo: "ainda_nao_precisa", faltamDias: Math.round(faltamDias) });

  const renovado = await renovarTokenDeLongaDuracao(conta.accessToken);
  if (!renovado) return NextResponse.json({ error: "renovacao_falhou" }, { status: 502 });

  await salvarContaInstagram(admin, { userId: conta.userId, username: conta.username, accessToken: renovado.accessToken, expiraEm: renovado.expiraEm });
  return NextResponse.json({ ok: true, expiraEm: renovado.expiraEm });
}
