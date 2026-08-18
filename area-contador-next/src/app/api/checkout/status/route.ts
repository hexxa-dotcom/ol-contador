import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import * as asaas from "@/lib/asaas";
import { confirmCobranca, gerarAutoLogin } from "@/lib/pagamento";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

// GET /api/checkout/status?cobrancaId=&pollToken= — consultado a cada poucos
// segundos pela tela de pagamento até a cobrança confirmar. O id da cobrança
// é sequencial (adivinhável) — sem exigir de volta o poll_token que só foi
// entregue ao navegador que abriu este checkout, qualquer um poderia
// consultar (e, pior, herdar o login automático de) o pagamento de outra
// pessoa.
export async function GET(request: Request) {
  if (!asaas.isConfigured()) return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("cobrancaId") || "", 10);
  if (!id) return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  const { data: cob } = await admin.from("cobrancas").select("*").eq("id", id).single();
  if (!cob) return NextResponse.json({ error: "cobranca_not_found" }, { status: 404 });

  const pollToken = searchParams.get("pollToken") || "";
  if (!cob.poll_token || pollToken !== cob.poll_token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const resultado = await confirmCobranca(admin, cob);
    if (resultado.status === "paid" && cob.cliente_ref) {
      const autoLogin = await gerarAutoLogin(admin, cob.cliente_ref);
      return NextResponse.json({ ...resultado, autoLogin });
    }
    return NextResponse.json(resultado);
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, {
      origem: "api/checkout/status",
      codigo: "asaas_error",
      mensagem: err.message,
      rota: "/api/checkout/status",
      severidade: "critico",
      contexto: { cobrancaId: id },
    });
    return NextResponse.json({ error: "asaas_error", detail: err.message }, { status: 502 });
  }
}
