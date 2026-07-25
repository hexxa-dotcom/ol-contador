// Camada de notificações externas: e-mail (Resend) e WhatsApp (Twilio).
// Cada canal tem seu próprio guard — envia só o que estiver configurado no .env.
require('dotenv').config();

// ---------- E-MAIL (Resend) ----------
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// Remetente: um domínio verificado no Resend. 'onboarding@resend.dev' funciona
// em teste, mas só entrega para o e-mail dono da conta Resend.
const RESEND_FROM = process.env.RESEND_FROM || 'Olá Contador <onboarding@resend.dev>';

function emailConfigured() { return !!RESEND_API_KEY; }

async function sendEmail(to, subject, html) {
  if (!emailConfigured() || !to) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[email] erro:', data && (data.message || JSON.stringify(data)));
    return { ok: false, error: data };
  }
  return { ok: true, id: data.id };
}

// ---------- WHATSAPP (Twilio) ----------
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
// Número/sandbox do WhatsApp no Twilio, ex.: 'whatsapp:+14155238886'
const TWILIO_WA_FROM = process.env.TWILIO_WHATSAPP_FROM || '';

function whatsappConfigured() { return !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_WA_FROM); }

async function sendWhatsApp(toPhone, body) {
  if (!whatsappConfigured() || !toPhone) return { skipped: true };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const form = new URLSearchParams({
    From: TWILIO_WA_FROM,
    To: `whatsapp:${toPhone}`,
    Body: body
  });
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[whatsapp] erro:', data && (data.message || JSON.stringify(data)));
    return { ok: false, error: data };
  }
  return { ok: true, sid: data.sid };
}

// ---------- ORQUESTRADOR ----------
// Notifica um cliente pelos canais disponíveis. Nunca lança — só registra.
async function notifyCliente(cliente, subject, message) {
  if (!cliente) return;
  const results = {};
  try {
    if (emailConfigured() && cliente.email) {
      const html = `<div style="font-family:sans-serif;font-size:14px;color:#111">
        <p>Olá ${cliente.name || ''},</p>
        <p>${message}</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Olá, Contador — atendimento contábil</p>
      </div>`;
      results.email = await sendEmail(cliente.email, subject, html);
    }
    if (whatsappConfigured() && cliente.phone) {
      results.whatsapp = await sendWhatsApp(cliente.phone, `*${subject}*\n\n${message}`);
    }
  } catch (e) {
    console.error('[notify] falha:', e.message);
  }
  return results;
}

function anyConfigured() { return emailConfigured() || whatsappConfigured(); }

module.exports = {
  emailConfigured,
  whatsappConfigured,
  anyConfigured,
  sendEmail,
  sendWhatsApp,
  notifyCliente
};
