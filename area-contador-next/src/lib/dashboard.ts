import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type DashboardData = {
  mode: "live" | "preview";
  revenue: { day: number; week: number; month: number };
  appointments: { today: number; week: number };
  expressPending: number;
  unreadMessages: number;
  completedThisMonth: number;
  pendingTasks: number;
  tasks: Array<{
    id: string;
    texto: string;
    feita: boolean;
    dataInicial: string | null;
    dataFinal: string | null;
    responsavelId: string | null;
  }>;
  staffList: Array<{ id: string; nome: string }>;
  monthlyGuides: Array<{
    id: number;
    clienteRef: string;
    clientName: string;
    competencia: string;
    tipo: string;
    status: string;
  }>;
  loadedAt: string;
  warning?: string;
};

export const emptyDashboardData: DashboardData = {
  mode: "preview",
  revenue: { day: 0, week: 0, month: 0 },
  appointments: { today: 0, week: 0 },
  expressPending: 0,
  unreadMessages: 0,
  completedThisMonth: 0,
  pendingTasks: 0,
  tasks: [],
  staffList: [],
  monthlyGuides: [],
  loadedAt: new Date(0).toISOString(),
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateInSaoPaulo(value: Date | string) {
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

function addDays(isoDate: string, days: number) {
  const value = new Date(`${isoDate}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function startOfWeek(isoDate: string) {
  const value = new Date(`${isoDate}T12:00:00Z`);
  const day = value.getUTCDay();
  return addDays(isoDate, -(day === 0 ? 6 : day - 1));
}

export async function loadDashboardData(supabase: SupabaseClient<Database>): Promise<DashboardData> {
  const today = dateInSaoPaulo(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const [paymentsResult, appointmentsResult, expressResult, messagesResult, historyResult, tasksResult, staffResult, guidesResult, guideClientsResult] = await Promise.all([
    supabase.from("cobrancas").select("valor_cents,paid_at").eq("status", "paid").gte("paid_at", `${monthStart}T00:00:00-03:00`),
    supabase.from("agendamentos").select("date,status").gte("date", weekStart).lte("date", weekEnd),
    supabase.from("atendimentos_express").select("id", { count: "exact", head: true }).neq("status", "concluido"),
    supabase.from("mensagens").select("id", { count: "exact", head: true }).eq("sender", "client").is("read_at", null),
    supabase.from("atendimentos_historico").select("id", { count: "exact", head: true }).gte("finalizado_em", `${monthStart}T00:00:00-03:00`),
    supabase.from("tarefas").select("id,texto,feita,data_inicial,data_final,responsavel_id").eq("excluida", false).order("created_at", { ascending: false }).limit(200),
    supabase.from("staff").select("id,name,nome").not("id", "is", null),
    supabase.from("guias_mensais").select("id,cliente_ref,competencia,observacao,status").order("competencia", { ascending: false }).limit(300),
    supabase.from("clientes").select("id,name").limit(500),
  ]);

  const firstError = [paymentsResult.error, appointmentsResult.error, expressResult.error, messagesResult.error, historyResult.error, tasksResult.error, staffResult.error, guidesResult.error, guideClientsResult.error].find(Boolean);
  if (firstError) throw firstError;

  const paid = paymentsResult.data ?? [];
  const appointments = appointmentsResult.data ?? [];
  const tasks = (tasksResult.data ?? []).map((item) => ({
    id: item.id,
    texto: item.texto,
    feita: item.feita,
    dataInicial: item.data_inicial,
    dataFinal: item.data_final,
    responsavelId: item.responsavel_id,
  }));
  const staffList = (staffResult.data ?? [])
    .filter((item): item is typeof item & { id: string } => Boolean(item.id))
    .map((item) => ({ id: item.id, nome: item.nome || item.name || item.id }));
  const pendingTasks = tasks.filter((item) => !item.feita).length;
  const guideClientNames = new Map((guideClientsResult.data ?? []).map((item) => [item.id, item.name]));
  const monthlyGuides = (guidesResult.data ?? []).map((item) => ({
    id: item.id,
    clienteRef: item.cliente_ref,
    clientName: guideClientNames.get(item.cliente_ref) || item.cliente_ref,
    competencia: item.competencia,
    tipo: item.observacao || "Acompanhamento mensal",
    status: item.status,
  }));
  const sum = (items: typeof paid) => items.reduce((total, item) => total + (item.valor_cents ?? 0), 0);

  return {
    mode: "live",
    revenue: {
      day: sum(paid.filter(item => item.paid_at && dateInSaoPaulo(item.paid_at) === today)),
      week: sum(paid.filter(item => item.paid_at && dateInSaoPaulo(item.paid_at) >= weekStart)),
      month: sum(paid),
    },
    appointments: {
      today: appointments.filter(item => item.date === today && item.status !== "done").length,
      week: appointments.filter(item => item.date && item.date >= today && item.status !== "done").length,
    },
    expressPending: expressResult.count ?? 0,
    unreadMessages: messagesResult.count ?? 0,
    completedThisMonth: historyResult.count ?? 0,
    pendingTasks,
    tasks,
    staffList,
    monthlyGuides,
    loadedAt: new Date().toISOString(),
  };
}
