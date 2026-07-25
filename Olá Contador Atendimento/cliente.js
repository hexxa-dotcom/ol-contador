// Identidade do cliente logado — vem da sessão autenticada (Supabase Auth).
let CLIENT_ID = null;
// Ids já renderizados, para não duplicar mensagens ecoadas pelo Realtime.
const renderedMessageIds = new Set();
let currentChatStatus = 'active';
let ultimoDiaDesenhado = null;
let clienteLogado = null; // Guardará as configs e dados do cliente

document.addEventListener('DOMContentLoaded', async () => {
  // Exige login de cliente; redireciona pro login se não autorizado.
  const ctx = await OCAuth.guard('cliente');
  if (!ctx) return;
  CLIENT_ID = ctx.clientId;

  setupNavigation();
  setupChat();
  setupFileUpload();
  setupLogout();
  setupRecolherMenu();
  setupRecolherCentralAtendimento();

  // Chat em tempo real via Supabase Realtime (o RLS só entrega as mensagens deste cliente).
  OCRealtime.subscribe({
    onMessage: (clientId, message) => {
      if (clientId !== CLIENT_ID) return;
      appendMessageToChat(message);
      // Só avisa com o badge se o chat não estiver aberto na tela.
      if (!chatEstaVisivel() && message.sender !== 'client') incrementClienteBadge();
    },
    // Hoje só muda o read_at: é o contador confirmando que leu.
    onMessageUpdate: (clientId, message) => {
      if (clientId === CLIENT_ID) aplicarLeitura(message);
    }
  });

  setupTyping();

  // Carrega o histórico persistido (fonte da verdade = banco).
  await loadClientHistory();
  if (chatEstaVisivel()) marcarTudoLido();

  setupCheckout();
  loadAgendaFiscal();
  aplicarPerfilDoContador();
  TriagemUI.iniciar(CLIENT_ID);
  setupChatLockListener();
  setupPresence();
  carregarRelatorios();
  montarLinhaDoTempo();
  carregarHistoricoAtendimentos();
  carregarRadarFiscal();
});

// ------------------------------------------------------------------ relatórios
// Os relatórios de atendimento entregues pelo contador. O cliente baixa o PDF
// branded a partir do conteúdo salvo — o mesmo documento que o contador gerou.
let RELATORIOS = [];

