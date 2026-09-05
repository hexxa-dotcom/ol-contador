import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function requireStaff() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  return staff ? userId : null;
}

// Mensagens de uma conversa + marca como lida ao abrir.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: mensagens, error } = await admin
    .from("instagram_mensagens")
    .select("id,sender,texto,created_at")
    .eq("conversa_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "mensagens_list_failed" }, { status: 400 });

  await admin.from("instagram_conversas").update({ nao_lida: false }).eq("id", id);

  return NextResponse.json(mensagens || [], { headers: { "Cache-Control": "private, no-store" } });
}

// Vincular/desvincular a conversa a um cliente cadastrado — sempre manual,
// nunca automático (ver plano do módulo).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { clienteId?: string | null };

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { error } = await admin.from("instagram_conversas").update({ cliente_id: body.clienteId || null }).eq("id", id);
  if (error) return NextResponse.json({ error: "vincular_falhou" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
