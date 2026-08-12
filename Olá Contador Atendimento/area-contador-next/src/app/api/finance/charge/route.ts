import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as asaas from "@/lib/asaas";
import { registrarErro } from "@/lib/observability";
import { registrarEventoFunil } from "@/lib/metricas";

export const runtime = "nodejs";
export const maxDuration = 45;

// Cliente comprando um novo serviço avulso — contador criando em nome de um
// cliente (qualquer um) OU o próprio cliente logado (só o que é seu, decidido
// por RLS abaixo, nunca pelo papel do chamador). Porte de api/checkout.js.
const DESCONTO_RECORRENTE = 0.1;

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    clientId?: string;
    servicoId?: string;
    date?: string;
    time?: string;
    modalidade?: string;
    metodoPagamento?: string;
  } | null;
  if (!body?.clientId || !body.servicoId || !["pix", "cartao"].includes(body.metodoPagamento || "")) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  const modalidade = body.modalidade === "agendado" ? "agendado" : "sem_agendamento";
  if (modalidade === "agendado" && (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "") || !/^\d{2}:\d{2}$/.test(body.time || ""))) {
    return NextResponse.json({ error: "invalid_schedule" }, { status: 400 });
  }
  if (!asaas.isConfigured()) return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  // Posse: RLS do próprio usuário decide se ele pode ver esse clientId (staff
  // vê qualquer um; cliente comum só o próprio). Nunca confiamos no papel do
  // chamador diretamente, só no que o banco deixa ler.
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", body.clientId).single();
  if (!cliente) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: servico } = await admin.from("servicos").select("*").eq("id", body.servicoId).single();
  if (!servico) return NextResponse.json({ error: "servico_not_found" }, { status: 404 });

  const cartao = body.metodoPagamento === "cartao";
  const { data: pagas } = await admin
    .from("cobrancas")
    .select("id")
    .eq("cliente_ref", body.clientId)
    .eq("status", "paid")
    .limit(1);
  const desconto = !!(pagas && pagas.length);
  const precoCents = desconto ? Math.round(servico.price_cents * (1 - DESCONTO_RECORRENTE)) : servico.price_cents;

  try {
    const customerId = await asaas.createCustomer({
      name: cliente.name,
      cpfCnpj: cliente.cpf || cliente.id,
      email: cliente.email || undefined,
      postalCode: cliente.cep || undefined,
      address: cliente.endereco || undefined,
      addressNumber: cliente.numero || undefined,
      province: cliente.bairro || undefined,
    });
    const descricao = `${servico.name} — ${cliente.name}${desconto ? " (10% cliente recorrente)" : ""}`;

    const payment = cartao
      ? await asaas.createCardPayment({ customerId, value: precoCents / 100, description: descricao })
      : await asaas.createPixPayment({ customerId, value: precoCents / 100, description: descricao });
    const qr = cartao ? null : await asaas.getPixQrCode(payment.id);

    const { data: cob, error } = await admin
      .from("cobrancas")
      .insert({
        cliente_ref: body.clientId,
        servico_id: body.servicoId,
        asaas_customer_id: customerId,
        asaas_payment_id: payment.id,
        valor_cents: precoCents,
        valor_original_cents: servico.price_cents,
        desconto_cents: servico.price_cents - precoCents,
        desconto_tipo: desconto ? "cliente_recorrente_10" : null,
        origem: "area_cliente",
        status: "pending",
        billing_type: cartao ? "CREDIT_CARD" : "PIX",
        pix_payload: qr?.payload,
        pix_image: qr?.encodedImage,
        invoice_url: payment.invoiceUrl,
        appt_date: modalidade === "agendado" ? body.date : null,
        appt_time: modalidade === "agendado" ? body.time : null,
        modalidade,
        canal_resultado: "email",
      })
      .select()
      .single();
    if (error) throw error;

    await registrarEventoFunil(admin, "cobranca_criada", {
      cobrancaId: cob.id,
      clienteRef: body.clientId,
      servicoId: body.servicoId,
      origem: "area_contador_next",
      metadata: { metodo: cartao ? "cartao" : "pix" },
    });

    return NextResponse.json({
      clientId: body.clientId,
      cobrancaId: cob.id,
      servico: { id: servico.id, name: servico.name },
      valor: precoCents / 100,
      valorOriginal: servico.price_cents / 100,
      desconto,
      metodoPagamento: cartao ? "cartao" : "pix",
      pixPayload: qr?.payload,
      pixImage: qr?.encodedImage,
      invoiceUrl: payment.invoiceUrl,
      status: "pending",
    });
  } catch (e) {
    const err = e as { code?: string; name?: string; message: string };
    if (err.code === "asaas_not_configured") return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return NextResponse.json({ error: "asaas_timeout" }, { status: 502 });
    }
    await registrarErro(admin, {
      origem: "finance_charge_route",
      codigo: err.code || "asaas_error",
      mensagem: err.message,
      rota: "/api/finance/charge",
      severidade: "critico",
      contexto: { clientId: body.clientId, servicoId: body.servicoId },
    });
    return NextResponse.json({ error: "asaas_error", detail: err.message }, { status: 502 });
  }
}
