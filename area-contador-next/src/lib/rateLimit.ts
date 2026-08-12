import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

// Rate limiting simples pra rotas públicas (sem login), usando a própria
// tabela do Supabase como armazenamento. Mesmo padrão do backend legado
// (api/_lib/rateLimit.js) — cada tentativa grava uma linha em rate_limits;
// se já tiver `max` ou mais linhas pra essa chave dentro da janela, bloqueia.
export function ipDe(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "desconhecido";
}

export async function checarRateLimit(
  admin: SupabaseClient<Database>,
  request: Request,
  rota: string,
  max = 8,
  janelaMin = 15
): Promise<boolean> {
  const chave = `${rota}:${ipDe(request)}`;
  const desde = new Date(Date.now() - janelaMin * 60 * 1000).toISOString();

  const { count } = await admin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("chave", chave)
    .gte("criado_em", desde);

  if ((count || 0) >= max) return false;

  await admin.from("rate_limits").insert({ chave });

  // Faxina oportunista (1 em ~50 chamadas): apaga tentativas com mais de 1
  // dia, sem precisar de um cron dedicado só pra isso.
  if (Math.random() < 0.02) {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    admin
      .from("rate_limits")
      .delete()
      .lt("criado_em", umDiaAtras)
      .then(
        () => {},
        () => {}
      );
  }

  return true;
}
