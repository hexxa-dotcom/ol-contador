import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as asaas from "@/lib/asaas";
import { registrarErro } from "@/lib/observability";
import { registrarEventoFunil } from "@/lib/metricas";

export const runtime = "nodejs";
export const maxDuration = 60;

// Catálogo fixo de autoatendimento — mesmo valor do legado (api/recorrencia.js).
// Cliente comum só pode ativar um `tipo` daqui; preço nunca vem do body pra
// quem não é staff (senão dava pra ativar por R$0,01 trocando o valor).
const PRECOS_AUTOATENDIMENTO_CENTS: Record<string, number> = { "Radar Fiscal": 2990 };

function proximoVencimento(dia: number): string {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();
  if (hoje.getDate() >= dia) {
    mes += 1;
    if (mes > 11) {
      mes = 0;
      ano += 1;
    }
  }
  const data = new Date(ano, mes, dia);
  return data.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    clientId?: string;
    ativar?: boolean;
    tipo?: string;
    diaVenc?: number;
    valor?: number;
  } | null;
  if (!body?.clientId || typeof body.ativar !== "boolean") {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  // Posse via RLS do usuário — staff enxerga qualquer cliente, cliente comum
  // só o próprio (mesmo padrão de finance/charge).
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", body.clientId).single();
  if (!cliente) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: souStaff } = await admin.from("staff").select("id").eq("id", userId).maybeSingle();

  try {
    if (!body.ativar) {
      if (cliente.asaas_subscription_id) await asaas.cancelSubscription(cliente.asaas_subscription_id);
      await admin
        .from("clientes")
        .update({ recorrente: false, asaas_subscription_id: null })
        .eq("id", body.clientId);
      await admin.from("assinaturas_historico").insert({
        cliente_ref: body.clientId,
        tipo: cliente.recorrente_tipo,
        valor_cents: 0,
        status: "cancelada",
        created_by: userId,
      });
      return NextResponse.json({ recorrente: false });
    }

    if (cliente.recorrente && cliente.asaas_subscription_id) {
      return NextResponse.json({ recorrente: true, subscriptionId: cliente.asaas_subscription_id, alreadyActive: true });
    }

    if (!asaas.isConfigured()) return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });

    let valorNum: number;
    if (souStaff) {
      valorNum = Number(body.valor) || cliente.honorarios || 0;
      if (valorNum <= 0) return NextResponse.json({ error: "invalid_recurrence" }, { status: 400 });
    } else {
      const precoCatalogo = PRECOS_AUTOATENDIMENTO_CENTS[String(body.tipo || "")];
      if (!precoCatalogo) return NextResponse.json({ error: "tipo_nao_permitido_para_cliente" }, { status: 403 });
      valorNum = precoCatalogo / 100;
    }
    const diaVenc = Math.min(28, Math.max(1, Math.round(Number(body.diaVenc)) || 10));

    const customerId = await asaas.createCustomer({
      name: cliente.name,
      cpfCnpj: cliente.cpf || cliente.id,
      email: cliente.email || undefined,
      postalCode: cliente.cep || undefined,
      address: cliente.endereco || undefined,
      addressNumber: cliente.numero || undefined,
      province: cliente.bairro || undefined,
    });
    const nextDueDate = proximoVencimento(diaVenc);
    const subscription = await asaas.createSubscription({
      customerId,
      value: valorNum,
      description: `${body.tipo || "Assinatura"} — ${cliente.name}`,
      nextDueDate,
    });

    await admin
      .from("clientes")
      .update({
        recorrente: true,
        recorrente_tipo: String(body.tipo || "").trim().slice(0, 120),
        recorrente_dia_venc: diaVenc,
        asaas_subscription_id: subscription.id,
        honorarios: Math.round(valorNum),
      })
      .eq("id", body.clientId);
    await admin.from("assinaturas_historico").insert({
      cliente_ref: body.clientId,
      tipo: String(body.tipo || "").trim().slice(0, 120),
      valor_cents: Math.round(valorNum * 100),
      dia_vencimento: diaVenc,
      asaas_subscription_id: subscription.id,
      status: "ativa",
      created_by: userId,
    });
    await registrarEventoFunil(admin, "assinatura_ativada", {
      clienteRef: body.clientId,
      origem: souStaff ? "painel_contador" : "area_cliente",
      metadata: { valorCents: Math.round(valorNum * 100), tipo: body.tipo },
    });

    return NextResponse.json({ recorrente: true, subscriptionId: subscription.id });
  } catch (e) {
    const err = e as { code?: string; name?: string; message: string };
    if (err.code === "asaas_not_configured") return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return NextResponse.json({ error: "operation_timeout" }, { status: 502 });
    }
    await registrarErro(admin, {
      origem: "finance_recurrence_route",
      codigo: err.code || "asaas_error",
      mensagem: err.message,
      rota: "/api/finance/recurrence",
      severidade: "critico",
      contexto: { clientId: body.clientId },
    });
    return NextResponse.json({ error: "asaas_error", detail: err.message }, { status: 502 });
  }
}
