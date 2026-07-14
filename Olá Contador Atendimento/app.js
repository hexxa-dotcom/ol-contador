// Olá Contador Atendimento - Core Application Logic & API Client

// Dynamic API Base URL depending on whether page is opened via file:// or http://
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';

// Local variables synced with backend API
let activeClientId = "ana-silva";
let activeClientChatType = "internal"; // internal, doc_request
let socket = null;

let clientsData = {};
let notifications = [];
let appointments = [];

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
let currentScheduleFilter = "all";

// Chat Timer State
let chatTimerInterval = null;
let currentChatSeconds = 0;
let hasSent30MinWarning = false;
let hasSent35MinWarning = false;

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
  setupNavigation();
  setupEventListeners();
  setupCalculators();
  setupTimer();
  
  // Connect Socket.IO
  socket = io();
  socket.on('receive_chat_message', (data) => {
    if (clientsData[data.clientId]) {
      // Check if message already exists (to prevent dupes if we sent it via fetch)
      const exists = clientsData[data.clientId].messages.some(m => m.id === data.message.id);
      if (!exists) {
        clientsData[data.clientId].messages.push(data.message);
        if (activeClientId === data.clientId) {
          renderChatMessages();
          playPopSound();
        }
      }
    }
  });

  socket.on('doc_status_update', async (data) => {
    if (clientsData[data.clientId]) {
      await refreshAllData();
      if (activeClientId === data.clientId) {
        renderDossier(clientsData[activeClientId]);
        renderChatMessages();
      }
    }
  });
  
  // Initial loading from backend API
  await refreshAllData();
  loadClient(activeClientId);
});

// Load everything from the backend
async function refreshAllData() {
  try {
    const clientsRes = await fetch(API_BASE + '/api/clients');
    clientsData = await clientsRes.json();

    const appointmentsRes = await fetch(API_BASE + '/api/appointments');
    appointments = await appointmentsRes.json();

    const notificationsRes = await fetch(API_BASE + '/api/notifications');
    notifications = await notificationsRes.json();

    updateDashboardData();
    renderClientList();
    renderAppointments();
    renderNotificationsLog();
    updateNotificationBadge();
  } catch (e) {
    console.error("API Fetch Error:", e);
    showToast("Erro ao conectar com o servidor local.");
  }
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
      }
      
      document.getElementById("noti-dropdown").classList.remove("active");
    });
  });
}

