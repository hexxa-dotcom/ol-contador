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

// ---------- WHATSAPP (Meta Cloud API - Integração Nativa) ----------
const META_WA_TOKEN = process.env.META_WA_TOKEN || '';
const META_WA_PHONE_ID = process.env.META_WA_PHONE_ID || ''; // ID do telefone remetente

function whatsappConfigured() { return !!(META_WA_TOKEN && META_WA_PHONE_ID); }

async function sendWhatsApp(toPhone, body) {
  if (!whatsappConfigured() || !toPhone) return { skipped: true };
  
  // Limpa o número de telefone (apenas números)
  const cleanPhone = toPhone.replace(/\D/g, '');
  
  const url = `https://graph.facebook.com/v19.0/${META_WA_PHONE_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "text",
    text: { preview_url: false, body: body }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[whatsapp meta] erro:', data && (data.error ? data.error.message : JSON.stringify(data)));
    return { ok: false, error: data };
  }
  return { ok: true, messageId: data.messages ? data.messages[0].id : null };
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
