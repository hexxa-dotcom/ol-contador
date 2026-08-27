// Assistente de IA do contador, acessível também pelo WhatsApp (número
// pessoal em WHATSAPP_ADMIN_PHONE) — responde perguntas sobre a base inteira
// do sistema: clientes, agenda do dia, Atendimento Express pendente.
import type { SupabaseClient } from "@supabase/supabase-js";
import * as ia from "@/lib/ia";

type Admin = SupabaseClient;

async function montarContextoSistema(admin: Admin): Promise<string> {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const [{ data: clientes }, { data: agendamentos }, { data: express }] = await Promise.all([
    admin
      .from("clientes")
      .select("id,name,tax_type,status,diagnosis,honorarios,phone,email,atendimento_modalidade")
      .is("arquivado_em", null)
      .order("created_at", { ascending: false })
      .limit(300),
    admin.from("agendamentos").select("date,time,tax_type,cliente_ref,status").eq("date", hoje),
    admin.from("atendimentos_express").select("id,status,cliente_ref").not("status", "in", "(concluido,cancelado)"),
  ]);

  const nomePorId = new Map((clientes || []).map((c) => [c.id, c.name]));

  const linhasClientes =
    (clientes || [])
      .map(
        (c) =>
          `${c.name} | fiscal: ${c.tax_type || "-"} | status: ${c.status} | honorários: R$${c.honorarios ?? 0} | tel: ${c.phone || "-"} | modalidade: ${c.atendimento_modalidade || "-"}${c.diagnosis ? ` | diagnóstico: ${c.diagnosis}` : ""}`
      )
      .join("\n") || "Nenhum cliente cadastrado.";

  const linhasAgenda =
    (agendamentos || []).map((a) => `${a.time} - ${(a.cliente_ref && nomePorId.get(a.cliente_ref)) || "Cliente"} (${a.tax_type || "atendimento"}) - status: ${a.status}`).join("\n") ||
    "Nenhum agendamento hoje.";

  const linhasExpress = (express || []).map((e) => `${(e.cliente_ref && nomePorId.get(e.cliente_ref)) || "Cliente"}: ${e.status}`).join("\n") || "Nenhum Express pendente.";

  return [`Data de hoje: ${hoje}`, `\nClientes ativos (${(clientes || []).length}):\n${linhasClientes}`, `\nAgenda de hoje:\n${linhasAgenda}`, `\nAtendimento Express pendente:\n${linhasExpress}`].join(
    "\n"
  );
}

export async function responderPerguntaAdmin(admin: Admin, pergunta: string): Promise<string> {
  const contexto = await montarContextoSistema(admin);
  return ia.responderAssistenteAdmin(admin, pergunta, contexto);
}
