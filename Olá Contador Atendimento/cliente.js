// Identidade do cliente logado — vem da sessão autenticada (Supabase Auth).
let CLIENT_ID = null;
// Ids já renderizados, para não duplicar mensagens ecoadas pelo Realtime.
const renderedMessageIds = new Set();
let currentChatStatus = 'active';
// Dia do último separador desenhado, para não repetir "Hoje" a cada mensagem.
let ultimoDiaDesenhado = null;
let clienteLogado = null; // Guardará as configs e dados do cliente
let onboardingAtivo = false; // true entre o pagamento e a triagem obrigatória ser enviada

document.addEventListener('DOMContentLoaded', async () => {
  // Exige login de cliente; redireciona pro login se não autorizado.
  const ctx = await OCAuth.guard('cliente');
  if (!ctx) return;
  CLIENT_ID = ctx.clientId;

  setupNavigation();

  // Retomada após reload: se o cliente pagou, começou o onboarding e recarregou
  // a página no meio do caminho, não repete as telas de boas-vindas — só
  // garante que ele continue preso na triagem até enviá-la.
  if (localStorage.getItem(onboardingStorageKey())) {
    onboardingAtivo = true;
    document.body.classList.add('onboarding-bloqueio');
    abrirSecaoCliente('section-triagem');
  }

  setupChat();
  setupFileUpload();
  setupLogout();
  setupRecolherMenu();
  setupRecolherCentralAtendimento();
  setupCriarSenha();
  setupPerfilSenha();
  setupPerfilOperacional();

  // Chat em tempo real via Supabase Realtime (o RLS só entrega as mensagens deste cliente).
  OCRealtime.subscribe({
    onMessage: (clientId, message) => {
      if (clientId !== CLIENT_ID) return;
      appendMessageToChat(message);
      // Só avisa com o badge se o chat não estiver aberto na tela.
      if (!chatEstaVisivel() && message.sender !== 'client') incrementClienteBadge();
      if (clienteLogado) {
        clienteLogado.messages = clienteLogado.messages || [];
        clienteLogado.messages.push(message);
      }
    },
    // Hoje só muda o read_at: é o contador confirmando que leu.
    onMessageUpdate: (clientId, message) => {
      if (clientId === CLIENT_ID) aplicarLeitura(message);
    }
  });

  setupTyping();

  // chatEstaVisivel() também confere se a ABA está em foco (!document.hidden)
  // — não só se a seção Atendimento está aberta. Isso é certo pra decidir se
  // acende o badge quando uma mensagem chega. Mas sem este listener, se o
  // badge acendia com o cliente trocado de aba (ex.: checando outro app) e
  // ele já estava com o Atendimento aberto, nada zerava o badge de volta: ele
  // ficava "travado" aceso até o cliente clicar em outro menu e voltar. Ao
  // reganhar o foco com o Atendimento já ativo, reavalia e limpa.
  document.addEventListener('visibilitychange', () => {
    if (chatEstaVisivel()) { marcarTudoLido(); clearClienteBadge(); }
  });

  // Carrega o histórico persistido (fonte da verdade = banco).
  await loadClientHistory();

  // Onboarding obrigatório pós-pagamento — caminho real (checkout público +
  // link mágico), não só o embutido no portal (ver showCheckoutSuccess). Sem
  // isso, quem chegava aqui pela primeira vez caía direto no dashboard sem
  // nunca passar pela triagem: nada disparava o bloqueio, porque a flag só
  // era ligada dentro do fluxo de recompra já logado.
  if (clienteLogado && clienteLogado.onboardingPendente && !localStorage.getItem(onboardingStorageKey())) {
    localStorage.setItem(onboardingStorageKey(), '1');
    onboardingAtivo = true;
    document.body.classList.add('onboarding-bloqueio');
    personalizarOnboarding();
    preencherAgendamentoOnboarding();
    mostrarOnboarding('obrigado');
  }

  if (chatEstaVisivel()) marcarTudoLido();
  iniciarSincronizacaoDeLeituraCliente();

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

  await carregarBadgeCaixaPostalCliente();
  const formCaixaPostal = document.getElementById('form-caixa-postal-cliente');
  if (formCaixaPostal) formCaixaPostal.addEventListener('submit', enviarMensagemCaixaPostalCliente);
  const btnVoltarCaixaPostal = document.getElementById('btn-voltar-caixa-postal');
  if (btnVoltarCaixaPostal) btnVoltarCaixaPostal.addEventListener('click', fecharCaixaPostalCliente);
  const btnNovaMensagem = document.getElementById('btn-nova-mensagem-cliente');
  if (btnNovaMensagem) btnNovaMensagem.addEventListener('click', abrirComposeCaixaPostalCliente);
});

// ------------------------------------------------------------ caixa postal
// Avisos/mensagens com o contador fora do chat ao vivo (que só abre no
// horário agendado) — fica sempre disponível, independente de ter sessão marcada.
// Funciona como uma caixa de e-mail: as mensagens são agrupadas por assunto
// em "conversas" (não existe thread_id no banco, então o assunto faz esse
// papel — é a mesma lógica de agrupar por "Re: mesmo assunto" que um webmail
// usa). A lista mostra só o overview; abrir uma conversa é que revela o
// histórico completo dela e libera o campo de responder.
let caixaPostalClienteMensagens = [];
let caixaPostalModo = 'inbox'; // 'inbox' | 'thread' | 'compose'
let caixaPostalThreadAtiva = null; // assunto (string) da conversa aberta

const ASSUNTO_SEM_CATEGORIA = 'Outro assunto';

async function carregarBadgeCaixaPostalCliente() {
  try {
    const res = await fetch('/api/caixa-postal?clientId=' + encodeURIComponent(CLIENT_ID));
    caixaPostalClienteMensagens = await res.json();
  } catch (e) { caixaPostalClienteMensagens = []; }
  const naoLidas = caixaPostalClienteMensagens.filter(m => m.remetente === 'contador' && !m.lida).length;
  const badge = document.getElementById('badge-caixa-postal-cliente');
  if (badge) { badge.textContent = naoLidas; badge.style.display = naoLidas ? 'flex' : 'none'; }
  renderResumoCaixaPostalDashboard();
}

// Card de resumo da caixa postal na home — separado do card "Últimas
// atualizações" (que mistura chat + caixa postal): esse aqui é só sobre
// mensagens assíncronas, e mostra o total de não lidas e a última recebida.
function renderResumoCaixaPostalDashboard() {
  const box = document.getElementById('dash-caixa-postal-resumo');
  const badge = document.getElementById('dash-caixa-postal-badge');
  if (!box) return;
  const naoLidas = caixaPostalClienteMensagens.filter(m => m.remetente === 'contador' && !m.lida).length;
  if (badge) {
    badge.textContent = naoLidas === 1 ? '1 nova' : `${naoLidas} novas`;
    badge.style.display = naoLidas ? '' : 'none';
  }
  if (!caixaPostalClienteMensagens.length) {
    box.innerHTML = '<p style="font-size:13px;color:var(--color-text-secondary);">Nenhuma mensagem ainda.</p>';
    return;
  }
  const ultima = caixaPostalClienteMensagens.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
  const meuUltima = ultima.remetente === 'cliente';
  box.innerHTML = `
    <div style="background: var(--color-bg); padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="abrirSecaoCliente('section-caixa-postal')">
      <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--color-pine-ultra-light); color: var(--color-pine); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
        <i class="fa-solid fa-envelope${naoLidas ? '' : '-open'}"></i>
      </div>
      <div style="min-width: 0;">
        <strong style="color: var(--color-pine); font-size: 14px; display: block;">${escapeHtml(ultima.assunto || 'Outro assunto')}</strong>
        <span style="color: var(--color-text-secondary); font-size: 12px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${meuUltima ? 'Você: ' : 'Contador: '}${escapeHtml(ultima.mensagem)}</span>
      </div>
    </div>`;
}

// Agrupa as mensagens em conversas por assunto (mensagens sem assunto caem
// todas numa conversa "Outro assunto"), ordenadas da mais recente pra mais antiga.
function agruparCaixaPostalPorAssunto() {
  const porAssunto = new Map();
  caixaPostalClienteMensagens.forEach(m => {
    const chave = m.assunto || ASSUNTO_SEM_CATEGORIA;
    if (!porAssunto.has(chave)) porAssunto.set(chave, []);
    porAssunto.get(chave).push(m);
  });
  const threads = [];
  porAssunto.forEach((mensagens, assunto) => {
    mensagens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const ultima = mensagens[mensagens.length - 1];
    const naoLidas = mensagens.filter(m => m.remetente === 'contador' && !m.lida).length;
    threads.push({ assunto, mensagens, ultima, naoLidas });
  });
  threads.sort((a, b) => new Date(b.ultima.createdAt) - new Date(a.ultima.createdAt));
  return threads;
}

