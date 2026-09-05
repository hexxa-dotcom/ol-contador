import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { trocarCodePorTokenDeLongaDuracao, salvarContaInstagram } from "@/lib/instagram";

export const runtime = "nodejs";

// Callback do OAuth do Instagram Login — roda uma vez, quando o contador
// conecta a conta @olacontador em Configurações. Troca o código pelo token de
// longa duração e guarda (criptografado) na tabela configuracoes.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.headers.get("cookie")?.match(/ig_oauth_state=([^;]+)/)?.[1];
  const erroDaMeta = url.searchParams.get("error_description") || url.searchParams.get("error");

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL("/painel#configuracoes", request.url));
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.redirect(new URL("/login", request.url));

  if (erroDaMeta || !code || !state || state !== stateCookie) {
    const destino = new URL("/painel#configuracoes", request.url);
    destino.searchParams.set("instagram_erro", erroDaMeta || "conexao_falhou");
    return NextResponse.redirect(destino);
  }

  const redirectUri = new URL("/api/instagram/callback", request.url).toString();
  const resultado = await trocarCodePorTokenDeLongaDuracao(code, redirectUri);

  const destino = new URL("/painel#configuracoes", request.url);
  if (!resultado) {
    destino.searchParams.set("instagram_erro", "troca_de_token_falhou");
    return NextResponse.redirect(destino);
  }

  const admin = adminClient();
  if (!admin) {
    destino.searchParams.set("instagram_erro", "service_unavailable");
    return NextResponse.redirect(destino);
  }

  await salvarContaInstagram(admin, { userId: resultado.userId, username: null, accessToken: resultado.accessToken, expiraEm: resultado.expiraEm });

  destino.searchParams.set("instagram_conectado", "1");
  const response = NextResponse.redirect(destino);
  response.cookies.delete("ig_oauth_state");
  return response;
}
