// Camada de notificações externas: e-mail (Resend) e WhatsApp (Meta Cloud API).
// Cada canal tem seu próprio guard — envia só o que estiver configurado no .env.
import {
  whatsappConfigured as waConfigured,
  templateConfigured as waTemplateConfigured,
  adminTemplateConfigured as waAdminTemplateConfigured,
  digestTemplateConfigured as waDigestTemplateConfigured,
  sendWhatsAppTemplate,
  sendWhatsAppAdminTemplate,
  sendWhatsAppDigestTemplate,
} from "./whatsapp";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Olá, Contador <contato@olacontador.com.br>";

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

// Layout único reaproveitado por todo e-mail transacional — extraído do que
// era uma string HTML só dentro de notifyCliente, pra poder ser usado
// também no e-mail de senha/primeiro acesso (ver EMAIL_PRIMEIRO_ACESSO_HTML
// mais abaixo, colado manualmente no Supabase Auth porque aquele e-mail é
// disparado pelo próprio Supabase, fora do código deste app).
function buildEmailHtml(params: { greeting: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta = params.ctaLabel && params.ctaUrl
    ? `<div style="margin-top:26px;padding-top:18px;border-top:1px solid #EFECE6;text-align:center;">
        <a href="${params.ctaUrl}" style="display:inline-block;background:#093726;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;padding:11px 24px;border-radius:6px;">${params.ctaLabel}</a>
      </div>`
    : "";
  return `<div style="background-color:#F7F5EF;padding:32px 16px;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:540px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #E8E5DD;">
      <div style="background:#093726;padding:22px 28px;text-align:left;">
        <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">Olá<span style="color:#FF6A45;">,</span> Contador</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:3px;">Seu contador pessoal a um clique de distância.</div>
      </div>
      <div style="padding:28px;color:#1B2520;font-size:14.5px;line-height:1.6;">
        <p style="margin-top:0;font-size:15.5px;font-weight:700;color:#093726;">${params.greeting}</p>
        <div>${params.bodyHtml}</div>
        ${cta}
      </div>
      <div style="background:#F2EFE9;padding:18px 28px;text-align:center;font-size:11px;color:#758079;line-height:1.7;">
        Este é um e-mail automático do <strong>Olá, Contador</strong>.<br>
        Acesse <a href="https://www.olacontador.com.br" style="color:#093726;text-decoration:none;font-weight:600;">www.olacontador.com.br</a> para acompanhar seus atendimentos.
        <div style="margin-top:10px;">
          <a href="https://instagram.com/olacontador" style="color:#093726;text-decoration:none;font-weight:600;">@olacontador no Instagram</a>
          &nbsp;·&nbsp;
          <a href="mailto:ola@olacontador.com.br" style="color:#093726;text-decoration:none;font-weight:600;">ola@olacontador.com.br</a>
        </div>
      </div>
    </div>
  </div>`;
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

const ADMIN_WHATSAPP_PHONE = process.env.WHATSAPP_ADMIN_PHONE || "";

function adminWhatsappConfigured() {
  return waAdminTemplateConfigured() && !!ADMIN_WHATSAPP_PHONE;
}

// Aviso interno pro contador (não pro cliente) de que entrou uma solicitação
// nova — usa um template dedicado (nome, serviço, valor, botão pro painel),
// separado do genérico usado nas notificações pro cliente. Enquanto não há
// número de produção próprio, vai pro WhatsApp pessoal do contador,
// cadastrado como destinatário de teste.
async function notifyAdminNovaSolicitacao(params: { cliente: string; servico: string; valorCents: number }) {
  if (!adminWhatsappConfigured()) return { skipped: true };
  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((params.valorCents || 0) / 100);
  const result = await sendWhatsAppAdminTemplate(ADMIN_WHATSAPP_PHONE, { cliente: params.cliente, servico: params.servico, valor });
  if ("skipped" in result) return result;
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sid: result.messageId };
}

function digestWhatsappConfigured() {
  return waDigestTemplateConfigured() && !!ADMIN_WHATSAPP_PHONE;
}

// Resumo diário pro contador — agenda do dia + Atendimento Express pendente,
// disparado uma vez por dia pelo cron (src/app/api/cron/whatsapp-digest).
async function notifyAdminResumoDiario(texto: string) {
  if (!digestWhatsappConfigured()) return { skipped: true };
  const result = await sendWhatsAppDigestTemplate(ADMIN_WHATSAPP_PHONE, texto);
  if ("skipped" in result) return result;
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sid: result.messageId };
}

type ClienteNotify = { name?: string | null; email?: string | null; phone?: string | null; canal_resultado?: string | null };

// Dispara em todos os canais disponíveis do cliente (e-mail + WhatsApp), não é
// mais um "ou" por canal preferido — a notificação chega por onde o cliente
// puder ser alcançado.
async function notifyCliente(cliente: ClienteNotify | null, subject: string, message: string, _options: { channel?: string } = {}) {
  if (!cliente) return {};
  const results: Record<string, unknown> = {};
  try {
    if (emailConfigured() && cliente.email) {
      const html = buildEmailHtml({
        greeting: `Olá, ${cliente.name || "Cliente"}!`,
        bodyHtml: message,
        ctaLabel: "Acessar a Plataforma",
        ctaUrl: "https://www.olacontador.com.br",
      });
      results.email = await sendEmail(cliente.email, subject, html);
    }
    if (whatsappOutboundConfigured() && cliente.phone) {
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

export {
  emailConfigured,
  whatsappConfigured,
  whatsappOutboundConfigured,
  anyConfigured,
  sendEmail,
  sendWhatsApp,
  notifyCliente,
  notifyAdminNovaSolicitacao,
  notifyAdminResumoDiario,
};