async function carregarRelatorios() {
  const lista = document.getElementById("client-relatorios-list");
  const bloco = document.getElementById("bloco-relatorios");
  if (!lista) return;
  try {
    const res = await fetch('/api/relatorios?clientId=' + encodeURIComponent(CLIENT_ID));
    RELATORIOS = await res.json();
  } catch (e) { RELATORIOS = []; }

  if (!RELATORIOS.length) { bloco.hidden = true; return; }
  bloco.hidden = false;
  lista.innerHTML = "";
  RELATORIOS.forEach(rel => {
    const data = new Date(rel.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const item = document.createElement("div");
    item.className = "doc-item";
    item.style.borderLeft = "3px solid var(--color-coral)";
    item.innerHTML =
      '<div class="doc-info">' +
        '<i class="fa-solid fa-file-lines" style="color: var(--color-coral);"></i>' +
        '<div><div class="doc-name">' + escapeHtml(rel.titulo || 'Relatório de Atendimento') + '</div>' +
        '<div class="doc-meta">Emitido pelo contador • ' + data + '</div></div>' +
      '</div>' +
      '<button class="btn-attach" title="Baixar PDF" data-rel="' + rel.id + '"><i class="fa-solid fa-download"></i></button>';
    item.querySelector('[data-rel]').addEventListener('click', () => baixarRelatorioCliente(rel.id));
    lista.appendChild(item);
  });
  montarLinhaDoTempo();
  carregarHistoricoAtendimentos();
}

function baixarRelatorioCliente(id) {
  const rel = RELATORIOS.find(r => String(r.id) === String(id));
  if (!rel) return;
  OCRelatorio.baixarPDF(rel, { name: rel.clienteNome, cpf: rel.clienteCpf });
}

// Baixa o relatório mais recente (usado pelo botão do card no chat, já que a
// mensagem não guarda o id do relatório).
function baixarRelatorioMaisRecente() {
  if (RELATORIOS.length) baixarRelatorioCliente(RELATORIOS[0].id);
  else irParaRelatorios();
}

function irParaRelatorios() {
  const nav = document.querySelector('[data-target="section-documentos"]');
  if (nav) nav.click();
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function abrirSecaoCliente(id) {
  const nav = document.querySelector(`[data-target="${id}"]`);
  if (nav) nav.click();
}

function atualizarProximaAcao({ triagemEnviada, qtdDocs, temAppt, apptFeito, temRelatorio }) {
  const icon = document.getElementById('case-next-action-icon');
  const title = document.getElementById('case-next-action-title');
  const text = document.getElementById('case-next-action-text');
  const button = document.getElementById('case-next-action-button');
  if (!icon || !title || !text || !button) return;

  let state;
  if (temRelatorio) {
    state = { icon: 'fa-file-circle-check', title: 'Seu relatório está pronto', text: 'O atendimento foi concluído. Baixe seu relatório quando quiser.', button: 'Ver relatório', target: 'section-documentos', color: '#1F8A5F' };
  } else if (!triagemEnviada) {
    state = { icon: 'fa-clipboard-question', title: 'Conte seu caso antes do atendimento', text: 'A triagem ajuda o contador a chegar preparado para resolver.', button: 'Preencher triagem', target: 'section-triagem', color: 'var(--color-pine)' };
  } else if (!qtdDocs) {
    state = { icon: 'fa-folder-open', title: 'Envie os documentos que você já tiver', text: 'Eles ajudam o contador a analisar o caso antes da conversa.', button: 'Ver documentos', target: 'section-documentos', color: 'var(--color-pine)' };
  } else if (!temAppt) {
    state = { icon: 'fa-calendar-plus', title: 'Escolha o horário do seu atendimento', text: 'Depois da confirmação, seu chat será liberado no horário marcado.', button: 'Agendar atendimento', target: 'section-agendamento', color: 'var(--color-pine)' };
  } else if (!apptFeito) {
    state = { icon: 'fa-calendar-check', title: 'Seu atendimento está agendado', text: 'Confira data e horário na sua agenda. O chat abre no momento da reunião.', button: 'Ver agendamento', target: 'section-agendamento', color: 'var(--color-pine)' };
  } else {
    state = { icon: 'fa-file-lines', title: 'Seu relatório está sendo preparado', text: 'Assim que ele estiver pronto, você receberá um aviso aqui.', button: 'Acompanhar atendimento', target: 'section-chat', color: 'var(--color-pine)' };
  }

  icon.style.background = state.color;
  icon.innerHTML = `<i class="fa-solid ${state.icon}"></i>`;
  title.textContent = state.title;
  text.textContent = state.text;
  button.disabled = false;
  button.textContent = state.button;
  button.onclick = () => abrirSecaoCliente(state.target);

  return state;
}

function atualizarSidebarDoChat({ nomeCaso, statusCaso, proximaAcao, pendencias, qtdDocs, temRelatorio }) {
  const titulo = document.getElementById('chat-side-case-title');
  const status = document.getElementById('chat-side-case-status');
  const next = document.getElementById('chat-side-next-action');
  const pending = document.getElementById('chat-side-pending-count');
  const docs = document.getElementById('chat-side-docs-count');
  const report = document.getElementById('chat-side-report-state');

  if (titulo) titulo.textContent = nomeCaso || 'Seu atendimento';
  if (status) status.textContent = statusCaso || 'Em andamento';
  if (next) next.textContent = proximaAcao?.text || 'Acompanhe o andamento do seu caso por aqui.';
  if (pending) pending.textContent = String(Math.max(0, pendencias || 0));
  if (docs) docs.textContent = String(qtdDocs || 0);
  if (report) report.textContent = temRelatorio ? 'Pronto' : 'Pendente';
}

// ------------------------------------------------------- linha do tempo do caso
// Antes o rastreador era um desenho fixo ("Malha Fina IR2025" com passos
// inventados). Agora cada passo vem do estado real: triagem enviada, documentos
// recebidos, consulta realizada, relatório entregue.
async function montarLinhaDoTempo() {
  const box = document.getElementById('tracker-passos');
  if (!box) return;

  const pega = async (url, padrao) => {
    try { const r = await fetch(url); return await r.json(); } catch (e) { return padrao; }
  };
  const [triagem, docs, appts, rels] = await Promise.all([
    pega('/api/triagem?clientId=' + encodeURIComponent(CLIENT_ID), null),
    pega('/api/documentos?clientId=' + encodeURIComponent(CLIENT_ID), []),
    pega('/api/appointments', []),
    pega('/api/relatorios?clientId=' + encodeURIComponent(CLIENT_ID), [])
  ]);

  const meusAppts = (appts || []).filter(a => a.clientRef === CLIENT_ID);
  const temAppt = meusAppts.length > 0;
  const apptFeito = meusAppts.some(a => a.status === 'done');
  const triagemEnviada = !!(triagem && triagem.status === 'enviada');
  const qtdDocs = (docs || []).length;
  const temRelatorio = (rels || []).length > 0;

  const passos = [
    { t: 'Serviço contratado', d: 'Seu atendimento foi aberto.', feito: true },
    { t: 'Pré-atendimento',
      d: triagemEnviada ? 'Você contou seu caso — o contador já leu.' : 'Conte seu caso antes da consulta.',
      feito: triagemEnviada },
    { t: 'Documentos',
      d: qtdDocs ? `${qtdDocs} documento(s) recebido(s).` : 'Anexe os documentos pedidos.',
      feito: qtdDocs > 0 },
    { t: 'Atendimento',
      d: apptFeito ? 'Consulta realizada.' : (temAppt ? 'Consulta agendada.' : 'Agende seu horário.'),
      feito: apptFeito },
    { t: 'Relatório entregue',
      d: temRelatorio ? 'Seu relatório está em Documentos.' : 'Ao fim você recebe o relatório do atendimento.',
      feito: temRelatorio }
  ];

  // O passo ativo é o primeiro que ainda não foi feito.
  const iAtivo = passos.findIndex(p => !p.feito);
  box.innerHTML = '';
  passos.forEach((p, i) => {
    const estado = p.feito ? 'completed' : (i === iAtivo ? 'active' : '');
    const icone = p.feito ? 'fa-check' : 'fa-circle';
    const el = document.createElement('div');
    el.className = 'tracker-step ' + estado;
    el.innerHTML =
      `<div class="step-indicator"><i class="fa-solid ${icone}"></i></div>` +
      `<div class="step-content"><h4>${escapeHtml(p.t)}</h4><p>${escapeHtml(p.d)}</p></div>`;
    box.appendChild(el);
  });

  // Título e status refletem o caso de verdade.
  const titulo = document.getElementById('tracker-titulo');
  const status = document.getElementById('tracker-status');
  const nomeCaso = (rels && rels[0] && rels[0].titulo)
    || (triagem && triagem.assunto && OC_TRIAGEM.acharAssunto(triagem.assunto)?.titulo)
    || 'Seu atendimento';
  if (titulo) titulo.textContent = nomeCaso;
  
  const statusCaso = temRelatorio ? 'Concluído' : 'Em andamento';
  if (status) {
    status.textContent = statusCaso;
    status.style.background = temRelatorio ? '#1F8A5F' : 'var(--color-pine)';
  }

  // Atualiza também os passos visuais do "Como funciona" no Dashboard
  let passoDashboard = 1;
  if (temRelatorio) passoDashboard = 4;
  else if (apptFeito) passoDashboard = 3;
  else if (triagemEnviada) passoDashboard = 2;
  
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step-processo-${i}`);
    if (!el) continue;
    const circle = el.querySelector('.step-circle');
    const title = el.querySelector('h4');
    if (i < passoDashboard) {
      // Concluído
      circle.style.background = '#1F8A5F'; // Verde
      circle.style.color = 'white';
      circle.innerHTML = '<i class="fa-solid fa-check"></i>';
      title.style.color = '#1F8A5F';
    } else if (i === passoDashboard) {
      // Ativo
      circle.style.background = 'var(--color-coral)';
      circle.style.color = 'white';
      circle.innerHTML = i;
      title.style.color = 'var(--color-pine)';
    } else {
      // Futuro
      circle.style.background = 'var(--color-bg)';
      circle.style.color = 'var(--color-text-secondary)';
      circle.innerHTML = i;
      title.style.color = 'var(--color-text-secondary)';
    }
  }

  // A avaliação só faz sentido depois que existe relatório.
  configurarAvaliacao(temRelatorio, rels && rels[0] ? rels[0].id : null);
  const proximaAcao = atualizarProximaAcao({ triagemEnviada, qtdDocs, temAppt, apptFeito, temRelatorio });
  atualizarSidebarDoChat({
    nomeCaso,
    statusCaso,
    proximaAcao,
    pendencias: passos.filter(p => !p.feito).length,
    qtdDocs,
    temRelatorio
  });

  // Preenche o card de Agendamento na Home, se houver consulta agendada
  const cardAgendamento = document.getElementById('card-agendamento-ativo');
  const divComDados = document.getElementById('agendamento-com-dados');
  const divVazio = document.getElementById('agendamento-vazio');
  
  if (cardAgendamento && divComDados && divVazio) {
    // Procura o primeiro agendamento que não esteja concluído (ou o mais recente)
    const futuro = meusAppts.find(a => a.status !== 'done') || (meusAppts.length ? meusAppts[meusAppts.length - 1] : null);
    if (futuro && !temRelatorio) {
      divComDados.style.display = 'block';
      divVazio.style.display = 'none';
      let fDate = futuro.date;
      if (fDate && fDate.includes('-')) {
        const parts = fDate.split('-');
        if (parts.length === 3) fDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const titleServico = futuro.taxType || (triagem ? triagem.assunto : 'Atendimento ao vivo');
      document.getElementById('agendamento-data-hora').innerText = `${fDate || '--'} às ${futuro.time || '--'}`;
      document.getElementById('agendamento-servico').innerText = titleServico;
    } else {
      divComDados.style.display = 'none';
      divVazio.style.display = 'block';
    }
  }
}

// ----------------------------------------------------------------- avaliação
let notaEscolhida = 0;

async function configurarAvaliacao(temRelatorio, relatorioId) {
  const card = document.getElementById('card-avaliacao');
  const feito = document.getElementById('card-avaliacao-feita');
  if (!card || !feito) return;
  if (!temRelatorio) { card.hidden = true; feito.hidden = true; return; }

  // Já avaliou? Então agradece em vez de pedir de novo.
  let jaAvaliou = null;
  try {
    const lista = await (await fetch('/api/avaliacoes?clientId=' + encodeURIComponent(CLIENT_ID))).json();
    jaAvaliou = (lista || [])[0] || null;
  } catch (e) { /* segue pedindo a nota */ }

  if (jaAvaliou) {
    card.hidden = true;
    feito.hidden = false;
    document.getElementById('aval-feita-texto').textContent =
      `Você deu nota ${jaAvaliou.nota} de 5. Obrigado por ajudar a melhorar o atendimento.`;
    return;
  }

  feito.hidden = true;
  card.hidden = false;
  const estrelas = document.getElementById('aval-estrelas');
  const botao = document.getElementById('btn-enviar-avaliacao');

  estrelas.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      notaEscolhida = parseInt(b.dataset.nota, 10);
      estrelas.querySelectorAll('button').forEach(o => {
        const cheia = parseInt(o.dataset.nota, 10) <= notaEscolhida;
        o.querySelector('i').className = cheia ? 'fa-solid fa-star' : 'fa-regular fa-star';
      });
      botao.disabled = false;
    };
  });

  botao.onclick = async () => {
    if (!notaEscolhida) return;
    botao.disabled = true;
    botao.textContent = 'Enviando...';
    try {
      const res = await fetch('/api/avaliacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_ID, relatorioId,
          nota: notaEscolhida,
          comentario: document.getElementById('aval-comentario').value.trim() || null
        })
      });
      if (!res.ok) throw new Error('resposta ' + res.status);
      card.hidden = true;
      feito.hidden = false;
      document.getElementById('aval-feita-texto').textContent =
        `Você deu nota ${notaEscolhida} de 5. Obrigado por ajudar a melhorar o atendimento.`;
    } catch (e) {
      botao.disabled = false;
      botao.textContent = 'Enviar avaliação';
      alert('Não consegui enviar sua avaliação agora. Tente de novo em instantes.');
    }
  };
}

function aplicarEstadoDoChat(status) {
  const overlay = document.getElementById('chat-locked-overlay');
  const area = document.querySelector('#section-chat .chat-input-area');
  const input = document.getElementById('client-chat-input');
  const icon = document.getElementById('chat-lock-icon');
  const title = document.getElementById('chat-lock-title');
  const text = document.getElementById('chat-lock-text');
  const action = document.getElementById('chat-lock-action');
  const isFinished = status === 'done';
  const isLocked = status === 'locked' || isFinished;

  if (overlay) {
    overlay.style.display = isLocked ? 'flex' : 'none';
    overlay.classList.toggle('is-finished', isFinished);
  }
  if (area) area.style.display = isFinished ? 'none' : '';
  if (input) {
    input.disabled = isLocked;
    input.placeholder = isFinished ? 'Atendimento encerrado.' : 'Digite sua mensagem...';
  }
  if (!isLocked) {
    if (action) action.hidden = true;
    return;
  }

  if (isFinished) {
    if (icon) icon.className = 'fa-solid fa-circle-check';
    if (title) title.textContent = 'Atendimento concluído';
    if (text) text.textContent = 'Seu chat foi encerrado. O relatório será liberado na área de documentos assim que estiver pronto.';
    if (action) {
      action.hidden = false;
      action.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> Ver relatório';
      action.onclick = () => abrirSecaoCliente('section-documentos');
    }
  } else {
    if (icon) icon.className = 'fa-solid fa-lock';
    if (title) title.textContent = 'Atendimento bloqueado';
    if (text) text.textContent = 'Seu chat será liberado no momento da sua reunião.';
    if (action) action.hidden = true;
  }
}

async function setupChatLockListener() {
  // Busca o status inicial pela mesma API usada pelos dois portais. Assim, se o
  // cliente abrir a tela depois que o contador bloqueou/encerrou, ele já vê o
  // estado certo sem depender de ter recebido o broadcast em tempo real.
  try {
    const res = await fetch('/api/clients');
    const clients = res.ok ? await res.json() : {};
    if (clients && clients[CLIENT_ID]) aplicarEstadoDoChat(clients[CLIENT_ID].status);
  } catch(e) {}

  if (!window.sb) return;
  if (window.OC_CONFIG?.TESTE_CLIENTE_SEM_LOGIN?.enabled && window.OC_ROLE === 'cliente') return;

  // Escuta as mudanças em tempo real via broadcast
  const ch = window.sb.channel('oc-lock-' + CLIENT_ID);
  ch.on('broadcast', { event: 'lock_change' }, ({ payload }) => {
    aplicarEstadoDoChat(payload.status || (payload.locked ? 'locked' : 'active'));
  });
  ch.subscribe();
}

// ============================================================================
// STATUS ONLINE (PRESENÇA)
// ============================================================================
let contadorLastSeen = 0;

function setupPresence() {
  if (!window.sb) return;
  const ch = window.sb.channel('oc-presence', { config: { broadcast: { self: false } } });
  
  ch.on('broadcast', { event: 'ping' }, ({ payload }) => {
    if (payload.role === 'contador') {
      contadorLastSeen = Date.now();
      updateContadorPresenceUI();
    }
  });
  ch.subscribe();

  // Cliente avisa que está vivo a cada 5s
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      ch.send({ type: 'broadcast', event: 'ping', payload: { role: 'client', id: CLIENT_ID } });
    }
  }, 5000);
  
  // Limpa offline a cada 10s
  setInterval(() => {
    updateContadorPresenceUI();
  }, 10000);
}

function updateContadorPresenceUI() {
  const statusEl = document.getElementById('contador-status');
  if (!statusEl) return;
  
  const isOnline = (Date.now() - contadorLastSeen) < 15000;
  const textEl = statusEl.querySelector('.status-text');
  const dotEl = statusEl.querySelector('.dot');
  
  if (isOnline) {
    statusEl.classList.remove('offline');
    statusEl.classList.add('online');
    dotEl.style.color = '#2ECC71';
    textEl.textContent = 'Online';
  } else {
    statusEl.classList.remove('online');
    statusEl.classList.add('offline');
    dotEl.style.color = 'inherit';
    if (contadorLastSeen > 0) {
      const min = Math.floor((Date.now() - contadorLastSeen) / 60000);
      textEl.textContent = min < 1 ? 'Visto agora mesmo' : `Visto há ${min} min`;
    } else {
      textEl.textContent = 'Offline';
    }
  }
}

// Nome e CRC vinham fixos no HTML: trocar de contador (ou corrigir um registro)
// exigia editar arquivo e publicar. Agora saem de Configurações → Área do Cliente.
let PERFIL_CONTADOR = { nome: 'Seu contador', crc: '', especialidade: '' };

async function aplicarPerfilDoContador() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    if (cfg && cfg.contador_perfil) PERFIL_CONTADOR = Object.assign(PERFIL_CONTADOR, cfg.contador_perfil);
  } catch (e) { /* fica o texto de reserva do HTML */ }

  const nome = document.getElementById('oc-contador-nome');
  const crc = document.getElementById('oc-contador-crc');
  if (nome) nome.textContent = PERFIL_CONTADOR.nome;
  if (crc) crc.textContent = PERFIL_CONTADOR.crc || '';

  // O indicador de "digitando" cita o nome — tem que acompanhar.
  const dig = document.querySelector('#oc-digitando em');
  if (dig) dig.textContent = PERFIL_CONTADOR.nome + ' está digitando';
}

// Botão de sair (encerra a sessão e volta pra tela inicial).
// Recolher a barra lateral — mesmo comportamento do painel do contador.
// O CSS de .app-sidebar-nav.collapsed já existe no styles.css compartilhado, e
// o bloco mobile do cliente cobre .collapsed junto com a barra normal: no
// celular ela é rodapé de largura cheia com ou sem a classe. Por isso isto não
// afeta a versão do telefone.
function setupRecolherMenu() {
  const barra = document.querySelector('.app-sidebar-nav');
  const btn = document.getElementById('btn-toggle-sidebar-cliente');
  const icone = document.getElementById('icon-toggle-sidebar-cliente');
  if (!barra || !btn || !icone) return;

  btn.addEventListener('click', () => {
    const recolhido = barra.classList.toggle('collapsed');
    icone.classList.toggle('fa-chevron-left', !recolhido);
    icone.classList.toggle('fa-chevron-right', recolhido);
    btn.title = recolhido ? 'Expandir menu' : 'Recolher menu';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-expanded', recolhido ? 'false' : 'true');
  });
}

function setupRecolherCentralAtendimento() {
  const shell = document.querySelector('.cliente-chat-shell');
  const btn = document.getElementById('btn-toggle-chat-central');
  const icone = document.getElementById('icon-toggle-chat-central');
  if (!shell || !btn || !icone) return;

  const aplicar = (recolhida) => {
    shell.classList.toggle('central-collapsed', recolhida);
    icone.classList.toggle('fa-chevron-right', recolhida);
    icone.classList.toggle('fa-chevron-left', !recolhida);
    btn.title = recolhida ? 'Abrir central de atendimento' : 'Recolher central de atendimento';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-expanded', recolhida ? 'false' : 'true');
  };

  aplicar(localStorage.getItem('oc_cliente_chat_central_recolhida') === '1');

  btn.addEventListener('click', () => {
    const recolhida = !shell.classList.contains('central-collapsed');
    aplicar(recolhida);
    localStorage.setItem('oc_cliente_chat_central_recolhida', recolhida ? '1' : '0');
    const h = document.getElementById('client-chat-history');
    if (h) rolarParaOFim(h);
  });
}

function setupLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); OCAuth.signOut(); });
  });
}

// Carrega os próximos vencimentos fiscais do cliente.
async function loadAgendaFiscal() {
  const box = document.getElementById('client-agenda-fiscal');
  if (!box) return;
  try {
    const res = await fetch('/api/agenda-fiscal?clientId=' + encodeURIComponent(CLIENT_ID));
    const itens = await res.json();
    if (!itens.length) {
      box.innerHTML = '<p style="font-size:13px;color:var(--color-text-secondary);">Nenhuma obrigação fiscal próxima.</p>';
      return;
    }
    box.innerHTML = '';
    itens.forEach(v => {
      const urgente = v.daysUntil <= v.reminderDays;
      const cor = urgente ? 'var(--color-coral)' : 'var(--color-border)';
      const quando = v.daysUntil === 0 ? 'vence hoje'
        : v.daysUntil === 1 ? 'vence amanhã'
        : `em ${v.daysUntil} dias`;
      const row = document.createElement('div');
      row.style.cssText = `display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid ${cor};border-radius:8px;padding:12px 14px;margin-bottom:8px;`;
      row.innerHTML = `
        <div>
          <div style="font-weight:600;color:var(--color-pine);">${v.title}</div>
          <div style="font-size:12px;color:var(--color-text-secondary);">${v.description || ''}</div>
        </div>
        <div style="text-align:right;white-space:nowrap;">
          <div style="font-weight:600;color:${urgente ? 'var(--color-coral)' : 'var(--color-pine)'};">${v.dueDate.split('-').reverse().join('/')}</div>
          <div style="font-size:12px;color:var(--color-text-secondary);">${quando}</div>
        </div>
      `;
      box.appendChild(row);
    });
  } catch (e) {
    box.innerHTML = '<p style="font-size:13px;color:var(--color-coral);">Erro ao carregar a agenda fiscal.</p>';
  }
}

// ===================== CHECKOUT / PAGAMENTO (Asaas) =====================
let selectedServicoId = null;
let pollTimer = null;
const HORARIOS_ATENDIMENTO_PADRAO = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:30'];
let HORARIOS_ATENDIMENTO = [...HORARIOS_ATENDIMENTO_PADRAO];
let agendaSemanaOffset = 0;
let agendaAgendamentos = [];

async function setupCheckout() {
  // data padrão = hoje
  const dateInput = document.getElementById('checkout-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  await loadServicos();
  await setupAgendaCliente();

  const btn = document.getElementById('btn-gerar-pix');
  if (btn) btn.addEventListener('click', gerarPagamentoPix);

  const btnCopy = document.getElementById('btn-copiar-pix');
  if (btnCopy) btnCopy.addEventListener('click', () => {
    const inp = document.getElementById('pix-copia-cola');
    inp.select();
    navigator.clipboard.writeText(inp.value).catch(() => {});
    btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
    setTimeout(() => { btnCopy.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar'; }, 2000);
  });
}

function isoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dataLabelCurta(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function normalizeAppointmentDate(value) {
  if (!value) return '';
  const today = new Date();
  if (value === 'Hoje') return isoLocal(today);
  if (value === 'Amanhã') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return isoLocal(d);
  }
  return value;
}

function semanaAgenda(offset) {
  const base = new Date();
  base.setDate(base.getDate() + offset * 7);
  const dias = [];
  let cursor = new Date(base);
  while (dias.length < 5) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

async function setupAgendaCliente() {
  const grid = document.getElementById('agenda-cliente-grid');
  const prev = document.getElementById('agenda-cliente-prev');
  const next = document.getElementById('agenda-cliente-next');
  if (!grid) return;

  try {
    const [configRes, appointmentsRes] = await Promise.all([
      fetch('/api/config'),
      fetch('/api/appointments')
    ]);
    const config = configRes.ok ? await configRes.json() : {};
    const slots = Array.isArray(config.agenda_disponibilidade) ? config.agenda_disponibilidade : [];
    HORARIOS_ATENDIMENTO = slots.length ? slots : [...HORARIOS_ATENDIMENTO_PADRAO];
    agendaAgendamentos = appointmentsRes.ok ? await appointmentsRes.json() : [];
  } catch (e) {
    HORARIOS_ATENDIMENTO = [...HORARIOS_ATENDIMENTO_PADRAO];
    agendaAgendamentos = [];
  }

  if (prev) prev.addEventListener('click', () => {
    if (agendaSemanaOffset <= 0) return;
    agendaSemanaOffset--;
    renderAgendaCliente();
  });
  if (next) next.addEventListener('click', () => {
    agendaSemanaOffset++;
    renderAgendaCliente();
  });

  renderAgendaCliente();
}

async function carregarHistoricoAtendimentos() {
  const lista = document.getElementById('client-history-list');
  if (!lista || !CLIENT_ID) return;

  const pega = async (url, padrao) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return padrao;
      return await res.json();
    } catch (e) {
      return padrao;
    }
  };

  const [appts, rels] = await Promise.all([
    pega('/api/appointments', []),
    pega('/api/relatorios?clientId=' + encodeURIComponent(CLIENT_ID), [])
  ]);
  const meusAppts = (appts || []).filter(a => a.clientRef === CLIENT_ID);
  const itens = [];

  meusAppts.forEach(a => {
    const concluido = a.status === 'done';
    itens.push({
      tipo: 'Atendimento',
      titulo: a.taxType || 'Atendimento contábil',
      data: formatarDataHistorico(a.date, a.time),
      status: concluido ? 'Concluído' : (a.status === 'active' ? 'Em atendimento' : 'Agendado'),
      concluido,
      acao: 'section-chat',
      icone: concluido ? 'fa-circle-check' : 'fa-calendar-days'
    });
  });

  (rels || []).forEach(r => {
    itens.push({
      tipo: 'Relatório',
      titulo: r.titulo || 'Relatório de atendimento',
      data: r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : 'Disponível',
      status: 'Disponível',
      concluido: true,
      acao: 'section-documentos',
      icone: 'fa-file-lines'
    });
  });

  if (!itens.length) {
    lista.innerHTML =
      '<div class="history-empty">' +
        '<i class="fa-regular fa-clock"></i>' +
        '<h3>Nenhum atendimento no histórico ainda</h3>' +
        '<p>Quando você agendar ou concluir um atendimento, ele aparece aqui com documentos e relatório.</p>' +
      '</div>';
    return;
  }

  lista.innerHTML = '';
  itens.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML =
      `<div class="history-icon"><i class="fa-solid ${item.icone}"></i></div>` +
      '<div class="history-details">' +
        `<span>${escapeHtml(item.tipo)}</span>` +
        `<h4>${escapeHtml(item.titulo)}</h4>` +
        `<p>${escapeHtml(item.data)}</p>` +
      '</div>' +
      `<span class="status-badge ${item.concluido ? 'success' : ''}">${escapeHtml(item.status)}</span>` +
      '<div class="history-actions">' +
        `<button class="btn-utility ${item.concluido ? 'primary' : ''}" type="button" data-history-target="${item.acao}">Ver</button>` +
      '</div>';
    card.querySelector('[data-history-target]').addEventListener('click', () => abrirSecaoCliente(item.acao));
    lista.appendChild(card);
  });
}

function formatarDataHistorico(date, time) {
  const iso = normalizeAppointmentDate(date);
  if (!iso || iso === date) return `${date || 'Data não definida'}${time ? ' às ' + time : ''}`;
  const d = new Date(iso + 'T12:00:00');
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}${time ? ' às ' + time : ''}`;
}

function renderAgendaCliente() {
  const grid = document.getElementById('agenda-cliente-grid');
  const periodo = document.getElementById('agenda-cliente-periodo');
  const dica = document.getElementById('agenda-cliente-dica');
  const prev = document.getElementById('agenda-cliente-prev');
  if (!grid) return;

  const dias = semanaAgenda(agendaSemanaOffset);
  const ocupados = new Set((agendaAgendamentos || [])
    .filter(a => a.status !== 'done')
    .map(a => `${normalizeAppointmentDate(a.date)}|${a.time}`));
  const agora = new Date();
  const hojeIso = isoLocal(agora);
  const horaAgora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (periodo && dias.length) {
    periodo.textContent = `${dataLabelCurta(dias[0])} a ${dataLabelCurta(dias[dias.length - 1])}`;
  }
  if (prev) prev.disabled = agendaSemanaOffset === 0;

  grid.innerHTML = '';
  let primeiroLivre = null;
  dias.forEach(dia => {
    const iso = isoLocal(dia);
    const coluna = document.createElement('div');
    coluna.className = 'agenda-dia';
    coluna.innerHTML =
      `<div class="agenda-dia-head"><strong>${dia.toLocaleDateString('pt-BR', { weekday: 'short' })}</strong><span>${dataLabelCurta(dia)}</span></div>` +
      '<div class="agenda-slots"></div>';
    const slots = coluna.querySelector('.agenda-slots');

    HORARIOS_ATENDIMENTO.forEach(hora => {
      const ocupado = ocupados.has(`${iso}|${hora}`);
      const passado = iso === hojeIso && hora <= horaAgora;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agenda-slot' + (ocupado ? ' ocupado' : '') + (passado ? ' passado' : '');
      btn.dataset.date = iso;
      btn.dataset.time = hora;
      btn.textContent = hora;
      btn.disabled = ocupado || passado;
      btn.title = ocupado ? 'Horário ocupado' : (passado ? 'Horário já passou' : 'Selecionar horário');
      btn.addEventListener('click', () => selecionarHorarioCliente(iso, hora, btn));
      slots.appendChild(btn);
      if (!primeiroLivre && !btn.disabled) primeiroLivre = { iso, hora, btn };
    });

    grid.appendChild(coluna);
  });

  const atualDate = document.getElementById('checkout-date')?.value;
  const atualTime = document.getElementById('checkout-time')?.value;
  const escolhido = atualDate && atualTime
    ? grid.querySelector(`[data-date="${CSS.escape(atualDate)}"][data-time="${CSS.escape(atualTime)}"]`)
    : null;
  if (escolhido && !escolhido.disabled) escolherBotaoAgenda(escolhido, atualDate, atualTime);
  else if (primeiroLivre) escolherBotaoAgenda(primeiroLivre.btn, primeiroLivre.iso, primeiroLivre.hora);
  else if (dica) {
    dica.textContent = 'Não há horários livres nesta semana. Avance para a próxima semana.';
    document.getElementById('checkout-date').value = '';
    document.getElementById('checkout-time').value = '';
  }
}

function escolherBotaoAgenda(btn, date, time) {
  btn.dataset.date = date;
  btn.dataset.time = time;
  selecionarHorarioCliente(date, time, btn);
}

function selecionarHorarioCliente(date, time, btn) {
  document.querySelectorAll('.agenda-slot.selecionado').forEach(el => el.classList.remove('selecionado'));
  btn.classList.add('selecionado');
  document.getElementById('checkout-date').value = date;
  document.getElementById('checkout-time').value = time;
  const dica = document.getElementById('agenda-cliente-dica');
  if (dica) {
    const d = new Date(date + 'T12:00:00');
    dica.textContent = `Selecionado: ${d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às ${time}.`;
  }
}

async function loadServicos() {
  const list = document.getElementById('servicos-list');
  if (!list) return;
  try {
    const res = await fetch('/api/servicos');
    const servicos = await res.json();
    list.innerHTML = '';
    servicos.forEach(s => {
      const card = document.createElement('div');
      card.className = 'servico-option';
      card.dataset.id = s.id;
      card.style.cssText = 'border:1px solid var(--color-border);border-radius:10px;padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;transition:all .15s;';
      card.innerHTML = `
        <div>
          <div style="font-weight:600;color:var(--color-pine);">${s.name}</div>
          <div style="font-size:12px;color:var(--color-text-secondary);">${s.description || ''}</div>
        </div>
        <div style="font-weight:700;color:var(--color-coral);white-space:nowrap;">R$ ${s.price.toFixed(2).replace('.', ',')}</div>
      `;
      card.addEventListener('click', () => selectServico(s.id));
      list.appendChild(card);
    });
    // Link gerado no painel financeiro já abre com o serviço escolhido.
    const preselecionado = new URLSearchParams(location.search).get('servico');
    if (preselecionado && servicos.some(s => String(s.id) === preselecionado)) selectServico(preselecionado);
  } catch (e) {
    list.innerHTML = '<p style="color:var(--color-coral);font-size:13px;">Não foi possível carregar os serviços.</p>';
  }
}

function selectServico(id) {
  selectedServicoId = id;
  document.querySelectorAll('.servico-option').forEach(el => {
    const on = el.dataset.id === id;
    el.style.borderColor = on ? 'var(--color-coral)' : 'var(--color-border)';
    el.style.background = on ? 'rgba(255,127,80,0.08)' : 'white';
  });
}

async function gerarPagamentoPix() {
  const msg = document.getElementById('checkout-msg');
  msg.style.display = 'none';
  if (!selectedServicoId) {
    msg.textContent = 'Selecione um serviço primeiro.';
    msg.style.display = 'block';
    return;
  }
  const date = document.getElementById('checkout-date').value;
  const time = document.getElementById('checkout-time').value;
  if (!date || !time) {
    msg.textContent = 'Selecione um horário disponível na agenda.';
    msg.style.display = 'block';
    return;
  }
  const btn = document.getElementById('btn-gerar-pix');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando Pix...';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID, servicoId: selectedServicoId, date, time })
    });

    if (res.status === 503) {
      msg.textContent = 'Pagamento indisponível: o Asaas ainda não está configurado no servidor (.env).';
      msg.style.display = 'block';
      return;
    }
    if (!res.ok) {
      msg.textContent = 'Erro ao gerar o pagamento. Tente novamente.';
      msg.style.display = 'block';
      return;
    }

    const data = await res.json();
    // mostra a etapa de pagamento
    document.getElementById('checkout-form').style.display = 'none';
    const pay = document.getElementById('checkout-payment');
    pay.style.display = 'block';
    document.getElementById('pix-resumo').textContent =
      `${data.servico.name} — R$ ${data.valor.toFixed(2).replace('.', ',')} · ${date} às ${time}`;
    document.getElementById('pix-qr').src = 'data:image/png;base64,' + data.pixImage;
    document.getElementById('pix-copia-cola').value = data.pixPayload;
    document.getElementById('pix-invoice').href = data.invoiceUrl || '#';

    startPolling(data.cobrancaId, date, time, data.servico.name);
  } catch (e) {
    msg.textContent = 'Falha de conexão ao gerar o pagamento.';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> Gerar pagamento Pix';
  }
}