function renderInboxCaixaPostalCliente() {
  const container = document.getElementById('caixa-postal-cliente-inbox');
  if (!container) return;
  atualizarResumoNaoLidasCaixaPostal();
  if (!caixaPostalClienteMensagens.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:40px 0;">Nenhuma mensagem ainda. Clique em <i class="fa-solid fa-pen-to-square"></i> pra escrever pro contador fora do horário do chat — resposta em até 1 dia útil.</p>`;
    return;
  }
  const threads = agruparCaixaPostalPorAssunto();
  container.innerHTML = threads.map(t => {
    const meuUltima = t.ultima.remetente === 'cliente';
    const hora = new Date(t.ultima.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const remetenteLabel = meuUltima ? 'Você' : 'Contador';
    const naoLida = t.naoLidas > 0;
    return `<button type="button" class="caixa-postal-thread-item${naoLida ? ' nao-lida' : ''}" data-assunto="${escapeHtml(t.assunto)}">
      <div class="caixa-postal-thread-topo">
        <span class="caixa-postal-thread-assunto">${naoLida ? '<i class="fa-solid fa-circle caixa-postal-dot"></i>' : ''}${escapeHtml(t.assunto)}</span>
        <span class="caixa-postal-thread-hora">${hora}</span>
      </div>
      <p class="caixa-postal-thread-preview"><strong>${remetenteLabel}:</strong> ${escapeHtml(t.ultima.mensagem)}</p>
    </button>`;
  }).join('');
  container.querySelectorAll('[data-assunto]').forEach(btn => {
    btn.addEventListener('click', () => abrirThreadCaixaPostal(btn.dataset.assunto));
  });
}

function renderThreadCaixaPostalCliente() {
  const container = document.getElementById('caixa-postal-cliente-historico');
  if (!container) return;
  const mensagens = caixaPostalClienteMensagens.filter(m => (m.assunto || ASSUNTO_SEM_CATEGORIA) === caixaPostalThreadAtiva);
  container.innerHTML = mensagens.map(m => {
    const meu = m.remetente === 'cliente';
    const naoLida = !meu && !m.lida;
    const hora = new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `<div class="caixa-postal-msg ${meu ? 'minha' : 'contador'}${naoLida ? ' nao-lida' : ''}">
      <div class="caixa-postal-msg-topo">
        <span class="caixa-postal-msg-remetente">
          <i class="fa-solid ${meu ? 'fa-user' : 'fa-user-tie'}"></i> ${meu ? 'Você' : 'Contador'}
        </span>
        <span class="caixa-postal-msg-hora">${hora}</span>
      </div>
      <p class="caixa-postal-msg-corpo">${escapeHtml(m.mensagem)}</p>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

// Alterna o que aparece na seção: overview (inbox), uma conversa aberta
// (thread) ou o formulário de mensagem nova (compose). Cada visão controla
// o próprio header (título/botão voltar) e se o composer aparece ou não.
function aplicarModoCaixaPostalCliente() {
  const inbox = document.getElementById('caixa-postal-cliente-inbox');
  const thread = document.getElementById('caixa-postal-cliente-historico');
  const composer = document.getElementById('caixa-postal-composer');
  const btnVoltar = document.getElementById('btn-voltar-caixa-postal');
  const btnNova = document.getElementById('btn-nova-mensagem-cliente');
  const titulo = document.getElementById('caixa-postal-titulo');
  const subtitulo = document.getElementById('caixa-postal-subtitulo');
  const assuntoSelect = document.getElementById('caixa-postal-cliente-assunto');
  const input = document.getElementById('caixa-postal-cliente-mensagem');

  const ehInbox = caixaPostalModo === 'inbox';
  const ehThread = caixaPostalModo === 'thread';
  const ehCompose = caixaPostalModo === 'compose';

  if (inbox) inbox.style.display = ehInbox ? 'flex' : 'none';
  if (thread) thread.style.display = ehThread ? 'flex' : 'none';
  if (composer) composer.style.display = ehThread || ehCompose ? 'flex' : 'none';
  if (btnVoltar) btnVoltar.style.display = ehInbox ? 'none' : '';
  if (btnNova) btnNova.style.display = ehInbox ? '' : 'none';
  if (assuntoSelect) assuntoSelect.style.display = ehCompose ? '' : 'none';
  // O ícone do título fica só no h2 base — troca de conteúdo via innerHTML
  // apagaria ele pra sempre (textContent perderia o <i> na primeira troca de
  // modo e ele nunca mais voltaria, mesmo saindo do modo que o removeu).
  if (titulo) {
    if (ehInbox) titulo.innerHTML = '<i class="fa-solid fa-envelope" style="color: var(--color-coral); margin-right: 8px;"></i>Mensagens';
    else if (ehCompose) titulo.innerHTML = '<i class="fa-solid fa-pen-to-square" style="color: var(--color-coral); margin-right: 8px;"></i>Nova mensagem';
    else titulo.innerHTML = '<i class="fa-solid fa-envelope-open-text" style="color: var(--color-coral); margin-right: 8px;"></i>' + escapeHtml(caixaPostalThreadAtiva);
  }
  if (subtitulo) {
    if (ehInbox) subtitulo.textContent = 'Fora do horário do chat ao vivo — resposta em até 1 dia útil.';
    else if (ehCompose) subtitulo.textContent = 'Escolha o assunto e escreva sua mensagem para o contador.';
    else subtitulo.textContent = 'Histórico desta conversa — responda abaixo.';
  }
  if (input) input.placeholder = ehCompose ? 'Escreva sua mensagem...' : 'Responder...';

  const resumo = document.getElementById('caixa-postal-resumo-naolidas');
  if (resumo) resumo.style.display = ehInbox ? '' : 'none';
}

// Indicação visual, além do pontinho por conversa: um aviso no topo da caixa
// contando quantas conversas têm mensagem não lida — aparece assim que o
// cliente abre a seção, sem precisar entrar em cada conversa pra descobrir.
function atualizarResumoNaoLidasCaixaPostal() {
  const resumo = document.getElementById('caixa-postal-resumo-naolidas');
  const texto = document.getElementById('caixa-postal-resumo-naolidas-texto');
  if (!resumo || !texto) return;
  const threads = agruparCaixaPostalPorAssunto();
  const naoLidas = threads.filter(t => t.naoLidas > 0).length;
  if (!naoLidas) { resumo.style.display = 'none'; return; }
  texto.textContent = naoLidas === 1 ? '1 conversa com mensagem não lida' : `${naoLidas} conversas com mensagens não lidas`;
  resumo.style.display = caixaPostalModo === 'inbox' ? '' : 'none';
}

async function abrirCaixaPostalCliente() {
  caixaPostalModo = 'inbox';
  caixaPostalThreadAtiva = null;
  const container = document.getElementById('caixa-postal-cliente-inbox');
  if (container) container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:40px 0;">Carregando...</p>`;
  try {
    const res = await fetch('/api/caixa-postal?clientId=' + encodeURIComponent(CLIENT_ID));
    caixaPostalClienteMensagens = await res.json();
  } catch (e) { caixaPostalClienteMensagens = []; }
  aplicarModoCaixaPostalCliente();
  renderInboxCaixaPostalCliente();
}

// Abre uma conversa específica (por assunto): mostra o histórico completo
// dela e marca as mensagens do contador como lidas. O endpoint de "marcar
// lida" é da caixa toda (não existe granularidade por assunto no banco), mas
// isso é aceitável aqui: só chamamos ele quando o cliente de fato abre e lê
// uma conversa, nunca só por entrar na seção — diferente do comportamento
// antigo, que marcava tudo como lido assim que a aba era aberta.
async function abrirThreadCaixaPostal(assunto) {
  caixaPostalModo = 'thread';
  caixaPostalThreadAtiva = assunto;
  aplicarModoCaixaPostalCliente();
  renderThreadCaixaPostalCliente();
  const input = document.getElementById('caixa-postal-cliente-mensagem');
  if (input) { input.value = ''; input.focus(); }

  const temNaoLida = caixaPostalClienteMensagens.some(m => (m.assunto || ASSUNTO_SEM_CATEGORIA) === assunto && m.remetente === 'contador' && !m.lida);
  if (!temNaoLida) return;
  try {
    await fetch('/api/caixa-postal/marcar-lida', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: CLIENT_ID, remetente: 'cliente' })
    });
    caixaPostalClienteMensagens.forEach(m => { if (m.remetente === 'contador') m.lida = true; });
    renderThreadCaixaPostalCliente();
  } catch (e) { /* silencioso */ }
  await carregarBadgeCaixaPostalCliente();
}

function fecharCaixaPostalCliente() {
  caixaPostalModo = 'inbox';
  caixaPostalThreadAtiva = null;
  aplicarModoCaixaPostalCliente();
  renderInboxCaixaPostalCliente();
}

function abrirComposeCaixaPostalCliente() {
  caixaPostalModo = 'compose';
  caixaPostalThreadAtiva = null;
  aplicarModoCaixaPostalCliente();
  const input = document.getElementById('caixa-postal-cliente-mensagem');
  if (input) { input.value = ''; input.focus(); }
}

