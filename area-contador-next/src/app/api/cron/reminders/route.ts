import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as notify from "@/lib/notify";
import * as serpro from "@/lib/serpro";
import { proximosVencimentos } from "@/lib/portal";
import { nowTime } from "@/lib/pagamento";
import { registrarErro } from "@/lib/observability";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Admin = SupabaseClient<Database>;

const SITE_URL = process.env.SITE_URL || "https://area-contador-next.vercel.app";

// Porte 1:1 de api/agenda-fiscal/run-reminders.js do legado — motor de
// lembretes (fiscal + horário de atendimento), alertas de SLA do Express,
// expiração do cofre GovBR e retenção de dados. Único endpoint porque tudo
// roda no mesmo cron, na mesma janela de execução.
//
// As janelas de tempo são mais largas que o intervalo do cron (15min) —
// senão um agendamento em hora "redonda" só cairia dentro da janela numa
// única batida, sem margem pra atraso/jitter.
const JANELA_1H = { minMin: 40, maxMin: 65 };
const JANELA_LINK = { minMin: 3, maxMin: 20 };
const MAX_POR_RODADA = 5;

type Appt = { id: number; date: string | null; time: string | null; cliente_ref: string; tax_type: string | null };

// Horário do agendamento é sempre hora local de Brasília. "-03:00" fixo é
// seguro: o Brasil não tem mais horário de verão desde 2019.
function minutosAte(appt: Appt): number {
  const quando = new Date(`${appt.date}T${appt.time}:00-03:00`);
  return (quando.getTime() - Date.now()) / 60000;
}

async function jaEnviado(admin: Admin, marcador: string, clienteRef: string) {
  const { data } = await admin.from("lembretes_enviados").select("id").eq("obrigacao_id", marcador).eq("cliente_ref", clienteRef).maybeSingle();
  return !!data;
}

async function marcarEnviado(admin: Admin, marcador: string, clienteRef: string, dueDate: string) {
  const ins = await admin.from("lembretes_enviados").insert({ obrigacao_id: marcador, cliente_ref: clienteRef, due_date: dueDate });
  return !ins.error;
}

async function rodarLembrete1hAntes(admin: Admin, agendamentosHoje: Appt[]) {
  let enviados = 0;
  for (const appt of agendamentosHoje) {
    const min = minutosAte(appt);
    if (min <= JANELA_1H.minMin || min > JANELA_1H.maxMin) continue;
    const marcador = "appt_1h_" + appt.id;
    if (await jaEnviado(admin, marcador, appt.cliente_ref)) continue;
    if (!(await marcarEnviado(admin, marcador, appt.cliente_ref, appt.date!))) continue;

    const { data: cli } = await admin.from("clientes").select("*").eq("id", appt.cliente_ref).single();
    if (!cli) continue;
    await notify.notifyCliente(
      cli,
      "Seu atendimento é daqui a 1 hora",
      `Este é um lembrete: seu atendimento sobre <strong>${cli.tax_type || appt.tax_type || "seu caso"}</strong> está marcado para hoje às <strong>${appt.time}</strong> — daqui a 1 hora.<br><br>
      Se ainda não preencheu a triagem ou não anexou documentos, aproveite esse tempo para deixar tudo pronto.`,
    );
    enviados++;
  }
  return enviados;
}

async function rodarLembreteLinkAcesso(admin: Admin, agendamentosHoje: Appt[]) {
  let enviados = 0;
  for (const appt of agendamentosHoje) {
    const min = minutosAte(appt);
    if (min <= JANELA_LINK.minMin || min > JANELA_LINK.maxMin) continue;
    const marcador = "appt_link_" + appt.id;
    if (await jaEnviado(admin, marcador, appt.cliente_ref)) continue;
    if (!(await marcarEnviado(admin, marcador, appt.cliente_ref, appt.date!))) continue;

    const { data: cli } = await admin.from("clientes").select("*").eq("id", appt.cliente_ref).single();
    if (!cli || !cli.email) continue;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: cli.email,
      options: { redirectTo: SITE_URL + "/login" },
    });
    if (linkErr || !linkData?.properties?.action_link) continue;
    const link = linkData.properties.action_link;

    await notify.notifyCliente(
      cli,
      "Seu atendimento começa em 15 minutos",
      `Está quase na hora! Clique no botão abaixo para entrar direto na sua área e aguardar o chat abrir — sem precisar de senha:<br><br>
      <a href="${link}" style="display:inline-block;background:#0C5446;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Entrar no atendimento</a><br><br>
      Se o botão não funcionar, copie e cole este link no navegador:<br>${link}`,
    );
    enviados++;
  }
  return enviados;
}