// ==== RADAR FISCAL (Serpro Mock) ====
async function carregarRadarFiscal() {
  if (!clienteLogado) return;
  const section = document.getElementById('section-radar');
  if (!section) return;

  // Se o cliente não tem a assinatura, mostra a tela estática/demo (vender assinatura)
  if (!clienteLogado.recorrente) {
    // A tela original já é a de venda, não precisamos mexer no HTML base.
    return;
  }

  // Se tiver assinatura, busca os dados da API simulando o Serpro
  try {
    const res = await fetch('/api/radar-fiscal', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('sb_session_token')}` }
    });
    if (!res.ok) throw new Error('Falha ao carregar Radar Fiscal');
    
    const radar = await res.json();
    renderRadarAtivo(radar);
  } catch (e) {
    console.error('Radar Fiscal erro:', e);
  }
}

function renderRadarAtivo(radar) {
  const container = document.getElementById('section-radar');
  const isAlert = radar.status === 'alert';
  
  let caixasHtml = '';
  if (radar.caixaPostal && radar.caixaPostal.mensagens.length > 0) {
    caixasHtml = radar.caixaPostal.mensagens.map(m => `
      <div style="padding: 16px; border-bottom: 1px solid var(--color-border); display: flex; gap: 16px; align-items: center; background: #fff;">
        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-coral); color: white; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-envelope-open-text"></i></div>
        <div>
           <h4 style="font-size: 14px; margin: 0; color: var(--color-pine);">${m.assunto}</h4>
           <span style="font-size: 11px; color: var(--color-text-secondary);">${new Date(m.data).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    `).join('');
  } else {
    caixasHtml = `<div style="padding: 16px; font-size: 13px; color: var(--color-text-secondary); text-align: center;">Nenhuma nova mensagem na caixa postal.</div>`;
  }

  container.innerHTML = `
    <div class="panel-header-desc" style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h2><i class="fa-solid fa-shield-halved" style="color: var(--color-coral); margin-right: 8px;"></i> Radar Fiscal</h2>
        <p>Monitoramento 24h da saúde do seu <strong>${radar.documento}</strong> (Sincronizado com Serpro/e-CAC).</p>
      </div>
      <span class="status-badge" style="background: rgba(46,204,113,0.1); color: #27AE60; border: 1px solid rgba(46,204,113,0.3); padding: 6px 12px; font-size: 13px; font-weight: 600;">
        <i class="fa-solid fa-satellite-dish fa-beat"></i> Monitoramento Ativo
      </span>
    </div>

    ${isAlert ? `
      <div style="background: #FDEDEC; padding: 16px; border-radius: var(--radius-md); border: 1px solid #E74C3C; margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
         <div style="font-size: 32px; color: #E74C3C;"><i class="fa-solid fa-circle-exclamation"></i></div>
         <div>
           <h3 style="color: #C0392B; font-size: 16px; margin: 0 0 4px 0;">Alerta: Pendências Encontradas</h3>
           <p style="color: #E74C3C; font-size: 13px; margin: 0;">Foi detectada uma pendência nos sistemas do Governo. Consulte seu contador no chat para resolver.</p>
         </div>
      </div>
    ` : `
      <div style="background: #E8F8F5; padding: 16px; border-radius: var(--radius-md); border: 1px solid #2ECC71; margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
         <div style="font-size: 32px; color: #2ECC71;"><i class="fa-solid fa-circle-check"></i></div>
         <div>
           <h3 style="color: #27AE60; font-size: 16px; margin: 0 0 4px 0;">Tudo Certo!</h3>
           <p style="color: #2ECC71; font-size: 13px; margin: 0;">Seu CPF/CNPJ está regular e sem pendências ativas.</p>
         </div>
      </div>
    `}

    <h3 style="font-size: 16px; color: var(--color-pine); margin-bottom: 16px;">Situação das Certidões (CNDs)</h3>
    <div class="responsive-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 32px;">
      <div style="background: white; padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); border-left: 4px solid ${isAlert ? '#E74C3C' : '#2ECC71'};">
         <h4 style="font-size: 14px; color: var(--color-text-primary); margin-bottom: 12px;"><i class="fa-solid fa-building-columns" style="color: ${isAlert ? '#E74C3C' : '#2ECC71'}; margin-right: 6px;"></i> Receita Federal e PGFN</h4>
         <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: var(--color-text-secondary);">Status:</span>
            <span style="font-size: 12px; font-weight: 600; color: ${isAlert ? '#C0392B' : '#27AE60'}; background: ${isAlert ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)'}; padding: 4px 8px; border-radius: 8px;">${radar.cnd.status === 'negativa' ? 'Regular (Negativa)' : 'Com Pendências'}</span>
         </div>
         <p style="font-size: 11px; margin-top: 8px; color: var(--color-text-secondary);">${radar.cnd.mensagem}</p>
      </div>
    </div>

    <h3 style="font-size: 16px; color: var(--color-pine); margin-bottom: 16px;">Caixa Postal (e-CAC)</h3>
    <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--color-border); overflow: hidden;">
      ${caixasHtml}
    </div>
  `;
}

function startPolling(cobrancaId, date, time, servicoName) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/checkout/${cobrancaId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'paid') {
        clearInterval(pollTimer);
        showCheckoutSuccess(date, time, servicoName);
      }
    } catch (e) { /* segue tentando */ }
  }, 4000);
}

function showCheckoutSuccess(date, time, servicoName) {
  document.getElementById('checkout-payment').style.display = 'none';
  const ok = document.getElementById('checkout-success');
  ok.style.display = 'block';
  document.getElementById('success-msg').textContent =
    `${servicoName} · ${date} às ${time}. Seu atendimento começará no horário agendado.`;
    
  // Bloquear o chat automaticamente na mesma API usada pelo painel do contador.
  fetch('/api/clients/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, status: 'locked' })
  }).then(() => {
      // Atualizar a mensagem do overlay
      const overlay = document.getElementById('chat-locked-overlay');
      if (overlay) {
        overlay.querySelector('strong').innerHTML = `<i class="fa-solid fa-calendar"></i> ${date} às ${time}`;
        overlay.style.display = 'flex';
      }

      // Emitir broadcast para o contador saber (opcional, ele vai ver quando carregar)
      if (window.sb && !(window.OC_CONFIG?.TESTE_CLIENTE_SEM_LOGIN?.enabled && window.OC_ROLE === 'cliente')) {
        const ch = window.sb.channel('oc-lock-' + CLIENT_ID);
        ch.send({ type: 'broadcast', event: 'lock_change', payload: { locked: true, status: 'locked' } });
      }
    }).catch(() => {});
}

// Busca as mensagens já salvas e popula o chat na primeira carga.
async function loadClientHistory() {
  const history = document.getElementById('client-chat-history');
  try {
    const res = await fetch('/api/clients');
    const clients = await res.json();
    const client = clients[CLIENT_ID];
    if (!client) return;

    clienteLogado = client; // Guarda globalmente para outras features (ex: Radar Fiscal)
    if (!Array.isArray(client.messages)) return;

    // Atualiza o cabeçalho com a identidade do cliente ativo.
    const nameEl = document.getElementById('client-header-name');
    const docEl = document.getElementById('client-header-doc');
    const avatarEl = document.getElementById('client-header-avatar');
    if (nameEl) nameEl.textContent = client.name || '';
    if (docEl) docEl.textContent = client.cpf || '';
    if (avatarEl) avatarEl.textContent = client.avatar || '';

    // Limpa o seed estático do HTML antes de renderizar o histórico real.
    if (history) history.innerHTML = '';
    ultimoDiaDesenhado = null;
    renderedMessageIds.clear();
    client.messages.forEach(appendMessageToChat);
  } catch (e) {
    console.error('Falha ao carregar histórico do cliente:', e);
  }
}

// Navigation Handling (SPA routing)
function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const targetSectionId = button.getAttribute("data-target");
      
      // Remove active class from all nav items
      document.querySelectorAll(".app-sidebar-nav .nav-item").forEach(el => el.classList.remove("active"));
      button.classList.add("active");
      
      // Hide all panels
      document.querySelectorAll(".content-panel").forEach(panel => panel.classList.remove("active"));
      
      // Show target panel
      const targetPanel = document.getElementById(targetSectionId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        if (targetSectionId === 'section-chat') {
          clearClienteBadge();
          marcarTudoLido();
          const h = document.getElementById('client-chat-history');
          if (h) rolarParaOFim(h);
        }
      }
    });
  });
}

// Dia do último separador desenhado, para não repetir "Hoje" a cada mensagem.
let ultimoDiaDesenhado = null;

// Rolar sozinho só faz sentido se a pessoa já está no fim. Se ela subiu para
// reler algo, puxar a tela de volta seria arrancar a leitura dela.
function estaNoFim(history) {
  return history.scrollHeight - history.scrollTop - history.clientHeight < 80;
}
function rolarParaOFim(history) {
  history.scrollTop = history.scrollHeight;
}

function separadorSePreciso(msgObj, history) {
  const chave = OCTempo.diaChave(msgObj);
  if (!chave || chave === ultimoDiaDesenhado) return;
  ultimoDiaDesenhado = chave;
  const sep = document.createElement('div');
  sep.className = 'chat-dia';
  sep.innerHTML = `<span>${OCTempo.diaLabel(OCTempo.data(msgObj))}</span>`;
  history.appendChild(sep);
}

// O rodapé da bolha do cliente: horário + situação do envio.
// pendente → relógio, enviada → ✓, lida → ✓✓.
// Quando falha não há rodapé: o horário de uma mensagem que não saiu não quer
// dizer nada, e o botão de reenviar já explica o que houve.
function rodapeDaBolha(msgObj) {
  if (msgObj._status === 'falhou') return '';
  const hora = OCTempo.hora(msgObj);
  if (msgObj.sender !== 'client') return `<span class="chat-time">${hora}</span>`;

  let situacao;
  if (msgObj._status === 'pendente') situacao = '<i class="fa-regular fa-clock"></i>';
  else if (msgObj.readAt)            situacao = '<i class="fa-solid fa-check-double lida"></i>';
  else                               situacao = '<i class="fa-solid fa-check"></i>';

  return `<span class="chat-time">${hora} ${situacao}</span>`;
}

// O texto vai embrulhado em .bolha-texto porque o horário é posicionado no
// canto inferior direito DENTRO da bolha, como no WhatsApp. O embrulho recebe
// um espaçador no fim (::after no CSS) que reserva o lugar do horário na última
// linha — sem ele, o texto passaria por baixo da hora.
function conteudoDaBolha(msgObj) {
  if (msgObj.type === 'doc-upload') {
    return `<span class="bolha-texto"><i class="fa-solid fa-file-pdf"></i> Arquivo enviado: ${escapeHtml(msgObj.docName)}</span>`;
  }
  if (msgObj.type === 'relatorio-card') {
    return `<div class="relatorio-card-chat">` +
      `<i class="fa-solid fa-file-lines"></i>` +
      `<div>${escapeHtml(msgObj.text)}</div>` +
      `<button type="button" class="btn-baixar-rel" onclick="baixarRelatorioMaisRecente()">` +
        `<i class="fa-solid fa-download"></i> Baixar PDF</button>` +
      `</div>`;
  }
  return `<span class="bolha-texto">${msgObj.text}</span>`;
}

function pintarBolha(bubble, msgObj) {
  bubble.className = `chat-bubble ${msgObj.sender === 'client' ? 'cliente' : 'contador'}`;
  if (msgObj._status === 'pendente') bubble.classList.add('pendente');
  if (msgObj._status === 'falhou') bubble.classList.add('falhou');

  bubble.innerHTML = conteudoDaBolha(msgObj) + rodapeDaBolha(msgObj);

  if (msgObj._status === 'falhou') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'chat-retry';
    retry.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Não enviou — tocar para tentar de novo';
    retry.addEventListener('click', () => enviarMensagem(msgObj, bubble));
    bubble.appendChild(retry);
  }
}

function appendMessageToChat(msgObj) {
  const history = document.getElementById('client-chat-history');
  if (!history) return;

  // Dedupe: ignora mensagens já renderizadas (ex.: eco do próprio envio).
  if (msgObj.id) {
    if (renderedMessageIds.has(msgObj.id)) return;
    renderedMessageIds.add(msgObj.id);
  }

  const colado = estaNoFim(history);
  separadorSePreciso(msgObj, history);

  const bubble = document.createElement('div');
  if (msgObj.id) bubble.dataset.msgId = msgObj.id;
  pintarBolha(bubble, msgObj);
  history.appendChild(bubble);

  // Mensagem própria sempre puxa a tela; a do contador só se já estávamos no fim.
  if (colado || msgObj.sender === 'client') rolarParaOFim(history);

  // Chegou mensagem do contador com o chat aberto? Então já foi lida.
  if (msgObj.sender !== 'client' && chatEstaVisivel()) marcarTudoLido();
  // Relatório novo entregue: atualiza documentos, histórico, linha do tempo e
  // card de avaliação. Antes só a lista de documentos mudava; a Home ainda
  // podia parecer "em andamento" até recarregar.
  if (msgObj.type === 'relatorio-card') atualizarPosRelatorio();
  return bubble;
}

async function atualizarPosRelatorio() {
  await carregarRelatorios();
  await montarLinhaDoTempo();
  await carregarHistoricoAtendimentos();
}

function chatEstaVisivel() {
  const chat = document.getElementById('section-chat');
  return !!(chat && chat.classList.contains('active') && !document.hidden);
}

function marcarTudoLido() {
  OCChat.marcarLidas(CLIENT_ID);
}

// Aplica o ✓✓ quando o contador lê o que mandamos.
function aplicarLeitura(msgObj) {
  const bubble = document.querySelector(`#client-chat-history [data-msg-id="${CSS.escape(msgObj.id)}"]`);
  if (bubble) pintarBolha(bubble, msgObj);
}