// Update executive dashboard KPIs and timeline
function updateDashboardData() {
  let activeFeesSum = 0;
  Object.values(clientsData).forEach(c => {
    activeFeesSum += c.honorarios;
  });
  const totalFaturamento = 4120 + activeFeesSum;
  document.getElementById("kpi-faturamento").textContent = formatBRL(totalFaturamento);

  const completedCount = appointments.filter(a => a.status === "done").length;
  const todayApps = appointments.filter(a => a.date === "Hoje");
  document.getElementById("kpi-concluidos").textContent = `${completedCount} de ${todayApps.length}`;

  const pendingDocsCount = Object.values(clientsData).filter(c => c.status === "docs").length;
  document.getElementById("kpi-pendentes").textContent = `${pendingDocsCount} cliente${pendingDocsCount !== 1 ? 's' : ''}`;

  const timelineContainer = document.getElementById("dashboard-timeline");
  timelineContainer.innerHTML = "";

  document.getElementById("agenda-count-badge").textContent = `${todayApps.filter(a => a.status !== "done").length} pendentes`;

  if (todayApps.length === 0) {
    timelineContainer.innerHTML = `<p style="font-size: 13px; color: var(--color-text-secondary); text-align: center; padding: 20px 0;">Nenhuma atividade agendada para hoje.</p>`;
    return;
  }

  todayApps.sort((a,b) => a.time.localeCompare(b.time)).forEach(app => {
    const isActive = app.status === "active" ? "active" : "";
    
    let btnHtml = "";
    if (app.status === "pending" || app.status === "active") {
      btnHtml = `<button class="btn-doc-action" onclick="actionTimelineChat('${app.clientRef}')"><i class="fa-solid fa-comments"></i> Chat</button>`;
    } else {
      btnHtml = `<span style="font-size: 11px; color:#2ECC71; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Concluído</span>`;
    }

    const itemHtml = `
      <div class="timeline-item ${isActive}">
        <div class="timeline-badge">${app.time.split(":")[0]}h</div>
        <div class="timeline-content-card">
          <div class="timeline-content-info">
            <span class="timeline-time">${app.time}</span>
            <span class="timeline-title">${app.clientName}</span>
            <span class="timeline-desc">${app.taxType}</span>
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

  document.querySelectorAll(".btn-shortcut-tag").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "reply") {
        const textKey = btn.getAttribute("data-text");
        const client = clientsData[activeClientId];
        let cannedText = cannedResponses[textKey].replace("[VALOR]", `R$ ${client.honorarios},00`);
        document.getElementById("message-input").value = cannedText;
        document.getElementById("message-input").focus();
      } else if (action === "doc") {
        sendDocumentRequest(btn.getAttribute("data-doc"));
      }
    });
  });

  const toggleSound = document.getElementById("toggle-sound-enabled");
  if (toggleSound) {
    toggleSound.addEventListener("change", (e) => {
      isSoundEnabled = e.target.checked;
      if (isSoundEnabled) playSound("success");
    });
  }

  document.getElementById("btn-send-audio-shortcut").addEventListener("click", () => sendAudioMessage("agent", "0:45"));
  document.getElementById("btn-sim-reply").addEventListener("click", simulateClientMessage);
  document.getElementById("btn-sim-upload").addEventListener("click", simulateClientFileUpload);
  document.getElementById("btn-sim-voice").addEventListener("click", simulateClientAudioMessage);

  document.getElementById("prontuario-diagnostico").addEventListener("change", (e) => {
    updateProntuarioTagsAndTreatment(e.target.value);
  });

  document.getElementById("btn-generate-prontuario").addEventListener("click", generatePrescription);
  document.getElementById("btn-send-receita-chat").addEventListener("click", sharePrescriptionInChat);
  document.getElementById("btn-print-receita").addEventListener("click", () => window.print());

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
      const targetPane = document.getElementById(tab.getAttribute("data-tab"));
      if (targetPane) {
        targetPane.classList.add("active");
      }
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
function renderClientList(filter = "") {
  const container = document.getElementById("client-list-tab");
  container.innerHTML = "";
  
  let count = 0;
  
  // Convert object to array and sort by scheduledTime
  let sortedClients = Object.values(clientsData).sort((a, b) => {
    if (!a.scheduledTime) return 1;
    if (!b.scheduledTime) return -1;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });

  sortedClients.forEach((client, index) => {
    if (filter && !client.name.toLowerCase().includes(filter.toLowerCase())) {
      return;
    }
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

    const queueNumber = `${index + 1}º`;
    const schedTime = client.scheduledTime || "--:--";

    const itemHtml = `
      <div class="chat-item ${isActive}" onclick="loadClient('${client.id}')">
        <div class="chat-item-avatar">${client.avatar}</div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-item-name">${client.name}</span>
            <span class="chat-item-time" style="font-weight:700; color:var(--color-pine); background: var(--color-pine-ultra-light); padding: 2px 6px; border-radius:4px;"><i class="fa-regular fa-clock"></i> ${schedTime}</span>
          </div>
          <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom: 8px;">
            <span style="font-weight: 700; color: var(--color-coral); margin-right: 4px;">Fila: ${queueNumber}</span>
          </div>
          <div class="chat-item-footer">
            <span class="status-badge ${statusClass}">${statusText}</span>
            <span style="font-size: 10px; font-weight:600; color:var(--color-pine); border: 1px solid var(--color-pine-ultra-light); padding: 2px 6px; border-radius: 4px; background: white;">${client.taxType}</span>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", itemHtml);
  });

  document.getElementById("chat-count-tab").textContent = count;
}