async function enviarMensagemCaixaPostalCliente(e) {
  e.preventDefault();
  const input = document.getElementById('caixa-postal-cliente-mensagem');
  const assuntoSelect = document.getElementById('caixa-postal-cliente-assunto');
  const texto = input.value.trim();
  if (!texto) return;
  // Numa resposta o assunto é o da própria conversa aberta; numa mensagem
  // nova, é o que o cliente escolheu no seletor.
  const assunto = caixaPostalModo === 'compose' ? assuntoSelect.value : caixaPostalThreadAtiva;
  input.disabled = true;
  try {
    const res = await fetch('/api/caixa-postal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: CLIENT_ID, remetente: 'cliente', mensagem: texto, assunto })
    });
    if (!res.ok) throw new Error('falha_ao_enviar');
    input.value = '';
    try {
      const resAtual = await fetch('/api/caixa-postal?clientId=' + encodeURIComponent(CLIENT_ID));
      caixaPostalClienteMensagens = await resAtual.json();
    } catch (e2) { /* mantém a lista anterior */ }
    caixaPostalThreadAtiva = assunto;
    caixaPostalModo = 'thread';
    aplicarModoCaixaPostalCliente();
    renderThreadCaixaPostalCliente();
  } catch (err) {
    alert('Não consegui enviar sua mensagem agora. Tente de novo em instantes.');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

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

function formatarCPF(cpf) {
  if (!cpf) return 'CPF: Não informado';
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length === 11) {
    return `CPF: ${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  }
  return cpf.startsWith('CPF:') ? cpf : `CPF: ${cpf}`;
}

function abrirSecaoCliente(id) {
  window.abrirSecaoCliente = abrirSecaoCliente;
  const nav = document.querySelector(`[data-target="${id}"]`);
  if (nav) {
    nav.click();
  } else {
    document.querySelectorAll(".app-sidebar-nav .nav-item").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".content-panel").forEach(panel => panel.classList.remove("active"));
    const targetPanel = document.getElementById(id);
    if (targetPanel) targetPanel.classList.add('active');
  }
}

// Clique no avatar do header: abre o menu com Meu Perfil + Sair juntos, em
// qualquer tamanho de tela (igual ao painel do contador). Antes só o celular
// abria esse menu — no desktop o clique ia direto pro Meu Perfil e o Sair
// ficava num botão solto ao lado.
function toggleAgentMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('agent-profile-menu');
  if (menu) menu.hidden = !menu.hidden;
}
window.toggleAgentMenu = toggleAgentMenu;

function fecharAgentMenuEIr(id) {
  const menu = document.getElementById('agent-profile-menu');
  if (menu) menu.hidden = true;
  abrirSecaoCliente(id);
}
window.fecharAgentMenuEIr = fecharAgentMenuEIr;

// Clique fora do menu fecha ele — igual qualquer dropdown.
document.addEventListener('click', (e) => {
  const menu = document.getElementById('agent-profile-menu');
  if (menu && !menu.hidden && !e.target.closest('.agent-profile-wrap')) {
    menu.hidden = true;
  }
});

function populaPerfilCliente(client) {
  if (!client) return;
  const nomeEl = document.getElementById('perfil-nome');
  const cpfEl = document.getElementById('perfil-cpf');
  const telEl = document.getElementById('perfil-telefone');
  const emailEl = document.getElementById('perfil-email');
  const endEl = document.getElementById('perfil-endereco');
  const servEl = document.getElementById('perfil-servico');

  if (nomeEl) nomeEl.textContent = client.name || 'Não informado';
  if (cpfEl) cpfEl.textContent = formatarCPF(client.cpf);
  if (telEl) telEl.textContent = client.phone || 'Não informado';
  if (emailEl) emailEl.textContent = client.email || 'Não informado';

  let endStr = [];
  if (client.endereco) endStr.push(client.endereco + (client.numero ? `, ${client.numero}` : ''));
  if (client.bairro) endStr.push(client.bairro);
  if (client.cidade || client.estado) endStr.push(`${client.cidade || ''}${client.estado ? ' - ' + client.estado : ''}`.trim());
  if (client.cep) endStr.push(`CEP: ${client.cep}`);
  if (endEl) endEl.textContent = endStr.join(' • ') || 'Endereço não informado';

  if (servEl) servEl.textContent = client.taxType || 'Atendimento Olá, Contador';
  popularPerfilOperacional(client);
}

function valorPermitido(valor, permitidos, fallback) {
  return permitidos.includes(valor) ? valor : fallback;
}

function popularPerfilOperacional(client) {
  if (!client) return;
  const perfil = client.perfilOperacional || {};
  const gov = perfil.govbr || {};
  const comunicacao = perfil.comunicacao || {};
  const preencher = (id, valor) => {
    const campo = document.getElementById(id);
    if (campo) campo.value = valor;
  };
  preencher('perfil-gov-nivel', valorPermitido(gov.nivel, ['nao_sei', 'bronze', 'prata', 'ouro'], 'nao_sei'));
  preencher('perfil-gov-2fa', valorPermitido(gov.doisFatores, ['nao_sei', 'ativa', 'inativa', 'sem_acesso'], 'nao_sei'));
  preencher('perfil-gov-dificuldade', valorPermitido(gov.dificuldade, ['nenhuma', 'esqueci_senha', 'problema_2fa', 'conta_bloqueada', 'nivel_insuficiente', 'nao_sei'], 'nenhuma'));
  preencher('perfil-gov-forma-acesso', valorPermitido(gov.formaAcesso, ['procuracao', 'cofre_temporario', 'assistido', 'eu_executo', 'nao_sei'], 'procuracao'));
  preencher('perfil-canal-preferido', valorPermitido(comunicacao.canalPreferido, ['area_cliente', 'email', 'whatsapp'], 'area_cliente'));
  preencher('perfil-periodo-contato', valorPermitido(comunicacao.melhorPeriodo, ['comercial', 'manha', 'tarde', 'noite'], 'comercial'));
  preencher('perfil-necessidade-comunicacao', String(comunicacao.necessidade || '').slice(0, 500));
  const ciencia = document.getElementById('perfil-gov-ciencia');
  if (ciencia) ciencia.checked = !!perfil.lgpd?.cienciaCredenciaisEm;
  const servico = document.getElementById('perfil-gov-servico-atual');
  if (servico) servico.textContent = client.taxType || 'Atendimento Olá, Contador';
}

function setupPerfilOperacional() {
  const form = document.getElementById('form-perfil-operacional');
  if (!form) return;
  document.getElementById('btn-alternar-senha-gov')?.addEventListener('click', alternarVisibilidadeSenhaGov);
  document.getElementById('btn-enviar-senha-gov')?.addEventListener('click', enviarSenhaGovAoCofre);
  document.getElementById('btn-apagar-senha-gov')?.addEventListener('click', apagarSenhaGovDoCofre);
  document.getElementById('perfil-gov-senha')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    enviarSenhaGovAoCofre();
  });
  carregarStatusCofreGovbr();
  form.addEventListener('submit', async () => {
    const ciencia = document.getElementById('perfil-gov-ciencia');
    const status = document.getElementById('perfil-operacional-status');
    const btn = document.getElementById('btn-salvar-perfil-operacional');
    const mostrarStatus = (texto, erro = false) => {
      if (!status) return;
      status.textContent = texto;
      status.classList.toggle('erro', erro);
    };
    if (!ciencia?.checked) {
      mostrarStatus('Confirme que entendeu a orientação de segurança antes de salvar.', true);
      ciencia?.focus();
      return;
    }

    const atual = clienteLogado?.perfilOperacional || {};
    const cienciaAnterior = atual.lgpd?.cienciaCredenciaisEm || null;
    const perfilOperacional = {
      ...atual,
      govbr: {
        nivel: document.getElementById('perfil-gov-nivel').value,
        doisFatores: document.getElementById('perfil-gov-2fa').value,
        dificuldade: document.getElementById('perfil-gov-dificuldade').value,
        formaAcesso: document.getElementById('perfil-gov-forma-acesso').value,
        atualizadoEm: new Date().toISOString()
      },
      comunicacao: {
        canalPreferido: document.getElementById('perfil-canal-preferido').value,
        melhorPeriodo: document.getElementById('perfil-periodo-contato').value,
        necessidade: document.getElementById('perfil-necessidade-comunicacao').value.trim().slice(0, 500)
      },
      lgpd: {
        ...(atual.lgpd || {}),
        cienciaCredenciaisEm: cienciaAnterior || new Date().toISOString(),
        versaoAviso: '2026-08-06'
      }
    };

    btn.disabled = true;
    mostrarStatus('Salvando…');
    try {
      const res = await fetch('/api/prontuario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: CLIENT_ID, perfilOperacional })
      });
      if (!res.ok) throw new Error('falha_ao_salvar');
      const atualizado = await res.json();
      clienteLogado = atualizado;
      popularPerfilOperacional(atualizado);
      mostrarStatus('Informações salvas. O contador já consegue consultar sua preparação para o atendimento.');
    } catch (erro) {
      console.error('[perfil operacional] falha ao salvar:', erro);
      mostrarStatus('Não foi possível salvar agora. Tente novamente em instantes.', true);
    } finally {
      btn.disabled = false;
    }
  });
}

async function chamarCofreGovbr(action, extra = {}) {
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token || '';
  const res = await fetch('/api/status?acao=govbr-vault', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, clientId: CLIENT_ID, ...extra })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erro = new Error(json.error || 'vault_failed');
    erro.code = json.error;
    throw erro;
  }
  return json;
}

function rotuloStatusCofre(status) {
  return {
    empty: 'Nenhuma senha enviada', pending: 'Protegida no cofre',
    viewed: 'Aberta e apagada', deleted: 'Revogada e apagada', expired: 'Expirada e apagada'
  }[status] || 'Nenhuma senha enviada';
}

function renderStatusCofreGovbr(dados = { status: 'empty' }) {
  const badge = document.getElementById('perfil-cofre-badge');
  const status = document.getElementById('perfil-cofre-status');
  const btnApagar = document.getElementById('btn-apagar-senha-gov');
  const btnEnviar = document.getElementById('btn-enviar-senha-gov');
  const pendente = dados.status === 'pending';
  if (badge) {
    badge.textContent = rotuloStatusCofre(dados.status);
    badge.dataset.status = dados.status || 'empty';
  }
  if (btnApagar) btnApagar.hidden = !pendente;
  if (btnEnviar) btnEnviar.innerHTML = pendente
    ? '<i class="fa-solid fa-rotate"></i> Substituir senha do cofre'
    : '<i class="fa-solid fa-lock"></i> Enviar ao cofre seguro';
  if (status) {
    if (pendente && dados.expiresAt) {
      status.textContent = `Disponível para uma única abertura até ${new Date(dados.expiresAt).toLocaleString('pt-BR')}.`;
    } else if (['viewed', 'deleted', 'expired'].includes(dados.status)) {
      status.textContent = 'O conteúdo da senha não está mais armazenado.';
    } else {
      status.textContent = '';
    }
    status.classList.remove('erro');
  }
}

async function carregarStatusCofreGovbr() {
  if (!CLIENT_ID) return;
  if (window.OC_CONFIG?.TESTE_CLIENTE_SEM_LOGIN?.enabled) {
    renderStatusCofreGovbr({ status: 'empty' });
    return;
  }
  try {
    renderStatusCofreGovbr(await chamarCofreGovbr('status'));
  } catch (_) {
    const badge = document.getElementById('perfil-cofre-badge');
    if (badge) badge.textContent = 'Cofre indisponível';
  }
}

function alternarVisibilidadeSenhaGov() {
  const input = document.getElementById('perfil-gov-senha');
  const icon = document.querySelector('#btn-alternar-senha-gov i');
  if (!input) return;
  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  icon?.classList.toggle('fa-eye', !mostrar);
  icon?.classList.toggle('fa-eye-slash', mostrar);
}

async function enviarSenhaGovAoCofre() {
  const input = document.getElementById('perfil-gov-senha');
  const autoriza = document.getElementById('perfil-gov-autoriza-cofre');
  const expiracao = document.getElementById('perfil-gov-expiracao');
  const btn = document.getElementById('btn-enviar-senha-gov');
  const status = document.getElementById('perfil-cofre-status');
  const senha = input?.value || '';
  const avisar = (texto, erro = false) => {
    if (!status) return;
    status.textContent = texto;
    status.classList.toggle('erro', erro);
  };
  if (senha.length < 8) return avisar('Digite a senha completa do gov.br no campo do cofre.', true);
  if (!autoriza?.checked) return avisar('Confirme a autorização específica para o uso temporário da credencial.', true);
  if (window.OC_CONFIG?.TESTE_CLIENTE_SEM_LOGIN?.enabled) return avisar('O cofre não recebe credenciais no ambiente de demonstração.', true);

  btn.disabled = true;
  avisar('Criptografando e enviando…');
  try {
    const dados = await chamarCofreGovbr('store', {
      password: senha,
      ttlHours: Number(expiracao?.value || 48),
      authorized: true
    });
    input.value = '';
    input.type = 'password';
    autoriza.checked = false;
    const formaAcesso = document.getElementById('perfil-gov-forma-acesso');
    if (formaAcesso) formaAcesso.value = 'cofre_temporario';
    renderStatusCofreGovbr(dados);
  } catch (_) {
    avisar('Não foi possível proteger a senha agora. Não a envie por outro canal; tente novamente.', true);
  } finally {
    btn.disabled = false;
  }
}

async function apagarSenhaGovDoCofre() {
  if (!confirm('Revogar o acesso e apagar agora a senha protegida?')) return;
  const btn = document.getElementById('btn-apagar-senha-gov');
  const status = document.getElementById('perfil-cofre-status');
  btn.disabled = true;
  try {
    const dados = await chamarCofreGovbr('delete');
    renderStatusCofreGovbr(dados);
  } catch (_) {
    if (status) { status.textContent = 'Não foi possível apagar agora. Tente novamente.'; status.classList.add('erro'); }
  } finally {
    btn.disabled = false;
  }
}

async function iniciarAjudaGovBr() {
  abrirSecaoCliente('section-caixa-postal');
  await abrirCaixaPostalCliente();
  abrirComposeCaixaPostalCliente();
  const assunto = document.getElementById('caixa-postal-cliente-assunto');
  const mensagem = document.getElementById('caixa-postal-cliente-mensagem');
  if (assunto) assunto.value = 'Ajuda com acesso gov.br';
  if (mensagem) {
    const dificuldade = document.getElementById('perfil-gov-dificuldade')?.selectedOptions?.[0]?.textContent || 'acesso à conta';
    mensagem.value = `Preciso de orientação com o gov.br. Situação informada: ${dificuldade}. Não enviarei senha nem código de autenticação.`;
    mensagem.focus();
  }
}
window.iniciarAjudaGovBr = iniciarAjudaGovBr;

// O card "Próximo passo" saiu do dashboard (era sobretudo um empurrão pra
// triagem, que agora é obrigatória antes de chegar aqui — ver onboarding em
// showCheckoutSuccess). A função continua calculando o estado porque o chat
// (atualizarSidebarDoChat) ainda usa esse texto na lateral do atendimento.
function atualizarProximaAcao({ triagemEnviada, qtdDocs, temAppt, apptFeito, temRelatorio }) {
  const icon = document.getElementById('case-next-action-icon');
  const title = document.getElementById('case-next-action-title');
  const text = document.getElementById('case-next-action-text');
  const button = document.getElementById('case-next-action-button');

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

  if (icon && title && text && button) {
    icon.style.background = state.color;
    icon.innerHTML = `<i class="fa-solid ${state.icon}"></i>`;
    title.textContent = state.title;
    text.textContent = state.text;
    button.disabled = false;
    button.textContent = state.button;
    button.onclick = () => abrirSecaoCliente(state.target);
  }

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
  window.montarLinhaDoTempo = montarLinhaDoTempo;
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

  // Resumo do estágio atual — aproveita o espaço que sobrava ao lado da
  // linha do tempo num card tão largo, em vez de deixá-lo vazio.
  const detalhe = document.getElementById('tracker-detalhe');
  if (detalhe) {
    const concluidos = passos.filter(p => p.feito).length;
    const passoAtivo = iAtivo >= 0 ? passos[iAtivo] : null;
    if (passoAtivo) {
      detalhe.innerHTML =
        '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--color-coral);">Etapa atual</span>' +
        `<h4 style="color:var(--color-pine);font-size:17px;margin:6px 0 8px;">${escapeHtml(passoAtivo.t)}</h4>` +
        `<p style="font-size:13px;color:var(--color-text-secondary);line-height:1.5;margin:0 0 16px;">${escapeHtml(passoAtivo.d)}</p>` +
        `<div style="font-size:12px;color:var(--color-text-secondary);border-top:1px solid var(--color-border);padding-top:12px;">` +
          `<strong style="color:var(--color-pine);">${concluidos} de ${passos.length}</strong> etapas concluídas` +
        '</div>';
    } else {
      detalhe.innerHTML =
        '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#1F8A5F;">Tudo certo</span>' +
        '<h4 style="color:var(--color-pine);font-size:17px;margin:6px 0 8px;">Atendimento concluído</h4>' +
        '<p style="font-size:13px;color:var(--color-text-secondary);line-height:1.5;margin:0;">Todas as etapas foram concluídas. Confira o relatório na aba Documentos.</p>';
    }
  }

  // Título e status refletem o caso de verdade.
  const titulo = document.getElementById('tracker-titulo');
  const status = document.getElementById('tracker-status');
  const elHeaderAssunto = document.getElementById('chat-header-assunto');
  const elHeaderCodigo = document.getElementById('chat-header-codigo');

  const nomeCaso = (rels && rels[0] && rels[0].titulo)
    || (triagem && triagem.assunto && (OC_TRIAGEM.acharAssunto(triagem.assunto)?.titulo || triagem.assunto))
    || 'Atendimento Geral';
  if (titulo) titulo.textContent = nomeCaso;
  if (elHeaderAssunto) elHeaderAssunto.textContent = nomeCaso;
  if (elHeaderCodigo) {
    let numProtocolo = '2026-001';
    if (triagem && triagem.id) {
      numProtocolo = String(triagem.id).padStart(4, '0');
    } else if (CLIENT_ID) {
      numProtocolo = String(CLIENT_ID).replace(/\D/g, '').slice(0, 6) || '2026-001';
    }
    elHeaderCodigo.textContent = `Protocolo: #OC-${numProtocolo}`;
  }
  
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
// Cache da avaliação já enviada (ou null) — usado tanto pelo card da Home
// quanto pelo card nativo dentro do chat, pra não deixar avaliar 2x.
let minhaAvaliacaoAtual = null;
async function buscarMinhaAvaliacao() {
  try {
    const lista = await (await fetch('/api/avaliacoes?clientId=' + encodeURIComponent(CLIENT_ID))).json();
    minhaAvaliacaoAtual = (lista || [])[0] || null;
  } catch (e) { minhaAvaliacaoAtual = null; }
  return minhaAvaliacaoAtual;
}

async function configurarAvaliacao(temRelatorio, relatorioId) {
  const card = document.getElementById('card-avaliacao');
  const feito = document.getElementById('card-avaliacao-feita');
  if (!card || !feito) return;
  if (!temRelatorio) { card.hidden = true; feito.hidden = true; return; }

  // Já avaliou? Então agradece em vez de pedir de novo.
  const jaAvaliou = await buscarMinhaAvaliacao();

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

// Guardam o último estado conhecido pra poder reaplicar (ex: logo após marcar
// um agendamento) sem precisar buscar tudo de novo. chatLockMode é o que o
// envio de mensagem (setupChat) consulta pra decidir se a mensagem vai pro
// chat ao vivo ou pra Caixa Postal.
let ultimoStatusCliente = null;
let agendamentoPendenteCache = null;
let chatLockMode = 'none'; // 'none' | 'total' | 'parcial' | 'finalizado'

function aplicarEstadoDoChat(status, agendamentoPendente) {
  ultimoStatusCliente = status;
  const overlay = document.getElementById('chat-locked-overlay');
  const area = document.querySelector('#section-chat .chat-input-area');
  const input = document.getElementById('client-chat-input');
  const icon = document.getElementById('chat-lock-icon');
  const title = document.getElementById('chat-lock-title');
  const text = document.getElementById('chat-lock-text');
  const action = document.getElementById('chat-lock-action');
  const schedule = document.getElementById('chat-lock-schedule');
  const scheduleValue = document.getElementById('chat-lock-value');

  const isFinished = status === 'done';
  // Bloqueio TOTAL: o horário do atendimento marcado ainda não chegou. É
  // automático — calculado pela agenda, não depende do contador mexer em nada.
  const isTotal = !isFinished && !!agendamentoPendente;
  // Bloqueio PARCIAL: o contador travou o chat na mão durante o atendimento
  // (foi verificar algo, por exemplo). Só entra em jogo depois que o horário
  // marcado já chegou — antes disso quem manda é o bloqueio total.
  const isParcial = !isFinished && !isTotal && status === 'locked';
  const isLocked = isFinished || isTotal || isParcial;

  chatLockMode = isFinished ? 'finalizado' : isTotal ? 'total' : isParcial ? 'parcial' : 'none';

  if (overlay) {
    overlay.style.display = isLocked ? 'flex' : 'none';
    overlay.classList.toggle('is-finished', isFinished);
  }
  if (area) area.style.display = isFinished ? 'none' : '';
  if (input) {
    // Nos dois bloqueios o campo continua digitável: o que a pessoa manda vira
    // mensagem na Caixa Postal (ver enviarMensagem em setupChat). Só o
    // encerrado desliga de vez — não há mais atendimento pra essa nota ir.
    input.disabled = isFinished;
    input.placeholder = isFinished
      ? 'Atendimento encerrado.'
      : (isTotal || isParcial)
        ? 'Chat bloqueado — sua mensagem vai para a Caixa Postal...'
        : 'Digite sua mensagem...';
  }

  if (!isLocked) {
    if (action) action.hidden = true;
    if (schedule) schedule.hidden = true;
    return;
  }

  if (isFinished) {
    if (icon) icon.className = 'fa-solid fa-circle-check';
    if (title) title.textContent = 'Atendimento concluído';
    if (text) text.textContent = 'Seu chat foi encerrado. O relatório será liberado na área de documentos assim que estiver pronto.';
    if (schedule) schedule.hidden = true;
    if (action) {
      action.hidden = false;
      action.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> Ver relatório';
      action.onclick = () => abrirSecaoCliente('section-documentos');
    }
  } else if (isTotal) {
    if (icon) icon.className = 'fa-solid fa-calendar-days';
    if (title) title.textContent = 'Seu atendimento ainda não começou';
    if (text) text.textContent = 'O chat abre no horário marcado. Se precisar avisar algo antes, sua mensagem vai direto para a Caixa Postal — resposta em até 1 dia útil.';
    if (schedule) {
      schedule.hidden = false;
      if (scheduleValue) {
        const dataFmt = agendamentoPendente.quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        scheduleValue.innerHTML = `<i class="fa-solid fa-calendar"></i> ${dataFmt} às ${agendamentoPendente.time}`;
      }
    }
    if (action) {
      action.hidden = false;
      action.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Ver agendamento';
      action.onclick = () => abrirSecaoCliente('section-agendamento');
    }
  } else {
    if (icon) icon.className = 'fa-solid fa-lock';
    if (title) title.textContent = 'Chat bloqueado temporariamente';
    if (text) text.textContent = 'Seu chat está bloqueado temporariamente até a resolução do seu atendimento. Se quiser avisar algo agora, sua mensagem vai para a Caixa Postal — resposta em até 1 dia útil.';
    if (schedule) schedule.hidden = true;
    if (action) action.hidden = true;
  }
}

// Acha o próximo agendamento deste cliente que ainda não foi concluído e cujo
// horário ainda não chegou. Reusa a mesma API que já alimenta a Agenda do
// cliente — nenhuma tabela nova, nenhum campo novo.
async function buscarAgendamentoBloqueio() {
  try {
    const res = await fetch('/api/appointments');
    const appts = res.ok ? await res.json() : [];
    return (appts || [])
      .filter(a => a.clientRef === CLIENT_ID && a.status !== 'done' && a.date && a.time)
      .map(a => ({ ...a, quando: new Date(`${a.date}T${a.time}:00`) }))
      .filter(a => !isNaN(a.quando.getTime()) && a.quando.getTime() > Date.now())
      .sort((a, b) => a.quando - b.quando)[0] || null;
  } catch (e) {
    return null;
  }
}

async function atualizarAgendamentoPendente() {
  agendamentoPendenteCache = await buscarAgendamentoBloqueio();
  return agendamentoPendenteCache;
}

// Lê o status direto da própria linha do cliente. Antes isso passava por
// /api/clients, que carrega TODOS os clientes, TODAS as mensagens e as triagens
// só para descobrir uma palavra — se qualquer uma dessas consultas falhasse, o
// bloqueio simplesmente não aparecia e não havia sinal nenhum do erro.
async function buscarStatusAtual() {
  if (!window.sb || !CLIENT_ID) return;
  try {
    const [statusRes] = await Promise.all([
      window.sb.from('clientes').select('status').eq('id', CLIENT_ID).single(),
      atualizarAgendamentoPendente()
    ]);
    if (statusRes.error) throw statusRes.error;
    if (statusRes.data) aplicarEstadoDoChat(statusRes.data.status, agendamentoPendenteCache);
  } catch (e) {
    console.warn('Não consegui conferir o status do atendimento:', e);
  }
}

async function setupChatLockListener() {
  // Estado inicial: se o contador bloqueou ou encerrou antes de a tela abrir, o
  // cliente já entra vendo o aviso certo, sem depender de nenhum evento ao vivo.
  await buscarStatusAtual();

  if (!window.sb) return;
  if (window.OC_CONFIG?.TESTE_CLIENTE_SEM_LOGIN?.enabled && window.OC_ROLE === 'cliente') return;

  // Fonte da verdade: a alteração da própria linha no banco. O aviso antigo vinha
  // de um broadcast disparado pelo painel do contador — um único envio, sem
  // reenvio nem confirmação, que se perdia se a aba do cliente não estivesse com
  // o canal conectado naquele exato instante. Ouvindo o UPDATE da tabela, quem
  // avisa é o próprio banco, depois que a mudança já está gravada.
  window.sb
    .channel('oc-status-' + CLIENT_ID)
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clientes', filter: 'id=eq.' + CLIENT_ID },
        ({ new: linha }) => { if (linha && linha.status) aplicarEstadoDoChat(linha.status, agendamentoPendenteCache); })
    .subscribe();

  // Mantido o canal antigo: o painel do contador continua emitindo esse evento e
  // ele chega alguns instantes antes da replicação do banco.
  window.sb.channel('oc-lock-' + CLIENT_ID)
    .on('broadcast', { event: 'lock_change' }, ({ payload }) => {
      aplicarEstadoDoChat(payload.status || (payload.locked ? 'locked' : 'active'), agendamentoPendenteCache);
    })
    .subscribe();

  // Rede de segurança para queda de conexão E o jeito do bloqueio total se
  // levantar sozinho quando o horário marcado chega — nada escreve no banco
  // nesse instante, então só uma conferência periódica pega essa virada.
  setInterval(() => {
    if (document.visibilityState === 'visible') buscarStatusAtual();
  }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') buscarStatusAtual();
  });
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

function iniciaisDoNome(nome) {
  return String(nome || '?').trim().split(/\s+/).filter(Boolean)
    .map(parte => parte[0]).join('').slice(0, 2).toUpperCase() || '?';
}

async function aplicarPerfilDoContador() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    // A tela do contador salva em `perfil_contador` com `name`; a versão
    // antiga do portal cliente lia outra chave, deixando o avatar sem nome.
    const perfil = cfg && (cfg.perfil_contador || cfg.contador_perfil);
    if (perfil) {
      PERFIL_CONTADOR = Object.assign(PERFIL_CONTADOR, perfil, {
        nome: perfil.nome || perfil.name || PERFIL_CONTADOR.nome,
        crc: perfil.crc || PERFIL_CONTADOR.crc
      });
    }
  } catch (e) { /* fica o texto de reserva do HTML */ }

  const nome = document.getElementById('oc-contador-nome');
  const crc = document.getElementById('oc-contador-crc');
  const avatar = document.getElementById('oc-contador-avatar');
  if (nome) nome.textContent = PERFIL_CONTADOR.nome;
  if (crc) crc.textContent = PERFIL_CONTADOR.crc || '';
  if (avatar) avatar.textContent = iniciaisDoNome(PERFIL_CONTADOR.nome);

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

