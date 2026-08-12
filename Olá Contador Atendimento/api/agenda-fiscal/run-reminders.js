// /api/agenda-fiscal/run-reminders — motor de lembretes (idempotente): tanto
// os fiscais (vencimento de obrigação) quanto os de horário de atendimento
// (1h antes / link de acesso 15min antes). Tudo num único endpoint porque o
// plano Hobby da Vercel só permite 12 Serverless Functions por deploy — e o
// projeto já estava no limite.
//
// Precisa rodar a cada poucos minutos pra pegar o "faltam 15 minutos" no
// momento certo, e o Vercel Cron no Hobby só dispara 1x/dia — por isso quem
// chama isso agora é um cron EXTERNO (ex.: cron-job.org) a cada 15 minutos,
// com o mesmo CRON_SECRET no header Authorization. O cron nativo da Vercel
// (vercel.json) pode ser removido depois que o externo estiver configurado.
const agenda = require('../_lib/agenda');
const notify = require('../_lib/notify');
const serpro = require('../_lib/serpro');
const { adminClient, requireUser } = require('../_lib/auth');
const { nowTime } = require('../_lib/pagamento');
const { registrarErro } = require('../_lib/monitoramento');

const SITE_URL = process.env.SITE_URL || 'https://ola-contador.vercel.app';

// As janelas precisam ser mais largas que o intervalo do cron (15min) — senão
// um agendamento em hora "redonda" (ex.: 10:00) só cairia dentro da janela
// numa única batida do cron, sem nenhuma margem pra atraso/jitter. Com 20min+
// de largura, toda janela garante pelo menos uma batida por dentro mesmo no
// pior alinhamento possível.
const JANELA_1H = { minMin: 40, maxMin: 65 };   // dispara entre 40 e 65min antes
const JANELA_LINK = { minMin: 3, maxMin: 20 };  // dispara entre 3 e 20min antes

// O horário do agendamento é sempre hora local de Brasília (é o que aparece
// pro cliente na tela de agendamento), mas isso roda no servidor (Vercel →
// UTC). "-03:00" fixo é seguro: o Brasil não tem mais horário de verão desde
// 2019, então o offset de Brasília é sempre -03:00.
function minutosAte(appt) {
  const quando = new Date(`${appt.date}T${appt.time}:00-03:00`);
  return (quando.getTime() - Date.now()) / 60000;
}

async function jaEnviado(admin, marcador, clienteRef) {
  const { data } = await admin.from('lembretes_enviados')
    .select('id').eq('obrigacao_id', marcador).eq('cliente_ref', clienteRef).maybeSingle();
  return !!data;
}

async function marcarEnviado(admin, marcador, clienteRef, dueDate) {
  const ins = await admin.from('lembretes_enviados').insert({ obrigacao_id: marcador, cliente_ref: clienteRef, due_date: dueDate });
  return !ins.error;
}

// 1h antes: só um aviso, sem link — dá tempo de organizar documentos/triagem.
async function rodarLembrete1hAntes(admin, agendamentosHoje) {
  let enviados = 0;
  for (const appt of agendamentosHoje) {
    const min = minutosAte(appt);
    if (min <= JANELA_1H.minMin || min > JANELA_1H.maxMin) continue;

    const marcador = 'appt_1h_' + appt.id;
    if (await jaEnviado(admin, marcador, appt.cliente_ref)) continue;
    if (!(await marcarEnviado(admin, marcador, appt.cliente_ref, appt.date))) continue;

    const { data: cli } = await admin.from('clientes').select('*').eq('id', appt.cliente_ref).single();
    if (!cli) continue;
    await notify.notifyCliente(cli, 'Seu atendimento é daqui a 1 hora',
      `Este é um lembrete: seu atendimento sobre <strong>${cli.tax_type || appt.tax_type || 'seu caso'}</strong> está marcado para hoje às <strong>${appt.time}</strong> — daqui a 1 hora.<br><br>
      Se ainda não preencheu a triagem ou não anexou documentos, aproveite esse tempo para deixar tudo pronto.`);
    enviados++;
  }
  return enviados;
}

