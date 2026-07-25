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
async function createCustomer({ name, cpfCnpj, email }) {
  const payload = { name };
  if (cpfCnpj) payload.cpfCnpj = String(cpfCnpj).replace(/\D/g, '');
  if (email) payload.email = email;
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

module.exports = {
  isConfigured,
  createCustomer,
  createPixPayment,
  getPixQrCode,
  getPayment,
  createSubscription,
  cancelSubscription,
  PAID_STATUSES,
  BASE_URL
};
