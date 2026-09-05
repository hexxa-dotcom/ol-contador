import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type CampanhaUpdate = Database["public"]["Tables"]["instagram_campanhas"]["Update"];

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

type CampanhaPayload = {
  nome?: string;
  postId?: string | null;
  palavrasChave?: string[];
  respostaDm?: string;
  linkDestino?: string | null;
  respostaPublicaAtiva?: boolean;
  respostaPublicaTexto?: string | null;
  disparaPorDm?: boolean;
  ativa?: boolean;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as CampanhaPayload;

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const patch: CampanhaUpdate = {};
  if (body.nome !== undefined) patch.nome = body.nome.trim();
  if (body.postId !== undefined) patch.post_id = body.postId || null;
  if (body.palavrasChave !== undefined) patch.palavras_chave = body.palavrasChave;
  if (body.respostaDm !== undefined) patch.resposta_dm = body.respostaDm.trim();
  if (body.linkDestino !== undefined) patch.link_destino = body.linkDestino || null;
  if (body.respostaPublicaAtiva !== undefined) patch.resposta_publica_ativa = body.respostaPublicaAtiva;
  if (body.respostaPublicaTexto !== undefined) patch.resposta_publica_texto = body.respostaPublicaTexto || null;
  if (body.disparaPorDm !== undefined) patch.dispara_por_dm = body.disparaPorDm;
  if (body.ativa !== undefined) patch.ativa = body.ativa;

  const { error } = await admin.from("instagram_campanhas").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "campanha_atualizacao_falhou" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { error } = await admin.from("instagram_campanhas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "campanha_remocao_falhou" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
