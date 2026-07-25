// POST /api/checkout { clientId, servicoId, date, time } — gera cobrança Pix.
// (Dormant até configurar ASAAS_API_KEY + SUPABASE_SERVICE_ROLE_KEY.)
const asaas = require('./_lib/asaas');
const { requireUser, adminClient } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const { clientId, servicoId, date, time } = req.body || {};
  if (!clientId || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  // valida que o solicitante pode ver este cliente (RLS via auth.sb)
  const { data: cliente } = await auth.sb.from('clientes').select('*').eq('id', clientId).single();
  if (!cliente) return res.status(403).json({ error: 'forbidden' });
  const { data: servico } = await admin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });

  try {
    const customerId = await asaas.createCustomer({ name: cliente.name, cpfCnpj: cliente.cpf });
    const payment = await asaas.createPixPayment({
      customerId, value: servico.price_cents / 100,
      description: `${servico.name} — ${cliente.name}`, dueDate: new Date().toISOString().slice(0, 10)
    });
    const qr = await asaas.getPixQrCode(payment.id);

    const { data: cob, error } = await admin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
      asaas_payment_id: payment.id, valor_cents: servico.price_cents, status: 'pending',
      pix_payload: qr.payload, pix_image: qr.encodedImage, invoice_url: payment.invoiceUrl,
      appt_date: date || null, appt_time: time || null
    }).select().single();
    if (error) throw error;

    res.json({ cobrancaId: cob.id, servico: { id: servico.id, name: servico.name },
      valor: servico.price_cents / 100, pixPayload: qr.payload, pixImage: qr.encodedImage,
      invoiceUrl: payment.invoiceUrl, status: 'pending' });
  } catch (e) {
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    console.error('checkout error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
