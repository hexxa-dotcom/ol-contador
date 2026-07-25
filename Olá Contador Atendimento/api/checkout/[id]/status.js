// GET /api/checkout/:id/status — polling do cliente; confirma pagamento se pago.
const asaas = require('../../_lib/asaas');
const { requireUser, adminClient } = require('../../_lib/auth');
const { confirmCobranca } = require('../../_lib/pagamento');

module.exports = async (req, res) => {
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const id = parseInt(req.query.id, 10);
  const { data: cob } = await admin.from('cobrancas').select('*').eq('id', id).single();
  if (!cob) return res.status(404).json({ error: 'cobranca_not_found' });

  try {
    res.json(await confirmCobranca(admin, cob));
  } catch (e) {
    console.error('status error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
