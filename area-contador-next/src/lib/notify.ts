// Camada de notificações externas: e-mail (Resend) e WhatsApp (Twilio).
// Cada canal tem seu próprio guard — envia só o que estiver configurado no .env.
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Olá Contador <onboarding@resend.dev>";

function emailConfigured() {
  return !!RESEND_API_KEY;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!emailConfigured() || !to) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[email] erro:", (data as { message?: string })?.message || JSON.stringify(data));
    return { ok: false, error: data };
  }
  return { ok: true, id: (data as { id?: string }).id };
}

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WA_FROM = process.env.TWILIO_WHATSAPP_FROM || "";
const TWILIO_WA_CONTENT_SID = process.env.TWILIO_WHATSAPP_CONTENT_SID || "";

function whatsappConfigured() {
  return !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_WA_FROM);
}
function whatsappOutboundConfigured() {
  return whatsappConfigured() && !!TWILIO_WA_CONTENT_SID;
}

async function sendWhatsApp(toPhone: string, body: string, options: { contentSid?: string; variables?: Record<string, string>; subject?: string } = {}) {
  if (!whatsappConfigured() || !toPhone) return { skipped: true };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const form = new URLSearchParams({ From: TWILIO_WA_FROM, To: `whatsapp:${toPhone}` });
  const contentSid = options.contentSid || TWILIO_WA_CONTENT_SID;
  if (contentSid) {
    form.set("ContentSid", contentSid);
    form.set("ContentVariables", JSON.stringify(options.variables || { "1": options.subject || "Olá, Contador", "2": body }));
  } else {
    form.set("Body", body);
  }
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[whatsapp] erro:", (data as { message?: string })?.message || JSON.stringify(data));
    return { ok: false, error: data };
  }
  return { ok: true, sid: (data as { sid?: string }).sid };
}

type ClienteNotify = { name?: string | null; email?: string | null; phone?: string | null; canal_resultado?: string | null };

async function notifyCliente(cliente: ClienteNotify | null, subject: string, message: string, options: { channel?: string } = {}) {
  if (!cliente) return {};
  const results: Record<string, unknown> = {};
  try {
    const channel = options.channel || cliente.canal_resultado || null;
    const fallbackEmail = channel === "whatsapp" && !whatsappOutboundConfigured();
    if ((!channel || channel === "email" || fallbackEmail) && emailConfigured() && cliente.email) {
      const html = `<div style="font-family:sans-serif;font-size:14px;color:#111">
        <p>Olá ${cliente.name || ""},</p>
        <p>${message}</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Olá, Contador — atendimento contábil</p>
      </div>`;
      results.email = await sendEmail(cliente.email, subject, html);
    }
    if ((!channel || channel === "whatsapp") && whatsappOutboundConfigured() && cliente.phone) {
      const texto = String(message || "").replace(/<[^>]+>/g, "");
      results.whatsapp = await sendWhatsApp(cliente.phone, texto, { subject });
    }
  } catch (e) {
    console.error("[notify] falha:", (e as Error).message);
  }
  return results;
}

function anyConfigured() {
  return emailConfigured() || whatsappConfigured();
}

export { emailConfigured, whatsappConfigured, whatsappOutboundConfigured, anyConfigured, sendEmail, sendWhatsApp, notifyCliente };
