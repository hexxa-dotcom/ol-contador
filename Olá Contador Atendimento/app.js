// Olá Contador Atendimento - Core Application Logic & API Client

// Dynamic API Base URL depending on whether page is opened via file:// or http://
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';

// Local variables synced with backend API
let activeClientId = "ana-silva";
let activeClientChatType = "internal"; // internal, doc_request
let socket = null;

// Realtime deixa a conversa instantânea. Esta sincronização curta é a rede de
// segurança: se a rede cair, uma publicação do Supabase estiver atrasada ou a
// aba ficar suspensa, o contador ainda vê mensagens novas sem precisar recarregar.
let sincronizacaoAtendimentoTimer = null;
let sincronizacaoAtendimentoEmAndamento = false;
let avisoSincronizacaoMostrado = false;

let clientsData = {};
let notifications = [];
let appointments = [];
let activeCrmClientId = null;
let financeiro = { servicos: [], cobrancas: [] };
let kanbanEtapas = {};

// Audio Context for System Sounds
let audioCtx = null;
let isSoundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type = 'notification') {
  if (!isSoundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    if (type === 'notification') {
      // Pleasant chime
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, now); // C5
      oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
      oscillator.start(now);
      oscillator.stop(now + 0.5);
    } else if (type === 'alert') {
      // Urgent double beep
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(440, now);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
      
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(440, now);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.1, now + 0.17);
      gain2.gain.linearRampToValueAtTime(0, now + 0.25);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.3);
    } else if (type === 'message') {
      // Soft pop
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    }
  } catch (e) {
    console.error("Audio block:", e);
  }
}

// Application State
let currentScheduleFilter = "today";
const DEFAULT_AGENDA_SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:30'];
const AGENDA_SLOT_OPTIONS = ['08:00', '09:00', '10:00', '11:00', '13:30', '14:00', '15:00', '16:00', '16:30', '17:00'];
let agendaDisponibilidade = [...DEFAULT_AGENDA_SLOTS];
// Dias (feriados, folgas) que somem da agenda pública — ver renderDiasBloqueados.
let agendaDiasBloqueados = [];
let calendarMonthDate = new Date();

// Chat Timer State
let chatTimerInterval = null;
let currentChatSeconds = 0; // sempre o tempo DECORRIDO, mesmo em contagem decrescente (a exibição é derivada em updateTimerUI)
let hasSentAvisoPrazo = false;
// Configurável em Configurações → Geral → Cronômetro do Atendimento (chave 'timer_config').
let timerConfig = { autoIniciar: true, direcao: 'crescente', duracaoMinutos: 40, avisoMinutosAntes: 5, avisoSonoro: true, avisarCliente: true };

// Predefined Canned Responses
const cannedResponses = {
  "/boasvindas": "Olá! Seja muito bem-vindo ao Olá, Contador. Meu nome é Felipe e serei o profissional de contabilidade responsável pelo seu atendimento hoje. Vamos analisar o seu caso em detalhes para regularizar sua situação fiscal com o menor imposto possível. Como posso ajudar você no momento?",
  "/doc-malha": "Para analisar a pendência de malha fina na sua declaração de Imposto de Renda, vou precisar que você me envie os seguintes documentos:\n1. Cópia do CPF e RG do titular.\n2. Extrato completo da pendência de malha fina (obtido no portal e-CAC da Receita Federal).\n3. Informes de rendimentos de todas as fontes pagadoras do ano em questão.\nVocê pode anexar os documentos clicando no botão de envio aqui no chat.",
  "/honorarios": "Para a análise do seu caso, elaboração do diagnóstico fiscal detalhado, preenchimento das retificadoras ou declarações em atraso e emissão das guias de regularização tributária (DARF/DAS), nossos honorários profissionais avulsos são de R$ [VALOR]. Não há nenhuma assinatura mensal vinculada. Posso gerar o prontuário de regularização?"
};

// Predefined evidence options for dynamic tag cloud based on Diagnosis
const evidenceTemplates = {
  "Malha Fina - Omissão de Rendimentos de Trabalho": [
    "Rendimentos recebidos acumuladamente não declarados",
    "Divergência entre DIRF da empresa e Declaração do contribuinte",
    "Falta de comprovantes de despesas dedutíveis",
    "Duplicidade de dependentes declarados por cônjuges",
    "Recebimento de aluguel por pessoa física não declarado"
  ],
  "Malha Fina - Glosa de Despesas Médicas sem Comprovante": [
    "Despesas com médicos ou dentistas sem recibo fiscal idôneo",
    "Divergência de valores entre declaração e DMED médica",
    "Ausência de comprovação de reembolso de plano de saúde",
    "Dedutibilidade irregular de gastos com bem-estar e academia"
  ],
  "Ganho de Capital - Venda de Imóvel sem Recolhimento de ITBI/IR": [
    "Venda de bem imóvel com lucro imobiliário",
    "Não preenchimento do programa GCAP no mês da venda",
    "Estouro do prazo de 180 dias para isenção residencial",
    "Valor da venda superior a R$ 440.000,00",
    "Falta de comprovação de reformas para atualização de custo"
  ],
  "Desenquadramento e Débitos retroativos do MEI": [
    "Falta de envio da declaração anual DASN-SIMEI",
    "Guias mensais DAS em aberto de múltiplos meses",
    "Faturamento anual superior a R$ 81.000,00",
    "Cadastro de atividade econômica em desacordo",
    "Contratação de mais de um funcionário registrado"
  ],
  "Carnê-Leão - Falta de Recolhimento Mensal de Autônomo": [
    "Falta de recolhimento mensal obrigatório do carnê-leão",
    "Rendimentos de pessoas físicas recebidos sem emissão de carnê",
    "Livro caixa com despesas dedutíveis não comprovadas",
    "Diferença de recolhimento de INSS de autônomo (alíquota 20%)"
  ]
};

// Suggested treatments templates based on Diagnosis
const treatmentTemplates = {
  "Malha Fina - Omissão de Rendimentos de Trabalho": "1. Retificar a Declaração de Ajuste Anual de IR do ano-calendário correspondente.\n2. Incluir a fonte pagadora de rendimentos tributáveis omitida.\n3. Emitir a guia complementar de imposto de renda (DARF cod 0211) com multa e juros de mora acumulados.\n4. Enviar o comprovante de pagamento ao chat para baixa fiscal.",
  "Malha Fina - Glosa de Despesas Médicas sem Comprovante": "1. Localizar recibos médicos/notas fiscais originais dos prestadores informados.\n2. Caso não possua comprovantes válidos, proceder com a retificação do IRPF excluindo as deduções glosadas.\n3. Gerar a guia complementar DARF cod 0211 para regularização do imposto devido.",
  "Ganho de Capital - Venda de Imóvel sem Recolhimento de ITBI/IR": "1. Preencher o programa GCAP (Ganho de Capital) relativo ao ano-calendário correspondente.\n2. Lançar o valor de aquisição histórico e valor de alienação, deduzindo corretagem paga.\n3. Aplicar os fatores de redução FR1 e FR2 caso aplicáveis.\n4. Emitir o DARF código 4600 para recolhimento com os acréscimos legais.\n5. Importar o arquivo do GCAP na Declaração Anual de Ajuste.",
  "Desenquadramento e Débitos retroativos do MEI": "1. Transmitir a declaração anual DASN-SIMEI em atraso referente ao exercício em aberto.\n2. Gerar o boleto de multa por atraso na entrega da declaração (MAED).\n3. Consolidar os débitos mensais das guias DAS e propor o parcelamento ordinário em até 60 vezes pelo portal do e-CAC.\n4. Emitir a primeira guia de parcelamento e enviar ao cliente.",
  "Carnê-Leão - Falta de Recolhimento Mensal de Autônomo": "1. Apurar os valores recebidos de pessoas físicas mês a mês via carnê-leão web.\n2. Gerar as guias DARF código 0190 vencidas com os juros e multa correspondentes.\n3. Lançar os rendimentos e impostos pagos na Declaração de Ajuste Anual de IRPF para compensação."
};

// Initial App Setup
document.addEventListener("DOMContentLoaded", async () => {
  // Exige login de contador (staff); redireciona se não autorizado.
  const ctx = await OCAuth.guard('contador');
  if (!ctx) return;
  
  // RBAC: Oculta itens restritos para parceiros
  if (ctx.staffRole === 'parceiro') {
    const targetsToHide = ['section-financeiro', 'section-config', 'section-dossie'];
    targetsToHide.forEach(target => {
      const btn = document.querySelector(`button.nav-item[data-target="${target}"]`);
      if (btn) btn.style.display = 'none';
    });
  }

  setupNavigation();
  setupEventListeners();
  setupCalculators();
  setupTimer();
  setupLogout();
  setupCriarSenhaContador();
  setupNovoCliente();
  setupResetarSenhaCliente();
  setupAbasDoPainel();
  setupClientesSecaoTabs();
  setupRelatorioSecaoTabs();
  setupRadarSecaoTabs();

  // Chat + eventos em tempo real via Supabase Realtime (substitui o Socket.io).
  OCRealtime.subscribe({
    onMessage: (clientId, message) => {
      if (clientsData[clientId]) {
        const exists = clientsData[clientId].messages.some(m => m.id === message.id);
        if (!exists) {
          clientsData[clientId].messages.push(message);
          if (activeClientId === clientId && document.getElementById('section-atendimento').classList.contains('active')) {
            renderMessages();
            playSound('message');
            // Chegou com a conversa aberta na tela: já foi lida.
            if (message.sender === 'client') marcarConversaLida();
          } else if (message.sender === 'client') {
            // Só mensagem DO CLIENTE avisa. Faltava este filtro: ao responder o
            // cliente A com o cliente B aberto, a resposta do próprio contador
            // caía aqui e inflava o contador de "não lidas" com o que ele mesmo
            // acabara de escrever.
            incrementContadorBadge();
            playSound('notification');
          }
          // A fila mostra não lidas, prévia e horário da última atividade —
          // tudo isso acabou de mudar, independentemente de qual conversa
          // estava aberta.
          atualizarFila();
        }
      } else {
        // cliente novo (ex.: primeiro contato) — recarrega a base
        refreshAllData();
      }
    },
    // Hoje o único UPDATE em mensagens é o read_at: o cliente confirmando leitura.
    onMessageUpdate: (clientId, message) => {
      const c = clientsData[clientId];
      if (!c) return;
      const i = c.messages.findIndex(m => m.id === message.id);
      if (i === -1) return;
      c.messages[i] = message;
      if (activeClientId === clientId) renderMessages();
      // O UPDATE aqui é o read_at. Marcar como lida muda a contagem da fila,
      // então a bolinha some sozinha em vez de ficar até o próximo F5.
      atualizarFila();
    },
    onData: async () => {
      await refreshAllData();
      if (activeClientId) { updateProntuarioChecklist(); renderMessages(); }
    },
    onStatus: (status, error) => {
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        console.warn('[realtime] canal do painel indisponível:', status, error || '');
        sincronizarAtendimentosDoContador();
      }
    }
  });
  iniciarSincronizacaoDeSeguranca();

  // Voltar para a aba com a conversa aberta conta como ler.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) marcarConversaLida(); });

  // Initial loading from backend API. O catálogo vem junto: o card da triagem no
  // dossiê traduz as respostas com ele, e a lista embutida no arquivo pode estar
  // desatualizada em relação ao que o contador editou.
  await Promise.all([refreshAllData(), OC_TRIAGEM.carregar(), carregarWorkspacePersistente()]);
  renderRadarInternoClientes();
  renderRadarFiscalConfigToUI();
  if (clientsData[activeClientId] && clientsData[activeClientId].atendimentoModalidade !== 'sem_agendamento') loadClient(activeClientId);
  else {
    const first = Object.values(clientsData).find(c => c.atendimentoModalidade !== 'sem_agendamento');
    if (first) loadClient(first.id);
  }
});

// Botão de sair (encerra a sessão do contador).
function setupLogout() {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); OCAuth.signOut(); });
  });
}

// Deixa o contador logado (via link mágico) opcionalmente criar uma senha,
// pro mesmo padrão do portal do cliente.
function setupCriarSenhaContador() {
  const input = document.getElementById('nova-senha-contador');
  const btn = document.getElementById('btn-criar-senha-contador');
  const msg = document.getElementById('msg-criar-senha-contador');
  if (!btn || !input) return;
  function aviso(texto, cor) { msg.style.display = 'block'; msg.style.color = cor; msg.textContent = texto; }
  btn.addEventListener('click', async () => {
    const senha = input.value;
    if (senha.length < 6) { aviso('A senha precisa ter pelo menos 6 caracteres.', '#B32620'); return; }
    btn.disabled = true; btn.textContent = 'Salvando...';
    const { error } = await sb.auth.updateUser({ password: senha });
    btn.disabled = false; btn.textContent = 'Criar senha';
    if (error) { aviso('Não foi possível salvar a senha. Tente novamente.', '#B32620'); return; }
    input.value = '';
    aviso('Senha criada! Da próxima vez você pode entrar com e-mail e senha, ou continuar usando o link do e-mail.', '#1F8A5F');
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}

// Cadastro manual de cliente (fora do checkout público) — cria a conta de
// acesso já com senha (opcional) em vez de esperar o primeiro pagamento.
function setupNovoCliente() {
  const btnAbrir = document.getElementById('btn-crm-novo-cliente');
  const form = document.getElementById('form-novo-cliente');
  const msg = document.getElementById('msg-novo-cliente');
  if (!form) return;
  function aviso(texto, cor) { msg.style.display = 'block'; msg.style.color = cor; msg.textContent = texto; }

  if (btnAbrir) btnAbrir.addEventListener('click', () => {
    form.reset();
    msg.style.display = 'none';
    openModal('modal-novo-cliente');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-novo-cliente');
    const payload = {
      name: document.getElementById('novo-cliente-nome').value.trim(),
      cpfCnpj: document.getElementById('novo-cliente-cpf').value.trim(),
      email: document.getElementById('novo-cliente-email').value.trim(),
      phone: document.getElementById('novo-cliente-telefone').value.trim(),
      senha: document.getElementById('novo-cliente-senha').value
    };
    btn.disabled = true; btn.textContent = 'Criando...';
    try {
      const res = await fetch(API_BASE + '/api/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'clientes_acesso', action: 'criar', payload })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { aviso(data.error || 'Não foi possível criar o cliente.', '#B32620'); return; }
      closeModal('modal-novo-cliente');
      showToast('Cliente criado com sucesso.');
      await recarregarClientes();
      renderCRM();
    } catch (_) {
      aviso('Falha de conexão. Tente novamente.', '#B32620');
    } finally {
      btn.disabled = false; btn.textContent = 'Criar cliente';
    }
  });
}

// Resetar a senha de acesso de um cliente já existente, direto do card dele
// no CRM — usa o mesmo endpoint admin do cadastro manual.
let clienteParaResetarSenha = null;
function abrirResetarSenhaCliente(clientId, nomeCliente) {
  clienteParaResetarSenha = clientId;
  const nomeEl = document.getElementById('resetar-senha-cliente-nome');
  if (nomeEl) nomeEl.textContent = 'Definir uma nova senha de acesso para ' + (nomeCliente || 'este cliente') + '.';
  const input = document.getElementById('resetar-senha-cliente-input');
  if (input) input.value = '';
  const msg = document.getElementById('msg-resetar-senha-cliente');
  if (msg) msg.style.display = 'none';
  openModal('modal-resetar-senha-cliente');
}

function setupResetarSenhaCliente() {
  const form = document.getElementById('form-resetar-senha-cliente');
  const msg = document.getElementById('msg-resetar-senha-cliente');
  if (!form) return;
  function aviso(texto, cor) { msg.style.display = 'block'; msg.style.color = cor; msg.textContent = texto; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!clienteParaResetarSenha) return;
    const btn = document.getElementById('btn-confirmar-resetar-senha-cliente');
    const novaSenha = document.getElementById('resetar-senha-cliente-input').value;
    if (novaSenha.length < 6) { aviso('A senha precisa ter pelo menos 6 caracteres.', '#B32620'); return; }
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const res = await fetch(API_BASE + '/api/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'clientes_acesso', action: 'resetar_senha', payload: { clientId: clienteParaResetarSenha, novaSenha } })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { aviso(data.error || 'Não foi possível resetar a senha.', '#B32620'); return; }
      closeModal('modal-resetar-senha-cliente');
      showToast('Senha do cliente atualizada.');
    } catch (_) {
      aviso('Falha de conexão. Tente novamente.', '#B32620');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar nova senha';
    }
  });
}

// Load everything from the backend
async function refreshAllData() {
  try {
    const clientsRes = await fetch(API_BASE + '/api/clients');
    const clients = await clientsRes.json();
    if (!clientsRes.ok) throw new Error(clients.error || 'Não foi possível carregar os clientes.');
    clientsData = clients;

    const appointmentsRes = await fetch(API_BASE + '/api/appointments');
    const appointmentsData = await appointmentsRes.json();
    if (!appointmentsRes.ok) throw new Error(appointmentsData.error || 'Não foi possível carregar os agendamentos.');
    appointments = appointmentsData;

    const notificationsRes = await fetch(API_BASE + '/api/notifications');
    const notificationsData = await notificationsRes.json();
    if (!notificationsRes.ok) throw new Error(notificationsData.error || 'Não foi possível carregar as notificações.');
    notifications = notificationsData;

    updateDashboardData();
    renderClientList();
    renderCRM();
    renderRadarFiscalConfigToUI();
    renderRadarInternoClientes();
    renderKanban();
    renderAppointments();
    renderCalendarioAgendamentos();
    if (calendarViewMode === 'lista') renderAgendaListaCompleta();
    renderAgendaDoDia();
    renderNotificationsLog();
    updateNotificationBadge();
    carregarCaixaPostal();
    setupPresence();
    refreshFinanceiro();
  } catch (e) {
    console.error("API Fetch Error:", e);
    showToast("Não consegui atualizar o painel. Verifique sua conexão e tente novamente.");
  }
}

function assinaturaDosAtendimentos(data) {
  return Object.values(data || {}).map(cliente => [
    cliente.id,
    cliente.status,
    cliente.atendimentoModalidade,
    ...(cliente.messages || []).map(m => `${m.id}:${m.readAt || ''}`)
  ].join('|')).sort().join('||');
}

async function sincronizarAtendimentosDoContador() {
  if (sincronizacaoAtendimentoEmAndamento || document.hidden) return;
  sincronizacaoAtendimentoEmAndamento = true;
  try {
    const res = await fetch(API_BASE + '/api/clients');
    const atualizados = await res.json();
    if (!res.ok) throw new Error(atualizados.error || 'Falha ao sincronizar atendimentos.');

    const mudou = assinaturaDosAtendimentos(clientsData) !== assinaturaDosAtendimentos(atualizados);
    if (!mudou) return;

    clientsData = atualizados;
    updateDashboardData();
    renderClientList();
    renderCRM();
    renderKanban();
    if (activeClientId && clientsData[activeClientId]) renderMessages();
  } catch (e) {
    console.warn('[sincronização] falhou:', e);
    if (!avisoSincronizacaoMostrado) {
      avisoSincronizacaoMostrado = true;
      showToast('O painel está tentando se reconectar às atualizações.');
    }
  } finally {
    sincronizacaoAtendimentoEmAndamento = false;
  }
}

function iniciarSincronizacaoDeSeguranca() {
  if (sincronizacaoAtendimentoTimer) return;
  // O intervalo é só uma garantia de entrega. No fluxo normal, o Realtime
  // continua atualizando o painel imediatamente.
  sincronizacaoAtendimentoTimer = setInterval(sincronizarAtendimentosDoContador, 12000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sincronizarAtendimentosDoContador();
  });
}

// Navigation Handling (SPA routing)
function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const targetSectionId = button.getAttribute("data-target");
      
      document.querySelectorAll(".app-sidebar-nav .nav-item").forEach(el => el.classList.remove("active"));
      button.classList.add("active");
      
      document.querySelectorAll(".content-panel").forEach(panel => panel.classList.remove("active"));
      
      const targetPanel = document.getElementById(targetSectionId);
      if (targetPanel) {
        targetPanel.classList.add("active");
        if (targetSectionId === 'section-atendimento') {
          clearContadorBadge();
          marcarConversaLida();
          const h = document.getElementById('chat-messages');
          if (h) h.scrollTop = h.scrollHeight;
        }
        if (targetSectionId === 'section-insights') renderInsights();
        // Ao entrar em Relatórios pelo menu (não pelo botão "Novo relatório"),
        // atualiza a aba que estiver visível no momento — por padrão é "fila".
        if (targetSectionId === 'section-dossie') {
          const abaAtiva = document.querySelector('#relatorio-secao-tabs .settings-tab.active');
          ativarAbaRelatorio(abaAtiva ? abaAtiva.dataset.relatorioSecaoTab : 'fila');
        }
      }
      
      document.getElementById("noti-dropdown").classList.remove("active");
    });
  });
}

function startOfWeekLocal(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekLocal(date = new Date()) {
  const d = startOfWeekLocal(date);
  d.setDate(d.getDate() + 7);
  return d;
}

function parseDateTimeLocal(dateIso, timeText = '00:00') {
  const day = dataLocalFromISO(normalizeAppointmentDate(dateIso));
  if (!day) return null;
  const [h, m] = String(timeText || '00:00').split(':').map(n => parseInt(n, 10));
  day.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return day;
}

function isThisWeek(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d)) return false;
  return d >= startOfWeekLocal() && d < endOfWeekLocal();
}

function isToday(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d)) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisMonth(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d)) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function clientTemMensagemNaoRespondida(client) {
  const msgs = Array.isArray(client.messages) ? client.messages : [];
  const lastUseful = [...msgs].reverse().find(m => m && m.sender !== 'system');
  return lastUseful && lastUseful.sender === 'client';
}

function dashboardClientButton(clientId, label = 'Abrir') {
  return `<button class="btn-doc-action" type="button" onclick="actionTimelineChat('${safe(clientId)}')"><i class="fa-solid fa-comments"></i> ${label}</button>`;
}

// Contato direto por e-mail/WhatsApp — usado quando ainda não existe chat aberto
// com o cliente (ex.: pagamento não finalizado, antes do cliente nascer no CRM).
function whatsappDigits(phone) {
  const digitos = String(phone || '').replace(/\D/g, '');
  if (!digitos) return '';
  return digitos.length <= 11 ? '55' + digitos : digitos;
}
function dashboardContatoLinks(nome, email, phone) {
  const links = [];
  if (email) links.push(`<a class="btn-doc-action" href="mailto:${safe(email)}"><i class="fa-solid fa-envelope"></i> E-mail</a>`);
  const wa = whatsappDigits(phone);
  if (wa) links.push(`<a class="btn-doc-action" href="https://wa.me/${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>`);
  return links.join(' ');
}

// Checklist mensal dos clientes recorrentes (parcelamento/obrigação mensal).
// Geração da guia ainda é manual (sem certificado do Integra Contador) — isto
// só lembra quem vence este mês e deixa marcar como feito.
async function renderGuiasMensais() {
  const list = document.getElementById('guias-mensais-lista');
  if (!list) return;
  let guias = [];
  try {
    const res = await fetch(API_BASE + '/api/guias-mensais');
    if (res.ok) guias = await res.json();
  } catch (_) { /* silencioso — o card só fica vazio */ }

  const pendentes = guias.filter(g => g.status !== 'gerada');

  if (!pendentes.length) {
    list.innerHTML = `
      <div class="dashboard-empty-state">
        <i class="fa-solid fa-file-invoice"></i>
        <p>Nenhuma guia pendente este mês.</p>
        <span>Ative "Acompanhamento recorrente" no CRM de um cliente com parcelamento para ele aparecer aqui todo mês.</span>
      </div>`;
    return;
  }

  list.innerHTML = pendentes.map(g => `
    <div class="dashboard-alert-card">
      <div class="dashboard-alert-card-top">
        <span>${safe(g.clientName)}</span>
        <span class="sla-badge sla-yellow" style="margin: 0;">Pendente</span>
      </div>
      <p>${safe(g.tipo || 'Acompanhamento mensal')} · competência ${safe(g.competencia)}</p>
      <div class="dashboard-card-actions">
        ${g.clientRef ? dashboardClientButton(g.clientRef, 'Contato') : ''}
        <button class="btn-doc-action" type="button" data-guia-concluir="${g.id}"><i class="fa-solid fa-check"></i> Marcar gerada</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-guia-concluir]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(API_BASE + '/api/guias-mensais/' + btn.dataset.guiaConcluir + '/concluir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        if (!res.ok) { showToast('Não foi possível marcar como gerada.'); btn.disabled = false; return; }
        showToast('Guia marcada como gerada.');
        renderGuiasMensais();
      } catch (_) {
        showToast('Falha de conexão.');
        btn.disabled = false;
      }
    });
  });
}

function updateDashboardFinanceiroKpis() {
  const faturamentoEl = document.getElementById("kpi-faturamento");
  if (!faturamentoEl) return;

  const pagas = financeiro.cobrancas.filter(c => c.status === 'paid');
  const fallbackHonorariosAtivos = Object.values(clientsData)
    .filter(c => ['active', 'ready', 'done'].includes(etapaDoCliente(c)))
    .reduce((total, c) => total + (Number(c.honorarios) || 0), 0);

  function preencherFaturamento(elId, trendSelector, cobrancasNoPeriodo, honorariosNoPeriodo, rotuloPeriodo) {
    const el = document.getElementById(elId);
    if (!el) return;
    const centavos = cobrancasNoPeriodo.reduce((total, c) => total + (c.valueCents || 0), 0);
    const valor = centavos > 0 ? centavos / 100 : (honorariosNoPeriodo || (elId === 'kpi-faturamento' ? fallbackHonorariosAtivos : 0));
    el.textContent = formatBRL(valor);
    const trend = el.parentElement?.querySelector(trendSelector);
    if (!trend) return;
    if (centavos > 0) {
      trend.className = 'kpi-trend positive';
      trend.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${cobrancasNoPeriodo.length} cobrança${cobrancasNoPeriodo.length !== 1 ? 's' : ''} paga${cobrancasNoPeriodo.length !== 1 ? 's' : ''} ${rotuloPeriodo}`;
    } else {
      trend.className = 'kpi-trend warning';
      trend.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nenhuma cobrança paga ainda';
    }
  }

  preencherFaturamento('kpi-faturamento-dia', '.kpi-trend', pagas.filter(c => isToday(c.paidAt || c.createdAt)), 0, 'hoje');
  preencherFaturamento('kpi-faturamento', '.kpi-trend', pagas.filter(c => isThisWeek(c.paidAt || c.createdAt)),
    appointments.filter(a => a.status === 'done' && isThisWeek(parseDateTimeLocal(a.date, a.time)))
      .reduce((total, a) => total + (Number(clientsData[a.clientRef]?.honorarios) || 0), 0), 'nesta semana');
  preencherFaturamento('kpi-faturamento-mes', '.kpi-trend', pagas.filter(c => isThisMonth(c.paidAt || c.createdAt)), 0, 'neste mês');
}

function updateDashboardAtendimentosMes() {
  const el = document.getElementById('kpi-atendimentos-mes');
  if (!el) return;
  const doMes = appointments.filter(a => isThisMonth(parseDateTimeLocal(a.date, a.time)));
  el.textContent = String(doMes.length);
  const concluidos = doMes.filter(a => a.status === 'done').length;
  const trend = el.parentElement?.querySelector('.kpi-trend');
  if (trend) {
    trend.className = concluidos ? 'kpi-trend positive' : 'kpi-trend warning';
    trend.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${concluidos} concluído${concluidos !== 1 ? 's' : ''} até agora`;
  }
}

// Mensagens de processos em aberto: clientes com atendimento ainda não
// concluído cuja última mensagem veio do cliente (aguardando resposta do contador).
function renderMensagensAbertas() {
  const list = document.getElementById('mensagens-abertas-lista');
  const badge = document.getElementById('mensagens-abertas-badge');
  if (!list) return;

  const pendentes = Object.values(clientsData)
    .filter(client => etapaDoCliente(client) !== 'done' && clientTemMensagemNaoRespondida(client));

  if (badge) badge.textContent = `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`;

  if (!pendentes.length) {
    list.innerHTML = `
      <div class="dashboard-empty-state">
        <i class="fa-solid fa-comment-dots"></i>
        <p>Nenhuma mensagem aguardando resposta.</p>
        <span>Quando um cliente com processo em aberto mandar mensagem, ela aparece aqui.</span>
      </div>`;
    return;
  }

  list.innerHTML = pendentes.slice(0, 8).map(client => `
    <div class="dashboard-alert-card">
      <div class="dashboard-alert-card-top">
        <span>${safe(client.name || 'Cliente')}</span>
        <span class="sla-badge sla-green" style="margin: 0;">Responder</span>
      </div>
      <p>${safe(client.taxType || 'Atendimento')} · última mensagem veio do cliente</p>
      ${dashboardClientButton(client.id, 'Ver caso')}
    </div>
  `).join('');
}

function renderAgendaSemana() {
  const list = document.getElementById('agenda-semana-lista');
  const badge = document.getElementById('agenda-semana-count-badge');
  if (!list) return;

  const inicio = startOfWeekLocal();
  const fim = endOfWeekLocal();
  const daSemana = appointments
    .filter(app => {
      const data = dataLocalFromISO(normalizeAppointmentDate(app.date));
      return data && data >= inicio && data < fim;
    })
    .sort((a, b) => {
      const dataA = parseDateTimeLocal(a.date, a.time)?.getTime() || 0;
      const dataB = parseDateTimeLocal(b.date, b.time)?.getTime() || 0;
      return dataA - dataB;
    });

  const pendentes = daSemana.filter(app => app.status !== 'done').length;
  if (badge) badge.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;

  if (!daSemana.length) {
    list.innerHTML = `
      <div class="dashboard-empty-state">
        <i class="fa-solid fa-calendar-week"></i>
        <p>Nenhum atendimento agendado para esta semana.</p>
        <span>Os próximos atendimentos aparecerão aqui conforme forem agendados.</span>
      </div>`;
    return;
  }

  list.innerHTML = daSemana.map(app => {
    const concluido = app.status === 'done';
    const data = `${OCTempo.rotuloDia(normalizeAppointmentDate(app.date))} · ${safe(app.time || '--:--')}`;
    return `
      <div class="dashboard-alert-card">
        <div class="dashboard-alert-card-top">
          <span>${data}</span>
          <span class="sla-badge ${concluido ? 'sla-green' : 'sla-yellow'}" style="margin: 0;">${concluido ? 'Concluído' : 'Agendado'}</span>
        </div>
        <p>${safe(app.clientName || 'Cliente')} · ${safe(app.taxType || 'Atendimento')}</p>
        ${app.clientRef ? dashboardClientButton(app.clientRef, 'Abrir chat') : ''}
      </div>`;
  }).join('');
}

// Aba "Cobranças em Aberto" do Financeiro: mesma fonte de dados do card do
// dashboard, mas em tabela completa com filtro por tempo em aberto (aging) —
// útil pra priorizar quem cobrar primeiro.
let financeiroAbertasFiltro = 'todas';

function renderFinanceiroCobrancasAbertas() {
  const tbody = document.getElementById('financeiro-abertas-lista');
  const badge = document.getElementById('financeiro-abertas-badge');
  if (!tbody) return;

  const comDias = financeiro.cobrancas
    .filter(c => c.status !== 'paid')
    .map(c => ({ ...c, dias: c.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000)) : null }));

  if (badge) badge.textContent = String(comDias.length);

  const filtradas = comDias
    .filter(c => {
      if (financeiroAbertasFiltro === '0-3') return c.dias != null && c.dias <= 3;
      if (financeiroAbertasFiltro === '4-7') return c.dias != null && c.dias >= 4 && c.dias <= 7;
      if (financeiroAbertasFiltro === '8+') return c.dias != null && c.dias >= 8;
      return true;
    })
    .sort((a, b) => (b.dias || 0) - (a.dias || 0));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--color-text-secondary);">Nenhuma cobrança em aberto${financeiroAbertasFiltro === 'todas' ? '' : ' nesse período'}.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(c => {
    const client = clientsData[c.clientRef] || {};
    const dados = c.dadosCliente || {};
    const nome = client.name || dados.name || c.clientRef || 'Cliente';
    const email = client.email || dados.email;
    const phone = client.phone || dados.phone;
    return `<tr>
      <td><strong>${safe(nome)}</strong></td>
      <td>${formatBRL((c.valueCents || 0) / 100)}</td>
      <td><span class="status-badge status-docs">${safe(c.status || 'aberta')}</span></td>
      <td>${c.dias == null ? '—' : `${c.dias} dia${c.dias !== 1 ? 's' : ''}`}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        ${dashboardContatoLinks(nome, email, phone)}
        ${c.invoiceUrl ? `<a class="btn-doc-action" href="${safe(c.invoiceUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> Cobrança</a>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// Update executive dashboard KPIs and timeline
function updateDashboardData() {
  updateDashboardFinanceiroKpis();
  updateDashboardAtendimentosMes();
  renderMensagensAbertas();
  renderGuiasMensais();
  renderAgendaSemana();

  const todayApps = appointments.filter(a => OCTempo.ehHoje(normalizeAppointmentDate(a.date)));
  const timelineContainer = document.getElementById("dashboard-timeline");
  if (!timelineContainer) return;
  timelineContainer.innerHTML = "";

  const pendingToday = todayApps.filter(a => a.status !== "done").length;
  const agendaBadge = document.getElementById("agenda-count-badge");
  if (agendaBadge) agendaBadge.textContent = `${pendingToday} pendente${pendingToday !== 1 ? 's' : ''}`;

  if (todayApps.length === 0) {
    timelineContainer.innerHTML = `<p style="font-size: 13px; color: var(--color-text-secondary); text-align: center; padding: 20px 0;">Nenhuma atividade agendada para hoje.</p>`;
    return;
  }

  todayApps.sort((a,b) => String(a.time || '').localeCompare(String(b.time || ''))).forEach(app => {
    const isActive = app.status === "active" ? "active" : "";
    
    let btnHtml = "";
    if (app.status === "pending" || app.status === "active") {
      btnHtml = app.clientRef ? dashboardClientButton(app.clientRef, 'Chat') : '<span style="font-size: 11px; color: var(--color-text-secondary);">Sem cliente vinculado</span>';
    } else {
      btnHtml = `<span style="font-size: 11px; color:#2ECC71; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Concluído</span>`;
    }

    const hora = safe(app.time || '--:--');
    const itemHtml = `
      <div class="timeline-item ${isActive}">
        <div class="timeline-badge">${safe(String(app.time || '--').split(":")[0])}h</div>
        <div class="timeline-content-card">
          <div class="timeline-content-info">
            <span class="timeline-time">${hora}</span>
            <span class="timeline-title">${safe(app.clientName || 'Cliente')}</span>
            <span class="timeline-desc">${safe(app.taxType || 'Atendimento')}</span>
          </div>
          ${btnHtml}
        </div>
      </div>
    `;
    timelineContainer.insertAdjacentHTML("beforeend", itemHtml);
  });
}

