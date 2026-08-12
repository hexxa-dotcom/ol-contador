import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import * as asaas from "@/lib/asaas";
import { validarCpfCnpj } from "@/lib/documento";
import { checarRateLimit } from "@/lib/rateLimit";
import { registrarEventoFunil } from "@/lib/metricas";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

// POST /api/checkout — checkout público do site, sem login. O ID do cliente
// é o próprio CPF/CNPJ (só dígitos), mas o cliente só nasce quando o
// pagamento confirma (dentro de confirmCobranca, em src/lib/pagamento.ts) —
// nunca aqui. Até lá, os dados do formulário ficam guardados na própria
// cobrança (dados_cliente). Isso existe porque antes o cliente era gravado na
// hora: quem gerava o Pix e desistia (ou o Pix expirava) ficava para sempre
// como um cliente "pending" órfão, sem nenhuma cobrança paga atrás dele.
const DESCONTO_PIX = 0.05;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
    sexo?: string;
    cep?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    servicoId?: string;
    date?: string;
    time?: string;
    summary?: string;
    assunto?: string;
    modalidade?: string;
    metodoPagamento?: string;
  } | null;
  if (!body?.name || !body.email || !body.phone || !body.servicoId) return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  const { valido, digitos } = validarCpfCnpj(body.cpfCnpj);
  if (!valido) return NextResponse.json({ error: "cpf_cnpj_invalido" }, { status: 400 });
  if (!asaas.isConfigured()) return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  if (!(await checarRateLimit(admin, request, "signup-checkout"))) {
    return NextResponse.json({ error: "muitas_tentativas", detail: "Tente de novo em alguns minutos." }, { status: 429 });
  }

  const { data: servico } = await admin.from("servicos").select("*").eq("id", body.servicoId).single();
  if (!servico) return NextResponse.json({ error: "servico_not_found" }, { status: 404 });

  const cartao = body.metodoPagamento === "cartao";
  const modo = body.modalidade === "sem_agendamento" ? "sem_agendamento" : "agendado";
  const canal = "email";
  if (modo === "agendado" && (!body.date || !body.time)) return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  const precoCents = cartao ? servico.price_cents : Math.round(servico.price_cents * (1 - DESCONTO_PIX));

  try {
    const clientId = digitos;
    // Endereço vai pro cadastro do customer no Asaas — é o dado do TOMADOR
    // exigido pela prefeitura na hora de emitir a nota fiscal de serviço.
    const customerId = await asaas.createCustomer({
      name: body.name,
      cpfCnpj: digitos,
      email: body.email,
      postalCode: body.cep,
      address: body.endereco,
      addressNumber: body.numero,
      province: body.bairro,
    });
    const descricao = `${servico.name} — ${body.name}${cartao ? "" : " (5% Pix)"}`;
    const dadosCliente = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      sexo: body.sexo || null,
      cep: body.cep || null,
      endereco: body.endereco || null,
      numero: body.numero || null,
      bairro: body.bairro || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      assunto: body.assunto || null,
      summary: body.summary || null,
      modalidade: modo,
      canal_resultado: canal,
    };
    // Segredo opaco que só este navegador recebe — sem ele, /api/checkout/status
    // seria adivinhável (id sequencial) e daria pra consultar, ou herdar o
    // login automático de, o pagamento de outra pessoa.
    const pollToken = crypto.randomUUID();

    if (cartao) {
      // Sem formulário de cartão aqui: o cliente completa em `invoiceUrl`, a
      // página segura do próprio Asaas — nosso servidor nunca vê o cartão.
      const payment = await asaas.createCardPayment({ customerId, value: precoCents / 100, description: descricao });
      const { data: cob, error } = await admin
        .from("cobrancas")
        .insert({
          cliente_ref: clientId,
          servico_id: body.servicoId,
          asaas_customer_id: customerId,
          asaas_payment_id: payment.id,
          valor_cents: precoCents,
          valor_original_cents: servico.price_cents,
          desconto_cents: servico.price_cents - precoCents,
          desconto_tipo: null,
          origem: "checkout_publico",
          status: "pending",
          billing_type: "CREDIT_CARD",
          invoice_url: payment.invoiceUrl,
          appt_date: modo === "agendado" ? body.date : null,
          appt_time: modo === "agendado" ? body.time : null,
          dados_cliente: dadosCliente as never,
          poll_token: pollToken,
          modalidade: modo,
          canal_resultado: canal,
        })
        .select()
        .single();
      if (error) throw error;
      await registrarEventoFunil(admin, "cobranca_criada", { cobrancaId: cob.id, clienteRef: clientId, servicoId: body.servicoId, origem: "checkout_publico", metadata: { metodo: "cartao" } });
      return NextResponse.json({
        clientId,
        cobrancaId: cob.id,
        pollToken,
        servico: { id: servico.id, name: servico.name },
        valor: precoCents / 100,
        metodoPagamento: "cartao",
        invoiceUrl: payment.invoiceUrl,
        status: "pending",
      });
    }

    const payment = await asaas.createPixPayment({ customerId, value: precoCents / 100, description: descricao });
    const qr = await asaas.getPixQrCode(payment.id);
    const { data: cob, error } = await admin
      .from("cobrancas")
      .insert({
        cliente_ref: clientId,
        servico_id: body.servicoId,
        asaas_customer_id: customerId,
        asaas_payment_id: payment.id,
        valor_cents: precoCents,
        valor_original_cents: servico.price_cents,
        desconto_cents: servico.price_cents - precoCents,
        desconto_tipo: "pix_5",
        origem: "checkout_publico",
        status: "pending",
        billing_type: "PIX",
        pix_payload: qr.payload,
        pix_image: qr.encodedImage,
        invoice_url: payment.invoiceUrl,
        appt_date: modo === "agendado" ? body.date : null,
        appt_time: modo === "agendado" ? body.time : null,
        dados_cliente: dadosCliente as never,
        poll_token: pollToken,
        modalidade: modo,
        canal_resultado: canal,
      })
      .select()
      .single();
    if (error) throw error;
    await registrarEventoFunil(admin, "cobranca_criada", { cobrancaId: cob.id, clienteRef: clientId, servicoId: body.servicoId, origem: "checkout_publico", metadata: { metodo: "pix" } });

    return NextResponse.json({
      clientId,
      cobrancaId: cob.id,
      pollToken,
      servico: { id: servico.id, name: servico.name },
      valor: precoCents / 100,
      valorOriginal: servico.price_cents / 100,
      metodoPagamento: "pix",
      pixPayload: qr.payload,
      pixImage: qr.encodedImage,
      invoiceUrl: payment.invoiceUrl,
      status: "pending",
    });
  } catch (e) {
    const err = e as { code?: string; message: string };
    if (err.code === "asaas_not_configured") return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });
    await registrarErro(admin, {
      origem: "signup_checkout",
      codigo: err.code || "checkout_error",
      mensagem: err.message,
      rota: "/api/checkout",
      severidade: "critico",
      contexto: { servicoId: body?.servicoId, modalidade: modo, metodoPagamento: body?.metodoPagamento },
    });
    return NextResponse.json({ error: "asaas_error", detail: err.message }, { status: 502 });
  }
}
