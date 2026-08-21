import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/checkout/config — única informação pública que o checkout precisa
// saber antes de decidir qual formulário de cartão mostrar: se o checkout
// transparente (campos de cartão na nossa página) está ligado em
// Configurações > Integrações. RLS bloqueia leitura anônima de
// `configuracoes`, por isso esse pequeno proxy com o client admin.
export async function GET() {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ cartaoTransparente: false });

  const { data } = await admin.from("configuracoes").select("valor").eq("chave", "painel_preferencias").maybeSingle();
  const valor = data?.valor as Record<string, unknown> | null;
  const cartaoTransparente = valor?.checkoutCartaoTransparente === true;

  return NextResponse.json({ cartaoTransparente }, { headers: { "Cache-Control": "no-store" } });
}
