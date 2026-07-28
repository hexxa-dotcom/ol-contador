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

  // Confere que quem está logado pode ver o cliente dono desta cobrança (RLS
  // via auth.sb) — sem isso, qualquer cliente autenticado conseguia ler (e
  // forçar a confirmação de) a cobrança de qualquer outra pessoa só trocando
  // o :id na URL.
  const { data: cliente } = await auth.sb.from('clientes').select('id').eq('id', cob.cliente_ref).maybeSingle();
  if (!cliente) return res.status(403).json({ error: 'forbidden' });

  try {
    res.json(await confirmCobranca(admin, cob));
  } catch (e) {
    console.error('status error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
