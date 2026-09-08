import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as asaas from "@/lib/asaas";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

type AsaasPayment = { id: string; dueDate: string; status: string; invoiceUrl: string };

// GET do link de pagamento (invoiceUrl) da cobrança em aberto de uma
// assinatura recorrente — pro contador copiar e mandar pro cliente.
// A recorrência em si é criada por /api/finance/recurrence; este
// endpoint só consulta o que a Asaas já gerou automaticamente pra ela.
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { clientId?: string } | null;
  if (!body?.clientId) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const { data: souStaff } = await admin.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!souStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: cliente } = await supabase.from("clientes").select("asaas_subscription_id").eq("id", body.clientId).maybeSingle();
  if (!cliente?.asaas_subscription_id) return NextResponse.json({ error: "sem_recorrencia_ativa" }, { status: 404 });

  if (!asaas.isConfigured()) return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });

  try {
    const result = (await asaas.getSubscriptionPayments(cliente.asaas_subscription_id)) as { data?: AsaasPayment[] };
    const pagamentos = result.data || [];
    const emAberto = pagamentos
      .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const escolhido = emAberto || pagamentos.sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
    if (!escolhido) return NextResponse.json({ error: "sem_cobranca_pendente" }, { status: 404 });
    return NextResponse.json({ invoiceUrl: escolhido.invoiceUrl, dueDate: escolhido.dueDate, status: escolhido.status });
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, {
      origem: "finance_recurrence_link_route",
      codigo: "asaas_error",
      mensagem: err.message,
      rota: "/api/finance/recurrence-link",
      severidade: "erro",
      contexto: { clientId: body.clientId },
    });
    return NextResponse.json({ error: "asaas_error" }, { status: 502 });
  }
}
