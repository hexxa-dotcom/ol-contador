// ============================================================================
// oc-data.js — Camada de dados do navegador (Supabase direto + Realtime + Auth)
//
// Estratégia da migração: em vez de reescrever as ~28 chamadas fetch/socket das
// páginas, este arquivo intercepta window.fetch para as rotas /api/* e as resolve
// direto no Supabase (com o token do usuário logado; o RLS garante a segurança).
// O chat usa Realtime nativo (sem servidor no meio). Só operações com CHAVE SECRETA
// (IA/Groq, Asaas, avisos) continuam sendo funções serverless em /api/* de verdade.
// ============================================================================
const sb = window.sb;

// ---------- helpers ----------
function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function slugify(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function genId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
async function authToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.access_token : null;
}

// ---------------------------------------------------------------------------
// Portal de demonstração sem login. Ele existe só enquanto a opção correspondente
// estiver ligada em config.js: usa um JSON local e nunca consulta nem altera dados
// reais do Supabase. Assim RLS continua fechado durante a fase de testes.
let testClientStore = null;
let testAppointmentsStore = null;
let testNotificationsStore = null;
let testRelatoriosStore = [];
let testAvaliacoesStore = [];
let testCaixaPostalStore = null;
let testHistoricoStore = null;
let testCreditosStore = null;
let testConfigStore = {
  agenda_disponibilidade: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:30'],
  perfil_contador: { name: 'Contador Felipe', crc: 'CRC 00-000000/O-0', tags: 'IRPF, MEI' }
};
const TEST_KEYS = {
  clients: 'oc_demo_clients',
  appointments: 'oc_demo_appointments',
  notifications: 'oc_demo_notifications',
  reports: 'oc_demo_reports',
  ratings: 'oc_demo_ratings',
  config: 'oc_demo_config',
  historico: 'oc_demo_historico',
  creditos: 'oc_demo_creditos',
  caixaPostal: 'oc_demo_caixa_postal'
};
function carregarDemo(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}
function salvarDemo(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}
function testeClienteSemLogin() {
  const cfg = window.OC_CONFIG && window.OC_CONFIG.TESTE_CLIENTE_SEM_LOGIN;
  return window.OC_ROLE === 'cliente' && !!(cfg && cfg.enabled);
}
function testeContadorSemLogin() {
  const cfg = window.OC_CONFIG && window.OC_CONFIG.TESTE_CONTADOR_SEM_LOGIN;
  return window.OC_ROLE === 'contador' && !!(cfg && cfg.enabled);
}
function testeSemLogin() {
  return testeClienteSemLogin() || testeContadorSemLogin();
}
function clienteTesteAtual() {
  try {
    const daUrl = new URLSearchParams(location.search).get('clientId');
    if (daUrl) return daUrl;
  } catch (_) {}
  return (window.OC_CONFIG.TESTE_CLIENTE_SEM_LOGIN || {}).clientId;
}
async function dadosTesteCliente() {
  if (testClientStore) return testClientStore;
  const salvo = carregarDemo(TEST_KEYS.clients, null);
  if (salvo) { testClientStore = salvo; return testClientStore; }
  const res = await fetch('db/clients.json');
  const raw = await res.json();
  testClientStore = JSON.parse(JSON.stringify(raw));
  Object.values(testClientStore).forEach(c => {
    c.messages = (c.messages || []).map((m, i) => ({ ...m, id: m.id || `demo-${c.id}-${i}`, createdAt: m.createdAt || null }));
  });
  salvarDemo(TEST_KEYS.clients, testClientStore);
  return testClientStore;
}
function historicoTeste() {
  if (testHistoricoStore) return testHistoricoStore;
  testHistoricoStore = carregarDemo(TEST_KEYS.historico, []);
  return testHistoricoStore;
}
function creditosTeste() {
  if (testCreditosStore) return testCreditosStore;
  testCreditosStore = carregarDemo(TEST_KEYS.creditos, []);
  return testCreditosStore;
}
function appsTeste() {
  if (testAppointmentsStore) return testAppointmentsStore;
  const salvo = carregarDemo(TEST_KEYS.appointments, null);
  if (salvo) { testAppointmentsStore = salvo; return testAppointmentsStore; }
  const hoje = OCTempo.hojeISO();
  const amanha = OCTempo.amanhaISO();
  testAppointmentsStore = [
    { id: 'demo-appt-1', clientName: 'Ana Silva', date: hoje, time: '10:00', taxType: 'Malha Fina IRPF', status: 'pending', clientRef: 'ana-silva' },
    { id: 'demo-appt-2', clientName: 'Mariana Costa', date: hoje, time: '14:00', taxType: 'Ganho de Capital', status: 'active', clientRef: 'mariana-costa' },
    { id: 'demo-appt-3', clientName: 'Carlos Santos', date: amanha, time: '15:00', taxType: 'Regularização MEI', status: 'pending', clientRef: 'carlos-santos' }
  ];
  salvarDemo(TEST_KEYS.appointments, testAppointmentsStore);
  return testAppointmentsStore;
}
function notisTeste() {
  if (testNotificationsStore) return testNotificationsStore;
  const salvo = carregarDemo(TEST_KEYS.notifications, null);
  if (salvo) { testNotificationsStore = salvo; return testNotificationsStore; }
  testNotificationsStore = [
    { id: 'demo-noti-1', text: 'Ambiente de teste do contador ativado.', time: nowTime(), unread: true, clientRef: null }
  ];
  salvarDemo(TEST_KEYS.notifications, testNotificationsStore);
  return testNotificationsStore;
}
function relatoriosTeste() {
  testRelatoriosStore = carregarDemo(TEST_KEYS.reports, testRelatoriosStore || []);
  return testRelatoriosStore;
}
function avaliacoesTeste() {
  testAvaliacoesStore = carregarDemo(TEST_KEYS.ratings, testAvaliacoesStore || []);
  return testAvaliacoesStore;
}
function caixaPostalTeste() {
  if (testCaixaPostalStore) return testCaixaPostalStore;
  testCaixaPostalStore = carregarDemo(TEST_KEYS.caixaPostal, []);
  return testCaixaPostalStore;
}
function configTeste() {
  testConfigStore = carregarDemo(TEST_KEYS.config, testConfigStore);
  return testConfigStore;
}
async function routeTesteCliente(path, method, q, body) {
  const data = await dadosTesteCliente();
  const clientId = (body && body.clientId) || q.get('clientId') || clienteTesteAtual();
  const client = data[clientId];
  if (path === '/api/clients' && method === 'GET') return jsonResponse(data);
  if (path === '/api/clients/status' && method === 'POST' && client) {
    const allowed = ['pending', 'active', 'docs', 'ready', 'locked', 'done'];
    if (!allowed.includes(body.status)) return jsonResponse({ error: 'invalid_status' }, 400);
    client.status = body.status;
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(client);
  }
  if (path === '/api/messages' && method === 'POST' && client) {
    const msg = { ...body.message, id: genId(), createdAt: new Date().toISOString() };
    client.messages = client.messages || []; client.messages.push(msg);
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(client);
  }
  if (path === '/api/prontuario' && method === 'POST' && client) {
    ['phone', 'email', 'cep', 'cidade', 'endereco', 'numero', 'bairro', 'estado'].forEach(campo => {
      if (body[campo] !== undefined) client[campo] = body[campo] || null;
    });
    if (body.perfilOperacional !== undefined) client.perfilOperacional = body.perfilOperacional || {};
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(client);
  }
  if (path === '/api/triagem' && method === 'GET') return jsonResponse(client && client.triagem || null);
  if (path === '/api/triagem' && method === 'POST' && client) {
    client.triagem = { id: 'triagem-demo', clientRef: clientId, assunto: body.assunto || null,
      descricao: body.descricao || null, respostas: body.respostas || {}, status: body.enviar ? 'enviada' : 'rascunho' };
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(client.triagem);
  }
  if (path === '/api/documentos' && method === 'GET') return jsonResponse(client && client.documentos || []);
  if (path === '/api/documentos' && method === 'POST' && client) {
    const doc = { id: genId(), clientRef: clientId, fileName: body.fileName, mime: body.mime,
      size: body.dataBase64 ? body.dataBase64.length : 0, uploadedBy: body.uploadedBy || 'client',
      createdAt: new Date().toISOString(), url: null };
    client.documentos = client.documentos || []; client.documentos.unshift(doc);
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(doc);
  }
  if (path === '/api/appointments' && method === 'GET') return jsonResponse(appsTeste());
  if (path === '/api/relatorios' && method === 'GET') {
    return jsonResponse(relatoriosTeste().filter(r => r.clientRef === clientId && (!r.status || r.status === 'entregue')));
  }
  if (path === '/api/avaliacoes' && method === 'GET') {
    return jsonResponse(avaliacoesTeste().filter(a => a.clientRef === clientId));
  }
  if (path === '/api/avaliacoes' && method === 'POST') {
    const a = { id: 'demo-aval-' + Date.now(), clientRef: body.clientId, relatorioId: body.relatorioId || null, casoRef: body.casoRef || null,
      nota: body.nota, comentario: body.comentario || null, createdAt: new Date().toISOString() };
    avaliacoesTeste().unshift(a);
    salvarDemo(TEST_KEYS.ratings, testAvaliacoesStore);
    return jsonResponse({ id: a.id, nota: a.nota });
  }
  if (path === '/api/agenda-fiscal' && method === 'GET') return jsonResponse([]);
  if (path === '/api/servicos' && method === 'GET') return jsonResponse([
    { id: 'irpf', name: 'Consulta IRPF', description: 'Atendimento para declaração, malha fina e pendências de CPF.', price: 197, priceCents: 19700, recurrence: 'once', active: true },
    { id: 'mei', name: 'Regularização MEI', description: 'Orientação para DAS, declaração anual e pendências do MEI.', price: 147, priceCents: 14700, recurrence: 'once', active: true }
  ]);
  if (path === '/api/config' && method === 'GET') return jsonResponse({});
  if (path === '/api/caixa-postal' && method === 'GET') {
    return jsonResponse(caixaPostalTeste().filter(m => m.clientRef === clientId));
  }
  if (path === '/api/caixa-postal' && method === 'POST') {
    const m = { id: 'demo-cp-' + Date.now(), clientRef: body.clienteId, remetente: body.remetente === 'cliente' ? 'cliente' : 'contador',
      assunto: body.assunto || null, mensagem: body.mensagem, lida: false, createdAt: new Date().toISOString() };
    caixaPostalTeste().push(m);
    salvarDemo(TEST_KEYS.caixaPostal, testCaixaPostalStore);
    return jsonResponse(m);
  }
  if (path === '/api/caixa-postal/marcar-lida' && method === 'POST') {
    const contrario = body.remetente === 'cliente' ? 'contador' : 'cliente';
    caixaPostalTeste().forEach(m => { if (m.clientRef === body.clienteId && m.remetente === contrario) m.lida = true; });
    salvarDemo(TEST_KEYS.caixaPostal, testCaixaPostalStore);
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: 'demo_action_not_available' }, 403);
}
async function routeTesteContador(path, method, q, body) {
  const data = await dadosTesteCliente();
  const apps = appsTeste();
  const notis = notisTeste();

  if (path === '/api/clients' && method === 'GET') return jsonResponse(data);
  if (path === '/api/clients/status' && method === 'POST') {
    const allowed = ['pending', 'active', 'docs', 'ready', 'locked', 'done'];
    if (!body.clientId || !allowed.includes(body.status)) return jsonResponse({ error: 'invalid_status' }, 400);
    if (data[body.clientId]) {
      data[body.clientId].status = body.status;
      if (body.status === 'done') {
        const c = data[body.clientId];
        const agora = new Date();
        c.ultimoFinalizadoEm = agora.toISOString();
        const primeiraDoCliente = (c.messages || []).find(m => m.sender === 'client' && m.createdAt);
        const inicio = new Date((primeiraDoCliente && primeiraDoCliente.createdAt) || agora);
        historicoTeste().unshift({
          id: 'demo-hist-' + Date.now(), clienteId: body.clientId, clienteNome: c.name,
          taxType: c.taxType, finalizadoEm: c.ultimoFinalizadoEm, iniciadoEm: inicio.toISOString(),
          duracaoSegundos: Math.max(0, Math.round((agora - inicio) / 1000)), honorarios: c.honorarios || 0,
          notas: c.notas || null
        });
        salvarDemo(TEST_KEYS.historico, testHistoricoStore);
        c.notas = null;
      }
    }
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(data[body.clientId] || {});
  }
  if (path === '/api/atendimentos-historico' && method === 'GET') {
    const lista = historicoTeste();
    const filtroCliente = q.get('clientId');
    return jsonResponse(filtroCliente ? lista.filter(h => h.clienteId === filtroCliente) : lista);
  }
  if (path === '/api/messages' && method === 'POST' && data[body.clientId]) {
    const msg = { ...body.message, id: body.message.id || genId(), createdAt: new Date().toISOString() };
    data[body.clientId].messages = data[body.clientId].messages || [];
    data[body.clientId].messages.push(msg);
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(data[body.clientId]);
  }
  if (path === '/api/prontuario' && method === 'POST' && data[body.clientId]) {
    const c = data[body.clientId];
    Object.assign(c, {
      diagnosis: body.diagnosis !== undefined ? body.diagnosis : c.diagnosis,
      honorarios: body.honorarios !== undefined ? parseInt(body.honorarios) || 0 : c.honorarios,
      treatment: body.treatment !== undefined ? body.treatment : c.treatment,
      evidences: body.evidences !== undefined ? body.evidences : c.evidences,
      notas: body.notas !== undefined ? body.notas : c.notas
    });
    ['phone', 'email', 'cep', 'cidade', 'endereco', 'numero', 'bairro', 'estado'].forEach(campo => {
      if (body[campo] !== undefined) c[campo] = body[campo] || null;
    });
    if (body.perfilOperacional !== undefined) c.perfilOperacional = body.perfilOperacional || {};
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(c);
  }
  if (path === '/api/checklist' && method === 'POST' && data[body.clientId]) {
    data[body.clientId].checklist = data[body.clientId].checklist || {};
    data[body.clientId].checklist[body.docName] = !!body.isChecked;
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(data[body.clientId]);
  }

  if (path === '/api/appointments' && method === 'GET') return jsonResponse(apps);
  if (path === '/api/appointments' && method === 'POST') {
    const app = { id: 'demo-appt-' + Date.now(), clientName: body.clientName, date: body.date, time: body.time,
      taxType: body.taxType || '', status: body.status || 'pending', clientRef: body.clientRef || null };
    apps.push(app);
    salvarDemo(TEST_KEYS.appointments, apps);
    return jsonResponse(app);
  }
  if (path === '/api/appointments/done' && method === 'POST') {
    apps.forEach(a => { if (String(a.id) === String(body.id) || a.clientRef === body.clientRef) a.status = 'done'; });
    salvarDemo(TEST_KEYS.appointments, apps);
    return jsonResponse({ ok: true });
  }
  if (path === '/api/appointments' && method === 'DELETE') {
    const id = q.get('id');
    const i = apps.findIndex(a => String(a.id) === String(id));
    if (i !== -1) apps.splice(i, 1);
    salvarDemo(TEST_KEYS.appointments, apps);
    return jsonResponse({ ok: true });
  }

  if (path === '/api/notifications' && method === 'GET') return jsonResponse(notis);
  if (path === '/api/notifications' && method === 'POST') {
    const n = { id: 'demo-noti-' + Date.now(), text: body.text, time: nowTime(), unread: true, clientRef: body.clientRef || null };
    notis.unshift(n);
    salvarDemo(TEST_KEYS.notifications, notis);
    return jsonResponse(n);
  }
  if (path === '/api/notifications/read-all' && method === 'POST') {
    notis.forEach(n => { n.unread = false; });
    salvarDemo(TEST_KEYS.notifications, notis);
    return jsonResponse({ ok: true });
  }
  if (path === '/api/notifications' && method === 'DELETE') {
    if (q.get('clear') === 'all') notis.splice(0, notis.length);
    else {
      const i = notis.findIndex(n => String(n.id) === String(q.get('id')));
      if (i !== -1) notis.splice(i, 1);
    }
    salvarDemo(TEST_KEYS.notifications, notis);
    return jsonResponse({ ok: true });
  }

  if (path === '/api/caixa-postal' && method === 'GET') {
    const clienteId = q.get('clientId');
    const lista = clienteId ? caixaPostalTeste().filter(m => m.clientRef === clienteId) : caixaPostalTeste();
    return jsonResponse(lista);
  }
  if (path === '/api/caixa-postal' && method === 'POST') {
    const m = { id: 'demo-cp-' + Date.now(), clientRef: body.clienteId, remetente: body.remetente === 'cliente' ? 'cliente' : 'contador',
      assunto: body.assunto || null, mensagem: body.mensagem, lida: false, createdAt: new Date().toISOString() };
    caixaPostalTeste().push(m);
    salvarDemo(TEST_KEYS.caixaPostal, testCaixaPostalStore);
    return jsonResponse(m);
  }
  if (path === '/api/caixa-postal/marcar-lida' && method === 'POST') {
    const contrario = body.remetente === 'cliente' ? 'contador' : 'cliente';
    caixaPostalTeste().forEach(m => { if (m.clientRef === body.clienteId && m.remetente === contrario) m.lida = true; });
    salvarDemo(TEST_KEYS.caixaPostal, testCaixaPostalStore);
    return jsonResponse({ ok: true });
  }

  if (path === '/api/documentos' && method === 'GET') return jsonResponse((data[q.get('clientId')] || {}).documentos || []);
  if (path === '/api/triagem' && method === 'GET') return jsonResponse((data[q.get('clientId')] || {}).triagem || null);
  if (path === '/api/triagem/aplicar' && method === 'POST' && data[body.clientId]) {
    if (body.diagnosis) data[body.clientId].diagnosis = body.diagnosis;
    if (body.checklist) data[body.clientId].checklist = body.checklist;
    salvarDemo(TEST_KEYS.clients, data);
    return jsonResponse(data[body.clientId]);
  }
  if (path === '/api/triagem/arquivar' && method === 'POST') {
    if (data[body.clientId] && data[body.clientId].triagem) {
      data[body.clientId].triagem.status = 'arquivada';
      salvarDemo(TEST_KEYS.clients, data);
    }
    return jsonResponse({ ok: true });
  }

  if (path === '/api/relatorios' && method === 'GET') {
    const filtroCliente = q.get('clientId');
    return jsonResponse(filtroCliente ? relatoriosTeste().filter(r => r.clientRef === filtroCliente) : relatoriosTeste());
  }
  if (path === '/api/relatorios' && method === 'POST') {
    let rel = body.reportId ? relatoriosTeste().find(r => String(r.id) === String(body.reportId)) : null;
    if (rel) Object.assign(rel, body, { updatedAt: new Date().toISOString() });
    else {
      rel = { ...body, id: 'demo-rel-' + Date.now(), clientRef: body.clientId,
        tipoRelatorio: body.tipoRelatorio === 'pendencias' ? 'pendencias' : 'atendimento',
        formato: body.formato === 'essencial' ? 'essencial' : 'completo',
        codigoValidacao: 'demo-' + Date.now().toString(36),
        status: body.status || 'entrega_pendente', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      relatoriosTeste().unshift(rel);
    }
    salvarDemo(TEST_KEYS.reports, testRelatoriosStore);
    return jsonResponse(rel);
  }
  if (path === '/api/avaliacoes' && method === 'GET') {
    return jsonResponse(avaliacoesTeste().filter(a => !q.get('clientId') || a.clientRef === q.get('clientId')));
  }
  if (path === '/api/avaliacoes' && method === 'POST') {
    const a = { id: 'demo-aval-' + Date.now(), clientRef: body.clientId, relatorioId: body.relatorioId || null, casoRef: body.casoRef || null,
      nota: body.nota, comentario: body.comentario || null, createdAt: new Date().toISOString() };
    avaliacoesTeste().unshift(a);
    salvarDemo(TEST_KEYS.ratings, testAvaliacoesStore);
    return jsonResponse({ id: a.id, nota: a.nota });
  }
  if (path === '/api/avaliacoes/resumo' && method === 'GET') {
    const notas = avaliacoesTeste().map(a => Number(a.nota)).filter(Boolean);
    const media = notas.length ? notas.reduce((acc, n) => acc + n, 0) / notas.length : null;
    return jsonResponse({ media, total: notas.length });
  }

  if (path === '/api/config' && method === 'GET') return jsonResponse(configTeste());
  if (path === '/api/config' && method === 'POST') {
    Object.assign(configTeste(), body || {});
    salvarDemo(TEST_KEYS.config, testConfigStore);
    return jsonResponse({ ok: true, salvas: Object.keys(body || {}) });
  }
  // Move o card do cliente no Kanban de Acompanhamento. Em modo demo não há
  // e-mail de verdade (não tem RESEND_API_KEY nem cliente real do outro
  // lado) — só grava a etapa, pra o board continuar funcionando na demo.
  if (path === '/api/status' && q.get('acao') === 'mover-etapa-kanban' && method === 'POST') {
    const cfg = configTeste();
    cfg.kanban_etapas = { ...(cfg.kanban_etapas || {}), [body.clientId]: body.status };
    salvarDemo(TEST_KEYS.config, testConfigStore);
    return jsonResponse({ ok: true, status: body.status });
  }
  if (path === '/api/status' && q.get('acao') === 'finalizar-pos-atendimento' && method === 'POST') {
    const rel = relatoriosTeste().find(r => String(r.id) === String(body.reportId));
    if (!rel) return jsonResponse({ error: 'relatorio_not_found' }, 404);
    if (rel.status === 'arquivado_interno') return jsonResponse({ error: 'relatorio_arquivado' }, 409);
    const somentePendencias = rel.tipoRelatorio === 'pendencias';
    const obrigatorios = somentePendencias
      ? ['titulo', 'problema', 'solucao', 'oqueFeito', 'comoFeito', 'pendencias']
      : ['titulo', 'problema', 'solucao', 'oqueFeito'];
    if (obrigatorios.some(campo => !String(rel[campo] || '').trim())) {
      return jsonResponse({ error: 'relatorio_incompleto' }, 422);
    }
    if (rel.status === 'entregue' && !body.retryNotice) {
      return jsonResponse({ ok: true, alreadyDelivered: true, reportId: rel.id,
        caseRef: rel.casoRef, channels: rel.canaisEntrega || ['area_cliente'], warnings: [] });
    }

    const agora = new Date().toISOString();
    const canais = Array.from(new Set(['area_cliente', ...((body.channels || []).filter(c => ['email', 'caixa_postal'].includes(c)))]));
    rel.status = 'entregue';
    rel.entregueEm = rel.entregueEm || agora;
    rel.entreguePor = 'contador@demo';
    rel.canaisEntrega = canais;
    rel.falhaEntrega = null;
    rel.updatedAt = agora;

    const casoRef = rel.casoRef || `relatorio:${rel.id}`;
    if (somentePendencias) {
      salvarDemo(TEST_KEYS.reports, testRelatoriosStore);
      return jsonResponse({ ok: true, reportId: rel.id, caseRef, caseKeptOpen: true, channels: canais, warnings: [] });
    }

    const cliente = data[rel.clientRef];
    if (cliente) {
      cliente.status = 'done';
      cliente.ultimoFinalizadoEm = agora;
      if (cliente.triagem) cliente.triagem.status = 'arquivada';
    }
    const existente = historicoTeste().find(h => h.casoRef === casoRef);
    if (!existente && cliente) {
      historicoTeste().unshift({
        id: 'demo-hist-' + Date.now(), casoRef, relatorioId: rel.id,
        clienteId: cliente.id, clienteNome: cliente.name, taxType: cliente.taxType,
        modalidade: rel.atendimentoExpressId ? 'sem_agendamento' : 'agendado',
        assunto: rel.titulo, iniciadoEm: agora, finalizadoEm: agora,
        duracaoSegundos: 0, honorarios: cliente.honorarios || 0
      });
    }
    const cfg = configTeste();
    cfg.tarefas = (cfg.tarefas || []).map(tarefa => {
      if (tarefa.caseRef === casoRef || (!tarefa.caseRef && tarefa.clientId === rel.clientRef && /concluir serviço|relatório/i.test(tarefa.texto || ''))) {
        return { ...tarefa, feita: true, concluidaEm: agora, caseRef: casoRef };
      }
      return tarefa;
    });
    salvarDemo(TEST_KEYS.reports, testRelatoriosStore);
    salvarDemo(TEST_KEYS.clients, data);
    salvarDemo(TEST_KEYS.historico, testHistoricoStore);
    salvarDemo(TEST_KEYS.config, testConfigStore);
    return jsonResponse({ ok: true, reportId: rel.id, caseRef, channels: canais, warnings: [] });
  }
  if (path === '/api/servicos' && method === 'GET') return jsonResponse([
    { id: 'irpf', name: 'Consulta IRPF', description: 'Atendimento para declaração, malha fina e pendências de CPF.', price: 197, priceCents: 19700, recurrence: 'once', active: true },
    { id: 'mei', name: 'Regularização MEI', description: 'Orientação para DAS, declaração anual e pendências do MEI.', price: 147, priceCents: 14700, recurrence: 'once', active: true }
  ]);
  if (path === '/api/servicos' && method === 'POST') return jsonResponse({ ...body, id: body.id || 'demo-serv-' + Date.now() });
  if (path === '/api/servicos' && method === 'DELETE') return jsonResponse({ ok: true });
  if (path === '/api/cobrancas' && method === 'GET') return jsonResponse([]);
  if (path === '/api/atendimentos-express' && method === 'GET') {
    const cliente = data['ana-silva'] || Object.values(data)[0];
    if (!cliente) return jsonResponse([]);
    const contratado = new Date(); contratado.setHours(contratado.getHours() - 7);
    const prazo = new Date(); prazo.setDate(prazo.getDate() + 2);
    return jsonResponse([{
      id: 'demo-express-1', cobrancaId: 'demo-cob-1', clientRef: cliente.id,
      serviceId: 'irpf', assunto: cliente.triagem?.assunto || 'Regularização fiscal',
      status: 'em_analise', contratadoEm: contratado.toISOString(),
      prazoConclusaoEm: prazo.toISOString(), iniciadoEm: null, concluidoEm: null
    }]);
  }
  if (/^\/api\/atendimentos-express\/.+\/status$/.test(path) && method === 'POST') {
    return jsonResponse({ ok: true, status: body.status });
  }
  if (path === '/api/creditos' && method === 'GET') return jsonResponse(creditosTeste());
  if (path === '/api/creditos' && method === 'POST') {
    const valorCents = Math.round(Number(body.valorCents) || 0);
    if (!valorCents || valorCents < 100) return jsonResponse({ error: 'valor_invalido' }, 400);
    const credito = {
      id: 'demo-cred-' + Date.now(), codigo: gerarCodigoCredito(), valorCents, valor: valorCents / 100,
      status: 'ativo', observacao: String(body.observacao || '').trim() || null, clienteRef: null,
      clienteNome: null, usadoEm: null, criadoPor: 'contador@demo', createdAt: new Date().toISOString()
    };
    creditosTeste().unshift(credito);
    salvarDemo(TEST_KEYS.creditos, testCreditosStore);
    return jsonResponse(credito);
  }
  const mCreditoDemo = path.match(/^\/api\/creditos\/(.+)\/cancelar$/);
  if (mCreditoDemo && method === 'POST') {
    const c = creditosTeste().find(x => String(x.id) === mCreditoDemo[1]);
    if (!c) return jsonResponse({ error: 'credito_not_found' }, 404);
    if (c.status !== 'ativo') return jsonResponse({ error: 'credito_nao_esta_ativo' }, 400);
    c.status = 'cancelado';
    salvarDemo(TEST_KEYS.creditos, testCreditosStore);
    return jsonResponse({ ok: true });
  }
  if (path === '/api/agenda-fiscal' && method === 'GET') return jsonResponse([]);
  // Recorrência mensal envolve dinheiro de verdade (Asaas) — não existe no modo
  // demo, só com login real (mesma regra do /api/checkout).
  if (path === '/api/guias-mensais' && method === 'GET') return jsonResponse([]);
  if (/^\/api\/guias-mensais\/\d+\/concluir$/.test(path) && method === 'POST') return jsonResponse({ ok: true });

  return jsonResponse({ error: 'demo_action_not_available', path }, 403);
}

// ---------- mapeadores DB(snake) -> front(camel) (iguais aos do server antigo) ----------
function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, time: r.time, type: r.type,
    docName: r.doc_name || undefined, duration: r.duration || undefined, diagnosis: r.diagnosis || undefined,
    // createdAt é o horário de verdade (timestamptz). O campo `time` é texto solto
    // ('16:45'), sem data e sem fuso — serve de reserva para linhas antigas, mas
    // quem manda é o createdAt.
    createdAt: r.created_at || null, readAt: r.read_at || null };
}
function iniciaisDoCliente(nome) {
  return String(nome || '?').trim().split(/\s+/).filter(Boolean)
    .map(parte => parte[0]).join('').slice(0, 2).toUpperCase() || '?';
}
function mapClient(r, messages, triagem) {
  return { id: r.id, name: r.name, avatar: String(r.avatar || '').trim() || iniciaisDoCliente(r.name), taxType: r.tax_type, cpf: r.cpf,
    status: r.status, scheduledTime: r.scheduled_time, diagnosis: r.diagnosis,
    honorarios: r.honorarios, treatment: r.treatment, evidences: r.evidences || [],
    checklist: r.checklist || {}, email: r.email || null, phone: r.phone || null,
    recorrente: !!r.recorrente, recorrenteTipo: r.recorrente_tipo || null,
    recorrenteDiaVenc: r.recorrente_dia_venc || null,
    // Radar Fiscal: sinalizador levantado pela varredura semanal da Caixa
    // Postal e o regime que define qual sistema de parcelamento consultar.
    caixaPostalNovas: !!r.caixa_postal_novas,
    caixaPostalChecadaEm: r.caixa_postal_checada_em || null,
    regimeTributario: r.regime_tributario || null,
    ultimoFinalizadoEm: r.ultimo_atendimento_finalizado_em || null,
    sexo: r.sexo || null, cidade: r.cidade || null, estado: r.estado || null,
    cep: r.cep || null, endereco: r.endereco || null, numero: r.numero || null,
    bairro: r.bairro || null, notas: r.notas || null,
    perfilOperacional: r.perfil_operacional || {},
    atendimentoModalidade: r.atendimento_modalidade || 'agendado',
    canalResultado: r.canal_resultado || 'email',
    semAgendamentoRecebidoEm: r.sem_agendamento_recebido_em || null,
    // Onboarding obrigatório pós-pagamento (ver cliente.js) — true só entre a
    // confirmação do pagamento (api/_lib/pagamento.js) e o envio da triagem.
    onboardingPendente: !!r.onboarding_pendente,
    messages: messages || [], triagem: triagem || null };
}
function mapTriagem(r) {
  return { id: r.id, clientRef: r.cliente_ref, assunto: r.assunto, descricao: r.descricao,
    respostas: r.respostas || {}, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at, enviadaAt: r.enviada_at };
}
function mapRelatorio(r) {
  return { id: r.id, clientRef: r.cliente_ref, titulo: r.titulo, problema: r.problema,
    solucao: r.solucao, oqueFeito: r.oque_feito, comoFeito: r.como_feito,
    contadorNome: r.contador_nome, contadorCrc: r.contador_crc,
    contadorLogo: r.contador_logo, contadorAssinatura: r.contador_assinatura,
    clienteNome: r.cliente_nome, clienteCpf: r.cliente_cpf, status: r.status || 'entregue',
    tipoRelatorio: r.tipo_relatorio || 'atendimento',
    formato: r.formato || 'completo', codigoValidacao: r.codigo_validacao || null,
    casoRef: r.caso_ref || null, atendimentoExpressId: r.atendimento_express_id || null,
    agendamentoId: r.agendamento_id || null, versao: r.versao || 1,
    revisaoDe: r.revisao_de || null, pendencias: r.pendencias || null,
    proximosPassos: r.proximos_passos || [],
    responsavelProximoPasso: r.responsavel_proximo_passo || null,
    prazoProximoPasso: r.prazo_proximo_passo || null, entregas: r.entregas || null,
    entregueEm: r.entregue_em || null, entreguePor: r.entregue_por || null,
    canaisEntrega: r.canais_entrega || [], entregaTentativas: r.entrega_tentativas || [],
    falhaEntrega: r.falha_entrega || null, createdAt: r.created_at, updatedAt: r.updated_at || r.created_at };
}
function mapAppointment(r) {
  return { id: r.id, clientName: r.client_name, date: r.date, time: r.time,
    taxType: r.tax_type, status: r.status, clientRef: r.cliente_ref };
}
function mapNotification(r) {
  return { id: r.id, text: r.text, time: r.time, unread: r.unread, clientRef: r.cliente_ref };
}
function mapCaixaPostal(r) {
  return { id: r.id, clientRef: r.cliente_ref, remetente: r.remetente, assunto: r.assunto,
    mensagem: r.mensagem, lida: r.lida, createdAt: r.created_at };
}
function mapServico(r) {
  return { id: r.id, name: r.name, description: r.description, priceCents: r.price_cents,
    price: r.price_cents / 100, recurrence: r.recurrence, active: r.active !== false,
    prazoExpressDiasUteis: Math.max(1, Number(r.prazo_express_dias_uteis) || 2),
    // Serviços que o plano abarca — alimentam a lista do agendamento.
    itens: Array.isArray(r.itens) ? r.itens : [] };
}
function mapCobranca(r) {
  return { id: r.id, clientRef: r.cliente_ref, serviceId: r.servico_id,
    valueCents: r.valor_cents, status: r.status, paidAt: r.paid_at,
    originalValueCents: r.valor_original_cents || r.valor_cents,
    discountCents: r.desconto_cents || 0, discountType: r.desconto_tipo || null,
    origin: r.origem || 'plataforma',
    createdAt: r.created_at, invoiceUrl: r.invoice_url, appointmentId: r.appointment_id,
    dadosCliente: r.dados_cliente || null,
    modalidade: r.modalidade || 'agendado', canalResultado: r.canal_resultado || 'email' };
}
function mapAtendimentoExpress(r) {
  return {
    id: r.id,
    cobrancaId: r.cobranca_id,
    clientRef: r.cliente_ref,
    serviceId: r.servico_id,
    assunto: r.assunto,
    status: r.status,
    contratadoEm: r.contratado_em,
    prazoConclusaoEm: r.prazo_conclusao_em,
    iniciadoEm: r.iniciado_em,
    concluidoEm: r.concluido_em,
    responsavelId: r.responsavel_id || null,
    responsavelNome: r.responsavel_nome || null,
    alertaSlaEm: r.alerta_sla_em || null,
    updatedAt: r.updated_at
  };
}
// O bucket "documentos" é privado (RLS por pasta do cliente) — um public_url
// fixo, salvo no upload, não abre mais depois disso. Por isso o link é
// assinado na hora de listar, sempre com validade curta.
async function signedDocUrl(storagePath) {
  if (!storagePath) return null;
  const { data, error } = await sb.storage.from('documentos').createSignedUrl(storagePath, 3600);
  if (error) { console.error('Falha ao assinar URL do documento:', error); return null; }
  return data.signedUrl;
}
async function mapDocumento(r) {
  return { id: r.id, clientRef: r.cliente_ref, fileName: r.file_name, mime: r.mime,
    size: r.size_bytes, uploadedBy: r.uploaded_by, url: await signedDocUrl(r.storage_path),
    ai: r.ai_extracted || null,
    checklistItem: r.checklist_item || null, createdAt: r.created_at };
}
async function mapRelatorioAnexo(r) {
  const documento = r.documentos || null;
  return {
    id: r.id, reportId: r.relatorio_id, clientRef: r.cliente_ref,
    caseRef: r.caso_ref || null, documentId: r.documento_id || null,
    type: r.tipo || 'arquivo', title: r.titulo, description: r.descricao || null,
    reference: r.referencia || null,
    url: documento?.storage_path ? await signedDocUrl(documento.storage_path) : (r.url || null),
    fileName: documento?.file_name || null, mime: documento?.mime || null,
    size: documento?.size_bytes || null, visibleToClient: r.visivel_cliente !== false,
    createdAt: r.created_at
  };
}
function mapCredito(r) {
  return { id: r.id, codigo: r.codigo, valorCents: r.valor_cents, valor: r.valor_cents / 100,
    status: r.status, observacao: r.observacao, clienteRef: r.cliente_ref,
    clienteNome: r.clientes ? r.clientes.name : null,
    usadoEm: r.usado_em, expiraEm: r.expira_em || null,
    canceladoEm: r.cancelado_em || null, canceladoPor: r.cancelado_por || null,
    criadoPor: r.criado_por, createdAt: r.created_at };
}
// Código legível, sem 0/O/1/I (se confundem ao digitar).
function gerarCodigoCredito() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let cod = '';
  for (let i = 0; i < 8; i++) cod += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return 'OC-' + cod;
}