// Redirect action to client chat
function actionTimelineChat(clientRef) {
  if (!clientRef || !clientsData[clientRef]) {
    showToast("Cliente sem conversa vinculada.");
    return;
  }
  
  const btnAtend = document.getElementById("nav-btn-atendimento");
  btnAtend.click();
  loadClient(clientRef);
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage();
  });

  const inputMsg = document.getElementById("message-input");
  if (inputMsg) inputMsg.addEventListener("input", () => {
    if (inputMsg.value.trim() && typingCanal) typingCanal.aviso('agent');
  });

  document.getElementById("search-input-tab").addEventListener("input", (e) => {
    renderClientList(e.target.value);
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
  });

  const btnFinishChat = document.getElementById("btn-finish-chat");
  if (btnFinishChat) {
    btnFinishChat.addEventListener("click", finishActiveChat);
  }

  const btnSendAcompanhamento = document.getElementById("btn-send-acompanhamento");
  if (btnSendAcompanhamento) {
    btnSendAcompanhamento.addEventListener("click", moverParaAcompanhamento);
  }



  const toggleSound = document.getElementById("toggle-sound-enabled");
  if (toggleSound) {
    toggleSound.addEventListener("change", (e) => {
      isSoundEnabled = e.target.checked;
      if (isSoundEnabled) playSound("success");
    });
  }


  document.getElementById("btn-sim-reply").addEventListener("click", simulateClientMessage);
  document.getElementById("btn-sim-upload").addEventListener("click", simulateClientFileUpload);
  document.getElementById("btn-sim-voice").addEventListener("click", simulateClientAudioMessage);

  document.getElementById("prontuario-diagnostico").addEventListener("change", (e) => {
    updateProntuarioTagsAndTreatment(e.target.value);
  });

  setupAnotacoesAtendimento();

  document.getElementById("btn-generate-prontuario").addEventListener("click", () => abrirRelatorio());
  document.getElementById("btn-sugerir-ia").addEventListener("click", sugerirProntuarioIA);
  setupRelatorioWizard();

  document.getElementById("btn-noti-trigger").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("noti-dropdown").classList.toggle("active");
  });

  document.addEventListener("click", () => {
    document.getElementById("noti-dropdown").classList.remove("active");
  });

  document.getElementById("noti-dropdown").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.getElementById("btn-noti-mark-read-dropdown").addEventListener("click", async () => {
    await fetch(API_BASE + '/api/notifications/read-all', { method: 'POST' });
    await refreshAllData();
    showToast("Todas as notificações marcadas como lidas.");
  });

  document.getElementById("btn-clear-notifications").addEventListener("click", async () => {
    await fetch(API_BASE + '/api/notifications?clear=all', { method: 'DELETE' });
    await refreshAllData();
    showToast("Histórico de notificações limpo.");
  });

  document.getElementById("form-new-appointment").addEventListener("submit", (e) => {
    e.preventDefault();
    bookNewAppointment();
  });

  const btnCalendarToday = document.getElementById("calendar-today");
  if (btnCalendarToday) {
    btnCalendarToday.addEventListener("click", () => {
      calendarMonthDate = new Date();
      renderCalendarioAgendamentos();
    });
  }

  const btnCalendarPrev = document.getElementById("calendar-prev");
  if (btnCalendarPrev) {
    btnCalendarPrev.addEventListener("click", () => {
      calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() - 1, 1);
      renderCalendarioAgendamentos();
    });
  }

  const btnCalendarNext = document.getElementById("calendar-next");
  if (btnCalendarNext) {
    btnCalendarNext.addEventListener("click", () => {
      calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + 1, 1);
      renderCalendarioAgendamentos();
    });
  }

  // Alterna entre a visão em grid (Mês) e a visão em Lista dos agendamentos.
  document.querySelectorAll('[data-calendar-view]').forEach(btn => {
    btn.addEventListener('click', () => setCalendarViewMode(btn.dataset.calendarView));
  });

  document.querySelectorAll('[data-agenda-lista-filtro]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-agenda-lista-filtro]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      agendaListaFiltro = btn.dataset.agendaListaFiltro;
      renderAgendaListaCompleta();
    });
  });

  const btnSaveAvailability = document.getElementById("btn-save-availability");
  if (btnSaveAvailability) {
    btnSaveAvailability.addEventListener("click", salvarDisponibilidadeAgenda);
  }
  document.getElementById("btn-add-dia-bloqueado")?.addEventListener("click", adicionarDiaBloqueado);
  const inputBloqueio = document.getElementById("bloqueio-dia-input");
  if (inputBloqueio) inputBloqueio.min = new Date().toISOString().slice(0, 10);

  document.querySelectorAll(".schedule-filters .btn-filter-tag").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".schedule-filters .btn-filter-tag").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      currentScheduleFilter = btn.getAttribute("data-filter");
      renderAppointments();
    });
  });

  // Sidebar Toggle
  const sidebar = document.querySelector(".app-sidebar-nav");
  const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      const icon = document.getElementById("icon-toggle-sidebar");
      if (sidebar.classList.contains("collapsed")) {
        icon.classList.remove("fa-chevron-left");
        icon.classList.add("fa-chevron-right");
      } else {
        icon.classList.remove("fa-chevron-right");
        icon.classList.add("fa-chevron-left");
      }
    });
  }

  // Settings Tabs Logic
  document.querySelectorAll(".settings-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".settings-pane").forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const alvo = tab.getAttribute("data-tab");
      const targetPane = document.getElementById(alvo);
      if (targetPane) {
        targetPane.classList.add("active");
      }
      // Recarrega a cada abertura: se outra pessoa da equipe mexeu no catálogo,
      // editar por cima de uma cópia velha apagaria o trabalho dela no Salvar.
      if (alvo === 'tab-cliente') ConfigCliente.abrir();
    });
  });

  // Settings Toggle Switches (Mock behavior)
  document.querySelectorAll(".toggle-switch").forEach(toggle => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
    });
  });
}

// Render client list side panel
// ---------------------------------------------------------------------------
// Fila de atendimento
// ---------------------------------------------------------------------------
// Quantas mensagens DO CLIENTE ainda não foram lidas. É o número que aparece na
// bolinha da linha. Mensagens do próprio contador nunca contam — ele não precisa
// ser avisado do que ele mesmo escreveu.
function naoLidasDoCliente(client) {
  if (!client.messages) return 0;
  return client.messages.filter(m => m.sender === 'client' && !m.readAt).length;
}

// Última mensagem da conversa, para a prévia e para ordenar por atividade.
function ultimaMensagem(client) {
  if (!client.messages || !client.messages.length) return null;
  return client.messages[client.messages.length - 1];
}