// ---------------------------------------------------------------------------
// Envio. A bolha aparece na hora e só depois vai ao banco: quem digitou vê o
// que digitou imediatamente, e a espera da rede vira um detalhe (o relógio).
// Se falhar, a mensagem CONTINUA na tela com o botão de tentar de novo — sumir
// em silêncio, num atendimento pago, é o pior desfecho possível.
// ---------------------------------------------------------------------------
async function enviarMensagem(msgObj, bubbleExistente) {
  msgObj._status = 'pendente';
  const bubble = bubbleExistente || appendMessageToChat(msgObj);
  if (bubbleExistente) pintarBolha(bubble, msgObj);

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID, message: msgObj })
    });
    if (!res.ok) throw new Error('resposta ' + res.status);
    delete msgObj._status;
  } catch (e) {
    console.error('Falha ao enviar mensagem:', e);
    msgObj._status = 'falhou';
  }
  if (bubble) pintarBolha(bubble, msgObj);
}

function setupChat() {
  const form = document.getElementById('client-chat-form');
  const input = document.getElementById('client-chat-input');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const texto = input.value.trim();
    if (!texto) return;

    const agora = new Date();
    enviarMensagem({
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      sender: 'client',
      text: texto,
      time: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: agora.toISOString(),
      type: 'internal'
    });

    input.value = '';
  });

  input.addEventListener('input', () => {
    if (input.value.trim() && typingCanal) typingCanal.aviso('client');
  });

  // Voltar para a aba com o chat aberto conta como ler.
  document.addEventListener('visibilitychange', () => {
    if (chatEstaVisivel()) { marcarTudoLido(); clearClienteBadge(); }
  });
}