// Load selected client in active pane
function loadClient(clientId) {
  activeClientId = clientId;
  const client = clientsData[clientId];

  resetChatTimer();

  if (client.status === "done") {
    disableChatInput();
  } else {
    enableChatInput();
    // Auto-start timer
    startChatTimer();
    const btnStart = document.getElementById("btn-start-timer");
    const btnStop = document.getElementById("btn-stop-timer");
    if(btnStart) btnStart.style.display = "none";
    if(btnStop) btnStop.style.display = "block";
  }

  document.querySelectorAll(".chat-item").forEach(item => item.classList.remove("active"));
  
  // Update header UI
  document.getElementById("active-client-avatar").textContent = client.avatar;
  document.getElementById("active-client-name").textContent = client.name;
  document.getElementById("active-client-tax-type").textContent = client.taxType;
  document.getElementById("prontuario-honorarios").value = client.honorarios;

  renderMessages();

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
}

// Render messages
function renderMessages() {
  const container = document.getElementById("chat-messages");
  container.innerHTML = "";
  
  const client = clientsData[activeClientId];
  client.messages.forEach(msg => {
    let bubbleClass = "received";
    if (msg.sender === "agent") bubbleClass = "sent";
    else if (msg.sender === "system") bubbleClass = "system";

    let messageBody = `<p>${msg.text}</p>`;

    if (msg.type === "doc-request") {
      messageBody = `
        <div class="message-card-doc">
          <div class="doc-info">
            <i class="fa-solid fa-file-arrow-up doc-icon"></i>
            <div>
              <span class="doc-title">Solicitação: ${msg.docName}</span>
              <p class="doc-subtitle">Aguardando o envio do comprovante pelo cliente</p>
            </div>
          </div>
          <button class="btn-doc-action" onclick="simulateUploadAction('${msg.docName}')">Enviar PDF</button>
        </div>
      `;
    } else if (msg.type === "doc-upload") {
      messageBody = `
        <div class="message-card-doc">
          <div class="doc-info">
            <i class="fa-solid fa-file-circle-check doc-icon" style="color: #2ECC71"></i>
            <div>
              <span class="doc-title">${msg.docName}</span>
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
          <p style="font-size: 13px; font-weight: 600; color: var(--color-pine); margin-bottom: 6px">${msg.diagnosis}</p>
          <p style="font-size: 12px; color: var(--color-text-primary); margin-bottom: 12px">Documento oficial de prontuário e orientações de pendência gerado pelo profissional responsável.</p>
          <div style="display: flex; gap: 8px;">
            <button class="btn-doc-action" onclick="openModal('modal-receita-overlay')"><i class="fa-solid fa-print"></i> Visualizar/Imprimir</button>
            <button class="btn-doc-action" onclick="showToast('Relatório baixado em formato PDF!')"><i class="fa-solid fa-file-pdf"></i> Baixar PDF</button>
          </div>
        </div>
      `;
    }

    const itemHtml = `
      <div class="message-bubble ${bubbleClass}">
        ${messageBody}
        <div class="message-meta">${msg.time}</div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", itemHtml);
  });
  
  container.scrollTop = container.scrollHeight;
}

// API Post message trigger
async function postMessageToBackend(message) {
  try {
    const res = await fetch(API_BASE + '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: activeClientId, message: message })
    });
    const updatedClient = await res.json();
    clientsData[activeClientId] = updatedClient;
    
    renderMessages();
    renderClientList();
    updateDashboardData();
  } catch (e) {
    showToast("Erro ao sincronizar mensagem com servidor.");
  }
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

// Generate Memed-Style Recipe / Prontuário modal
async function generatePrescription() {
  const client = clientsData[activeClientId];
  const diagnosis = document.getElementById("prontuario-diagnostico").value;
  const honorarios = document.getElementById("prontuario-honorarios").value;
  const treatment = document.getElementById("prontuario-tratamento").value;

  client.diagnosis = diagnosis;
  client.honorarios = parseInt(honorarios);
  client.treatment = treatment;

  await saveProntuarioChanges();

  document.getElementById("receita-patient-name").textContent = client.name;
  document.getElementById("receita-patient-cpf").textContent = client.cpf;
  document.getElementById("receita-val-diagnostico").textContent = diagnosis;

  const now = new Date();
  document.getElementById("receita-meta-date").textContent = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

  const evidencesContainer = document.getElementById("receita-val-evidencias");
  evidencesContainer.innerHTML = "";
  
  const selectedEvidences = client.evidences.filter(e => e.selected);
  if (selectedEvidences.length === 0) {
    evidencesContainer.insertAdjacentHTML("beforeend", `<li class="receita-list-item">Nenhuma evidência fiscal específica adicionada.</li>`);
  } else {
    selectedEvidences.forEach(e => {
      evidencesContainer.insertAdjacentHTML("beforeend", `<li class="receita-list-item">${e.text}</li>`);
    });
  }

  const treatmentContainer = document.getElementById("receita-val-tratamento");
  treatmentContainer.innerHTML = "";
  
  const treatmentLines = treatment.split("\n");
  treatmentLines.forEach(line => {
    if (line.trim()) {
      treatmentContainer.insertAdjacentHTML("beforeend", `<li class="receita-list-item">${line}</li>`);
    }
  });

  openModal("modal-receita-overlay");
}

// Share Recipe directly in chat
async function sharePrescriptionInChat() {
  const client = clientsData[activeClientId];
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  await postMessageToBackend({
    sender: "agent",
    text: `Compartilhado: Receita Fiscal de Regularização`,
    time: timeStr,
    type: "prescription-card",
    diagnosis: client.diagnosis
  });

  // Mark appointment as done
  await fetch(API_BASE + '/api/appointments/done', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientRef: client.id })
  });

  closeModal("modal-receita-overlay");
  await refreshAllData();
  loadClient(activeClientId);
  showToast("Receita fiscal compartilhada no chat.");
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
      <div class="noti-dropdown-item ${unreadClass}" onclick="actionClickNotification(${noti.id}, '${noti.clientRef}')">
        <div>
          <span class="noti-dropdown-desc">${noti.text}</span>
          <span class="noti-dropdown-time">${noti.time}</span>
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
      <div class="notification-log-card ${unreadClass}" onclick="actionClickNotification(${noti.id}, '${noti.clientRef}')">
        <div class="notification-log-icon">
          <i class="fa-solid ${noti.clientRef ? 'fa-message' : 'fa-info-circle'}"></i>
        </div>
        <div class="notification-log-details">
          <p>${noti.text}</p>
          <span>Recebida às ${noti.time}</span>
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

// Appointments Scheduling Logic
function renderAppointments() {
  const container = document.getElementById("appointments-cards-container");
  if (!container) return;
  container.innerHTML = "";

  let filtered = appointments;
  if (currentScheduleFilter === "today") {
    filtered = appointments.filter(a => a.date === "Hoje");
  } else if (currentScheduleFilter === "upcoming") {
    filtered = appointments.filter(a => a.date !== "Hoje" && a.status !== "done");
  } else if (currentScheduleFilter === "done") {
    filtered = appointments.filter(a => a.status === "done");
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:var(--color-text-secondary); text-align:center; padding:30px 0;">Nenhum agendamento encontrado para este filtro.</p>`;
    return;
  }

  filtered.forEach(app => {
    let actionBtnHtml = "";
    if (app.status !== "done") {
      actionBtnHtml = `
        <button class="btn-icon-action primary" onclick="actionTimelineChat('${app.clientRef}')" title="Iniciar Atendimento">
          <i class="fa-solid fa-play"></i>
        </button>
      `;
    } else {
      actionBtnHtml = `<span style="font-size: 11px; color:#2ECC71; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Finalizado</span>`;
    }

    const cardHtml = `
      <div class="appointment-card">
        <div class="appointment-card-info">
          <h4>${app.clientName}</h4>
          <p><i class="fa-solid fa-clock"></i> ${app.date} às ${app.time} · <strong>${app.taxType}</strong></p>
        </div>
        <div class="appointment-card-actions">
          ${actionBtnHtml}
          <button class="btn-icon-action" onclick="actionDeleteAppointment(${app.id})" title="Cancelar Agendamento">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", cardHtml);
  });
}

async function bookNewAppointment() {
  const name = document.getElementById("book-client-name").value.trim();
  const type = document.getElementById("book-tax-type").value;
  const dateVal = document.getElementById("book-date").value;
  const timeVal = document.getElementById("book-time").value;

  const now = new Date();
  const dateObj = new Date(dateVal + "T00:00:00");
  let friendlyDate = dateVal;
  
  if (
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear()
  ) {
    friendlyDate = "Hoje";
  }

  const appData = {
    clientName: name,
    date: friendlyDate,
    time: timeVal,
    taxType: type,
    status: "pending"
  };

  try {
    await fetch(API_BASE + '/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });

    await postNotificationToBackend(`Nova consulta agendada para ${name} (${friendlyDate} às ${timeVal}).`);
    
    document.getElementById("book-client-name").value = "";
    document.getElementById("book-date").value = "";
    document.getElementById("book-time").value = "";

    await refreshAllData();
    showToast(`Consulta de ${name} agendada com sucesso.`);
  } catch (e) {
    showToast("Erro ao agendar consulta no servidor.");
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
  document.getElementById("chat-timer-icon").classList.add("fa-beat-fade");
  
  chatTimerInterval = setInterval(() => {
    currentChatSeconds++;
    updateTimerUI();
    checkTimerAlerts();
  }, 1000);
}

function pauseChatTimer() {
  if (chatTimerInterval) clearInterval(chatTimerInterval);
  chatTimerInterval = null;
  document.getElementById("chat-timer-icon").classList.remove("fa-beat-fade");
}

function resetChatTimer() {
  pauseChatTimer();
  currentChatSeconds = 0;
  hasSent30MinWarning = false;
  hasSent35MinWarning = false;
  updateTimerUI();
  
  const btnStart = document.getElementById("btn-start-timer");
  const btnStop = document.getElementById("btn-stop-timer");
  if(btnStart) btnStart.style.display = "block";
  if(btnStop) btnStop.style.display = "none";
}

async function finishActiveChat() {
  if (!activeClientId) return;
  
  pauseChatTimer();
  disableChatInput();
  
  playSound('success');
  
  // Inform the backend to mark it as done
  clientsData[activeClientId].status = "done";
  
  // Post system message
  await postSystemMessageToChat("Atendimento Encerrado. O chat foi bloqueado e movido para finalizados.");
  
  // Re-render UI
  renderClientList(document.getElementById("search-input-tab")?.value || "");
}

function disableChatInput() {
  const input = document.getElementById("message-input");
  const btnSend = document.getElementById("btn-send-message");
  if (input) {
    input.disabled = true;
    input.placeholder = "Atendimento Encerrado. Chat bloqueado.";
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
  const min = Math.floor(currentChatSeconds / 60).toString().padStart(2, "0");
  const sec = (currentChatSeconds % 60).toString().padStart(2, "0");
  
  const elMin = document.getElementById("timer-minutes");
  const elSec = document.getElementById("timer-seconds");
  const container = document.getElementById("chat-timer-container");
  const icon = document.getElementById("chat-timer-icon");
  
  if(elMin) elMin.textContent = min;
  if(elSec) elSec.textContent = sec;

  // Visual cues based on 40min limit
  if (currentChatSeconds >= 35 * 60) {
    // 35 mins (5 left)
    container.style.color = "white";
    container.style.backgroundColor = "var(--color-coral)";
    container.style.borderColor = "var(--color-coral)";
    icon.style.color = "white";
  } else if (currentChatSeconds >= 30 * 60) {
    // 30 mins (10 left)
    container.style.color = "#E67E22"; // Orange
    container.style.backgroundColor = "rgba(230, 126, 34, 0.1)";
    container.style.borderColor = "#E67E22";
    icon.style.color = "#E67E22";
  } else {
    // Normal
    container.style.color = "var(--color-text)";
    container.style.backgroundColor = "var(--color-bg)";
    container.style.borderColor = "var(--color-border)";
    icon.style.color = "var(--color-pine)";
  }
}

async function checkTimerAlerts() {
  // 30 minutes (10 left for 40min limit)
  if (currentChatSeconds === 30 * 60 && !hasSent30MinWarning) {
    hasSent30MinWarning = true;
    await postSystemMessageToChat("Aviso Automático do Sistema: Faltam 10 minutos para encerrar o limite padrão deste atendimento (40min).");
  }

  // 35 minutes (5 left for 40min limit)
  if (currentChatSeconds === 35 * 60 && !hasSent35MinWarning) {
    hasSent35MinWarning = true;
    await postSystemMessageToChat("Aviso Automático do Sistema: Faltam 5 minutos para encerrar o limite padrão deste atendimento (40min).");
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

// Client Dossier Logic
function openDossier(name, doc, status) {
  document.getElementById("dossier-name").textContent = name;
  document.getElementById("dossier-doc").textContent = doc;
  
  const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  document.getElementById("dossier-avatar").textContent = initials;
  
  const statusSelect = document.getElementById("dossier-status-select");
  if (statusSelect) {
    statusSelect.value = status;
  }

  document.getElementById("dossier-overlay").classList.add("active");
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
    document.getElementById("btn-tool-" + targetId).classList.add("active");
    
    // Switch active content
    document.querySelectorAll(".side-panel-content").forEach(content => content.classList.remove("active"));
    document.getElementById("panel-content-" + targetId).classList.add("active");
  }

  if (btnToolFila) {
    btnToolFila.addEventListener("click", () => toggleLeftPanel("fila"));
  }
  
  if (btnToolDossie) {
    btnToolDossie.addEventListener("click", () => toggleLeftPanel("dossie"));
  }

  // Copilot Toggle
  const copilotPanel = document.getElementById("side-panel-copilot");
  const btnToggleCopilot = document.getElementById("btn-toggle-copilot");
  const btnCloseCopilot = document.getElementById("btn-close-copilot");

  if (btnToggleCopilot && copilotPanel) {
    btnToggleCopilot.addEventListener("click", () => {
      copilotPanel.classList.toggle("collapsed");
    });
  }

  if (btnCloseCopilot && copilotPanel) {
    btnCloseCopilot.addEventListener("click", () => {
      copilotPanel.classList.add("collapsed");
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

// --- Copilot AI Logic ---
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

  // Simulate thinking
  setTimeout(() => {
    const aiDiv = document.createElement("div");
    aiDiv.style.display = "flex";
    aiDiv.style.gap = "12px";
    aiDiv.style.maxWidth = "90%";
    
    // Simple mock responses
    let responseText = "Entendido. Como inteligência artificial conectada a este atendimento, já analisei o histórico.";
    if (msgText.toLowerCase().includes("resumo")) {
      responseText = "<strong>Resumo do Chat:</strong> O cliente precisa regularizar um CNPJ Inativo e quer saber o valor dos honorários. Ele ainda não enviou nenhum documento.";
    } else if (msgText.toLowerCase().includes("docs") || msgText.toLowerCase().includes("documentos")) {
      responseText = "O cliente ainda não anexou nenhum documento válido. Faltam: <strong>RG, Comprovante de Residência e Última DAS</strong>.";
    } else if (msgText.toLowerCase().includes("resposta") || msgText.toLowerCase().includes("rascunhar")) {
      responseText = "<em>Sugestão de resposta:</em><br><br>Olá! Para avançarmos, precisarei que você me envie o extrato bancário em formato PDF, por favor. Pode enviar aqui mesmo pelo chat.";
    }
    
    aiDiv.innerHTML = `
      <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-pine); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;"><i class="fa-solid fa-robot"></i></div>
      <div class="copilot-msg-bubble">${responseText}</div>
    `;
    
    chat.appendChild(aiDiv);
    chat.scrollTop = chat.scrollHeight;
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  setupAgendaMocks();
  renderDashboardCharts();
});
