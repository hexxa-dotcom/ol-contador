// POST /api/asaas/webhook — confirmação de pagamento vinda do Asaas (produção).
// Sem auth de usuário: é o gateway que chama. Responde 200 sempre (evita reenvio).
const { adminClient } = require('../_lib/auth');
const { confirmCobranca } = require('../_lib/pagamento');

module.exports = async (req, res) => {
  const admin = adminClient();
  if (!admin) return res.status(200).send('service_role_not_configured');

  const event = req.body || {};
  const paymentId = event.payment && event.payment.id;
  if (!paymentId) return res.status(200).send('ignored');

  const { data: cob } = await admin.from('cobrancas').select('*').eq('asaas_payment_id', paymentId).single();
  if (cob) { try { await confirmCobranca(admin, cob); } catch (e) { console.error('webhook error:', e.message); } }
  res.status(200).send('ok');
};
