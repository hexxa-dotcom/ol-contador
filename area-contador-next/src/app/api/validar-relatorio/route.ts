import { NextResponse } from "next/server";
import { validarRelatorioPublico } from "@/lib/reportValidation";

export const runtime = "nodejs";

// Endpoint público (sem autenticação) por trás do QR/link de validação
// impresso nos relatórios — consultado também pela própria página
// /validar-relatorio, mas exposto separadamente para verificação
// programática (o mesmo papel do endpoint ?acao=validar-relatorio do legado).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = (searchParams.get("codigo") || "").trim();
  const result = await validarRelatorioPublico(codigo);
  const status = result.valido ? 200 : result.error === "codigo_invalido" ? 400 : result.error === "service_unavailable" ? 503 : 404;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store, private, max-age=0" } });
}
