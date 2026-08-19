import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { CHAVES_EDITAVEIS, clearSystemSecret, listSystemSecretsStatus, setSystemSecret } from "@/lib/systemSecrets";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "service_unavailable" }, { status: 503 }) };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: staff } = await supabase.from("staff").select("id,role").eq("id", userId).maybeSingle();
  if (!staff || staff.role !== "admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const admin = adminClient();
  if (!admin) return { error: NextResponse.json({ error: "service_role_not_configured" }, { status: 503 }) };
  return { admin, userId };
}

// GET — nunca devolve o valor da chave, só de onde ela está vindo (banco/
// ambiente/nenhuma) e quando foi trocada pela última vez. Mesma filosofia
// da Vercel pra variável "Sensitive": grava, mas não relê.
export async function GET() {
  const ctx = await exigirAdmin();
  if (ctx.error) return ctx.error;
  const status = await listSystemSecretsStatus(ctx.admin);
  return NextResponse.json({ chaves: CHAVES_EDITAVEIS, status }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const ctx = await exigirAdmin();
  if (ctx.error) return ctx.error;

  const body = (await request.json().catch(() => null)) as { chave?: string; valor?: string; acao?: "salvar" | "limpar" } | null;
  const chave = body?.chave?.trim();
  if (!chave || !CHAVES_EDITAVEIS.some((item) => item.chave === chave)) {
    return NextResponse.json({ error: "chave_invalida" }, { status: 400 });
  }

  try {
    if (body?.acao === "limpar") {
      await clearSystemSecret(ctx.admin, chave);
      return NextResponse.json({ ok: true });
    }
    const valor = (body?.valor || "").trim();
    if (!valor) return NextResponse.json({ error: "valor_vazio" }, { status: 400 });
    await setSystemSecret(ctx.admin, chave, valor, ctx.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    await registrarErro(ctx.admin, {
      origem: "system_secrets_route",
      codigo: err.message === "vault_key_not_configured" ? "vault_key_not_configured" : "system_secret_save_failed",
      mensagem: err.message,
      rota: "/api/system-secrets",
      severidade: "erro",
      contexto: { chave },
    });
    return NextResponse.json({ error: "system_secret_save_failed", detail: err.message }, { status: 502 });
  }
}