async function rodarLembretes(admin: Admin) {
  const { data: obrigacoes } = await admin.from("obrigacoes").select("*").eq("active", true);
  const { data: clientes } = await admin.from("clientes").select("*");
  if (!obrigacoes || !clientes) return { enviados: 0 };

  let enviados = 0;
  for (const cli of clientes) {
    const venc = proximosVencimentos(obrigacoes, cli.tax_type);
    for (const v of venc) {
      if ((v.daysUntil ?? 999) > (v.reminderDays || 3)) continue;

      const { data: existe } = await admin.from("lembretes_enviados").select("id").eq("obrigacao_id", v.id).eq("cliente_ref", cli.id).eq("due_date", v.dueDate).maybeSingle();
      if (existe) continue;

      const ins = await admin.from("lembretes_enviados").insert({ obrigacao_id: v.id, cliente_ref: cli.id, due_date: v.dueDate });
      if (ins.error) continue;

      await admin.from("notificacoes").insert({ text: `Lembrete: ${v.title} vence em ${v.dueDate} (${cli.name}).`, time: nowTime(), unread: true, cliente_ref: cli.id });
      await notify.notifyCliente(cli, `Lembrete: ${v.title}`, `Sua obrigação <strong>${v.title}</strong> vence em <strong>${v.dueDate}</strong>. ${v.description || ""}`);
      enviados++;
    }
  }
  return { enviados };
}

async function rodarLembretesAgendamentos(admin: Admin) {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data: agendamentos } = await admin.from("agendamentos").select("*").eq("status", "pending").eq("date", hoje);
  if (!agendamentos) return { enviadosAgendamentos: 0 };

  let enviados = 0;
  for (const appt of agendamentos) {
    if (!appt.cliente_ref) continue;
    const obId = "appt_" + appt.id;
    const { data: existe } = await admin.from("lembretes_enviados").select("id").eq("obrigacao_id", obId).eq("cliente_ref", appt.cliente_ref).maybeSingle();
    if (existe) continue;

    const ins = await admin.from("lembretes_enviados").insert({ obrigacao_id: obId, cliente_ref: appt.cliente_ref, due_date: hoje });
    if (ins.error) continue;

    const { data: cli } = await admin.from("clientes").select("*").eq("id", appt.cliente_ref).single();
    if (cli) {
      await notify.notifyCliente(
        cli,
        "Lembrete do seu Atendimento Hoje",
        `Este é um lembrete automático. Seu atendimento para <strong>${appt.tax_type}</strong> está agendado para hoje (<strong>${appt.date} às ${appt.time}</strong>).<br><br>
        Acesse sua área de cliente na plataforma e deixe seus documentos organizados na Triagem antes do contador iniciar.`,
      );
      enviados++;
    }
  }
  return { enviadosAgendamentos: enviados };
}