// Texto curto da última mensagem. Cards de documento/áudio não têm texto útil,
// então viram uma descrição do que são.
function previaDaMensagem(msg) {
  if (!msg) return 'Sem mensagens ainda';
  if (msg.type === 'doc-request') return '📎 Documento solicitado: ' + (msg.docName || '');
  if (msg.type === 'doc-upload') return '📎 ' + (msg.docName || 'Arquivo enviado');
  if (msg.type === 'audio') return '🎤 Áudio';
  const t = (msg.text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Mensagem';
  return t.length > 48 ? t.slice(0, 48) + '…' : t;
}

// Horário da última atividade: hoje mostra a hora, ontem "Ontem", antes a data.
// Antes a fila mostrava o horário AGENDADO, que nunca mudava — não dizia nada
// sobre quem estava esperando resposta agora.
function horaDaAtividade(msg) {
  const d = msg ? OCTempo.data(msg) : null;
  if (!d) return '';
  const hoje = new Date();
  const zera = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dias = Math.round((zera(hoje) - zera(d)) / 86400000);
  if (dias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dias === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ---------------------------------------------------------------------------
// Agenda do dia — a aba ao lado da Fila
// ---------------------------------------------------------------------------
// O atendimento é por agendamento, então a agenda do dia é o plano de trabalho.
// Ela existia só na seção Agendamentos, longe de onde o atendimento acontece.

// Converte "14:00" em minutos para ordenar. Horário como texto ordena certo por
// acaso em HH:MM, mas não se alguém gravar "9:00" sem o zero.
function minutosDoHorario(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

// Passou da hora e ainda não foi atendido? Vira "atrasado".
function agendamentoAtrasado(app) {
  if (app.status === 'done' || app.status === 'active') return false;
  if (!OCTempo.ehHoje(normalizeAppointmentDate(app.date))) return false;
  const agora = new Date();
  return minutosDoHorario(app.time) < agora.getHours() * 60 + agora.getMinutes();
}

function renderAgendaDoDia() {
  const container = document.getElementById('agenda-do-dia-list');
  const cabecalho = document.getElementById('agenda-dia-cabecalho');
  const contador = document.getElementById('agenda-count-tab');
  if (!container) return;

  const doDia = appointments
    .filter(a => OCTempo.ehHoje(normalizeAppointmentDate(a.date)))
    .sort((a, b) => minutosDoHorario(a.time) - minutosDoHorario(b.time));

  if (contador) contador.textContent = doDia.length;

  if (cabecalho) {
    const hoje = new Date();
    const bruto = hoje.toLocaleDateString('pt-BR',
      { weekday: 'long', day: '2-digit', month: 'long' });
    // Só a primeira letra: "sábado, 18 de julho" → "Sábado, 18 de julho".
    const porExtenso = bruto.charAt(0).toUpperCase() + bruto.slice(1);
    const feitos = doDia.filter(a => a.status === 'done').length;
    cabecalho.innerHTML =
      `<span class="agenda-dia-data">${porExtenso}</span>` +
      `<span class="agenda-dia-resumo">${feitos} de ${doDia.length} concluído${doDia.length === 1 ? '' : 's'}</span>`;
  }

  if (!doDia.length) {
    container.innerHTML =
      '<p class="agenda-vazia">Nenhum atendimento marcado para hoje.</p>';
    return;
  }

  container.innerHTML = doDia.map(app => {
    const atrasado = agendamentoAtrasado(app);

    let rotuloStatus = 'Aguardando', classeStatus = 'status-waiting';
    if (app.status === 'done') { rotuloStatus = 'Concluído'; classeStatus = 'status-done'; }
    else if (app.status === 'active') { rotuloStatus = 'Em atendimento'; classeStatus = 'status-active'; }
    else if (atrasado) { rotuloStatus = 'Atrasado'; classeStatus = 'status-atrasado'; }

    // Sem cliente_ref não há conversa para abrir (ex.: marcação avulsa feita à
    // mão). O card aparece, mas não finge ser clicável.
    const temChat = !!app.clientRef && !!clientsData[app.clientRef];
    const acao = temChat ? `onclick="abrirAtendimentoDaAgenda('${app.clientRef}')"` : '';

    return `
      <div class="agenda-item ${atrasado ? 'atrasado' : ''} ${temChat ? '' : 'sem-chat'}" ${acao}>
        <div class="agenda-item-hora">${app.time || '--:--'}</div>
        <div class="agenda-item-corpo">
          <div class="agenda-item-nome">${escapeHtml(app.clientName || '')}</div>
          <div class="agenda-item-tema">${escapeHtml(app.taxType || 'Sem tema definido')}</div>
          <span class="status-badge ${classeStatus}">${rotuloStatus}</span>
        </div>
        ${temChat ? '<i class="fa-solid fa-chevron-right agenda-item-seta"></i>' : ''}
      </div>`;
  }).join('');
}

// Abrir pela agenda leva direto para a conversa daquele cliente.
function abrirAtendimentoDaAgenda(clientRef) {
  loadClient(clientRef);
  trocarListaDoPainel('fila');
  if (window.OCMobile && window.OCMobile.ativo()) window.OCMobile.irParaConversa();
}

// Alterna Fila / Agenda do dia.
function trocarListaDoPainel(qual) {
  document.querySelectorAll('.painel-aba').forEach(b => {
    const ativa = b.dataset.lista === qual;
    b.classList.toggle('ativa', ativa);
    b.setAttribute('aria-selected', ativa ? 'true' : 'false');
  });
  document.querySelectorAll('.painel-lista').forEach(l => {
    l.classList.toggle('ativa', l.id === 'lista-' + qual);
  });
  if (qual === 'agenda') renderAgendaDoDia();
}

function setupAbasDoPainel() {
  document.querySelectorAll('.painel-aba').forEach(b => {
    b.addEventListener('click', () => trocarListaDoPainel(b.dataset.lista));
  });
}

// Redesenha a fila preservando o que estiver escrito na busca. Existe para os
// vários pontos que mudam a fila (mensagem nova, leitura confirmada) não terem
// que saber o id do campo de busca cada um por sua conta.
function atualizarFila() {
  const busca = document.getElementById('search-input-tab');
  renderClientList(busca ? busca.value : '');
}

function renderClientList(filter = "") {
  const container = document.getElementById("client-list-tab");
  container.innerHTML = "";

  let count = 0;

  // Ordem: quem tem mensagem não lida primeiro, depois quem falou por último.
  // A ordem antiga era o horário agendado — fixo, então a fila ficava parada
  // mesmo quando alguém estava esperando resposta há uma hora.
  const ordenados = Object.values(clientsData)
  // Atendimento sem agendamento vai direto para triagem, documentos, dossiê
  // e Kanban. Não deve aparecer como se houvesse uma conversa esperando.
  .filter(client => client.atendimentoModalidade !== 'sem_agendamento')
  .sort((a, b) => {
    const na = naoLidasDoCliente(a), nb = naoLidasDoCliente(b);
    if ((na > 0) !== (nb > 0)) return nb - na;

    const ma = ultimaMensagem(a), mb = ultimaMensagem(b);
    const da = ma && OCTempo.data(ma) ? OCTempo.data(ma).getTime() : 0;
    const db = mb && OCTempo.data(mb) ? OCTempo.data(mb).getTime() : 0;
    if (da !== db) return db - da;

    return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
  });

  ordenados.forEach(client => {
    if (filter && !client.name.toLowerCase().includes(filter.toLowerCase())) return;
    count++;

    const isActive = client.id === activeClientId ? "active" : "";

    let statusClass = "status-waiting";
    let statusText = "Aguardando";
    if (client.status === "active") {
      statusClass = "status-active";
      statusText = "Em Chat";
    } else if (client.status === "docs") {
      statusClass = "status-docs";
      statusText = "Aguardando Doc";
    }

    const naoLidas = naoLidasDoCliente(client);
    const ultima = ultimaMensagem(client);
    const previa = previaDaMensagem(ultima);
    const hora = horaDaAtividade(ultima) || (client.scheduledTime || '');

    // A prévia vem de texto digitado pelo cliente: escapa, senão um "<" na
    // mensagem quebra a lista (ou pior).
    const previaSegura = escapeHtml(previa);

    const itemHtml = `
      <div class="chat-item ${isActive} ${naoLidas ? 'tem-nao-lidas' : ''}" onclick="loadClient('${client.id}')">
        <div class="chat-item-avatar">${escapeHtml(client.avatar || initials(client.name))}</div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-item-name">${escapeHtml(client.name)}</span>
            <span class="chat-item-time">${hora}</span>
          </div>
          <div class="chat-item-preview">${previaSegura}</div>
          <div class="chat-item-footer">
            <span class="status-badge ${statusClass}">${statusText}</span>
            <span class="chat-item-tag">${escapeHtml(client.taxType || '')}</span>
            ${naoLidas ? `<span class="chat-item-nao-lidas" title="${naoLidas} mensagem(ns) não lida(s)">${naoLidas > 99 ? '99+' : naoLidas}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", itemHtml);
  });

  document.getElementById("chat-count-tab").textContent = count;
}

// Load selected client in active pane
// ---------------------------------------------------------------------------
// "Digitando..." — o canal é por cliente, então trocar de conversa troca o canal.
// ---------------------------------------------------------------------------
let typingCanal = null;
let typingTimer = null;

function ligarDigitando(clientId) {
  if (typingCanal) typingCanal.encerrar();
  esconderDigitando();
  typingCanal = OCChat.typing(clientId, {
    onTyping: (from) => { if (from === 'client') mostrarDigitando(); }
  });
}

function montarIndicadorDigitando() {
  if (document.getElementById('oc-digitando')) return;
  const historico = document.getElementById('chat-messages');
  if (!historico) return;
  const el = document.createElement('div');
  el.id = 'oc-digitando';
  el.className = 'chat-digitando';
  el.innerHTML = '<span class="ponto"></span><span class="ponto"></span><span class="ponto"></span>'
               + '<em>O cliente está digitando</em>';
  historico.parentElement.insertBefore(el, historico.nextSibling);
}

function mostrarDigitando() {
  montarIndicadorDigitando();
  const el = document.getElementById('oc-digitando');
  if (el) el.classList.add('ativo');
  // Some sozinho: sem isso, quem fechasse a aba no meio de uma frase deixaria o
  // indicador ligado para sempre.
  clearTimeout(typingTimer);
  typingTimer = setTimeout(esconderDigitando, 3000);
}

function esconderDigitando() {
  const el = document.getElementById('oc-digitando');
  if (el) el.classList.remove('ativo');
}

// ===========================================================================
// TRIAGEM no dossiê — o que o cliente contou antes de entrar.
//
// O card é só leitura, de propósito: a triagem é a palavra do cliente, e o
// painel não deve reescrevê-la. O que ele oferece é o botão de APLICAR — que
// transforma a hipótese em diagnóstico e a lista de documentos em checklist,
// com o contador decidindo. Aplicar sozinho seria deixar o cliente diagnosticar.
// ===========================================================================
function renderTriagemCard(client) {
  const card = document.getElementById('triagem-card');
  if (!card) return;
  const t = client.triagem;

  if (!t || t.status !== 'enviada') {
    card.hidden = false;
    card.className = 'triagem-card vazio';
    card.innerHTML = t
      ? '<i class="fa-solid fa-hourglass-half"></i> <span>O cliente começou a triagem, mas ainda não enviou.</span>'
      : '<i class="fa-regular fa-circle-question"></i> <span>Sem triagem — este cliente entra sem contexto prévio.</span>';
    return;
  }

  const assunto = OC_TRIAGEM.acharAssunto(t.assunto);
  const pct = OC_TRIAGEM.completude(t);
  const sugerido = OC_TRIAGEM.diagnosticoSugerido(t.assunto, t.respostas);

  // Só as perguntas que ele respondeu. Listar "não informado" cinco vezes
  // empurraria o relato — a parte que importa — para fora da tela.
  let respostasHtml = '';
  if (assunto) {
    assunto.perguntas.forEach(p => {
      const v = t.respostas && t.respostas[p.id];
      if (v === undefined || v === null || String(v).trim() === '') return;
      respostasHtml += `<div class="triagem-card-resp"><span>${p.label}</span><strong>${escapeHtml(String(v))}</strong></div>`;
    });
  }

  card.hidden = false;
  card.className = 'triagem-card';
  card.innerHTML = `
    <div class="triagem-card-topo">
      <i class="fa-solid ${assunto ? assunto.icone : 'fa-clipboard-question'}"></i>
      <div>
        <span class="triagem-card-rotulo">O cliente contou antes de entrar</span>
        <strong>${assunto ? escapeHtml(assunto.titulo) : 'Assunto não informado'}</strong>
      </div>
      <span class="triagem-card-pct" title="Quanto da triagem ele preencheu">${pct}%</span>
    </div>
    ${t.descricao ? `<blockquote class="triagem-card-relato">${escapeHtml(t.descricao)}</blockquote>` : ''}
    ${respostasHtml ? `<div class="triagem-card-respostas">${respostasHtml}</div>` : ''}
    ${sugerido ? `
      <div class="triagem-card-sugestao">
        <div>
          <span class="triagem-card-rotulo">Hipótese pela triagem — confirme antes de usar</span>
          <strong>${escapeHtml(sugerido)}</strong>
        </div>
        <button class="btn-doc-action" id="btn-aplicar-triagem">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Aplicar ao dossiê
        </button>
      </div>` : ''}
  `;

  const btn = document.getElementById('btn-aplicar-triagem');
  if (btn) btn.addEventListener('click', () => aplicarTriagem(client.id));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Preenche diagnóstico + checklist a partir da triagem. Os documentos que o
// cliente já anexou entram JÁ MARCADOS — pedir de novo o que ele mandou é o
// tipo de coisa que faz o cliente achar que ninguém leu.
async function aplicarTriagem(clientId) {
  const client = clientsData[clientId];
  const t = client && client.triagem;
  if (!t || !t.assunto) return;

  const btn = document.getElementById('btn-aplicar-triagem');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...'; }

  const diagnosis = OC_TRIAGEM.diagnosticoSugerido(t.assunto, t.respostas);
  const checklist = OC_TRIAGEM.checklistDoAssunto(t.assunto);
  try {
    const res = await fetch(API_BASE + '/api/documentos?clientId=' + encodeURIComponent(clientId));
    const docs = await res.json();
    (docs || []).forEach(d => {
      if (d.checklistItem && checklist[d.checklistItem] !== undefined) checklist[d.checklistItem] = true;
    });

    const r2 = await fetch(API_BASE + '/api/triagem/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, diagnosis, checklist })
    });
    if (!r2.ok) throw new Error('resposta ' + r2.status);
    clientsData[clientId] = await r2.json();

    if (activeClientId === clientId) {
      document.getElementById('prontuario-diagnostico').value = diagnosis || '';
      updateProntuarioChecklist();
      renderTriagemCard(clientsData[clientId]);
    }
    showToast('Dossiê preenchido a partir da triagem. Confira o diagnóstico.');
  } catch (e) {
    console.error('Falha ao aplicar a triagem:', e);
    showToast('Não consegui aplicar a triagem. Tente de novo.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Aplicar ao dossiê'; }
  }
}

function loadClient(clientId) {
  activeClientId = clientId;
  const client = clientsData[clientId];

  // Atualiza botão de bloqueio
  const lockBtn = document.getElementById('btn-toggle-lock');
  if (lockBtn) {
    const bloqueado = client.status === 'locked';
    // Só o ícone na barra; o nome vive no data-nome, que a dica de hover mostra.
    lockBtn.innerHTML = bloqueado
      ? '<i class="fa-solid fa-lock-open"></i>'
      : '<i class="fa-solid fa-lock"></i>';
    const nome = bloqueado ? 'Liberar chat do cliente' : 'Bloquear chat do cliente';
    lockBtn.dataset.nome = nome;
    lockBtn.setAttribute('aria-label', nome);
    lockBtn.classList.toggle('ativo', bloqueado);
  }

  // 1. Marcar aba lateral ativa
  document.querySelectorAll(".chat-item").forEach(item => item.classList.remove("active"));

  ligarDigitando(clientId);
  resetChatTimer();
  atualizarContextoCopilot(client);

  if (client.status === "done" || client.status === "locked") {
    disableChatInput(client.status);
  } else {
    enableChatInput();
    // Auto-start timer — configurável em Configurações → Geral (timerConfig.autoIniciar).
    // Se desligado, resetChatTimer() (chamado acima) já deixou o botão de play visível.
    if (timerConfig.autoIniciar) {
      startChatTimer();
      const btnStart = document.getElementById("btn-start-timer");
      const btnStop = document.getElementById("btn-stop-timer");
      if(btnStart) btnStart.style.display = "none";
      if(btnStop) btnStop.style.display = "block";
    }
  }

  
  // Update header UI
  document.getElementById("active-client-avatar").textContent = client.avatar || initials(client.name);
  document.getElementById("active-client-name").textContent = client.name;
  document.getElementById("active-client-tax-type").textContent = `CPF: ${client.cpf || 'Não informado'}`;
  
  const tagSelect = document.getElementById("active-client-tag-select");
  if (tagSelect) {
    let found = false;
    for (let i = 0; i < tagSelect.options.length; i++) {
      if (tagSelect.options[i].text === `Tag: ${client.taxType}`) {
        tagSelect.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && client.taxType) {
      const newOpt = new Option(`Tag: ${client.taxType}`, `Tag: ${client.taxType}`, true, true);
      tagSelect.add(newOpt);
    }
  }
  document.getElementById("prontuario-honorarios").value = client.honorarios;

  renderMessages();
  marcarConversaLida();
  renderTriagemCard(client);

  // Populate prontuário fields
  document.getElementById("prontuario-diagnostico").value = client.diagnosis;
  
  // Set Tag Cloud
  const tagPool = document.getElementById("tag-pool-evidences");
  tagPool.innerHTML = "";
  const templates = evidenceTemplates[client.diagnosis] || [];
  templates.forEach(text => {
    const dbMatch = client.evidences.find(e => e.text === text);
    const isSelected = dbMatch ? dbMatch.selected : false;
    const activeClass = isSelected ? "selected" : "";

    const tagHtml = `
      <span class="evidence-tag ${activeClass}" onclick="toggleEvidenceTag(this, '${text}')">
        ${text}
      </span>
    `;
    tagPool.insertAdjacentHTML("beforeend", tagHtml);
  });

  updateProntuarioChecklist();
  document.getElementById("prontuario-tratamento").value = client.treatment;
  document.getElementById("prontuario-notas-editor").innerHTML = client.notas || "";

  renderClientDocs(clientId);
}

// Lista os documentos enviados pelo cliente, com botão "Ler com IA".
async function renderClientDocs(clientId) {
  const box = document.getElementById("prontuario-documentos");
  if (!box) return;
  box.innerHTML = '<span style="font-size:12px;color:var(--color-text-secondary);">Carregando...</span>';
  try {
    const res = await fetch(API_BASE + '/api/documentos?clientId=' + encodeURIComponent(clientId));
    const docs = await res.json();
    if (!docs.length) {
      box.innerHTML = '<span style="font-size:12px;color:var(--color-text-secondary);">Nenhum documento enviado.</span>';
      return;
    }
    box.innerHTML = '';
    docs.forEach(d => {
      const icon = (d.mime || '').startsWith('image/') ? 'fa-file-image' : 'fa-file-pdf';
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--color-border);border-radius:8px;padding:10px 12px;';
      const aiHtml = d.ai
        ? `<div style="margin-top:8px;font-size:12px;background:var(--color-pine-ultra-light,#f0f4f2);border-radius:6px;padding:8px;">
             <div><strong>${d.ai.tipo || 'Documento'}</strong></div>
             <div style="color:var(--color-text-secondary);">${d.ai.resumo || ''}</div>
             ${d.ai.diagnostico ? `<div style="margin-top:4px;"><strong>Diagnóstico:</strong> ${d.ai.diagnostico}</div>` : ''}
             ${d.ai.dados ? `<div style="margin-top:4px;color:var(--color-text-secondary);">${d.ai.dados}</div>` : ''}
           </div>`
        : '';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <a href="${d.url}" target="_blank" style="display:flex;align-items:center;gap:8px;color:var(--color-pine);font-size:13px;text-decoration:none;">
            <i class="fa-solid ${icon}"></i> ${d.fileName}
          </a>
          ${!d.ai ? `
          <button class="btn-utility" style="font-size:11px;white-space:nowrap;" onclick="analisarDocumentoIA(${d.id}, this)">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Ler com IA
          </button>
          ` : ''}
        </div>
        <div class="doc-ai-result">${aiHtml}</div>
      `;
      box.appendChild(card);
    });
  } catch (e) {
    box.innerHTML = '<span style="font-size:12px;color:var(--color-coral);">Erro ao carregar documentos.</span>';
  }
}

async function analisarDocumentoIA(docId, btn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Lendo...';
  try {
    const res = await fetch(API_BASE + `/api/documentos/${docId}/analisar`, { method: 'POST' });
    if (res.status === 503) { showToast("IA não configurada (.env)."); return; }
    if (!res.ok) { showToast("Não consegui ler o documento."); return; }
    const data = await res.json();
    const ai = data.ai || {};
    const result = btn.closest('div').parentElement.querySelector('.doc-ai-result');
    if (result) {
      result.innerHTML = `
        <div style="margin-top:8px;font-size:12px;background:var(--color-pine-ultra-light,#f0f4f2);border-radius:6px;padding:8px;">
          <div><strong>${ai.tipo || 'Documento'}</strong></div>
          <div style="color:var(--color-text-secondary);">${ai.resumo || ''}</div>
          ${ai.diagnostico ? `<div style="margin-top:4px;"><strong>Diagnóstico:</strong> ${ai.diagnostico}</div>` : ''}
          ${ai.dados ? `<div style="margin-top:4px;color:var(--color-text-secondary);">${ai.dados}</div>` : ''}
        </div>`;
    }
    showToast("Documento analisado pela IA.");
  } catch (e) {
    showToast("Falha de conexão com a IA.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// Render messages
function renderMessages() {
  const container = document.getElementById("chat-messages");
  // Se o contador subiu para reler algo, redesenhar não pode jogá-lo lá pra baixo.
  const colado = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  container.innerHTML = "";
  let ultimoDia = null;

  const client = clientsData[activeClientId];
  client.messages.forEach(msg => {
    let bubbleClass = "received";
    if (msg.sender === "agent") bubbleClass = "sent";
    else if (msg.sender === "system") bubbleClass = "system";

    let messageBody = `<p>${safe(msg.text)}</p>`;

    if (msg.type === "doc-request") {
      messageBody = `
        <div class="message-card-doc">
          <div class="doc-info">
            <i class="fa-solid fa-file-arrow-up doc-icon"></i>
            <div>
              <span class="doc-title">Solicitação: ${safe(msg.docName)}</span>
              <p class="doc-subtitle">Aguardando o envio do comprovante pelo cliente</p>
            </div>
          </div>
          <button class="btn-doc-action" onclick="simulateUploadAction('${safe(msg.docName).replace(/'/g, "&#39;")}')">Enviar PDF</button>
        </div>
      `;
    } else if (msg.type === "doc-upload") {
      messageBody = `
        <div class="message-card-doc">
          <div class="doc-info">
            <i class="fa-solid fa-file-circle-check doc-icon" style="color: #2ECC71"></i>
            <div>
              <span class="doc-title">${safe(msg.docName)}</span>
              <p class="doc-subtitle">Tamanho: 1.2 MB · Formato: PDF</p>
            </div>
          </div>
          <button class="btn-doc-action" onclick="showToast('Abrindo visualizador do documento...')"><i class="fa-solid fa-eye"></i> Visualizar</button>
        </div>
      `;
    } else if (msg.type === "audio") {
      const uniqueId = `audio-${Math.random().toString(36).substr(2, 9)}`;
      messageBody = `
        <div class="audio-player-bubble">
          <button class="btn-play-audio" onclick="toggleAudioBubble('${uniqueId}')" id="btn-play-${uniqueId}"><i class="fa-solid fa-play"></i></button>
          <div class="audio-waveform">
            <div class="wave-bar" style="height: 40%"></div>
            <div class="wave-bar" style="height: 60%"></div>
            <div class="wave-bar" style="height: 80%"></div>
            <div class="wave-bar" style="height: 50%"></div>
            <div class="wave-bar" style="height: 70%"></div>
            <div class="wave-bar" style="height: 90%"></div>
            <div class="wave-bar" style="height: 60%"></div>
            <div class="wave-bar" style="height: 30%"></div>
          </div>
          <span class="audio-duration" id="duration-${uniqueId}">${msg.duration}</span>
        </div>
      `;
    } else if (msg.type === "prescription-card") {
      messageBody = `
        <div style="background-color: var(--color-pine-ultra-light); border: 2px solid var(--color-pine); border-radius: 10px; padding: 16px; margin-top: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.05)">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <i class="fa-solid fa-receipt" style="color: var(--color-coral); font-size: 20px"></i>
            <span style="font-family: var(--font-title); font-weight: 700; color: var(--color-pine)">RECEITA FISCAL DE REGULARIZAÇÃO</span>
          </div>
          <p style="font-size: 13px; font-weight: 600; color: var(--color-pine); margin-bottom: 6px">${safe(msg.diagnosis)}</p>
          <p style="font-size: 12px; color: var(--color-text-primary); margin-bottom: 12px">Documento oficial de prontuário e orientações de pendência gerado pelo profissional responsável.</p>
          <div style="display: flex; gap: 8px;">
            <button class="btn-doc-action" onclick="abrirRelatorio()"><i class="fa-solid fa-file-lines"></i> Abrir Relatório do Cliente</button>
          </div>
        </div>
      `;
    } else if (msg.type === "avaliacao-card") {
      // Do lado do contador é só um aviso — quem interage com as estrelas é o
      // cliente, na tela dele (ver cliente.js).
      messageBody = `
        <div style="background-color: var(--color-bg); border: 1px solid var(--color-border); border-radius: 10px; padding: 12px 14px; margin-top: 6px; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-star" style="color: #F1C40F; font-size: 16px;"></i>
          <span style="font-size: 13px; color: var(--color-text-secondary);">${safe(msg.text)}</span>
        </div>
      `;
    }

    // Separador de dia: só quando a data vira.
    const chaveDia = OCTempo.diaChave(msg);
    if (chaveDia && chaveDia !== ultimoDia) {
      ultimoDia = chaveDia;
      container.insertAdjacentHTML("beforeend",
        `<div class="chat-dia"><span>${OCTempo.diaLabel(OCTempo.data(msg))}</span></div>`);
    }

    let extra = "";
    if (msg._status === "pendente")    { bubbleClass += " pendente"; extra = ' <i class="fa-regular fa-clock"></i>'; }
    else if (msg._status === "falhou") { bubbleClass += " falhou"; }
    else if (msg.sender === "agent")   { extra = msg.readAt ? ' <i class="fa-solid fa-check-double lida"></i>' : ' <i class="fa-solid fa-check"></i>'; }

    const rodape = msg._status === "falhou"
      ? `<button type="button" class="chat-retry" onclick="reenviarMensagem('${msg.id}')"><i class="fa-solid fa-rotate-right"></i> Não enviou — clique para tentar de novo</button>`
      : `<div class="message-meta">${OCTempo.hora(msg)}${extra}</div>`;

    const itemHtml = `
      <div class="message-bubble ${bubbleClass}" data-msg-id="${msg.id || ''}">
        ${messageBody}
        ${rodape}
      </div>
    `;
    container.insertAdjacentHTML("beforeend", itemHtml);
  });

  if (colado) container.scrollTop = container.scrollHeight;
}

// Reenvia uma mensagem que falhou (o botão da bolha vermelha).
function reenviarMensagem(msgId) {
  const client = clientsData[activeClientId];
  if (!client) return;
  const msg = client.messages.find(m => m.id === msgId);
  if (msg) postMessageToBackend(msg);
}

// Marca como lidas as mensagens do cliente aberto — mas só se o chat estiver
// mesmo à vista: "lido" tem que significar lido.
function marcarConversaLida() {
  const painel = document.getElementById('section-atendimento');
  if (!activeClientId || document.hidden) return;
  if (!painel || !painel.classList.contains('active')) return;
  OCChat.marcarLidas(activeClientId);
}

// API Post message trigger
// A bolha entra na conversa ANTES da ida ao servidor. Se der erro, ela fica lá
// marcada em vermelho com o botão de reenviar — nunca some sem avisar.
async function postMessageToBackend(message) {
  // O contador pode trocar de cliente no meio da requisição; a mensagem tem que
  // pousar na conversa em que foi escrita, não na que estiver aberta ao voltar.
  const clientId = activeClientId;
  const client = clientsData[clientId];
  if (!client) return;

  if (!message.id) message.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  if (!message.createdAt) message.createdAt = new Date().toISOString();

  if (!client.messages.some(m => m.id === message.id)) client.messages.push(message);
  message._status = 'pendente';
  if (activeClientId === clientId) renderMessages();

  try {
    const res = await fetch(API_BASE + '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientId, message: message })
    });
    if (!res.ok) throw new Error('resposta ' + res.status);
    // A resposta é o cliente recarregado do banco — já sem os _status locais.
    clientsData[clientId] = await res.json();
  } catch (e) {
    console.error('Falha ao enviar mensagem:', e);
    message._status = 'falhou';
    showToast("Não consegui enviar. A mensagem ficou no chat para tentar de novo.");
  }

  if (activeClientId === clientId) renderMessages();
  renderClientList();
  updateDashboardData();
}

// Send normal message
function sendMessage() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text) return;
  
  playSound('message');

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  postMessageToBackend({
    sender: "agent",
    text: text,
    time: timeStr
  });

  input.value = "";
  input.focus();
}

// Send doc request
function sendDocumentRequest(docName) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  postMessageToBackend({
    sender: "agent",
    text: `Solicitação de Documento: ${docName}`,
    time: timeStr,
    type: "doc-request",
    docName: docName
  });

  showToast(`Solicitado o documento "${docName}".`);
}

// Simulate client upload
async function simulateUploadAction(docName) {
  const client = clientsData[activeClientId];
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  await postMessageToBackend({
    sender: "client",
    text: `Envio do arquivo: ${docName}.pdf`,
    time: timeStr,
    type: "doc-upload",
    docName: `${docName}.pdf`
  });

  // Create notification
  await postNotificationToBackend(`${client.name} enviou o documento: ${docName}.pdf`, client.id);
  await refreshAllData();
  loadClient(activeClientId);
  showToast(`Cliente enviou o arquivo "${docName}.pdf"`);
}

// Send audio message bubble
function sendAudioMessage(sender, duration) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  postMessageToBackend({
    sender: sender,
    text: `Mensagem de Áudio (${duration})`,
    time: timeStr,
    type: "audio",
    duration: duration
  });
}

// Toggle audio player
function toggleAudioBubble(audioId) {
  const btn = document.getElementById(`btn-play-${audioId}`);
  const durationEl = document.getElementById(`duration-${audioId}`);
  const initialText = durationEl.textContent;
  
  if (btn.innerHTML.includes("play")) {
    btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      durationEl.textContent = `0:${count.toString().padStart(2, '0')}`;
      if (count >= 15) {
        clearInterval(interval);
        btn.innerHTML = `<i class="fa-solid fa-rotate-left"></i>`;
        durationEl.textContent = initialText;
      }
    }, 1000);
    btn.dataset.intervalId = interval;
  } else {
    clearInterval(btn.dataset.intervalId);
    btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    durationEl.textContent = initialText;
  }
}

// Simulator client responses
async function simulateClientMessage() {
  const client = clientsData[activeClientId];
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  let replies = [
    "Certo. E quanto tempo leva para a Receita dar baixa depois da retificação?",
    "Eu consigo parcelar essa diferença de imposto? A multa é muito alta?",
    "Felipe, no caso das despesas médicas, eu tenho os recibos da clínica, mas não estão declarados com o CNPJ deles, tem problema?",
    "Eu preciso pagar o DARF no mesmo dia em que transmitir a declaração?"
  ];

  const randomReply = replies[Math.floor(Math.random() * replies.length)];
  await postMessageToBackend({
    sender: "client",
    text: randomReply,
    time: timeStr
  });

  await postNotificationToBackend(`${client.name} enviou uma nova mensagem no chat.`, client.id);
  await refreshAllData();
  loadClient(activeClientId);
}

async function simulateClientFileUpload() {
  const pendingDocs = Object.keys(clientsData[activeClientId].checklist).filter(
    doc => !clientsData[activeClientId].checklist[doc]
  );
  const docToUpload = pendingDocs.length > 0 ? pendingDocs[0] : "Comprovante Adicional";
  simulateUploadAction(docToUpload);
}

async function simulateClientAudioMessage() {
  const client = clientsData[activeClientId];
  await sendAudioMessage("client", "0:28");
  await postNotificationToBackend(`${client.name} enviou um áudio no chat.`, client.id);
  await refreshAllData();
  loadClient(activeClientId);
}

// Anotações ricas do atendimento (prontuário): negrito, lista numerada e cor
// de destaque via document.execCommand — sem dependência externa, o editor é
// só um <div contenteditable>. Salva com debounce (parar de digitar) e no blur,
// pra não bater na API a cada tecla.
let notasSalvarTimer = null;
function setupAnotacoesAtendimento() {
  const editor = document.getElementById("prontuario-notas-editor");
  const toolbar = document.getElementById("notas-toolbar");
  if (!editor || !toolbar) return;

  toolbar.querySelectorAll("[data-notas-cmd]").forEach(btn => {
    btn.addEventListener("click", () => {
      editor.focus();
      document.execCommand(btn.dataset.notasCmd, false, null);
      agendarSalvarNotas();
    });
  });
  toolbar.querySelectorAll("[data-notas-color]").forEach(btn => {
    btn.style.backgroundColor = btn.dataset.notasColor;
    btn.addEventListener("click", () => {
      editor.focus();
      // hiliteColor é o nome padrão (Firefox); a maioria dos Chromium aceita os
      // dois, mas backColor é o fallback histórico do WebKit/Blink antigo.
      if (!document.execCommand("hiliteColor", false, btn.dataset.notasColor)) {
        document.execCommand("backColor", false, btn.dataset.notasColor);
      }
      agendarSalvarNotas();
    });
  });
  editor.addEventListener("input", agendarSalvarNotas);
  editor.addEventListener("blur", salvarNotasAtendimento);
}

function agendarSalvarNotas() {
  const status = document.getElementById("notas-save-status");
  if (status) status.textContent = "Salvando…";
  clearTimeout(notasSalvarTimer);
  notasSalvarTimer = setTimeout(salvarNotasAtendimento, 800);
}

async function salvarNotasAtendimento() {
  if (!activeClientId) return;
  clearTimeout(notasSalvarTimer);
  const editor = document.getElementById("prontuario-notas-editor");
  const status = document.getElementById("notas-save-status");
  const notas = editor.innerHTML;
  if (clientsData[activeClientId]) clientsData[activeClientId].notas = notas;
  try {
    await fetch(API_BASE + '/api/prontuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: activeClientId, notas })
    });
    if (status) status.textContent = "Anotações salvas.";
  } catch (e) {
    if (status) status.textContent = "Falha ao salvar — tente novamente.";
  }
}

// Save Prontuario modifications via API
async function saveProntuarioChanges() {
  const client = clientsData[activeClientId];
  try {
    const res = await fetch(API_BASE + '/api/prontuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: activeClientId,
        diagnosis: client.diagnosis,
        honorarios: client.honorarios,
        treatment: client.treatment,
        evidences: client.evidences
      })
    });
    const updated = await res.json();
    clientsData[activeClientId] = updated;
    updateDashboardData();
  } catch (e) {
    console.error("Save prontuario error:", e);
  }
}

// Update Prontuário checklist & Tag pool
async function updateProntuarioTagsAndTreatment(diagnosis) {
  const client = clientsData[activeClientId];
  client.diagnosis = diagnosis;
  client.treatment = treatmentTemplates[diagnosis] || "";

  // Reset tag selection based on diagnosis
  client.evidences = [];
  const templates = evidenceTemplates[diagnosis] || [];
  templates.forEach(text => {
    client.evidences.push({ id: Math.random().toString(36).substr(2, 5), text: text, selected: false });
  });

  // Render UI tags
  const tagPool = document.getElementById("tag-pool-evidences");
  tagPool.innerHTML = "";
  client.evidences.forEach(e => {
    const tagHtml = `
      <span class="evidence-tag" onclick="toggleEvidenceTag(this, '${e.text}')">
        ${e.text}
      </span>
    `;
    tagPool.insertAdjacentHTML("beforeend", tagHtml);
  });

  document.getElementById("prontuario-tratamento").value = client.treatment;
  updateProntuarioChecklist();
  
  await saveProntuarioChanges();
}

// Toggle tag selection and update state
async function toggleEvidenceTag(element, text) {
  const client = clientsData[activeClientId];
  element.classList.toggle("selected");
  const isSelected = element.classList.contains("selected");

  const dbMatch = client.evidences.find(e => e.text === text);
  if (dbMatch) {
    dbMatch.selected = isSelected;
  }

  let treatmentInput = document.getElementById("prontuario-tratamento");
  let treatmentLines = treatmentInput.value.split("\n");

  if (text.includes("GCAP") && isSelected) {
    if (!treatmentLines.some(l => l.includes("GCAP"))) {
      treatmentLines.push("5. Certificar-se da importação das alíquotas de ganho imobiliário do GCAP.");
    }
  } else if (text.includes("GCAP") && !isSelected) {
    treatmentLines = treatmentLines.filter(l => !l.includes("GCAP"));
  }

  treatmentInput.value = treatmentLines.join("\n");
  client.treatment = treatmentInput.value;

  await saveProntuarioChanges();
}

// Update checklist UI
function updateProntuarioChecklist() {
  const client = clientsData[activeClientId];
  const container = document.getElementById("checklist-documents-prontuario");
  container.innerHTML = "";

  Object.entries(client.checklist).forEach(([docName, isChecked]) => {
    const checkedAttr = isChecked ? "checked" : "";
    const labelClass = isChecked ? "checked" : "";

    const itemHtml = `
      <label class="checklist-item ${labelClass}">
        <input type="checkbox" ${checkedAttr} onchange="toggleChecklistDocument('${docName}', this)">
        <span>${docName}</span>
      </label>
    `;
    container.insertAdjacentHTML("beforeend", itemHtml);
  });
}

async function toggleChecklistDocument(docName, checkbox) {
  const client = clientsData[activeClientId];
  client.checklist[docName] = checkbox.checked;
  checkbox.parentElement.classList.toggle("checked", checkbox.checked);

  try {
    await fetch(API_BASE + '/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: activeClientId, docName: docName, isChecked: checkbox.checked })
    });
  } catch (e) {
    console.error(e);
  }
}

// IA sugere Diagnóstico Fiscal + Tratamento a partir da conversa do cliente.
async function sugerirProntuarioIA() {
  const btn = document.getElementById("btn-sugerir-ia");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analisando...';

  try {
    const res = await fetch(API_BASE + '/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: activeClientId, mode: 'diagnostico' })
    });

    if (res.status === 503) {
      showToast("IA não configurada. Adicione OPENROUTER_API_KEY no .env.");
      return;
    }
    if (!res.ok) { showToast("Não consegui gerar a sugestão."); return; }

    const data = await res.json();

    // Tratamento (textarea livre)
    if (data.treatment) document.getElementById("prontuario-tratamento").value = data.treatment;

    // Diagnóstico (select): casa com uma opção existente ou cria uma temporária
    if (data.diagnosis) {
      const sel = document.getElementById("prontuario-diagnostico");
      let opt = [...sel.options].find(o => o.value.toLowerCase().includes(data.diagnosis.toLowerCase().slice(0, 15)));
      if (!opt) {
        opt = new Option(`IA: ${data.diagnosis}`, data.diagnosis);
        sel.add(opt);
      }
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change'));
    }

    showToast("Sugestão da IA aplicada. Revise antes de gerar a receita.");
  } catch (e) {
    showToast("Falha de conexão com a IA.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// Generate Memed-Style Recipe / Prontuário modal
// ===========================================================================
// RELATÓRIO DO CLIENTE — a IA preenche, o contador revisa, vira PDF branded e
// é entregue ao cliente (tabela `relatorios` + card no chat + Meus Documentos).
// ===========================================================================
let PERFIL_PAINEL = null; // {nome, crc, especialidade} do contador, para assinar

async function carregarPerfilPainel() {
  if (PERFIL_PAINEL) return PERFIL_PAINEL;
  try {
    const cfg = await (await fetch(API_BASE + '/api/config')).json();
    // A chave salva por "Meu Perfil" é 'perfil_contador' com campos {name, crc, ...}
    // (ver saveProfileData) — este trecho lia 'contador_perfil'/'nome', que não
    // existem, então o relatório nunca pegava o nome/CRC de verdade do contador.
    PERFIL_PAINEL = configObject(cfg.perfil_contador, {});
  } catch (e) { PERFIL_PAINEL = {}; }
  return PERFIL_PAINEL;
}

// ============================================================================
// RELATÓRIO DE CONCLUSÃO — wizard em 3 passos: Cliente -> Descrever o caso ->
// Enviar ou arquivar. O cliente selecionado no passo 1 é o dono de tudo daqui
// pra frente (relWizardClientId), independente de qual conversa está aberta
// na tela (activeClientId) — o contador pode gerar o relatório de um cliente
// sem precisar ter o chat dele aberto no momento.
// ============================================================================
let relWizardClientId = null;
let relWizardStep = 'cliente';
let relatorioGeradoId = null;

function relatorioObjAtual() {
  const client = clientsData[relWizardClientId] || {};
  return {
    id: 'previa',
    clientRef: relWizardClientId,
    clienteNome: client.name || '',
    clienteCpf: client.cpf || '',
    titulo: document.getElementById("rel-titulo").value.trim(),
    problema: document.getElementById("rel-problema").value.trim(),
    solucao: document.getElementById("rel-solucao").value.trim(),
    oqueFeito: document.getElementById("rel-oquefeito").value,
    comoFeito: document.getElementById("rel-comofeito").value,
    contadorNome: (PERFIL_PAINEL && PERFIL_PAINEL.name) || 'Contador',
    contadorCrc: (PERFIL_PAINEL && PERFIL_PAINEL.crc) || '',
    contadorLogo: (PERFIL_PAINEL && PERFIL_PAINEL.logoDataUrl) || '',
    contadorAssinatura: (PERFIL_PAINEL && PERFIL_PAINEL.assinaturaDataUrl) || '',
    createdAt: new Date().toISOString()
  };
}

function atualizarPreviaRelatorio() {
  const client = clientsData[relWizardClientId] || {};
  const inner = document.getElementById("rel-previa");
  const wrap = document.getElementById("rel-previa-wrap");
  inner.innerHTML = OCRelatorio.montarHTML(relatorioObjAtual(), client);
  const doc = inner.firstElementChild;
  if (!doc) return;
  // Largura 0 acontece quando o modal ainda não tem layout; um palpite razoável
  // evita a prévia sair em escala 0 (invisível) até a correção chegar.
  const escala = Math.min(1, (wrap.clientWidth || 440) / 720);
  doc.style.transformOrigin = "top left";
  doc.style.transform = "scale(" + escala + ")";
  inner.style.height = (doc.offsetHeight * escala) + "px";
}

function renderRelatorioClienteLista(query) {
  const box = document.getElementById('rel-cliente-lista');
  if (!box) return;
  const q = (query || '').trim().toLowerCase();
  const filtrados = Object.values(clientsData).filter(c =>
    !q || [c.name, c.cpf, c.email].some(v => String(v || '').toLowerCase().includes(q)));
  box.innerHTML = filtrados.length ? filtrados.map(c => `
    <button type="button" class="relatorio-cliente-item ${c.id === relWizardClientId ? 'selected' : ''}" data-rel-cliente="${safe(c.id)}">
      <div><h4>${safe(c.name)}</h4><p>${safe(c.cpf || c.email || 'Sem documento')}</p></div>
      ${c.id === relWizardClientId ? '<i class="fa-solid fa-circle-check" style="color:var(--color-pine)"></i>' : ''}
    </button>`).join('') : '<p style="padding:16px;font-size:12px;color:var(--color-text-secondary)">Nenhum cliente encontrado.</p>';
  box.querySelectorAll('[data-rel-cliente]').forEach(btn => btn.addEventListener('click', () => {
    relWizardClientId = btn.dataset.relCliente;
    renderRelatorioClienteLista(document.getElementById('rel-cliente-busca').value);
  }));
}

function irParaPassoRelatorio(passo) {
  relWizardStep = passo;
  document.querySelectorAll('[data-rel-step]').forEach(el => { el.hidden = el.dataset.relStep !== passo; });
  document.querySelectorAll('[data-rel-step-pill]').forEach(el => el.classList.toggle('active', el.dataset.relStepPill === passo));

  const mostrar = (id, sim) => { const b = document.getElementById(id); if (b) b.hidden = !sim; };
  mostrar('btn-rel-avancar-cliente', passo === 'cliente');
  mostrar('btn-rel-voltar', passo !== 'cliente');
  mostrar('btn-rel-baixar', passo === 'descrever');
  mostrar('btn-rel-gerar', passo === 'descrever');
  mostrar('btn-rel-arquivar', passo === 'enviar');
  mostrar('btn-rel-enviar', passo === 'enviar');

  if (passo === 'descrever') {
    const client = clientsData[relWizardClientId] || {};
    document.getElementById('rel-cliente-chip').innerHTML = `<i class="fa-solid fa-user"></i> ${safe(client.name || 'Cliente')} ${client.cpf ? '· ' + safe(client.cpf) : ''}`;
    atualizarPreviaRelatorio();
    // Desenha já e corrige a escala quando o modal ganha layout. Só com rAF a
    // prévia ficaria vazia se a aba estivesse em segundo plano (rAF não dispara).
    requestAnimationFrame(() => requestAnimationFrame(atualizarPreviaRelatorio));
    setTimeout(atualizarPreviaRelatorio, 150);
  }
}

// Abre o wizard, dentro da aba "Relatórios" -> "Novo Relatório" (página
// cheia, não mais modal). Se já sabemos o cliente (veio da fila de
// pendentes, do CRM ou do prontuário do atendimento aberto), pula direto pro
// passo de descrever o caso — o passo "Cliente" continua acessível pelo
// "Voltar", pra quem quiser trocar. Sem cliente nenhum, abre no passo 1 pra
// a pessoa escolher.
async function abrirRelatorio(clientId) {
  relWizardClientId = clientId || activeClientId || null;
  await carregarPerfilPainel();
  relatorioGeradoId = null;
  const client = clientsData[relWizardClientId] || {};
  ['rel-titulo', 'rel-problema', 'rel-solucao', 'rel-oquefeito', 'rel-comofeito'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('rel-titulo').value = client.diagnosis || '';
  document.getElementById('rel-envio-chat').checked = true;
  document.getElementById('rel-envio-caixa-postal').checked = false;
  document.getElementById('rel-envio-email').checked = false;
  document.getElementById('rel-envio-status').innerHTML = '&nbsp;';
  document.getElementById('rel-cliente-busca').value = '';
  renderRelatorioClienteLista('');
  closeDossier();
  const navBtn = document.querySelector('[data-target="section-dossie"]');
  if (navBtn) navBtn.click();
  ativarAbaRelatorio('novo');
  irParaPassoRelatorio(relWizardClientId ? 'descrever' : 'cliente');
}

async function preencherRelatorioComIA() {
  const btn = document.getElementById("btn-rel-ia");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A AIA está lendo a conversa...';
  try {
    const res = await fetch(API_BASE + '/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: relWizardClientId, mode: 'relatorio' })
    });
    if (res.status === 503) { showToast("IA não configurada."); return; }
    if (!res.ok) { showToast("Não consegui gerar o relatório."); return; }
    const d = await res.json();
    if (d.titulo) document.getElementById("rel-titulo").value = d.titulo;
    if (d.problema) document.getElementById("rel-problema").value = d.problema;
    if (d.solucao) document.getElementById("rel-solucao").value = d.solucao;
    if (d.oqueFeito) document.getElementById("rel-oquefeito").value = d.oqueFeito;
    if (d.comoFeito) document.getElementById("rel-comofeito").value = d.comoFeito;
    atualizarPreviaRelatorio();
    showToast("Rascunho da AIA pronto. Revise antes de enviar.");
  } catch (e) {
    showToast("Falha de conexão com a IA.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function baixarRelatorioAtual() {
  const client = clientsData[relWizardClientId] || {};
  OCRelatorio.baixarPDF(relatorioObjAtual(), client);
}

// Envia uma mensagem pro chat de um cliente específico, sem depender de qual
// conversa está aberta na tela (ao contrário de postMessageToBackend, que
// sempre usa activeClientId — errado aqui, já que o relatório pode ser de um
// cliente diferente do que está aberto no momento).
async function enviarMensagemParaCliente(clientId, message) {
  if (!message.id) message.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  if (!message.createdAt) message.createdAt = new Date().toISOString();
  const res = await fetch(API_BASE + '/api/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, message })
  });
  if (!res.ok) throw new Error('resposta ' + res.status);
  clientsData[clientId] = await res.json();
  if (activeClientId === clientId) renderMessages();
  renderClientList();
}

async function gerarRelatorio() {
  const rel = relatorioObjAtual();
  if (!rel.titulo || !rel.problema) {
    showToast("Preencha ao menos o título e o que aconteceu.");
    return;
  }
  const btn = document.getElementById("btn-rel-gerar");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
  try {
    const res = await fetch(API_BASE + '/api/relatorios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: relWizardClientId, ...rel })
    });
    if (!res.ok) throw new Error('resposta ' + res.status);
    const salvo = await res.json();
    relatorioGeradoId = salvo.id;
    showToast("Relatório gerado. Escolha como entregar ao cliente.");
    irParaPassoRelatorio('enviar');
  } catch (e) {
    showToast("Não consegui gerar o relatório.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// Comum a "enviar" e "arquivar": o relatório já fechou o caso, então o
// atendimento é encerrado nos dois casos — a diferença é só se o cliente é
// avisado ou não.
// Se o cliente já veio finalizado da fila "Aguardando Relatório" (relatório
// atrasado de um atendimento já encerrado), NÃO finaliza de novo — senão criaria
// um 2º registro no histórico e atualizaria ultimoFinalizadoEm pra depois da
// data do relatório, fazendo esse mesmo cliente voltar a aparecer como
// "pendente" (a fila compara relatório × última finalização).
async function encerrarAtendimentoPosRelatorio(clientId) {
  const jaFinalizado = ['done', 'locked'].includes((clientsData[clientId] || {}).status);
  await fetch(API_BASE + '/api/appointments/done', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientRef: clientId })
  }).catch(() => {});
  if (!jaFinalizado) await atualizarStatusCliente(clientId, 'done').catch(() => {});
  await fetch(API_BASE + '/api/triagem/arquivar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  }).catch(() => {});
}

async function arquivarRelatorioSemEnviar() {
  const btn = document.getElementById('btn-rel-arquivar');
  btn.disabled = true;
  try {
    await encerrarAtendimentoPosRelatorio(relWizardClientId);
    showToast("Relatório arquivado e atendimento encerrado.");
    await refreshAllData();
    if (activeClientId) loadClient(activeClientId);
    ativarAbaRelatorio('fila');
  } catch (e) {
    showToast("Não consegui arquivar. Tente novamente.");
  } finally {
    btn.disabled = false;
  }
}

async function confirmarEnvioRelatorio() {
  const rel = relatorioObjAtual();
  const clientId = relWizardClientId;
  const viaChat = document.getElementById('rel-envio-chat').checked;
  const viaCaixaPostal = document.getElementById('rel-envio-caixa-postal').checked;
  const viaEmail = document.getElementById('rel-envio-email').checked;
  if (!viaChat && !viaCaixaPostal && !viaEmail) { showToast("Marque ao menos um canal de envio, ou arquive sem enviar."); return; }

  const btn = document.getElementById('btn-rel-enviar');
  const original = btn.innerHTML;
  const status = document.getElementById('rel-envio-status');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
  const mensagem = `📄 Seu relatório de atendimento está pronto: "${rel.titulo}". Baixe em PDF na aba Meus Documentos.`;
  const falhas = [];

  if (viaChat) {
    try {
      const now = new Date();
      await enviarMensagemParaCliente(clientId, {
        sender: "agent", text: mensagem,
        time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        type: "relatorio-card", relatorioId: relatorioGeradoId
      });
    } catch (e) { falhas.push('chat'); }
  }
  if (viaCaixaPostal) {
    try {
      const res = await fetch(API_BASE + '/api/caixa-postal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: clientId, remetente: 'contador', assunto: rel.titulo, mensagem })
      });
      if (!res.ok) throw new Error('falha');
    } catch (e) { falhas.push('caixa postal'); }
  }
  if (viaEmail) {
    try {
      const res = await fetch(API_BASE + '/api/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'notificar_cliente', payload: { clientId, subject: rel.titulo, message: mensagem } })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'falha'); }
    } catch (e) { falhas.push('e-mail'); }
  }

  try {
    await encerrarAtendimentoPosRelatorio(clientId);
  } catch (e) { /* o atendimento fecha mesmo se algum canal falhou */ }

  btn.disabled = false;
  btn.innerHTML = original;

  if (falhas.length) {
    status.textContent = `Atendimento encerrado, mas falhou o envio por: ${falhas.join(', ')}.`;
    return;
  }
  showToast("Relatório enviado e atendimento encerrado.");
  await refreshAllData();
  if (activeClientId) loadClient(activeClientId);
  ativarAbaRelatorio('fila');
}

// Abas de topo da seção Relatórios: Aguardando Relatório / Novo Relatório /
// Relatórios Finalizados / Prontuário. Trocar de aba não reseta o wizard —
// só o botão que efetivamente inicia um relatório (abrirRelatorio) faz isso.
function ativarAbaRelatorio(alvo) {
  document.querySelectorAll('#relatorio-secao-tabs [data-relatorio-secao-tab]').forEach(b => b.classList.toggle('active', b.dataset.relatorioSecaoTab === alvo));
  ['fila', 'novo', 'finalizados', 'prontuario'].forEach(id => {
    const pane = document.getElementById('relatorio-pane-' + id);
    if (pane) pane.classList.toggle('active', id === alvo);
  });
  if (alvo === 'fila') renderRelatorioFila();
  if (alvo === 'finalizados') renderRelatoriosFinalizados();
}

function setupRelatorioSecaoTabs() {
  const barra = document.getElementById('relatorio-secao-tabs');
  if (!barra) return;
  barra.querySelectorAll('[data-relatorio-secao-tab]').forEach(btn => btn.addEventListener('click', () => {
    ativarAbaRelatorio(btn.dataset.relatorioSecaoTab);
  }));
}

function setupRadarSecaoTabs() {
  const barra = document.getElementById('radar-secao-tabs');
  if (!barra) return;
  const ids = ['caixa', 'sitfis', 'parcelamentos', 'divida-ativa', 'cnd'];
  barra.querySelectorAll('[data-radar-secao-tab]').forEach(btn => btn.addEventListener('click', () => {
    const alvo = btn.dataset.radarSecaoTab;
    barra.querySelectorAll('[data-radar-secao-tab]').forEach(item => item.classList.toggle('active', item === btn));
    ids.forEach(id => document.getElementById('radar-pane-' + id)?.classList.toggle('active', id === alvo));
  }));
}

// "Aguardando Relatório": clientes com o atendimento encerrado (done/locked)
// cujo último relatório é mais antigo que a última finalização — ou seja,
// finalizaram de novo depois do último relatório entregue (ou nunca tiveram um).
async function renderRelatorioFila() {
  const box = document.getElementById('relatorio-fila-lista');
  if (!box) return;
  box.innerHTML = '<p style="color:var(--color-text-secondary);font-size:13px;">Carregando…</p>';
  let relatorios = [];
  try {
    const res = await fetch(API_BASE + '/api/relatorios');
    if (res.ok) relatorios = await res.json();
  } catch (_) { /* silencioso */ }

  const ultimoRelatorioEm = {};
  relatorios.forEach(r => {
    const atual = ultimoRelatorioEm[r.clientRef];
    if (!atual || new Date(r.createdAt) > new Date(atual)) ultimoRelatorioEm[r.clientRef] = r.createdAt;
  });

  const pendentes = Object.values(clientsData)
    .filter(c => {
      if (!['done', 'locked'].includes(c.status) || !c.ultimoFinalizadoEm) return false;
      const ultimoRel = ultimoRelatorioEm[c.id];
      return !ultimoRel || new Date(ultimoRel) < new Date(c.ultimoFinalizadoEm);
    })
    .sort((a, b) => new Date(b.ultimoFinalizadoEm) - new Date(a.ultimoFinalizadoEm));

  if (!pendentes.length) {
    box.innerHTML = '<p style="color:var(--color-text-secondary);font-size:13px;">Nenhum atendimento aguardando relatório no momento.</p>';
    return;
  }
  box.innerHTML = pendentes.map(c => `
    <div class="relatorio-fila-card">
      <h4>${safe(c.name)}</h4>
      <p>${safe(c.cpf || c.taxType || 'Sem documento')}</p>
      <p>Finalizado em ${new Date(c.ultimoFinalizadoEm).toLocaleDateString('pt-BR')}</p>
      <button type="button" class="btn-utility primary" data-iniciar-relatorio="${safe(c.id)}"><i class="fa-solid fa-file-circle-plus"></i> Iniciar relatório</button>
    </div>`).join('');
  box.querySelectorAll('[data-iniciar-relatorio]').forEach(btn => btn.addEventListener('click', () => abrirRelatorio(btn.dataset.iniciarRelatorio)));
}

// "Relatórios Finalizados": histórico de tudo que já foi gerado, de todos os
// clientes — cada linha guarda os dados do contador/cliente daquele momento,
// então o PDF pode ser refeito sem depender do cadastro atual.
async function renderRelatoriosFinalizados() {
  const box = document.getElementById('relatorio-finalizados-lista');
  if (!box) return;
  box.innerHTML = '<p style="color:var(--color-text-secondary);font-size:13px;">Carregando…</p>';
  let relatorios = [];
  try {
    const res = await fetch(API_BASE + '/api/relatorios');
    if (res.ok) relatorios = await res.json();
  } catch (_) { /* silencioso */ }

  if (!relatorios.length) {
    box.innerHTML = '<p style="color:var(--color-text-secondary);font-size:13px;">Nenhum relatório gerado ainda.</p>';
    return;
  }
  box.innerHTML = `<table class="relatorio-finalizados-table"><thead><tr><th>Cliente</th><th>Título</th><th>Data</th><th></th></tr></thead><tbody>${relatorios.map(r => `
    <tr>
      <td>${safe(r.clienteNome || '—')}</td>
      <td>${safe(r.titulo || 'Relatório de atendimento')}</td>
      <td>${new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
      <td><button type="button" class="btn-doc-action" data-baixar-relatorio="${safe(r.id)}"><i class="fa-solid fa-download"></i> Baixar PDF</button></td>
    </tr>`).join('')}</tbody></table>`;
  box.querySelectorAll('[data-baixar-relatorio]').forEach(btn => btn.addEventListener('click', () => {
    const r = relatorios.find(x => String(x.id) === String(btn.dataset.baixarRelatorio));
    if (r) OCRelatorio.baixarPDF(r, { name: r.clienteNome, cpf: r.clienteCpf });
  }));
}

function setupRelatorioWizard() {
  document.getElementById("btn-rel-ia").addEventListener("click", preencherRelatorioComIA);
  document.getElementById("btn-rel-baixar").addEventListener("click", baixarRelatorioAtual);
  document.getElementById("btn-rel-gerar").addEventListener("click", gerarRelatorio);
  document.getElementById("btn-rel-arquivar").addEventListener("click", arquivarRelatorioSemEnviar);
  document.getElementById("btn-rel-enviar").addEventListener("click", confirmarEnvioRelatorio);
  ["rel-titulo", "rel-problema", "rel-solucao", "rel-oquefeito", "rel-comofeito"].forEach(id => {
    document.getElementById(id).addEventListener("input", atualizarPreviaRelatorio);
  });
  document.getElementById("btn-rel-avancar-cliente").addEventListener("click", () => {
    if (!relWizardClientId || !clientsData[relWizardClientId]) { showToast("Selecione um cliente para continuar."); return; }
    irParaPassoRelatorio('descrever');
  });
  document.getElementById("btn-rel-voltar").addEventListener("click", () => {
    if (relWizardStep === 'enviar') irParaPassoRelatorio('descrever');
    else irParaPassoRelatorio('cliente');
  });
  const busca = document.getElementById("rel-cliente-busca");
  busca.addEventListener("input", () => renderRelatorioClienteLista(busca.value));
}

// Modal actions helpers
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

// Notifications Central Logic
async function postNotificationToBackend(text, clientRef = null) {
  try {
    await fetch(API_BASE + '/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, clientRef: clientRef })
    });
  } catch (e) {
    console.error(e);
  }
}

function updateNotificationBadge() {
  const unreadCount = notifications.filter(n => n.unread).length;
  const badge = document.getElementById("noti-badge-count");
  
  if (unreadCount > 0) {
    badge.style.display = "flex";
    badge.textContent = unreadCount;
  } else {
    badge.style.display = "none";
  }
}

function renderNotificationsDropdown() {
  const container = document.getElementById("noti-dropdown-items");
  container.innerHTML = "";

  const recent = notifications.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:var(--color-text-secondary); text-align:center; padding:16px 0;">Nenhuma notificação nova.</p>`;
    return;
  }

  recent.forEach(noti => {
    const unreadClass = noti.unread ? "unread" : "";
    const itemHtml = `
      <div class="noti-dropdown-item ${unreadClass}" onclick="actionClickNotification(${noti.id}, '${safe(noti.clientRef).replace(/'/g, "&#39;")}')">
        <div>
          <span class="noti-dropdown-desc">${safe(noti.text)}</span>
          <span class="noti-dropdown-time">${safe(noti.time)}</span>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", itemHtml);
  });
}

function renderNotificationsLog() {
  const container = document.getElementById("notifications-log-list");
  if (!container) return;
  container.innerHTML = "";

  if (notifications.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:var(--color-text-secondary); text-align:center; padding:40px 0;">Nenhuma notificação registrada.</p>`;
    return;
  }

  notifications.forEach(noti => {
    const unreadClass = noti.unread ? "unread" : "";
    const cardHtml = `
      <div class="notification-log-card ${unreadClass}" onclick="actionClickNotification(${noti.id}, '${safe(noti.clientRef).replace(/'/g, "&#39;")}')">
        <div class="notification-log-icon">
          <i class="fa-solid ${noti.clientRef ? 'fa-message' : 'fa-info-circle'}"></i>
        </div>
        <div class="notification-log-details">
          <p>${safe(noti.text)}</p>
          <span>Recebida às ${safe(noti.time)}</span>
        </div>
        <button class="btn-delete-notification" onclick="actionDeleteNotification(event, ${noti.id})">&times;</button>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", cardHtml);
  });
}

async function actionClickNotification(notiId, clientRef) {
  const noti = notifications.find(n => n.id === notiId);
  if (noti && noti.unread) {
    await fetch(API_BASE + '/api/notifications/read-all', { method: 'POST' });
    await refreshAllData();
  }

  if (clientRef) {
    actionTimelineChat(clientRef);
  }
}

async function actionDeleteNotification(event, notiId) {
  event.stopPropagation();
  await fetch(API_BASE + `/api/notifications?id=${notiId}`, { method: 'DELETE' });
  await refreshAllData();
  showToast("Notificação excluída.");
}

// ============================================================================
// CAIXA POSTAL — mensagens assíncronas contador ↔ cliente, fora do chat ao vivo
// (que só abre no horário agendado). Aba "Mensagens" dentro de Notificações.
// ============================================================================
let caixaPostalTodas = [];
let caixaPostalClienteAtivo = null;

async function carregarCaixaPostal() {
  try {
    const res = await fetch(API_BASE + '/api/caixa-postal');
    if (!res.ok) throw new Error('falha_ao_carregar');
    caixaPostalTodas = await res.json();
  } catch (e) {
    caixaPostalTodas = [];
  }
  atualizarBadgeCaixaPostal();
  const paneMensagens = document.getElementById('cp-mensagens');
  if (paneMensagens && paneMensagens.classList.contains('active')) {
    renderCaixaPostalClientesLista(document.getElementById('caixa-postal-busca')?.value || '');
  }
}

function atualizarBadgeCaixaPostal() {
  const badge = document.getElementById('caixa-postal-badge-tab');
  if (!badge) return;
  const naoLidas = caixaPostalTodas.filter(m => m.remetente === 'cliente' && !m.lida).length;
  badge.textContent = naoLidas;
  badge.style.display = naoLidas ? 'inline-flex' : 'none';
}

function renderCaixaPostalClientesLista(filtroTexto = '') {
  const container = document.getElementById('caixa-postal-clientes-lista');
  if (!container) return;
  const termo = filtroTexto.trim().toLowerCase();

  // Resumo por cliente: última mensagem (pra ordenar e mostrar preview) + quantas não lidas vieram do cliente.
  const porCliente = new Map();
  caixaPostalTodas.forEach(m => {
    const atual = porCliente.get(m.clientRef);
    if (!atual || new Date(m.createdAt) > new Date(atual.ultima.createdAt)) {
      porCliente.set(m.clientRef, { ultima: m, naoLidas: atual ? atual.naoLidas : 0 });
    }
  });
  caixaPostalTodas.forEach(m => {
    if (m.remetente === 'cliente' && !m.lida) {
      const entry = porCliente.get(m.clientRef) || { ultima: m, naoLidas: 0 };
      entry.naoLidas++;
      porCliente.set(m.clientRef, entry);
    }
  });

  const linhas = Object.values(clientsData || {})
    .filter(c => !termo || (c.name || '').toLowerCase().includes(termo))
    .map(c => {
      const resumo = porCliente.get(c.id);
      return { cliente: c, ultima: resumo ? resumo.ultima : null, naoLidas: resumo ? resumo.naoLidas : 0 };
    })
    .sort((a, b) => (b.ultima ? new Date(b.ultima.createdAt).getTime() : 0) - (a.ultima ? new Date(a.ultima.createdAt).getTime() : 0));

  if (!linhas.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:24px 12px;">Nenhum cliente encontrado.</p>`;
    return;
  }

  container.innerHTML = linhas.map(({ cliente, ultima, naoLidas }) => {
    const ativo = cliente.id === caixaPostalClienteAtivo;
    const preview = ultima
      ? escapeHtml((ultima.mensagem || '').slice(0, 46)) + ((ultima.mensagem || '').length > 46 ? '…' : '')
      : 'Nenhuma mensagem ainda';
    return `
      <button type="button" class="caixa-postal-cliente-item" data-caixa-postal-cliente="${safe(cliente.id)}"
        style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:${ativo ? 'white' : 'transparent'};border:0;border-bottom:1px solid var(--color-border);padding:12px 14px;cursor:pointer;font:inherit;">
        <div class="chat-item-avatar" style="width:34px;height:34px;font-size:12px;flex-shrink:0;">${safe(cliente.avatar || initials(cliente.name))}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;gap:6px;">
            <strong style="font-size:13px;color:var(--color-pine);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(cliente.name || cliente.id)}</strong>
            ${naoLidas ? `<span class="chat-count-badge" style="background:var(--color-coral);flex-shrink:0;">${naoLidas}</span>` : ''}
          </div>
          <p style="font-size:12px;color:var(--color-text-secondary);margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${preview}</p>
        </div>
      </button>`;
  }).join('');

  container.querySelectorAll('[data-caixa-postal-cliente]').forEach(btn => {
    btn.addEventListener('click', () => abrirCaixaPostalCliente(btn.dataset.caixaPostalCliente));
  });
}

async function abrirCaixaPostalCliente(clienteId) {
  caixaPostalClienteAtivo = clienteId;
  renderCaixaPostalClientesLista(document.getElementById('caixa-postal-busca')?.value || '');

  const cliente = clientsData[clienteId] || {};
  const header = document.getElementById('caixa-postal-thread-header');
  if (header) header.textContent = cliente.name || clienteId;

  const form = document.getElementById('form-caixa-postal-enviar');
  if (form) form.style.display = 'flex';

  await renderCaixaPostalThread(clienteId, { marcarLida: true });
}

async function renderCaixaPostalThread(clienteId, { marcarLida } = {}) {
  const container = document.getElementById('caixa-postal-thread-mensagens');
  if (!container) return;
  container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:24px 0;">Carregando...</p>`;

  let mensagens = [];
  try {
    const res = await fetch(API_BASE + '/api/caixa-postal?clientId=' + encodeURIComponent(clienteId));
    mensagens = await res.json();
  } catch (e) { mensagens = []; }

  if (!mensagens.length) {
    container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);text-align:center;padding:40px 0;">Nenhuma mensagem ainda. Escreva a primeira abaixo.</p>`;
  } else {
    const nomeCliente = clientsData[clienteId]?.name || 'Cliente';
    container.innerHTML = mensagens.map(m => {
      const doContador = m.remetente === 'contador';
      const hora = new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `
        <div style="align-self:${doContador ? 'flex-end' : 'flex-start'};max-width:75%;">
          <div style="background:${doContador ? 'var(--color-pine)' : 'white'};color:${doContador ? '#fff' : 'var(--color-text-primary)'};border:${doContador ? 'none' : '1px solid var(--color-border)'};border-radius:12px;padding:10px 14px;">
            ${m.assunto ? `<strong style="display:block;font-size:12.5px;margin-bottom:2px;">${escapeHtml(m.assunto)}</strong>` : ''}
            <span style="font-size:13.5px;white-space:pre-wrap;">${escapeHtml(m.mensagem)}</span>
          </div>
          <span style="display:block;font-size:11px;color:var(--color-text-secondary);margin-top:4px;text-align:${doContador ? 'right' : 'left'};">${doContador ? 'Você' : escapeHtml(nomeCliente)} · ${hora}</span>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  if (marcarLida) {
    try {
      await fetch(API_BASE + '/api/caixa-postal/marcar-lida', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId, remetente: 'contador' })
      });
      await carregarCaixaPostal();
    } catch (e) { /* silencioso */ }
  }
}

async function enviarMensagemCaixaPostal() {
  if (!caixaPostalClienteAtivo) return;
  const assuntoEl = document.getElementById('caixa-postal-assunto');
  const mensagemEl = document.getElementById('caixa-postal-mensagem');
  const texto = mensagemEl.value.trim();
  if (!texto) return;

  const btn = document.querySelector('#form-caixa-postal-enviar button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(API_BASE + '/api/caixa-postal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: caixaPostalClienteAtivo, remetente: 'contador', assunto: assuntoEl.value.trim() || null, mensagem: texto })
    });
    if (!res.ok) throw new Error('falha_ao_enviar');
    assuntoEl.value = '';
    mensagemEl.value = '';
    await carregarCaixaPostal();
    await renderCaixaPostalThread(caixaPostalClienteAtivo, { marcarLida: false });
    showToast('Mensagem enviada.');
  } catch (e) {
    showToast('Não foi possível enviar a mensagem.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Appointments Scheduling Logic
function normalizeAppointmentDate(value) {
  if (!value) return '';
  if (value === 'Hoje') return OCTempo.hojeISO();
  if (value === 'Amanhã') return OCTempo.amanhaISO();
  return value;
}

function dataLocalFromISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoLocal(date) {
  const p = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
}

function nomeMesAno(date) {
  const texto = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nomeDiaCompleto(iso) {
  const d = dataLocalFromISO(iso);
  if (!d) return OCTempo.rotuloDia(iso);
  const texto = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function classeTipoAgendamento(taxType) {
  const t = (taxType || '').toLowerCase();
  if (t.includes('ganho')) return 'type-ganho';
  if (t.includes('simples') || t.includes('mei')) return 'type-simples';
  return 'type-imposto';
}

function classeStatusAgendamento(status) {
  if (status === 'done') return 'success';
  if (status === 'active') return 'status-active';
  return 'pending';
}

function clientRefFromName(name) {
  const alvo = (name || '').trim().toLowerCase();
  const found = Object.entries(clientsData || {}).find(([, c]) => (c.name || '').trim().toLowerCase() === alvo);
  if (found) return found[0];
  return alvo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderCalendarioAgendamentos() {
  const grid = document.getElementById("calendar-days-grid-container");
  const title = document.getElementById("calendar-title");
  if (!grid) return;

  const base = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth(), 1);
  if (title) title.textContent = nomeMesAno(base);

  const inicio = new Date(base);
  inicio.setDate(1 - inicio.getDay());
  const hojeIso = OCTempo.hojeISO();
  const mesAtual = base.getMonth();

  const porDia = new Map();
  (appointments || []).forEach(app => {
    const iso = normalizeAppointmentDate(app.date);
    if (!iso) return;
    if (!porDia.has(iso)) porDia.set(iso, []);
    porDia.get(iso).push(app);
  });

  grid.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    const iso = isoLocal(dia);
    const eventos = (porDia.get(iso) || []).sort((a, b) => minutosDoHorario(a.time) - minutosDoHorario(b.time));
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    if (dia.getMonth() !== mesAtual) cell.classList.add("other-month");
    if (iso === hojeIso) cell.classList.add("today");

    const visiveis = eventos.slice(0, 3).map(app => {
      const temChat = !!app.clientRef && !!clientsData[app.clientRef];
      const attrs = temChat ? ` onclick="actionTimelineChat('${app.clientRef}')"` : "";
      const statusIcon = app.status === "done" ? '<i class="fa-solid fa-check"></i> ' : '';
      return `<div class="calendar-event ${classeTipoAgendamento(app.taxType)}" title="${escapeHtml(app.clientName || '')} · ${escapeHtml(app.taxType || '')}"${attrs}>${statusIcon}${escapeHtml(app.time || '--:--')} - ${escapeHtml(app.clientName || 'Cliente')}</div>`;
    }).join("");
    const excedente = eventos.length > 3 ? `<span class="calendar-more-events">+${eventos.length - 3} atendimento${eventos.length - 3 === 1 ? '' : 's'}</span>` : "";

    cell.innerHTML = `
      <span class="calendar-day-number">${dia.getDate()}</span>
      <div class="calendar-events-container">${visiveis}${excedente}</div>
    `;
    grid.appendChild(cell);
  }
}

// Um card por atendimento — usado tanto na lista curta da barra lateral
// (Agenda do Dia) quanto na visão em Lista completa dos Agendamentos.
function appointmentCardHtml(app) {
  let actionBtnHtml = "";
  const temChat = !!app.clientRef && !!clientsData[app.clientRef];
  if (app.status !== "done" && temChat) {
    actionBtnHtml = `
      <button class="btn-icon-action primary" onclick="actionTimelineChat('${app.clientRef}')" title="Iniciar Atendimento">
        <i class="fa-solid fa-play"></i>
      </button>
    `;
  } else if (app.status !== "done") {
    actionBtnHtml = `<span style="font-size: 11px; color:var(--color-text-secondary); font-weight:600;">Sem chat</span>`;
  } else {
    actionBtnHtml = `<span style="font-size: 11px; color:#2ECC71; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Finalizado</span>`;
  }

  return `
    <div class="appointment-card">
      <div class="appointment-card-info">
        <h4>${escapeHtml(app.clientName || 'Cliente')}</h4>
        <p><i class="fa-solid fa-clock"></i> ${OCTempo.rotuloDia(normalizeAppointmentDate(app.date))} às ${escapeHtml(app.time || '--:--')} · <strong>${escapeHtml(app.taxType || 'Atendimento')}</strong></p>
        <span class="status-badge ${classeStatusAgendamento(app.status)}">${app.status === 'done' ? 'Concluído' : app.status === 'active' ? 'Em atendimento' : 'Agendado'}</span>
      </div>
      <div class="appointment-card-actions">
        ${actionBtnHtml}
        <button class="btn-icon-action" onclick="actionDeleteAppointment(${JSON.stringify(app.id)})" title="Cancelar Agendamento">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `;
}

function renderAppointments() {
  const container = document.getElementById("appointments-cards-container");
  const dayLabel = document.getElementById("appointments-day-label");
  if (!container) return;
  container.innerHTML = "";

  let filtered = appointments;
  if (currentScheduleFilter === "today") {
    filtered = appointments.filter(a => normalizeAppointmentDate(a.date) === OCTempo.hojeISO());
    if (dayLabel) dayLabel.textContent = nomeDiaCompleto(OCTempo.hojeISO());
  } else if (currentScheduleFilter === "upcoming") {
    // "Próximos" é o que ainda vai acontecer: depois de hoje. Antes bastava não
    // ser a palavra "Hoje", então agendamentos VENCIDOS entravam como próximos.
    filtered = appointments.filter(a => normalizeAppointmentDate(a.date) > OCTempo.hojeISO() && a.status !== "done");
    if (dayLabel) dayLabel.textContent = "Próximos atendimentos";
  } else if (currentScheduleFilter === "done") {
    filtered = appointments.filter(a => a.status === "done");
    if (dayLabel) dayLabel.textContent = "Atendimentos concluídos";
  } else if (dayLabel) {
    dayLabel.textContent = "Todos os atendimentos";
  }

  filtered = filtered.slice().sort((a, b) =>
    normalizeAppointmentDate(a.date).localeCompare(normalizeAppointmentDate(b.date)) ||
    minutosDoHorario(a.time) - minutosDoHorario(b.time)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:var(--color-text-secondary); text-align:center; padding:30px 0;">Nenhum atendimento nesta visão.</p>`;
    return;
  }

  container.innerHTML = filtered.map(appointmentCardHtml).join("");
}

// ===== Visão em Lista dos Agendamentos (alternativa ao grid mensal) =====
let calendarViewMode = 'mes';
let agendaListaFiltro = 'proximos';

function setCalendarViewMode(mode) {
  calendarViewMode = mode;
  document.querySelectorAll('[data-calendar-view]').forEach(b => b.classList.toggle('active', b.dataset.calendarView === mode));
  const viewMes = document.getElementById('calendar-view-mes');
  const viewLista = document.getElementById('calendar-view-lista');
  const filtros = document.getElementById('agenda-lista-filtros');
  if (viewMes) viewMes.hidden = mode !== 'mes';
  if (viewLista) viewLista.hidden = mode !== 'lista';
  if (filtros) filtros.hidden = mode !== 'lista';
  if (mode === 'lista') renderAgendaListaCompleta();
}

function renderAgendaListaCompleta() {
  const container = document.getElementById('agenda-lista-completa');
  const badge = document.getElementById('agenda-lista-contagem');
  if (!container) return;

  const hojeIso = OCTempo.hojeISO();
  let filtered = appointments;
  if (agendaListaFiltro === 'hoje') {
    filtered = appointments.filter(a => normalizeAppointmentDate(a.date) === hojeIso);
  } else if (agendaListaFiltro === 'proximos') {
    filtered = appointments.filter(a => normalizeAppointmentDate(a.date) >= hojeIso && a.status !== 'done');
  } else if (agendaListaFiltro === 'concluidos') {
    filtered = appointments.filter(a => a.status === 'done');
  }

  filtered = filtered.slice().sort((a, b) =>
    normalizeAppointmentDate(a.date).localeCompare(normalizeAppointmentDate(b.date)) ||
    minutosDoHorario(a.time) - minutosDoHorario(b.time)
  );

  if (badge) badge.textContent = `${filtered.length} atendimento${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    container.innerHTML = `<p style="font-size:13px; color:var(--color-text-secondary); text-align:center; padding:40px 0;">Nenhum atendimento nesta visão.</p>`;
    return;
  }
  container.innerHTML = filtered.map(appointmentCardHtml).join('');
}

async function bookNewAppointment() {
  const name = document.getElementById("book-client-name").value.trim();
  const type = document.getElementById("book-tax-type").value;
  const dateVal = document.getElementById("book-date").value;
  const timeVal = document.getElementById("book-time").value;

  // Grava a data COMO ELA É. Antes, se a marcação fosse para hoje, o código
  // trocava a data pela palavra "Hoje" antes de salvar — e aquele agendamento
  // ficava eternamente "de hoje", em qualquer dia que se abrisse o painel.
  // "Hoje"/"Amanhã" agora é só rótulo de tela (OCTempo.rotuloDia).
  const rotulo = OCTempo.rotuloDia(dateVal);

  const appData = {
    clientName: name,
    date: dateVal,
    time: timeVal,
    taxType: type,
    clientRef: clientRefFromName(name),
    status: "pending"
  };

  try {
    await fetch(API_BASE + '/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });

    await postNotificationToBackend(`Nova consulta agendada para ${name} (${rotulo} às ${timeVal}).`);
    
    document.getElementById("book-client-name").value = "";
    document.getElementById("book-date").value = "";
    document.getElementById("book-time").value = "";

    await refreshAllData();
    showToast(`Consulta de ${name} agendada com sucesso.`);
  } catch (e) {
    showToast("Erro ao agendar consulta no servidor.");
  }
}

function renderDisponibilidadeAgenda() {
  const container = document.getElementById("availability-slots-container");
  if (!container) return;
  const ativos = new Set(agendaDisponibilidade || DEFAULT_AGENDA_SLOTS);
  container.innerHTML = AGENDA_SLOT_OPTIONS.map(hora => `
    <label class="availability-slot">
      <span><i class="fa-regular fa-clock"></i> ${hora} - ${horaFimAtendimento(hora)}</span>
      <input type="checkbox" value="${hora}" ${ativos.has(hora) ? 'checked' : ''}>
    </label>
  `).join("");
}

function horaFimAtendimento(hora) {
  const min = minutosDoHorario(hora);
  if (min >= 24 * 60) return hora;
  const fim = min + 45;
  return `${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`;
}

async function salvarDisponibilidadeAgenda() {
  const checks = [...document.querySelectorAll('#availability-slots-container input[type="checkbox"]:checked')];
  const status = document.getElementById("availability-status");
  const selecionados = checks.map(c => c.value).sort((a, b) => minutosDoHorario(a) - minutosDoHorario(b));

  if (!selecionados.length) {
    showToast("Escolha pelo menos um horário disponível.");
    if (status) status.textContent = "Selecione ao menos um horário.";
    return;
  }

  try {
    const res = await fetch(API_BASE + '/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agenda_disponibilidade: selecionados })
    });
    if (!res.ok) throw new Error('config_save_failed');
    agendaDisponibilidade = selecionados;
    if (status) status.textContent = "Disponibilidade salva e pronta para cliente/site.";
    showToast("Disponibilidade salva.");
  } catch (e) {
    console.error("Erro ao salvar disponibilidade:", e);
    if (status) status.textContent = "Não consegui salvar agora.";
    showToast("Erro ao salvar disponibilidade.");
  }
}

// Dias bloqueados (feriados, folgas) — somem da agenda pública. Diferente dos
// horários: aqui é uma lista livre de datas, não um conjunto fixo de opções.
function renderDiasBloqueados() {
  const container = document.getElementById("dias-bloqueados-lista");
  if (!container) return;
  if (!agendaDiasBloqueados.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--color-text-secondary)">Nenhum dia bloqueado.</p>';
    return;
  }
  container.innerHTML = agendaDiasBloqueados.map(iso => {
    const [y, m, d] = iso.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return `<div style="display:flex;justify-content:space-between;align-items:center;background:var(--color-bg);border-radius:8px;padding:8px 12px;font-size:13px">
      <span>${label}</span>
      <button type="button" class="btn-doc-action" data-remover-bloqueio="${iso}" style="padding:4px 8px"><i class="fa-solid fa-trash"></i></button>
    </div>`;
  }).join('');
  container.querySelectorAll('[data-remover-bloqueio]').forEach(btn => {
    btn.addEventListener('click', () => removerDiaBloqueado(btn.dataset.removerBloqueio));
  });
}

async function salvarDiasBloqueados() {
  const res = await fetch(API_BASE + '/api/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agenda_dias_bloqueados: agendaDiasBloqueados })
  });
  if (!res.ok) throw new Error('config_save_failed');
}

async function adicionarDiaBloqueado() {
  const input = document.getElementById('bloqueio-dia-input');
  const iso = input.value;
  if (!iso) { showToast('Escolha uma data.'); return; }
  if (agendaDiasBloqueados.includes(iso)) { showToast('Esse dia já está bloqueado.'); return; }
  const anterior = agendaDiasBloqueados.slice();
  agendaDiasBloqueados = [...agendaDiasBloqueados, iso].sort();
  renderDiasBloqueados();
  input.value = '';
  try {
    await salvarDiasBloqueados();
    showToast('Dia bloqueado.');
  } catch (e) {
    console.error('Erro ao bloquear dia:', e);
    agendaDiasBloqueados = anterior;
    renderDiasBloqueados();
    showToast('Não consegui bloquear esse dia.');
  }
}

async function removerDiaBloqueado(iso) {
  const anterior = agendaDiasBloqueados.slice();
  agendaDiasBloqueados = agendaDiasBloqueados.filter(d => d !== iso);
  renderDiasBloqueados();
  try {
    await salvarDiasBloqueados();
    showToast('Dia liberado.');
  } catch (e) {
    console.error('Erro ao liberar dia:', e);
    agendaDiasBloqueados = anterior;
    renderDiasBloqueados();
    showToast('Não consegui liberar esse dia.');
  }
}

async function actionDeleteAppointment(appId) {
  try {
    await fetch(API_BASE + `/api/appointments?id=${appId}`, { method: 'DELETE' });
    await refreshAllData();
    showToast("Agendamento cancelado com sucesso.");
  } catch (e) {
    showToast("Erro ao cancelar agendamento.");
  }
}

// Hook Notification dropdown click
document.getElementById("btn-noti-trigger").addEventListener("click", () => {
  renderNotificationsDropdown();
});

// Chat Timer Logic
function setupTimer() {
  const btnStart = document.getElementById("btn-start-timer");
  const btnStop = document.getElementById("btn-stop-timer");

  if (btnStart) {
    btnStart.addEventListener("click", () => {
      startChatTimer();
      btnStart.style.display = "none";
      if(btnStop) btnStop.style.display = "block";
    });
  }

  if (btnStop) {
    btnStop.addEventListener("click", () => {
      pauseChatTimer();
      btnStop.style.display = "none";
      if(btnStart) btnStart.style.display = "block";
    });
  }
}

function startChatTimer() {
  if (chatTimerInterval) clearInterval(chatTimerInterval);
  // O ícone animado saiu do widget na reforma do cronômetro; sem esta guarda o
  // null aqui DERRUBAVA o loadClient inteiro — a conversa abria vazia, sem
  // nenhuma mensagem, e sem erro visível no console.
  const iconeTimer = document.getElementById("chat-timer-icon");
  if (iconeTimer) iconeTimer.classList.add("fa-beat-fade");
  
  chatTimerInterval = setInterval(() => {
    currentChatSeconds++;
    updateTimerUI();
    checkTimerAlerts();
  }, 1000);
}

function pauseChatTimer() {
  if (chatTimerInterval) clearInterval(chatTimerInterval);
  chatTimerInterval = null;
  const iconeTimer = document.getElementById("chat-timer-icon");
  if (iconeTimer) iconeTimer.classList.remove("fa-beat-fade");
}

function resetChatTimer() {
  pauseChatTimer();
  currentChatSeconds = 0;
  hasSentAvisoPrazo = false;
  updateTimerUI();
  
  const btnStart = document.getElementById("btn-start-timer");
  const btnStop = document.getElementById("btn-stop-timer");
  if(btnStart) btnStart.style.display = "block";
  if(btnStop) btnStop.style.display = "none";
}

function broadcastChatStatus(clientId, status) {
  if (!window.sb || !clientId) return;
  if (window.OC_CONFIG?.TESTE_CONTADOR_SEM_LOGIN?.enabled && window.OC_ROLE === 'contador') return;
  try {
    const ch = window.sb.channel('oc-lock-' + clientId);
    ch.subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'lock_change', payload: { locked: status === 'locked' || status === 'done', status } })
          .then(() => window.sb.removeChannel(ch));
      }
    });
  } catch (e) {
    console.warn('Não consegui avisar o cliente em tempo real:', e);
  }
}

async function atualizarStatusCliente(clientId, status) {
  const res = await fetch(API_BASE + '/api/status?acao=atualizar-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await tokenSessaoAtual()}` },
    body: JSON.stringify({ clientId, status })
  });
  if (!res.ok) throw new Error('status_update_failed');
  const updated = await res.json();
  if (updated && updated.id) clientsData[clientId] = { ...clientsData[clientId], ...updated };
  else if (clientsData[clientId]) clientsData[clientId].status = status;
  broadcastChatStatus(clientId, status);
  return clientsData[clientId];
}

// Gatilho explícito pro Kanban de Acompanhamento — usado quando o atendimento
// não se resolve na hora (precisa de uma declaração, parcelamento etc.). Não
// encerra o chat, só marca que esse caso entrou na esteira de pós-atendimento.
async function moverParaAcompanhamento() {
  if (!activeClientId) return;
  const clientId = activeClientId;
  kanbanEtapas = { ...kanbanEtapas, [clientId]: 'pending' };
  // Passa pela rota /api/status (não pelo /api/config direto) porque essa
  // etapa também dispara o e-mail "seu caso entrou em acompanhamento" pro
  // cliente — e mandar e-mail exige a chave do Resend, que só existe no
  // servidor.
  const res = await fetch(API_BASE + '/api/status?acao=mover-etapa-kanban', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await tokenSessaoAtual()}` },
    body: JSON.stringify({ clientId, status: 'pending' })
  });
  if (!res.ok) { showToast('Não foi possível encaminhar para o Acompanhamento.'); return; }
  await postSystemMessageToChat("Caso encaminhado para o Acompanhamento — vai aparecer no quadro de pós-atendimento.");
  
  // Cria a tarefa de acompanhamento com início e prazo definidos.
  const clienteNome = clientsData[clientId] ? clientsData[clientId].name : 'Cliente';
  const dataInicial = new Date();
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 48); // Padrão: 48 horas úteis (SLA)
  ocTarefas.unshift({
    texto: `Acompanhamento: ${clienteNome}`,
    feita: false,
    clientId: clientId,
    dataInicial: dataInicial.toISOString(),
    dataFinal: deadline.toISOString(),
    deadline: deadline.toISOString()
  });
  await salvarTarefas();

  renderKanban(); renderCRM();
  showToast('Cliente encaminhado para o Acompanhamento.', 'success');
}

// Encerrar não move mais o cliente pro Kanban de Acompanhamento — isso é só
// pra casos que precisam de ação contínua (ver moverParaAcompanhamento). Um
// atendimento resolvido na hora vai direto pro histórico em Clientes.
async function finishActiveChat() {
  if (!activeClientId) return;
  const clientId = activeClientId;
  
  pauseChatTimer();
  disableChatInput();
  
  playSound('success');
  
  try {
    // Apenas atualiza o status. endpoints antigos (appointments/done e triagem/arquivar) foram removidos na migração pro Supabase.
    await atualizarStatusCliente(clientId, 'done');

    await postSystemMessageToChat("Atendimento encerrado. O chat foi bloqueado e o caso entrou no histórico do cliente.");

    // NPS nativo: pede a nota já no encerramento, direto no chat — antes o
    // cliente só via isso se navegasse até a Home (card-avaliacao), e muita
    // gente nunca voltava lá depois que o caso fechava.
    const nowNps = new Date();
    await postMessageToBackend({
      sender: "agent",
      text: "Como foi o atendimento? Deixe sua nota de 1 a 5 estrelas.",
      time: `${nowNps.getHours().toString().padStart(2, '0')}:${nowNps.getMinutes().toString().padStart(2, '0')}`,
      type: "avaliacao-card"
    });

    // Cria a tarefa pós-atendimento com início e prazo definidos.
    const clienteNome = clientsData[clientId] ? clientsData[clientId].name : 'Cliente';
    const dataInicial = new Date();
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48); // Padrão: 48 horas úteis (SLA)
    ocTarefas.unshift({
      texto: `Concluir serviço de ${clienteNome}`,
      feita: false,
      clientId: clientId,
      dataInicial: dataInicial.toISOString(),
      dataFinal: deadline.toISOString(),
      deadline: deadline.toISOString()
    });
    await salvarTarefas();

    await refreshAllData();
    if (clientsData[clientId]) loadClient(clientId);
    showToast("Atendimento encerrado e sincronizado com a área do cliente.", "success");
  } catch (e) {
    console.error('Falha ao encerrar atendimento:', e);
    showToast("Não consegui encerrar tudo. Tente novamente.");
    enableChatInput();
  }
}

function disableChatInput(status = "done") {
  const input = document.getElementById("message-input");
  const btnSend = document.getElementById("btn-send-message");
  if (input) {
    input.disabled = true;
    input.placeholder = status === "locked" ? "Chat bloqueado para o cliente." : "Atendimento encerrado. Chat bloqueado.";
  }
  if (btnSend) btnSend.disabled = true;
}

function enableChatInput() {
  const input = document.getElementById("message-input");
  const btnSend = document.getElementById("btn-send-message");
  if (input) {
    input.disabled = false;
    input.placeholder = "Digite sua mensagem aqui...";
  }
  if (btnSend) btnSend.disabled = false;
}

function updateTimerUI() {
  const totalSegundos = Math.max(1, timerConfig.duracaoMinutos) * 60;
  const restanteSegundos = totalSegundos - currentChatSeconds; // pode ficar negativo se passar do limite — tudo bem, só some o alerta
  // Decrescente mostra quanto falta; crescente mostra o que já passou.
  const segundosExibidos = timerConfig.direcao === 'decrescente' ? Math.max(0, restanteSegundos) : currentChatSeconds;
  const min = Math.floor(segundosExibidos / 60).toString().padStart(2, "0");
  const sec = (segundosExibidos % 60).toString().padStart(2, "0");

  const elMin = document.getElementById("timer-minutes");
  const elSec = document.getElementById("timer-seconds");
  const container = document.getElementById("chat-timer-container");
  // O ícone com id saiu na reforma do widget; o objeto vazio deixa os
  // icon.style.color abaixo inofensivos sem encher o código de ifs.
  const icon = document.getElementById("chat-timer-icon") || { style: {} };

  if(elMin) elMin.textContent = min;
  if(elSec) elSec.textContent = sec;

  // Cor muda conforme o tempo RESTANTE se aproxima do aviso configurado,
  // independente do sentido de exibição (crescente ou decrescente).
  const avisoSegundos = Math.max(1, timerConfig.avisoMinutosAntes) * 60;
  if (restanteSegundos <= avisoSegundos) {
    container.style.color = "white";
    container.style.backgroundColor = "var(--color-coral)";
    container.style.borderColor = "var(--color-coral)";
    icon.style.color = "white";
  } else if (restanteSegundos <= avisoSegundos * 2) {
    container.style.color = "#E67E22"; // Orange
    container.style.backgroundColor = "rgba(230, 126, 34, 0.1)";
    container.style.borderColor = "#E67E22";
    icon.style.color = "#E67E22";
  } else {
    container.style.color = "var(--color-text)";
    container.style.backgroundColor = "var(--color-bg)";
    container.style.borderColor = "var(--color-border)";
    icon.style.color = "var(--color-pine)";
  }
}

async function checkTimerAlerts() {
  const totalSegundos = Math.max(1, timerConfig.duracaoMinutos) * 60;
  const avisoSegundos = Math.max(1, timerConfig.avisoMinutosAntes) * 60;
  const restanteSegundos = totalSegundos - currentChatSeconds;

  if (restanteSegundos === avisoSegundos && !hasSentAvisoPrazo) {
    hasSentAvisoPrazo = true;
    if (timerConfig.avisoSonoro) playSound('alert');
    const texto = `Faltam ${timerConfig.avisoMinutosAntes} minuto${timerConfig.avisoMinutosAntes !== 1 ? 's' : ''} para encerrar o limite padrão deste atendimento (${timerConfig.duracaoMinutos}min).`;
    if (timerConfig.avisarCliente) {
      // Mensagem no chat compartilhado: aparece pro cliente também.
      await postSystemMessageToChat(`Aviso Automático do Sistema: ${texto}`);
    } else {
      // Só o contador vê — nada é gravado na conversa do cliente. O som já
      // tocou acima (se ligado); soundType null aqui evita tocar 2x.
      showToast(texto, null);
    }
  }
}

async function postSystemMessageToChat(text) {
  const msgObj = {
    clientId: activeClientId,
    message: {
      sender: "system",
      text: text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  };

  try {
    await fetch(API_BASE + '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgObj)
    });
    
    // Refresh client messages visually
    const res = await fetch(API_BASE + '/api/clients');
    clientsData = await res.json();
    renderMessages();
  } catch (e) {
    console.error("Timer System Message Error:", e);
  }
}

// Utility Calculators integration
function setupCalculators() {
  const calculateGain = () => {
    const saleVal = parseFloat(document.getElementById("calc-sale-val").value) || 0;
    const buyVal = parseFloat(document.getElementById("calc-buy-val").value) || 0;
    const brokerageVal = parseFloat(document.getElementById("calc-brokerage-val").value) || 0;
    const reformVal = parseFloat(document.getElementById("calc-reform-val").value) || 0;

    const grossGain = saleVal - buyVal;
    const baseCalc = grossGain - brokerageVal - reformVal;
    const taxDue = baseCalc > 0 ? baseCalc * 0.15 : 0;

    document.getElementById("res-gross-gain").textContent = formatBRL(grossGain);
    document.getElementById("res-base-calc").textContent = formatBRL(baseCalc);
    document.getElementById("res-tax-due").textContent = formatBRL(taxDue);
  };

  document.getElementById("calc-sale-val").addEventListener("input", calculateGain);
  document.getElementById("calc-buy-val").addEventListener("input", calculateGain);
  document.getElementById("calc-brokerage-val").addEventListener("input", calculateGain);
  document.getElementById("calc-reform-val").addEventListener("input", calculateGain);

  document.getElementById("btn-calc-gain-send").addEventListener("click", () => {
    const gross = document.getElementById("res-gross-gain").textContent;
    const base = document.getElementById("res-base-calc").textContent;
    const tax = document.getElementById("res-tax-due").textContent;

    const text = `📊 **Memória de Cálculo - Ganho de Capital**\n\n- Lucro Imobiliário Bruto: ${gross}\n- Base de Cálculo (deduzido corretor/reforma): ${base}\n- **IR Devido Estimado (15%): ${tax}**\n\nEssa apuração precisa ser formalizada via sistema GCAP e importada na retificadora de imposto de renda.`;
    
    sendFormatedCalculation(text);
    closeModal("modal-calc-gain-overlay");
  });

  const calculateSimples = () => {
    const fatAcumulado = parseFloat(document.getElementById("simples-faturamento-acumulado").value) || 0;
    const fatMes = parseFloat(document.getElementById("simples-faturamento-mes").value) || 0;
    const anexo = document.getElementById("simples-anexo").value;

    let nominalRate = 0;
    let deductVal = 0;

    if (anexo === "anexo3") {
      if (fatAcumulado <= 180000) { nominalRate = 0.06; deductVal = 0; }
      else if (fatAcumulado <= 360000) { nominalRate = 0.112; deductVal = 9360; }
      else { nominalRate = 0.135; deductVal = 17640; }
    } else {
      if (fatAcumulado <= 180000) { nominalRate = 0.04; deductVal = 0; }
      else { nominalRate = 0.073; deductVal = 5940; }
    }

    let effectiveRate = nominalRate;
    if (fatAcumulado > 180000) {
      effectiveRate = ((fatAcumulado * nominalRate) - deductVal) / fatAcumulado;
    }
    
    const dasDue = fatMes * effectiveRate;

    document.getElementById("simples-res-nominal").textContent = `${(nominalRate * 100).toFixed(2)}%`;
    document.getElementById("simples-res-efetiva").textContent = `${(effectiveRate * 100).toFixed(2)}%`;
    document.getElementById("simples-res-das-due").textContent = formatBRL(dasDue);
  };

  document.getElementById("simples-faturamento-acumulado").addEventListener("input", calculateSimples);
  document.getElementById("simples-faturamento-mes").addEventListener("input", calculateSimples);
  document.getElementById("simples-anexo").addEventListener("change", calculateSimples);

  document.getElementById("btn-simples-send").addEventListener("click", () => {
    const nominal = document.getElementById("simples-res-nominal").textContent;
    const efetiva = document.getElementById("simples-res-efetiva").textContent;
    const das = document.getElementById("simples-res-das-due").textContent;
    const mes = formatBRL(parseFloat(document.getElementById("simples-faturamento-mes").value) || 0);

    const text = `🧾 **Simulação do DAS - Simples Nacional**\n\n- Faturamento no mês: ${mes}\n- Alíquota Nominal: ${nominal}\n- Alíquota Efetiva: ${efetiva}\n- **Valor da guia DAS devido: ${das}**\n\nO imposto vence no dia 20 do mês subsequente e a guia consolidada DAS será emitida pelo portal do Simples Nacional.`;

    sendFormatedCalculation(text);
    closeModal("modal-simples-overlay");
  });
}

function sendFormatedCalculation(text) {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  postMessageToBackend({
    sender: "agent",
    text: text,
    time: timeStr
  });
}

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function showToast(message, soundType = 'notification') {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-message");
  
  msgEl.textContent = message;
  toast.classList.add("active");
  
  if (soundType) {
    playSound(soundType);
  }
  
  setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

// ============================================================================
// CRM, esteira e dossiê — todos usam a mesma fonte: clientes, documentos,
// relatórios e agendamentos já persistidos no Supabase.
// ============================================================================
const KANBAN_STAGES = [
  ['pending', 'Pendente de início', '#E67E22'],
  ['active', 'Em análise', '#3498DB'],
  ['docs', 'Aguardando documentos', '#F1C40F'],
  ['ready', 'Pronto para envio', '#9B59B6'],
  ['done', 'Concluído', '#2ECC71'],
  ['recorrencia', 'Recorrência', '#0A3121']
];
function statusLabel(status) {
  return (KANBAN_STAGES.find(s => s[0] === status) || KANBAN_STAGES[0])[1];
}
function etapaDoCliente(client) {
  const stage = kanbanEtapas[client.id] || client.status;
  return KANBAN_STAGES.some(s => s[0] === stage) ? stage : 'active';
}
function initials(name) {
  return String(name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
function safe(v) { return escapeHtml(String(v == null ? '' : v)); }

let crmFiltroFinalizados = 'todos';

// Um cliente conta como "finalizado" dentro da janela escolhida se o último
// atendimento encerrado (status done/locked) caiu nela — só existe uma data
// por cliente (a mais recente), não um histórico de cada atendimento.
function clienteFinalizadoNaJanela(c, filtro) {
  if (filtro === 'todos') return true;
  if (!['done', 'locked'].includes(c.status) || !c.ultimoFinalizadoEm) return false;
  const finalizado = new Date(c.ultimoFinalizadoEm);
  if (isNaN(finalizado)) return false;
  const agora = new Date();
  if (filtro === 'hoje') return finalizado.toDateString() === agora.toDateString();
  if (filtro === 'semana') return finalizado >= startOfWeekLocal(agora) && finalizado < endOfWeekLocal(agora);
  if (filtro === 'mes') return finalizado.getFullYear() === agora.getFullYear() && finalizado.getMonth() === agora.getMonth();
  return true;
}

function renderCRM() {
  const list = document.getElementById('crm-client-list');
  const detail = document.getElementById('crm-client-detail');
  if (!list || !detail) return;
  const all = Object.values(clientsData);
  const search = document.getElementById('crm-search');
  const query = (search && search.value || '').trim().toLowerCase();
  const filtered = all
    .filter(c => [c.name, c.cpf, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(query)))
    .filter(c => clienteFinalizadoNaJanela(c, crmFiltroFinalizados))
    .sort((a, b) => crmFiltroFinalizados === 'todos' ? 0 : new Date(b.ultimoFinalizadoEm || 0) - new Date(a.ultimoFinalizadoEm || 0));
  const semResultadoMsg = crmFiltroFinalizados === 'todos' ? 'Nenhum cliente encontrado.' : 'Nenhum atendimento finalizado nesse período.';
  if (!activeCrmClientId || !filtered.some(c => c.id === activeCrmClientId)) activeCrmClientId = filtered[0] && filtered[0].id;
  list.innerHTML = filtered.length ? filtered.map(c => `
    <button type="button" class="chat-item ${c.id === activeCrmClientId ? 'active' : ''}" data-crm-client="${safe(c.id)}" style="margin:0;border-radius:0;border-bottom:1px solid var(--color-border);width:100%;text-align:left;">
      <div class="chat-item-avatar">${safe(c.avatar || initials(c.name))}</div><div style="flex:1;min-width:0"><h4>${safe(c.name)}</h4><p>${c.ultimoFinalizadoEm && crmFiltroFinalizados !== 'todos' ? 'Finalizado em ' + new Date(c.ultimoFinalizadoEm).toLocaleDateString('pt-BR') : safe(c.cpf || c.taxType || 'Sem documento')}</p></div>
      <span class="status-badge" style="font-size:10px">${safe(statusLabel(etapaDoCliente(c)))}</span>
    </button>`).join('') : `<p style="padding:24px;text-align:center;color:var(--color-text-secondary)">${semResultadoMsg}</p>`;
  list.querySelectorAll('[data-crm-client]').forEach(btn => btn.addEventListener('click', () => {
    activeCrmClientId = btn.dataset.crmClient; renderCRM();
  }));
  if (search && !search.dataset.bound) { search.dataset.bound = '1'; search.addEventListener('input', renderCRM); }
  const filtroBar = document.getElementById('crm-filtro-finalizados');
  if (filtroBar && !filtroBar.dataset.bound) {
    filtroBar.dataset.bound = '1';
    filtroBar.querySelectorAll('[data-crm-filtro]').forEach(btn => btn.addEventListener('click', () => {
      crmFiltroFinalizados = btn.dataset.crmFiltro;
      filtroBar.querySelectorAll('[data-crm-filtro]').forEach(b => b.classList.toggle('active', b === btn));
      renderCRM();
    }));
  }
  // A aba "Clientes Recorrentes" vive na mesma seção mas é pintada à parte —
  // atualiza aqui pra ficar em dia com qualquer mudança nos dados, mesmo
  // enquanto a pessoa está olhando "Visão Geral".
  renderRecorrentesTab();

  const c = clientsData[activeCrmClientId];
  if (!c) { detail.innerHTML = `<p style="padding:32px;text-align:center;color:var(--color-text-secondary)">${semResultadoMsg}</p>`; return; }
  detail.innerHTML = `
    <div style="padding:28px 32px 0;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;gap:16px;align-items:center;padding-bottom:20px;"><div class="chat-item-avatar" style="width:60px;height:60px;font-size:22px">${safe(c.avatar || initials(c.name))}</div><div><h1 style="font-size:22px;color:var(--color-pine);margin:0">${safe(c.name)}</h1><p style="margin:4px 0;color:var(--color-text-secondary);font-size:13px">${safe(c.taxType || 'Atendimento contábil')} · ${safe(statusLabel(etapaDoCliente(c)))}${['done', 'locked'].includes(c.status) && c.ultimoFinalizadoEm ? ' · Finalizado em ' + new Date(c.ultimoFinalizadoEm).toLocaleDateString('pt-BR') : ''}${c.recorrente ? ' · <i class="fa-solid fa-arrows-rotate"></i> Recorrente' : ''}</p><p style="margin:5px 0 0;font-size:12px;color:var(--color-text-secondary)">${safe(c.cpf || '')} ${c.email ? '· ' + safe(c.email) : ''}</p></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding-bottom:20px;">
        <button class="btn-utility" data-resetar-senha="${safe(c.id)}"><i class="fa-solid fa-key"></i> Resetar senha</button>
        <button class="btn-utility" data-crm-novo-relatorio="${safe(c.id)}"><i class="fa-solid fa-file-lines"></i> Novo relatório</button>
        <button class="btn-utility primary" data-open-dossier="${safe(c.id)}"><i class="fa-solid fa-folder-open"></i> Abrir dossiê</button>
      </div>
    </div>
    <div class="settings-tabs" id="crm-detail-tabs" style="padding:0 32px;margin:0;">
      ${CRM_DETAIL_TABS.map(([id, label]) => `<button class="settings-tab ${crmDetailTab === id ? 'active' : ''}" data-crm-tab="${id}">${label}</button>`).join('')}
    </div>
    <div id="crm-detail-tab-content" style="padding:24px 32px 32px;"></div>`;
  detail.querySelector('[data-open-dossier]').addEventListener('click', () => openDossier(c.id));
  detail.querySelector('[data-resetar-senha]').addEventListener('click', () => abrirResetarSenhaCliente(c.id, c.name));
  detail.querySelector('[data-crm-novo-relatorio]').addEventListener('click', () => abrirRelatorio(c.id));
  detail.querySelectorAll('[data-crm-tab]').forEach(btn => btn.addEventListener('click', () => {
    crmDetailTab = btn.dataset.crmTab;
    renderCRM();
  }));
  renderCrmTabContent(c);
}

let crmDetailTab = 'geral';
const CRM_DETAIL_TABS = [
  ['geral', 'Visão Geral'],
  ['cadastro', 'Cadastro'],
  ['pagamentos', 'Pagamentos'],
  ['atendimentos', 'Atendimentos']
];

function renderCrmTabContent(c) {
  const box = document.getElementById('crm-detail-tab-content');
  if (!box) return;
  if (crmDetailTab === 'geral') return renderCrmTabGeral(c, box);
  if (crmDetailTab === 'cadastro') return renderCrmTabCadastro(c, box);
  if (crmDetailTab === 'pagamentos') return renderCrmTabPagamentos(c, box);
  if (crmDetailTab === 'atendimentos') return renderCrmTabAtendimentos(c, box);
}

function renderCrmTabGeral(c, box) {
  const docsDone = Object.values(c.checklist || {}).filter(Boolean).length;
  box.innerHTML = `
    <div class="responsive-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
      <div><h3 style="font-size:14px;color:var(--color-pine)">Resumo do caso</h3><p style="font-size:13px;color:var(--color-text-secondary);line-height:1.5">${safe(c.diagnosis || c.triagem?.descricao || 'Sem diagnóstico registrado ainda.')}</p><p style="font-size:12px;color:var(--color-text-secondary)">${c.messages.length} mensagens · ${docsDone} documento(s) confirmado(s)</p></div>
      <div><h3 style="font-size:14px;color:var(--color-pine)">Próximo passo</h3><p style="font-size:13px;color:var(--color-text-secondary)">${safe(c.treatment || 'Abra o dossiê para registrar diagnóstico, arquivos e andamento.')}</p></div>
    </div>`;
}

// Cadastro completo: endereço e contatos, agregados pelo CPF/CNPJ (id do
// cliente). Os campos de endereço já existiam no banco (nota fiscal), só não
// apareciam em lugar nenhum da UI.
function renderCrmTabCadastro(c, box) {
  box.innerHTML = `
    <div class="responsive-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:640px;">
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">Telefone</label><input class="form-input" id="cad-phone" value="${safe(c.phone || '')}"></div>
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">E-mail</label><input class="form-input" id="cad-email" value="${safe(c.email || '')}"></div>
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">CEP</label><input class="form-input" id="cad-cep" value="${safe(c.cep || '')}"></div>
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">Cidade</label><input class="form-input" id="cad-cidade" value="${safe(c.cidade || '')}"></div>
      <div class="form-group" style="margin-bottom:0;grid-column:1/-1;"><label class="form-label">Endereço</label><input class="form-input" id="cad-endereco" value="${safe(c.endereco || '')}"></div>
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">Número</label><input class="form-input" id="cad-numero" value="${safe(c.numero || '')}"></div>
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">Bairro</label><input class="form-input" id="cad-bairro" value="${safe(c.bairro || '')}"></div>
      <div class="form-group" style="margin-bottom:0;"><label class="form-label">Estado</label><input class="form-input" id="cad-estado" value="${safe(c.estado || '')}" maxlength="2" style="text-transform:uppercase;"></div>
    </div>
    <button class="btn-utility primary" id="btn-salvar-cadastro" style="margin-top:16px;"><i class="fa-solid fa-save"></i> Salvar cadastro</button>
    <p class="relatorio-label-hint" id="cadastro-save-status" style="margin-top:8px;">&nbsp;</p>`;
  document.getElementById('btn-salvar-cadastro').addEventListener('click', async () => {
    const btn = document.getElementById('btn-salvar-cadastro');
    const status = document.getElementById('cadastro-save-status');
    const patch = {
      clientId: c.id,
      phone: document.getElementById('cad-phone').value.trim(),
      email: document.getElementById('cad-email').value.trim(),
      cep: document.getElementById('cad-cep').value.trim(),
      cidade: document.getElementById('cad-cidade').value.trim(),
      endereco: document.getElementById('cad-endereco').value.trim(),
      numero: document.getElementById('cad-numero').value.trim(),
      bairro: document.getElementById('cad-bairro').value.trim(),
      estado: document.getElementById('cad-estado').value.trim().toUpperCase()
    };
    btn.disabled = true;
    try {
      const res = await fetch(API_BASE + '/api/prontuario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error('falha');
      clientsData[c.id] = await res.json();
      status.textContent = 'Cadastro salvo.';
      renderCRM();
    } catch (e) {
      status.textContent = 'Não consegui salvar — tente novamente.';
    } finally {
      btn.disabled = false;
    }
  });
}

// Histórico de pagamentos do cliente (cobranças geradas, pagas ou não).
async function renderCrmTabPagamentos(c, box) {
  box.innerHTML = '<p style="font-size:12px;color:var(--color-text-secondary)">Carregando…</p>';
  let cobrancas = [];
  try {
    const res = await fetch(API_BASE + '/api/cobrancas?clientId=' + encodeURIComponent(c.id));
    if (res.ok) cobrancas = await res.json();
  } catch (_) { /* silencioso */ }
  if (document.getElementById('crm-detail-tab-content') !== box) return; // painel trocou enquanto carregava
  if (!cobrancas.length) { box.innerHTML = '<p style="font-size:12px;color:var(--color-text-secondary)">Nenhuma cobrança gerada para este cliente ainda.</p>'; return; }
  box.innerHTML = `<table class="financeiro-table"><thead><tr><th>Data</th><th>Valor</th><th>Status</th><th>Pago em</th></tr></thead><tbody>${cobrancas.map(cob => `
    <tr>
      <td>${new Date(cob.createdAt).toLocaleDateString('pt-BR')}</td>
      <td>${formatBRL((cob.valueCents || 0) / 100)}</td>
      <td>${safe(cob.status)}</td>
      <td>${cob.paidAt ? new Date(cob.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

// Timeline de atendimentos finalizados: início, fim, duração e as anotações
// que ficaram arquivadas quando aquele caso foi encerrado.
async function renderCrmTabAtendimentos(c, box) {
  box.innerHTML = '<p style="font-size:12px;color:var(--color-text-secondary)">Carregando…</p>';
  let historico = [];
  try {
    const res = await fetch(API_BASE + '/api/atendimentos-historico?clientId=' + encodeURIComponent(c.id));
    if (res.ok) historico = await res.json();
  } catch (_) { /* silencioso */ }
  if (document.getElementById('crm-detail-tab-content') !== box) return; // painel trocou enquanto carregava
  if (!historico.length) { box.innerHTML = '<p style="font-size:12px;color:var(--color-text-secondary)">Nenhum atendimento finalizado ainda para este cliente.</p>'; return; }
  box.innerHTML = historico.map(h => {
    const inicio = h.iniciadoEm ? new Date(h.iniciadoEm) : null;
    const fim = h.finalizadoEm ? new Date(h.finalizadoEm) : null;
    const dataLabel = fim ? fim.toLocaleDateString('pt-BR') : '—';
    const horaIni = inicio ? inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const horaFim = fim ? fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `
    <div class="financeiro-card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div>
          <h3 style="font-size:14px;color:var(--color-pine);margin-bottom:4px;">${safe(h.taxType || 'Atendimento')}</h3>
          <p style="font-size:12px;color:var(--color-text-secondary);">${dataLabel} · iniciado ${horaIni} · encerrado ${horaFim} · duração ${formatDuracao(h.duracaoSegundos)}${h.honorarios ? ' · ' + formatBRL(h.honorarios) : ''}</p>
        </div>
      </div>
      ${h.notas ? `<div class="notas-editor" style="margin-top:12px;min-height:0;background:var(--color-bg);" contenteditable="false">${h.notas}</div>` : ''}
    </div>`;
  }).join('');
}

async function recarregarClientes() {
  const res = await fetch(API_BASE + '/api/clients');
  clientsData = await res.json();
}

// Card "Acompanhamento recorrente" no CRM — cliente com parcelamento/obrigação
// mensal que precisa de guia gerada todo mês. Sem certificado do Integra
// Contador ainda, a geração é manual (ver Dashboard → Guias Mensais); aqui só
// liga/desliga a recorrência e a cobrança automática no Asaas.
function htmlRecorrencia(c) {
  if (c.recorrente) {
    return `
      <div class="financeiro-card" style="border-left:3px solid var(--color-pine);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div>
            <h3 style="font-size:14px;color:var(--color-pine);margin-bottom:4px;"><i class="fa-solid fa-arrows-rotate"></i> Acompanhamento recorrente ativo</h3>
            <p style="font-size:12px;color:var(--color-text-secondary);">${safe(c.recorrenteTipo || 'Mensal')} · vencimento todo dia ${safe(c.recorrenteDiaVenc || '—')} · ${formatBRL(c.honorarios || 0)}/mês</p>
          </div>
          <button class="btn-utility" data-rec-desativar style="color:var(--color-coral);font-size:12px;"><i class="fa-solid fa-ban"></i> Desativar</button>
        </div>
      </div>`;
  }
  return `
    <div class="financeiro-card">
      <h3 style="font-size:14px;color:var(--color-pine);margin-bottom:4px;"><i class="fa-solid fa-arrows-rotate"></i> Acompanhamento recorrente</h3>
      <p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px;">Para clientes com parcelamento ou obrigação mensal (ex.: guia todo mês). Ativa cobrança automática recorrente no Asaas.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div>
          <label class="cfg-label" style="font-size:10px;">Tipo</label>
          <select class="cfg-input" id="rec-tipo" style="font-size:12px;">
            <option value="Parcelamento Receita">Parcelamento Receita</option>
            <option value="MEI Mensal">MEI Mensal</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div>
          <label class="cfg-label" style="font-size:10px;">Dia vencimento</label>
          <input type="number" class="cfg-input" id="rec-dia" min="1" max="28" value="10" style="width:70px;font-size:12px;">
        </div>
        <div>
          <label class="cfg-label" style="font-size:10px;">Valor mensal (R$)</label>
          <input type="number" class="cfg-input" id="rec-valor" min="0" step="0.01" value="${(c.honorarios || 0)}" style="width:100px;font-size:12px;">
        </div>
        <button class="btn-utility primary" data-rec-ativar style="font-size:12px;"><i class="fa-solid fa-play"></i> Ativar</button>
      </div>
    </div>`;
}

function ligarRecorrencia(c) {
  const btnAtivar = document.querySelector('[data-rec-ativar]');
  if (btnAtivar) btnAtivar.addEventListener('click', async () => {
    const tipo = document.getElementById('rec-tipo').value;
    const diaVenc = document.getElementById('rec-dia').value;
    const valor = document.getElementById('rec-valor').value;
    btnAtivar.disabled = true; btnAtivar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ativando...';
    try {
      const res = await fetch(API_BASE + '/api/recorrencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: c.id, ativar: true, tipo, diaVenc, valor })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'demo_action_not_available') showToast('Recorrência não funciona no modo demo — precisa de login real.');
        else if (data.error === 'asaas_not_configured') showToast('Configure a chave do Asaas antes de ativar recorrência.');
        else if (data.error === 'valor_invalido') showToast('Informe um valor mensal maior que zero.');
        else showToast('Não foi possível ativar a recorrência.');
        btnAtivar.disabled = false; btnAtivar.innerHTML = '<i class="fa-solid fa-play"></i> Ativar';
        return;
      }
      showToast('Acompanhamento recorrente ativado.');
      await recarregarClientes();
      renderCRM();
    } catch (_) {
      showToast('Falha de conexão ao ativar recorrência.');
      btnAtivar.disabled = false; btnAtivar.innerHTML = '<i class="fa-solid fa-play"></i> Ativar';
    }
  });

  const btnDesativar = document.querySelector('[data-rec-desativar]');
  if (btnDesativar) btnDesativar.addEventListener('click', async () => {
    if (!confirm('Desativar o acompanhamento recorrente e cancelar a cobrança automática?')) return;
    btnDesativar.disabled = true;
    try {
      const res = await fetch(API_BASE + '/api/recorrencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: c.id, ativar: false })
      });
      if (!res.ok) { showToast('Não foi possível desativar.'); btnDesativar.disabled = false; return; }
      showToast('Acompanhamento recorrente desativado.');
      await recarregarClientes();
      renderCRM();
    } catch (_) {
      showToast('Falha de conexão ao desativar.');
      btnDesativar.disabled = false;
    }
  });
}

// Abas de topo da seção Clientes: "Visão Geral" (todos os clientes) e
// "Clientes Recorrentes" (só quem tem acompanhamento mensal).
function setupClientesSecaoTabs() {
  const barra = document.getElementById('clientes-secao-tabs');
  if (!barra) return;
  barra.querySelectorAll('[data-clientes-secao-tab]').forEach(btn => btn.addEventListener('click', () => {
    barra.querySelectorAll('[data-clientes-secao-tab]').forEach(b => b.classList.toggle('active', b === btn));
    const alvo = btn.dataset.clientesSecaoTab;
    document.getElementById('clientes-pane-geral').classList.toggle('active', alvo === 'geral');
    document.getElementById('clientes-pane-recorrentes').classList.toggle('active', alvo === 'recorrentes');
    if (alvo === 'recorrentes') renderRecorrentesTab();
  }));
}

let activeRecorrenteTabClientId = null;

// Aba "Clientes Recorrentes" (dentro de Clientes): só quem tem acompanhamento
// mensal ativo (ou candidatos a ativar), com o detalhamento do serviço (tipo,
// valor, dia de vencimento) e os prazos (guias mensais a gerar) daquele cliente.
function renderRecorrentesTab() {
  const list = document.getElementById('recorrentes-tab-list');
  const detail = document.getElementById('recorrentes-tab-detail');
  if (!list || !detail) return;

  const all = Object.values(clientsData);
  const ativos = all.filter(c => c.recorrente);
  const candidatos = all.filter(c => !c.recorrente);

  if (!activeRecorrenteTabClientId || !clientsData[activeRecorrenteTabClientId]) {
    activeRecorrenteTabClientId = (ativos[0] || candidatos[0] || {}).id || null;
  }

  const itemHtml = (c) => `
    <button type="button" class="chat-item ${c.id === activeRecorrenteTabClientId ? 'active' : ''}" data-recorrente-tab-client="${safe(c.id)}" style="margin:0;border-radius:0;border-bottom:1px solid var(--color-border);width:100%;text-align:left;">
      <div class="chat-item-avatar">${safe(c.avatar || initials(c.name))}</div><div style="flex:1;min-width:0"><h4>${safe(c.name)}</h4><p>${c.recorrente ? safe(c.recorrenteTipo || 'Mensal') + ' · vence dia ' + safe(c.recorrenteDiaVenc || '—') : safe(c.cpf || 'Sem recorrência')}</p></div>
      ${c.recorrente ? '<span class="status-badge" style="font-size:10px;background:var(--color-pine);color:#fff">Ativo</span>' : ''}
    </button>`;

  list.innerHTML = `
    ${ativos.length ? `<p style="padding:12px 16px 4px;font-size:11px;color:var(--color-text-secondary);text-transform:uppercase">Ativos (${ativos.length})</p>${ativos.map(itemHtml).join('')}` : '<p style="padding:16px;font-size:12px;color:var(--color-text-secondary)">Nenhum cliente com acompanhamento recorrente ativo ainda.</p>'}
    <p style="padding:12px 16px 4px;font-size:11px;color:var(--color-text-secondary);text-transform:uppercase">Demais clientes</p>
    ${candidatos.length ? candidatos.map(itemHtml).join('') : '<p style="padding:16px;font-size:12px;color:var(--color-text-secondary)">Nenhum outro cliente.</p>'}`;

  list.querySelectorAll('[data-recorrente-tab-client]').forEach(btn => btn.addEventListener('click', () => {
    activeRecorrenteTabClientId = btn.dataset.recorrenteTabClient;
    renderRecorrentesTab();
  }));

  const c = clientsData[activeRecorrenteTabClientId];
  if (!c) {
    detail.innerHTML = '<p style="padding:32px;color:var(--color-text-secondary)">Nenhum cliente cadastrado ainda.</p>';
    return;
  }

  detail.innerHTML = `
    <div style="padding:28px 32px;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;gap:16px;align-items:center"><div class="chat-item-avatar" style="width:60px;height:60px;font-size:22px">${safe(c.avatar || initials(c.name))}</div><div><h1 style="font-size:22px;color:var(--color-pine);margin:0">${safe(c.name)}</h1><p style="margin:4px 0;color:var(--color-text-secondary);font-size:13px">${safe(c.cpf || c.email || '')}</p></div></div>
      <button class="btn-utility" data-open-dossier-rec="${safe(c.id)}"><i class="fa-solid fa-folder-open"></i> Abrir dossiê</button>
    </div>
    <div style="padding:28px 32px 0;">${htmlRecorrencia(c)}</div>
    <div style="padding:24px 32px;">
      <h3 style="font-size:14px;color:var(--color-pine);border-bottom:2px solid var(--color-border);padding-bottom:8px;margin-bottom:12px;"><i class="fa-solid fa-file-invoice"></i> Guias mensais (prazos)</h3>
      <div id="recorrentes-guias-cliente"><p style="font-size:12px;color:var(--color-text-secondary)">Carregando…</p></div>
    </div>
    <div style="padding:0 32px 32px;">
      <h3 style="font-size:14px;color:var(--color-pine);border-bottom:2px solid var(--color-border);padding-bottom:8px;margin-bottom:12px;"><i class="fa-solid fa-paperclip"></i> Documentos</h3>
      <div id="recorrentes-docs-cliente"><p style="font-size:12px;color:var(--color-text-secondary)">Carregando…</p></div>
    </div>`;

  detail.querySelector('[data-open-dossier-rec]').addEventListener('click', () => openDossier(c.id));
  ligarRecorrencia(c);
  carregarGuiasDoClienteRecorrente(c.id);
  carregarDocumentosDoClienteRecorrente(c.id);
}

async function carregarGuiasDoClienteRecorrente(clientId) {
  const box = document.getElementById('recorrentes-guias-cliente');
  if (!box) return;
  let guias = [];
  try {
    const res = await fetch(API_BASE + '/api/guias-mensais');
    if (res.ok) guias = await res.json();
  } catch (_) { /* silencioso */ }
  const doCliente = guias.filter(g => g.clientRef === clientId);
  if (!doCliente.length) {
    box.innerHTML = '<p style="font-size:12px;color:var(--color-text-secondary)">Nenhuma guia registrada ainda para este cliente.</p>';
    return;
  }
  box.innerHTML = `<table class="financeiro-table"><thead><tr><th>Competência</th><th>Tipo</th><th>Status</th><th></th></tr></thead><tbody>${doCliente.map(g => `
    <tr>
      <td>${safe(g.competencia)}</td>
      <td>${safe(g.tipo || 'Acompanhamento mensal')}</td>
      <td>${g.status === 'gerada' ? '<span class="status-badge" style="background:var(--color-pine);color:#fff">Gerada</span>' : '<span class="sla-badge sla-yellow" style="margin:0;">Pendente</span>'}</td>
      <td>${g.status !== 'gerada' ? `<button class="btn-doc-action" type="button" data-guia-concluir-rec="${g.id}"><i class="fa-solid fa-check"></i> Marcar gerada</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;
  box.querySelectorAll('[data-guia-concluir-rec]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(API_BASE + '/api/guias-mensais/' + btn.dataset.guiaConcluirRec + '/concluir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        if (!res.ok) { showToast('Não foi possível marcar como gerada.'); btn.disabled = false; return; }
        showToast('Guia marcada como gerada.');
        carregarGuiasDoClienteRecorrente(clientId);
        renderGuiasMensais();
      } catch (_) {
        showToast('Falha de conexão.');
        btn.disabled = false;
      }
    });
  });
}

async function carregarDocumentosDoClienteRecorrente(clientId) {
  const box = document.getElementById('recorrentes-docs-cliente');
  if (!box) return;
  let docs = [];
  try {
    const res = await fetch(API_BASE + '/api/documentos?clientId=' + encodeURIComponent(clientId));
    if (res.ok) docs = await res.json();
  } catch (_) { /* silencioso */ }
  box.innerHTML = docs.length ? `<table class="financeiro-table"><thead><tr><th>Arquivo</th><th>Enviado por</th><th>Data</th><th></th></tr></thead><tbody>${docs.map(d => `<tr><td>${safe(d.fileName)}</td><td>${d.uploadedBy === 'agent' ? 'Contador' : 'Cliente'}</td><td>${new Date(d.createdAt).toLocaleDateString('pt-BR')}</td><td>${d.url ? `<a class="btn-doc-action" href="${safe(d.url)}" target="_blank" rel="noopener">Abrir</a>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p style="font-size:12px;color:var(--color-text-secondary)">Nenhum arquivo enviado.</p>';
}

// ============================================================================
// Insights — histórico real de atendimentos finalizados (um registro por
// finalização, diferente de client.ultimoFinalizadoEm que só guarda a data
// mais recente). Sexo/cidade vêm do cadastro atual do cliente (preenchido no
// checkout), não do histórico — por isso são calculados à parte, de clientsData.
// ============================================================================
const INSIGHTS_CORES = ['#0A3121', '#3498DB', '#E67E22', '#9B59B6', '#2ECC71', '#F1C40F', '#FF6A45', '#16697A'];
function corInsights(i) { return INSIGHTS_CORES[i % INSIGHTS_CORES.length]; }

function formatDuracao(segundos) {
  if (segundos == null) return '—';
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function svgDonut(segmentos) {
  const total = segmentos.reduce((s, x) => s + x.value, 0);
  if (!total) return '<p style="font-size:12px;color:var(--color-text-secondary)">Sem dados no período.</p>';
  const r = 55, cx = 65, cy = 65, strokeW = 24, circ = 2 * Math.PI * r;
  let offset = 0;
  const arcos = segmentos.map((s, i) => {
    const dash = (s.value / total) * circ;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${corInsights(i)}" stroke-width="${strokeW}" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    offset += dash;
    return el;
  }).join('');
  const legenda = segmentos.map((s, i) => `
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:5px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${corInsights(i)};flex:0 0 auto;"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safe(s.label)}</span>
      <span style="font-weight:600;color:var(--color-pine);flex:0 0 auto;">${s.value} (${Math.round(s.value / total * 100)}%)</span>
    </div>`).join('');
  return `<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
    <svg width="130" height="130" viewBox="0 0 130 130" style="flex:0 0 auto;">${arcos}<text x="65" y="61" text-anchor="middle" font-size="19" font-weight="700" fill="var(--color-pine)">${total}</text><text x="65" y="77" text-anchor="middle" font-size="9" fill="var(--color-text-secondary)">total</text></svg>
    <div style="flex:1;min-width:140px;">${legenda}</div>
  </div>`;
}

function barListHTML(itens, formatValue) {
  if (!itens.length) return '<p style="font-size:12px;color:var(--color-text-secondary)">Sem dados no período.</p>';
  const max = Math.max(...itens.map(i => i.value));
  return itens.map((it, i) => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <span style="flex:0 0 170px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(it.label)}</span>
      <div style="flex:1;background:var(--color-bg);border-radius:6px;height:16px;overflow:hidden;">
        <div style="width:${max ? (it.value / max * 100).toFixed(0) : 0}%;background:${corInsights(i)};height:100%;border-radius:6px;"></div>
      </div>
      <span style="flex:0 0 76px;text-align:right;font-size:12px;font-weight:600;color:var(--color-pine);">${formatValue ? formatValue(it.value) : it.value}</span>
    </div>`).join('');
}

let insightsPeriodo = 'ano';
let insightsCustomDe = null;
let insightsCustomAte = null;

function rangeDoPeriodoInsights(periodo) {
  const agora = new Date();
  if (periodo === 'hoje') {
    const ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    return [ini, new Date(ini.getTime() + 86400000)];
  }
  if (periodo === 'semana') return [startOfWeekLocal(agora), endOfWeekLocal(agora)];
  if (periodo === 'mes') return [new Date(agora.getFullYear(), agora.getMonth(), 1), new Date(agora.getFullYear(), agora.getMonth() + 1, 1)];
  if (periodo === 'ano') return [new Date(agora.getFullYear(), 0, 1), new Date(agora.getFullYear() + 1, 0, 1)];
  if (periodo === 'custom') return [insightsCustomDe, insightsCustomAte];
  return [null, null]; // tudo
}

async function renderInsights() {
  const totalEl = document.getElementById('insights-total-periodo');
  if (!totalEl) return;

  const filtroBar = document.getElementById('insights-filtro-periodo');
  if (filtroBar && !filtroBar.dataset.bound) {
    filtroBar.dataset.bound = '1';
    filtroBar.querySelectorAll('[data-insights-periodo]').forEach(btn => btn.addEventListener('click', () => {
      insightsPeriodo = btn.dataset.insightsPeriodo;
      filtroBar.querySelectorAll('[data-insights-periodo]').forEach(b => b.classList.toggle('active', b === btn));
      renderInsights();
    }));
    document.getElementById('insights-aplicar-periodo').addEventListener('click', () => {
      const de = document.getElementById('insights-data-de').value;
      const ate = document.getElementById('insights-data-ate').value;
      if (!de && !ate) return;
      insightsPeriodo = 'custom';
      insightsCustomDe = de ? new Date(de + 'T00:00:00') : null;
      insightsCustomAte = ate ? new Date(new Date(ate + 'T00:00:00').getTime() + 86400000) : null;
      filtroBar.querySelectorAll('[data-insights-periodo]').forEach(b => b.classList.remove('active'));
      renderInsights();
    });
  }

  const [de, ate] = rangeDoPeriodoInsights(insightsPeriodo);
  let historico = [];
  try {
    const res = await fetch(API_BASE + '/api/atendimentos-historico');
    if (res.ok) historico = await res.json();
  } catch (_) { /* silencioso */ }

  const noPeriodo = historico.filter(r => {
    if (!r.finalizadoEm) return false;
    const d = new Date(r.finalizadoEm);
    if (de && d < de) return false;
    if (ate && d >= ate) return false;
    return true;
  });

  totalEl.textContent = noPeriodo.length;

  const duracoes = noPeriodo.map(r => r.duracaoSegundos).filter(v => v != null);
  const duracaoMedia = duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null;
  document.getElementById('insights-duracao-media').textContent = formatDuracao(duracaoMedia);

  const honorariosArr = noPeriodo.map(r => r.honorarios).filter(v => v != null);
  const ticketMedio = honorariosArr.length ? honorariosArr.reduce((a, b) => a + b, 0) / honorariosArr.length : null;
  document.getElementById('insights-ticket-medio').textContent = ticketMedio != null ? formatBRL(ticketMedio) : '—';

  const totalHoras = duracoes.reduce((a, b) => a + b, 0) / 3600;
  const totalHonor = honorariosArr.reduce((a, b) => a + b, 0);
  document.getElementById('insights-rentabilidade').textContent = totalHoras > 0 ? formatBRL(totalHonor / totalHoras) : '—';

  const porServico = {};
  noPeriodo.forEach(r => { const k = r.taxType || 'Sem categoria'; porServico[k] = (porServico[k] || 0) + 1; });
  const segmentosServico = Object.entries(porServico).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  document.getElementById('insights-donut-servico').innerHTML = svgDonut(segmentosServico);

  const duracaoPorServico = {};
  noPeriodo.forEach(r => {
    if (r.duracaoSegundos == null) return;
    const k = r.taxType || 'Sem categoria';
    (duracaoPorServico[k] = duracaoPorServico[k] || []).push(r.duracaoSegundos);
  });
  const itensDuracao = Object.entries(duracaoPorServico)
    .map(([label, arr]) => ({ label, value: arr.reduce((a, b) => a + b, 0) / arr.length }))
    .sort((a, b) => b.value - a.value);
  document.getElementById('insights-barras-duracao').innerHTML = barListHTML(itensDuracao, formatDuracao);

  const mesmoDia = duracoes.filter(s => s <= 86400);
  const estendido = duracoes.filter(s => s > 86400);
  const mediaMesmoDia = mesmoDia.length ? mesmoDia.reduce((a, b) => a + b, 0) / mesmoDia.length : null;
  const mediaEstendido = estendido.length ? estendido.reduce((a, b) => a + b, 0) / estendido.length : null;
  document.getElementById('insights-mesmo-dia-vs-estendido').innerHTML = `
    <div><p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px">Resolvido no mesmo dia (${mesmoDia.length})</p><h2 style="font-size:22px;color:var(--color-pine);margin:0;">${formatDuracao(mediaMesmoDia)}</h2></div>
    <div><p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px">Se estende por mais de um dia (${estendido.length})</p><h2 style="font-size:22px;color:var(--color-coral);margin:0;">${formatDuracao(mediaEstendido)}</h2></div>`;

  const dadosRentabServico = {};
  noPeriodo.forEach(r => {
    if (r.honorarios == null || !r.duracaoSegundos) return;
    const k = r.taxType || 'Sem categoria';
    dadosRentabServico[k] = dadosRentabServico[k] || { honor: 0, seg: 0 };
    dadosRentabServico[k].honor += r.honorarios;
    dadosRentabServico[k].seg += r.duracaoSegundos;
  });
  const rankingRentab = Object.entries(dadosRentabServico)
    .map(([label, d]) => ({ label, value: d.honor / (d.seg / 3600) }))
    .sort((a, b) => b.value - a.value);
  document.getElementById('insights-ranking-rentabilidade').innerHTML = barListHTML(rankingRentab, v => formatBRL(v) + '/h');

  // Sexo/cidade são atributos do cadastro atual (não têm "período" — refletem
  // a base de clientes como ela está agora, independente do filtro de data acima).
  const clientesArr = Object.values(clientsData);
  const rotuloSexo = { feminino: 'Feminino', masculino: 'Masculino', outro: 'Outro' };
  const porSexo = {};
  clientesArr.forEach(c => { if (c.sexo && rotuloSexo[c.sexo]) porSexo[rotuloSexo[c.sexo]] = (porSexo[rotuloSexo[c.sexo]] || 0) + 1; });
  const segmentosSexo = Object.entries(porSexo).map(([label, value]) => ({ label, value }));
  document.getElementById('insights-donut-sexo').innerHTML = segmentosSexo.length
    ? svgDonut(segmentosSexo)
    : '<p style="font-size:12px;color:var(--color-text-secondary)">Ainda sem dados de sexo cadastrados — vem do checkout quando o cliente preenche.</p>';

  const porCidade = {};
  clientesArr.forEach(c => { if (c.cidade) porCidade[c.cidade] = (porCidade[c.cidade] || 0) + 1; });
  const itensCidade = Object.entries(porCidade).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  document.getElementById('insights-barras-cidade').innerHTML = itensCidade.length
    ? barListHTML(itensCidade)
    : '<p style="font-size:12px;color:var(--color-text-secondary)">Ainda sem dados de cidade cadastrados — vem do checkout quando o cliente preenche.</p>';
}

function renderKanban() {
  const board = document.querySelector('#section-acompanhamento .kanban-board');
  if (!board) return;
  board.innerHTML = KANBAN_STAGES.map(([status, label, color]) => {
    const items = Object.values(clientsData).filter(c =>
      (kanbanEtapas[c.id] || c.atendimentoModalidade === 'sem_agendamento') && etapaDoCliente(c) === status
    );
    return `<div class="kanban-col"><div class="kanban-col-header" style="border-top-color:${color}"><h4>${label}</h4><span class="kanban-badge" style="background:${color};color:#fff">${items.length}</span></div><div class="kanban-col-body" data-kanban-status="${status}">${items.map(c => {
      
      // SLA logic para o Kanban
      let slaHtml = '';
      const t = ocTarefas.find(task => task.clientId === c.id && !task.feita);
      if (t && t.deadline && status !== 'done') {
        const diffHours = (new Date(t.deadline) - new Date()) / (1000 * 60 * 60);
        let slaColor = '#2ECC71';
        let slaLabel = Math.floor(diffHours) + 'h';
        if (diffHours <= 0) { slaColor = '#E74C3C'; slaLabel = 'Atrasado'; }
        else if (diffHours <= 12) { slaColor = '#F1C40F'; }
        slaHtml = `<span style="background:${slaColor}; color:#fff; font-size:10px; padding:2px 4px; border-radius:4px; margin-left:4px;"><i class="fa-solid fa-clock"></i> ${slaLabel}</span>`;
      }

      return `<button type="button" class="kanban-card ${status === 'done' ? 'done' : ''}" draggable="true" data-client-id="${safe(c.id)}">
        <div class="kanban-card-title">${safe(c.name)}</div>
        <div class="kanban-card-tags"><span>${safe(c.taxType || 'Atendimento')}</span>${c.atendimentoModalidade === 'sem_agendamento' ? '<span style="background:#E8F5EF;color:#0A5C42">Sem agendamento</span>' : ''}${slaHtml}</div>
        <div class="kanban-card-meta"><i class="fa-solid ${c.atendimentoModalidade === 'sem_agendamento' ? 'fa-bolt' : 'fa-folder-open'}"></i> ${c.atendimentoModalidade === 'sem_agendamento' ? 'Acompanhamento na área do cliente e por e-mail' : safe(c.diagnosis || 'Sem diagnóstico')}</div>
      </button>`;
    }).join('') || '<p style="font-size:12px;color:var(--color-text-secondary);padding:8px">Sem casos</p>'}</div></div>`;
  }).join('');
  let dragging = null;
  board.querySelectorAll('[data-client-id]').forEach(card => {
    card.addEventListener('click', () => openDossier(card.dataset.clientId));
    card.addEventListener('dragstart', e => { dragging = card.dataset.clientId; e.dataTransfer.effectAllowed = 'move'; });
  });
  board.querySelectorAll('[data-kanban-status]').forEach(col => {
    col.addEventListener('dragover', e => e.preventDefault());
    col.addEventListener('drop', async e => { e.preventDefault(); if (dragging) await salvarStatusCliente(dragging, col.dataset.kanbanStatus); dragging = null; });
  });
}

async function salvarStatusCliente(clientId, status) {
  kanbanEtapas = { ...kanbanEtapas, [clientId]: status };
  // Antes gravava direto em /api/config (o navegador falando com o Supabase
  // pelo oc-data.js, sem nenhuma função serverless no meio). Passou a usar
  // /api/status pra poder mandar o e-mail "seu caso avançou" pro cliente a
  // cada etapa — a chave do Resend só existe no servidor.
  const res = await fetch(API_BASE + '/api/status?acao=mover-etapa-kanban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await tokenSessaoAtual()}` },
    body: JSON.stringify({ clientId, status })
  });
  if (!res.ok) { showToast('Não foi possível atualizar a etapa.'); return; }
  
  // Automação: Se foi para "Concluído" (done), dar baixa automática na tarefa SLA
  if (status === 'done') {
    let taskUpdated = false;
    ocTarefas.forEach(t => {
      if (t.clientId === clientId && !t.feita) {
        t.feita = true;
        taskUpdated = true;
      }
    });
    if (taskUpdated) await salvarTarefas();
  }

  renderCRM(); renderKanban(); updateDashboardData();
  showToast('Etapa do cliente atualizada.');
  if (status === 'recorrencia') await moverParaRecorrencia(clientId);
}

// Segundo gatilho de recorrência (o primeiro é o botão "Ativar" manual em
// Clientes/Recorrentes): mover o card no Kanban para "Recorrência" já ativa
// o acompanhamento mensal sozinho, sem precisar abrir outra aba.
async function moverParaRecorrencia(clientId) {
  const c = clientsData[clientId];
  if (!c || c.recorrente) return;
  const valor = Number(c.honorarios) || 0;
  if (!valor) {
    showToast('Cliente movido para Recorrência. Defina o valor mensal em Clientes → aba "Clientes Recorrentes" para ativar a cobrança.');
    return;
  }
  try {
    const res = await fetch(API_BASE + '/api/recorrencia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, ativar: true, tipo: 'Acompanhamento mensal', diaVenc: 10, valor })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === 'demo_action_not_available') showToast('Cliente movido para Recorrência. Ativação automática não funciona no modo demo — ative manualmente com login real.');
      else showToast('Cliente movido para Recorrência. Não foi possível ativar a cobrança automática — ative manualmente em Clientes → aba "Clientes Recorrentes".');
      return;
    }
    await recarregarClientes();
    renderCRM(); renderKanban();
    showToast('Cliente movido para Recorrência e cobrança mensal ativada.');
  } catch (_) {
    showToast('Cliente movido para Recorrência. Falha de conexão ao ativar a cobrança — ative manualmente depois.');
  }
}

async function refreshFinanceiro() {
  const serviceList = document.getElementById('financeiro-servicos-lista');
  if (!serviceList) return;
  try {
    const [servicesRes, chargesRes] = await Promise.all([
      fetch(API_BASE + '/api/servicos?all=1'), fetch(API_BASE + '/api/cobrancas')
    ]);
    if (!servicesRes.ok || !chargesRes.ok) throw new Error('financeiro_indisponivel');
    financeiro.servicos = await servicesRes.json();
    financeiro.cobrancas = await chargesRes.json();
    refreshCreditos();
    serviceList.innerHTML = financeiro.servicos.length ? financeiro.servicos.map(s => `<tr>
      <td><strong>${safe(s.name)}</strong>${s.description ? `<br><small>${safe(s.description)}</small>` : ''}${(s.itens || []).length ? `<br><small>Abarca ${s.itens.length} serviço(s)</small>` : ''}</td>
      <td>${formatBRL(s.price)}</td><td>${s.recurrence === 'monthly' ? 'Mensal' : 'Avulso'}</td>
      <td><span class="status-badge ${s.active ? 'status-active' : 'status-docs'}">${s.active ? 'Ativo' : 'Pausado'}</span></td>
      <td><button class="btn-doc-action" data-edit-service="${safe(s.id)}"><i class="fa-solid fa-pen"></i> Editar</button> <button class="btn-doc-action" data-copy-service="${safe(s.id)}"><i class="fa-solid fa-copy"></i> Link</button> <button class="btn-doc-action" data-delete-service="${safe(s.id)}" style="color: var(--color-erro, #B32620);"><i class="fa-solid fa-trash"></i> Excluir</button></td>
    </tr>`).join('') : '<tr><td colspan="5">Nenhum serviço cadastrado.</td></tr>';
    serviceList.querySelectorAll('[data-edit-service]').forEach(b => b.addEventListener('click', () => editarServico(b.dataset.editService)));
    serviceList.querySelectorAll('[data-copy-service]').forEach(b => b.addEventListener('click', () => copiarLinkServico(b.dataset.copyService)));
    serviceList.querySelectorAll('[data-delete-service]').forEach(b => b.addEventListener('click', () => excluirServico(b.dataset.deleteService)));
    const cobrancasPagas = financeiro.cobrancas.filter(c => c.status === 'paid');
    const paid = cobrancasPagas.reduce((total, c) => total + (c.valueCents || 0), 0) / 100;
    const open = financeiro.cobrancas.filter(c => c.status !== 'paid').reduce((total, c) => total + (c.valueCents || 0), 0) / 100;
    document.getElementById('financeiro-recebido').textContent = formatBRL(paid);
    document.getElementById('financeiro-recebido-info').textContent = `${cobrancasPagas.length} cobrança(s) paga(s)`;
    document.getElementById('financeiro-aberto').textContent = formatBRL(open);
    document.getElementById('financeiro-aberto-info').textContent = `${financeiro.cobrancas.filter(c => c.status !== 'paid').length} cobrança(s) em aberto`;
    const ticketMedio = cobrancasPagas.length ? paid / cobrancasPagas.length : 0;
    document.getElementById('financeiro-ticket-medio').textContent = formatBRL(ticketMedio);
    document.getElementById('financeiro-ticket-medio-info').textContent = cobrancasPagas.length
      ? `Média de ${cobrancasPagas.length} cobrança(s) paga(s)`
      : 'Nenhuma cobrança paga ainda';
    const clientsById = clientsData;
    document.getElementById('financeiro-cobrancas-lista').innerHTML = financeiro.cobrancas.length ? `<table class="financeiro-table"><thead><tr><th>Cliente</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead><tbody>${financeiro.cobrancas.slice(0, 12).map(c => `<tr><td>${safe(clientsById[c.clientRef]?.name || c.clientRef)}</td><td>${formatBRL((c.valueCents || 0) / 100)}</td><td>${safe(c.status)}</td><td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}</td></tr>`).join('')}</tbody></table>` : 'Nenhuma cobrança criada ainda.';
    updateDashboardFinanceiroKpis();
    renderFinanceiroCobrancasAbertas();
  } catch (e) {
    serviceList.innerHTML = '<tr><td colspan="5">Não foi possível carregar o financeiro.</td></tr>';
    updateDashboardFinanceiroKpis();
    renderFinanceiroCobrancasAbertas();
  }
}

async function salvarServico(service) {
  const res = await fetch(API_BASE + '/api/servicos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(service) });
  if (!res.ok) { showToast('Não foi possível salvar o serviço.'); return; }
  await refreshFinanceiro(); showToast('Serviço salvo.');
}
// Uma linha por opção: título (o que aparece na lista suspensa do agendamento)
// + resumo opcional (a explicação curta que some embaixo quando é escolhida).
function linhaItemServico(item) {
  const div = document.createElement('div');
  div.className = 'servico-item-row';
  div.style.cssText = 'display:flex;gap:8px;align-items:flex-start';
  div.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;gap:6px">
      <input type="text" class="form-input item-titulo" placeholder="Ex.: Vendi um imóvel, carro ou outro bem" value="${safe(item?.titulo || '')}">
      <input type="text" class="form-input item-resumo" placeholder="Explicação curta (opcional)" value="${safe(item?.resumo || '')}">
    </div>
    <button type="button" class="btn-doc-action" title="Remover"><i class="fa-solid fa-trash"></i></button>`;
  div.querySelector('button').addEventListener('click', () => div.remove());
  return div;
}

let servicoEmEdicao = null;
function abrirModalServico(s) {
  servicoEmEdicao = s || null;
  document.getElementById('servico-id').value = s?.id || '';
  document.getElementById('servico-nome').value = s?.name || '';
  document.getElementById('servico-preco').value = s ? String(s.price).replace('.', ',') : '';
  document.getElementById('servico-ativo').checked = s ? s.active !== false : true;
  document.querySelector('#modal-editar-servico .modal-header h3').textContent = s ? 'Editar plano' : 'Novo plano';
  const lista = document.getElementById('servico-itens-lista');
  lista.innerHTML = '';
  (s?.itens?.length ? s.itens : [null]).forEach(i => lista.appendChild(linhaItemServico(i)));
  openModal('modal-editar-servico');
}
function editarServico(id) {
  const s = financeiro.servicos.find(item => String(item.id) === String(id));
  if (s) abrirModalServico(s);
}
function novoServico() { abrirModalServico(null); }

function lerItensDoModal() {
  return [...document.querySelectorAll('#servico-itens-lista .servico-item-row')].map(row => ({
    titulo: row.querySelector('.item-titulo').value.trim(),
    resumo: row.querySelector('.item-resumo').value.trim()
  })).filter(i => i.titulo);
}
function salvarServicoDoModal(e) {
  e.preventDefault();
  const name = document.getElementById('servico-nome').value.trim();
  if (!name) return;
  const price = document.getElementById('servico-preco').value;
  const active = document.getElementById('servico-ativo').checked;
  const id = document.getElementById('servico-id').value || undefined;
  const itens = lerItensDoModal();
  salvarServico({ ...(servicoEmEdicao || {}), id, name, priceCents: Math.round(Number(price.replace(',', '.')) * 100), active, itens, recurrence: servicoEmEdicao?.recurrence || 'avulso' });
  closeModal('modal-editar-servico');
}
async function copiarLinkServico(id) {
  const url = `${location.origin}/cliente?servico=${encodeURIComponent(id)}`;
  try { await navigator.clipboard.writeText(url); showToast('Link do checkout copiado.'); }
  catch (_) { prompt('Copie o link:', url); }
}

// Exclui de vez o plano/link de pagamento. O backend recusa (409) se já existir
// cobrança gerada com este serviço — nesse caso o certo é desativar (toggle
// "Ativo" no modal de edição), não excluir, senão a cobrança antiga fica órfã.
async function excluirServico(id) {
  const s = financeiro.servicos.find(item => String(item.id) === String(id));
  if (!confirm(`Excluir o plano "${s?.name || id}"? O link de pagamento para de funcionar e essa ação não pode ser desfeita.`)) return;
  try {
    const res = await fetch(API_BASE + '/api/servicos?id=' + encodeURIComponent(id), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || 'Não foi possível excluir este plano.');
      return;
    }
    showToast('Plano excluído.');
    refreshFinanceiro();
  } catch (_) {
    showToast('Falha de conexão ao excluir.');
  }
}

// ---------- Créditos de Atendimento ----------
let creditosData = [];
function linkCredito(codigo) {
  return `${location.origin}/agendamento?credito=${encodeURIComponent(codigo)}`;
}
async function copiarTexto(texto, mensagem) {
  try { await navigator.clipboard.writeText(texto); showToast(mensagem); }
  catch (_) { prompt('Copie:', texto); }
}
async function refreshCreditos() {
  const box = document.getElementById('financeiro-creditos-lista');
  if (!box) return;
  try {
    const res = await fetch(API_BASE + '/api/creditos');
    if (!res.ok) throw new Error('creditos_indisponivel');
    creditosData = await res.json();
    const statusInfo = { ativo: ['status-active', 'Ativo'], usado: ['status-docs', 'Usado'], cancelado: ['status-atrasado', 'Cancelado'] };
    box.innerHTML = creditosData.length ? creditosData.map(c => {
      const [classe, label] = statusInfo[c.status] || ['pending', c.status];
      return `<tr>
        <td><code>${safe(c.codigo)}</code>${c.observacao ? `<br><small>${safe(c.observacao)}</small>` : ''}</td>
        <td>${formatBRL(c.valor)}</td>
        <td><span class="status-badge ${classe}">${label}</span></td>
        <td>${c.clienteNome ? safe(c.clienteNome) : '—'}</td>
        <td>
          <button class="btn-doc-action" data-copy-credito-codigo="${safe(c.codigo)}"><i class="fa-solid fa-copy"></i> Código</button>
          <button class="btn-doc-action" data-copy-credito-link="${safe(c.codigo)}"><i class="fa-solid fa-link"></i> Link</button>
          ${c.status === 'ativo' ? `<button class="btn-doc-action" data-cancelar-credito="${safe(c.id)}"><i class="fa-solid fa-ban"></i> Cancelar</button>` : ''}
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="5">Nenhum crédito gerado ainda.</td></tr>';
    box.querySelectorAll('[data-copy-credito-codigo]').forEach(b => b.addEventListener('click', () => copiarTexto(b.dataset.copyCreditoCodigo, 'Código copiado.')));
    box.querySelectorAll('[data-copy-credito-link]').forEach(b => b.addEventListener('click', () => copiarTexto(linkCredito(b.dataset.copyCreditoLink), 'Link de resgate copiado.')));
    box.querySelectorAll('[data-cancelar-credito]').forEach(b => b.addEventListener('click', () => cancelarCredito(b.dataset.cancelarCredito)));
  } catch (e) {
    box.innerHTML = '<tr><td colspan="5">Não foi possível carregar os créditos.</td></tr>';
  }
}
async function gerarCredito() {
  const valorStr = prompt('Valor do crédito em reais:');
  if (valorStr == null) return;
  const valorCents = Math.round(Number(String(valorStr).replace(',', '.')) * 100);
  if (!valorCents || valorCents < 100) { showToast('Informe um valor válido (mínimo R$ 1,00).'); return; }
  const observacao = prompt('Observação (opcional — ex.: "Cortesia indicação Maria"):') || '';
  try {
    const res = await fetch(API_BASE + '/api/creditos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valorCents, observacao })
    });
    if (!res.ok) throw new Error('falhou');
    const credito = await res.json();
    await refreshCreditos();
    await copiarTexto(linkCredito(credito.codigo), `Crédito ${credito.codigo} gerado — link copiado.`);
  } catch (e) {
    showToast('Não foi possível gerar o crédito.');
  }
}
async function cancelarCredito(id) {
  if (!confirm('Cancelar este crédito? Ele deixa de poder ser resgatado.')) return;
  try {
    const res = await fetch(API_BASE + `/api/creditos/${id}/cancelar`, { method: 'POST' });
    if (!res.ok) throw new Error('falhou');
    await refreshCreditos();
    showToast('Crédito cancelado.');
  } catch (e) {
    showToast('Não foi possível cancelar o crédito.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-novo-servico')?.addEventListener('click', novoServico);
  document.getElementById('btn-atualizar-financeiro')?.addEventListener('click', refreshFinanceiro);
  document.getElementById('btn-add-item-servico')?.addEventListener('click', () => {
    document.getElementById('servico-itens-lista').appendChild(linhaItemServico(null));
  });
  document.getElementById('form-editar-servico')?.addEventListener('submit', salvarServicoDoModal);
  document.getElementById('btn-gerar-credito')?.addEventListener('click', gerarCredito);
});

async function openDossier(clientId) {
  const c = clientsData[clientId];
  if (!c) return;
  document.getElementById('dossier-name').textContent = c.name;
  document.getElementById('dossier-doc').textContent = c.cpf || c.taxType || 'Sem documento';
  document.getElementById('dossier-avatar').textContent = c.avatar || initials(c.name);
  const [docsRes, relsRes] = await Promise.all([fetch(API_BASE + '/api/documentos?clientId=' + encodeURIComponent(c.id)), fetch(API_BASE + '/api/relatorios?clientId=' + encodeURIComponent(c.id))]);
  const docs = docsRes.ok ? await docsRes.json() : [];
  const reports = relsRes.ok ? await relsRes.json() : [];
  const process = document.getElementById('dossier-processo');
  const history = document.getElementById('dossier-historico');
  const files = document.getElementById('dossier-arquivos');
  process.innerHTML = `<div class="financeiro-card"><h3 style="font-size:14px;color:var(--color-text-secondary);margin-bottom:10px">Etapa do funil</h3><div style="display:flex;gap:10px;align-items:center"><select class="form-select" id="dossier-status-select" style="max-width:280px">${KANBAN_STAGES.map(s => `<option value="${s[0]}" ${s[0] === etapaDoCliente(c) ? 'selected' : ''}>${s[1]}</option>`).join('')}</select><button class="btn-utility primary" id="btn-dossier-save-status"><i class="fa-solid fa-save"></i> Salvar</button></div></div><h3 style="font-size:16px;margin:24px 0 10px;color:var(--color-pine)">Diagnóstico</h3><p style="font-size:13px;line-height:1.5">${safe(c.diagnosis || c.triagem?.descricao || 'Ainda não registrado.')}</p><h3 style="font-size:16px;margin:20px 0 10px;color:var(--color-pine)">Próximos passos</h3><p style="font-size:13px;line-height:1.5">${safe(c.treatment || 'Ainda não registrado.')}</p>`;
  document.getElementById('dossier-status-select').value = etapaDoCliente(c);
  document.getElementById('btn-dossier-save-status').onclick = () => {
    salvarStatusCliente(c.id, document.getElementById('dossier-status-select').value);
  };
  
  // Reseta a tab de Radar Fiscal para o estado inicial sempre que abrir um novo dossiê
  const radarContent = document.getElementById('dossier-radar-content');
  if (radarContent) {
    radarContent.innerHTML = `
      <i class="fa-solid fa-satellite-dish" style="font-size: 32px; color: var(--color-text-secondary); opacity: 0.3; margin-bottom: 12px;"></i>
      <p style="font-size: 14px; color: var(--color-text-secondary); margin: 0;">Escolha apenas a consulta necessária acima. Nada é buscado automaticamente.</p>
    `;
  }

  // Preenche histórico
  const hist = document.getElementById('dossier-historico-content');
  history.innerHTML = reports.length ? reports.map(r => `<div class="financeiro-card" style="margin-bottom:12px"><h3 style="font-size:14px;color:var(--color-pine)">${safe(r.titulo || 'Relatório de atendimento')}</h3><p style="font-size:12px;color:var(--color-text-secondary)">${new Date(r.createdAt).toLocaleDateString('pt-BR')} · ${safe(r.status || 'enviado')}</p><p style="font-size:13px">${safe(r.problema || r.solucao || '')}</p></div>`).join('') : '<p style="color:var(--color-text-secondary);font-size:13px">Nenhum relatório entregue ainda.</p>';
  files.innerHTML = docs.length ? `<table class="financeiro-table"><thead><tr><th>Arquivo</th><th>Enviado por</th><th>Data</th><th></th></tr></thead><tbody>${docs.map(d => `<tr><td>${safe(d.fileName)}</td><td>${d.uploadedBy === 'agent' ? 'Contador' : 'Cliente'}</td><td>${new Date(d.createdAt).toLocaleDateString('pt-BR')}</td><td>${d.url ? `<a class="btn-doc-action" href="${safe(d.url)}" target="_blank" rel="noopener">Abrir</a>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--color-text-secondary);font-size:13px">Nenhum arquivo enviado.</p>';
  document.getElementById('dossier-overlay').classList.add('active');
}

function closeDossier() {
  document.getElementById("dossier-overlay").classList.remove("active");
}

// Atendimento Panels Collapse Logic
document.addEventListener("DOMContentLoaded", () => {
  const sidePanelLeft = document.getElementById("side-panel-left");
  const btnToolFila = document.getElementById("btn-tool-fila");
  const btnToolDossie = document.getElementById("btn-tool-dossie");
  const panelContentFila = document.getElementById("panel-content-fila");
  const panelContentDossie = document.getElementById("panel-content-dossie");

  // Clique no avatar do header abre o menu com Meu Perfil + Sair juntos
  // (antes ia direto pro Meu Perfil e o Sair ficava num botão solto ao lado).
  function irParaMeuPerfilContador() {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
    const sec = document.getElementById('section-perfil');
    if (sec) sec.classList.add('active');
  }

  const headerAgentProfile = document.getElementById("header-agent-profile");
  const agentMenuContador = document.getElementById("agent-profile-menu-contador");
  if (headerAgentProfile && agentMenuContador) {
    headerAgentProfile.addEventListener("click", (e) => {
      e.stopPropagation();
      agentMenuContador.hidden = !agentMenuContador.hidden;
    });
  }
  const btnAgentMenuMeuPerfil = document.getElementById("btn-agent-menu-meu-perfil");
  if (btnAgentMenuMeuPerfil) {
    btnAgentMenuMeuPerfil.addEventListener("click", () => {
      if (agentMenuContador) agentMenuContador.hidden = true;
      irParaMeuPerfilContador();
    });
  }
  document.addEventListener("click", (e) => {
    if (agentMenuContador && !agentMenuContador.hidden && !e.target.closest('.agent-profile-wrap')) {
      agentMenuContador.hidden = true;
    }
  });

  function toggleLeftPanel(targetId) {
    if (!sidePanelLeft) return;
    
    // If the panel is already open on this target, collapse it
    if (!sidePanelLeft.classList.contains("collapsed") && 
        document.getElementById("panel-content-" + targetId).classList.contains("active")) {
      sidePanelLeft.classList.add("collapsed");
      document.querySelectorAll(".btn-toolbar").forEach(btn => btn.classList.remove("active"));
      return;
    }
    
    // Otherwise open it and switch active content
    sidePanelLeft.classList.remove("collapsed");
    
    // Switch active button
    document.querySelectorAll(".btn-toolbar").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById("btn-tool-" + targetId);
    if (activeBtn) activeBtn.classList.add("active");
    
    // Switch active content
    document.querySelectorAll(".side-panel-content").forEach(content => content.classList.remove("active"));
    const targetContent = document.getElementById("panel-content-" + targetId);
    if (targetContent) targetContent.classList.add("active");

    // O Copiloto precisa de mais largura que a fila/dossiê (atalhos + input);
    // o painel usa essa largura maior só enquanto ele estiver aberto.
    sidePanelLeft.dataset.panel = targetId;
  }

  if (btnToolFila) {
    btnToolFila.addEventListener("click", () => toggleLeftPanel("fila"));
  }
  
  if (btnToolDossie) {
    btnToolDossie.addEventListener("click", () => toggleLeftPanel("dossie"));
  }

  const btnToolCopilot = document.getElementById("btn-tool-copilot");
  if (btnToolCopilot) {
    btnToolCopilot.addEventListener("click", () => toggleLeftPanel("copilot"));
  }


  // Legacy copilot close button from right panel (just in case)
  const btnCloseCopilot = document.getElementById("btn-close-copilot");
  if (btnCloseCopilot && sidePanelLeft) {
    btnCloseCopilot.addEventListener("click", () => {
      sidePanelLeft.classList.add("collapsed");
      document.querySelectorAll(".btn-toolbar").forEach(btn => btn.classList.remove("active"));
    });
  }
});

// Attach event listeners for dossier internal tabs
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#dossier-overlay .settings-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      // Remove active from all dossier tabs and panes
      document.querySelectorAll("#dossier-overlay .settings-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll("#dossier-overlay .settings-pane").forEach(p => p.classList.remove("active"));
      
      // Add active to clicked tab and its target pane
      tab.classList.add("active");
      const targetPane = document.getElementById(tab.getAttribute("data-tab"));
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });

  // Abas do Financeiro (mesma classe .settings-tab dos outros lugares — escopado
  // a #section-financeiro pra não interferir nas abas de Configurações/Dossiê).
  document.querySelectorAll("#section-financeiro .settings-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#section-financeiro .settings-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll("#section-financeiro .settings-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const targetPane = document.getElementById(tab.getAttribute("data-tab"));
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // Filtro de aging da aba "Cobranças em Aberto"
  document.querySelectorAll('[data-financeiro-abertas-filtro]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-financeiro-abertas-filtro]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      financeiroAbertasFiltro = btn.dataset.financeiroAbertasFiltro;
      renderFinanceiroCobrancasAbertas();
    });
  });

  // Abas da Caixa Postal (Avisos do Sistema / Mensagens) — mesmo motivo do
  // escopo acima: não interferir nas abas de Configurações/Financeiro/Dossiê.
  document.querySelectorAll("#section-notificacoes .settings-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#section-notificacoes .settings-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll("#section-notificacoes .settings-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const targetPane = document.getElementById(tab.getAttribute("data-tab"));
      if (targetPane) targetPane.classList.add("active");
      if (tab.getAttribute("data-tab") === 'cp-mensagens') renderCaixaPostalClientesLista();
    });
  });

  const buscaCaixaPostal = document.getElementById('caixa-postal-busca');
  if (buscaCaixaPostal) {
    buscaCaixaPostal.addEventListener('input', () => renderCaixaPostalClientesLista(buscaCaixaPostal.value));
  }

  const formCaixaPostal = document.getElementById('form-caixa-postal-enviar');
  if (formCaixaPostal) {
    formCaixaPostal.addEventListener('submit', async (e) => {
      e.preventDefault();
      await enviarMensagemCaixaPostal();
    });
  }
});

// --- Mock Agenda Notifications System ---
function setupAgendaMocks() {
  // Alertas automáticos desativados temporariamente a pedido do usuário
  /*
  // Simulate an external booking arriving shortly after page load
  setTimeout(() => {
    showToast("🔔 Novo agendamento recebido pelo portal: Marcos Oliveira (Regularização MEI).", "notification");
  }, 10000); // 10 seconds

  // Simulate an appointment approaching 5 minutes
  setTimeout(() => {
    showToast("⏰ Lembrete: Você tem um atendimento agendado para daqui 5 minutos com Mariana Costa.", "alert");
  }, 25000); // 25 seconds
  */
}

// --- Dashboard Charts ---
function renderDashboardCharts() {
  const ctx = document.getElementById('dashboardRevenueChart');
  if (!ctx) return;
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['1 Jul', '5 Jul', '10 Jul', '15 Jul', '20 Jul', '25 Jul', '30 Jul'],
      datasets: [{
        label: 'Faturamento (R$)',
        data: [1200, 1900, 3000, 5000, 4800, 6200, 7500],
        borderColor: '#2ECC71',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#F0F0F0'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ============================================================================
// STATUS ONLINE (PRESENÇA)
// ============================================================================
const presenceStore = {}; // { 'clientId': lastSeenTimestamp }

function setupPresence() {
  if (!window.sb) return;
  if (window.OC_CONFIG?.TESTE_CONTADOR_SEM_LOGIN?.enabled && window.OC_ROLE === 'contador') return;
  const ch = window.sb.channel('oc-presence', { config: { broadcast: { self: false } } });
  
  ch.on('broadcast', { event: 'ping' }, ({ payload }) => {
    if (payload.role === 'client' && payload.id) {
      presenceStore[payload.id] = Date.now();
      updatePresenceUI(payload.id);
    }
  });
  ch.subscribe();

  // Contador avisa que está vivo a cada 5s
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      ch.send({ type: 'broadcast', event: 'ping', payload: { role: 'contador' } });
    }
  }, 5000);
  
  // Limpa offline a cada 10s
  setInterval(() => {
    if (activeClientId) updatePresenceUI(activeClientId);
  }, 10000);
}

function updatePresenceUI(clientId) {
  if (clientId !== activeClientId) return;
  const statusEl = document.getElementById('active-client-status');
  if (!statusEl) return;
  
  const lastSeen = presenceStore[clientId] || 0;
  const isOnline = (Date.now() - lastSeen) < 15000; // 15s limite
  
  statusEl.style.display = 'flex';
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
    if (lastSeen > 0) {
      const min = Math.floor((Date.now() - lastSeen) / 60000);
      textEl.textContent = min < 1 ? 'Visto agora mesmo' : `Visto há ${min} min`;
    } else {
      textEl.textContent = 'Offline';
    }
  }
}

// Bloqueio manual do chat
window.toggleChatLock = async function() {
  if (!activeClientId) return;
  const client = clientsData[activeClientId];
  if (!client) return;
  
  const isLocked = client.status === 'locked';
  const newStatus = isLocked ? 'active' : 'locked';

  try {
    await atualizarStatusCliente(activeClientId, newStatus);
    loadClient(activeClientId);
    
    if (newStatus === 'locked') {
      await postSystemMessageToChat("O chat foi bloqueado temporariamente até o contador entrar em contato.");
      showToast('Chat bloqueado para o cliente.');
    } else {
      await postSystemMessageToChat("O chat foi liberado. O cliente pode enviar mensagens novamente.");
      showToast('Chat liberado para o cliente.');
    }
  } catch (e) {
    console.error('Falha ao alterar bloqueio do chat:', e);
    showToast('Não consegui alterar o bloqueio do chat.');
  }
}

// --- Copilot AI Logic ---
// Sincroniza o Copiloto com o atendimento ativo: mostra de quem se trata e
// reseta a conversa anterior — sem isso, trocar de cliente na fila deixava
// a análise antiga na tela como se ainda fosse sobre o caso atual.
function atualizarContextoCopilot(client) {
  const barra = document.getElementById('copilot-context-bar');
  const nomeEl = document.getElementById('copilot-context-nome');
  if (!barra || !nomeEl) return;
  if (client && client.name) {
    nomeEl.textContent = client.name; // textContent já escapa, sem risco de HTML
    barra.classList.remove('sem-atendimento');
  } else {
    nomeEl.textContent = 'nenhum atendimento aberto';
    barra.classList.add('sem-atendimento');
  }

  // A skill não fica mais na escolha anterior: se o tema do atendimento bate
  // com o tema cadastrado de alguma skill, ela ativa sozinha; senão, volta pro
  // padrão. Evita responder um caso de MEI usando a skill que ficou selecionada
  // do atendimento anterior de Malha Fina, por exemplo.
  const skillSelect = document.getElementById('active-skill-selector');
  const skillAuto = client ? skillPorTema(client.taxType) : null;
  if (skillSelect) skillSelect.value = skillAuto ? skillAuto.id : '';

  const chat = document.getElementById('copilot-chat');
  if (chat) {
    const avisoSkill = skillAuto
      ? `<br><br><i class="fa-solid fa-brain" style="color: var(--color-pine);"></i> Skill <strong>${safe(skillAuto.name)}</strong> ativada automaticamente (tema: ${safe(client.taxType)}).`
      : '';
    chat.innerHTML = `
      <div style="display: flex; gap: 12px; max-width: 90%;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-pine); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg viewBox="0 0 616 640" style="width: 15px; height: 15px;"><use href="#oc-logo-mark"></use></svg></div>
        <div style="background: white; border: 1px solid var(--color-border); padding: 12px; border-radius: 8px; font-size: 13px; color: var(--color-text); line-height: 1.4;">
          ${client && client.name ? `Estou acompanhando o atendimento de <strong>${safe(client.name)}</strong>.` : 'Nenhum atendimento aberto no momento.'}<br><br>Selecione um comando rápido abaixo ou me pergunte o que precisar.${avisoSkill}
        </div>
      </div>`;
  }
}

// ===== Atalhos do Copiloto IA (configuráveis em Configurações → Aparência do Chat) =====
const defaultCopilotShortcuts = [
  { id: 'cp-1', label: 'Ganho Capital', prompt: 'Analise se este cliente tem direito à isenção de Ganho de Capital no caso relatado.', enabled: true },
  { id: 'cp-2', label: 'PJ vs PF', prompt: 'Faça uma simulação rápida se vale mais a pena ele abrir um CNPJ (PJ) ou ficar na Pessoa Física (PF) com base nesses rendimentos.', enabled: true },
  { id: 'cp-3', label: 'Checklist', prompt: 'Gere o checklist exato de documentos que eu preciso pedir para este caso específico.', enabled: true },
  { id: 'cp-4', label: 'Resumir Chat', prompt: 'Faça um resumo rápido do que o cliente pediu.', enabled: true }
];
let copilotShortcuts = JSON.parse(localStorage.getItem('copilotShortcuts')) || defaultCopilotShortcuts;

function saveCopilotShortcuts() {
  localStorage.setItem('copilotShortcuts', JSON.stringify(copilotShortcuts));
  renderCopilotPrompts();
}

// Chat: só os atalhos ligados aparecem como chip.
function renderCopilotPrompts() {
  const container = document.getElementById('copilot-prompts-container');
  if (!container) return;
  container.innerHTML = '';
  copilotShortcuts.filter(s => s.enabled).forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'btn-shortcut-tag';
    btn.textContent = s.label;
    btn.addEventListener('click', () => triggerCopilot(s.prompt));
    container.appendChild(btn);
  });
}

// Configurações: todos aparecem (ligados ou não), com toggle + edição + exclusão.
function renderCopilotShortcutsConfig() {
  const list = document.getElementById('cfg-copilot-shortcuts-list');
  if (!list) return;
  list.innerHTML = '';
  copilotShortcuts.forEach(s => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; align-items:center; padding:8px 12px; background:white; border:1px solid var(--color-border); border-radius:6px;';
    row.innerHTML = `
      <label class="theme-switch" style="flex-shrink:0;" title="Ativar/desativar">
        <input type="checkbox" class="cp-shortcut-toggle" ${s.enabled ? 'checked' : ''}>
        <span class="theme-slider"></span>
      </label>
      <input type="text" class="cfg-input cp-shortcut-label" value="${escapeHtml(s.label)}" style="flex: 1; font-size:12px;" placeholder="Rótulo">
      <input type="text" class="cfg-input cp-shortcut-prompt" value="${escapeHtml(s.prompt)}" style="flex: 2; font-size:12px;" placeholder="Pergunta enviada à IA">
      <button class="btn-utility" style="padding: 4px 8px; color: var(--color-coral); flex-shrink:0;" title="Remover"><i class="fa-solid fa-trash"></i></button>
    `;
    row.querySelector('.cp-shortcut-toggle').addEventListener('change', (e) => {
      s.enabled = e.target.checked;
      saveCopilotShortcuts();
    });
    row.querySelector('.cp-shortcut-label').addEventListener('change', (e) => {
      s.label = e.target.value.trim() || s.label;
      saveCopilotShortcuts();
    });
    row.querySelector('.cp-shortcut-prompt').addEventListener('change', (e) => {
      s.prompt = e.target.value.trim() || s.prompt;
      saveCopilotShortcuts();
    });
    row.querySelector('button').addEventListener('click', () => {
      copilotShortcuts = copilotShortcuts.filter(x => x.id !== s.id);
      saveCopilotShortcuts();
      renderCopilotShortcutsConfig();
    });
    list.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderCopilotPrompts();
  renderCopilotShortcutsConfig();
  const btnAddCp = document.getElementById('btn-add-copilot-shortcut');
  if (btnAddCp) btnAddCp.addEventListener('click', () => {
    const label = document.getElementById('new-copilot-shortcut-label').value.trim();
    const prompt = document.getElementById('new-copilot-shortcut-prompt').value.trim();
    if (!label || !prompt) return;
    copilotShortcuts.push({ id: 'cp-' + Date.now(), label, prompt, enabled: true });
    saveCopilotShortcuts();
    renderCopilotShortcutsConfig();
    document.getElementById('new-copilot-shortcut-label').value = '';
    document.getElementById('new-copilot-shortcut-prompt').value = '';
  });
});

function triggerCopilot(msg) {
  const input = document.getElementById("copilot-input");
  if (input) {
    input.value = msg;
    submitCopilotMessage();
  }
}

function submitCopilotMessage() {
  const input = document.getElementById("copilot-input");
  const chat = document.getElementById("copilot-chat");
  if (!input || !chat || input.value.trim() === "") return;

  const msgText = input.value.trim();
  input.value = "";

  // Append user message
  const userDiv = document.createElement("div");
  userDiv.style.display = "flex";
  userDiv.style.justifyContent = "flex-end";
  userDiv.innerHTML = `<div class="copilot-user-bubble">${msgText}</div>`;
  chat.appendChild(userDiv);
  chat.scrollTop = chat.scrollHeight;

  // Bolha "pensando" enquanto a IA responde
  const aiDiv = document.createElement("div");
  aiDiv.style.display = "flex";
  aiDiv.style.gap = "12px";
  aiDiv.style.maxWidth = "90%";
  aiDiv.innerHTML = `
    <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-pine); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;"><i class="fa-solid fa-robot"></i></div>
    <div class="copilot-msg-bubble"><i class="fa-solid fa-spinner fa-spin"></i> Analisando o atendimento...</div>
  `;
  chat.appendChild(aiDiv);
  chat.scrollTop = chat.scrollHeight;
  const bubble = aiDiv.querySelector(".copilot-msg-bubble");

  askCopilot(msgText, bubble, chat);
}

async function askCopilot(prompt, bubble, chat) {
  try {
    // A skill ativa (selecionada no topo do painel) vale pra qualquer pergunta
    // feita aqui, seja digitada ou vinda de um atalho — é a mesma conversa.
    const skillSelect = document.getElementById('active-skill-selector');
    const skillAtiva = skillSelect && skillSelect.value ? iaSkills.find(s => s.id === skillSelect.value) : null;
    const res = await fetch(API_BASE + '/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: activeClientId, mode: 'pergunta', prompt,
        skill: skillAtiva ? { name: skillAtiva.name, content: skillAtiva.content } : null
      })
    });

    if (res.status === 503) {
      bubble.innerHTML = 'IA ainda não configurada. Adicione a <strong>OPENROUTER_API_KEY</strong> no .env do servidor para ativar o assistente.';
      return;
    }
    if (!res.ok) {
      bubble.textContent = 'Não consegui responder agora. Tente novamente.';
      return;
    }
    const data = await res.json();
    // converte quebras de linha simples em <br> para leitura
    bubble.innerHTML = (data.text || '').replace(/\n/g, '<br>');
  } catch (e) {
    bubble.textContent = 'Falha de conexão com o assistente.';
  } finally {
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupAgendaMocks();
  renderDashboardCharts();
  setupTarefas();
  setupNotaFiscalConfig();
  setupTimerConfig();
  setupRadarFiscalConfig();
});

// ===== Tarefas Pendentes (dashboard) =====
// Persistência em localStorage, mesmo padrão dos atalhos de chat (chatShortcuts).
// Substitui os cards demo fixos que existiam no HTML.
let ocTarefas = [];

async function salvarTarefas() {
  const res = await fetch(API_BASE + '/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarefas: ocTarefas }) });
  if (!res.ok) throw new Error('tarefas_nao_salvas');
}

function formatarDataTarefa(valor) {
  if (!valor) return 'Não definida';
  const data = new Date(valor);
  return isNaN(data) ? 'Não definida' : data.toLocaleDateString('pt-BR');
}

function dataTarefaParaISO(valor) {
  const partes = String(valor || '').trim().split('/').map(Number);
  if (partes.length !== 3 || partes.some(n => !Number.isInteger(n))) return null;
  const [dia, mes, ano] = partes;
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return data.toISOString();
}

function renderTarefas() {
  const lista = document.getElementById('tarefas-lista');
  if (!lista) return;
  lista.innerHTML = '';

  if (ocTarefas.length === 0) {
    lista.innerHTML = `
      <div style="text-align: center; padding: 24px 12px; color: var(--color-text-secondary);">
        <i class="fa-solid fa-list-check" style="font-size: 24px; opacity: .35; margin-bottom: 8px; display: block;"></i>
        <p style="font-size: 13px; margin: 0;">Nenhuma tarefa pendente.</p>
        <p style="font-size: 11px; margin: 4px 0 0;">Clique em <strong>+ Nova</strong> para anotar uma ação pós-atendimento.</p>
      </div>`;
    return;
  }

  ocTarefas.forEach((t, i) => {
    const card = document.createElement('div');
    card.style.cssText = 'display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px; background: white;';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = !!t.feita;
    check.style.cssText = 'margin-top: 4px; accent-color: var(--color-coral); width: 16px; height: 16px; cursor: pointer;';
    check.addEventListener('change', () => {
      ocTarefas[i].feita = check.checked;
      salvarTarefas().catch(() => showToast('Não foi possível salvar a tarefa.'));
      renderTarefas();
    });

    const info = document.createElement('div');
    info.style.flex = '1';
    const titulo = document.createElement('h4');
    titulo.style.cssText = 'font-size: 13px; color: var(--color-pine); margin: 0;' + (t.feita ? ' text-decoration: line-through; opacity: .55;' : '');
    titulo.textContent = t.texto;
    info.appendChild(titulo);

    const periodo = document.createElement('p');
    periodo.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 6px 0 0; font-size: 10px; color: var(--color-text-secondary);';
    periodo.innerHTML = `<span><i class="fa-solid fa-calendar-plus"></i> Data inicial: ${formatarDataTarefa(t.dataInicial || t.createdAt)}</span><span><i class="fa-solid fa-calendar-check"></i> Prazo (data final): ${formatarDataTarefa(t.dataFinal || t.deadline)}</span>`;
    info.appendChild(periodo);

    const remover = document.createElement('button');
    remover.title = 'Remover tarefa';
    remover.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    remover.style.cssText = 'border: none; background: none; color: var(--color-text-secondary); cursor: pointer; font-size: 13px; padding: 2px 4px;';
    remover.addEventListener('click', () => {
      ocTarefas.splice(i, 1);
      salvarTarefas().catch(() => showToast('Não foi possível salvar a tarefa.'));
      renderTarefas();
    });

    card.append(check, info, remover);
    lista.appendChild(card);
  });
}

function setupTarefas() {
  const btn = document.getElementById('btn-nova-tarefa');
  if (btn) btn.addEventListener('click', () => {
    const texto = prompt('Descreva a tarefa (ex.: "Enviar relatório — Ana Silva"):');
    if (!texto || !texto.trim()) return;

    const hoje = new Date().toLocaleDateString('pt-BR');
    const inicio = dataTarefaParaISO(prompt('Data inicial (dd/mm/aaaa):', hoje));
    if (!inicio) { showToast('Informe uma data inicial válida.'); return; }

    const fim = dataTarefaParaISO(prompt('Prazo / data final (dd/mm/aaaa):', hoje));
    if (!fim) { showToast('Informe uma data final válida.'); return; }

    ocTarefas.unshift({ texto: texto.trim(), feita: false, dataInicial: inicio, dataFinal: fim, deadline: fim });
    salvarTarefas().catch(() => showToast('Não foi possível salvar a tarefa.'));
    renderTarefas();
  });
  renderTarefas();
}

function configArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch (_) {} }
  return [];
}
function configObject(value, fallback) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : fallback; } catch (_) {} }
  return fallback;
}

// ===== Radar Fiscal (Configurações + seleção do cliente) =====
const DEFAULT_RADAR_FISCAL_CONFIG = {
  portalAtivo: true,
  caixaPostalAutomatica: true,
  caixaPostalIntervaloDias: 7,
  parcelamentosValidadeDias: 0,
  clientePodeEmitirDas: true
};
let radarFiscalConfig = { ...DEFAULT_RADAR_FISCAL_CONFIG };
let radarFiscalClientes = {};

function normalizarRadarFiscalConfig(valor) {
  const cfg = { ...DEFAULT_RADAR_FISCAL_CONFIG, ...configObject(valor, {}) };
  cfg.portalAtivo = cfg.portalAtivo !== false;
  cfg.caixaPostalAutomatica = cfg.caixaPostalAutomatica !== false;
  cfg.caixaPostalIntervaloDias = Math.min(30, Math.max(1, parseInt(cfg.caixaPostalIntervaloDias, 10) || 7));
  cfg.parcelamentosValidadeDias = Math.min(365, Math.max(0, parseInt(cfg.parcelamentosValidadeDias, 10) || 0));
  cfg.clientePodeEmitirDas = cfg.clientePodeEmitirDas !== false;
  return cfg;
}

function radarClienteEstaLiberado(c) {
  if (!c) return false;
  if (Object.prototype.hasOwnProperty.call(radarFiscalClientes, c.id)) return radarFiscalClientes[c.id] === true;
  return !!(c.recorrente && c.recorrenteTipo === 'Radar Fiscal');
}

function renderRadarFiscalConfigToUI() {
  const portal = document.getElementById('cfg-radar-portal');
  const caixaAuto = document.getElementById('cfg-radar-caixa-auto');
  const caixaDias = document.getElementById('cfg-radar-caixa-dias');
  const parcelasDias = document.getElementById('cfg-radar-parcelamentos-dias');
  const clienteDas = document.getElementById('cfg-radar-cliente-das');
  if (portal) portal.checked = radarFiscalConfig.portalAtivo !== false;
  if (caixaAuto) caixaAuto.checked = radarFiscalConfig.caixaPostalAutomatica !== false;
  if (caixaDias) caixaDias.value = radarFiscalConfig.caixaPostalIntervaloDias;
  if (parcelasDias) parcelasDias.value = radarFiscalConfig.parcelamentosValidadeDias;
  if (clienteDas) clienteDas.checked = radarFiscalConfig.clientePodeEmitirDas !== false;

  const lista = document.getElementById('cfg-radar-clientes');
  if (!lista) return;
  const clientes = Object.values(clientsData || {}).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  lista.innerHTML = clientes.length ? clientes.map(c => `
    <label class="radar-config-cliente">
      <div class="chat-item-avatar" style="width:34px;height:34px;font-size:11px;">${safe(c.avatar || initials(c.name))}</div>
      <span class="radar-config-cliente-info"><strong>${safe(c.name)}</strong><span>${safe(c.cpf || 'Sem CPF/CNPJ')} · ${safe(c.regimeTributario || 'regime não definido')}</span></span>
      <span class="switch"><input type="checkbox" data-radar-cliente-id="${safe(c.id)}" ${radarClienteEstaLiberado(c) ? 'checked' : ''}><span class="slider round"></span></span>
    </label>`).join('') : '<p class="cfg-vazio">Nenhum cliente cadastrado.</p>';

  lista.querySelectorAll('[data-radar-cliente-id]').forEach(input => input.addEventListener('change', async () => {
    radarFiscalClientes[input.dataset.radarClienteId] = input.checked;
    await salvarRadarFiscalConfig('Permissão do cliente atualizada.');
  }));
}

async function salvarRadarFiscalConfig(mensagem) {
  const status = document.getElementById('radar-config-status');
  if (status) { status.textContent = 'Salvando…'; status.style.color = 'var(--color-text-secondary)'; }
  try {
    const res = await fetch(API_BASE + '/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ radar_fiscal_config: radarFiscalConfig, radar_fiscal_clientes: radarFiscalClientes })
    });
    if (!res.ok) throw new Error('falha');
    if (status) { status.textContent = 'Salvo.'; status.style.color = '#1F8A5B'; }
    if (mensagem) showToast(mensagem);
  } catch (_) {
    if (status) { status.textContent = 'Erro ao salvar.'; status.style.color = '#C0392B'; }
    showToast('Não foi possível salvar as regras do Radar Fiscal.');
  }
}

function setupRadarFiscalConfig() {
  const btn = document.getElementById('btn-radar-config-salvar');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    radarFiscalConfig = normalizarRadarFiscalConfig({
      portalAtivo: document.getElementById('cfg-radar-portal').checked,
      caixaPostalAutomatica: document.getElementById('cfg-radar-caixa-auto').checked,
      caixaPostalIntervaloDias: document.getElementById('cfg-radar-caixa-dias').value,
      parcelamentosValidadeDias: document.getElementById('cfg-radar-parcelamentos-dias').value,
      clientePodeEmitirDas: document.getElementById('cfg-radar-cliente-das').checked
    });
    renderRadarFiscalConfigToUI();
    await salvarRadarFiscalConfig('Regras do Radar Fiscal salvas.');
  });
}

function renderRadarInternoClientes() {
  const select = document.getElementById('radar-interno-cliente');
  if (!select) return;
  const atual = select.value;
  const clientes = Object.values(clientsData || {}).filter(c => c.cpf).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  select.innerHTML = '<option value="">Selecione um cliente</option>' + clientes.map(c => `<option value="${safe(c.id)}">${safe(c.name)} · ${safe(c.cpf)}</option>`).join('');
  if (clientes.some(c => c.id === atual)) select.value = atual;
  else if (activeClientId && clientes.some(c => c.id === activeClientId)) select.value = activeClientId;
  if (!select.dataset.bound) {
    select.dataset.bound = '1';
    select.addEventListener('change', atualizarClienteRadarInterno);
  }
  atualizarClienteRadarInterno();
}

function atualizarClienteRadarInterno() {
  const id = document.getElementById('radar-interno-cliente')?.value;
  const c = id && clientsData[id];
  const meta = document.getElementById('radar-interno-cliente-meta');
  const regime = document.getElementById('radar-interno-regime');
  if (regime) regime.value = c && ['mei', 'simples'].includes(c.regimeTributario) ? c.regimeTributario : '';
  if (meta) meta.innerHTML = c
    ? `<strong>${safe(c.cpf || '')}</strong> · ${radarClienteEstaLiberado(c) ? 'Radar liberado no portal' : 'uso somente interno'}${c.regimeTributario ? ` · ${safe(c.regimeTributario)}` : ''}`
    : 'Escolha um cliente para vincular o resultado e evitar consultas repetidas.';
}

function clienteRadarInternoSelecionado() {
  const clienteRef = document.getElementById('radar-interno-cliente')?.value || '';
  if (!clienteRef || !clientsData[clienteRef]) {
    showToast('Selecione o cliente antes de consultar.');
    document.getElementById('radar-interno-cliente')?.focus();
    return '';
  }
  return clienteRef;
}
// ===== Nota Fiscal de Serviço (Configurações → Integrações) =====
// Persistido na mesma tabela chave-valor 'configuracoes' usada por tarefas,
// perfil etc. (ver /api/config). O pré-requisito de configurar as
// informações fiscais na CONTA Asaas é feito pelo contador diretamente lá —
// aqui só guardamos qual serviço municipal usar e se a emissão é automática.
let notaFiscalConfig = { ativo: false, municipalServiceId: '', municipalServiceName: '', descricao: '', observacoes: '' };

function renderNotaFiscalConfigToUI() {
  const ativo = document.getElementById('nf-ativo');
  const select = document.getElementById('nf-servico-municipal');
  const descricao = document.getElementById('nf-descricao');
  const observacoes = document.getElementById('nf-observacoes');
  if (!ativo || !select || !descricao || !observacoes) return;
  ativo.checked = !!notaFiscalConfig.ativo;
  descricao.value = notaFiscalConfig.descricao || '';
  observacoes.value = notaFiscalConfig.observacoes || '';
  if (notaFiscalConfig.municipalServiceId) {
    // Garante que a opção salva apareça mesmo antes de clicar em "Buscar
    // serviços" (ex.: ao recarregar a página já com uma escolha salva).
    if (![...select.options].some(o => o.value === notaFiscalConfig.municipalServiceId)) {
      const opt = document.createElement('option');
      opt.value = notaFiscalConfig.municipalServiceId;
      opt.textContent = notaFiscalConfig.municipalServiceName || `Serviço ${notaFiscalConfig.municipalServiceId}`;
      select.appendChild(opt);
    }
    select.value = notaFiscalConfig.municipalServiceId;
  }
}

function setupNotaFiscalConfig() {
  const btnBuscar = document.getElementById('btn-nf-buscar-servicos');
  const btnSalvar = document.getElementById('btn-nf-salvar');
  const select = document.getElementById('nf-servico-municipal');
  const statusMsg = document.getElementById('nf-status-msg');
  if (!btnBuscar || !btnSalvar || !select) return;

  btnBuscar.addEventListener('click', async () => {
    btnBuscar.disabled = true;
    const textoOriginal = btnBuscar.innerHTML;
    btnBuscar.innerHTML = 'Buscando...';
    try {
      const res = await fetch(API_BASE + '/api/status?acao=servicos-municipais');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || 'falha na busca');
      const lista = Array.isArray(data) ? data : (data.data || []);
      select.innerHTML = lista.length
        ? lista.map(s => `<option value="${safe(s.id)}">${safe(s.description || s.name || String(s.id))}</option>`).join('')
        : '<option value="">Nenhum serviço encontrado na prefeitura da conta</option>';
      showToast(`${lista.length} serviço(s) municipal(is) encontrado(s).`);
    } catch (e) {
      showToast('Não consegui buscar os serviços — confira se as informações fiscais já estão configuradas no Asaas.');
    } finally {
      btnBuscar.disabled = false;
      btnBuscar.innerHTML = textoOriginal;
    }
  });

  btnSalvar.addEventListener('click', async () => {
    const opt = select.options[select.selectedIndex];
    notaFiscalConfig = {
      ativo: document.getElementById('nf-ativo').checked,
      municipalServiceId: select.value || '',
      municipalServiceName: opt ? opt.textContent : '',
      descricao: document.getElementById('nf-descricao').value.trim(),
      observacoes: document.getElementById('nf-observacoes').value.trim()
    };
    if (statusMsg) { statusMsg.textContent = 'Salvando...'; statusMsg.style.color = 'var(--color-text-secondary)'; }
    try {
      const res = await fetch(API_BASE + '/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota_fiscal_config: notaFiscalConfig })
      });
      if (!res.ok) throw new Error('falha ao salvar');
      if (statusMsg) { statusMsg.textContent = 'Salvo.'; statusMsg.style.color = '#2ECC71'; }
      showToast('Configuração de nota fiscal salva.');
    } catch (e) {
      if (statusMsg) { statusMsg.textContent = 'Erro ao salvar.'; statusMsg.style.color = 'var(--color-erro)'; }
      showToast('Não foi possível salvar a configuração de nota fiscal.');
    }
  });
}

// ===== Cronômetro do Atendimento (Configurações → Geral) =====
function renderTimerConfigToUI() {
  const auto = document.getElementById('cfg-timer-auto');
  const direcao = document.getElementById('cfg-timer-direcao');
  const duracao = document.getElementById('cfg-timer-duracao');
  const avisoMin = document.getElementById('cfg-timer-aviso-min');
  const avisarCliente = document.getElementById('cfg-timer-avisar-cliente');
  const som = document.getElementById('cfg-timer-som');
  if (!auto || !direcao || !duracao || !avisoMin || !avisarCliente || !som) return;
  auto.checked = timerConfig.autoIniciar !== false;
  direcao.value = timerConfig.direcao === 'decrescente' ? 'decrescente' : 'crescente';
  duracao.value = timerConfig.duracaoMinutos;
  avisoMin.value = timerConfig.avisoMinutosAntes;
  avisarCliente.checked = timerConfig.avisarCliente !== false;
  som.checked = timerConfig.avisoSonoro !== false;
}

function setupTimerConfig() {
  const btnSalvar = document.getElementById('btn-timer-salvar');
  const statusMsg = document.getElementById('timer-cfg-status-msg');
  if (!btnSalvar) return;

  btnSalvar.addEventListener('click', async () => {
    const duracao = Math.max(1, parseInt(document.getElementById('cfg-timer-duracao').value, 10) || 40);
    const avisoMin = Math.max(1, parseInt(document.getElementById('cfg-timer-aviso-min').value, 10) || 5);
    timerConfig = {
      autoIniciar: document.getElementById('cfg-timer-auto').checked,
      direcao: document.getElementById('cfg-timer-direcao').value === 'decrescente' ? 'decrescente' : 'crescente',
      duracaoMinutos: duracao,
      avisoMinutosAntes: avisoMin,
      avisarCliente: document.getElementById('cfg-timer-avisar-cliente').checked,
      avisoSonoro: document.getElementById('cfg-timer-som').checked
    };
    // Reflete o valor normalizado de volta nos campos (ex.: "0" virou "40").
    renderTimerConfigToUI();
    // Se o atendimento aberto agora já estiver contando, atualiza o mostrador
    // na hora — sem isso o novo limite/sentido só apareceria na próxima conversa.
    updateTimerUI();
    if (statusMsg) { statusMsg.textContent = 'Salvando...'; statusMsg.style.color = 'var(--color-text-secondary)'; }
    try {
      const res = await fetch(API_BASE + '/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timer_config: timerConfig })
      });
      if (!res.ok) throw new Error('falha ao salvar');
      if (statusMsg) { statusMsg.textContent = 'Salvo.'; statusMsg.style.color = '#2ECC71'; }
      showToast('Configuração do cronômetro salva.');
    } catch (e) {
      if (statusMsg) { statusMsg.textContent = 'Erro ao salvar.'; statusMsg.style.color = 'var(--color-erro)'; }
      showToast('Não foi possível salvar a configuração do cronômetro.');
    }
  });
}

async function carregarWorkspacePersistente() {
  try {
    const res = await fetch(API_BASE + '/api/config');
    if (!res.ok) throw new Error('config_indisponivel');
    const cfg = await res.json();
    ocTarefas = configArray(cfg.tarefas);
    contadorProfile = { ...DEFAULT_PROFILE, ...configObject(cfg.perfil_contador, {}) };
    iaSkills = configArray(cfg.ia_skills);
    kanbanEtapas = configObject(cfg.kanban_etapas, {});
    agendaDisponibilidade = configArray(cfg.agenda_disponibilidade);
    if (!agendaDisponibilidade.length) agendaDisponibilidade = [...DEFAULT_AGENDA_SLOTS];
    agendaDiasBloqueados = configArray(cfg.agenda_dias_bloqueados).filter(Boolean).sort();
    notaFiscalConfig = { ...notaFiscalConfig, ...configObject(cfg.nota_fiscal_config, {}) };
    renderNotaFiscalConfigToUI();
    timerConfig = { ...timerConfig, ...configObject(cfg.timer_config, {}) };
    renderTimerConfigToUI();
    radarFiscalConfig = normalizarRadarFiscalConfig(cfg.radar_fiscal_config);
    radarFiscalClientes = configObject(cfg.radar_fiscal_clientes, {});
    renderRadarFiscalConfigToUI();
    renderRadarInternoClientes();
    renderTarefas();
    renderProfileToUI(contadorProfile);
    renderSkillsTable();
    updateSkillSelector();
    renderDisponibilidadeAgenda();
    renderDiasBloqueados();
    renderCRM();
    renderKanban();
    updateDashboardData();
  } catch (e) {
    console.warn('Não consegui carregar as preferências compartilhadas:', e);
    agendaDisponibilidade = [...DEFAULT_AGENDA_SLOTS];
    renderDisponibilidadeAgenda();
    updateDashboardData();
  }
}

let contadorUnreadCount = 0;
let originalTitle = document.title;

function incrementContadorBadge() {
  contadorUnreadCount++;
  const badge = document.getElementById('badge-atendimentos-contador');
  if (badge) {
    badge.textContent = contadorUnreadCount;
    badge.style.display = 'block';
  }
  document.title = `(${contadorUnreadCount}) Nova mensagem - Olá, Contador`;
}

function clearContadorBadge() {
  contadorUnreadCount = 0;
  const badge = document.getElementById('badge-atendimentos-contador');
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
  document.title = originalTitle;
}

// ==========================================
// PROFILE EDITING LOGIC
// ==========================================

const DEFAULT_PROFILE = {
  name: "Filipe Heck",
  crc: "CRC/RS 123456/O",
  tags: "MEI, Imposto de Renda, Malha Fina",
  bio: "Sou especialista em atendimento a pequenos e médios empreendedores. Com mais de 10 anos de atuação na área contábil, meu foco é traduzir a burocracia do Leão em linguagem simples e resultados reais para os clientes, sempre focando na economia legal e otimização fiscal.",
  education: "Bacharelado em Ciências Contábeis - UFRGS (2015)\nPós-graduação em Direito Tributário (2018)",
  logoDataUrl: "",
  assinaturaDataUrl: ""
};

// Lê a imagem escolhida como data URI (guardado direto no JSON do perfil,
// mesmo padrão de outras imagens pequenas do app — sem precisar de Storage).
function lerImagemComoDataUrl(input) {
  return new Promise((resolve, reject) => {
    const file = input.files && input.files[0];
    if (!file) return resolve(null);
    if (file.size > 1024 * 1024) { showToast('Imagem muito grande (máx. 1MB).'); return reject(new Error('too_large')); }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function atualizarPreviaImagemPerfil(url, imgId, btnRemoverId) {
  const img = document.getElementById(imgId);
  const btn = document.getElementById(btnRemoverId);
  if (!img) return;
  if (url) { img.src = url; img.style.display = 'inline-block'; if (btn) btn.style.display = 'inline-flex'; }
  else { img.src = ''; img.style.display = 'none'; if (btn) btn.style.display = 'none'; }
}
let contadorProfile = DEFAULT_PROFILE;

function loadProfileData() {
  return contadorProfile;
}

function renderProfileToUI(profile) {
  // Update name and CRC
  const headerInfo = document.querySelector('#section-perfil .profile-info');
  if (!headerInfo) return;
  
  headerInfo.querySelector('h2').innerHTML = `${profile.name} <i class="fa-solid fa-circle-check" style="color:var(--color-coral); font-size:16px;" title="Contador Verificado"></i>`;
  headerInfo.querySelector('p').innerHTML = `<i class="fa-solid fa-id-card"></i> ${profile.crc}`;

  const headerName = document.querySelector('#header-agent-profile .agent-info h4');
  const headerAvatar = document.querySelector('#header-agent-profile .agent-avatar');
  if (headerName) headerName.textContent = profile.name || 'Contador';
  if (headerAvatar) headerAvatar.textContent = initials(profile.name || 'Contador');
  
  // Update tags
  const tagsContainer = headerInfo.querySelector('div');
  tagsContainer.innerHTML = '';
  const tags = profile.tags.split(',').map(t => t.trim()).filter(Boolean);
  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'specialty-tag';
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });

  // Update bio
  const bioEl = document.querySelector('#section-perfil p[style*="line-height:1.6"]');
  if (bioEl) bioEl.textContent = profile.bio;

  // Update education
  const eduUl = document.getElementById('profile-education');
  if (eduUl) {
    eduUl.innerHTML = '';
    const lines = profile.education.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const li = document.createElement('li');
      li.innerHTML = `<i class="fa-solid fa-graduation-cap" style="color:var(--color-coral); width:24px;"></i> ${line}`;
      eduUl.appendChild(li);
    });
  }
}

// Override openModal specifically for the profile modal to prepopulate it
let perfilLogoPendente, perfilAssinaturaPendente; // null=remover, undefined=manter, string=nova

const originalOpenModal = window.openModal;
window.openModal = function(id) {
  if (id === 'modal-editar-perfil') {
    const profile = loadProfileData();
    document.getElementById('edit-profile-name').value = profile.name;
    document.getElementById('edit-profile-crc').value = profile.crc;
    document.getElementById('edit-profile-tags').value = profile.tags;
    document.getElementById('edit-profile-bio').value = profile.bio;
    document.getElementById('edit-profile-education').value = profile.education;
    perfilLogoPendente = undefined;
    perfilAssinaturaPendente = undefined;
    document.getElementById('edit-profile-logo').value = '';
    document.getElementById('edit-profile-assinatura').value = '';
    atualizarPreviaImagemPerfil(profile.logoDataUrl, 'preview-profile-logo', 'btn-remover-logo');
    atualizarPreviaImagemPerfil(profile.assinaturaDataUrl, 'preview-profile-assinatura', 'btn-remover-assinatura');
  }
  if (originalOpenModal) originalOpenModal(id);
};

document.addEventListener('DOMContentLoaded', () => {
  const inputLogo = document.getElementById('edit-profile-logo');
  const inputAssinatura = document.getElementById('edit-profile-assinatura');
  if (inputLogo) inputLogo.addEventListener('change', async () => {
    const url = await lerImagemComoDataUrl(inputLogo).catch(() => null);
    if (url) { perfilLogoPendente = url; atualizarPreviaImagemPerfil(url, 'preview-profile-logo', 'btn-remover-logo'); }
  });
  if (inputAssinatura) inputAssinatura.addEventListener('change', async () => {
    const url = await lerImagemComoDataUrl(inputAssinatura).catch(() => null);
    if (url) { perfilAssinaturaPendente = url; atualizarPreviaImagemPerfil(url, 'preview-profile-assinatura', 'btn-remover-assinatura'); }
  });
  const btnRemLogo = document.getElementById('btn-remover-logo');
  if (btnRemLogo) btnRemLogo.addEventListener('click', () => {
    perfilLogoPendente = null; inputLogo.value = '';
    atualizarPreviaImagemPerfil('', 'preview-profile-logo', 'btn-remover-logo');
  });
  const btnRemAssinatura = document.getElementById('btn-remover-assinatura');
  if (btnRemAssinatura) btnRemAssinatura.addEventListener('click', () => {
    perfilAssinaturaPendente = null; inputAssinatura.value = '';
    atualizarPreviaImagemPerfil('', 'preview-profile-assinatura', 'btn-remover-assinatura');
  });
});

window.saveProfileData = async function() {
  const profile = {
    name: document.getElementById('edit-profile-name').value.trim(),
    crc: document.getElementById('edit-profile-crc').value.trim(),
    tags: document.getElementById('edit-profile-tags').value.trim(),
    bio: document.getElementById('edit-profile-bio').value.trim(),
    education: document.getElementById('edit-profile-education').value.trim(),
    logoDataUrl: perfilLogoPendente === null ? '' : (perfilLogoPendente || contadorProfile.logoDataUrl || ''),
    assinaturaDataUrl: perfilAssinaturaPendente === null ? '' : (perfilAssinaturaPendente || contadorProfile.assinaturaDataUrl || '')
  };

  const res = await fetch(API_BASE + '/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil_contador: profile }) });
  if (!res.ok) { showToast('Não foi possível salvar o perfil.'); return; }
  contadorProfile = profile;
  PERFIL_PAINEL = profile; // o relatório usa esse cache; sem isso só pegaria a marca nova depois de recarregar a página
  renderProfileToUI(profile);
  closeModal('modal-editar-perfil');
  showToast('Perfil atualizado com sucesso!');
};

// ============================================================================
// BASES DE CONHECIMENTO (SKILLS IA)
// ============================================================================
let iaSkills = [];

async function saveSkills() {
  const res = await fetch(API_BASE + '/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ia_skills: iaSkills }) });
  if (!res.ok) { showToast('Não foi possível salvar a skill.'); return; }
  renderSkillsTable();
  updateSkillSelector();
}

function renderSkillsTable() {
  const tbody = document.getElementById('skills-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (iaSkills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-text-secondary);">Nenhuma skill cadastrada.</td></tr>';
    return;
  }
  
  iaSkills.forEach(skill => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 500; color: var(--color-pine);">${skill.name}</td>
      <td style="color: var(--color-text-secondary); font-size: 13px;">${skill.desc}</td>
      <td>${skill.tema ? `<span style="background: var(--color-pine-ultra-light); color: var(--color-pine); padding: 2px 6px; border-radius: 4px; font-size: 11px;">Auto: ${skill.tema}</span>` : '<span style="color: var(--color-text-secondary); font-size: 11px;">Manual</span>'}</td>
      <td>
        <button class="btn-utility" style="padding: 4px 8px; font-size: 11px;" onclick="editSkill('${skill.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-utility" style="padding: 4px 8px; font-size: 11px; color: var(--color-coral);" onclick="deleteSkill('${skill.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateSkillSelector() {
  const select = document.getElementById('active-skill-selector');
  if (!select) return;
  select.innerHTML = '<option value="">Sem skill ativa — resposta padrão</option>';
  iaSkills.forEach(skill => {
    const opt = document.createElement('option');
    opt.value = skill.id;
    opt.textContent = 'Skill: ' + skill.name + (skill.tema ? ' (auto: ' + skill.tema + ')' : '');
    select.appendChild(opt);
  });
}

// Acha a skill marcada pra ativar sozinha quando o tema bate com o do atendimento.
// taxType é texto livre (ex.: "Malha Fina IR2025"), não bate exato com o tema
// cadastrado na skill ("Malha Fina") — por isso comparamos por trecho.
function skillPorTema(taxType) {
  if (!taxType) return null;
  const alvo = taxType.toLowerCase();
  return iaSkills.find(s => s.tema && alvo.includes(s.tema.toLowerCase())) || null;
}

window.openSkillModal = function() {
  document.getElementById('skill-id').value = '';
  document.getElementById('form-skill').reset();
  openModal('modal-skill-overlay');
}

window.editSkill = function(id) {
  const skill = iaSkills.find(s => s.id === id);
  if (!skill) return;
  document.getElementById('skill-id').value = skill.id;
  document.getElementById('skill-name').value = skill.name;
  document.getElementById('skill-desc').value = skill.desc;
  document.getElementById('skill-content').value = skill.content;
  document.getElementById('skill-tema').value = skill.tema || '';
  openModal('modal-skill-overlay');
}

window.deleteSkill = function(id) {
  if (confirm('Tem certeza que deseja apagar esta Skill?')) {
    iaSkills = iaSkills.filter(s => s.id !== id);
    saveSkills();
  }
}

const formSkill = document.getElementById('form-skill');
if (formSkill) {
  formSkill.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = formSkill.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const id = document.getElementById('skill-id').value;
    const name = document.getElementById('skill-name').value;
    const desc = document.getElementById('skill-desc').value;
    const content = document.getElementById('skill-content').value;
    const tema = document.getElementById('skill-tema').value;
    const fileInput = document.getElementById('skill-pdf');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    if (id) {
      const skill = iaSkills.find(s => s.id === id);
      if (skill) {
        skill.name = name; skill.desc = desc; skill.content = content; skill.tema = tema;
      }
    } else {
      iaSkills.push({ id: Date.now().toString(), name, desc, content, tema });
    }
    
    await saveSkills();

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vetorizando PDF (Isso pode demorar)...';
      try {
        const base64 = await lerImagemComoDataUrl(fileInput); // Lê o arquivo como base64 (funciona pra PDF também)
        const res = await fetch(API_BASE + '/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'skill_upload', skillName: name, base64 })
        });
        
        if (res.status === 503) {
          showToast('OPENAI_API_KEY não configurada. Arquivo não vetorizado.');
        } else if (!res.ok) {
          showToast('Erro ao processar PDF da Skill.');
        } else {
          const data = await res.json();
          showToast(`PDF vetorizado com sucesso! ${data.chunksProcessed} blocos salvos.`);
        }
      } catch (err) {
        console.error(err);
        showToast('Falha no upload do PDF.');
      }
    }

    btn.disabled = false;
    btn.innerHTML = originalText;
    closeModal('modal-skill-overlay');
  });
}

// Abre o painel do Copiloto direto na aba "copilot" (sem fechar se já tiver
// aberta nela) — usado quando a IA precisa mostrar o raciocínio dela ali.
function abrirPainelCopiloto() {
  const sidePanelLeft = document.getElementById('side-panel-left');
  if (!sidePanelLeft) return;
  sidePanelLeft.classList.remove('collapsed');
  document.querySelectorAll('.btn-toolbar').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('btn-tool-copilot');
  if (activeBtn) activeBtn.classList.add('active');
  document.querySelectorAll('.side-panel-content').forEach(c => c.classList.remove('active'));
  const targetContent = document.getElementById('panel-content-copilot');
  if (targetContent) targetContent.classList.add('active');
  sidePanelLeft.dataset.panel = 'copilot';
}

// Botão "Olá" dentro do chat — a IA assume a leitura do atendimento e sugere
// a próxima resposta, sempre em modo supervisionado: o texto vai pro campo de
// mensagem pra eu revisar/editar, nunca é enviado sozinho. O raciocínio dela
// (a mesma resposta) também aparece no painel do Copiloto, que abre pra isso.
window.triggerInlineCopilot = async function() {
  if (!activeClientId || !clientsData[activeClientId]) return;
  const input = document.getElementById('message-input');
  const btn = document.getElementById('btn-inline-ai');
  if (btn) btn.disabled = true;
  const placeholderOriginal = input.placeholder;
  input.placeholder = 'A IA está lendo o atendimento...';

  abrirPainelCopiloto();
  const chat = document.getElementById('copilot-chat');
  const aiDiv = document.createElement('div');
  aiDiv.style.display = 'flex'; aiDiv.style.gap = '12px'; aiDiv.style.maxWidth = '90%';
  aiDiv.innerHTML = `
    <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-pine); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg viewBox="0 0 616 640" style="width: 15px; height: 15px;"><use href="#oc-logo-mark"></use></svg></div>
    <div class="copilot-msg-bubble"><i class="fa-solid fa-spinner fa-spin"></i> Assumindo o atendimento — lendo a conversa e preparando uma sugestão de resposta...</div>`;
  if (chat) { chat.appendChild(aiDiv); chat.scrollTop = chat.scrollHeight; }
  const bubble = aiDiv.querySelector('.copilot-msg-bubble');

  const skillSelect = document.getElementById('active-skill-selector');
  const skillAtiva = skillSelect && skillSelect.value ? iaSkills.find(s => s.id === skillSelect.value) : null;

  try {
    const res = await fetch(API_BASE + '/api/copilot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: activeClientId, mode: 'pergunta',
        prompt: 'Assuma o atendimento agora: com base em toda a conversa até aqui, escreva a próxima resposta que devo enviar ao cliente. Responda só com o texto pronto pra eu revisar e enviar — sem explicações, sem aspas.',
        skill: skillAtiva ? { name: skillAtiva.name, content: skillAtiva.content } : null
      })
    });
    if (res.status === 503) {
      if (bubble) bubble.innerHTML = 'IA ainda não configurada. Adicione a <strong>OPENROUTER_API_KEY</strong> no .env do servidor.';
      return;
    }
    if (!res.ok) {
      if (bubble) bubble.textContent = 'Não consegui gerar a sugestão agora. Tente de novo.';
      return;
    }
    const data = await res.json();
    const sugestao = (data.text || '').trim();
    if (bubble) bubble.innerHTML = 'Sugestão enviada pro campo de mensagem — revise antes de enviar:<br><em>' + safe(sugestao).replace(/\n/g, '<br>') + '</em>';
    input.value = sugestao;
    input.style.border = '1px solid var(--color-coral)';
    input.style.backgroundColor = '#FFF6F6';
    setTimeout(() => { input.style.border = ''; input.style.backgroundColor = ''; }, 2000);
  } catch (e) {
    if (bubble) bubble.textContent = 'Falha de conexão com o assistente.';
  } finally {
    input.placeholder = placeholderOriginal;
    if (btn) btn.disabled = false;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
}

// Initialize profile on load
document.addEventListener("DOMContentLoaded", () => {
  renderProfileToUI(loadProfileData());
  renderSkillsTable();
  updateSkillSelector();
  renderShortcuts();
});

// ==========================================
// CHAT CONFIGURATIONS (Shortcuts & Colors)
// ==========================================

const defaultShortcuts = [
  { id: '1', action: 'reply', text: '/boasvindas', label: '/boasvindas', icon: 'fa-hand-holding-hand' },
  { id: '2', action: 'reply', text: '/doc-malha', label: '/doc-malha', icon: 'fa-file-invoice' },
  { id: '3', action: 'reply', text: '/honorarios', label: '/honorarios', icon: 'fa-dollar-sign' },
  { id: '4', action: 'doc', text: 'CPF e RG', label: 'Pedir CPF/RG', icon: 'fa-id-card' },
  { id: '5', action: 'doc', text: 'Notificação da Receita', label: 'Pedir Notificação', icon: 'fa-triangle-exclamation' }
];

let chatShortcuts = JSON.parse(localStorage.getItem('chatShortcuts')) || defaultShortcuts;

function saveShortcuts() {
  localStorage.setItem('chatShortcuts', JSON.stringify(chatShortcuts));
  renderShortcuts();
}

function renderShortcuts() {
  const container = document.getElementById('chat-shortcuts-container');
  const cfgList = document.getElementById('cfg-shortcuts-list');
  
  if (container) {
    container.innerHTML = '';
    chatShortcuts.forEach(sc => {
      const btn = document.createElement('button');
      btn.className = 'btn-shortcut-tag';
      if (sc.action === 'doc') {
        btn.setAttribute('data-action', 'doc');
        btn.setAttribute('data-doc', sc.text);
      } else {
        btn.setAttribute('data-action', 'reply');
        btn.setAttribute('data-text', sc.text);
      }
      btn.innerHTML = `<i class="fa-solid ${sc.icon}"></i> ${sc.label}`;
      
      btn.addEventListener("click", () => {
        if (sc.action === 'doc') {
          sendDocumentRequest(sc.text);
        } else {
          // If the text matches a canned response key, replace [VALOR], otherwise just insert text.
          const client = clientsData[activeClientId];
          let cannedText = cannedResponses[sc.text] || sc.text;
          if (client && client.honorarios) {
             // O template já escreve "R$ [VALOR]" — repetir o R$ aqui gerava
             // "R$ R$ 150,00" na mensagem enviada ao cliente.
             cannedText = cannedText.replace("[VALOR]", `${client.honorarios},00`);
          }
          document.getElementById("message-input").value = cannedText;
          document.getElementById("message-input").focus();
        }
      });
      
      container.appendChild(btn);
    });
    
    // Add default audio button
    const audioBtn = document.createElement('button');
    audioBtn.className = 'btn-shortcut-tag';
    audioBtn.id = 'btn-send-audio-shortcut';
    audioBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Enviar Áudio';
    audioBtn.addEventListener("click", () => sendAudioMessage("agent", "0:45"));
    container.appendChild(audioBtn);
  }
  
  if (cfgList) {
    cfgList.innerHTML = '';
    chatShortcuts.forEach(sc => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.style.padding = '8px 12px';
      div.style.background = 'white';
      div.style.border = '1px solid var(--color-border)';
      div.style.borderRadius = '6px';
      div.innerHTML = `
        <div style="font-size: 12px; color: var(--color-pine);">
          <i class="fa-solid ${sc.icon}" style="margin-right: 6px;"></i> 
          <strong>${sc.label}</strong> <span style="color: var(--color-text-secondary); margin-left: 8px;">(${sc.text})</span>
        </div>
        <button class="btn-utility" style="padding: 4px 8px; color: #E74C3C;" onclick="deleteShortcut('${sc.id}')"><i class="fa-solid fa-trash"></i></button>
      `;
      cfgList.appendChild(div);
    });
  }
}

window.deleteShortcut = function(id) {
  chatShortcuts = chatShortcuts.filter(sc => sc.id !== id);
  saveShortcuts();
};

document.addEventListener("DOMContentLoaded", () => {
  const btnAdd = document.getElementById('btn-add-shortcut');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const text = document.getElementById('new-shortcut-text').value;
      const label = document.getElementById('new-shortcut-label').value;
      const icon = document.getElementById('new-shortcut-icon').value || 'fa-bolt';
      
      if (!text || !label) return;
      
      chatShortcuts.push({
        id: Date.now().toString(),
        text,
        label,
        icon
      });
      
      document.getElementById('new-shortcut-text').value = '';
      document.getElementById('new-shortcut-label').value = '';
      document.getElementById('new-shortcut-icon').value = 'fa-bolt';
      
      saveShortcuts();
    });
  }
  
  // Setup Dark Mode
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  
  // Check localStorage for dark mode
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
  }
  
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      if (darkModeToggle.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
      }
    });
  }

  // Setup colors
  const defaultColors = {
    chatBg: '#FFFFFF',
    bubbleContador: '#164E37',
    bubbleCliente: '#F0EDE6',
    copilotBg: '#EAF1F6'
  };

  const savedColors = { ...defaultColors, ...(JSON.parse(localStorage.getItem('chatColors')) || {}) };

  function applyColors(colors) {
    document.documentElement.style.setProperty('--chat-bg-color', colors.chatBg);
    document.documentElement.style.setProperty('--chat-bubble-contador-bg', colors.bubbleContador);
    document.documentElement.style.setProperty('--chat-bubble-cliente-bg', colors.bubbleCliente);
    document.documentElement.style.setProperty('--copilot-bg-color', colors.copilotBg);
  }

  applyColors(savedColors);

  const inputBg = document.getElementById('cfg-color-chat-bg');
  const inputContador = document.getElementById('cfg-color-bubble-contador');
  const inputCliente = document.getElementById('cfg-color-bubble-cliente');
  const inputCopilot = document.getElementById('cfg-color-copilot-bg');

  if (inputBg) {
    inputBg.value = savedColors.chatBg;
    inputContador.value = savedColors.bubbleContador;
    inputCliente.value = savedColors.bubbleCliente;
    if (inputCopilot) inputCopilot.value = savedColors.copilotBg;

    function updateAndSaveColors() {
      const colors = {
        chatBg: inputBg.value,
        bubbleContador: inputContador.value,
        bubbleCliente: inputCliente.value,
        copilotBg: inputCopilot ? inputCopilot.value : savedColors.copilotBg
      };
      applyColors(colors);
      localStorage.setItem('chatColors', JSON.stringify(colors));
    }

    inputBg.addEventListener('input', updateAndSaveColors);
    inputContador.addEventListener('input', updateAndSaveColors);
    inputCliente.addEventListener('input', updateAndSaveColors);
    if (inputCopilot) inputCopilot.addEventListener('input', updateAndSaveColors);
  }
});

// ========== RADAR FISCAL (Integra Contador / Serpro) ==========
// CADA AÇÃO AQUI CUSTA DINHEIRO: o Integra Contador cobra por requisição. Por
// isso nada dispara sozinho ao abrir a aba — quem clica é a equipe, sabendo o
// que está gastando —, e o resultado fica guardado (serpro_resultados) pro
// cliente ver depois sem pagar de novo.
//
// A consulta "avulsa" por CPF/CNPJ digitado foi removida de propósito: sem um
// cliente vinculado não há como atribuir o custo nem saber se existe procuração
// — e uma consulta recusada por falta de procuração é cobrada igual.
async function tokenSessaoAtual() {
  const { data } = await sb.auth.getSession();
  return data && data.session ? data.session.access_token : '';
}

async function chamarRadar(acao, extra) {
  const res = await fetch('/api/radar-fiscal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await tokenSessaoAtual()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(Object.assign({ acao, clienteRef: activeClientId }, extra || {}))
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.detail || json.error || 'Falha na consulta');
    err.code = json.error;
    throw err;
  }
  return json;
}

async function chamarRadarInterno(acao, clienteRef, extra) {
  const res = await fetch('/api/radar-fiscal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await tokenSessaoAtual()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(Object.assign({ acao, clienteRef: clienteRef || undefined }, extra || {}))
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.detail || json.error || 'Falha na consulta');
    err.code = json.error;
    throw err;
  }
  return json;
}

function radarInternoStatus(id, conteudo) {
  const alvo = document.getElementById(id);
  if (alvo) alvo.innerHTML = conteudo;
}

function radarInternoCarregando(id, mensagem) {
  radarInternoStatus(id, `<p style="font-size:12.5px;color:var(--color-text-secondary);margin:0;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--color-coral)"></i> ${safe(mensagem)}</p>`);
}

function radarInternoErro(id, erro) {
  const orientacao = erro.code === 'sem_procuracao'
    ? 'A Receita recusou esta consulta. Confirme se a procuração eletrônica contempla este serviço.'
    : erro.message;
  radarInternoStatus(id, `<p style="font-size:12.5px;color:#C0392B;margin:0;line-height:1.5;"><i class="fa-solid fa-triangle-exclamation"></i> ${safe(orientacao)}</p>`);
}

async function radarInternoTestarConexao(botao) {
  const id = 'radar-interno-conexao-resultado';
  botao.disabled = true;
  radarInternoStatus(id, '<i class="fa-solid fa-circle-notch fa-spin"></i> Validando certificado e OAuth...');
  try {
    const capacidades = await chamarRadarInterno('capacidades');
    await chamarRadarInterno('testar-autenticacao', null, { documento: '00000000000' });
    radarInternoStatus(id, `<span style="color:#1F8A5B;"><i class="fa-solid fa-circle-check"></i> Integra Contador autenticado.</span>
      <span class="radar-capacidade ${capacidades.dividaAtiva ? 'ok' : 'pendente'}">Dívida Ativa: ${capacidades.dividaAtiva ? 'configurada' : 'aguardando contrato próprio'}</span>`);
  } catch (e) {
    radarInternoStatus(id, `<span style="color:#C0392B;"><i class="fa-solid fa-triangle-exclamation"></i> ${safe(e.message)}</span>`);
  } finally {
    botao.disabled = false;
  }
}

async function radarInternoCaixaPostal(botao, pagina = 1) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  const id = 'radar-interno-caixa-resultado';
  botao.disabled = true;
  radarInternoCarregando(id, 'Consultando somente a Caixa Postal...');
  try {
    const r = await chamarRadarInterno('caixa-postal', clienteRef, { pagina, forcar: pagina > 1 });
    const mensagens = r.mensagens || [];
    radarInternoStatus(id, `<div style="font-size:12.5px;line-height:1.5;">
      <p style="margin:0 0 8px;color:var(--color-pine);font-weight:700;">Página ${safe(r.pagina || pagina)} · ${mensagens.length} mensagem(ns) · ${r.naoLidas || 0} não lida(s) nesta página${r.cacheado ? ' · resultado salvo' : ''}</p>
      ${mensagens.length ? mensagens.map(m => `<div class="radar-item"><div><strong>${m.lida ? '' : '<i class="fa-solid fa-circle radar-nao-lida"></i> '}${safe(m.assunto)}</strong>${m.remetente ? `<br><span>${safe(m.remetente)}</span>` : ''}${m.data ? `<br><span>${safe(new Date(m.data).toLocaleString('pt-BR'))}</span>` : ''}</div>${m.isn ? `<button type="button" class="btn-utility" onclick="radarInternoDetalharMensagem(this,'${safe(m.isn)}')">Abrir</button>` : ''}</div>`).join('') : '<span style="color:var(--color-text-secondary)">Nenhuma mensagem encontrada nesta página.</span>'}
      <div class="radar-paginacao">${pagina > 1 ? `<button class="btn-utility" onclick="radarInternoCaixaPostal(this,${pagina - 1})">Página anterior</button>` : ''}${r.temProxima ? `<button class="btn-utility" onclick="radarInternoCaixaPostal(this,${pagina + 1})">Próxima página</button>` : ''}</div>
    </div>`);
  } catch (e) {
    radarInternoErro(id, e);
  } finally {
    botao.disabled = false;
  }
}

async function radarInternoDetalharMensagem(botao, isn) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  botao.disabled = true;
  try {
    const r = await chamarRadarInterno('mensagem-detalhe', clienteRef, { isn });
    const d = r.detalhe || {};
    const texto = d.conteudo || d.corpoMensagem || d.mensagem || d.texto || JSON.stringify(d, null, 2);
    const janela = window.open('', '_blank');
    if (janela) janela.document.write(`<meta charset="utf-8"><title>Mensagem da Caixa Postal</title><body style="font:14px/1.6 Arial;padding:28px;max-width:850px;margin:auto;white-space:pre-wrap">${safe(texto)}</body>`);
  } catch (e) {
    radarInternoErro('radar-interno-caixa-resultado', e);
  } finally { botao.disabled = false; }
}

async function radarInternoSituacaoFiscal(botao) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  const id = 'radar-interno-sitfis-resultado';
  botao.disabled = true;
  radarInternoCarregando(id, 'Solicitando o protocolo SITFIS...');
  try {
    const protocolo = await chamarRadarInterno('sitfis-solicitar', clienteRef);
    if (!protocolo.protocolo) throw new Error('A Receita não devolveu o protocolo do relatório.');
    if (protocolo.tempoEsperaMs > 0) {
      radarInternoCarregando(id, `Relatório em processamento. Aguardando ${Math.ceil(protocolo.tempoEsperaMs / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, protocolo.tempoEsperaMs));
    }
    radarInternoCarregando(id, 'Emitindo somente o relatório solicitado...');
    const r = await chamarRadarInterno('sitfis-emitir', clienteRef, { protocolo: protocolo.protocolo });
    if (!r.pdfBase64) {
      radarInternoStatus(id, '<p style="font-size:12.5px;color:var(--color-text-secondary);margin:0;">O relatório ainda não ficou pronto. Tente novamente em alguns instantes.</p>');
      return;
    }
    const documento = String(clientsData[clienteRef]?.cpf || '').replace(/\D/g, '');
    radarInternoStatus(id, `<a class="btn-utility primary" download="situacao-fiscal-${safe(documento)}.pdf" href="data:application/pdf;base64,${r.pdfBase64}"><i class="fa-solid fa-download"></i> Baixar relatório SITFIS</a>`);
  } catch (e) {
    radarInternoErro(id, e);
  } finally {
    botao.disabled = false;
  }
}

async function radarInternoParcelamentos(botao) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  const regime = document.getElementById('radar-interno-regime')?.value;
  if (!regime) {
    showToast('Selecione MEI ou Simples Nacional para consultar parcelamentos.');
    return;
  }
  const id = 'radar-interno-parcelamentos-resultado';
  botao.disabled = true;
  radarInternoCarregando(id, 'Consultando somente os parcelamentos do regime escolhido...');
  try {
    const forcar = !!document.getElementById('radar-interno-forcar')?.checked;
    const r = await chamarRadarInterno('parcelamentos', clienteRef, { regime, forcar });
    const blocos = (r.sistemas || []).map(s => {
      if (s.erro) return `<div style="padding:7px 0;border-top:1px solid var(--color-border);"><strong>${safe(s.sistema)}</strong>: consulta não concluída (${safe(s.erro)}).</div>`;
      const pedidos = s.pedidos || [];
      const parcelas = s.parcelas || [];
      return `<div style="padding:8px 0;border-top:1px solid var(--color-border);">
        <strong>${safe(s.sistema)}</strong>: ${pedidos.length} parcelamento(s)
        ${pedidos.map(p => `<div class="radar-item"><span>${safe(p.numero || 'Sem número')} · ${safe(p.situacao || 'Situação não informada')}${p.quantidadeParcelas ? ` · ${safe(p.quantidadeParcelas)} parcelas` : ''}${p.valorConsolidado ? ` · ${safe(String(p.valorConsolidado))}` : ''}</span>${p.numero ? `<button class="btn-utility" onclick="radarInternoDetalharParcelamento(this,'${safe(s.sistema)}','${safe(p.numero)}','${safe(r.regime)}')">Ver extrato</button>` : ''}</div>`).join('')}
        ${parcelas.length ? `<div style="margin-top:8px;">${parcelas.map(p => `<div class="radar-item"><span>Parcela ${safe(p.parcela || '—')} · ${safe(p.vencimento || 'vencimento não informado')}${p.valor ? ` · ${safe(String(p.valor))}` : ''}</span><button class="btn-utility" onclick="radarInternoEmitirDas(this,'${safe(s.sistema)}','${safe(p.parcela)}')"><i class="fa-solid fa-file-pdf"></i> Emitir DAS</button></div>`).join('')}</div>` : '<div style="margin-top:5px;color:var(--color-text-secondary);">Nenhuma parcela disponível para emissão agora.</div>'}
      </div>`;
    }).join('');
    radarInternoStatus(id, `<div style="font-size:12.5px;line-height:1.5;"><p style="margin:0 0 7px;color:var(--color-pine);font-weight:700;">Regime: ${safe(r.regime)}${r.cacheado ? ' · dados salvos reutilizados (sem nova consulta)' : ' · consulta atualizada agora'}</p>${blocos || '<span style="color:var(--color-text-secondary)">Nenhum resultado.</span>'}</div>`);
  } catch (e) {
    radarInternoErro(id, e);
  } finally {
    botao.disabled = false;
  }
}

