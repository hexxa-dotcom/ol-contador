import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability";
import { verifyWebhookSignature, downloadWhatsAppMedia, sendWhatsAppText } from "@/lib/whatsapp";
import { responderPerguntaAdmin } from "@/lib/assistenteAdmin";

export const runtime = "nodejs";

// Webhook da WhatsApp Cloud API (Meta). Sem auth de usuário: é a Meta que
// chama. Segue o mesmo padrão do webhook do Asaas (src/app/api/asaas/webhook),
// mas a verificação de assinatura é HMAC (X-Hub-Signature-256), como a Meta exige.

type WhatsAppMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  document?: { id?: string; filename?: string; mime_type?: string };
  image?: { id?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string };
};

type WhatsAppStatus = { id: string; status: string; recipient_id?: string };

type WhatsAppWebhookBody = {
  entry?: {
    changes?: {
      value?: { messages?: WhatsAppMessage[]; statuses?: WhatsAppStatus[] };
    }[];
  }[];
};

// Handshake de verificação exigido pela Meta ao registrar a URL do webhook.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

async function registrarEvento(admin: ReturnType<typeof adminClient>, eventoId: string, tipo: string, recursoId: string) {
  if (!admin) return { claimed: false };
  const { error } = await admin.from("webhook_eventos").insert({
    provedor: "whatsapp",
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
    .eq("provedor", "whatsapp")
    .eq("evento_id", eventoId);
}

const ADMIN_WHATSAPP_PHONE = process.env.WHATSAPP_ADMIN_PHONE || "";

function ehNumeroAdmin(from: string): boolean {
  if (!ADMIN_WHATSAPP_PHONE) return false;
  return normalizeDigits(from).slice(-8) === normalizeDigits(ADMIN_WHATSAPP_PHONE).slice(-8);
}

// Mensagem vinda do próprio número do contador: não é atendimento de
// cliente, é uma pergunta pro assistente de IA sobre a base do sistema.
async function processarMensagemAdmin(admin: NonNullable<ReturnType<typeof adminClient>>, msg: WhatsAppMessage) {
  // Responde pro número fixo configurado (WHATSAPP_ADMIN_PHONE), não pro
  // msg.from — a Meta reporta o remetente brasileiro sem o 9º dígito do
  // celular, formato que não bate com o cadastrado na allow list do número
  // de teste (que exige o 9), e o envio falha (131030) se usarmos msg.from.
  const destino = ADMIN_WHATSAPP_PHONE || msg.from;
  const pergunta = msg.text?.body?.trim();
  if (!pergunta) {
    await sendWhatsAppText(destino, "Manda sua pergunta em texto que eu respondo com os dados do sistema.");
    return;
  }
  const resposta = await responderPerguntaAdmin(admin, pergunta);
  await sendWhatsAppText(destino, resposta || "Não consegui gerar uma resposta agora.");
}

async function processarMensagem(admin: NonNullable<ReturnType<typeof adminClient>>, msg: WhatsAppMessage) {
  const digitos = normalizeDigits(msg.from);
  const sufixo = digitos.slice(-8);
  const { data: cliente } = await admin
    .from("clientes")
    .select("id,phone")
    .ilike("phone", `%${sufixo}%`)
    .limit(1)
    .maybeSingle();

  if (!cliente) {
    // Número não cadastrado: registra pra não perder o evento, mas não cria
    // conversa (mensagens.cliente_id é obrigatório). Limitação conhecida da V1.
    return;
  }

  const now = new Date();
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now);
  const base = {
    id: crypto.randomUUID(),
    cliente_id: cliente.id,
    sender: "client",
    canal: "whatsapp",
    wa_message_id: msg.id,
    created_at: now.toISOString(),
    time,
  };

  if (msg.type === "text") {
    await admin.from("mensagens").insert({ ...base, text: msg.text?.body || "", type: "text" });
    return;
  }

  const media = msg.document || msg.image || msg.audio;
  const mediaId = media?.id;
  if (!mediaId) return;

  const baixado = await downloadWhatsAppMedia(mediaId);
  if (!baixado.ok) {
    await admin.from("mensagens").insert({ ...base, text: "Mídia recebida pelo WhatsApp (falha ao baixar)", type: "text" });
    return;
  }

  const extensao = baixado.mimeType.split("/")[1]?.split(";")[0] || "bin";
  const nomeArquivo = (msg.document?.filename || `whatsapp-${Date.now()}.${extensao}`).slice(0, 160);
  const storagePath = `${cliente.id}/${Date.now()}_${nomeArquivo.replace(/[^\w.\-]+/g, "_")}`;

  const upload = await admin.storage.from("documentos").upload(storagePath, baixado.buffer, { contentType: baixado.mimeType });
  if (upload.error) {
    await admin.from("mensagens").insert({ ...base, text: "Documento recebido pelo WhatsApp (falha ao salvar)", type: "text" });
    return;
  }

  const { data: documento } = await admin
    .from("documentos")
    .insert({
      cliente_ref: cliente.id,
      file_name: nomeArquivo,
      storage_path: storagePath,
      mime: baixado.mimeType,
      size_bytes: baixado.buffer.byteLength,
      uploaded_by: "whatsapp",
    })
    .select("file_name")
    .single();

  await admin.from("mensagens").insert({
    ...base,
    text: `Documento recebido: ${documento?.file_name || nomeArquivo}`,
    type: "document",
    doc_name: documento?.file_name || nomeArquivo,
  });
}

async function processarStatus(admin: NonNullable<ReturnType<typeof adminClient>>, status: WhatsAppStatus) {
  await admin.from("mensagens").update({ wa_status: status.status }).eq("wa_message_id", status.id);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("invalid_signature", { status: 401 });
  }

  const admin = adminClient();
  if (!admin) return new NextResponse("service_role_not_configured", { status: 200 });

  const body = JSON.parse(rawBody) as WhatsAppWebhookBody;
  const value = body.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages || [];
  const statuses = value?.statuses || [];

  for (const msg of messages) {
    const { claimed } = await registrarEvento(admin, msg.id, "mensagem", msg.from);
    if (!claimed) continue;
    try {
      if (ehNumeroAdmin(msg.from)) {
        await processarMensagemAdmin(admin, msg);
      } else {
        await processarMensagem(admin, msg);
      }
      await marcarEvento(admin, msg.id, "processed");
    } catch (e) {
      const err = e as Error;
      await registrarErro(admin, { origem: "whatsapp_webhook", codigo: "mensagem_falhou", mensagem: err.message, rota: "/api/whatsapp/webhook", severidade: "erro", contexto: { messageId: msg.id } });
      await marcarEvento(admin, msg.id, "failed", err.message);
    }
  }

  for (const status of statuses) {
    const eventoId = `status:${status.id}:${status.status}`;
    const { claimed } = await registrarEvento(admin, eventoId, "status", status.id);
    if (!claimed) continue;
    try {
      await processarStatus(admin, status);
      await marcarEvento(admin, eventoId, "processed");
    } catch (e) {
      const err = e as Error;
      await marcarEvento(admin, eventoId, "failed", err.message);
    }
  }

  return new NextResponse("ok", { status: 200 });
}