// ---------------------------------------------------------------------------
// "Digitando..." — some sozinho depois de 3s sem aviso novo, senão um contador
// que fechou a aba no meio de uma frase deixaria o indicador ligado para sempre.
// ---------------------------------------------------------------------------
let typingCanal = null;
let typingTimer = null;

function setupTyping() {
  montarIndicadorDigitando();
  typingCanal = OCChat.typing(CLIENT_ID, {
    onTyping: (from) => { if (from === 'agent') mostrarDigitando(); }
  });
}

// O indicador nasce aqui, e não no HTML, para viver junto com a lógica que o usa.
function montarIndicadorDigitando() {
  if (document.getElementById('oc-digitando')) return;
  const area = document.querySelector('#section-chat .chat-input-area');
  if (!area) return;
  const el = document.createElement('div');
  el.id = 'oc-digitando';
  el.className = 'chat-digitando';
  el.innerHTML = '<span class="ponto"></span><span class="ponto"></span><span class="ponto"></span>'
               + '<em></em>';
  el.querySelector('em').textContent = PERFIL_CONTADOR.nome + ' está digitando';
  area.parentElement.insertBefore(el, area);
}

function mostrarDigitando() {
  const el = document.getElementById('oc-digitando');
  if (el) el.classList.add('ativo');
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    const e2 = document.getElementById('oc-digitando');
    if (e2) e2.classList.remove('ativo');
  }, 3000);
}

