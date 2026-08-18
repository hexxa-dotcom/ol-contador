import { NextResponse } from "next/server";

// O envio de e-mail em si ainda vive no site legado (api/status.js), que já
// resolve isso hoje em produção — proxy em vez de duplicar a lógica de envio.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const mensagem = typeof body?.mensagem === "string" ? body.mensagem.trim() : "";
  if (!nome || !mensagem || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("https://www.olacontador.com.br/api/status?acao=enviar-contato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, mensagem }),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") || "application/json" } });
  } catch {
    return NextResponse.json({ error: "contact_unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
