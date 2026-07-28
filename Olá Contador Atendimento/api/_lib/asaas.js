// Integração com o Asaas (gateway de pagamento brasileiro).
// Ambiente controlado por .env: ASAAS_API_KEY + ASAAS_BASE_URL.
// Sandbox: https://api-sandbox.asaas.com/v3  (padrão)
// Produção: https://api.asaas.com/v3
require('dotenv').config();

const BASE_URL = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';
const API_KEY = process.env.ASAAS_API_KEY || '';

function isConfigured() {
  return !!API_KEY;
}

async function asaasFetch(pathname, options = {}) {
  if (!isConfigured()) {
    const err = new Error('asaas_not_configured');
    err.code = 'asaas_not_configured';
    throw err;
  }
  const res = await fetch(BASE_URL + pathname, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': API_KEY,
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body && body.errors && body.errors[0] && body.errors[0].description) || res.statusText;
    const err = new Error(`asaas_error: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Cria (ou reaproveita) um cliente no Asaas. Retorna o id do customer.
// Endereço é opcional aqui, mas é o dado do TOMADOR na nota fiscal de serviço —
// sem ele, municípios que exigem endereço completo recusam a emissão.
async function createCustomer({ name, cpfCnpj, email, postalCode, address, addressNumber, complement, province }) {
  const payload = { name };
  if (cpfCnpj) payload.cpfCnpj = String(cpfCnpj).replace(/\D/g, '');
  if (email) payload.email = email;
  if (postalCode) payload.postalCode = String(postalCode).replace(/\D/g, '');
  if (address) payload.address = address;
  if (addressNumber) payload.addressNumber = addressNumber;
  if (complement) payload.complement = complement;
  if (province) payload.province = province;
  const data = await asaasFetch('/customers', { method: 'POST', body: JSON.stringify(payload) });
  return data.id;
}

// Cria uma cobrança Pix. dueDate no formato YYYY-MM-DD.
async function createPixPayment({ customerId, value, description, dueDate }) {
  const payload = {
    customer: customerId,
    billingType: 'PIX',
    value,                         // em reais (float)
    description: (description || '').slice(0, 500),
    dueDate: dueDate || new Date().toISOString().slice(0, 10)
  };
  return asaasFetch('/payments', { method: 'POST', body: JSON.stringify(payload) });
}

// Busca o QR Code Pix (imagem base64 + copia-e-cola).
async function getPixQrCode(paymentId) {
  return asaasFetch(`/payments/${paymentId}/pixQrCode`, { method: 'GET' });
}

// Cobrança no cartão de crédito — SEM formulário de cartão no nosso site: o
// cliente completa em `invoiceUrl`, a página hospedada do próprio Asaas (à
// vista ou parcelado, conforme configurado na conta Asaas). Nosso servidor
// nunca vê número de cartão, CVV ou validade — zero risco/escopo de PCI aqui.
async function createCardPayment({ customerId, value, description, dueDate }) {
  const payload = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value,
    description: (description || '').slice(0, 500),
    dueDate: dueDate || new Date().toISOString().slice(0, 10)
  };
  return asaasFetch('/payments', { method: 'POST', body: JSON.stringify(payload) });
}

// Cria uma assinatura recorrente (cobrança mensal automática — cliente
// recorrente com parcelamento/obrigação mensal). nextDueDate: YYYY-MM-DD.
async function createSubscription({ customerId, value, description, nextDueDate, cycle }) {
  const payload = {
    customer: customerId,
    billingType: 'PIX',
    value,
    description: (description || '').slice(0, 500),
    nextDueDate,
    cycle: cycle || 'MONTHLY'
  };
  return asaasFetch('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
}

// Cancela a assinatura — não apaga o histórico de cobranças já geradas.
async function cancelSubscription(subscriptionId) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

// Consulta o status atual de uma cobrança.
async function getPayment(paymentId) {
  return asaasFetch(`/payments/${paymentId}`, { method: 'GET' });
}

// Status do Asaas que consideramos "pago".
const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

// ---------------------------------------------------------------------------
// Notas fiscais de serviço (NFS-e). Pré-requisito FORA deste código: a conta
// Asaas precisa ter as informações fiscais configuradas (inscrição municipal,
// certificado/credenciais da prefeitura, CNAE) — via painel Asaas ou
// POST /v3/fiscalInfo. Sem isso, toda chamada aqui volta com erro do Asaas
// explicando o que falta configurar lá.
// ---------------------------------------------------------------------------

// Lista os serviços municipais cadastrados na prefeitura da conta — usado pra
// o contador escolher o municipalServiceId certo em vez de digitar um código
// arbitrário (ver Configurações → Integrações → Nota Fiscal).
async function getMunicipalServices() {
  return asaasFetch('/invoices/municipalServices', { method: 'GET' });
}

// Agenda/emite uma nota fiscal de serviço. effectiveDate = hoje emite direto
// (sem passar por "agendada"); no futuro, fica agendada até a data ou até
// autorizarInvoice ser chamado. value/deductions em reais (float).
async function createInvoice({ payment, customerId, serviceDescription, observations, municipalServiceId, municipalServiceCode, municipalServiceName, value, deductions, effectiveDate }) {
  const payload = {
    serviceDescription: (serviceDescription || '').slice(0, 500),
    observations: (observations || '').slice(0, 500),
    effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
    value
  };
  if (payment) payload.payment = payment;
  else if (customerId) payload.customer = customerId;
  if (municipalServiceId) payload.municipalServiceId = municipalServiceId;
  if (municipalServiceCode) payload.municipalServiceCode = municipalServiceCode;
  if (municipalServiceName) payload.municipalServiceName = municipalServiceName;
  if (deductions != null) payload.deductions = deductions;
  return asaasFetch('/invoices', { method: 'POST', body: JSON.stringify(payload) });
}

// Confirma a emissão imediata de uma nota agendada para o futuro (não é
// necessário quando effectiveDate já é hoje).
async function authorizeInvoice(invoiceId) {
  return asaasFetch(`/invoices/${invoiceId}/authorize`, { method: 'POST' });
}

// Consulta o status atual de uma nota (SCHEDULED, SYNCHRONIZED, AUTHORIZED, CANCELLED, ERROR...).
async function getInvoice(invoiceId) {
  return asaasFetch(`/invoices/${invoiceId}`, { method: 'GET' });
}

module.exports = {
  isConfigured,
  createCustomer,
  createPixPayment,
  getPixQrCode,
  createCardPayment,
  getPayment,
  createSubscription,
  cancelSubscription,
  getMunicipalServices,
  createInvoice,
  authorizeInvoice,
  getInvoice,
  PAID_STATUSES,
  BASE_URL
};