// Senha é opcional — o acesso padrão continua sendo o link por e-mail.
// Quem já está logado (via link) pode definir uma senha aqui.
// Uma vez definida ou dispensada, essa opção desaparece da home.
function setupCriarSenha() {
  const input = document.getElementById('nova-senha');
  const btn = document.getElementById('btn-criar-senha');
  const msg = document.getElementById('msg-criar-senha');
  const card = document.getElementById('card-criar-senha');
  const btnDismiss = document.getElementById('btn-dismiss-senha');

  if (!card) return;

  const storageKey = `oc_senha_feita_${CLIENT_ID}`;
  // Se o cliente já definiu ou dispensou a senha, oculta o card completamente
  if (localStorage.getItem(storageKey) === 'true') {
    card.style.display = 'none';
    return;
  }

  // Botão para dispensar aviso (X)
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-8px)';
      setTimeout(() => { card.style.display = 'none'; }, 300);
      localStorage.setItem(storageKey, 'true');
    });
  }

  if (!btn || !input) return;

  function aviso(texto, cor) {
    if (!msg) return;
    msg.style.display = 'block';
    msg.style.color = cor;
    msg.textContent = texto;
  }

  btn.addEventListener('click', async () => {
    const senha = input.value;
    if (senha.length < 6) { aviso('A senha precisa ter pelo menos 6 caracteres.', '#B32620'); return; }
    btn.disabled = true; btn.textContent = 'Salvando...';
    const { error } = await sb.auth.updateUser({ password: senha });
    btn.disabled = false; btn.textContent = 'Criar senha';
    if (error) { aviso('Não foi possível salvar a senha. Tente novamente.', '#B32620'); return; }
    input.value = '';
    aviso('Senha salva com sucesso! Opcionalmente você pode entrar com e-mail e senha.', '#1F8A5F');
    localStorage.setItem(storageKey, 'true');

    // Suavemente esconde o card após 1.5s pra não poluir mais a Home
    setTimeout(() => {
      card.style.transition = 'all 0.4s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      setTimeout(() => { card.style.display = 'none'; }, 400);
    }, 1500);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}

function setupPerfilSenha() {
  const form = document.getElementById('form-perfil-senha');
  const inputNova = document.getElementById('perfil-nova-senha');
  const inputConf = document.getElementById('perfil-confirma-senha');
  const btn = document.getElementById('btn-perfil-salvar-senha');
  const msg = document.getElementById('msg-perfil-senha');

  if (!form || !btn || !inputNova || !inputConf) return;

  function aviso(texto, cor) {
    if (!msg) return;
    msg.style.display = 'block';
    msg.style.color = cor;
    msg.textContent = texto;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s1 = inputNova.value;
    const s2 = inputConf.value;

    if (s1.length < 6) {
      aviso('A senha precisa ter pelo menos 6 caracteres.', '#B32620');
      return;
    }
    if (s1 !== s2) {
      aviso('As senhas digitadas não coincidem.', '#B32620');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const { error } = await sb.auth.updateUser({ password: s1 });
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-key" style="margin-right: 6px;"></i> Salvar Nova Senha';

    if (error) {
      aviso('Não foi possível alterar a senha. Tente novamente.', '#B32620');
      return;
    }

    inputNova.value = '';
    inputConf.value = '';
    aviso('Senha alterada com sucesso! Você já pode usá-la para acessar sua conta.', '#1F8A5F');
    localStorage.setItem(`oc_senha_feita_${CLIENT_ID}`, 'true');
  });
}

// Carrega os próximos vencimentos fiscais do cliente.
async function loadAgendaFiscal() {
  const card = document.getElementById('card-vencimentos-fiscais');
  const box = document.getElementById('client-agenda-fiscal');
  if (!box) return;

  // Vencimento fiscal só existe pra quem tem um serviço recorrente ativo
  // (Radar Fiscal, Assessoria MEI...) — um atendimento avulso não gera essas
  // obrigações, então o card nem aparece.
  // O card tem "display: flex" fixo no próprio HTML (pra virar coluna), que
  // tem mais especificidade que a regra padrão de [hidden] — por isso o
  // toggle aqui precisa mexer em style.display, não só no atributo.
  if (!clienteLogado || !clienteLogado.recorrente) {
    if (card) { card.hidden = true; card.style.display = 'none'; }
    return;
  }
  if (card) { card.hidden = false; card.style.display = 'flex'; }

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
let agendaDiaSelecionadoIdx = 0;
// true assim que o cliente clica numa pill de dia — enquanto for true, o
// dia escolhido não deve ser sobrescrito pela lógica de "auto-selecionar"
// (senão o clique era desfeito no re-render seguinte, porque o
// checkout-date ainda apontava pro dia antigo até o próprio render atualizá-lo).
let agendaDiaEscolhidoManualmente = false;

async function setupCheckout() {
  // data padrão = hoje
  const dateInput = document.getElementById('checkout-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  await loadServicos();
  await setupAgendaCliente();

  const btn = document.getElementById('btn-gerar-pix');
  if (btn) btn.addEventListener('click', gerarPagamentoPix);

  // Texto do botão acompanha o método escolhido (Pix vs. cartão) — mesma
  // lógica do checkout público.
  document.querySelectorAll('input[name="metodo-agendamento"]').forEach(radio => {
    radio.addEventListener('change', atualizarBotaoMetodoPagamento);
  });
  atualizarBotaoMetodoPagamento();

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
    agendaDiaSelecionadoIdx = 0;
    agendaDiaEscolhidoManualmente = false;
    renderAgendaCliente();
  });
  if (next) next.addEventListener('click', () => {
    agendaSemanaOffset++;
    agendaDiaSelecionadoIdx = 0;
    agendaDiaEscolhidoManualmente = false;
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

  const atualDate = document.getElementById('checkout-date')?.value;
  const atualTime = document.getElementById('checkout-time')?.value;

  // Primeiro horário livre de cada dia — usado tanto pra marcar o dia como
  // "lotado" na pill quanto pra escolher qual dia mostrar por padrão.
  const livrePorDia = dias.map(dia => {
    const iso = isoLocal(dia);
    return HORARIOS_ATENDIMENTO.find(hora => {
      const ocupado = ocupados.has(`${iso}|${hora}`);
      const passado = iso === hojeIso && hora <= horaAgora;
      return !ocupado && !passado;
    }) || null;
  });

  // Mostra o dia que já tem horário escolhido; se não houver, cai no
  // primeiro dia com vaga livre. Pulado quando o próprio clique numa pill
  // foi o que disparou este render — aí o dia já está decidido.
  if (!agendaDiaEscolhidoManualmente) {
    if (atualDate) {
      const idxEscolhido = dias.findIndex(d => isoLocal(d) === atualDate);
      if (idxEscolhido >= 0) agendaDiaSelecionadoIdx = idxEscolhido;
    } else {
      const idxLivre = livrePorDia.findIndex(h => h);
      agendaDiaSelecionadoIdx = idxLivre >= 0 ? idxLivre : 0;
    }
  }
  if (agendaDiaSelecionadoIdx >= dias.length) agendaDiaSelecionadoIdx = 0;

  // Mostra um dia por vez — uma fileira de "pills" pra escolher o dia, e
  // embaixo só os horários daquele dia (antes eram 5 dias lado a lado, que
  // não cabiam num card mais estreito e cortavam ao meio).
  grid.innerHTML =
    '<div class="agenda-dia-pills"></div>' +
    '<div class="agenda-dia-painel"><div class="agenda-slots"></div></div>';
  const pillsWrap = grid.querySelector('.agenda-dia-pills');
  dias.forEach((dia, idx) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'agenda-dia-pill' +
      (idx === agendaDiaSelecionadoIdx ? ' selecionado' : '') +
      (!livrePorDia[idx] ? ' lotado' : '');
    pill.innerHTML = `<strong>${dia.toLocaleDateString('pt-BR', { weekday: 'short' })}</strong><span>${dataLabelCurta(dia)}</span>`;
    pill.addEventListener('click', () => {
      agendaDiaSelecionadoIdx = idx;
      agendaDiaEscolhidoManualmente = true;
      renderAgendaCliente();
    });
    pillsWrap.appendChild(pill);
  });

  const diaSelecionado = dias[agendaDiaSelecionadoIdx];
  const isoSelecionado = isoLocal(diaSelecionado);
  const slots = grid.querySelector('.agenda-slots');
  let primeiroLivre = null;
  HORARIOS_ATENDIMENTO.forEach(hora => {
    const ocupado = ocupados.has(`${isoSelecionado}|${hora}`);
    const passado = isoSelecionado === hojeIso && hora <= horaAgora;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'agenda-slot' + (ocupado ? ' ocupado' : '') + (passado ? ' passado' : '');
    btn.dataset.date = isoSelecionado;
    btn.dataset.time = hora;
    btn.textContent = hora;
    btn.disabled = ocupado || passado;
    btn.title = ocupado ? 'Horário ocupado' : (passado ? 'Horário já passou' : 'Selecionar horário');
    btn.addEventListener('click', () => selecionarHorarioCliente(isoSelecionado, hora, btn));
    slots.appendChild(btn);
    if (!primeiroLivre && !btn.disabled) primeiroLivre = { iso: isoSelecionado, hora, btn };
  });

  const escolhido = atualDate === isoSelecionado && atualTime
    ? slots.querySelector(`[data-time="${CSS.escape(atualTime)}"]`)
    : null;
  if (escolhido && !escolhido.disabled) escolherBotaoAgenda(escolhido, atualDate, atualTime);
  else if (primeiroLivre) escolherBotaoAgenda(primeiroLivre.btn, primeiroLivre.iso, primeiroLivre.hora);
  else if (dica) {
    dica.textContent = 'Não há horários livres neste dia. Escolha outro dia acima ou avance a semana.';
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

// Texto do botão de confirmar acompanha o método escolhido (Pix vs. cartão).
function atualizarBotaoMetodoPagamento() {
  const btn = document.getElementById('btn-gerar-pix');
  if (!btn) return;
  const cartao = document.querySelector('input[name="metodo-agendamento"]:checked')?.value === 'cartao';
  btn.innerHTML = cartao
    ? '<i class="fa-solid fa-credit-card"></i> Ir para pagamento com cartão'
    : '<i class="fa-solid fa-qrcode"></i> Gerar pagamento Pix';
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
  const metodo = document.querySelector('input[name="metodo-agendamento"]:checked')?.value || 'pix';
  const btn = document.getElementById('btn-gerar-pix');
  btn.disabled = true;
  btn.innerHTML = metodo === 'cartao'
    ? '<i class="fa-solid fa-spinner fa-spin"></i> Preparando pagamento...'
    : '<i class="fa-solid fa-spinner fa-spin"></i> Gerando Pix...';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID, servicoId: selectedServicoId, date, time, metodoPagamento: metodo })
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
    const precoFmt = 'R$ ' + data.valor.toFixed(2).replace('.', ',');
    const descontoFmt = data.desconto && data.valorOriginal
      ? ` (10% de desconto — de R$ ${data.valorOriginal.toFixed(2).replace('.', ',')})`
      : '';
    document.getElementById('pix-resumo').textContent =
      `${data.servico.name} — ${precoFmt}${descontoFmt} · ${date} às ${time}`;

    const ehCartao = data.metodoPagamento === 'cartao';
    document.getElementById('pag-titulo').textContent = ehCartao ? 'Pague com cartão para confirmar' : 'Pague com Pix para confirmar';
    document.getElementById('pag-pix-bloco').hidden = ehCartao;
    document.getElementById('pag-cartao-bloco').hidden = !ehCartao;
    const invoiceLink = document.getElementById('pix-invoice');
    invoiceLink.style.display = ehCartao ? 'none' : 'inline';
    invoiceLink.href = data.invoiceUrl || '#';
    if (ehCartao) {
      document.getElementById('link-cartao').href = data.invoiceUrl || '#';
    } else {
      document.getElementById('pix-qr').src = 'data:image/png;base64,' + data.pixImage;
      document.getElementById('pix-copia-cola').value = data.pixPayload;
    }

    startPolling(data.cobrancaId, date, time, data.servico.name);
  } catch (e) {
    msg.textContent = 'Falha de conexão ao gerar o pagamento.';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    atualizarBotaoMetodoPagamento();
  }
}

// ==== RADAR FISCAL (Integra Contador) ====
let radarClienteEstado = null;

function aplicarVisibilidadeRadarFiscal(habilitado) {
  document.querySelectorAll('[data-target="section-radar"]').forEach(el => { el.hidden = !habilitado; });

  const secao = document.getElementById('section-radar');
  if (secao) {
    // Se a pessoa estava justamente nessa aba (link antigo, aba reaberta),
    // devolve pro início em vez de deixar um painel vazio na tela.
    if (!habilitado && secao.classList.contains('active')) {
      secao.classList.remove('active');
      const inicio = document.getElementById('section-dashboard');
      if (inicio) inicio.classList.add('active');
      const navInicio = document.querySelector('[data-target="section-dashboard"]');
      if (navInicio) {
        document.querySelectorAll('.app-sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
        navInicio.classList.add('active');
      }
    }
    secao.hidden = !habilitado;
  }
}

async function chamarRadarCliente(acao, extra) {
  const { data } = await sb.auth.getSession();
  const token = data && data.session ? data.session.access_token : '';
  const res = await fetch('/api/radar-fiscal', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao, ...(extra || {}) })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erro = new Error(json.detail || json.error || 'Não foi possível concluir a consulta.');
    erro.code = json.error;
    throw erro;
  }
  return json;
}

