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

export async function GET() {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data, error } = await admin
    .from("instagram_campanhas")
    .select("id,nome,post_id,palavras_chave,resposta_dm,link_destino,resposta_publica_ativa,resposta_publica_texto,dispara_por_dm,ativa,criado_em")
    .order("criado_em", { ascending: false });
  if (error) return NextResponse.json({ error: "campanhas_list_failed" }, { status: 400 });
  return NextResponse.json(data || [], { headers: { "Cache-Control": "private, no-store" } });
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

export async function POST(request: Request) {
  const staffId = await requireStaff();
  if (!staffId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as CampanhaPayload;
  if (!body.nome?.trim() || !body.respostaDm?.trim() || !body.palavrasChave?.length) {
    return NextResponse.json({ error: "nome_resposta_e_palavras_chave_obrigatorios" }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data, error } = await admin
    .from("instagram_campanhas")
    .insert({
      nome: body.nome.trim(),
      post_id: body.postId || null,
      palavras_chave: body.palavrasChave,
      resposta_dm: body.respostaDm.trim(),
      link_destino: body.linkDestino || null,
      resposta_publica_ativa: Boolean(body.respostaPublicaAtiva),
      resposta_publica_texto: body.respostaPublicaTexto || null,
      dispara_por_dm: Boolean(body.disparaPorDm),
      ativa: body.ativa !== false,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "campanha_criacao_falhou" }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
