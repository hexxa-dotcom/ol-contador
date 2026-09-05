import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendInstagramText } from "@/lib/instagram";

export const runtime = "nodejs";

// Envia uma DM do contador pra uma conversa existente. Só funciona dentro da
// janela de 24h desde a última mensagem da pessoa — fora dela a Meta rejeita
// (sem fallback de template, diferente do WhatsApp); nesse caso devolvemos o
// erro da Meta pra UI explicar pro contador.
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { conversaId?: string; texto?: string };
  const texto = body.texto?.trim();
  if (!body.conversaId || !texto) return NextResponse.json({ error: "conversaId_e_texto_obrigatorios" }, { status: 400 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: conversa } = await admin.from("instagram_conversas").select("id,ig_user_id").eq("id", body.conversaId).maybeSingle();
  if (!conversa) return NextResponse.json({ error: "conversa_nao_encontrada" }, { status: 404 });

  const envio = await sendInstagramText(admin, conversa.ig_user_id, texto);
  if ("skipped" in envio) return NextResponse.json({ error: "instagram_nao_conectado" }, { status: 503 });
  if (!envio.ok) return NextResponse.json({ error: "envio_falhou", detalhe: envio.error }, { status: 502 });

  await admin.from("instagram_mensagens").insert({ conversa_id: conversa.id, sender: "contador", texto });
  await admin.from("instagram_conversas").update({ ultima_mensagem_em: new Date().toISOString() }).eq("id", conversa.id);

  return NextResponse.json({ ok: true });
}
