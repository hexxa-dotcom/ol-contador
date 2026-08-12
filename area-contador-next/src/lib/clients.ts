import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export type ClientRecord = Pick<Tables["clientes"]["Row"],
  "id" | "name" | "avatar" | "tax_type" | "cpf" | "status" | "email" |
  "phone" | "recorrente" | "recorrente_tipo" | "created_at" |
  "ultimo_atendimento_finalizado_em" | "atendimento_modalidade" | "notas" |
  "checklist" | "cidade" | "estado" | "sexo" | "diagnosis" | "treatment" |
  "regime_tributario" | "honorarios" | "evidences" | "cep" | "endereco" |
  "numero" | "bairro" | "perfil_operacional" | "recorrente_dia_venc" |
  "canal_resultado" | "asaas_subscription_id"
>;

export type ClientMessage = Pick<Tables["mensagens"]["Row"],
  "id" | "cliente_id" | "sender" | "text" | "type" | "read_at" | "created_at" | "time" | "seq" | "doc_name" | "duration"
>;

export type ClientTriage = Pick<Tables["triagens"]["Row"],
  "id" | "cliente_ref" | "assunto" | "descricao" | "respostas" | "status" | "created_at" | "updated_at"
>;

export type ClientMonthlyGuide = Tables["guias_mensais"]["Row"];

export type ClientDocument = Pick<Tables["documentos"]["Row"],
  "id" | "cliente_ref" | "file_name" | "mime" | "size_bytes" | "uploaded_by" | "created_at" | "checklist_item" | "ai_extracted"
>;

export type ClientHistory = Pick<Tables["atendimentos_historico"]["Row"],
  "id" | "cliente_id" | "cliente_nome" | "assunto" | "finalizado_em" | "duracao_segundos" |
  "modalidade" | "relatorio_id" | "tax_type" | "honorarios"
>;

export type ClientsData = {
  clients: ClientRecord[];
  messages: ClientMessage[];
  triages: ClientTriage[];
  documents: ClientDocument[];
  history: ClientHistory[];
  guides: ClientMonthlyGuide[];
  warning?: string;
};

export const emptyClientsData: ClientsData = { clients: [], messages: [], triages: [], documents: [], history: [], guides: [] };

export async function loadClientsData(supabase: SupabaseClient<Database>): Promise<ClientsData> {
  const [clients, messages, triages, documents, history, guides] = await Promise.all([
    supabase.from("clientes").select("id,name,avatar,tax_type,cpf,status,email,phone,recorrente,recorrente_tipo,recorrente_dia_venc,asaas_subscription_id,created_at,ultimo_atendimento_finalizado_em,atendimento_modalidade,notas,checklist,cidade,estado,sexo,diagnosis,treatment,regime_tributario,honorarios,evidences,cep,endereco,numero,bairro,perfil_operacional,canal_resultado").order("name").limit(500),
    supabase.from("mensagens").select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration").order("seq", { ascending: false }).limit(500),
    supabase.from("triagens").select("id,cliente_ref,assunto,descricao,respostas,status,created_at,updated_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("documentos").select("id,cliente_ref,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,ai_extracted").order("created_at", { ascending: false }).limit(300),
    supabase.from("atendimentos_historico").select("id,cliente_id,cliente_nome,assunto,finalizado_em,duracao_segundos,modalidade,relatorio_id,tax_type,honorarios").order("finalizado_em", { ascending: false }).limit(1000),
    supabase.from("guias_mensais").select("*").order("competencia", { ascending: false }).limit(1000),
  ]);

  const errors = [clients.error, messages.error, triages.error, documents.error, history.error, guides.error].filter(Boolean);
  return {
    clients: clients.data ?? [],
    messages: messages.data ?? [],
    triages: triages.data ?? [],
    documents: documents.data ?? [],
    history: history.data ?? [],
    guides: guides.data ?? [],
    warning: errors.length ? "Alguns dados do prontuário não puderam ser carregados." : undefined,
  };
}