// 15min antes: o momento em que a pessoa realmente vai precisar entrar — manda
// o link de acesso direto (sem senha, sem digitar nada), gerado na hora.
async function rodarLembreteLinkAcesso(admin, agendamentosHoje) {
  let enviados = 0;
  for (const appt of agendamentosHoje) {
    const min = minutosAte(appt);
    if (min <= JANELA_LINK.minMin || min > JANELA_LINK.maxMin) continue;

    const marcador = 'appt_link_' + appt.id;
    if (await jaEnviado(admin, marcador, appt.cliente_ref)) continue;
    if (!(await marcarEnviado(admin, marcador, appt.cliente_ref, appt.date))) continue;

    const { data: cli } = await admin.from('clientes').select('*').eq('id', appt.cliente_ref).single();
    if (!cli || !cli.email) continue;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: cli.email,
      options: { redirectTo: SITE_URL + '/login.html' }
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('gerar link de acesso falhou:', linkErr?.message);
      continue;
    }
    const link = linkData.properties.action_link;

    await notify.notifyCliente(cli, 'Seu atendimento começa em 15 minutos',
      `Está quase na hora! Clique no botão abaixo para entrar direto na sua área e aguardar o chat abrir — sem precisar de senha:<br><br>
      <a href="${link}" style="display:inline-block;background:#0C5446;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Entrar no atendimento</a><br><br>
      Se o botão não funcionar, copie e cole este link no navegador:<br>${link}`);
    enviados++;
  }
  return enviados;
}

async function rodarLembretes(admin) {
  const { data: obrigacoes } = await admin.from('obrigacoes').select('*').eq('active', true);
  const { data: clientes } = await admin.from('clientes').select('*');
  if (!obrigacoes || !clientes) return { enviados: 0 };

  let enviados = 0;
  for (const cli of clientes) {
    const venc = agenda.proximosVencimentos(obrigacoes, cli.tax_type);
    for (const v of venc) {
      const ob = obrigacoes.find(o => o.id === v.id);
      if (v.daysUntil > (ob.reminder_days || 3)) continue;

      const { data: existe } = await admin.from('lembretes_enviados')
        .select('id').eq('obrigacao_id', v.id).eq('cliente_ref', cli.id).eq('due_date', v.dueDate).maybeSingle();
      if (existe) continue;

      const ins = await admin.from('lembretes_enviados').insert({ obrigacao_id: v.id, cliente_ref: cli.id, due_date: v.dueDate });
      if (ins.error) continue;

      await admin.from('notificacoes').insert({
        text: `Lembrete: ${v.title} vence em ${v.dueDate} (${cli.name}).`,
        time: nowTime(), unread: true, cliente_ref: cli.id
      });
      await notify.notifyCliente(cli, `Lembrete: ${v.title}`,
        `Sua obrigação <strong>${v.title}</strong> vence em <strong>${v.dueDate}</strong>. ${v.description || ''}`);
      enviados++;
    }
  }
  return { enviados };
}

async function rodarLembretesAgendamentos(admin) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const { data: agendamentos } = await admin.from('agendamentos').select('*').eq('status', 'pending').eq('date', hoje);
  if (!agendamentos) return { enviadosAgendamentos: 0 };

  let enviados = 0;
  for (const appt of agendamentos) {
    const obId = 'appt_' + appt.id;
    const { data: existe } = await admin.from('lembretes_enviados')
      .select('id').eq('obrigacao_id', obId).eq('cliente_ref', appt.cliente_ref).maybeSingle();
    
    if (existe) continue;

    const ins = await admin.from('lembretes_enviados').insert({ 
      obrigacao_id: obId, 
      cliente_ref: appt.cliente_ref, 
      due_date: hoje 
    });
    if (ins.error) continue;

    const { data: cli } = await admin.from('clientes').select('*').eq('id', appt.cliente_ref).single();
    if (cli) {
      await notify.notifyCliente(cli, 'Lembrete do seu Atendimento Hoje',
        `Este é um lembrete automático. Seu atendimento para <strong>${appt.tax_type}</strong> está agendado para hoje (<strong>${appt.date} às ${appt.time}</strong>).<br><br>
        Acesse sua área de cliente na plataforma e deixe seus documentos organizados na Triagem antes do contador iniciar.`);
      enviados++;
    }
  }
  return { enviadosAgendamentos: enviados };
}

// ---------------------------------------------------------------------------
// Varredura semanal da Caixa Postal (Integra Contador / Serpro)
//
// Usa o INNOVAMSG63 ("Monitorar"), que só responde SE há mensagem nova — é o
// serviço mais barato do conjunto. A lista completa, que custa outra
// requisição, só é buscada depois, sob demanda, pelo painel do contador.
//
// O intervalo NÃO é dia-da-semana: este endpoint é chamado por um cron externo
// a cada 15 minutos, então um "se hoje é segunda" dispararia ~96 vezes no dia.
// O controle é por cliente — só entra quem não é checado há 7 dias. Isso torna
// a varredura idempotente por construção e ainda espalha o gasto ao longo da
// semana em vez de concentrar tudo numa batida só.
const MAX_POR_RODADA = 5;

