import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSerproConfigured, testarAutenticacao } from "@/lib/serpro";
import { registrarErro } from "@/lib/observability";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Testa a autenticação OAuth2+mTLS de verdade com o SERPRO, com as
// credenciais que já estão configuradas na Vercel (mesmo caminho que
// chamarIntegraContador usa) — só assim dá pra saber se o certificado e as
// chaves batem, já que a Vercel nunca deixa reler o valor bruto delas.
export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id,role").eq("id", userId).maybeSingle();
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!isSerproConfigured()) {
    // Nunca expõe o valor — só diz quais variáveis estão de fato vazias no
    // ambiente de execução, pra diagnosticar sem vazar segredo nenhum.
    const presentes = {
      SERPRO_CONSUMER_KEY: !!process.env.SERPRO_CONSUMER_KEY,
      SERPRO_CONSUMER_SECRET: !!process.env.SERPRO_CONSUMER_SECRET,
      SERPRO_CERT_PEM_BASE64: !!process.env.SERPRO_CERT_PEM_BASE64,
      SERPRO_KEY_PEM_BASE64: !!process.env.SERPRO_KEY_PEM_BASE64,
      SERPRO_TEMP_ACCESS_TOKEN: !!process.env.SERPRO_TEMP_ACCESS_TOKEN,
      SERPRO_TEMP_JWT_TOKEN: !!process.env.SERPRO_TEMP_JWT_TOKEN,
    };
    const faltando = Object.entries(presentes)
      .filter(([, ok]) => !ok)
      .map(([nome]) => nome);
    return NextResponse.json({ ok: false, detail: `Faltam variáveis do SERPRO: ${faltando.join(", ")}.` });
  }

  try {
    const ok = await testarAutenticacao();
    return NextResponse.json({ ok });
  } catch (e) {
    const err = e as Error;
    const admin = adminClient();
    if (admin) {
      await registrarErro(admin, {
        origem: "serpro_testar_route",
        codigo: "serpro_auth_failed",
        mensagem: err.message,
        rota: "/api/serpro/testar",
        severidade: "erro",
      });
    }
    return NextResponse.json({ ok: false, detail: err.message });
  }
}
