// GET /api/status — polling público (sem login) da tela de checkout.
// Unifica endpoints que eram funções serverless separadas (signup-status,
// credito-status e nota-fiscal) porque o plano Hobby da Vercel tem teto de 12
// funções por deploy e cada arquivo em api/ conta uma. O parâmetro decide o
// que responder:
//   ?cobrancaId=123          -> status do pagamento Pix
//   ?codigo=OC-XXXXXXXX      -> validação de crédito de atendimento
//   ?acao=servicos-municipais -> serviços municipais cadastrados no Asaas
const asaas = require('./_lib/asaas');
const notify = require('./_lib/notify');
const { adminClient, requireUser } = require('./_lib/auth');
const { confirmCobranca, gerarAutoLogin } = require('./_lib/pagamento');
const govbrVault = require('./_lib/govbr-vault');
const { checarRateLimit } = require('./_lib/rateLimit');
const { registrarEventoFunil } = require('./_lib/metricas');
const { registrarErro } = require('./_lib/monitoramento');

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function horaPainel() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function nomeProtegido(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'Cliente não informado';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes.slice(1).map(parte => parte[0] + '.').join(' ')}`;
}

function documentoProtegido(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length === 11) return `CPF ***.***.***-${digitos.slice(-2)}`;
  if (digitos.length === 14) return `CNPJ **.***.***/****-${digitos.slice(-2)}`;
  return 'Documento protegido';
}

async function validarRelatorioPublico(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  const codigo = String(req.query.codigo || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo)) {
    return res.status(400).json({ valido: false, error: 'codigo_invalido' });
  }
  const admin = adminClient();
  if (!admin) return res.status(503).json({ valido: false, error: 'service_unavailable' });
  const { data, error } = await admin.from('relatorios').select(
    'id,titulo,cliente_nome,cliente_cpf,contador_nome,contador_crc,versao,entregue_em,status'
  ).eq('codigo_validacao', codigo).eq('status', 'entregue').maybeSingle();
  if (error || !data) return res.status(404).json({ valido: false, error: 'relatorio_nao_encontrado' });
  res.json({
    valido: true,
    protocolo: `OC-R${String(data.id).padStart(6, '0')}-V${data.versao || 1}`,
    titulo: data.titulo || 'Relatório de atendimento',
    cliente: nomeProtegido(data.cliente_nome),
    documento: documentoProtegido(data.cliente_cpf),
    contador: data.contador_nome || 'Contador responsável',
    crc: data.contador_crc || null,
    versao: data.versao || 1,
    entregueEm: data.entregue_em
  });
}

async function statusCobranca(req, res, admin) {
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const id = parseInt(req.query.cobrancaId, 10);
  if (!id) return res.status(400).json({ error: 'invalid_params' });
  const { data: cob } = await admin.from('cobrancas').select('*').eq('id', id).single();
  if (!cob) return res.status(404).json({ error: 'cobranca_not_found' });

  // O id da cobrança é sequencial (adivinhável) — sem exigir de volta o
  // poll_token que só foi entregue ao navegador que abriu este checkout,
  // qualquer um poderia consultar (e, pior, herdar o login automático de)
  // o pagamento de outra pessoa. Ver scripts/checkout-login-automatico.sql.
  const pollToken = String(req.query.pollToken || '');
  if (!cob.poll_token || pollToken !== cob.poll_token) {
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const resultado = await confirmCobranca(admin, cob);
    if (resultado.status === 'paid') {
      resultado.autoLogin = await gerarAutoLogin(admin, cob.cliente_ref);
    }
    res.json(resultado);
  } catch (e) {
    console.error('status (cobranca) error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
}

async function statusCredito(req, res, admin) {
  const codigo = String(req.query.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: 'invalid_params' });

  const { data: credito } = await admin.from('creditos').select('*').eq('codigo', codigo).maybeSingle();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(410).json({ error: 'credito_indisponivel', status: credito.status });
  if (credito.expira_em && new Date(credito.expira_em) <= new Date()) {
    return res.status(410).json({ error: 'credito_expirado', status: 'expirado' });
  }
  res.json({ valido: true, valorCents: credito.valor_cents, valor: credito.valor_cents / 100 });
}

async function registrarEventoPublico(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });
  if (!(await checarRateLimit(admin, req, 'funil-publico', 30, 15))) return res.status(429).json({ error: 'muitas_tentativas' });
  const evento = String((req.body || {}).evento || '');
  const sessaoRef = String((req.body || {}).sessaoRef || '');
  if (!['precos_visualizados','agendamento_iniciado','checkout_iniciado','radar_fiscal_visualizado','radar_fiscal_interesse'].includes(evento) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessaoRef)) {
    return res.status(400).json({ error: 'invalid_params' });
  }
  await registrarEventoFunil(admin, evento, {
    sessaoRef, servicoId: String((req.body || {}).servicoId || '').slice(0, 80) || null,
    origem: String((req.body || {}).origem || 'site').slice(0, 80)
  });
  res.json({ ok: true });
}

async function registrarErroPublico(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });
  if (!(await checarRateLimit(admin, req, 'erro-frontend', 20, 15))) return res.status(429).json({ error: 'muitas_tentativas' });
  const body = req.body || {};
  await registrarErro(admin, {
    origem: 'frontend', codigo: String(body.codigo || 'erro_frontend'),
    mensagem: String(body.mensagem || 'Erro no navegador'), rota: String(body.rota || ''),
    severidade: 'erro', contexto: body.contexto || {}
  });
  res.json({ ok: true });
}

// POST /api/status?acao=enviar-contato — formulário de contato público (sem
// login) da home. Manda por e-mail em vez de gravar em tabela nova: é o
// bastante pro volume esperado e não consome uma das 12 funções serverless
// do plano Hobby (por isso vive aqui dentro, não em api/contato.js).
async function enviarContatoPublico(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });
  if (!(await checarRateLimit(admin, req, 'contato-publico', 5, 15))) return res.status(429).json({ error: 'muitas_tentativas' });

  const body = req.body || {};
  const nome = String(body.nome || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 160);
  const mensagem = String(body.mensagem || '').trim().slice(0, 4000);
  if (!nome || !mensagem || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_params' });
  }
  if (!notify.emailConfigured()) return res.status(503).json({ error: 'email_not_configured' });

  const html = `<div style="font-family:sans-serif;font-size:14px;color:#111">
    <p><b>Nova mensagem pelo site</b></p>
    <p><b>Nome:</b> ${escapeHtml(nome)}</p>
    <p><b>E-mail:</b> ${escapeHtml(email)}</p>
    <p><b>Mensagem:</b><br>${escapeHtml(mensagem).replace(/\n/g, '<br>')}</p>
  </div>`;
  const resultado = await notify.sendEmail('ola@olacontador.com.br', `Contato pelo site — ${nome}`, html);
  if (!resultado || resultado.ok === false) return res.status(502).json({ error: 'envio_falhou' });
  res.json({ ok: true });
}

async function errosOperacionais(req, res) {
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  if (req.method === 'POST') {
    const id = Number((req.body || {}).id);
    if (!id) return res.status(400).json({ error: 'invalid_params' });
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { error } = await admin.from('app_erros').update({
      resolvido_em: new Date().toISOString(), resolvido_por: auth.user.id
    }).eq('id', id).is('resolvido_em', null);
    if (error) return res.status(500).json({ error: 'erro_update_failed' });
    return res.json({ ok: true });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await admin.from('app_erros').select('*')
    .gte('ultimo_em', desde).is('resolvido_em', null).order('ultimo_em', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: 'erros_query_failed' });
  res.json({ totalAbertos: (data || []).length, erros: data || [] });
}

async function metricasFunil(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const [{ data: eventos, error }, { data: cobrancas }] = await Promise.all([
    admin.from('funil_eventos').select('evento,sessao_ref').gte('created_at', desde),
    admin.from('cobrancas').select('valor_cents,desconto_cents,status').gte('created_at', desde)
  ]);
  if (error) return res.status(500).json({ error: 'metricas_failed' });
  const contagens = {};
  const sessoesPorEvento = {};
  (eventos || []).forEach(linha => {
    contagens[linha.evento] = (contagens[linha.evento] || 0) + 1;
    if (linha.sessao_ref) {
      if (!sessoesPorEvento[linha.evento]) sessoesPorEvento[linha.evento] = new Set();
      sessoesPorEvento[linha.evento].add(linha.sessao_ref);
    }
  });
  const totalDescontosCents = (cobrancas || []).reduce((soma, c) => soma + (c.desconto_cents || 0), 0);
  const receitaPagaCents = (cobrancas || []).filter(c => c.status === 'paid').reduce((soma, c) => soma + (c.valor_cents || 0), 0);
  const totalEtapa = evento => sessoesPorEvento[evento]?.size || contagens[evento] || 0;
  const visitas = totalEtapa('precos_visualizados');
  const iniciados = totalEtapa('agendamento_iniciado');
  const checkouts = totalEtapa('checkout_iniciado');
  const pagamentos = contagens.pagamento_confirmado || 0;
  res.json({ dias, contagens: { ...contagens, precos_visualizados: visitas, agendamento_iniciado: iniciados, checkout_iniciado: checkouts }, totalDescontosCents, receitaPagaCents,
    conversoes: {
      visitaParaAgendamento: visitas ? iniciados / visitas : 0,
      agendamentoParaCheckout: iniciados ? checkouts / iniciados : 0,
      checkoutParaPagamento: checkouts ? pagamentos / checkouts : 0
    },
    abandonos: {
      antesAgendamento: Math.max(0, visitas - iniciados),
      antesCheckout: Math.max(0, iniciados - checkouts),
      antesPagamento: Math.max(0, checkouts - pagamentos)
    }
  });
}

// Serviços municipais cadastrados na prefeitura da conta Asaas — usado só pra
// popular o seletor em Configurações → Integrações → Nota Fiscal, pra o
// contador escolher o municipalServiceId certo em vez de digitar um código
// arbitrário. Depende da conta já ter fiscalInfo configurado no Asaas — sem
// isso o Asaas devolve erro explicando o que falta configurar lá.
async function statusServicosMunicipais(req, res) {
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  try {
    const data = await asaas.getMunicipalServices();
    res.json(data.data || data);
  } catch (e) {
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
}

// POST /api/status?acao=marcar-lidas { clientId }
// A função RPC antiga dependia do contexto do Postgres e, na prática, só
// confirmava a leitura do cliente. Aqui validamos a sessão antes de usar o
// cliente administrativo: cliente só pode marcar mensagens do contador na
// própria conversa; equipe pode marcar as mensagens do cliente na conversa
// que abriu. Assim os dois sentidos gravam read_at de forma consistente.
async function marcarMensagensLidas(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const clientId = String((req.body || {}).clientId || '').trim();
  if (!clientId) return res.status(400).json({ error: 'invalid_params' });

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const [{ data: isStaff, error: staffError }, { data: myClientId, error: clientError }] = await Promise.all([
    auth.sb.rpc('is_staff'),
    auth.sb.rpc('my_client_id')
  ]);
  if (staffError || clientError) return res.status(403).json({ error: 'forbidden' });

  // Quem abre a conversa confirma a leitura das mensagens do outro lado.
  let sender;
  if (isStaff) {
    sender = 'client';
  } else {
    if (String(myClientId || '') !== clientId) return res.status(403).json({ error: 'forbidden' });
    sender = 'agent';
  }

  const { data, error } = await admin.from('mensagens')
    .update({ read_at: new Date().toISOString() })
    .eq('cliente_id', clientId)
    .eq('sender', sender)
    .is('read_at', null)
    .select('id');
  if (error) {
    console.error('marcar-lidas error:', error.message);
    return res.status(500).json({ error: 'read_receipt_failed' });
  }
  res.json({ marked: (data || []).length });
}

async function exigirEquipe(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return null;
  const { data: isStaff, error } = await auth.sb.rpc('is_staff');
  if (error || !isStaff) { res.status(403).json({ error: 'forbidden' }); return null; }
  const admin = adminClient();
  if (!admin) { res.status(503).json({ error: 'service_role_not_configured' }); return null; }
  return admin;
}

// Escritas do painel passam por aqui porque o RLS do navegador pode variar
// conforme a sessão. A rota continua exigindo um membro da equipe autenticado.
async function atualizarStatusAtendimento(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  const { clientId, status } = req.body || {};
  if (!clientId || !['pending', 'active', 'docs', 'ready', 'locked', 'done'].includes(status)) {
    return res.status(400).json({ error: 'invalid_params' });
  }
  const patch = { status };
  // Fechar a conversa não é concluir o atendimento. A data de conclusão só
  // nasce na entrega transacional do relatório (ou numa mudança explícita
  // para done), para a linha do tempo não antecipar um resultado inexistente.
  if (status === 'done') patch.ultimo_atendimento_finalizado_em = new Date().toISOString();
  const { data, error } = await admin.from('clientes').update(patch).eq('id', clientId)
    .select('id,status,ultimo_atendimento_finalizado_em').single();
  if (error) return res.status(500).json({ error: 'status_update_failed' });
  res.json({ id: data.id, status: data.status, ultimoFinalizadoEm: data.ultimo_atendimento_finalizado_em || null });
}

// Textos "estilo rastreio de encomenda" — cada etapa do Kanban de
// Acompanhamento vira um e-mail curto avisando o cliente que o caso avançou.
// "recorrencia" fica de fora: é a ativação de uma assinatura, não um passo do
// atendimento, e já tem seu próprio aviso (moverParaRecorrencia, em app.js).
const KANBAN_EMAIL_POR_ETAPA = {
  pending: {
    titulo: 'Seu caso entrou em acompanhamento',
    corpo: 'Seu atendimento não termina por aqui — o contador vai continuar acompanhando a resolução do seu caso, e você recebe um aviso a cada etapa.'
  },
  active: {
    titulo: 'Seu caso está em análise',
    corpo: 'O contador começou a analisar o seu caso. Assim que houver novidade, você é avisado por aqui.'
  },
  docs: {
    titulo: 'Precisamos de mais alguns documentos seus',
    corpo: 'Estamos com o seu caso, mas para continuar precisamos de documentos adicionais. Acesse sua área de cliente e confira o que falta em "Documentos".'
  },
  ready: {
    titulo: 'Seu caso está pronto',
    corpo: 'Está tudo encaminhado — a entrega final do seu atendimento está sendo preparada.'
  },
  done: {
    titulo: 'Seu atendimento foi concluído!',
    corpo: 'Seu caso foi concluído. Acesse sua área de cliente para conferir o relatório e os detalhes.'
  }
};

// Move um cliente entre as etapas do Kanban de Acompanhamento. Diferente do
// drag-and-drop antigo (que gravava direto no Supabase pelo navegador via
// oc-data.js, sem passar por nenhuma função serverless), esta rota existe
// justamente para poder mandar o e-mail de "seu caso avançou" — que depende
// da RESEND_API_KEY, uma chave que nunca pode chegar ao navegador.
async function moverEtapaKanban(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  const { clientId, status } = req.body || {};
  if (!clientId || !['pending', 'active', 'docs', 'ready', 'done', 'recorrencia'].includes(status)) {
    return res.status(400).json({ error: 'invalid_params' });
  }

  const { data: linha } = await admin.from('configuracoes').select('valor').eq('chave', 'kanban_etapas').maybeSingle();
  const etapas = (linha && linha.valor) || {};
  etapas[clientId] = status;
  const { error } = await admin.from('configuracoes').upsert({ chave: 'kanban_etapas', valor: etapas }, { onConflict: 'chave' });
  if (error) return res.status(500).json({ error: 'kanban_update_failed' });

  const copy = KANBAN_EMAIL_POR_ETAPA[status];
  if (copy) {
    const { data: cli } = await admin.from('clientes').select('*').eq('id', clientId).single();
    if (cli) await notify.notifyCliente(cli, copy.titulo, copy.corpo);
  }
  res.json({ ok: true, status });
}

async function salvarConfiguracoesPainel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  const valores = (req.body || {}).config || {};
  const linhas = Object.keys(valores).map(chave => ({ chave, valor: valores[chave] }));
  if (!linhas.length) return res.json({ ok: true });
  const { error } = await admin.from('configuracoes').upsert(linhas, { onConflict: 'chave' });
  if (error) return res.status(500).json({ error: 'config_update_failed' });
  res.json({ ok: true, salvas: linhas.map(l => l.chave) });
}

const EXPRESS_AVISO_POR_STATUS = {
  em_analise: ['Seu Atendimento Express entrou em análise', 'Recebemos sua triagem e o contador iniciou a análise do caso.'],
  em_execucao: ['Seu Atendimento Express está em execução', 'A análise foi concluída e o serviço contratado está sendo executado.'],
  aguardando_documentos: ['Precisamos de um documento para continuar', 'Acesse sua Área do Cliente e confira os documentos do caso. Assim que recebermos o complemento, o serviço continuará.'],
  pronto_envio: ['Seu resultado está sendo preparado', 'A execução terminou e o relatório final está sendo preparado para entrega.']
};

// Centraliza as mudanças do Express no servidor: registra o responsável e
// envia os avisos sem expor as credenciais dos provedores ao navegador.
async function atualizarAtendimentoExpress(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { data: isStaff, error: staffError } = await auth.sb.rpc('is_staff');
  if (staffError || !isStaff) return res.status(403).json({ error: 'forbidden' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const id = Number((req.body || {}).id);
  const status = String((req.body || {}).status || '');
  const permitidos = ['aguardando_triagem', 'em_analise', 'em_execucao', 'aguardando_documentos', 'pronto_envio', 'concluido', 'cancelado'];
  if (!id || !permitidos.includes(status)) return res.status(400).json({ error: 'invalid_params' });

  const { data: atual, error: atualError } = await admin.from('atendimentos_express')
    .select('*').eq('id', id).maybeSingle();
  if (atualError || !atual) return res.status(404).json({ error: 'atendimento_express_not_found' });
  if (status === 'concluido') {
    const { data: entrega } = await admin.from('relatorios').select('id')
      .eq('atendimento_express_id', id).eq('status', 'entregue')
      .order('entregue_em', { ascending: false }).limit(1).maybeSingle();
    if (!entrega) return res.status(409).json({ error: 'resultado_ainda_nao_entregue' });
  }

  const agora = new Date().toISOString();
  const patch = { status, updated_at: agora };
  if (status === 'em_execucao') {
    patch.iniciado_em = atual.iniciado_em || agora;
    patch.responsavel_id = atual.responsavel_id || auth.user.id;
    patch.responsavel_nome = atual.responsavel_nome || auth.user.user_metadata?.name || auth.user.email || 'Equipe Olá, Contador';
  }
  if (status === 'concluido') patch.concluido_em = atual.concluido_em || agora;
  const { data, error } = await admin.from('atendimentos_express').update(patch).eq('id', id).select('*').single();
  if (error) return res.status(500).json({ error: 'express_update_failed', detail: error.message });

  if (atual.status !== status) {
    const { data: cliente } = await admin.from('clientes').select('*').eq('id', atual.cliente_ref).maybeSingle();
    const copy = EXPRESS_AVISO_POR_STATUS[status];
    if (cliente && copy) await notify.notifyCliente(cliente, copy[0], copy[1]);
    await admin.from('notificacoes').insert({
      text: `Atendimento Express #${id}: ${status.replaceAll('_', ' ')}${patch.responsavel_nome ? ` · ${patch.responsavel_nome}` : ''}.`,
      time: horaPainel(), unread: true, cliente_ref: atual.cliente_ref
    });
  }
  res.json({ ok: true, atendimento: data });
}

// Entrega e encerra o caso com idempotência. O relatório já foi gravado como
// entrega_pendente pelo editor; aqui os canais são tentados uma vez e a RPC
// conclui relatório, cliente, Express/agendamento, triagem e histórico na mesma
// transação. A Área do Cliente é sempre o canal principal da entrega.
async function finalizarPosAtendimento(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { data: isStaff, error: staffError } = await auth.sb.rpc('is_staff');
  if (staffError || !isStaff) return res.status(403).json({ error: 'forbidden' });

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const reportId = Number((req.body || {}).reportId);
  const retryNotice = !!(req.body || {}).retryNotice;
  const solicitados = Array.from(new Set(((req.body || {}).channels || [])
    .filter(c => ['email', 'caixa_postal', 'chat'].includes(c))));
  if (!reportId) return res.status(400).json({ error: 'invalid_params' });

  const { data: relatorio, error: reportError } = await admin.from('relatorios')
    .select('*').eq('id', reportId).maybeSingle();
  if (reportError || !relatorio) return res.status(404).json({ error: 'relatorio_not_found' });
  if (relatorio.status === 'arquivado_interno') return res.status(409).json({ error: 'relatorio_arquivado' });

  const somentePendencias = relatorio.tipo_relatorio === 'pendencias';
  const obrigatorios = somentePendencias
    ? ['titulo', 'problema', 'solucao', 'oque_feito', 'como_feito', 'pendencias']
    : ['titulo', 'problema', 'solucao', 'oque_feito'];
  if (obrigatorios.some(campo => !String(relatorio[campo] || '').trim())) {
    return res.status(422).json({ error: 'relatorio_incompleto' });
  }
  if (!String(relatorio.contador_nome || '').trim() ||
      !String(relatorio.contador_crc || '').trim() ||
      !String(relatorio.contador_assinatura || '').trim()) {
    return res.status(422).json({ error: 'assinatura_contador_incompleta' });
  }

  if (relatorio.status === 'entregue' && !retryNotice) {
    return res.json({ ok: true, alreadyDelivered: true, reportId, channels: relatorio.canais_entrega || ['area_cliente'], warnings: [] });
  }

  const { data: cliente } = await admin.from('clientes').select('*')
    .eq('id', relatorio.cliente_ref).maybeSingle();
  if (!cliente) return res.status(404).json({ error: 'cliente_not_found' });

  const tentativasAnteriores = Array.isArray(relatorio.entrega_tentativas) ? relatorio.entrega_tentativas : [];
  const sucessosAnteriores = new Set(tentativasAnteriores.filter(t => t && t.ok).map(t => t.channel));
  const tentativas = tentativasAnteriores.slice();
  const sucessos = [];
  const falhas = [];
  const titulo = relatorio.titulo || (somentePendencias ? 'Relatório de pendências' : 'Relatório de atendimento');
  const mensagem = `Seu ${somentePendencias ? 'relatório de pendências' : 'relatório de atendimento'} está pronto: “${titulo}”. Acesse sua Área do Cliente para consultar e baixar o PDF.`;

  // Primeiro torna o documento visível e encerra o caso de forma atômica.
  // Só depois dispara avisos externos; assim nenhum e-mail ou mensagem diz
  // "está pronto" se a entrega principal tiver falhado no banco.
  let conclusao;
  let conclusaoError;
  if (somentePendencias) {
    const entrega = await admin.from('relatorios').update({
      status: 'entregue', entregue_em: new Date().toISOString(),
      entregue_por: auth.user.email || auth.user.id,
      canais_entrega: ['area_cliente'], falha_entrega: null,
      updated_at: new Date().toISOString()
    }).eq('id', reportId).select('caso_ref').single();
    conclusao = { caseRef: entrega.data && entrega.data.caso_ref };
    conclusaoError = entrega.error;
  } else {
    const entrega = await admin.rpc('finalizar_pos_atendimento', {
      p_relatorio_id: reportId,
      p_canais: ['area_cliente'],
      p_entregue_por: auth.user.email || auth.user.id,
      p_falhas: []
    });
    conclusao = entrega.data;
    conclusaoError = entrega.error;
  }
  if (conclusaoError) {
    await admin.from('relatorios').update({
      status: 'falha_na_entrega', falha_entrega: conclusaoError.message,
      updated_at: new Date().toISOString()
    }).eq('id', reportId);
    return res.status(500).json({ error: 'finalizacao_falhou', detail: conclusaoError.message, warnings: [] });
  }

  async function tentar(channel, action) {
    if (sucessosAnteriores.has(channel)) { sucessos.push(channel); return; }
    const tentativa = { channel, attemptedAt: new Date().toISOString(), ok: false };
    try {
      const resultado = await action();
      if (resultado && (resultado.ok === false || resultado.skipped)) {
        throw new Error(resultado.skipped ? 'canal_nao_configurado' : 'envio_recusado');
      }
      tentativa.ok = true;
      tentativa.providerId = resultado && (resultado.id || resultado.sid) || null;
      sucessos.push(channel);
    } catch (error) {
      tentativa.error = String(error && error.message || error || 'falha');
      falhas.push({ channel, error: tentativa.error });
    }
    tentativas.push(tentativa);
    await admin.from('relatorios').update({
      entrega_tentativas: tentativas,
      updated_at: new Date().toISOString()
    }).eq('id', reportId);
  }

  for (const channel of solicitados) {
    if (channel === 'email') {
      await tentar(channel, async () => {
        if (!cliente.email) throw new Error('cliente_sem_email');
        return notify.sendEmail(
          cliente.email,
          `Seu relatório está pronto — ${titulo}`,
          `<div style="font-family:Arial,sans-serif;color:#173f34;line-height:1.6"><p>Olá, ${escapeHtml(cliente.name || '')}.</p><p>${escapeHtml(mensagem)}</p><p><a href="https://www.olacontador.com.br/cliente" style="display:inline-block;background:#0A5546;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Abrir minha área</a></p><p style="font-size:12px;color:#667">Olá, Contador</p></div>`
        );
      });
    }
    if (channel === 'caixa_postal') {
      await tentar(channel, async () => {
        const { data, error } = await admin.from('caixa_postal').insert({
          cliente_ref: cliente.id, remetente: 'contador', assunto: titulo,
          mensagem, lida: false
        }).select('id').single();
        if (error) throw error;
        return { ok: true, id: data.id };
      });
    }
    if (channel === 'chat') {
      await tentar(channel, async () => {
        const messageId = `relatorio_${reportId}`;
        const { data: existente } = await admin.from('mensagens').select('id').eq('id', messageId).maybeSingle();
        if (existente) return { ok: true, id: existente.id };
        const { data, error } = await admin.from('mensagens').insert({
          id: messageId, cliente_id: cliente.id, sender: 'agent', text: mensagem,
          time: horaPainel(), type: 'relatorio-card'
        }).select('id').single();
        if (error) throw error;
        return { ok: true, id: data.id };
      });
    }
  }

  const canaisAtuais = Array.isArray(relatorio.canais_entrega) ? relatorio.canais_entrega : [];
  const canaisEntregues = Array.from(new Set(['area_cliente', ...canaisAtuais, ...sucessos]));
  await admin.from('relatorios').update({
    canais_entrega: canaisEntregues,
    falha_entrega: falhas.length ? JSON.stringify(falhas) : null,
    entrega_tentativas: tentativas,
    updated_at: new Date().toISOString()
  }).eq('id', reportId);

  // Uma avaliação por caso, somente depois da entrega. O ID determinístico
  // impede duplicação quando a conclusão é reprocessada.
  const casoRef = conclusao && conclusao.casoRef || relatorio.caso_ref || `relatorio:${reportId}`;
  await registrarEventoFunil(admin, 'relatorio_entregue', {
    clienteRef: cliente.id, origem: 'painel_contador', metadata: { reportId, tipo: relatorio.tipo_relatorio || 'atendimento' }
  });
  if (somentePendencias) {
    return res.json({ ok: true, reportId, caseRef, caseKeptOpen: true, channels: canaisEntregues, warnings: falhas });
  }
  if (cliente.atendimento_modalidade !== 'sem_agendamento') {
    await admin.from('mensagens').upsert({
      id: `avaliacao_${String(casoRef).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      cliente_id: cliente.id, sender: 'agent',
      text: 'O resultado foi entregue. Como foi sua experiência? Deixe uma nota de 1 a 5 estrelas.',
      time: horaPainel(), type: 'avaliacao-card'
    }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // Conclui tarefas operacionais ligadas ao mesmo caso/cliente. Desde
  // 18/08/2026, tarefas vivem na tabela `tarefas` (histórico em
  // `tarefas_historico`), não mais em configuracoes.tarefas — o painel novo
  // (area-contador-next) só lê da tabela. Ver
  // PADRAO-SISTEMA-E-MIGRACAO-AREA-CLIENTE.md.
  const { data: tarefasAbertas } = await admin.from('tarefas').select('id, caso_ref, cliente_ref, texto')
    .eq('feita', false).eq('excluida', false)
    .or(`caso_ref.eq.${casoRef},and(caso_ref.is.null,cliente_ref.eq.${cliente.id})`);
  for (const tarefa of (tarefasAbertas || [])) {
    if (tarefa.caso_ref !== casoRef && !/concluir serviço|relatório/i.test(tarefa.texto || '')) continue;
    await admin.from('tarefas').update({ feita: true, caso_ref: casoRef, updated_at: new Date().toISOString() }).eq('id', tarefa.id);
    await admin.from('tarefas_historico').insert({ tarefa_id: tarefa.id, ator_id: null, evento: 'concluida' });
  }

  res.json({ ok: true, reportId, caseRef: casoRef, channels: canaisEntregues, warnings: falhas });
}

module.exports = async (req, res) => {
  if (req.query.acao === 'validar-relatorio') return validarRelatorioPublico(req, res);
  if (req.query.acao === 'govbr-vault') return govbrVault(req, res);
  if (req.query.acao === 'marcar-lidas') return marcarMensagensLidas(req, res);
  if (req.query.acao === 'atualizar-status') return atualizarStatusAtendimento(req, res);
  if (req.query.acao === 'mover-etapa-kanban') return moverEtapaKanban(req, res);
  if (req.query.acao === 'atualizar-atendimento-express') return atualizarAtendimentoExpress(req, res);
  if (req.query.acao === 'salvar-config') return salvarConfiguracoesPainel(req, res);
  if (req.query.acao === 'finalizar-pos-atendimento') return finalizarPosAtendimento(req, res);
  if (req.query.acao === 'registrar-evento-funil') return registrarEventoPublico(req, res);
  if (req.query.acao === 'registrar-erro') return registrarErroPublico(req, res);
  if (req.query.acao === 'enviar-contato') return enviarContatoPublico(req, res);
  if (req.query.acao === 'erros-operacionais') return errosOperacionais(req, res);
  if (req.query.acao === 'metricas-funil') return metricasFunil(req, res);
  if (req.query.acao === 'servicos-municipais') return statusServicosMunicipais(req, res);

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  if (req.query.cobrancaId) return statusCobranca(req, res, admin);
  if (req.query.codigo) return statusCredito(req, res, admin);
  res.status(400).json({ error: 'invalid_params' });
};
