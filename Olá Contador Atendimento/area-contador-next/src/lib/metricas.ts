import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

// Registro best-effort do funil comercial — porte de api/_lib/metricas.js.
// Uma falha de telemetria nunca pode impedir checkout, pagamento ou entrega.
export async function registrarEventoFunil(
  admin: SupabaseClient<Database> | null,
  evento: string,
  dados: {
    sessaoRef?: string;
    clienteRef?: string;
    cobrancaId?: number;
    servicoId?: string;
    origem?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<boolean> {
  if (!admin || !evento) return false;
  const { error } = await admin.from("funil_eventos").insert({
    evento,
    sessao_ref: dados.sessaoRef || null,
    cliente_ref: dados.clienteRef || null,
    cobranca_id: dados.cobrancaId || null,
    servico_id: dados.servicoId || null,
    origem: dados.origem || null,
    metadata: (dados.metadata || {}) as never,
  });
  if (error && error.code !== "23505") {
    console.error("métrica do funil não registrada:", error.message);
    return false;
  }
  return true;
}
