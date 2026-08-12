import { redirect } from "next/navigation";
import { ClientShell } from "@/components/client-shell";
import { loadPortalData } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");

  const { data: client, error: clientError } = await supabase.from("clientes").select("id").eq("user_id", userId).maybeSingle();
  if (clientError || !client) redirect("/login?erro=acesso");

  const data = await loadPortalData(supabase, client.id);

  return <ClientShell data={data} />;
}
