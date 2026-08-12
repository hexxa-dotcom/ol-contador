import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type Appointment = Tables["agendamentos"]["Row"];
export type ExpressItem = Tables["atendimentos_express"]["Row"];
export type Charge = Pick<Tables["cobrancas"]["Row"], "id"|"cliente_ref"|"servico_id"|"status"|"valor_cents"|"valor_original_cents"|"desconto_cents"|"paid_at"|"created_at"|"billing_type"|"invoice_url"|"pix_payload"|"pix_image"|"modalidade"|"appt_date"|"appt_time"|"origem">;
export type Report = Tables["relatorios"]["Row"];
export type MailItem = Tables["caixa_postal"]["Row"];
export type SerproQuery = Pick<Tables["serpro_consultas"]["Row"], "id"|"cliente_ref"|"criado_em"|"id_servico"|"id_sistema"|"acao"|"sucesso"|"erro_codigo">;
export type Credit = Pick<Tables["creditos"]["Row"], "id"|"codigo"|"valor_cents"|"status"|"cliente_ref"|"created_at"|"expira_em"|"observacao"|"usado_em"|"cancelado_em">;
export type ServicePlan = Tables["servicos"]["Row"];
export type SettingRecord = Tables["configuracoes"]["Row"];
export type RadarClient = Pick<Tables["clientes"]["Row"], "id"|"name"|"cpf"|"email"|"phone"|"regime_tributario"|"recorrente"|"recorrente_tipo">;
export type ReportAttachment = Tables["relatorio_anexos"]["Row"];
export type OperationDocument = Pick<Tables["documentos"]["Row"],"id"|"cliente_ref"|"file_name"|"mime"|"size_bytes"|"storage_path"|"public_url"|"created_at"|"ai_extracted">;

export type OperationsData = {
  appointments: Appointment[];
  express: ExpressItem[];
  charges: Charge[];
  reports: Report[];
  mail: MailItem[];
  serproQueries: SerproQuery[];
  credits: Credit[];
  services: ServicePlan[];
  settings: SettingRecord[];
  radarClients: RadarClient[];
  reportAttachments: ReportAttachment[];
  documents: OperationDocument[];
  warning?: string;
};

export const emptyOperationsData: OperationsData = { appointments: [], express: [], charges: [], reports: [], mail: [], serproQueries: [], credits: [], services: [], settings: [], radarClients: [], reportAttachments: [], documents: [] };

export async function loadOperationsData(supabase: SupabaseClient<Database>): Promise<OperationsData> {
  const [appointments, express, charges, reports, mail, serproQueries, credits, services, settings, radarClients, reportAttachments, documents] = await Promise.all([
    supabase.from("agendamentos").select("*").order("date", { ascending: true }).limit(300),
    supabase.from("atendimentos_express").select("*").order("contratado_em", { ascending: false }).limit(200),
    supabase.from("cobrancas").select("id,cliente_ref,servico_id,status,valor_cents,valor_original_cents,desconto_cents,paid_at,created_at,billing_type,invoice_url,pix_payload,pix_image,modalidade,appt_date,appt_time,origem").order("created_at", { ascending: false }).limit(500),
    supabase.from("relatorios").select("*").order("updated_at", { ascending: false }).limit(300),
    supabase.from("caixa_postal").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("serpro_consultas").select("id,cliente_ref,criado_em,id_servico,id_sistema,acao,sucesso,erro_codigo").order("criado_em", { ascending: false }).limit(200),
    supabase.from("creditos").select("id,codigo,valor_cents,status,cliente_ref,created_at,expira_em,observacao,usado_em,cancelado_em").order("created_at", { ascending: false }).limit(300),
    supabase.from("servicos").select("*").order("price_cents"),
    supabase.from("configuracoes").select("*").order("chave"),
    supabase.from("clientes").select("id,name,cpf,email,phone,regime_tributario,recorrente,recorrente_tipo").order("name").limit(500),
    supabase.from("relatorio_anexos").select("*").order("created_at",{ascending:false}).limit(500),
    supabase.from("documentos").select("id,cliente_ref,file_name,mime,size_bytes,storage_path,public_url,created_at,ai_extracted").order("created_at",{ascending:false}).limit(500),
  ]);
  const errors = [appointments.error, express.error, charges.error, reports.error, mail.error, serproQueries.error, credits.error, services.error, settings.error, radarClients.error, reportAttachments.error, documents.error].filter(Boolean);
  return {
    appointments: appointments.data ?? [], express: express.data ?? [], charges: charges.data ?? [], reports: reports.data ?? [],
    mail: mail.data ?? [], serproQueries: serproQueries.data ?? [], credits: credits.data ?? [], services: services.data ?? [], settings: settings.data ?? [],
    radarClients: radarClients.data ?? [],
    reportAttachments: reportAttachments.data ?? [], documents: documents.data ?? [],
    warning: errors.length ? "Alguns módulos operacionais não puderam ser carregados." : undefined,
  };
}
