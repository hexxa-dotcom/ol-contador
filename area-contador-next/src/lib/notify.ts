// Camada de notificações externas: e-mail (Resend) e WhatsApp (Meta Cloud API).
// Cada canal tem seu próprio guard — envia só o que estiver configurado no .env.
import { whatsappConfigured as waConfigured, templateConfigured as waTemplateConfigured, sendWhatsAppTemplate } from "./whatsapp";

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

function whatsappConfigured() {
  return waConfigured();
}
function whatsappOutboundConfigured() {
  return waTemplateConfigured();
}

async function sendWhatsApp(toPhone: string, body: string, options: { subject?: string } = {}) {
  if (!whatsappOutboundConfigured() || !toPhone) return { skipped: true };
  const result = await sendWhatsAppTemplate(toPhone, { subject: options.subject, body });
  if ("skipped" in result) return result;
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sid: result.messageId };
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
