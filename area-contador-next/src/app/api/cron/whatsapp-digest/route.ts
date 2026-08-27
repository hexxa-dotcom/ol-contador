import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as notify from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type Admin = SupabaseClient<Database>;

// Resumo diário pro contador, uma vez por dia (ver vercel.json): agenda de
// hoje + Atendimento Express ainda em aberto, mandado por WhatsApp.

const EXPRESS_STATUS_LABEL: Record<string, string> = {
  aguardando_triagem: "aguardando triagem",
  em_analise: "em análise",
  em_execucao: "em execução",
  aguardando_documentos: "aguardando documentos",
  pronto_envio: "pronto para envio",
};

async function montarResumo(admin: Admin) {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const { data: agendamentos } = await admin.from("agendamentos").select("*").eq("status", "pending").eq("date", hoje).order("time", { ascending: true });
  const { data: express } = await admin.from("atendimentos_express").select("*").not("status", "in", "(concluido,cancelado)").limit(50);

  const clienteIds = Array.from(new Set([...(agendamentos || []).map((a) => a.cliente_ref), ...(express || []).map((e) => e.cliente_ref)].filter((id): id is string => Boolean(id))));
  const { data: clientes } = clienteIds.length ? await admin.from("clientes").select("id,name").in("id", clienteIds) : { data: [] };
  const nomePorId = new Map((clientes || []).map((c) => [c.id, c.name]));

  const linhas: string[] = [];

  if (agendamentos && agendamentos.length) {
    linhas.push(`Agenda de hoje (${agendamentos.length}):`);
    for (const a of agendamentos) {
      const nome = (a.cliente_ref && nomePorId.get(a.cliente_ref)) || "Cliente";
      linhas.push(`${a.time} - ${nome} (${a.tax_type || "atendimento"})`);
    }
  } else {
    linhas.push("Agenda de hoje: nenhum atendimento marcado.");
  }

  if (express && express.length) {
    linhas.push(`Atendimento Express pendente (${express.length}):`);
    for (const e of express) {
      const nome = (e.cliente_ref && nomePorId.get(e.cliente_ref)) || "Cliente";
      const label = EXPRESS_STATUS_LABEL[e.status || ""] || e.status || "pendente";
      linhas.push(`${nome}: ${label}`);
    }
  } else {
    linhas.push("Atendimento Express: nada pendente.");
  }

  return { texto: linhas.join("\n"), totalAgendamentos: agendamentos?.length || 0, totalExpress: express?.length || 0 };
}

export async function GET(request: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const isCron = !!(process.env.CRON_SECRET && request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);
  if (!isCron) {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
    if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const resumo = await montarResumo(admin);
    const envio = await notify.notifyAdminResumoDiario(resumo.texto);
    return NextResponse.json({ ok: true, ...resumo, envio });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
