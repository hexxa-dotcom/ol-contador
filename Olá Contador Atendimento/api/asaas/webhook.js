// POST /api/asaas/webhook — confirmação de pagamento vinda do Asaas (produção).
// Sem auth de usuário: é o gateway que chama. Responde 200 sempre (evita reenvio).
const { adminClient } = require('../_lib/auth');
const { confirmCobranca } = require('../_lib/pagamento');

module.exports = async (req, res) => {
  // O Asaas manda de volta, em todo webhook, o mesmo token configurado no
  // painel dele (Integrações → Webhooks → Token de autenticação) no header
  // "asaas-access-token". Sem conferir isso, qualquer um na internet pode
  // forjar esse POST — o confirmCobranca ainda reconsulta o pagamento
  // de verdade antes de confirmar, mas é uma segunda barreira que não custa
  // nada ter.
  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  if (secret && req.headers['asaas-access-token'] !== secret) {
    return res.status(401).send('invalid_token');
  }

  const admin = adminClient();
  if (!admin) return res.status(200).send('service_role_not_configured');

  const event = req.body || {};
  const paymentId = event.payment && event.payment.id;
  if (!paymentId) return res.status(200).send('ignored');

  const { data: cob } = await admin.from('cobrancas').select('*').eq('asaas_payment_id', paymentId).single();
  if (cob) { try { await confirmCobranca(admin, cob); } catch (e) { console.error('webhook error:', e.message); } }
  res.status(200).send('ok');
};
