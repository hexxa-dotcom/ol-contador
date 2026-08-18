import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { sincronizarCobrancaAsaas } from "@/lib/pagamento";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

// Porte 1:1 de api/asaas/webhook.js do legado. Continua DESLIGADO em
// produção até o corte final (decisão registrada na doc de migração): o
// Asaas real ainda aponta pro backend antigo. Este endpoint existe pronto
// para quando essa troca for decidida, mas ninguém aponta o Asaas pra cá
// automaticamente — é um passo manual no painel do Asaas.
//
// Sem auth de usuário: é o gateway que chama. Responde 200 sempre (evita
// reenvio) exceto quando falha o próprio registro do evento.
export async function POST(request: Request) {
  // O Asaas manda de volta, em todo webhook, o mesmo token configurado no
  // painel dele (Integrações → Webhooks → Token de autenticação) no header
  // "asaas-access-token". A reconsulta em sincronizarCobrancaAsaas ainda
  // confirma o pagamento de verdade antes de aplicar qualquer mudança — isso
  // aqui é uma segunda barreira que não custa nada ter.
  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  if (!secret && process.env.VERCEL_ENV === "production") {
    return new NextResponse("webhook_not_configured", { status: 503 });
  }
  if (secret && request.headers.get("asaas-access-token") !== secret) {
    return new NextResponse("invalid_token", { status: 401 });
  }

  const admin = adminClient();
  if (!admin) return new NextResponse("service_role_not_configured", { status: 200 });

  const event = (await request.json().catch(() => null)) as { id?: string; event?: string; payment?: { id?: string; status?: string } } | null;
  const paymentId = event?.payment?.id;
  if (!paymentId) return new NextResponse("ignored", { status: 200 });

  const eventId = String(event?.id || `${event?.event || "payment"}:${paymentId}:${event?.payment?.status || ""}`);
  const { error: claimError } = await admin.from("webhook_eventos").insert({
    provedor: "asaas",
    evento_id: eventId,
    tipo: event?.event || null,
    recurso_id: paymentId,
    status: "processing",
  });
  if (claimError?.code === "23505") return new NextResponse("duplicate", { status: 200 });
  if (claimError) return new NextResponse("webhook_claim_failed", { status: 503 });

  const { data: cob } = await admin.from("cobrancas").select("*").eq("asaas_payment_id", paymentId).single();
  if (!cob) {
    await admin.from("webhook_eventos").update({ status: "ignored", processado_em: new Date().toISOString() }).eq("provedor", "asaas").eq("evento_id", eventId);
    return new NextResponse("ignored", { status: 200 });
  }

  try {
    await sincronizarCobrancaAsaas(admin, cob);
    await admin.from("webhook_eventos").update({ status: "processed", processado_em: new Date().toISOString() }).eq("provedor", "asaas").eq("evento_id", eventId);
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, { origem: "asaas_webhook", codigo: "webhook_error", mensagem: err.message, rota: "/api/asaas/webhook", severidade: "critico", contexto: { evento: event?.event || null, paymentId } });
    await admin.from("webhook_eventos").update({ status: "failed", erro: String(err.message || err), processado_em: new Date().toISOString() }).eq("provedor", "asaas").eq("evento_id", eventId);
    return new NextResponse("processing_failed", { status: 503 });
  }
  return new NextResponse("ok", { status: 200 });
}