// Varredura da Caixa Postal (Integra Contador/Serpro): usa o serviço mais
// barato do conjunto (só indica se há mensagem nova). Controle por cliente —
// só entra quem não é checado há N dias — torna a varredura idempotente e
// espalha o gasto ao longo da semana em vez de concentrar numa batida só.
async function rodarVarreduraCaixaPostal(admin: Admin) {
  const { data: cfgLinhas } = await admin.from("configuracoes").select("chave, valor").in("chave", ["radar_fiscal_config", "radar_fiscal_clientes"]);
  const cfg: Record<string, unknown> = {};
  const liberacoes: Record<string, unknown> = {};
  (cfgLinhas || []).forEach((linha) => {
    const valor = linha.valor && typeof linha.valor === "object" ? (linha.valor as Record<string, unknown>) : {};
    if (linha.chave === "radar_fiscal_config") Object.assign(cfg, valor);
    if (linha.chave === "radar_fiscal_clientes") Object.assign(liberacoes, valor);
  });
  if (cfg.caixaPostalAutomatica === false) return { caixaPostalChecados: 0, caixaPostalDesligada: true };
  if (!serpro.isSerproConfigured()) return { caixaPostalChecados: 0 };

  const diasEntreChecagens = Math.min(30, Math.max(1, parseInt(String(cfg.caixaPostalIntervaloDias), 10) || 7));
  const limite = new Date(Date.now() - diasEntreChecagens * 24 * 3600 * 1000).toISOString();
  const { data: candidatos } = await admin
    .from("clientes")
    .select("id, name, cpf, email, caixa_postal_novas, caixa_postal_checada_em, recorrente, recorrente_tipo")
    .or(`caixa_postal_checada_em.is.null,caixa_postal_checada_em.lt.${limite}`)
    .limit(100);
  const clientes = (candidatos || [])
    .filter((cli) => {
      if (Object.prototype.hasOwnProperty.call(liberacoes, cli.id)) return liberacoes[cli.id] === true;
      return cli.recorrente && cli.recorrente_tipo === "Radar Fiscal";
    })
    .slice(0, MAX_POR_RODADA);

  if (!clientes.length) return { caixaPostalChecados: 0 };

  let checados = 0;
  let comNovidade = 0;
  for (const cli of clientes) {
    const documento = String(cli.cpf || "").replace(/\D/g, "");
    if (!documento) continue;

    let temNovas = false;
    let erro: Error | null = null;
    try {
      const r = await serpro.indicadorNovasMensagens(documento);
      temNovas = r.temNovas;
    } catch (e) {
      erro = e as Error;
    }

    // Registra o consumo mesmo quando falha: requisição recusada também foi
    // requisição cobrada.
    await admin.from("serpro_consultas").insert({
      cliente_ref: cli.id,
      documento: `${documento.length === 14 ? "CNPJ" : "CPF"}-***${documento.slice(-4)}`,
      id_sistema: "CAIXAPOSTAL",
      id_servico: "INNOVAMSG63",
      acao: "Monitorar",
      sucesso: !erro,
      erro_codigo: erro ? "erro" : null,
      erro_detalhe: erro ? String(erro.message).slice(0, 500) : null,
      origem: "cron",
    });

    await admin.from("clientes").update({ caixa_postal_novas: temNovas, caixa_postal_checada_em: new Date().toISOString() }).eq("id", cli.id);
    checados++;

    // Avisa só na transição (não tinha novidade → passou a ter).
    if (temNovas && !cli.caixa_postal_novas) {
      comNovidade++;
      await admin.from("notificacoes").insert({ text: `Caixa Postal e-CAC: nova mensagem para ${cli.name}.`, time: nowTime(), unread: true, cliente_ref: cli.id });
      await notify.notifyCliente(
        cli,
        "Você tem uma nova mensagem da Receita Federal",
        `A Receita Federal registrou uma nova mensagem na sua Caixa Postal do e-CAC.<br><br>
         Seu contador já foi avisado e vai verificar o conteúdo. Se for preciso agir, entramos em contato.`,
      );
    }
  }

  return { caixaPostalChecados: checados, caixaPostalComNovidade: comNovidade };
}

async function rodarAlertasAtendimentoExpress(admin: Admin) {
  const limite = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { data: casos, error } = await admin
    .from("atendimentos_express")
    .select("*")
    .not("status", "in", "(concluido,cancelado)")
    .is("alerta_sla_em", null)
    .lte("prazo_conclusao_em", limite)
    .limit(50);
  if (error) throw error;
  let alertasExpress = 0;
  for (const caso of casos || []) {
    const atrasado = new Date(caso.prazo_conclusao_em) < new Date();
    const { error: claimError } = await admin.from("atendimentos_express").update({ alerta_sla_em: new Date().toISOString() }).eq("id", caso.id).is("alerta_sla_em", null);
    if (claimError) continue;
    await admin.from("notificacoes").insert({
      text: `${atrasado ? "SLA vencido" : "SLA vence em até 12h"}: Atendimento Express #${caso.id}${caso.responsavel_nome ? ` · ${caso.responsavel_nome}` : " · sem responsável"}.`,
      time: nowTime(),
      unread: true,
      cliente_ref: caso.cliente_ref,
    });
    alertasExpress++;
  }
  return { alertasExpress };
}

