// POST /api/asaas/webhook — confirmação de pagamento vinda do Asaas (produção).
// Sem auth de usuário: é o gateway que chama. Responde 200 sempre (evita reenvio).
const { adminClient } = require('../_lib/auth');
const { sincronizarCobrancaAsaas } = require('../_lib/pagamento');
const { registrarErro } = require('../_lib/monitoramento');

module.exports = async (req, res) => {
  // O Asaas manda de volta, em todo webhook, o mesmo token configurado no
  // painel dele (Integrações → Webhooks → Token de autenticação) no header
  // "asaas-access-token". Sem conferir isso, qualquer um na internet pode
  // forjar esse POST — o confirmCobranca ainda reconsulta o pagamento
  // de verdade antes de confirmar, mas é uma segunda barreira que não custa
  // nada ter.
  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  if (!secret && process.env.VERCEL_ENV === 'production') {
    console.error('webhook Asaas recusado: ASAAS_WEBHOOK_SECRET ausente');
    return res.status(503).send('webhook_not_configured');
  }
  if (secret && req.headers['asaas-access-token'] !== secret) {
    return res.status(401).send('invalid_token');
  }

  const admin = adminClient();
  if (!admin) return res.status(200).send('service_role_not_configured');

  const event = req.body || {};
  const paymentId = event.payment && event.payment.id;
  if (!paymentId) return res.status(200).send('ignored');

  const eventId = String(event.id || `${event.event || 'payment'}:${paymentId}:${event.payment.status || ''}`);
  const { error: claimError } = await admin.from('webhook_eventos').insert({
    provedor: 'asaas', evento_id: eventId, tipo: event.event || null,
    recurso_id: paymentId, status: 'processing'
  });
  if (claimError && claimError.code === '23505') return res.status(200).send('duplicate');
  if (claimError) return res.status(503).send('webhook_claim_failed');

  const { data: cob } = await admin.from('cobrancas').select('*').eq('asaas_payment_id', paymentId).single();
  if (!cob) {
    await admin.from('webhook_eventos').update({ status: 'ignored', processado_em: new Date().toISOString() })
      .eq('provedor', 'asaas').eq('evento_id', eventId);
    return res.status(200).send('ignored');
  }
  try {
    await sincronizarCobrancaAsaas(admin, cob);
    await admin.from('webhook_eventos').update({ status: 'processed', processado_em: new Date().toISOString() })
      .eq('provedor', 'asaas').eq('evento_id', eventId);
  } catch (e) {
    console.error('webhook error:', e.message);
    await registrarErro(admin, { origem: 'asaas_webhook', codigo: e.code || 'webhook_error', mensagem: e.message,
      rota: '/api/asaas/webhook', severidade: 'critico', contexto: { evento: event.event || null, paymentId } });
    await admin.from('webhook_eventos').update({ status: 'failed', erro: String(e.message || e), processado_em: new Date().toISOString() })
      .eq('provedor', 'asaas').eq('evento_id', eventId);
    return res.status(503).send('processing_failed');
  }
  res.status(200).send('ok');
};
