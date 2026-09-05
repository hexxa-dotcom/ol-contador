import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability";
import { verifyInstagramWebhookSignature, sendInstagramText, dentroDoLimiteDeEnvio, obterContaInstagram, buscarUsernameInstagram } from "@/lib/instagram";

export const runtime = "nodejs";

// Webhook da API oficial de Mensagens/Comentários do Instagram (Meta).
// Mesmo padrão do webhook do WhatsApp (src/app/api/whatsapp/webhook), mas com
// dois tipos de evento em vez de um: `messaging` (DM) e `changes` com
// field=comments (comentário→DM). Sem auth de usuário: é a Meta que chama.

type InstagramMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

type InstagramCommentChange = {
  field?: string;
  value?: {
    id?: string;
    text?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string };
  };
};

type InstagramWebhookBody = {
  entry?: {
    id?: string;
    messaging?: InstagramMessagingEvent[];
    changes?: InstagramCommentChange[];
  }[];
};

// Handshake de verificação exigido pela Meta ao registrar a URL do webhook.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

async function registrarEvento(admin: ReturnType<typeof adminClient>, eventoId: string, tipo: string, recursoId: string) {
  if (!admin) return { claimed: false };
  const { error } = await admin.from("webhook_eventos").insert({
    provedor: "instagram",
    evento_id: eventoId,
    tipo,
    recurso_id: recursoId,
    status: "processing",
  });
  if (error?.code === "23505") return { claimed: false };
  return { claimed: true };
}

async function marcarEvento(admin: ReturnType<typeof adminClient>, eventoId: string, status: string, erro?: string) {
  if (!admin) return;
  await admin
    .from("webhook_eventos")
    .update({ status, erro: erro || null, processado_em: new Date().toISOString() })
    .eq("provedor", "instagram")
    .eq("evento_id", eventoId);
}

// DM recebida: cria a conversa se `ig_user_id` for novo (sem exigir cliente
// cadastrado — vínculo é manual, feito depois na Fila de Atendimento) e
// insere a mensagem.
async function processarMensagemDireta(admin: NonNullable<ReturnType<typeof adminClient>>, evento: InstagramMessagingEvent) {
  const senderId = evento.sender?.id;
  const texto = evento.message?.text;
  const messageId = evento.message?.mid;
  if (!senderId || !texto || !messageId) return;
  // is_echo: mensagem que o PRÓPRIO app mandou, ecoada de volta pelo webhook
  // — não é uma DM recebida, ignorar pra não duplicar o que já foi inserido
  // no envio.
  if (evento.message?.is_echo) return;

  const { data: conversaExistente } = await admin
    .from("instagram_conversas")
    .select("id")
    .eq("ig_user_id", senderId)
    .maybeSingle();

  let conversaId = conversaExistente?.id;
  if (!conversaId) {
    // Conversa nova: busca o @usuário antes de criar, pra não mostrar o ID
    // numérico gigante na lista (o evento de mensagem não traz o username).
    const username = await buscarUsernameInstagram(admin, senderId);
    conversaId = (
      await admin
        .from("instagram_conversas")
        .insert({ ig_user_id: senderId, ig_username: username, ultima_mensagem_em: new Date().toISOString(), nao_lida: true })
        .select("id")
        .single()
    ).data?.id;
  }

  if (!conversaId) return;

  if (conversaExistente) {
    await admin
      .from("instagram_conversas")
      .update({ ultima_mensagem_em: new Date().toISOString(), nao_lida: true })
      .eq("id", conversaId);
  }

  await admin.from("instagram_mensagens").insert({
    conversa_id: conversaId,
    sender: "lead",
    texto,
    ig_message_id: messageId,
  });

  await dispararCampanhaPorTexto(admin, { origem: "dm", autorId: senderId, texto, conversaId });
}

// Confere campanhas com `dispara_por_dm` ativas cuja palavra-chave bate no
// texto recebido (DM direta ou resposta de Story — a Meta entrega os dois
// como o mesmo tipo de evento de mensagem) e responde automaticamente,
// respeitando o limite de 750/h. Compartilhado pelo fluxo de DM; o de
// comentário tem regra própria (também confere o post) em processarComentario.
async function dispararCampanhaPorTexto(
  admin: NonNullable<ReturnType<typeof adminClient>>,
  params: { origem: "dm"; autorId: string; texto: string; conversaId: string },
) {
  const textoLower = params.texto.toLowerCase();

  const { data: campanhas } = await admin
    .from("instagram_campanhas")
    .select("id,palavras_chave,resposta_dm,link_destino")
    .eq("ativa", true)
    .eq("dispara_por_dm", true);

  const campanha = (campanhas || []).find((item) => (item.palavras_chave || []).some((palavra) => textoLower.includes(palavra.toLowerCase())));
  if (!campanha) return;

  if (!(await dentroDoLimiteDeEnvio(admin))) return;

  const mensagemDm = campanha.resposta_dm.replace(/\{username\}/g, "");
  const textoFinal = campanha.link_destino ? `${mensagemDm}\n\n${campanha.link_destino}` : mensagemDm;
  const envio = await sendInstagramText(admin, params.autorId, textoFinal);
  if ("ok" in envio && envio.ok) {
    await admin.from("instagram_mensagens").insert({ conversa_id: params.conversaId, sender: "contador", texto: textoFinal });
  }
}

