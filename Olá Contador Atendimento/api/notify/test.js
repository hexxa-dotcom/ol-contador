// POST /api/notify/test { clientId } — envia um aviso de teste ao cliente.
// (Dormant até configurar RESEND_API_KEY e/ou TWILIO_* no ambiente.)
const notify = require('../_lib/notify');
const { requireUser, fetchClient } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!notify.anyConfigured()) return res.status(503).json({ error: 'notify_not_configured' });

  const { clientId } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'invalid_params' });
  const cliente = await fetchClient(auth.sb, clientId);
  if (!cliente) return res.status(404).json({ error: 'client_not_found' });

  const results = await notify.notifyCliente(cliente, 'Teste — Olá, Contador',
    'Este é um aviso de teste do sistema Olá, Contador. Se você recebeu, os avisos estão funcionando!');
  res.json({ to: { email: cliente.email, phone: cliente.phone }, results });
};
