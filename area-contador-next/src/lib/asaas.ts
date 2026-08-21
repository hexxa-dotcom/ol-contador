// Cliente HTTP do Asaas — porte 1:1 de api/_lib/asaas.js do backend legado.
const BASE_URL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";
const API_KEY = process.env.ASAAS_API_KEY || "";

export function isConfigured(): boolean {
  return !!API_KEY;
}

class AsaasError extends Error {
  code?: string;
  status?: number;
  body?: unknown;
}

async function asaasFetch(pathname: string, options: RequestInit = {}) {
  if (!isConfigured()) {
    const err = new AsaasError("asaas_not_configured");
    err.code = "asaas_not_configured";
    throw err;
  }
  const res = await fetch(BASE_URL + pathname, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: API_KEY,
      ...(options.headers as Record<string, string> | undefined),
    },
    // Evita segurar a function além do maxDuration da rota — o legado não
    // tinha timeout aqui porque quem impunha limite era o proxy do Next.js
    // por fora; chamando o Asaas direto agora, o limite precisa vir daqui.
    signal: options.signal || AbortSignal.timeout(35000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.errors?.[0]?.description || res.statusText;
    const err = new AsaasError(`asaas_error: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export async function createCustomer({
  name,
  cpfCnpj,
  email,
  postalCode,
  address,
  addressNumber,
  complement,
  province,
}: {
  name: string;
  cpfCnpj: string;
  email?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
}): Promise<string> {
  const data = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name,
      cpfCnpj: String(cpfCnpj).replace(/\D/g, ""),
      email,
      postalCode: postalCode ? String(postalCode).replace(/\D/g, "") : undefined,
      address,
      addressNumber,
      complement,
      province,
    }),
  });
  return data.id;
}

export async function createPixPayment({
  customerId,
  value,
  description,
  dueDate,
}: {
  customerId: string;
  value: number;
  description?: string;
  dueDate?: string;
}) {
  return asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value,
      description: description ? String(description).slice(0, 500) : undefined,
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
    }),
  });
}

export async function getPixQrCode(paymentId: string) {
  return asaasFetch(`/payments/${paymentId}/pixQrCode`);
}

export async function createCardPayment({
  customerId,
  value,
  description,
  dueDate,
}: {
  customerId: string;
  value: number;
  description?: string;
  dueDate?: string;
}) {
  return asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "CREDIT_CARD",
      value,
      description: description ? String(description).slice(0, 500) : undefined,
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
    }),
  });
}

// Checkout transparente: cobrança de cartão criada e autorizada na hora,
// sem invoiceUrl/redirecionamento — o formulário de cartão fica na nossa
// própria página. Só chamar isto com o toggle "Checkout transparente de
// cartão" ligado em Configurações (a Asaas precisa liberar a função pra
// conta antes; sem isso a API responde com erro). NUNCA logar/persistir o
// objeto `creditCard` — ele carrega número, validade e CVV em texto puro.
export async function createDirectCardPayment({
  customerId,
  value,
  description,
  dueDate,
  remoteIp,
  creditCard,
  creditCardHolderInfo,
  installmentCount,
}: {
  customerId: string;
  value: number;
  description?: string;
  dueDate?: string;
  remoteIp: string;
  creditCard: { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
  creditCardHolderInfo: { name: string; email: string; cpfCnpj: string; postalCode: string; addressNumber: string; phone?: string; addressComplement?: string; mobilePhone?: string };
  installmentCount?: number;
}) {
  return asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "CREDIT_CARD",
      value,
      description: description ? String(description).slice(0, 500) : undefined,
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
      remoteIp,
      creditCard,
      creditCardHolderInfo,
      ...(installmentCount && installmentCount > 1 ? { installmentCount, totalValue: value } : {}),
    }),
  });
}

export async function createSubscription({
  customerId,
  value,
  description,
  nextDueDate,
  cycle,
}: {
  customerId: string;
  value: number;
  description?: string;
  nextDueDate: string;
  cycle?: string;
}) {
  // Assinaturas recorrentes sempre via Pix — mesma limitação do legado.
  return asaasFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value,
      description,
      nextDueDate,
      cycle: cycle || "MONTHLY",
    }),
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

export async function getPayment(paymentId: string) {
  return asaasFetch(`/payments/${paymentId}`);
}

export async function getMunicipalServices() {
  return asaasFetch("/invoices/municipalServices");
}

export async function createInvoice(payload: {
  payment?: string;
  customerId?: string;
  serviceDescription?: string;
  observations?: string;
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName?: string;
  value: number;
  deductions?: number;
  effectiveDate?: string;
}) {
  const { customerId, ...rest } = payload;
  return asaasFetch("/invoices", {
    method: "POST",
    body: JSON.stringify({ ...rest, customer: payload.payment ? undefined : customerId }),
  });
}

export async function authorizeInvoice(invoiceId: string) {
  return asaasFetch(`/invoices/${invoiceId}/authorize`, { method: "POST" });
}

export async function getInvoice(invoiceId: string) {
  return asaasFetch(`/invoices/${invoiceId}`);
}