// Comentário recebido: confere campanhas ativas (por post e por palavra-chave),
// ignora comentário do próprio dono da conta, dispara a DM automática
// respeitando o limite de 750/h, e opcionalmente responde publicamente.
async function processarComentario(admin: NonNullable<ReturnType<typeof adminClient>>, comentario: NonNullable<InstagramCommentChange["value"]>) {
  const autorId = comentario.from?.id;
  const texto = (comentario.text || "").toLowerCase();
  const postId = comentario.media?.id;
  const comentarioId = comentario.id;
  if (!autorId || !texto || !comentarioId) return;

  const conta = await obterContaInstagram(admin);
  if (conta && autorId === conta.userId) return; // comentário do próprio dono da conta, ignora

  const { data: campanhas } = await admin
    .from("instagram_campanhas")
    .select("id,post_id,palavras_chave,resposta_dm,link_destino,resposta_publica_ativa,resposta_publica_texto")
    .eq("ativa", true);

  const campanha = (campanhas || []).find((item) => {
    const postBate = !item.post_id || item.post_id === postId;
    const palavraBate = (item.palavras_chave || []).some((palavra) => texto.includes(palavra.toLowerCase()));
    return postBate && palavraBate;
  });
  if (!campanha) return;

  if (!(await dentroDoLimiteDeEnvio(admin))) return; // limite de 750/h atingido, não envia (comentário fica sem resposta automática desta vez)

  const mensagemDm = campanha.resposta_dm.replace(/\{username\}/g, comentario.from?.username || "");
  const textoFinal = campanha.link_destino ? `${mensagemDm}\n\n${campanha.link_destino}` : mensagemDm;

  const { data: conversaExistente } = await admin
    .from("instagram_conversas")
    .select("id")
    .eq("ig_user_id", autorId)
    .maybeSingle();

  const conversaId =
    conversaExistente?.id ||
    (
      await admin
        .from("instagram_conversas")
        .insert({ ig_user_id: autorId, ig_username: comentario.from?.username || null, ultima_mensagem_em: new Date().toISOString(), nao_lida: true })
        .select("id")
        .single()
    ).data?.id;

  const envio = await sendInstagramText(admin, autorId, textoFinal);
  if (conversaId && "ok" in envio && envio.ok) {
    await admin.from("instagram_mensagens").insert({ conversa_id: conversaId, sender: "contador", texto: textoFinal });
  }

  if (campanha.resposta_publica_ativa && campanha.resposta_publica_texto) {
    await fetch(`https://graph.instagram.com/v26.0/${comentarioId}/replies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conta?.accessToken || ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: campanha.resposta_publica_texto }),
    }).catch(() => {});
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyInstagramWebhookSignature(rawBody, signature)) {
    return new NextResponse("invalid_signature", { status: 401 });
  }

  const admin = adminClient();
  if (!admin) return new NextResponse("service_role_not_configured", { status: 200 });

  const body = JSON.parse(rawBody) as InstagramWebhookBody;

  for (const entry of body.entry || []) {
    for (const evento of entry.messaging || []) {
      const messageId = evento.message?.mid;
      if (!messageId) continue;
      const { claimed } = await registrarEvento(admin, messageId, "mensagem", evento.sender?.id || "");
      if (!claimed) continue;
      try {
        await processarMensagemDireta(admin, evento);
        await marcarEvento(admin, messageId, "processed");
      } catch (e) {
        const err = e as Error;
        await registrarErro(admin, { origem: "instagram_webhook", codigo: "mensagem_falhou", mensagem: err.message, rota: "/api/instagram/webhook", severidade: "erro", contexto: { messageId } });
        await marcarEvento(admin, messageId, "failed", err.message);
      }
    }

    for (const change of entry.changes || []) {
      if (change.field !== "comments" || !change.value?.id) continue;
      const comentarioId = change.value.id;
      const { claimed } = await registrarEvento(admin, comentarioId, "comentario", change.value.from?.id || "");
      if (!claimed) continue;
      try {
        await processarComentario(admin, change.value);
        await marcarEvento(admin, comentarioId, "processed");
      } catch (e) {
        const err = e as Error;
        await registrarErro(admin, { origem: "instagram_webhook", codigo: "comentario_falhou", mensagem: err.message, rota: "/api/instagram/webhook", severidade: "erro", contexto: { comentarioId } });
        await marcarEvento(admin, comentarioId, "failed", err.message);
      }
    }
  }

  return new NextResponse("ok", { status: 200 });
}
