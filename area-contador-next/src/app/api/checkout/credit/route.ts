import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/checkout/credit?codigo= — valida um código de crédito de
// atendimento (gerado pelo contador) antes de aplicá-lo no checkout público.
export async function GET(request: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const codigo = (searchParams.get("codigo") || "").trim().toUpperCase();
  if (!codigo) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  const { data: credito } = await admin.from("creditos").select("*").eq("codigo", codigo).maybeSingle();
  if (!credito) return NextResponse.json({ error: "credito_not_found" }, { status: 404 });
  if (credito.status !== "ativo") return NextResponse.json({ error: "credito_indisponivel", status: credito.status }, { status: 410 });
  if (credito.expira_em && new Date(credito.expira_em) <= new Date()) {
    return NextResponse.json({ error: "credito_expirado", status: "expirado" }, { status: 410 });
  }
  return NextResponse.json({ valido: true, valorCents: credito.valor_cents, valor: credito.valor_cents / 100 });
}