async function carregarRadarFiscal() {
  if (!clienteLogado) return;
  const oferta = document.getElementById('radar-oferta');
  const ativo = document.getElementById('radar-ativo');
  if (!oferta || !ativo) return;

  try {
    radarClienteEstado = await chamarRadarCliente('estado-cliente');
    aplicarVisibilidadeRadarFiscal(!!radarClienteEstado.habilitado);
    oferta.hidden = true;
    ativo.hidden = !radarClienteEstado.habilitado;
    if (radarClienteEstado.habilitado) renderRadarAtivo(radarClienteEstado.resultados || []);
  } catch (e) {
    console.error('Radar Fiscal erro:', e);
    aplicarVisibilidadeRadarFiscal(false);
  }
}

function dataCurtaRadar(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

// Recebe as linhas de serpro_resultados (o que já foi consultado e pago).
// Toda informação vem carimbada com a data da consulta: situação fiscal de
// duas semanas atrás não é a situação fiscal de hoje, e o cliente precisa
// enxergar essa diferença.
function renderRadarAtivo(linhas) {
  const container = document.getElementById('radar-ativo');
  if (!container) return;

  const porServico = {};
  (linhas || []).forEach(l => { porServico[l.servico] = l; });

  const temNovas = !!clienteLogado.caixaPostalNovas;
  const caixa = porServico['caixa-postal'];
  const mensagens = (caixa && caixa.resultado && caixa.resultado.mensagens) || [];

  let caixaHtml;
  if (temNovas) {
    caixaHtml = `
      <div style="padding:18px;display:flex;gap:14px;align-items:flex-start;background:#FFF7ED;">
        <i class="fa-solid fa-envelope" style="color:var(--color-coral);font-size:18px;margin-top:2px;"></i>
        <div>
          <h4 style="font-size:14px;margin:0 0 4px 0;color:var(--color-pine);">Chegou mensagem nova da Receita</h4>
          <p style="font-size:13px;margin:0;color:var(--color-text-secondary);line-height:1.5;">
            Seu contador foi avisado e vai verificar o conteúdo. Se for preciso agir, entramos em contato.
          </p>
        </div>
      </div>`;
  } else if (mensagens.length > 0) {
    caixaHtml = mensagens.map(m => `
      <div style="padding:14px 18px;border-bottom:1px solid var(--color-border);display:flex;gap:14px;align-items:center;">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--color-pine-ultra-light);color:var(--color-pine);display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-envelope-open-text"></i>
        </div>
        <div>
          <h4 style="font-size:14px;margin:0;color:var(--color-pine);">${m.assunto}</h4>
          <span style="font-size:11px;color:var(--color-text-secondary);">${dataCurtaRadar(m.data)}</span>
        </div>
      </div>`).join('');
  } else {
    caixaHtml = `<div style="padding:18px;font-size:13px;color:var(--color-text-secondary);">
      Nenhuma mensagem nova desde a última verificação${caixa ? ` (${dataCurtaRadar(caixa.obtido_em)})` : ''}.
    </div>`;
  }

  const sitfis = porServico['sitfis'];
  const sitfisHtml = sitfis
    ? `<p style="font-size:13px;color:var(--color-text-secondary);margin:0;line-height:1.6;">
         Seu relatório de situação fiscal foi emitido em <strong>${dataCurtaRadar(sitfis.obtido_em)}</strong> e
         está em <strong>Meus Documentos</strong>.
       </p>`
    : `<p style="font-size:13px;color:var(--color-text-secondary);margin:0;line-height:1.6;">
         Nenhum relatório de situação fiscal emitido ainda. Peça ao seu contador pelas
         <strong>Mensagens</strong> quando precisar de um.
       </p>`;

  const parcelamentos = porServico['parcelamentos'];
  let parcelamentosHtml = '';
  if (parcelamentos && parcelamentos.resultado) {
    const blocos = parcelamentos.resultado.sistemas || [];
    parcelamentosHtml = `
      <p style="font-size:12px;color:var(--color-text-secondary);margin:0 0 12px;">Dados consultados em <strong>${dataCurtaRadar(parcelamentos.obtido_em)}</strong>.</p>
      ${blocos.map(s => {
        const pedidos = s.pedidos || [];
        const parcelas = s.parcelas || [];
        return `<div style="padding:12px 0;border-top:1px solid var(--color-border);">
          <strong style="font-size:13.5px;color:var(--color-pine);">${escapeHtml(s.sistema || '')}</strong>
          <span style="font-size:12px;color:var(--color-text-secondary);"> · ${pedidos.length} parcelamento(s)</span>
          ${parcelas.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;font-size:13px;">
            <span>Parcela ${escapeHtml(String(p.parcela || ''))} · vence ${escapeHtml(String(p.vencimento || '—'))}</span>
            ${radarClienteEstado?.configuracao?.clientePodeEmitirDas !== false ? `<button type="button" class="btn-utility" data-radar-cliente-das data-sistema="${escapeHtml(s.sistema || '')}" data-parcela="${escapeHtml(String(p.parcela || ''))}"><i class="fa-solid fa-file-invoice-dollar"></i> Emitir guia</button>` : ''}
          </div>`).join('') || '<p style="font-size:12.5px;color:var(--color-text-secondary);margin:8px 0 0;">Nenhuma parcela disponível para emissão.</p>'}
        </div>`;
      }).join('') || '<p style="font-size:13px;color:var(--color-text-secondary);margin:0;">Nenhum parcelamento encontrado.</p>'}`;
  } else {
    parcelamentosHtml = radarClienteEstado?.regime
      ? `<p style="font-size:13px;color:var(--color-text-secondary);margin:0 0 14px;">Ainda não há dados salvos. A primeira consulta será guardada e reutilizada nas próximas vezes.</p><button type="button" class="btn-utility primary" data-radar-cliente-consultar><i class="fa-solid fa-magnifying-glass"></i> Consultar parcelamentos</button>`
      : '<p style="font-size:13px;color:var(--color-text-secondary);margin:0;">Peça ao seu contador para definir se a empresa é MEI ou Simples Nacional antes da primeira consulta.</p>';
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:24px;max-width:780px;">

      <div style="display:flex;align-items:center;gap:10px;">
        <span class="status-badge" style="background:rgba(46,204,113,0.1);color:#27AE60;border:1px solid rgba(46,204,113,0.3);padding:6px 12px;font-size:13px;font-weight:600;">
          <i class="fa-solid fa-satellite-dish"></i> Radar habilitado
        </span>
        <span style="font-size:12.5px;color:var(--color-text-secondary);">Caixa Postal verificada a cada ${escapeHtml(String(radarClienteEstado?.configuracao?.caixaPostalIntervaloDias || 7))} dias.</span>
      </div>

      <div>
        <h3 style="font-size:16px;color:var(--color-pine);margin-bottom:12px;">Caixa Postal (e-CAC)</h3>
        <div style="background:#fff;border-radius:20px;border:1px solid var(--color-border);box-shadow:0 4px 20px rgba(10,49,33,0.06);overflow:hidden;">
          ${caixaHtml}
        </div>
      </div>

      <div>
        <h3 style="font-size:16px;color:var(--color-pine);margin-bottom:12px;">Situação fiscal</h3>
        <div style="background:#fff;border-radius:20px;border:1px solid var(--color-border);box-shadow:0 4px 20px rgba(10,49,33,0.06);padding:18px;">
          ${sitfisHtml}
        </div>
      </div>

      <div>
        <h3 style="font-size:16px;color:var(--color-pine);margin-bottom:12px;">Parcelamentos</h3>
        <div style="background:#fff;border-radius:20px;border:1px solid var(--color-border);box-shadow:0 4px 20px rgba(10,49,33,0.06);padding:18px;">
          ${parcelamentosHtml}
        </div>
      </div>

    </div>`;

  const consultar = container.querySelector('[data-radar-cliente-consultar]');
  if (consultar) consultar.addEventListener('click', () => consultarParcelamentosCliente(consultar));
  container.querySelectorAll('[data-radar-cliente-das]').forEach(btn => btn.addEventListener('click', () => emitirDasRadarCliente(btn)));
}