// ---------- reconstrução de um cliente (com mensagens aninhadas) ----------
// Reconstrói o cliente inteiro. O retorno vira o clientsData do painel, então
// tudo que a tela usa precisa estar aqui — faltar a triagem faria ela sumir do
// prontuário no primeiro envio de mensagem.
async function fetchClient(clientId) {
  const { data: c } = await sb.from('clientes').select('*').eq('id', clientId).single();
  if (!c) return null;
  const [{ data: msgs }, { data: triagemRows }] = await Promise.all([
    sb.from('mensagens').select('*').eq('cliente_id', clientId).order('seq', { ascending: true }),
    sb.from('triagens').select('*').eq('cliente_ref', clientId).neq('status', 'arquivada').order('created_at', { ascending: false }).limit(1)
  ]);
  const triagem = triagemRows && triagemRows.length ? triagemRows[0] : null;
  return mapClient(c, (msgs || []).map(mapMessage), triagem ? mapTriagem(triagem) : null);
}

// ---------- agenda fiscal (lógica pura, no navegador) ----------
function lastDayOfMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
function nextDueDate(ob, from) {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (ob.recurrence === 'monthly') {
    let y = base.getFullYear(), m = base.getMonth();
    for (let i = 0; i < 13; i++) {
      const d = new Date(y, m, Math.min(ob.day_of_month, lastDayOfMonth(y, m)));
      if (d >= base) return d;
      m++; if (m > 11) { m = 0; y++; }
    }
  } else if (ob.recurrence === 'yearly') {
    const m0 = (ob.month || 1) - 1;
    for (let y = base.getFullYear(); y <= base.getFullYear() + 1; y++) {
      const d = new Date(y, m0, Math.min(ob.day_of_month, lastDayOfMonth(y, m0)));
      if (d >= base) return d;
    }
  }
  return null;
}
function appliesTo(ob, taxType) {
  const kw = ob.keywords || [];
  if (!kw.length) return true;
  const t = (taxType || '').toLowerCase();
  return kw.some(k => t.includes(String(k).toLowerCase()));
}
function proximosVencimentos(obrigacoes, taxType) {
  const from = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
  return (obrigacoes || [])
    .filter(ob => ob.active !== false && appliesTo(ob, taxType))
    .map(ob => { const due = nextDueDate(ob, from); return due ? { id: ob.id, title: ob.title, description: ob.description, dueDate: iso(due), daysUntil: days(due), reminderDays: ob.reminder_days } : null; })
    .filter(Boolean)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ============================================================================
// Efeitos de mensagens especiais (paridade com o persistMessage antigo do server).
// Só o contador (staff) roda isto; o cliente insere mensagem simples direto.
// ============================================================================
async function ocSendMessage(clientId, message) {
  const id = message.id || genId();
  const row = {
    id, cliente_id: clientId, sender: message.sender, text: message.text,
    time: message.time || nowTime(), type: message.type || 'internal',
    doc_name: message.docName || null, duration: message.duration || null, diagnosis: message.diagnosis || null
  };
  await sb.from('mensagens').insert(row);

  if (message.type === 'doc-request' || message.type === 'doc-upload') {
    const { data: c } = await sb.from('clientes').select('checklist').eq('id', clientId).single();
    const checklist = (c && c.checklist) || {};
    checklist[message.docName] = (message.type === 'doc-upload');
    await sb.from('clientes').update({ checklist, status: message.type === 'doc-request' ? 'docs' : 'active' }).eq('id', clientId);
  }
  return fetchClient(clientId);
}

// ---------- upload de documento (Storage direto + registro + mensagem no chat) ----------
function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}
// Mesmo limite/whitelist já checados no navegador (cliente.js) — repetidos
// aqui porque quem chama a API direto (sem passar pela tela) pula a checagem
// do JS. Sem isso dava pra subir qualquer tipo/tamanho de arquivo pro bucket.
const MIME_ACEITOS = /^(application\/pdf|image\/png|image\/jpeg)$/;
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
async function uploadDocumento(body) {
  const { clientId, fileName, mime, dataBase64, uploadedBy, checklistItem } = body;
  if (!MIME_ACEITOS.test(mime || '')) { const e = new Error('Formato não aceito. Envie PDF, JPG ou PNG.'); e.code = 'mime_invalido'; throw e; }
  const blob = base64ToBlob(dataBase64, mime);
  if (blob.size > TAMANHO_MAX_BYTES) { const e = new Error('Arquivo maior que 10MB.'); e.code = 'arquivo_grande'; throw e; }
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${clientId}/${Date.now()}_${safe}`;
  const up = await sb.storage.from('documentos').upload(path, blob, { contentType: mime || 'application/octet-stream', upsert: false });
  if (up.error) throw up.error;
  const { data: doc, error } = await sb.from('documentos').insert({
    cliente_ref: clientId, file_name: fileName, storage_path: path, mime: mime || null,
    size_bytes: blob.size, uploaded_by: uploadedBy || 'client',
    checklist_item: checklistItem || null
  }).select().single();
  if (error) throw error;
  // No Atendimento sem agendamento o documento alimenta a triagem/dossiê,
  // mas não abre conversa. Nos atendimentos com horário, preserva a mensagem
  // de documento no chat usada pelo fluxo atual.
  // Quando o anexo veio da triagem, o chat mostra o nome do ITEM ("Notificação da
  // Receita") em vez do nome do arquivo ("IMG_4471.pdf") — o contador lê o que importa.
  const { data: clienteModo } = await sb.from('clientes').select('atendimento_modalidade').eq('id', clientId).maybeSingle();
  if (!clienteModo || clienteModo.atendimento_modalidade !== 'sem_agendamento') {
    await sb.from('mensagens').insert({
      id: genId(), cliente_id: clientId, sender: uploadedBy === 'agent' ? 'agent' : 'client',
      text: `Arquivo enviado: ${fileName}`, time: nowTime(), type: 'doc-upload',
      doc_name: checklistItem || fileName
    });
  }
  // Gatilho automático para a IA ler o documento via Visão Computacional / OCR
  // Disparado no background (sem await) para não atrasar a resposta da triagem.
  fetch(API_BASE + `/api/documentos/${doc.id}/analisar`, { method: 'POST' }).catch(e => console.error('Auto OCR falhou:', e));

  return await mapDocumento(doc);
}

// ============================================================================
// Roteador do adaptador: resolve /api/* localmente (Supabase) ou repassa às
// funções serverless de verdade (as que têm chave secreta).
// ============================================================================
const PASSTHROUGH = [
  /^\/api\/copilot$/,
  /^\/api\/radar-fiscal$/,
  /^\/api\/documentos\/\d+\/analisar$/,
  /^\/api\/checkout$/,
  /^\/api\/checkout\/\d+\/status$/,
  /^\/api\/status$/,
  /^\/api\/recorrencia$/,
  /^\/api\/notify\//,
  /^\/api\/asaas\//,
  /^\/api\/agenda-fiscal\/run-reminders$/
];

async function routeApi(u, init, _fetch) {
  const method = (init.method || 'GET').toUpperCase();
  const path = u.pathname;
  const q = u.searchParams;
  const body = init.body ? JSON.parse(init.body) : null;

  if (testeClienteSemLogin()) return routeTesteCliente(path, method, q, body);
  if (testeContadorSemLogin()) return routeTesteContador(path, method, q, body);

  // Configurações são escritas somente pela equipe. Fazemos a gravação pela
  // rota autenticada do servidor, que valida a equipe antes de usar a chave
  // administrativa; isso evita que uma política RLS inconsistente paralise
  // botões como "Acompanhamento" e "Encerrar".
  if (path === '/api/config' && method === 'POST') {
    const token = await authToken();
    const headers = Object.assign({}, init.headers || {}, token ? { Authorization: 'Bearer ' + token } : {});
    const destino = new URL('/api/status?acao=salvar-config', u.origin);
    return _fetch(destino.href, Object.assign({}, init, {
      headers,
      body: JSON.stringify({ config: body || {} })
    }));
  }

  // ---- repasse p/ funções serverless (injeta o token do usuário) ----
  if (PASSTHROUGH.some(re => re.test(path))) {
    const token = await authToken();
    const headers = Object.assign({}, init.headers || {}, token ? { Authorization: 'Bearer ' + token } : {});
    return _fetch(u.href, Object.assign({}, init, { headers }));
  }

  try {
    // ---------- CLIENTES ----------
    if (path === '/api/clients' && method === 'GET') {
      // As consultas não dependem umas das outras: em série custam a soma,
      // em paralelo custam a mais lenta.
      const [{ data: clients, error: clientesError }, { data: msgs, error: mensagensError }, { data: triagens, error: triagensError }] = await Promise.all([
        sb.from('clientes').select('*'),
        sb.from('mensagens').select('*').order('seq', { ascending: true }),
        sb.from('triagens').select('*').neq('status', 'arquivada').order('created_at', { ascending: true })
      ]);
      // Antes os erros de RLS eram descartados e o painel parecia apenas vazio.
      // Propagar o motivo torna um problema de permissão visível e diagnosticável.
      const erro = clientesError || mensagensError || triagensError;
      if (erro) throw erro;
      const byClient = {};
      (msgs || []).forEach(m => { (byClient[m.cliente_id] = byClient[m.cliente_id] || []).push(mapMessage(m)); });
      const triagemDe = {};
      (triagens || []).forEach(t => { triagemDe[t.cliente_ref] = mapTriagem(t); });
      const out = {};
      (clients || []).forEach(c => { out[c.id] = mapClient(c, byClient[c.id] || [], triagemDe[c.id]); });
      return jsonResponse(out);
    }
  if (path === '/api/clients/status' && method === 'POST') {
      const allowed = ['pending', 'active', 'docs', 'ready', 'locked', 'done'];
      if (!body.clientId || !allowed.includes(body.status)) return jsonResponse({ error: 'invalid_status' }, 400);
      const patch = { status: body.status };
      const finalizando = body.status === 'done' || body.status === 'locked';
      const finalizadoEm = new Date();
      if (finalizando) patch.ultimo_atendimento_finalizado_em = finalizadoEm.toISOString();
      // As anotações do atendimento migram para o histórico na finalização, então
      // o rascunho volta vazio para o próximo caso do mesmo cliente.
      if (finalizando) patch.notas = null;
      const { data: atualizado, error } = await sb.from('clientes').update(patch).eq('id', body.clientId).select('id,name,tax_type,honorarios,created_at,notas').single();
      if (error) throw error;
      // Um registro por finalização — vira o histórico permanente (aba Insights
      // e timeline por cliente), diferente de ultimo_atendimento_finalizado_em
      // que só guarda a mais recente.
      // Duração = da 1ª mensagem do cliente até a finalização (tempo de calendário,
      // não tempo de tela ativa — o cronômetro do chat reseta a cada reload/troca).
      if (finalizando && atualizado) {
        const { data: primeiraMsg } = await sb.from('mensagens').select('created_at')
          .eq('cliente_id', body.clientId).eq('sender', 'client')
          .order('created_at', { ascending: true }).limit(1).maybeSingle();
        const inicio = new Date((primeiraMsg && primeiraMsg.created_at) || atualizado.created_at);
        const duracaoSegundos = Math.max(0, Math.round((finalizadoEm - inicio) / 1000));
        await sb.from('atendimentos_historico').insert({
          cliente_id: atualizado.id, cliente_nome: atualizado.name, tax_type: atualizado.tax_type,
          duracao_segundos: duracaoSegundos, honorarios: atualizado.honorarios || 0,
          iniciado_em: inicio.toISOString(), notas: atualizado.notas || null
        }).catch(() => {});
      }
      return jsonResponse(await fetchClient(body.clientId));
    }

    // ---------- HISTÓRICO DE ATENDIMENTOS (Insights + timeline por cliente) ----------
    // Sem clientId: visão geral (Insights). Com clientId: só os atendimentos
    // daquele cliente, usado na aba Clientes para montar a timeline de cada caso.
    if (path === '/api/atendimentos-historico' && method === 'GET') {
      let query = sb.from('atendimentos_historico').select('*').order('finalizado_em', { ascending: false });
      if (q.get('clientId')) query = query.eq('cliente_id', q.get('clientId'));
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse((data || []).map(r => ({
        id: r.id, clienteId: r.cliente_id, clienteNome: r.cliente_nome, taxType: r.tax_type,
        finalizadoEm: r.finalizado_em, iniciadoEm: r.iniciado_em, duracaoSegundos: r.duracao_segundos,
        honorarios: r.honorarios, notas: r.notas || null, casoRef: r.caso_ref || null,
        relatorioId: r.relatorio_id || null, modalidade: r.modalidade || null, assunto: r.assunto || null
      })));
    }

    // ---------- MENSAGENS ----------
    if (path === '/api/messages' && method === 'POST') {
      const client = await ocSendMessage(body.clientId, body.message);
      return jsonResponse(client);
    }

    // ---------- PRONTUÁRIO (também usado pela aba Cadastro do CRM: mesmo
    // "patch parcial na linha do cliente", só que os campos são endereço/
    // contato em vez de diagnóstico/tratamento) ----------
    if (path === '/api/prontuario' && method === 'POST') {
      const patch = {};
      if (body.diagnosis !== undefined) patch.diagnosis = body.diagnosis;
      if (body.honorarios !== undefined) patch.honorarios = parseInt(body.honorarios) || 0;
      if (body.treatment !== undefined) patch.treatment = body.treatment;
      if (body.evidences !== undefined) patch.evidences = body.evidences;
      if (body.notas !== undefined) patch.notas = body.notas;
      ['phone', 'email', 'cep', 'cidade', 'endereco', 'numero', 'bairro', 'estado'].forEach(campo => {
        if (body[campo] !== undefined) patch[campo] = body[campo] || null;
      });
      if (body.perfilOperacional !== undefined) patch.perfil_operacional = body.perfilOperacional || {};
      await sb.from('clientes').update(patch).eq('id', body.clientId);
      return jsonResponse(await fetchClient(body.clientId));
    }

    // ---------- CHECKLIST ----------
    if (path === '/api/checklist' && method === 'POST') {
      const { data: c } = await sb.from('clientes').select('checklist').eq('id', body.clientId).single();
      const checklist = (c && c.checklist) || {};
      checklist[body.docName] = !!body.isChecked;
      await sb.from('clientes').update({ checklist }).eq('id', body.clientId);
      return jsonResponse(await fetchClient(body.clientId));
    }

    // ---------- APPOINTMENTS ----------
    if (path === '/api/appointments' && method === 'GET') {
      const { data } = await sb.from('agendamentos').select('*').order('id', { ascending: true });
      return jsonResponse((data || []).map(mapAppointment));
    }
    if (path === '/api/appointments' && method === 'POST') {
      const { data } = await sb.from('agendamentos').insert({
        client_name: body.clientName, date: body.date, time: body.time,
        tax_type: body.taxType || '', status: body.status || 'pending',
        cliente_ref: body.clientRef || null
      }).select().single();
      return jsonResponse(mapAppointment(data));
    }
    if (path === '/api/appointments/done' && method === 'POST') {
      let query = sb.from('agendamentos').update({ status: 'done' });
      if (body.id !== undefined) query = query.eq('id', body.id);
      else query = query.eq('cliente_ref', body.clientRef);
      await query;
      return jsonResponse({ ok: true });
    }
    if (path === '/api/appointments' && method === 'DELETE') {
      await sb.from('agendamentos').delete().eq('id', parseInt(q.get('id')));
      return jsonResponse({ ok: true });
    }

    // ---------- NOTIFICATIONS ----------
    if (path === '/api/notifications' && method === 'GET') {
      const { data } = await sb.from('notificacoes').select('*').order('id', { ascending: false });
      return jsonResponse((data || []).map(mapNotification));
    }
    if (path === '/api/notifications' && method === 'POST') {
      const { data } = await sb.from('notificacoes').insert({
        text: body.text, time: nowTime(), unread: true, cliente_ref: body.clientRef || null
      }).select().single();
      return jsonResponse(mapNotification(data));
    }
    if (path === '/api/notifications/read-all' && method === 'POST') {
      await sb.from('notificacoes').update({ unread: false }).eq('unread', true);
      return jsonResponse({ ok: true });
    }
    if (path === '/api/notifications' && method === 'DELETE') {
      if (q.get('clear') === 'all') await sb.from('notificacoes').delete().gt('id', 0);
      else await sb.from('notificacoes').delete().eq('id', parseInt(q.get('id')));
      return jsonResponse({ ok: true });
    }

    // ---------- CAIXA POSTAL (mensagens contador ↔ cliente, fora do chat ao vivo) ----------
    // Sem clientId: visão geral do contador (todas as caixas, mais recente primeiro).
    // Com clientId: a thread de um cliente (ordem cronológica, como um chat) — usado
    // tanto pelo contador ao abrir uma conversa quanto pelo próprio cliente na área dele.
    if (path === '/api/caixa-postal' && method === 'GET') {
      const clienteId = q.get('clientId');
      let query = sb.from('caixa_postal').select('*');
      query = clienteId ? query.eq('cliente_ref', clienteId).order('created_at', { ascending: true })
                        : query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse((data || []).map(mapCaixaPostal));
    }
    if (path === '/api/caixa-postal' && method === 'POST') {
      if (!body.clienteId || !body.mensagem) return jsonResponse({ error: 'invalid_params' }, 400);
      const { data, error } = await sb.from('caixa_postal').insert({
        cliente_ref: body.clienteId, remetente: body.remetente === 'cliente' ? 'cliente' : 'contador',
        assunto: body.assunto || null, mensagem: body.mensagem, lida: false
      }).select().single();
      if (error) throw error;
      return jsonResponse(mapCaixaPostal(data));
    }
    // Marca como lida tudo que veio do OUTRO lado — quem abre a thread (contador
    // vendo o que o cliente escreveu, ou vice-versa) é quem "lê", nunca as próprias mensagens.
    if (path === '/api/caixa-postal/marcar-lida' && method === 'POST') {
      const remetenteContrario = body.remetente === 'cliente' ? 'contador' : 'cliente';
      const { error } = await sb.from('caixa_postal').update({ lida: true })
        .eq('cliente_ref', body.clienteId).eq('remetente', remetenteContrario).eq('lida', false);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ---------- DOCUMENTOS (lista + upload; a leitura por IA é passthrough) ----------
    if (path === '/api/documentos' && method === 'GET') {
      const { data } = await sb.from('documentos').select('*').eq('cliente_ref', q.get('clientId')).order('created_at', { ascending: false });
      return jsonResponse(await Promise.all((data || []).map(mapDocumento)));
    }
    if (path === '/api/documentos' && method === 'POST') {
      return jsonResponse(await uploadDocumento(body));
    }

    // ---------- TRIAGEM (pré-atendimento) ----------
    if (path === '/api/triagem' && method === 'GET') {
      const { data: triagemRows } = await sb.from('triagens').select('*')
        .eq('cliente_ref', q.get('clientId')).neq('status', 'arquivada').order('created_at', { ascending: false }).limit(1);
      const data = triagemRows && triagemRows.length ? triagemRows[0] : null;
      return jsonResponse(data ? mapTriagem(data) : null);
    }

    // Salva o rascunho e, com body.enviar, entrega ao contador. É o mesmo endpoint
    // porque é a mesma linha: enviar não é criar nada novo, é mudar de status.
    if (path === '/api/triagem' && method === 'POST') {
      const patch = {
        cliente_ref: body.clientId,
        assunto: body.assunto || null,
        descricao: body.descricao || null,
        respostas: body.respostas || {}
      };
      const { data: triagemRows } = await sb.from('triagens').select('id, status, enviada_at')
        .eq('cliente_ref', body.clientId).neq('status', 'arquivada').order('created_at', { ascending: false }).limit(1);
      const aberta = triagemRows && triagemRows.length ? triagemRows[0] : null;

      if (body.enviar) {
        patch.status = 'enviada';
        // enviada_at marca a PRIMEIRA entrega. Complementar depois não reescreve
        // esse instante, senão o contador perderia a noção de quando o caso chegou.
        if (!aberta || !aberta.enviada_at) patch.enviada_at = new Date().toISOString();
      }

      let linha;
      if (aberta) {
        const { data, error } = await sb.from('triagens').update(patch).eq('id', aberta.id).select().single();
        if (error) throw error;
        linha = data;
      } else {
        const { data, error } = await sb.from('triagens').insert(patch).select().single();
        if (error) throw error;
        linha = data;
      }
      if (body.enviar) {
        // Libera o onboarding obrigatório pós-pagamento (ver cliente.js). O
        // RLS de clientes só deixa staff atualizar a linha, então isto passa
        // por uma função SECURITY DEFINER restrita a apagar a própria flag
        // (scripts/onboarding-pendente.sql) — nunca um update direto na tabela.
        await sb.rpc('concluir_onboarding_cliente');
        // O envio da triagem é a entrada formal do caso na mesa do contador.
        // Atualiza somente as contratações ainda esperando essa etapa.
        await sb.rpc('confirmar_triagem_atendimento_express');
      }
      return jsonResponse(mapTriagem(linha));
    }

    // Só o contador chega aqui: é ele quem transforma a hipótese da triagem em
    // prontuário. O RLS de clientes já barra o cliente (update = is_staff), então
    // isto é conveniência do painel, não a trava de segurança.
    if (path === '/api/triagem/aplicar' && method === 'POST') {
      const patch = {};
      if (body.diagnosis) patch.diagnosis = body.diagnosis;
      if (body.checklist) patch.checklist = body.checklist;
      const { error } = await sb.from('clientes').update(patch).eq('id', body.clientId);
      if (error) throw error;
      return jsonResponse(await fetchClient(body.clientId));
    }

    // Encerrado o serviço, a triagem sai de cena — mas fica no banco: é o registro
    // do que o cliente relatou. A próxima demanda dele abre uma triagem nova.
    if (path === '/api/triagem/arquivar' && method === 'POST') {
      await sb.from('triagens').update({ status: 'arquivada' })
        .eq('cliente_ref', body.clientId).neq('status', 'arquivada');
      return jsonResponse({ ok: true });
    }

    // ---------- RELATÓRIOS ----------
    // Sem clientId: todos os relatórios (fila "Aguardando Relatório" e o
    // histórico "Relatórios Finalizados", na aba Relatórios do contador). Com
    // clientId: só os daquele cliente (dossiê). O RLS entrega só o que a
    // pessoa pode ver: o contador vê todos, o cliente só os seus.
    if (path === '/api/relatorios' && method === 'GET') {
      let query = sb.from('relatorios').select('*').order('created_at', { ascending: false });
      if (q.get('clientId')) query = query.eq('cliente_ref', q.get('clientId'));
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse((data || []).map(mapRelatorio));
    }

    // Grava o documento como pendente de entrega. Enquanto não houver confirmação
    // da rota segura de finalização, o RLS não deixa o cliente enxergá-lo.
    // Um documento pendente pode ser atualizado pelo próprio wizard, evitando
    // versões duplicadas a cada tentativa de envio.
    if (path === '/api/relatorios' && method === 'POST') {
      // Nome e documento são uma fotografia do cadastro no momento da emissão.
      // Não aceitamos esses dois dados do navegador, evitando abreviações ou
      // um CPF/CNPJ diferente do titular selecionado.
      const { data: titular, error: titularError } = await sb.from('clientes')
        .select('name,cpf').eq('id', body.clientId).maybeSingle();
      if (titularError) throw titularError;
      if (!titular) return jsonResponse({ error: 'cliente_not_found' }, 404);
      const patch = {
        cliente_ref: body.clientId, titulo: body.titulo || null,
        problema: body.problema || null, solucao: body.solucao || null,
        oque_feito: body.oqueFeito || null, como_feito: body.comoFeito || null,
        contador_nome: body.contadorNome || null, contador_crc: body.contadorCrc || null,
        contador_logo: body.contadorLogo || null, contador_assinatura: body.contadorAssinatura || null,
        cliente_nome: titular.name || null, cliente_cpf: titular.cpf || null,
        tipo_relatorio: body.tipoRelatorio === 'pendencias' ? 'pendencias' : 'atendimento',
        formato: body.formato === 'essencial' ? 'essencial' : 'completo',
        caso_ref: body.casoRef || null, atendimento_express_id: body.atendimentoExpressId || null,
        agendamento_id: body.agendamentoId || null, status: body.status || 'entrega_pendente',
        versao: Math.max(1, Number(body.versao) || 1), revisao_de: body.revisaoDe || null,
        pendencias: body.pendencias || null,
        proximos_passos: Array.isArray(body.proximosPassos) ? body.proximosPassos : [],
        responsavel_proximo_passo: body.responsavelProximoPasso || null,
        prazo_proximo_passo: body.prazoProximoPasso || null, entregas: body.entregas || null,
        updated_at: new Date().toISOString()
      };
      const query = body.reportId
        ? sb.from('relatorios').update(patch).eq('id', body.reportId).neq('status', 'entregue')
        : sb.from('relatorios').insert(patch);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return jsonResponse(mapRelatorio(data));
    }

    // Arquivos, guias e protocolos ficam fora do PDF de uma página. Eles são
    // entregues como um conjunto separado, com links curtos para o bucket privado.
    if (path === '/api/relatorio-anexos' && method === 'GET') {
      const reportId = q.get('relatorioId');
      if (!reportId) return jsonResponse({ error: 'relatorio_id_obrigatorio' }, 400);
      const { data, error } = await sb.from('relatorio_anexos')
        .select('*,documentos(id,file_name,storage_path,mime,size_bytes)')
        .eq('relatorio_id', reportId).order('created_at');
      if (error) throw error;
      return jsonResponse(await Promise.all((data || []).map(mapRelatorioAnexo)));
    }
    if (path === '/api/relatorio-anexos' && method === 'POST') {
      const reportId = Number(body.relatorioId);
      if (!reportId || !Array.isArray(body.anexos)) return jsonResponse({ error: 'invalid_params' }, 400);
      const { data: relatorio, error: relatorioError } = await sb.from('relatorios')
        .select('id,cliente_ref,caso_ref,status').eq('id', reportId).maybeSingle();
      if (relatorioError) throw relatorioError;
      if (!relatorio) return jsonResponse({ error: 'relatorio_not_found' }, 404);
      if (relatorio.status === 'entregue') return jsonResponse({ error: 'relatorio_ja_entregue' }, 409);

      const idsDocumentos = [...new Set(body.anexos.map(a => Number(a.documentId)).filter(Boolean))];
      let documentosValidos = new Set();
      if (idsDocumentos.length) {
        const { data: docs, error: docsError } = await sb.from('documentos').select('id')
          .eq('cliente_ref', relatorio.cliente_ref).in('id', idsDocumentos);
        if (docsError) throw docsError;
        documentosValidos = new Set((docs || []).map(d => Number(d.id)));
        if (documentosValidos.size !== idsDocumentos.length) return jsonResponse({ error: 'documento_invalido' }, 400);
      }
      const linhas = body.anexos.slice(0, 30).map(a => {
        const documentId = Number(a.documentId) || null;
        const url = String(a.url || '').trim() || null;
        const title = String(a.title || a.fileName || '').trim().slice(0, 160);
        if (!title || (url && !/^https?:\/\//i.test(url))) throw new Error('anexo_invalido');
        return {
          relatorio_id: reportId, cliente_ref: relatorio.cliente_ref,
          caso_ref: relatorio.caso_ref || null, documento_id: documentId,
          tipo: ['arquivo','guia','protocolo','comprovante','link','outro'].includes(a.type) ? a.type : 'arquivo',
          titulo: title, descricao: String(a.description || '').trim().slice(0, 500) || null,
          referencia: String(a.reference || '').trim().slice(0, 160) || null,
          url, visivel_cliente: a.visibleToClient !== false
        };
      });
      const { error: deleteError } = await sb.from('relatorio_anexos').delete().eq('relatorio_id', reportId);
      if (deleteError) throw deleteError;
      if (linhas.length) {
        const { error: insertError } = await sb.from('relatorio_anexos').insert(linhas);
        if (insertError) throw insertError;
      }
      return jsonResponse({ ok: true, total: linhas.length });
    }

    // ---------- AVALIAÇÃO PÓS-ATENDIMENTO ----------
    // O cliente pergunta se já avaliou (para não pedir nota duas vezes).
    if (path === '/api/avaliacoes' && method === 'GET') {
      const { data } = await sb.from('avaliacoes').select('*')
        .eq('cliente_ref', q.get('clientId')).order('created_at', { ascending: false });
      return jsonResponse((data || []).map(a => ({ id: a.id, clientRef: a.cliente_ref,
        relatorioId: a.relatorio_id, casoRef: a.caso_ref || null,
        nota: a.nota, comentario: a.comentario, createdAt: a.created_at })));
    }

    if (path === '/api/avaliacoes' && method === 'POST') {
      let casoRefAvaliacao = body.casoRef || null;
      if (body.relatorioId) {
        const { data: relatorioAvaliacao, error: relatorioAvaliacaoError } = await sb.from('relatorios')
          .select('cliente_ref,caso_ref,status').eq('id', body.relatorioId).maybeSingle();
        if (relatorioAvaliacaoError || !relatorioAvaliacao || relatorioAvaliacao.status !== 'entregue' ||
          String(relatorioAvaliacao.cliente_ref) !== String(body.clientId)) {
          return jsonResponse({ error: 'relatorio_invalido_para_avaliacao' }, 403);
        }
        casoRefAvaliacao = relatorioAvaliacao.caso_ref || casoRefAvaliacao;
      }
      if (casoRefAvaliacao) {
        const { data: existente } = await sb.from('avaliacoes').select('id,nota')
          .eq('caso_ref', casoRefAvaliacao).maybeSingle();
        if (existente) return jsonResponse({ id: existente.id, nota: existente.nota, alreadyExists: true });
      }
      const { data, error } = await sb.from('avaliacoes').insert({
        cliente_ref: body.clientId, relatorio_id: body.relatorioId || null,
        caso_ref: casoRefAvaliacao, nota: body.nota, comentario: body.comentario || null
      }).select().single();
      if (error) throw error;
      return jsonResponse({ id: data.id, nota: data.nota });
    }

    // Média para o painel do contador. O RLS já garante que só staff vê tudo;
    // para o cliente isto devolveria só a nota dele, então o painel é quem chama.
    if (path === '/api/avaliacoes/resumo' && method === 'GET') {
      const { data } = await sb.from('avaliacoes').select('nota');
      const notas = (data || []).map(r => r.nota);
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
      return jsonResponse({ media, total: notas.length });
    }

    // ---------- CONFIGURAÇÕES ----------
    // Devolve tudo num objeto {chave: valor}: são poucas linhas e o front sempre
    // quer mais de uma. Uma ida à rede por chave seria desperdício.
    if (path === '/api/config' && method === 'GET') {
      const { data } = await sb.from('configuracoes').select('chave, valor');
      const out = {};
      (data || []).forEach(r => { out[r.chave] = r.valor; });
      return jsonResponse(out);
    }

    // Grava as chaves recebidas. O RLS barra o cliente (insert/update = is_staff),
    // então isto é a conveniência do painel — não a trava.
    if (path === '/api/config' && method === 'POST') {
      const linhas = Object.keys(body || {}).map(chave => ({ chave, valor: body[chave] }));
      if (!linhas.length) return jsonResponse({ ok: true });
      const { error } = await sb.from('configuracoes').upsert(linhas, { onConflict: 'chave' });
      if (error) throw error;
      return jsonResponse({ ok: true, salvas: linhas.map(l => l.chave) });
    }

    // ---------- SERVIÇOS ----------
    if (path === '/api/servicos' && method === 'GET') {
      let query = sb.from('servicos').select('*').order('price_cents');
      if (q.get('all') !== '1') query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse((data || []).map(mapServico));
    }
    if (path === '/api/servicos' && method === 'POST') {
      const payload = {
        name: String(body.name || '').trim(), description: String(body.description || '').trim() || null,
        price_cents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
        recurrence: body.recurrence || 'once', active: body.active !== false,
        prazo_express_dias_uteis: Math.min(10, Math.max(1, parseInt(body.prazoExpressDiasUteis, 10) || 2))
      };
      // Chega do painel como texto livre; vira [{id, titulo, resumo}]. O id sai
      // do título quando não vem pronto, pra continuar estável entre edições.
      if (Array.isArray(body.itens)) {
        payload.itens = body.itens.map(i => {
          const titulo = String((i && i.titulo) || '').trim();
          if (!titulo) return null;
          return { id: String((i && i.id) || '').trim() || slugify(titulo) || 'item',
            titulo, resumo: String((i && i.resumo) || '').trim() };
        }).filter(Boolean);
      }
      if (!payload.name) return jsonResponse({ error: 'name_required' }, 400);

      let query;
      if (body.id) {
        query = sb.from('servicos').update(payload).eq('id', body.id);
      } else {
        // servicos.id é texto sem valor padrão (é o slug, tipo "malha-fina") —
        // sem isto o insert quebrava com "null value in column id" e "Novo
        // serviço" nunca salvava nada.
        const base = slugify(payload.name) || 'servico';
        let id = base, tentativa = 1;
        while ((await sb.from('servicos').select('id').eq('id', id).maybeSingle()).data) {
          tentativa++; id = `${base}-${tentativa}`;
        }
        query = sb.from('servicos').insert({ ...payload, id });
      }
      const { data, error } = await query.select().single();
      if (error) throw error;
      return jsonResponse(mapServico(data));
    }
    if (path === '/api/servicos' && method === 'DELETE') {
      const id = q.get('id');
      if (!id) return jsonResponse({ error: 'id_required' }, 400);
      // Recusa excluir se já existe cobrança gerada com este plano — senão a
      // cobrança fica órfã (servico_id apontando pra um id que não existe mais).
      const { count } = await sb.from('cobrancas').select('id', { count: 'exact', head: true }).eq('servico_id', id);
      if (count) return jsonResponse({ error: 'servico_em_uso', detail: `Existem ${count} cobrança(s) geradas com este plano — desative em vez de excluir.` }, 409);
      const { error } = await sb.from('servicos').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ---------- CRÉDITOS DE ATENDIMENTO ----------
    // Gerados pelo contador (cortesia, reembolso, parceria). Nenhuma chave secreta
    // envolvida — RLS (is_staff) garante que só staff logado gera/lista/cancela.
    // O resgate público (cliente usa o código) é sempre serverless de verdade
    // (/api/resgatar-credito), porque não há sessão de usuário nessa hora.
    if (path === '/api/creditos' && method === 'GET') {
      const { data, error } = await sb.from('creditos').select('*, clientes(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse((data || []).map(mapCredito));
    }
    if (path === '/api/creditos' && method === 'POST') {
      const valorCents = Math.round(Number(body.valorCents) || 0);
      if (!valorCents || valorCents < 100) return jsonResponse({ error: 'valor_invalido' }, 400);
      const observacao = String(body.observacao || '').trim() || null;
      let codigo, tentativas = 0;
      do {
        codigo = gerarCodigoCredito();
        tentativas++;
      } while (tentativas < 5 && (await sb.from('creditos').select('id').eq('codigo', codigo).maybeSingle()).data);
      const { data: sessao } = await sb.auth.getUser();
      const { data, error } = await sb.from('creditos').insert({
        codigo, valor_cents: valorCents, observacao, criado_por: sessao?.user?.email || null,
        expira_em: body.expiraEm || new Date(Date.now() + 90 * 86400000).toISOString()
      }).select().single();
      if (error) throw error;
      return jsonResponse(mapCredito(data));
    }
    const mCredito = path.match(/^\/api\/creditos\/(\d+)\/cancelar$/);
    if (mCredito && method === 'POST') {
      const id = parseInt(mCredito[1], 10);
      const { data: credito } = await sb.from('creditos').select('status').eq('id', id).single();
      if (!credito) return jsonResponse({ error: 'credito_not_found' }, 404);
      if (credito.status !== 'ativo') return jsonResponse({ error: 'credito_nao_esta_ativo' }, 400);
      const { data: sessao } = await sb.auth.getUser();
      const { error } = await sb.from('creditos').update({
        status: 'cancelado', cancelado_em: new Date().toISOString(), cancelado_por: sessao?.user?.email || null
      }).eq('id', id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ---------- GUIAS MENSAIS (checklist do acompanhamento recorrente) ----------
    // Sem certificado/API do Integra Contador ainda, a geração da guia é manual:
    // o sistema só lembra quem vence este mês e o contador marca como feito.
    if (path === '/api/guias-mensais' && method === 'GET') {
      const competencia = q.get('competencia') || new Date().toISOString().slice(0, 7);
      const { data: recorrentes } = await sb.from('clientes').select('id').eq('recorrente', true);
      if (recorrentes && recorrentes.length) {
        await sb.from('guias_mensais').upsert(
          recorrentes.map(c => ({ cliente_ref: c.id, competencia })),
          { onConflict: 'cliente_ref,competencia', ignoreDuplicates: true }
        );
      }
      const { data, error } = await sb.from('guias_mensais')
        .select('*, clientes(name, recorrente_tipo)').eq('competencia', competencia).order('created_at');
      if (error) throw error;
      return jsonResponse((data || []).map(g => ({
        id: g.id, clientRef: g.cliente_ref, clientName: g.clientes?.name || g.cliente_ref,
        tipo: g.clientes?.recorrente_tipo || null, competencia: g.competencia,
        status: g.status, geradaEm: g.gerada_em, observacao: g.observacao
      })));
    }
    const mGuia = path.match(/^\/api\/guias-mensais\/(\d+)\/concluir$/);
    if (mGuia && method === 'POST') {
      const { error } = await sb.from('guias_mensais').update({
        status: 'gerada', gerada_em: new Date().toISOString(), observacao: body?.observacao || null
      }).eq('id', parseInt(mGuia[1], 10));
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ---------- COBRANÇAS (painel administrativo + histórico por cliente) ----------
    if (path === '/api/cobrancas' && method === 'GET') {
      let query = sb.from('cobrancas').select('*').order('created_at', { ascending: false });
      if (q.get('clientId')) query = query.eq('cliente_ref', q.get('clientId'));
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse((data || []).map(mapCobranca));
    }

    // ---------- ATENDIMENTOS EXPRESS (fila sem horário marcado) ----------
    if (path === '/api/atendimentos-express' && method === 'GET') {
      const { data, error } = await sb.from('atendimentos_express').select('*')
        .order('prazo_conclusao_em', { ascending: true });
      if (error) throw error;
      return jsonResponse((data || []).map(mapAtendimentoExpress));
    }
    const mExpressStatus = path.match(/^\/api\/atendimentos-express\/(\d+)\/status$/);
    if (mExpressStatus && method === 'POST') {
      const permitidos = ['aguardando_triagem', 'em_analise', 'em_execucao', 'aguardando_documentos', 'pronto_envio', 'concluido', 'cancelado'];
      if (!permitidos.includes(body.status)) return jsonResponse({ error: 'status_invalido' }, 400);
      const expressId = Number(mExpressStatus[1]);
      // A conclusão normal acontece na RPC de entrega. Esta proteção também
      // impede uma chamada manual à rota de retirar o caso da fila antes de
      // existir um relatório efetivamente visível na Área do Cliente.
      if (body.status === 'concluido') {
        const { data: entrega, error: entregaError } = await sb.from('relatorios')
          .select('id').eq('atendimento_express_id', expressId).eq('status', 'entregue')
          .order('entregue_em', { ascending: false }).limit(1).maybeSingle();
        if (entregaError) throw entregaError;
        if (!entrega) return jsonResponse({ error: 'resultado_ainda_nao_entregue' }, 409);
      }
      const agora = new Date().toISOString();
      const patch = { status: body.status, updated_at: agora };
      if (body.status === 'em_execucao') patch.iniciado_em = agora;
      if (body.status === 'concluido') patch.concluido_em = agora;
      const { data, error } = await sb.from('atendimentos_express').update(patch)
        .eq('id', expressId).select().single();
      if (error) throw error;
      return jsonResponse(mapAtendimentoExpress(data));
    }

    // ---------- AGENDA FISCAL ----------
    if (path === '/api/agenda-fiscal' && method === 'GET') {
      const { data: obrigacoes } = await sb.from('obrigacoes').select('*').eq('active', true);
      let taxType = null;
      const cid = q.get('clientId');
      if (cid) {
        const { data: c } = await sb.from('clientes').select('tax_type').eq('id', cid).single();
        taxType = c ? c.tax_type : null;
      }
      return jsonResponse(proximosVencimentos(obrigacoes, taxType));
    }

    return jsonResponse({ error: 'not_found', path }, 404);
  } catch (e) {
    console.error('[oc-data] erro em', path, e);
    return jsonResponse({ error: 'adapter_error', detail: String(e && e.message || e) }, 500);
  }
}

// ---------- instala o adaptador de fetch ----------
(function installFetchAdapter() {
  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url);
      const u = new URL(url, location.origin);
      const apiDaMesmaOrigem = u.origin === location.origin && u.pathname.startsWith('/api/');
      const apiLocalDoArquivo = location.protocol === 'file:' && /^https?:$/.test(u.protocol) && u.hostname === 'localhost' && u.pathname.startsWith('/api/');
      if (apiDaMesmaOrigem || apiLocalDoArquivo) {
        return routeApi(u, init || {}, _fetch);
      }
    } catch (e) { /* cai no fetch normal */ }
    return _fetch(input, init);
  };
})();

// ============================================================================
// Realtime — substitui o Socket.io. O RLS garante que cada um só recebe o seu.
// ============================================================================
window.OCRealtime = {
  channel: null,
  subscribe({ onMessage, onMessageUpdate, onData, onStatus } = {}) {
    if (testeSemLogin()) return { unsubscribe() {} };
    
    const _start = async () => {
      if (this.channel) {
        try { await sb.removeChannel(this.channel); } catch (e) {}
      }
      let ch = sb.channel('oc-realtime-' + Math.random().toString(36).slice(2, 7));
      if (onMessage) {
        ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' },
          p => onMessage(p.new.cliente_id, mapMessage(p.new)));
      }
      if (onMessageUpdate) {
        ch = ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens' },
          p => onMessageUpdate(p.new.cliente_id, mapMessage(p.new)));
      }
      if (onData) {
        ['notificacoes', 'agendamentos', 'documentos', 'clientes'].forEach(t => {
          ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload) => {
            onData(t);
            if (t === 'clientes' && payload.eventType === 'INSERT' && typeof window.notifyNewLead === 'function') {
              window.notifyNewLead(payload.new.name || 'Desconhecido');
            }
          });
        });
      }
      ch.subscribe(status => {
        if (onStatus) onStatus(status);
      });
      this.channel = ch;
    };
    
    _start();

    return {
      unsubscribe: async () => {
        if (this.channel) {
          try { await sb.removeChannel(this.channel); } catch (e) {}
          this.channel = null;
        }
      }
    };
  }
};

// ============================================================================
// OCChat — leitura e "digitando...".
// ============================================================================
window.OCChat = {
  // Marca como lidas as mensagens do OUTRO lado nesta conversa. A função
  // serverless valida o papel da sessão antes de gravar: cliente só confirma
  // mensagens do contador; equipe, mensagens do cliente.
  async marcarLidas(clientId) {
    if (testeSemLogin()) return 0;
    if (!clientId) return 0;
    try {
      const res = await fetch('/api/status?acao=marcar-lidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      });
      if (!res.ok) throw new Error('resposta ' + res.status);
      const data = await res.json();
      return data.marked || 0;
    } catch (error) {
      console.warn('[chat] não consegui marcar como lidas:', error.message);
      return 0;
    }
  },

  // "Digitando" não passa pelo banco: é um recado efêmero via broadcast. Gravar
  // cada tecla numa tabela seria escrever centenas de linhas para uma informação
  // que morre em 3 segundos.
  //
  // ATENÇÃO: o canal é público (o nome deriva do id do cliente). Quem soubesse o
  // id conseguiria ver que ALGUÉM está digitando — nada além disso. Por isso o
  // payload não leva texto nenhum, só de qual lado veio.
  typing(clientId, { onTyping } = {}) {
    if (testeSemLogin()) return { aviso() {}, encerrar() {} };
    const nome = 'oc-typing-' + clientId;
    const ch = sb.channel(nome, { config: { broadcast: { self: false } } });
    if (onTyping) ch.on('broadcast', { event: 'typing' }, ({ payload }) => onTyping(payload && payload.from));
    ch.subscribe();

    let ultimoAviso = 0;
    return {
      // Chamado a cada tecla, mas só avisa a cada 2s — o outro lado mantém o
      // indicador vivo por 3s, então não há buraco entre um aviso e o próximo.
      aviso(from) {
        const agora = Date.now();
        if (agora - ultimoAviso < 2000) return;
        ultimoAviso = agora;
        ch.send({ type: 'broadcast', event: 'typing', payload: { from } });
      },
      encerrar() { try { sb.removeChannel(ch); } catch (e) {} }
    };
  }
};

// ============================================================================
// Horários do chat. O banco guarda created_at (timestamptz); as linhas antigas
// só têm o texto 'HH:MM'. Estas funções aceitam as duas coisas.
// ============================================================================
window.OCTempo = {
  data(msg) {
    if (msg.createdAt) { const d = new Date(msg.createdAt); if (!isNaN(d)) return d; }
    return null;
  },
  hora(msg) {
    const d = this.data(msg);
    if (d) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return msg.time || '';
  },
  // Rótulo do separador: "Hoje", "Ontem" ou a data por extenso.
  diaLabel(d) {
    const hoje = new Date();
    const zera = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const dias = Math.round((zera(hoje) - zera(d)) / 86400000);
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    if (dias < 7) return d.toLocaleDateString('pt-BR', { weekday: 'long' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  },
  // Chave do dia, para saber quando desenhar um separador novo.
  diaChave(msg) {
    const d = this.data(msg);
    return d ? d.toDateString() : null;
  },

  // -------------------------------------------------------------------------
  // Datas de agendamento (YYYY-MM-DD)
  // -------------------------------------------------------------------------
  // A tabela guardava a PALAVRA "Hoje" numa coluna de texto, então um
  // agendamento criado hoje continuava "de hoje" para sempre. Agora a coluna é
  // date de verdade e o rótulo é calculado aqui, na hora de mostrar.

  // Data de hoje em YYYY-MM-DD no fuso LOCAL. toISOString() não serve: ele
  // converte para UTC e, à noite no Brasil, devolve o dia seguinte.
  hojeISO(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },

  amanhaISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.hojeISO(d);
  },

  // "Hoje", "Amanhã", "Ontem" ou dd/mm — o rótulo que a pessoa lê.
  rotuloDia(iso) {
    if (!iso) return '';
    if (iso === this.hojeISO()) return 'Hoje';
    if (iso === this.amanhaISO()) return 'Amanhã';
    const [a, m, dia] = iso.split('-');
    if (!dia) return iso;
    const d = new Date(Number(a), Number(m) - 1, Number(dia));
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    if (iso === this.hojeISO(ontem)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  },

  ehHoje(iso) { return !!iso && iso === this.hojeISO(); }
};

// ============================================================================
// Autenticação (login por código de e-mail — passwordless, sem redirect config)
// ============================================================================

// Faixa fixa para que o acesso demonstrativo sem login nunca seja confundido com
// o portal que será entregue a clientes reais.
function mostrarAvisoTeste() {
  if (document.getElementById('oc-teste-aviso')) return;
  const el = document.createElement('div');
  el.id = 'oc-teste-aviso';
  el.textContent = '⚠ AMBIENTE DE TESTE — dados demonstrativos; nada é enviado ao banco';
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#b45309;' +
    'color:#fff;font:600 12px system-ui,sans-serif;text-align:center;padding:6px;letter-spacing:.3px';
  document.body.appendChild(el);
  // No celular a navegação é uma barra fixa no rodapé — sem esta marca o aviso
  // ficaria por cima dela e engoliria os botões. O CSS sobe a barra quando existe.
  document.body.classList.add('oc-teste-on');
}

window.OCAuth = {
  async context() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session && testeClienteSemLogin()) return { user: null, isTest: true, clientId: clienteTesteAtual() };
    if (!session && testeContadorSemLogin()) return { user: null, isStaff: true, isTest: true, clientId: null };
    if (!session) return { user: null };
    const [staffRes, roleRes, cidRes] = await Promise.all([sb.rpc('is_staff'), sb.rpc('my_role'), sb.rpc('my_client_id')]);
    return { user: session.user, isStaff: !!staffRes.data, staffRole: roleRes.data || null, clientId: cidRes.data || null };
  },
  // Protege a página. Os portais podem usar dados locais demonstrativos enquanto
  // as chaves de teste estiverem habilitadas; fora disso, exige sessão.
  async guard(role) {
    let { data: { session } } = await sb.auth.getSession();

    if (!session && role === 'cliente' && testeClienteSemLogin()) {
      mostrarAvisoTeste();
      return { user: null, isStaff: false, isTest: true, clientId: clienteTesteAtual() };
    }
    if (!session && role === 'contador' && testeContadorSemLogin()) {
      mostrarAvisoTeste();
      return { user: null, isStaff: true, isTest: true, clientId: null };
    }

    if (!session) {
      // Login normal (dev desligado) ou o auto-login falhou: vai pro login.
      location.href = 'login?role=' + role;
      return null;
    }

    const [staffRes, roleRes, cidRes] = await Promise.all([sb.rpc('is_staff'), sb.rpc('my_role'), sb.rpc('my_client_id')]);
    return { user: session.user, isStaff: !!staffRes.data, staffRole: roleRes.data || null, clientId: cidRes.data || null };
  },
  sendCode(email) { return sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }); },
  verifyCode(email, token) { return sb.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' }); },
  async signOut() { await sb.auth.signOut(); location.href = 'index.html'; }
};
