// POST /api/checkout { clientId, servicoId, date, time, metodoPagamento } —
// gera cobrança (Pix ou cartão) pra um cliente JÁ logado (compra de um novo
// serviço de dentro da área do cliente). (Dormant até configurar
// ASAAS_API_KEY + SUPABASE_SERVICE_ROLE_KEY.)
const asaas = require('./_lib/asaas');
const { requireUser, adminClient } = require('./_lib/auth');

// 10% de desconto pra quem já teve pelo menos uma cobrança paga antes —
// incentivo pra quem precisar de um novo serviço voltar por aqui em vez de
// procurar outro contador. Vale pros dois métodos de pagamento.
const DESCONTO_RECORRENTE = 0.10;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const { clientId, servicoId, date, time, metodoPagamento } = req.body || {};
  if (!clientId || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  // valida que o solicitante pode ver este cliente (RLS via auth.sb)
  const { data: cliente } = await auth.sb.from('clientes').select('*').eq('id', clientId).single();
  if (!cliente) return res.status(403).json({ error: 'forbidden' });
  const { data: servico } = await admin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });

  const cartao = metodoPagamento === 'cartao';

  try {
    const { data: pagas } = await admin.from('cobrancas').select('id')
      .eq('cliente_ref', clientId).eq('status', 'paid').limit(1);
    const desconto = !!(pagas && pagas.length);
    const precoCents = desconto
      ? Math.round(servico.price_cents * (1 - DESCONTO_RECORRENTE))
      : servico.price_cents;

    const customerId = await asaas.createCustomer({ name: cliente.name, cpfCnpj: cliente.cpf, email: cliente.email });
    const descricao = `${servico.name} — ${cliente.name}${desconto ? ' (10% cliente recorrente)' : ''}`;

    if (cartao) {
      // Sem formulário de cartão aqui: o cliente completa em `invoiceUrl`, a
      // página segura do próprio Asaas (à vista ou parcelado) — mesmo
      // caminho do checkout público (signup-checkout), nosso servidor nunca
      // vê o número do cartão.
      const payment = await asaas.createCardPayment({
        customerId, value: precoCents / 100, description: descricao,
        dueDate: new Date().toISOString().slice(0, 10)
      });
      const { data: cob, error } = await admin.from('cobrancas').insert({
        cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
        asaas_payment_id: payment.id, valor_cents: precoCents, status: 'pending',
        billing_type: 'CREDIT_CARD', invoice_url: payment.invoiceUrl,
        appt_date: date || null, appt_time: time || null
      }).select().single();
      if (error) throw error;

      return res.json({ cobrancaId: cob.id, servico: { id: servico.id, name: servico.name },
        valor: precoCents / 100, valorOriginal: servico.price_cents / 100, desconto,
        metodoPagamento: 'cartao', invoiceUrl: payment.invoiceUrl, status: 'pending' });
    }

    const payment = await asaas.createPixPayment({
      customerId, value: precoCents / 100, description: descricao,
      dueDate: new Date().toISOString().slice(0, 10)
    });
    const qr = await asaas.getPixQrCode(payment.id);

    const { data: cob, error } = await admin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
      asaas_payment_id: payment.id, valor_cents: precoCents, status: 'pending',
      billing_type: 'PIX', pix_payload: qr.payload, pix_image: qr.encodedImage, invoice_url: payment.invoiceUrl,
      appt_date: date || null, appt_time: time || null
    }).select().single();
    if (error) throw error;

    res.json({ cobrancaId: cob.id, servico: { id: servico.id, name: servico.name },
      valor: precoCents / 100, valorOriginal: servico.price_cents / 100, desconto,
      metodoPagamento: 'pix', pixPayload: qr.payload, pixImage: qr.encodedImage,
      invoiceUrl: payment.invoiceUrl, status: 'pending' });
  } catch (e) {
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    console.error('checkout error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