async function consultarParcelamentosCliente(botao) {
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Consultando…';
  try {
    const resultado = await chamarRadarCliente('parcelamentos');
    radarClienteEstado.resultados = (radarClienteEstado.resultados || []).filter(r => r.servico !== 'parcelamentos');
    radarClienteEstado.resultados.push({ servico: 'parcelamentos', resultado, obtido_em: resultado.obtidoEm || new Date().toISOString() });
    renderRadarAtivo(radarClienteEstado.resultados);
  } catch (e) {
    botao.disabled = false;
    botao.innerHTML = original;
    alert(e.message);
  }
}

async function emitirDasRadarCliente(botao) {
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Emitindo…';
  try {
    const r = await chamarRadarCliente('emitir-das', { sistema: botao.dataset.sistema, parcela: botao.dataset.parcela });
    if (!r.pdfBase64) throw new Error('A Receita não devolveu o PDF da guia.');
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${r.pdfBase64}`;
    link.download = `das-${botao.dataset.parcela}.pdf`;
    link.click();
    botao.innerHTML = '<i class="fa-solid fa-circle-check"></i> Guia emitida';
  } catch (e) {
    botao.disabled = false;
    botao.innerHTML = original;
    alert(e.message);
  }
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

  // O bloqueio total (chat fechado até o horário marcado) agora é calculado
  // sozinho a partir da própria agenda — ver buscarAgendamentoBloqueio(). Não
  // precisa mais gravar status='locked' aqui: aquele campo é reservado pro
  // contador travar na mão DURANTE o atendimento, e reutilizá-lo no agendamento
  // fazia o botão de bloqueio do contador acender antes mesmo da consulta
  // começar. Só refresca o estado agora pra não esperar o próximo polling.
  atualizarAgendamentoPendente().then(() => aplicarEstadoDoChat(ultimoStatusCliente, agendamentoPendenteCache));

  // Reduz a fricção entre pagar e começar de fato: em vez de soltar o cliente
  // no dashboard, ele é guiado por um agradecimento -> "vamos começar" ->
  // triagem obrigatória, e só é liberado pro resto do portal depois de enviá-la.
  localStorage.setItem(onboardingStorageKey(), '1');
  personalizarOnboarding();
  preencherAgendamentoOnboarding({ servico: servicoName, date, time });
  mostrarOnboarding('obrigado');
}

// Mostra o agendamento em destaque no card de "obrigado" do onboarding — é a
// prova concreta, pro cliente, de que o pagamento virou um horário marcado.
// Recebe os dados direto quando quem chamou já sabe (showCheckoutSuccess);
// sem eles, busca o próximo agendamento pendente (caminho do checkout público
// + login automático, onde ninguém passou esses dados pra cá).
async function preencherAgendamentoOnboarding(dados) {
  const bloco = document.getElementById('onboarding-agendamento');
  if (!bloco) return;
  if (atendimentoSemAgendamento()) { bloco.hidden = true; return; }
  let servico, data, hora;
  if (dados) {
    servico = dados.servico; data = dados.date; hora = dados.time;
  } else {
    const ag = agendamentoPendenteCache || await atualizarAgendamentoPendente();
    if (!ag) { bloco.hidden = true; return; }
    servico = ag.taxType; data = ag.date; hora = ag.time;
  }
  if (!servico && !data) { bloco.hidden = true; return; }
  const servicoEl = document.getElementById('onboarding-agendamento-servico');
  const quandoEl = document.getElementById('onboarding-agendamento-quando');
  if (servicoEl) servicoEl.textContent = servico || 'Atendimento agendado';
  if (quandoEl) quandoEl.textContent = data ? (window.OCTempo.rotuloDia(data) + (hora ? ' às ' + hora : '')) : '';
  bloco.hidden = false;
}

function onboardingStorageKey() {
  return 'oc-onboarding-pendente-' + CLIENT_ID;
}

// Primeiro nome do cliente logado — usado para chamar a pessoa pelo nome
// durante o onboarding pós-pagamento e a triagem, em vez de um "você" genérico.
function primeiroNomeCliente() {
  const nome = (clienteLogado && clienteLogado.name) || '';
  return nome.trim().split(/\s+/)[0] || '';
}
window.primeiroNomeCliente = primeiroNomeCliente;

function atendimentoSemAgendamento() {
  return !!(clienteLogado && clienteLogado.atendimentoModalidade === 'sem_agendamento');
}
window.atendimentoSemAgendamento = atendimentoSemAgendamento;

function aplicarModalidadeCliente() {
  const sem = atendimentoSemAgendamento();
  const navChat = document.getElementById('nav-chat-cliente');
  if (navChat) navChat.hidden = sem;
  document.body.classList.toggle('atendimento-sem-agendamento', sem);
}

function personalizarOnboarding() {
  const primeiroNome = primeiroNomeCliente();
  ['onboarding-nome-1', 'onboarding-nome-3', 'onboarding-nome-4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = primeiroNome;
  });
  const sem = atendimentoSemAgendamento();
  const explicacao = document.getElementById('onboarding-explicacao');
  const depois = document.getElementById('onboarding-depois-texto');
  const final = document.getElementById('onboarding-final-texto');
  if (explicacao) explicacao.innerHTML = sem
    ? 'Seu caso pode entrar na fila imediatamente, sem esperar uma vaga na agenda. Conte o que aconteceu e envie os documentos para o contador começar a análise.'
    : 'Mas antes, vamos entender rapidinho o que está acontecendo — assim o contador já chega sabendo do seu caso. Vamos iniciar seu pré-atendimento agora?';
  if (depois) depois.innerHTML = sem
    ? 'Vamos mandar o link de acesso por e-mail. Para seu caso entrar na fila sem demora, conclua a triagem e envie os documentos assim que puder.'
    : 'Vamos te mandar o link de acesso por e-mail. Mas é indispensável fazer o pré-atendimento e contar o que aconteceu <strong>antes do horário marcado</strong> do seu atendimento — isso deixa tudo muito mais efetivo.';
  if (final) final.textContent = sem
    ? 'Seu caso já entrou na fila de análise. Não precisa marcar horário nem ficar esperando uma conversa: acompanhe o andamento por aqui e receba o aviso do resultado por e-mail.'
    : 'Nosso time já está cuidando do seu caso. Você pode acessar o sistema quando quiser para acrescentar informações ou aguardar o horário agendado.';
  aplicarModalidadeCliente();
}

function mostrarOnboarding(passo) {
  onboardingAtivo = true;
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.add('ativo');
  ['obrigado', 'depois', 'final'].forEach(p => {
    const el = document.getElementById('onboarding-step-' + p);
    if (el) el.hidden = (p !== passo);
  });
}
window.avancarOnboarding = mostrarOnboarding;

function entrarNaTriagemObrigatoria() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.remove('ativo');
  document.body.classList.add('onboarding-bloqueio');
  abrirSecaoCliente('section-triagem');
}
window.entrarNaTriagemObrigatoria = entrarNaTriagemObrigatoria;

// Cliente escolheu "Agora não" no card de obrigado: em vez de forçar a
// triagem na hora, encerra a sessão — ela volta pelo link de acesso (que já
// chega por e-mail, ver enviarLinkDeAcesso) quando estiver pronta. Mantém
// onboarding_pendente=true (só a triagem enviada libera isso de verdade),
// então da próxima vez que ela entrar cai direto na triagem obrigatória.
async function sairSemTriagemAgora() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.remove('ativo');
  try { await OCAuth.signOut(); } catch (_) { location.href = 'index.html'; }
}
window.sairSemTriagemAgora = sairSemTriagemAgora;

// Chamado pela triagem.js (enviar()) assim que o cliente conclui a triagem
// obrigatória — libera a navegação e mostra a confirmação de que o caso já
// está com os especialistas.
function finalizarOnboardingAposTriagem() {
  if (!onboardingAtivo) return;
  localStorage.removeItem(onboardingStorageKey());
  document.body.classList.remove('onboarding-bloqueio');
  // Garante o nome preenchido mesmo se o onboarding foi retomado depois de um
  // reload (nesse caso as telas 1 e 2 nunca chegaram a rodar personalizarOnboarding).
  personalizarOnboarding();
  mostrarOnboarding('final');
}
window.finalizarOnboardingAposTriagem = finalizarOnboardingAposTriagem;

function concluirOnboarding() {
  onboardingAtivo = false;
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.classList.remove('ativo');
  abrirSecaoCliente('section-dashboard');
}
window.concluirOnboarding = concluirOnboarding;

// Busca as mensagens já salvas e popula o chat na primeira carga.
async function loadClientHistory() {
  const history = document.getElementById('client-chat-history');
  try {
    const res = await fetch('/api/clients');
    const clients = await res.json();
    const client = clients[CLIENT_ID];
    if (!client) return;

    clienteLogado = client; // Guarda globalmente para outras features (ex: Radar Fiscal)
    aplicarModalidadeCliente();
    if (!Array.isArray(client.messages)) return;

    // Atualiza o cabeçalho com a identidade do cliente ativo.
    const nameEl = document.getElementById('client-header-name');
    const docEl = document.getElementById('client-header-doc');
    const avatarEl = document.getElementById('client-header-avatar');
    if (nameEl) nameEl.textContent = client.name || '';
    if (docEl) docEl.textContent = formatarCPF(client.cpf);
    if (avatarEl) avatarEl.textContent = client.avatar || iniciaisDoNome(client.name);
    // "Bem-vindo" concorda em gênero com quem é recebido — e não dá pra saber
    // se o cliente é "bem-vindo" ou "bem-vinda" só pelo primeiro nome. Um
    // simples "Olá, {nome}" evita o problema (e ainda fica mais pessoal).
    const dashBoasVindasEl = document.getElementById('dash-boas-vindas');
    if (dashBoasVindasEl) {
      const primeiroNome = primeiroNomeCliente();
      dashBoasVindasEl.textContent = primeiroNome ? `Olá, ${primeiroNome}!` : 'Bem-vindo(a) ao Olá, Contador';
    }

    populaPerfilCliente(client);

    // Precisa saber ANTES de desenhar as bolhas se já existe avaliação — senão
    // o card de NPS no histórico renderizaria as estrelas de novo mesmo depois
    // do cliente já ter avaliado (configurarAvaliacao só roda depois daqui).
    await buscarMinhaAvaliacao();

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
      moverIndicadorLiquido(button);

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
        if (targetSectionId === 'section-caixa-postal') {
          abrirCaixaPostalCliente();
        }
      }
    });
  });
  moverIndicadorLiquido(document.querySelector('.app-sidebar-nav .nav-item.active'));
  window.addEventListener('resize', () => {
    moverIndicadorLiquido(document.querySelector('.app-sidebar-nav .nav-item.active'));
  });
}

// Desliza o indicador "líquido" (pílula translúcida) até embaixo do ícone
// ativo — só existe visualmente na barra do celular (ver cliente.css). Some
// (opacity:0) quando o item ativo é um dos que moraram no menu de perfil
// (Pré-atendimento, Mensagens, Agendamento, Histórico): eles ficam ocultos
// na barra de baixo, então getBoundingClientRect() voltaria um retângulo
// vazio (0×0) e o indicador "sumiria" no canto — melhor escondê-lo de vez.
function moverIndicadorLiquido(navItem) {
  const indicador = document.getElementById('nav-liquid-indicator');
  const barra = document.querySelector('.app-sidebar-nav');
  if (!indicador || !barra) return;
  if (window.innerWidth > 768 || !navItem) { indicador.style.opacity = '0'; return; }

  const itemRect = navItem.getBoundingClientRect();
  if (!itemRect.width) { indicador.style.opacity = '0'; return; }

  const barraRect = barra.getBoundingClientRect();
  indicador.style.left = (itemRect.left - barraRect.left) + 'px';
  indicador.style.width = itemRect.width + 'px';
  indicador.style.opacity = '1';
}

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
  if (msgObj.type === 'avaliacao-card') {
    // Já avaliou (em qualquer lugar — Home ou aqui mesmo)? Mostra o
    // agradecimento direto, sem reabrir as estrelas pra avaliar de novo.
    if (minhaAvaliacaoAtual) {
      return `<div class="avaliacao-card-chat feita">` +
        `<i class="fa-solid fa-circle-check"></i>` +
        `<span>Você deu nota ${minhaAvaliacaoAtual.nota} de 5. Obrigado por avaliar!</span>` +
        `</div>`;
    }
    return `<div class="avaliacao-card-chat" data-msg-id="${escapeHtml(msgObj.id || '')}">` +
      `<p>${escapeHtml(msgObj.text)}</p>` +
      `<div class="aval-estrelas">` +
      [1, 2, 3, 4, 5].map(n => `<button type="button" data-nota="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}" onclick="selecionarEstrelaChat(this)"><i class="fa-regular fa-star"></i></button>`).join('') +
      `</div>` +
      `<textarea class="triagem-textarea avaliacao-card-comentario" rows="2" placeholder="Quer comentar alguma coisa? (opcional)"></textarea>` +
      `<button type="button" class="btn-primary btn-enviar-avaliacao-chat" disabled onclick="enviarAvaliacaoChat(this)">Enviar avaliação</button>` +
      `</div>`;
  }
  return `<span class="bolha-texto">${escapeHtml(msgObj.text)}</span>`;
}

// Estrelas do card de NPS nativo no chat (ver conteudoDaBolha, tipo
// 'avaliacao-card') — mesma lógica de configurarAvaliacao, só que operando no
// card específico clicado em vez de ids fixos, porque este card vive dentro
// do histórico de mensagens.
function selecionarEstrelaChat(btn) {
  const card = btn.closest('.avaliacao-card-chat');
  if (!card) return;
  const nota = parseInt(btn.dataset.nota, 10);
  card.dataset.notaEscolhida = nota;
  card.querySelectorAll('.aval-estrelas button').forEach(b => {
    const cheia = parseInt(b.dataset.nota, 10) <= nota;
    b.querySelector('i').className = cheia ? 'fa-solid fa-star' : 'fa-regular fa-star';
  });
  const enviar = card.querySelector('.btn-enviar-avaliacao-chat');
  if (enviar) enviar.disabled = false;
}

async function enviarAvaliacaoChat(btn) {
  const card = btn.closest('.avaliacao-card-chat');
  const nota = parseInt(card?.dataset.notaEscolhida || '0', 10);
  if (!card || !nota) return;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  const comentario = card.querySelector('.avaliacao-card-comentario')?.value.trim() || null;
  try {
    const res = await fetch('/api/avaliacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: CLIENT_ID, relatorioId: null, nota, comentario })
    });
    if (!res.ok) throw new Error('resposta ' + res.status);
    minhaAvaliacaoAtual = { nota, comentario };
    card.classList.add('feita');
    card.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Você deu nota ${nota} de 5. Obrigado por avaliar!</span>`;
    // O card da Home (se estiver visível) também some, pra não pedir de novo lá.
    const cardHome = document.getElementById('card-avaliacao');
    const feitoHome = document.getElementById('card-avaliacao-feita');
    if (cardHome && feitoHome) {
      cardHome.hidden = true;
      feitoHome.hidden = false;
      const texto = document.getElementById('aval-feita-texto');
      if (texto) texto.textContent = `Você deu nota ${nota} de 5. Obrigado por ajudar a melhorar o atendimento.`;
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Enviar avaliação';
    alert('Não consegui enviar sua avaliação agora. Tente de novo em instantes.');
  }
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

// Realtime deixa o ✓✓ instantâneo. Esta checagem leve é a rede de segurança
// para a confirmação de leitura quando uma aba perde a conexão WebSocket.
let sincronizacaoLeituraClienteEmAndamento = false;
async function sincronizarLeiturasDoCliente() {
  if (sincronizacaoLeituraClienteEmAndamento || document.hidden || !CLIENT_ID) return;
  sincronizacaoLeituraClienteEmAndamento = true;
  try {
    const res = await fetch('/api/clients');
    if (!res.ok) return;
    const client = (await res.json())[CLIENT_ID];
    if (!client || !Array.isArray(client.messages)) return;
    const porId = new Map(client.messages.map(m => [m.id, m]));
    document.querySelectorAll('#client-chat-history [data-msg-id]').forEach(bubble => {
      const atualizada = porId.get(bubble.dataset.msgId);
      if (atualizada?.readAt) aplicarLeitura(atualizada);
    });
    if (clienteLogado) clienteLogado.messages = client.messages;
  } catch (e) {
    console.warn('[chat] não consegui sincronizar confirmações de leitura:', e.message);
  } finally {
    sincronizacaoLeituraClienteEmAndamento = false;
  }
}

function iniciarSincronizacaoDeLeituraCliente() {
  window.setInterval(sincronizarLeiturasDoCliente, 12000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sincronizarLeiturasDoCliente();
  });
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

// Some sozinho depois de alguns segundos — não é erro nem precisa de clique
// pra fechar, só confirma pra onde a mensagem foi.
function avisarEnvioParaCaixaPostal() {
  let aviso = document.getElementById('aviso-envio-caixa-postal');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'aviso-envio-caixa-postal';
    aviso.className = 'aviso-envio-caixa-postal';
    const area = document.querySelector('#section-chat .chat-input-area');
    if (area) area.appendChild(aviso);
  }
  aviso.innerHTML = '<i class="fa-solid fa-envelope"></i> Sua mensagem foi para a Caixa Postal — resposta em até 1 dia útil. '
    + '<a href="#" id="link-ver-caixa-postal">Ver mensagem</a>';
  aviso.classList.add('visivel');
  clearTimeout(aviso._timer);
  aviso._timer = setTimeout(() => aviso.classList.remove('visivel'), 8000);
  const link = document.getElementById('link-ver-caixa-postal');
  if (link) link.onclick = (e) => { e.preventDefault(); abrirSecaoCliente('section-caixa-postal'); };
}

function setupChat() {
  const form = document.getElementById('client-chat-form');
  const input = document.getElementById('client-chat-input');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const texto = input.value.trim();
    if (!texto) return;

    // Chat bloqueado (total ou parcial): a conversa ao vivo está fechada, então
    // o que a pessoa digitar aqui vira mensagem na Caixa Postal em vez de se
    // perder ou ficar preso num campo desabilitado.
    if (chatLockMode === 'total' || chatLockMode === 'parcial') {
      input.value = '';
      input.disabled = true;
      try {
        await fetch('/api/caixa-postal', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clienteId: CLIENT_ID, remetente: 'cliente', mensagem: texto })
        });
        avisarEnvioParaCaixaPostal();
        await carregarBadgeCaixaPostalCliente();
      } catch (err) {
        alert('Não consegui enviar sua mensagem agora. Tente de novo em instantes.');
      } finally {
        input.disabled = false;
        input.focus();
      }
      return;
    }

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