async function rodarVarreduraCaixaPostal(admin) {
  const { data: cfgLinhas } = await admin.from('configuracoes')
    .select('chave, valor')
    .in('chave', ['radar_fiscal_config', 'radar_fiscal_clientes']);
  const cfg = {}, liberacoes = {};
  (cfgLinhas || []).forEach(linha => {
    const valor = linha.valor && typeof linha.valor === 'object' ? linha.valor : {};
    if (linha.chave === 'radar_fiscal_config') Object.assign(cfg, valor);
    if (linha.chave === 'radar_fiscal_clientes') Object.assign(liberacoes, valor);
  });
  if (cfg.caixaPostalAutomatica === false) return { caixaPostalChecados: 0, caixaPostalDesligada: true };
  if (!serpro.isSerproConfigured()) return { caixaPostalChecados: 0 };

  const diasEntreChecagens = Math.min(30, Math.max(1, parseInt(cfg.caixaPostalIntervaloDias, 10) || 7));
  const limite = new Date(Date.now() - diasEntreChecagens * 24 * 3600 * 1000).toISOString();
  // Busca candidatos vencidos e filtra pela permissão explícita. A assinatura
  // antiga continua valendo quando ainda não existe uma escolha manual.
  const { data: candidatos } = await admin
    .from('clientes')
    .select('id, name, cpf, email, caixa_postal_novas, caixa_postal_checada_em, recorrente, recorrente_tipo')
    .or(`caixa_postal_checada_em.is.null,caixa_postal_checada_em.lt.${limite}`)
    .limit(100);
  const clientes = (candidatos || []).filter(cli => {
    if (Object.prototype.hasOwnProperty.call(liberacoes, cli.id)) return liberacoes[cli.id] === true;
    return cli.recorrente && cli.recorrente_tipo === 'Radar Fiscal';
  }).slice(0, MAX_POR_RODADA);

  if (!clientes || clientes.length === 0) return { caixaPostalChecados: 0 };

  let checados = 0, comNovidade = 0;
  for (const cli of clientes) {
    const documento = String(cli.cpf || '').replace(/\D/g, '');
    if (!documento) continue;

    let temNovas = false, erro = null;
    try {
      const r = await serpro.indicadorNovasMensagens(documento);
      temNovas = r.temNovas;
    } catch (e) {
      erro = e;
    }

    // Registra o consumo mesmo quando falha: requisição recusada também foi
    // requisição cobrada, e erro que se repete toda semana é custo recorrente.
    await admin.from('serpro_consultas').insert({
      cliente_ref: cli.id, documento: `${documento.length === 14 ? 'CNPJ' : 'CPF'}-***${documento.slice(-4)}`,
      id_sistema: 'CAIXAPOSTAL', id_servico: 'INNOVAMSG63', acao: 'Monitorar',
      sucesso: !erro,
      erro_codigo: erro ? (erro.code || 'erro') : null,
      erro_detalhe: erro ? String(erro.message).slice(0, 500) : null,
      origem: 'cron'
    });

    // Mesmo com erro, marca a data: senão um cliente sem procuração seria
    // retentado a cada 15 minutos, para sempre, queimando requisição.
    await admin.from('clientes')
      .update({ caixa_postal_novas: temNovas, caixa_postal_checada_em: new Date().toISOString() })
      .eq('id', cli.id);
    checados++;

    // Avisa só na transição (não tinha novidade → passou a ter), pra não
    // repetir o mesmo aviso toda semana enquanto a mensagem não for lida.
    if (temNovas && !cli.caixa_postal_novas) {
      comNovidade++;
      await admin.from('notificacoes').insert({
        text: `Caixa Postal e-CAC: nova mensagem para ${cli.name}.`,
        time: nowTime(), unread: true, cliente_ref: cli.id
      });
      await notify.notifyCliente(cli, 'Você tem uma nova mensagem da Receita Federal',
        `A Receita Federal registrou uma nova mensagem na sua Caixa Postal do e-CAC.<br><br>
         Seu contador já foi avisado e vai verificar o conteúdo. Se for preciso agir, entramos em contato.`);
    }
  }

  return { caixaPostalChecados: checados, caixaPostalComNovidade: comNovidade };
}

async function rodarAlertasAtendimentoExpress(admin) {
  const limite = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { data: casos, error } = await admin.from('atendimentos_express').select('*')
    .not('status', 'in', '(concluido,cancelado)')
    .is('alerta_sla_em', null).lte('prazo_conclusao_em', limite).limit(50);
  if (error) throw error;
  let alertasExpress = 0;
  for (const caso of (casos || [])) {
    const atrasado = new Date(caso.prazo_conclusao_em) < new Date();
    const { error: claimError } = await admin.from('atendimentos_express')
      .update({ alerta_sla_em: new Date().toISOString() }).eq('id', caso.id).is('alerta_sla_em', null);
    if (claimError) continue;
    await admin.from('notificacoes').insert({
      text: `${atrasado ? 'SLA vencido' : 'SLA vence em até 12h'}: Atendimento Express #${caso.id}${caso.responsavel_nome ? ` · ${caso.responsavel_nome}` : ' · sem responsável'}.`,
      time: nowTime(), unread: true, cliente_ref: caso.cliente_ref
    });
    alertasExpress++;
  }
  return { alertasExpress };
}

