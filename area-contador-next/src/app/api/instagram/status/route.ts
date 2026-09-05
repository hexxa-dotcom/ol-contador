import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { obterContaInstagram } from "@/lib/instagram";

export const runtime = "nodejs";

// Status da conexão da conta do Instagram, pra mostrar em Configurações.
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const conta = await obterContaInstagram(admin);
  if (!conta) return NextResponse.json({ conectado: false });
  return NextResponse.json({ conectado: true, username: conta.username, expiraEm: conta.expiraEm });
}