// Reaproveita /api/recorrencia (o mesmo endpoint que já liga assinaturas
// mensais no painel do contador) em vez de um endpoint próprio — o plano
// Hobby da Vercel tem teto de 12 funções serverless por deploy, já no limite.
// ATENÇÃO: `clientes.recorrente_tipo`/`asaas_subscription_id` guardam só UMA
// assinatura por cliente. Um cliente que já tenha outro acompanhamento mensal
// ativo (ex.: Assessoria MEI) e assinar o Radar Fiscal aqui SUBSTITUI aquele
// registro — a assinatura anterior continua cobrando no Asaas, só que o
// sistema para de rastreá-la. Não afeta quem só tem atendimentos avulsos.
window.subscribeRadar = async function() {
  const btn = document.getElementById('btn-subscribe-radar');
  if (!clienteLogado || !clienteLogado.id) {
    alert('Não consegui identificar seus dados. Recarregue a página e tente de novo.');
    return;
  }
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clienteLogado.id, ativar: true, tipo: 'Radar Fiscal',
        diaVenc: new Date().getDate(), valor: 29.90
      })
    });

    if (res.ok) {
      clienteLogado.recorrente = true;
      clienteLogado.recorrenteTipo = 'Radar Fiscal';
      alert('Radar Fiscal ativado! A cobrança mensal de R$ 29,90 já começou no Asaas.');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Radar Ativado';
        btn.style.background = '#2ECC71';
      }
      carregarRadarFiscal();
    } else {
      const erro = await res.json().catch(() => ({}));
      alert(erro.error === 'asaas_not_configured'
        ? 'Pagamentos ainda não estão configurados. Fale com o contador.'
        : 'Erro ao processar assinatura. Tente novamente mais tarde.');
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-headset"></i> Assinar Radar Fiscal (R$ 29,90/mês)';
        btn.disabled = false;
      }
    }
  } catch (e) {
    console.error(e);
    alert('Erro de conexão.');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-headset"></i> Assinar Radar Fiscal (R$ 29,90/mês)';
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

// ============================================================
// FAQ / AJUDA — busca simples nas perguntas e respostas
// ============================================================
// Filtra por texto (pergunta + resposta), esconde grupos que ficaram
// vazios e avisa quando nada bate. Sem termo, tudo volta e os itens
// fecham — assim a seção sempre reabre no estado limpo.
(function initFaqBusca() {
  function normalizar(txt) {
    // Sem acento e em minúscula: quem digita "nivel" acha "nível".
    return String(txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function ligar() {
    const input = document.getElementById('faq-busca-input');
    if (!input) return;

    const avisoVazio = document.getElementById('faq-sem-resultado');
    const grupos = Array.from(document.querySelectorAll('[data-faq-grupo]'));
    const itens = Array.from(document.querySelectorAll('#section-faq .faq-item'));

    // O texto de cada item é lido uma vez só, no carregamento — o conteúdo
    // do FAQ é estático, não precisa reprocessar a cada tecla.
    const indice = itens.map(el => ({ el, texto: normalizar(el.textContent) }));

    input.addEventListener('input', () => {
      const termo = normalizar(input.value.trim());

      if (!termo) {
        indice.forEach(({ el }) => { el.hidden = false; el.open = false; });
        grupos.forEach(g => { g.hidden = false; });
        if (avisoVazio) avisoVazio.hidden = true;
        return;
      }

      let achou = 0;
      indice.forEach(({ el, texto }) => {
        const bate = texto.includes(termo);
        el.hidden = !bate;
        // Abre o que bateu: com poucos resultados, a resposta já aparece
        // sem exigir mais um clique.
        el.open = bate;
        if (bate) achou++;
      });

      grupos.forEach(g => {
        const visiveis = g.querySelectorAll('.faq-item:not([hidden])').length;
        g.hidden = visiveis === 0;
      });

      if (avisoVazio) avisoVazio.hidden = achou > 0;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ligar);
  } else {
    ligar();
  }
})();

// A aba do Radar precisa sumir já no carregamento da página, antes de qualquer
// dado do cliente chegar do banco — senão ela pisca na barra lateral e alguém
// consegue clicar nela nesse intervalo.
(function esconderRadarCedo() {
  function aplicar() {
    try { aplicarVisibilidadeRadarFiscal(); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar);
  } else {
    aplicar();
  }
})();