async function expirarCofreGovbr(admin) {
  const agora = new Date().toISOString();
  const { data: expirados, error } = await admin.from('govbr_credenciais_cofre')
    .update({ status: 'expired', ciphertext: null, iv: null, auth_tag: null, deleted_at: agora })
    .eq('status', 'pending').lt('expires_at', agora).select('cliente_id');
  if (error) throw error;
  if ((expirados || []).length) {
    await admin.from('govbr_credenciais_auditoria').insert(expirados.map(item => ({
      cliente_id: item.cliente_id, ator_id: null, evento: 'expired', detalhes: { origem: 'cron' }
    })));
  }
  return { cofresExpirados: (expirados || []).length };
}

async function aplicarRetencaoDados(admin) {
  const { data: linha } = await admin.from('configuracoes').select('valor').eq('chave', 'retencao_dados').maybeSingle();
  const cfg = linha?.valor || {};
  const antesDe = dias => new Date(Date.now() - dias * 86400000).toISOString();
  const resultados = {};
  const operacoes = [
    ['erros', admin.from('app_erros').delete().lt('ultimo_em', antesDe(Number(cfg.errosDias) || 90)).select('id')],
    ['rateLimits', admin.from('rate_limits').delete().lt('criado_em', antesDe(Number(cfg.rateLimitsDias) || 2)).select('id')],
    ['webhooks', admin.from('webhook_eventos').delete().lt('recebido_em', antesDe(Number(cfg.webhooksDias) || 180)).select('id')],
    ['serproAuditoria', admin.from('serpro_consultas').delete().lt('criado_em', antesDe(Number(cfg.serproAuditoriaDias) || 365)).select('id')],
    ['serproCache', admin.from('serpro_resultados').delete().not('expira_em','is',null).lt('expira_em', antesDe(Number(cfg.serproCacheExpiradoDias) || 30)).select('id')]
  ];
  for (const [nome, operacao] of operacoes) {
    const { data, error } = await operacao;
    if (error && !/column|schema cache/i.test(error.message || '')) throw error;
    resultados[nome] = (data || []).length;
  }
  return { retencaoRemovidos: resultados };
}

module.exports = async (req, res) => {
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  // Autoriza: cron da Vercel OU contador logado. O header "x-vercel-cron" NÃO
  // é usado sozinho pra provar isso — é só um header comum, qualquer chamada
  // de fora pode mandar ele também. A prova real é o CRON_SECRET: quando essa
  // variável existe na Vercel, ela mesma anexa "Authorization: Bearer
  // <CRON_SECRET>" nas chamadas do cron agendado — só o cron de verdade sabe
  // esse valor.
  const isCron = !!(process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`);
  if (!isCron) {
    const auth = await requireUser(req, res);
    if (!auth) return;
  }

  try {
    const r = await rodarLembretes(admin);
    const r2 = await rodarLembretesAgendamentos(admin);

    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const { data: agendamentosHoje } = await admin.from('agendamentos')
      .select('*').eq('status', 'pending').eq('date', hoje);
    const enviados1h = await rodarLembrete1hAntes(admin, agendamentosHoje || []);
    const enviadosLink = await rodarLembreteLinkAcesso(admin, agendamentosHoje || []);
    const express = await rodarAlertasAtendimentoExpress(admin);
    const cofre = await expirarCofreGovbr(admin);
    const retencao = await aplicarRetencaoDados(admin);

    // Uma falha na varredura do Serpro (fora do nosso controle: gateway,
    // certificado, procuração) não pode derrubar os lembretes, que são a
    // função principal deste endpoint.
    let radar = { caixaPostalChecados: 0 };
    try {
      radar = await rodarVarreduraCaixaPostal(admin);
    } catch (e) {
      console.error('varredura caixa postal falhou:', e.message);
      radar = { caixaPostalChecados: 0, caixaPostalErro: e.message };
    }

    res.json({ ...r, ...r2, enviados1h, enviadosLink, ...express, ...cofre, ...retencao, ...radar });
  } catch (e) {
    console.error('lembretes error:', e.message);
    await registrarErro(admin, { origem: 'cron', codigo: e.code || 'reminders_failed', mensagem: e.message, rota: '/api/agenda-fiscal/run-reminders', severidade: 'critico' });
    res.status(500).json({ error: 'reminders_failed', detail: e.message });
  }
};
