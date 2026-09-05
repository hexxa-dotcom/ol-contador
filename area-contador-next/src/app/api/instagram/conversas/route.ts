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

// Lista as conversas do Instagram (mais recente primeiro) + as últimas
// mensagens de cada uma, pra montar a lista + preview na Fila de Atendimento.
export async function GET() {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: conversas, error } = await admin
    .from("instagram_conversas")
    .select("id,ig_user_id,ig_username,cliente_id,ultima_mensagem_em,nao_lida,created_at")
    .order("ultima_mensagem_em", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "conversas_list_failed" }, { status: 400 });

  const clienteIds = Array.from(new Set((conversas || []).map((c) => c.cliente_id).filter((id): id is string => Boolean(id))));
  const { data: clientes } = clienteIds.length ? await admin.from("clientes").select("id,name").in("id", clienteIds) : { data: [] };
  const nomeCliente = new Map((clientes || []).map((c) => [c.id, c.name]));

  return NextResponse.json(
    (conversas || []).map((c) => ({ ...c, cliente_nome: c.cliente_id ? nomeCliente.get(c.cliente_id) || null : null })),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
