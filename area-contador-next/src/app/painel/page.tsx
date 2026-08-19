import { redirect } from "next/navigation";
import { AccountantShell } from "@/components/accountant-shell";
import { loadDashboardData } from "@/lib/dashboard";
import { loadClientsData } from "@/lib/clients";
import { loadOperationsData } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");

  const { data: staff, error: staffError } = await supabase.from("staff").select("id,email,name,nome,role,fila_restrita,acesso_insights_radar").eq("id", userId).maybeSingle();
  if (staffError || !staff) {
    const { data: client } = await supabase.from("clientes").select("id").eq("user_id", userId).maybeSingle();
    if (client) redirect("/portal");
    redirect("/login?erro=acesso");
  }

  const [dashboardData, clientsData, operationsData, notificationsResult] = await Promise.all([
    loadDashboardData(supabase),
    loadClientsData(supabase),
    loadOperationsData(supabase),
    supabase.from("notificacoes").select("id,text,time,created_at,unread,cliente_ref").order("created_at", { ascending: false }).limit(100),
  ]);

  return <AccountantShell dashboardData={dashboardData} clientsData={clientsData} operationsData={operationsData} notifications={notificationsResult.data ?? []} user={{
    id: staff.id || userId,
    name: staff.name || staff.nome || "Contador",
    email: staff.email,
    role: staff.role || "Equipe",
    filaRestrita: Boolean(staff.fila_restrita),
    acessoInsightsRadar: staff.acesso_insights_radar !== false,
  }}/>;
}
