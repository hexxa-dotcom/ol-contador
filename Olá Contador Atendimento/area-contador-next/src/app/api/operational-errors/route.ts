import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Mesmo padrão de exigirEquipe() do legado: confere login + staff via RLS do
// próprio usuário, só então devolve um client admin (service_role) pra ler/
// escrever em app_erros, que revoga todo acesso de anon/authenticated.
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
  return { admin, userId };
}

export async function GET() {
  const ctx = await exigirEquipe();
  if (ctx.error) return ctx.error;

  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await ctx.admin
    .from("app_erros")
    .select("*")
    .gte("ultimo_em", desde)
    .is("resolvido_em", null)
    .order("ultimo_em", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "erros_query_failed" }, { status: 500 });

  return NextResponse.json(
    { totalAbertos: (data || []).length, erros: data || [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const ctx = await exigirEquipe();
  if (ctx.error) return ctx.error;

  const body = (await request.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  const { error } = await ctx.admin
    .from("app_erros")
    .update({ resolvido_em: new Date().toISOString(), resolvido_por: ctx.userId })
    .eq("id", id)
    .is("resolvido_em", null);
  if (error) return NextResponse.json({ error: "erro_update_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
