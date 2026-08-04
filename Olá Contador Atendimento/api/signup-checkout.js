// POST /api/signup-checkout — checkout público do site de agendamento, sem
// login. O ID do cliente é o próprio CPF/CNPJ (só dígitos), mas o cliente só
// nasce quando o pagamento confirma (dentro de confirmCobranca, em
// _lib/pagamento.js) — nunca aqui. Até lá, os dados do formulário ficam
// guardados na própria cobrança (dados_cliente). Isso existe porque antes o
// cliente era gravado na hora: quem gerava o Pix e desistia (ou o Pix
// expirava) ficava para sempre como um cliente "pending" órfão, sem nenhuma
// cobrança paga atrás dele.
// body: { name, cpfCnpj, email, phone, sexo, cep, endereco, numero, bairro, cidade, estado, servicoId, date, time, summary, assunto, modalidade, metodoPagamento }
const crypto = require('crypto');
const asaas = require('./_lib/asaas');
const { adminClient } = require('./_lib/auth');
const { validarCpfCnpj } = require('../documento');
const { checarRateLimit } = require('./_lib/rateLimit');

// Pix sai mais barato pro cliente (e pra gente: sem taxa de parcelamento do
// cartão) — mesmo desconto usado em toda a base.
const DESCONTO_PIX = 0.05;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { name, cpfCnpj, email, phone, sexo, cep, endereco, numero, bairro, cidade, estado, servicoId, date, time, summary, assunto, modalidade, metodoPagamento } = req.body || {};
  if (!name || !email || !phone || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  const { valido, digitos } = validarCpfCnpj(cpfCnpj);
  if (!valido) return res.status(400).json({ error: 'cpf_cnpj_invalido' });
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const admin = adminClient();
  if (admin && !(await checarRateLimit(admin, req, 'signup-checkout'))) {
    return res.status(429).json({ error: 'muitas_tentativas', detail: 'Tente de novo em alguns minutos.' });
  }
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const { data: servico } = await admin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });

  const cartao = metodoPagamento === 'cartao';
  const modo = modalidade === 'sem_agendamento' ? 'sem_agendamento' : 'agendado';
  const canal = 'email';
  if (modo === 'agendado' && (!date || !time)) return res.status(400).json({ error: 'invalid_params' });
  const precoCents = cartao ? servico.price_cents : Math.round(servico.price_cents * (1 - DESCONTO_PIX));

  try {
    const clientId = digitos;
    // Endereço vai pro cadastro do customer no Asaas — é o dado do TOMADOR
    // exigido pela prefeitura na hora de emitir a nota fiscal de serviço.
    const customerId = await asaas.createCustomer({
      name, cpfCnpj: digitos, email,
      postalCode: cep, address: endereco, addressNumber: numero, province: bairro
    });
    const descricao = `${servico.name} — ${name}${cartao ? '' : ' (5% Pix)'}`;
    const dadosCliente = {
      name, email, phone, sexo: sexo || null,
      cep: cep || null, endereco: endereco || null, numero: numero || null, bairro: bairro || null,
      cidade: cidade || null, estado: estado || null, assunto: assunto || null, summary: summary || null,
      modalidade: modo, canal_resultado: canal
    };
    // Segredo opaco que só este navegador recebe — sem ele, /api/status?cobrancaId=
    // seria adivinhável (id sequencial) e daria pra consultar, ou herdar o login
    // automático de, o pagamento de outra pessoa (ver checkout-login-automatico.sql).
    const pollToken = crypto.randomUUID();

    if (cartao) {
      // Sem formulário de cartão aqui: o cliente completa em `invoiceUrl`, a
      // página segura do próprio Asaas (à vista ou parcelado, conforme
      // habilitado na conta) — nosso servidor nunca vê o número do cartão.
      const payment = await asaas.createCardPayment({ customerId, value: precoCents / 100, description: descricao });
      const { data: cob, error } = await admin.from('cobrancas').insert({
        cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
        asaas_payment_id: payment.id, valor_cents: precoCents, status: 'pending',
        billing_type: 'CREDIT_CARD', invoice_url: payment.invoiceUrl,
        appt_date: modo === 'agendado' ? date : null, appt_time: modo === 'agendado' ? time : null,
        dados_cliente: dadosCliente, poll_token: pollToken, modalidade: modo, canal_resultado: canal
      }).select().single();
      if (error) throw error;
      return res.json({
        clientId, cobrancaId: cob.id, pollToken, servico: { id: servico.id, name: servico.name },
        valor: precoCents / 100, metodoPagamento: 'cartao', invoiceUrl: payment.invoiceUrl, status: 'pending'
      });
    }

    const payment = await asaas.createPixPayment({ customerId, value: precoCents / 100, description: descricao });
    const qr = await asaas.getPixQrCode(payment.id);
    const { data: cob, error } = await admin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
      asaas_payment_id: payment.id, valor_cents: precoCents, status: 'pending',
      billing_type: 'PIX', pix_payload: qr.payload, pix_image: qr.encodedImage, invoice_url: payment.invoiceUrl,
      appt_date: modo === 'agendado' ? date : null, appt_time: modo === 'agendado' ? time : null,
      dados_cliente: dadosCliente, poll_token: pollToken, modalidade: modo, canal_resultado: canal
    }).select().single();
    if (error) throw error;

    res.json({
      clientId, cobrancaId: cob.id, pollToken, servico: { id: servico.id, name: servico.name },
      valor: precoCents / 100, valorOriginal: servico.price_cents / 100, metodoPagamento: 'pix',
      pixPayload: qr.payload, pixImage: qr.encodedImage, invoiceUrl: payment.invoiceUrl, status: 'pending'
    });
  } catch (e) {
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    console.error('signup-checkout error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
