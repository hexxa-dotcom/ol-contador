// GET /api/signup-status?cobrancaId=123 — polling público (sem login) da tela
// de pagamento do checkout de agendamento. Só lê o status; confirma via a
// mesma confirmCobranca compartilhada com o webhook.
const asaas = require('./_lib/asaas');
const { adminClient } = require('./_lib/auth');
const { confirmCobranca } = require('./_lib/pagamento');

module.exports = async (req, res) => {
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const id = parseInt(req.query.cobrancaId, 10);
  if (!id) return res.status(400).json({ error: 'invalid_params' });
  const { data: cob } = await admin.from('cobrancas').select('*').eq('id', id).single();
  if (!cob) return res.status(404).json({ error: 'cobranca_not_found' });

  try {
    res.json(await confirmCobranca(admin, cob));
  } catch (e) {
    console.error('signup-status error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
