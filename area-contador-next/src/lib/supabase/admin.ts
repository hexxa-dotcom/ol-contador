import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cliente service_role — ignora RLS. Só para rotas de servidor que precisam
// operar fora do que o usuário logado pode ver (equipe, cofre gov.br,
// erros operacionais, SERPRO) ou para criar/editar contas via Auth Admin API.
// Nunca importar isto de um Client Component nem expor a chave com NEXT_PUBLIC_.
export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