async function expirarCofreGovbr(admin: Admin) {
  const agora = new Date().toISOString();
  const { data: expirados, error } = await admin
    .from("govbr_credenciais_cofre")
    .update({ status: "expired", ciphertext: null, iv: null, auth_tag: null, deleted_at: agora })
    .eq("status", "pending")
    .lt("expires_at", agora)
    .select("cliente_id");
  if (error) throw error;
  if ((expirados || []).length) {
    await admin.from("govbr_credenciais_auditoria").insert(expirados.map((item) => ({ cliente_id: item.cliente_id, ator_id: null, evento: "expired", detalhes: { origem: "cron" } })));
  }
  return { cofresExpirados: (expirados || []).length };
}

async function aplicarRetencaoDados(admin: Admin) {
  const { data: linha } = await admin.from("configuracoes").select("valor").eq("chave", "retencao_dados").maybeSingle();
  const cfg = (linha?.valor as Record<string, unknown>) || {};
  const antesDe = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();
  const resultados: Record<string, number> = {};
  const operacoes: [string, ReturnType<Admin["from"]>][] = [
    ["erros", admin.from("app_erros").delete().lt("ultimo_em", antesDe(Number(cfg.errosDias) || 90)).select("id") as never],
    ["rateLimits", admin.from("rate_limits").delete().lt("criado_em", antesDe(Number(cfg.rateLimitsDias) || 2)).select("id") as never],
    ["webhooks", admin.from("webhook_eventos").delete().lt("recebido_em", antesDe(Number(cfg.webhooksDias) || 180)).select("id") as never],
    ["serproAuditoria", admin.from("serpro_consultas").delete().lt("criado_em", antesDe(Number(cfg.serproAuditoriaDias) || 365)).select("id") as never],
    ["serproCache", admin.from("serpro_resultados").delete().not("expira_em", "is", null).lt("expira_em", antesDe(Number(cfg.serproCacheExpiradoDias) || 30)).select("id") as never],
  ];
  for (const [nome, operacao] of operacoes) {
    const { data, error } = (await operacao) as { data: unknown[] | null; error: { message: string } | null };
    if (error && !/column|schema cache/i.test(error.message || "")) throw error;
    resultados[nome] = (data || []).length;
  }
  return { retencaoRemovidos: resultados };
}

export async function GET(request: Request) {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  // Autoriza: cron da Vercel (CRON_SECRET no header, injetado automaticamente
  // pela Vercel quando a variável existe) OU staff logado.
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
    const r = await rodarLembretes(admin);
    const r2 = await rodarLembretesAgendamentos(admin);

    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data: agendamentosHoje } = await admin.from("agendamentos").select("*").eq("status", "pending").eq("date", hoje);
    const comCliente = (agendamentosHoje || []).filter((a): a is typeof a & { cliente_ref: string } => Boolean(a.cliente_ref));
    const enviados1h = await rodarLembrete1hAntes(admin, comCliente);
    const enviadosLink = await rodarLembreteLinkAcesso(admin, comCliente);
    const express = await rodarAlertasAtendimentoExpress(admin);
    const cofre = await expirarCofreGovbr(admin);
    const retencao = await aplicarRetencaoDados(admin);

    // Uma falha na varredura do Serpro não pode derrubar os lembretes, que
    // são a função principal deste endpoint.
    let radar: { caixaPostalChecados: number; caixaPostalErro?: string } = { caixaPostalChecados: 0 };
    try {
      radar = await rodarVarreduraCaixaPostal(admin);
    } catch (e) {
      radar = { caixaPostalChecados: 0, caixaPostalErro: (e as Error).message };
    }

    return NextResponse.json({ ...r, ...r2, enviados1h, enviadosLink, ...express, ...cofre, ...retencao, ...radar });
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, { origem: "cron", codigo: "reminders_failed", mensagem: err.message, rota: "/api/cron/reminders", severidade: "critico" });
    return NextResponse.json({ error: "reminders_failed", detail: err.message }, { status: 500 });
  }
}