window.uploadChatAttachment = function() {
  document.getElementById('chat-file-upload').click();
};

window.subscribeRadar = async function() {
  const btn = document.getElementById('btn-subscribe-radar');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;
  }
  
  try {
    const res = await fetch('/api/subscribe-radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_ref: OC.auth.user.id,
        name: OC.auth.user.name,
        cpfCnpj: OC.auth.user.cpf,
        email: OC.auth.user.email
      })
    });
    
    if (res.ok) {
      alert('Inscrição no Radar Fiscal realizada com sucesso! Você receberá os detalhes de pagamento por e-mail.');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Radar Ativado';
        btn.style.background = '#2ECC71';
      }
    } else {
      alert('Erro ao processar assinatura. Tente novamente mais tarde.');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-headset"></i> Assinar Radar Fiscal';
        btn.disabled = false;
      }
    }
  } catch (e) {
    console.error(e);
    alert('Erro de conexão.');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-headset"></i> Assinar Radar Fiscal';
      btn.disabled = false;
    }
  }
};

function setupFileUpload() {
  const fileInput = document.getElementById('file-upload');
  const uploadZone = document.getElementById('upload-zone');
  if (!fileInput) return;
  const status = document.getElementById('upload-status');

  // Carrega os documentos já enviados
  loadDocumentos();

  const processarArquivo = async (file) => {
    if (!file) return;
    if (!/application\/pdf|image\/png|image\/jpeg/.test(file.type)) {
      if (status) {
        status.className = 'upload-status erro';
        status.textContent = 'Formato não aceito. Envie PDF, JPG ou PNG.';
      }
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (status) {
        status.className = 'upload-status erro';
        status.textContent = 'Arquivo maior que 10MB.';
      }
      return;
    }
    if (status) {
      status.className = 'upload-status';
      status.textContent = 'Enviando ' + file.name + '...';
    }

    // lê como base64 e envia de verdade ao servidor (Supabase Storage)
    const dataBase64 = await fileToBase64(file);
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_ID,
          fileName: file.name,
          mime: file.type,
          dataBase64,
          uploadedBy: 'client'
        })
      });
      if (!res.ok) throw new Error('resposta ' + res.status);
      await loadDocumentos();
      montarLinhaDoTempo();
      if (status) {
        status.className = 'upload-status ok';
        status.textContent = 'Arquivo enviado com sucesso';
      }
    } catch (err) {
      console.error('Erro ao enviar documento:', err);
      if (status) {
        status.className = 'upload-status erro';
        status.textContent = 'Não consegui enviar. Tente de novo.';
      }
    }
  };

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    fileInput.value = '';
    processarArquivo(file);
  });

  if (uploadZone) {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('arrastando');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('arrastando'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('arrastando');
      processarArquivo(e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
    });
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]); // remove o prefixo data:
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadDocumentos() {
  const meus = document.getElementById('client-doc-list');
  const recebidos = document.getElementById('contador-doc-list');
  if (!meus) return;
  try {
    const res = await fetch('/api/documentos?clientId=' + encodeURIComponent(CLIENT_ID));
    const docs = await res.json();

    // Separa por quem enviou: antes tudo caía em "Meus Arquivos (Enviados)",
    // inclusive o que o contador tinha mandado.
    const desenhar = (box, lista, vazio) => {
      if (!box) return;
      if (!lista.length) {
        box.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);padding:12px 0;">${vazio}</p>`;
        return;
      }
      box.innerHTML = '';
      lista.forEach(d => {
        const icon = (d.mime || '').startsWith('image/') ? 'fa-file-image' : 'fa-file-pdf';
        const item = document.createElement('div');
        item.className = 'doc-item';
        item.innerHTML = `
          <div class="doc-info">
            <i class="fa-solid ${icon}"></i>
            <div>
              <div class="doc-name">${escapeHtml(d.fileName)}</div>
              <div class="doc-meta">${(d.size/1024).toFixed(0)} KB</div>
            </div>
          </div>
          <a class="btn-attach" href="${d.url}" target="_blank" title="Abrir"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        `;
        box.appendChild(item);
      });
    };

    desenhar(meus, docs.filter(d => d.uploadedBy === 'client'), 'Nenhum documento enviado ainda.');
    desenhar(recebidos, docs.filter(d => d.uploadedBy !== 'client'), 'Nenhum documento recebido do contador ainda.');
  } catch (e) {
    console.error('Erro ao carregar documentos:', e);
  }
}

let clienteUnreadCount = 0;
let originalClienteTitle = document.title;

function incrementClienteBadge() {
  clienteUnreadCount++;
  const badge = document.getElementById('badge-atendimentos-cliente');
  if (badge) {
    badge.textContent = clienteUnreadCount;
    badge.style.display = 'block';
  }
  document.title = `(${clienteUnreadCount}) Nova mensagem - Área do Cliente`;
}

function clearClienteBadge() {
  clienteUnreadCount = 0;
  const badge = document.getElementById('badge-atendimentos-cliente');
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
  document.title = originalClienteTitle;
}