async function radarInternoEmitirDas(botao, sistema, parcela) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  botao.disabled = true;
  const original = botao.innerHTML;
  botao.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Emitindo';
  try {
    const r = await chamarRadarInterno('emitir-das', clienteRef, { sistema, parcela });
    if (!r.pdfBase64) throw new Error('A Receita não devolveu o PDF da guia.');
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${r.pdfBase64}`;
    link.download = `das-${parcela}.pdf`;
    link.click();
  } catch (e) { radarInternoErro('radar-interno-parcelamentos-resultado', e); }
  finally { botao.disabled = false; botao.innerHTML = original; }
}

async function radarInternoDetalharParcelamento(botao, sistema, numeroParcelamento, regime) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  botao.disabled = true;
  try {
    const r = await chamarRadarInterno('parcelamento-detalhe', clienteRef, { sistema, numeroParcelamento, regime });
    const texto = JSON.stringify(r.detalhe || {}, null, 2);
    const janela = window.open('', '_blank');
    if (janela) janela.document.write(`<meta charset="utf-8"><title>Extrato do parcelamento</title><body style="font:14px/1.6 Arial;padding:28px;max-width:900px;margin:auto"><h2>Parcelamento ${safe(numeroParcelamento)}</h2><pre style="white-space:pre-wrap">${safe(texto)}</pre></body>`);
  } catch (e) { radarInternoErro('radar-interno-parcelamentos-resultado', e); }
  finally { botao.disabled = false; }
}

function radarValor(valor) {
  if (valor === null || typeof valor === 'undefined' || valor === '') return 'Valor não informado';
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return String(valor).includes('R$') ? String(valor) : `R$ ${String(valor)}`;
}

async function radarInternoDividaAtiva(botao) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  const id = 'radar-interno-divida-ativa-resultado';
  botao.disabled = true;
  radarInternoCarregando(id, 'Consultando inscrições na Dívida Ativa da União...');
  try {
    const forcar = !!document.getElementById('radar-interno-divida-forcar')?.checked;
    const r = await chamarRadarInterno('divida-ativa', clienteRef, { forcar });
    const itens = r.inscricoes || [];
    radarInternoStatus(id, `<div class="radar-resumo"><strong>${itens.length} inscrição(ões) encontrada(s)</strong>${r.cacheado ? '<span>Dados salvos nas últimas 24 horas.</span>' : '<span>Consulta atualizada agora.</span>'}</div>
      ${itens.length ? itens.map(item => `<div class="radar-item"><div><strong>${safe(item.numeroInscricao || 'Inscrição sem número')}</strong><br><span>${safe(item.situacao || 'Situação não informada')} · ${safe(radarValor(item.valorConsolidado))}${item.numeroProcesso ? ` · Processo ${safe(item.numeroProcesso)}` : ''}</span></div>${item.numeroInscricao ? `<button class="btn-utility" onclick="radarInternoDetalharDivida(this,'${safe(item.numeroInscricao)}')">Ver detalhes</button>` : ''}</div>`).join('') : '<p class="radar-vazio">Nenhuma inscrição retornada para este CPF/CNPJ.</p>'}`);
  } catch (e) { radarInternoErro(id, e); }
  finally { botao.disabled = false; }
}

async function radarInternoDetalharDivida(botao, numeroInscricao) {
  const clienteRef = clienteRadarInternoSelecionado();
  if (!clienteRef) return;
  botao.disabled = true;
  try {
    const r = await chamarRadarInterno('divida-ativa-detalhe', clienteRef, { numeroInscricao });
    const d = r.inscricao || {};
    alert(`Inscrição: ${d.numeroInscricao || numeroInscricao}\nSituação: ${d.situacao || 'Não informada'}\nValor: ${radarValor(d.valorConsolidado)}\nReceita: ${d.receita || 'Não informada'}\nÓrgão de origem: ${d.orgaoOrigem || 'Não informado'}\nProcesso judicial: ${d.processoJudicial || 'Não informado'}`);
  } catch (e) { radarInternoErro('radar-interno-divida-ativa-resultado', e); }
  finally { botao.disabled = false; }
}

function radarCarregando(msg) {
  const c = document.getElementById('dossier-radar-content');
  if (c) c.innerHTML = `<div style="text-align:center;padding:24px;">
    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:24px;color:var(--color-coral);margin-bottom:12px;"></i>
    <p style="font-size:14px;color:var(--color-text-secondary);">${safe(msg)}</p></div>`;
}

function radarErro(e) {
  const c = document.getElementById('dossier-radar-content');
  if (!c) return;
  // Falta de procuração não é defeito do sistema: é uma etapa que o
  // contribuinte precisa cumprir no e-CAC. Merece instrução, não "erro".
  if (e.code === 'sem_procuracao') {
    c.innerHTML = `<div style="text-align:left;padding:20px;background:#FFF7ED;border:1px solid rgba(255,103,0,0.25);border-radius:12px;">
      <h4 style="margin:0 0 8px 0;color:var(--color-pine);font-size:15px;"><i class="fa-solid fa-file-signature" style="color:var(--color-coral);"></i> Falta procuração eletrônica</h4>
      <p style="font-size:13px;color:var(--color-text-secondary);margin:0;line-height:1.6;">
        A Receita recusou a consulta porque este contribuinte ainda não outorgou procuração eletrônica ao nosso CNPJ no e-CAC.
        Oriente o cliente a fazer isso em <strong>e-CAC &rsaquo; Senhas e Procurações &rsaquo; Procuração Eletrônica</strong> antes de tentar de novo.
      </p></div>`;
    return;
  }
  c.innerHTML = `<div style="color:#E74C3C;text-align:center;padding:24px;">
    <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;margin-bottom:12px;"></i>
    <p style="font-size:14px;">${safe(e.message)}</p></div>`;
}

function radarClienteValido() {
  if (!activeClientId) return false;
  const c = clientsData[activeClientId];
  if (!c || !c.cpf) {
    showToast('Cliente não possui CPF/CNPJ cadastrado para consulta.');
    return false;
  }
  return true;
}

// ---- 1. Caixa Postal ------------------------------------------------------
async function radarCaixaPostal() {
  if (!radarClienteValido()) return;
  radarCarregando('Consultando a Caixa Postal do e-CAC...');
  try {
    const r = await chamarRadar('caixa-postal');
    const msgs = r.mensagens || [];
    const c = document.getElementById('dossier-radar-content');
    c.innerHTML = `<div style="text-align:left;">
      <h4 style="font-size:14px;margin:0 0 12px 0;color:var(--color-pine);">
        <i class="fa-solid fa-envelope-open-text"></i> Caixa Postal — ${msgs.length} mensagem(ns), ${r.naoLidas || 0} não lida(s)
      </h4>
      ${msgs.length ? msgs.map(m => `
        <div style="font-size:13px;padding:10px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;gap:12px;">
          <span>${safe(m.assunto)}</span>
          <span style="color:var(--color-text-secondary);white-space:nowrap;">${m.data ? new Date(m.data).toLocaleDateString('pt-BR') : ''}</span>
        </div>`).join('')
        : '<p style="font-size:13px;color:var(--color-text-secondary);">Sem mensagens na caixa postal.</p>'}
    </div>`;
  } catch (e) { radarErro(e); }
}

// ---- 2. Situação fiscal (SITFIS) -----------------------------------------
// Duas etapas: protocolo e depois o relatório em PDF. Entre elas a API pede um
// tempo de espera — respeitar isso evita gastar a requisição de emissão à toa.
async function radarSituacaoFiscal() {
  if (!radarClienteValido()) return;
  radarCarregando('Solicitando protocolo da situação fiscal...');
  try {
    const p = await chamarRadar('sitfis-solicitar');
    if (!p.protocolo) throw new Error('A Receita não devolveu um protocolo.');

    if (p.tempoEsperaMs > 0) {
      radarCarregando(`Relatório sendo gerado pela Receita. Aguardando ${Math.ceil(p.tempoEsperaMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, p.tempoEsperaMs));
    }

    radarCarregando('Emitindo o relatório de situação fiscal...');
    const r = await chamarRadar('sitfis-emitir', { protocolo: p.protocolo });

    const c = document.getElementById('dossier-radar-content');
    if (!r.pdfBase64) {
      c.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);padding:20px;">
        O relatório ainda não ficou pronto na Receita. Tente novamente em alguns instantes.</p>`;
      return;
    }
    // O relatório é um PDF oficial. Ele é entregue como documento, sem
    // interpretação nossa — não afirmamos "regular" ou "com pendência" a
    // partir dele; quem lê é o contador.
    c.innerHTML = `<div style="text-align:left;padding:8px;">
      <h4 style="font-size:14px;margin:0 0 10px 0;color:var(--color-pine);"><i class="fa-solid fa-file-pdf" style="color:#C0392B;"></i> Relatório de Situação Fiscal</h4>
      <p style="font-size:13px;color:var(--color-text-secondary);margin:0 0 14px 0;">Emitido agora pela Receita Federal.</p>
      <a class="btn-utility primary" download="situacao-fiscal.pdf"
         href="data:application/pdf;base64,${r.pdfBase64}">
        <i class="fa-solid fa-download"></i> Baixar relatório
      </a></div>`;
  } catch (e) { radarErro(e); }
}

// ---- 3. Parcelamentos ------------------------------------------------------
// Descobre o regime uma vez (fica gravado), lista os parcelamentos e as
// parcelas prontas pra emissão. A emissão do DAS é um clique separado, porque
// é outra requisição paga.
async function radarParcelamentos() {
  if (!radarClienteValido()) return;
  radarCarregando('Verificando o regime do contribuinte...');
  try {
    await chamarRadar('regime');
    radarCarregando('Consultando parcelamentos...');
    const r = await chamarRadar('parcelamentos');

    const blocos = (r.sistemas || []).map(s => {
      if (s.erro === 'sem_procuracao') {
        return `<div style="padding:12px 0;border-bottom:1px solid #eee;font-size:13px;color:var(--color-text-secondary);">
          <strong>${safe(s.sistema)}</strong> — sem procuração para este serviço.</div>`;
      }
      if (!s.pedidos.length) {
        return `<div style="padding:12px 0;border-bottom:1px solid #eee;font-size:13px;color:var(--color-text-secondary);">
          <strong>${safe(s.sistema)}</strong> — nenhum parcelamento encontrado.</div>`;
      }
      const parcelas = (s.parcelas || []).map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;font-size:13px;">
          <span>Parcela ${safe(p.parcela)} · vence ${safe(p.vencimento || '—')}</span>
          <button class="btn-utility" onclick="radarEmitirDas('${safe(s.sistema)}','${safe(p.parcela)}')">
            <i class="fa-solid fa-file-invoice-dollar"></i> Emitir guia
          </button>
        </div>`).join('') || '<p style="font-size:13px;color:var(--color-text-secondary);">Nenhuma parcela disponível para emissão.</p>';

      return `<div style="padding:14px 0;border-bottom:1px solid #eee;">
        <h5 style="margin:0 0 8px 0;font-size:13.5px;color:var(--color-pine);">${safe(s.sistema)} — ${s.pedidos.length} parcelamento(s)</h5>
        ${parcelas}</div>`;
    }).join('');

    document.getElementById('dossier-radar-content').innerHTML =
      `<div style="text-align:left;">
        <p style="font-size:12.5px;color:var(--color-text-secondary);margin:0 0 8px 0;">Regime detectado: <strong>${safe(r.regime)}</strong></p>
        ${blocos}</div>`;
  } catch (e) { radarErro(e); }
}

