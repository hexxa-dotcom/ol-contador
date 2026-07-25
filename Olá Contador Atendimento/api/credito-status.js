// GET /api/credito-status?codigo=OC-XXXXXXXX — validação pública do código de
// crédito (tela de agendamento, sem login).
const { adminClient } = require('./_lib/auth');

module.exports = async (req, res) => {
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const codigo = String(req.query.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: 'invalid_params' });

  const { data: credito } = await admin.from('creditos').select('*').eq('codigo', codigo).maybeSingle();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(410).json({ error: 'credito_indisponivel', status: credito.status });
  res.json({ valido: true, valorCents: credito.valor_cents, valor: credito.valor_cents / 100 });
};
