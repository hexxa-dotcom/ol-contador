// POST /api/signup-checkout — checkout público do site de agendamento, sem
// login (é aqui que a conta nasce). O ID do cliente é o próprio CPF/CNPJ (só
// dígitos). A conta de acesso (auth) só é criada quando o pagamento confirma,
// dentro de confirmCobranca — nunca aqui, pra não sobrar conta órfã de quem
// preencheu o formulário e não pagou.
// body: { name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary }
const asaas = require('./_lib/asaas');
const { adminClient } = require('./_lib/auth');
const { validarCpfCnpj } = require('../documento');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary } = req.body || {};
  if (!name || !email || !phone || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  const { valido, digitos } = validarCpfCnpj(cpfCnpj);
  if (!valido) return res.status(400).json({ error: 'cpf_cnpj_invalido' });
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const { data: servico } = await admin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });

  try {
    const clientId = digitos;
    const { data: existente } = await admin.from('clientes').select('id').eq('id', clientId).maybeSingle();
    if (!existente) {
      const { error: erroInsert } = await admin.from('clientes').insert({
        id: clientId, name, cpf: digitos, email, phone,
        sexo: sexo || null, cidade: cidade || null, estado: estado || null,
        tax_type: servico.name, honorarios: Math.round(servico.price_cents / 100),
        status: 'pending'
      });
      if (erroInsert) throw erroInsert;
    } else {
      await admin.from('clientes').update({ email, phone, sexo: sexo || null, cidade: cidade || null, estado: estado || null }).eq('id', clientId);
    }
    if (summary) {
      await admin.from('triagens').insert({
        cliente_ref: clientId, assunto: servico.name, descricao: summary, status: 'enviada', enviada_at: new Date().toISOString()
      });
    }

    const customerId = await asaas.createCustomer({ name, cpfCnpj: digitos });
    const payment = await asaas.createPixPayment({
      customerId, value: servico.price_cents / 100,
      description: `${servico.name} — ${name}`, dueDate: new Date().toISOString().slice(0, 10)
    });
    const qr = await asaas.getPixQrCode(payment.id);

    const { data: cob, error } = await admin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
      asaas_payment_id: payment.id, valor_cents: servico.price_cents, status: 'pending',
      pix_payload: qr.payload, pix_image: qr.encodedImage, invoice_url: payment.invoiceUrl,
      appt_date: date || null, appt_time: time || null
    }).select().single();
    if (error) throw error;

    res.json({
      clientId, cobrancaId: cob.id, servico: { id: servico.id, name: servico.name },
      valor: servico.price_cents / 100, pixPayload: qr.payload, pixImage: qr.encodedImage,
      invoiceUrl: payment.invoiceUrl, status: 'pending'
    });
  } catch (e) {
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    console.error('signup-checkout error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