async function radarEmitirDas(sistema, parcela) {
  radarCarregando('Emitindo a guia...');
  try {
    const r = await chamarRadar('emitir-das', { sistema, parcela });
    const c = document.getElementById('dossier-radar-content');
    if (!r.pdfBase64) { c.innerHTML = '<p style="padding:20px;font-size:13px;">A Receita não devolveu o PDF da guia.</p>'; return; }
    c.innerHTML = `<div style="text-align:left;padding:8px;">
      <h4 style="font-size:14px;margin:0 0 10px 0;color:var(--color-pine);"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--color-coral);"></i> Guia da parcela ${safe(parcela)}</h4>
      <a class="btn-utility primary" download="das-${safe(parcela)}.pdf" href="data:application/pdf;base64,${r.pdfBase64}">
        <i class="fa-solid fa-download"></i> Baixar guia
      </a>
      <button class="btn-utility" style="margin-left:8px;" onclick="radarParcelamentos()">Voltar aos parcelamentos</button>
    </div>`;
  } catch (e) { radarErro(e); }
}

window.radarCaixaPostal = radarCaixaPostal;
window.radarSituacaoFiscal = radarSituacaoFiscal;
window.radarParcelamentos = radarParcelamentos;
window.radarEmitirDas = radarEmitirDas;
window.radarInternoCaixaPostal = radarInternoCaixaPostal;
window.radarInternoDetalharMensagem = radarInternoDetalharMensagem;
window.radarInternoSituacaoFiscal = radarInternoSituacaoFiscal;
window.radarInternoParcelamentos = radarInternoParcelamentos;
window.radarInternoEmitirDas = radarInternoEmitirDas;
window.radarInternoDetalharParcelamento = radarInternoDetalharParcelamento;
window.radarInternoDividaAtiva = radarInternoDividaAtiva;
window.radarInternoDetalharDivida = radarInternoDetalharDivida;
window.radarInternoTestarConexao = radarInternoTestarConexao;


// ==== Kanban Drag & Drop Backend Sync ====
window.updateClientKanbanStatus = async function(clientId, status) {
  if (clientsData[clientId]) {
    clientsData[clientId].status = status;
    kanbanEtapas[clientId] = status;
    renderKanban();
  }
  if (window.sb) {
    try {
      await window.sb.from('clientes').update({ status }).eq('id', clientId);
      console.log('Kanban status updated in DB', clientId, status);
    } catch(e) {
      console.error('Error updating Kanban status', e);
    }
  }
};

// ==== Push Notifications (Browser) ====
if ("Notification" in window) {
  Notification.requestPermission();
}

window.notifyNewLead = function(clientName) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Novo Cliente na Triagem!", {
      body: `O cliente ${clientName} pagou o PIX e está aguardando atendimento.`,
      icon: "https://olacontador.com.br/favicon.ico"
    });
  }
};
