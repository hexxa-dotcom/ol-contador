import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const HORARIOS_PADRAO = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:30"];

type Assunto = { id: string; titulo: string; resumo: string };

// GET /api/agendamento-opcoes — dados públicos da tela de agendamento (sem
// login). Existe porque o RLS bloqueia leitura anônima de
// servicos/agendamentos e a página de agendamento é pública. Devolve num
// request só tudo que a tela precisa: catálogo, horários e o que já está
// ocupado — sem isso dois visitantes conseguiriam marcar o mesmo horário.
export async function GET() {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const hoje = new Date().toISOString().slice(0, 10);

  const [servicosRes, configRes, apptRes, assuntosRes, diasBloqueadosRes] = await Promise.all([
    // Só avulso: a assessoria MEI é mensal e passa pelo fluxo de recorrência,
    // não por este Pix único.
    admin.from("servicos").select("id,name,description,price_cents,itens").eq("active", true).eq("recurrence", "avulso").order("price_cents"),
    admin.from("configuracoes").select("valor").eq("chave", "agenda_disponibilidade").maybeSingle(),
    // Só o pagamento confirmado vira linha em `agendamentos`, então é ela que
    // bloqueia horário — cobrança pendente continua liberando o slot.
    admin.from("agendamentos").select("date,time").neq("status", "done").gte("date", hoje),
    // Lista genérica — usada quando o plano ainda não tem `itens` cadastrados.
    admin.from("configuracoes").select("valor").eq("chave", "triagem_assuntos").maybeSingle(),
    // Feriados/folgas marcados pelo contador.
    admin.from("configuracoes").select("valor").eq("chave", "agenda_dias_bloqueados").maybeSingle(),
  ]);

  if (servicosRes.error) {
    console.error("agendamento-opcoes erro:", servicosRes.error.message);
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }

  const cfg = configRes.data?.valor;
  const horarios = Array.isArray(cfg) && cfg.length ? cfg : HORARIOS_PADRAO;

  const ocupados: Record<string, string[]> = {};
  (apptRes.data || []).forEach((a) => {
    if (!a.date || !a.time) return;
    (ocupados[a.date] ||= []).push(a.time);
  });

  const assuntosCfg = assuntosRes.data?.valor;
  const assuntosPadrao: Assunto[] = (Array.isArray(assuntosCfg) ? assuntosCfg : []).map((a) => {
    const item = a as { id: string; titulo: string; resumo?: string };
    return { id: item.id, titulo: item.titulo, resumo: item.resumo || "" };
  });

  const servicos = (servicosRes.data || []).map((s) => ({
    ...s,
    itens: Array.isArray(s.itens) && s.itens.length ? s.itens : assuntosPadrao,
  }));

  const diasBloqueadosCfg = diasBloqueadosRes.data?.valor;
  const diasBloqueados = Array.isArray(diasBloqueadosCfg) ? diasBloqueadosCfg : [];

  return NextResponse.json({ servicos, horarios, ocupados, diasBloqueados }, { headers: { "Cache-Control": "no-store" } });
}
