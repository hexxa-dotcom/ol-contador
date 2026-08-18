import { NextResponse } from "next/server";
import * as asaas from "@/lib/asaas";
import { adminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

// Catálogo de serviços municipais da própria prefeitura configurada na conta
// Asaas — não é dado de cliente, por isso o legado (api/status.js) nunca
// exigiu auth aqui. Mantemos o mesmo comportamento na porta nativa.
export async function GET() {
  if (!asaas.isConfigured()) return NextResponse.json({ error: "asaas_not_configured" }, { status: 503 });
  try {
    const data = await asaas.getMunicipalServices();
    return NextResponse.json(data.data || data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const err = e as { message: string };
    await registrarErro(adminClient(), {
      origem: "api/integrations/municipal-services",
      codigo: "asaas_error",
      mensagem: err.message,
      rota: "/api/integrations/municipal-services",
    });
    return NextResponse.json({ error: "asaas_error", detail: err.message }, { status: 502 });
  }
}
