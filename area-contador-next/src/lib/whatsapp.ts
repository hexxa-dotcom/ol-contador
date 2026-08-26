// Cliente da WhatsApp Cloud API (Meta) — canal oficial, sem libs não-oficiais.
// Cada função tem guard próprio: só envia/verifica o que estiver configurado no .env.
import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR";

function whatsappConfigured() {
  return !!(ACCESS_TOKEN && PHONE_NUMBER_ID);
}

function templateConfigured() {
  return whatsappConfigured() && !!TEMPLATE_NAME;
}

async function graphFetch(path: string, body: unknown) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[whatsapp] erro:", JSON.stringify(data));
    return { ok: false as const, error: data };
  }
  const messageId = (data as { messages?: { id?: string }[] })?.messages?.[0]?.id;
  return { ok: true as const, messageId };
}

// Mensagem livre — só funciona dentro da janela de 24h desde a última mensagem do cliente.
async function sendWhatsAppText(toPhone: string, text: string) {
  if (!whatsappConfigured() || !toPhone) return { skipped: true as const };
  return graphFetch(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "text",
    text: { body: text, preview_url: false },
  });
}

// Envio de áudio livre via WhatsApp (link do arquivo de áudio)
async function sendWhatsAppAudio(toPhone: string, audioUrl: string) {
  if (!whatsappConfigured() || !toPhone) return { skipped: true as const };
  return graphFetch(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "audio",
    audio: { link: audioUrl },
  });
}

// Mensagem via template pré-aprovado — necessária para avisos que o sistema
// inicia (fora da janela de 24h). V1 usa um único template genérico de
// utilidade com 2 variáveis, mesmo formato que já existia pro Twilio.
async function sendWhatsAppTemplate(toPhone: string, params: { subject?: string; body?: string }) {
  if (!templateConfigured() || !toPhone) return { skipped: true as const };
  return graphFetch(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: (params.subject || "Olá, Contador").slice(0, 60) },
            { type: "text", text: (params.body || "").slice(0, 600) },
          ],
        },
      ],
    },
  });
}

// Mídia recebida (documento/imagem/áudio): a Meta manda só um media_id no
// webhook — é preciso buscar a URL temporária e depois baixar o binário.
async function downloadWhatsAppMedia(mediaId: string): Promise<{ ok: true; buffer: Buffer; mimeType: string } | { ok: false }> {
  if (!whatsappConfigured() || !mediaId) return { ok: false };
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!metaRes.ok) return { ok: false };
  const meta = (await metaRes.json().catch(() => ({}))) as { url?: string; mime_type?: string };
  if (!meta.url) return { ok: false };
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (!fileRes.ok) return { ok: false };
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { ok: true, buffer, mimeType: meta.mime_type || "application/octet-stream" };
}

// Meta assina o corpo do webhook com HMAC-SHA256 (header X-Hub-Signature-256).
function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET || !signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export { whatsappConfigured, templateConfigured, sendWhatsAppText, sendWhatsAppAudio, sendWhatsAppTemplate, downloadWhatsAppMedia, verifyWebhookSignature };
