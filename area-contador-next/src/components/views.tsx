"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Landmark,
  Link as LinkIcon,
  ListChecks,
  LockKeyhole,
  Mail,
  MessageCircle,
  Mic,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pause,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Save,
  Sparkles,
  Square,
  Trash2,
  UnlockKeyhole,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
} from "@/components/ui/primitives";
import { emptyDashboardData, type DashboardData } from "@/lib/dashboard";
import { baixarRelatorioPdf } from "@/lib/reportPdf";
import {
  emptyClientsData,
  type ClientMessage,
  type ClientRecord,
  type ClientsData,
} from "@/lib/clients";
import {
  emptyOperationsData,
  type MailItem,
  type OperationsData,
  type ServicePlan,
} from "@/lib/operations";
import { InsightChart } from "@/components/insight-chart";
import {
  announceChatDocument,
  cancelServiceCredit,
  changeChatStage,
  clearNotifications,
  createClientRecord,
  createManualAppointment,
  createReport,
  createReportRevision,
  createServiceCredit,
  createTask,
  deleteNotification,
  deleteAppointment,
  deleteServicePlan,
  deleteTask,
  markClientMessagesRead,
  markMonthlyGuideGenerated,
  markMailThreadRead,
  markNotificationsRead,
  reassignTask,
  saveAgendaAvailability,
  saveClientDossier,
  persistClientChecklist,
  persistClientNotes,
  assignClientResponsavel,
  reactivateClient,
  sendChatTimerWarning,
  sendAudioMessage,
  sendChatShortcut,
  saveChatTimer,
  saveCompleteReport,
  saveDashboardPreferences,
  saveServicePlan,
  saveSystemSetting,
  sendMailMessage,
  sendMessage,
  setReportDocument,
  addManualReportAttachment,
  removeManualReportAttachment,
  setChatLocked as persistChatLocked,
  toggleTask,
  updateAppointmentStatus,
  updateClient,
  updateProfile,
  type ClientDossierInput,
} from "@/app/auth/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NotificationItem = {
  id: number;
  text: string;
  time: string | null;
  created_at: string | null;
  unread: boolean | null;
  cliente_ref: string | null;
};

function feedback(message: string) {
  window.dispatchEvent(new CustomEvent("app-feedback", { detail: message }));
}

const tabsByView: Record<string, string[]> = {
  clientes: ["Visão Geral", "Clientes Recorrentes"],
  relatorios: [
    "Aguardando Relatório",
    "Novo Relatório",
    "Relatórios Finalizados",
    "Todos os Relatórios",
  ],
  financeiro: [
    "Faturamento",
    "Cobranças em Aberto",
    "Planos & Links de Pagamento",
    "Creditos de Atendimento",
  ],
  radar: [
    "Caixa Postal",
    "Situação Fiscal",
    "Parcelamentos",
    "Dívida Ativa",
    "CND",
  ],
  notificacoes: ["Avisos do Sistema", "Mensagens"],
  configuracoes: [
    "Geral & Notificações",
    "Área do Cliente",
    "Radar Fiscal",
    "Acessos e Equipe",
    "Integracoes",
    "Inteligência Artificial (AIA)",
    "Aparência do Chat",
  ],
};

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Tabs({
  view,
  active,
  onChange,
}: {
  view: string;
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabsByView[view]?.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          className={active === tab ? "active" : ""}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "green",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "green" | "orange" | "blue";
}) {
  return (
    <Card className="stat">
      <div className={`stat-icon ${tone}`}>
        <CircleDollarSign size={18} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </Card>
  );
}

export function DashboardView({
  data = emptyDashboardData,
  onNavigate,
}: {
  data?: DashboardData;
  onNavigate?: (section: string, clientId?: string | null) => void;
}) {
  const [tasks, setTasks] = useState(data.tasks);
  const [monthlyGuides, setMonthlyGuides] = useState(data.monthlyGuides);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    texto: "",
    dataInicial: new Date().toISOString().slice(0, 10),
    dataFinal: new Date().toISOString().slice(0, 10),
  });
  const [taskPending, startTaskTransition] = useTransition();
  const money = (cents: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  const operation = [
    {
      Icon: CalendarDays,
      title: "Agenda do Dia",
      count: data.appointments.today,
      empty: "Nenhum agendamento para hoje.",
      label: "agendamentos para hoje",
      destination: "agendamentos",
    },
    {
      Icon: CalendarDays,
      title: "Agenda da Semana",
      count: data.appointments.week,
      empty: "Nenhum agendamento futuro na semana.",
      label: "agendamentos na semana",
      destination: "agendamentos",
    },
    {
      Icon: Zap,
      title: "Atendimentos Express",
      count: data.expressPending,
      empty: "Fila livre. Nenhum serviço express pendente.",
      label: "serviços aguardando",
      destination: "acompanhamento",
    },
    {
      Icon: MessageCircle,
      title: "Mensagens de Processos em Aberto",
      count: data.unreadMessages,
      empty: "Nenhuma mensagem pendente.",
      label: "mensagens não lidas",
      destination: "atendimento",
    },
    {
      Icon: FileCheck2,
      title: "Tarefas Pendentes",
      count: data.pendingTasks,
      empty: "Nenhuma tarefa pendente.",
      label: "tarefas pendentes",
      destination: "acompanhamento",
    },
  ];
  function addTask() {
    const texto = taskForm.texto.trim();
    if (!texto || !taskForm.dataInicial || !taskForm.dataFinal) return;
    if (taskForm.dataFinal < taskForm.dataInicial) {
      feedback("O prazo final não pode ser anterior à data inicial.");
      return;
    }
    const dataInicial = new Date(`${taskForm.dataInicial}T12:00:00-03:00`).toISOString();
    const dataFinal = new Date(`${taskForm.dataFinal}T12:00:00-03:00`).toISOString();
    setTaskOpen(false);
    setTaskForm((value) => ({ ...value, texto: "" }));
    startTaskTransition(async () => {
      const result = await createTask({ texto, dataInicial, dataFinal });
      if (result.ok)
        setTasks((items) => [
          { id: crypto.randomUUID(), texto: texto.slice(0, 240), feita: false, dataInicial, dataFinal, responsavelId: null },
          ...items,
        ]);
      feedback(result.message);
    });
  }
  function toggleTaskDone(id: string, feita: boolean) {
    setTasks((items) => items.map((item) => (item.id === id ? { ...item, feita } : item)));
    startTaskTransition(async () => {
      const result = await toggleTask(id, feita);
      if (!result.ok) setTasks((items) => items.map((item) => (item.id === id ? { ...item, feita: !feita } : item)));
      feedback(result.message);
    });
  }
  function moveTask(id: string, responsavelId: string) {
    const value = responsavelId || null;
    setTasks((items) => items.map((item) => (item.id === id ? { ...item, responsavelId: value } : item)));
    startTaskTransition(async () => {
      const result = await reassignTask(id, value);
      feedback(result.message);
    });
  }
  function removeTask(id: string) {
    const previous = tasks;
    setTasks((items) => items.filter((item) => item.id !== id));
    startTaskTransition(async () => {
      const result = await deleteTask(id);
      if (!result.ok) setTasks(previous);
      feedback(result.message);
    });
  }
  function completeGuide(id: number) {
    startTaskTransition(async () => {
      const result = await markMonthlyGuideGenerated(id);
      if (result.ok)
        setMonthlyGuides((items) =>
          items.map((item) =>
            item.id === id ? { ...item, status: "gerada" } : item,
          ),
        );
      feedback(result.message);
    });
  }

  return (
    <div className="view-stack">
      <PageTitle
        title="Meu Dashboard"
        description="Faturamento, operação do dia e pendências externas — nesta ordem."
        action={
          <Badge className={data.mode === "live" ? "success" : ""}>
            {data.mode === "live" ? "Dados ao vivo" : "Modo de prévia"}
          </Badge>
        }
      />
      <section>
        <div className="section-label">Faturamento</div>
        <div className="stats-grid">
          <Stat
            label="Faturamento do Dia"
            value={money(data.revenue.day)}
            hint="Cobranças pagas hoje"
          />
          <Stat
            label="Faturamento da Semana"
            value={money(data.revenue.week)}
            hint="Desde segunda-feira"
          />
          <Stat
            label="Faturamento do Mês"
            value={money(data.revenue.month)}
            hint="Pagamentos confirmados no mês"
          />
          <Stat
            label="Total Atendimentos / Mês"
            value={String(data.completedThisMonth)}
            hint={`${data.completedThisMonth} concluído${data.completedThisMonth === 1 ? "" : "s"} até agora`}
            tone="orange"
          />
        </div>
      </section>
      <section>
        <div className="section-label">Guias mensais</div>
        <Card className="task-manager-card">
          <div className="card-heading">
            <div>
              <ReceiptText size={18} />
              <strong>Obrigações dos clientes recorrentes</strong>
            </div>
            <Badge className={monthlyGuides.some((item) => item.status !== "gerada") ? "attention" : "success"}>
              {monthlyGuides.filter((item) => item.status !== "gerada").length} pendente(s)
            </Badge>
          </div>
          <div className="records-list appointment-list">
            {monthlyGuides
              .filter((item) => item.status !== "gerada")
              .slice(0, 12)
              .map((guide) => (
                <article key={guide.id}>
                  <div className="record-icon"><ReceiptText size={16} /></div>
                  <div>
                    <strong>{guide.clientName}</strong>
                    <span>{guide.tipo}</span>
                    <small>Competência {guide.competencia}</small>
                  </div>
                  <div className="table-actions">
                    <Button className="secondary compact" disabled={taskPending} onClick={() => completeGuide(guide.id)}>
                      <Check size={14} /> Marcar gerada
                    </Button>
                    <Button className="icon ghost" aria-label={`Abrir cliente ${guide.clientName}`} onClick={() => onNavigate?.("clientes", guide.clienteRef)}>
                      <ArrowUpRight size={15} />
                    </Button>
                  </div>
                </article>
              ))}
            {!monthlyGuides.some((item) => item.status !== "gerada") && (
              <EmptyState>Nenhuma guia pendente neste mês.</EmptyState>
            )}
          </div>
        </Card>
      </section>
      <section>
        <div className="section-label">Operação do dia</div>
        <div className="operation-grid">
          {operation.map(
            ({ Icon, title, count, empty, label, destination }) => (
              <button
                className="card operation-card dashboard-link-card"
                key={title}
                onClick={() => onNavigate?.(destination)}
                type="button"
              >
              <div className="card-heading">
                <div>
                  <Icon size={18} />
                  <strong>{title}</strong>
                </div>
                <Badge className={count ? "attention" : ""}>
                  {count} pendente{count === 1 ? "" : "s"}
                </Badge>
              </div>
              {count ? (
                <div className="operation-summary">
                  <strong>{count}</strong>
                  <span>{label}</span>
                  <small>Abrir módulo operacional</small>
                </div>
              ) : (
                <EmptyState>{empty}</EmptyState>
              )}
              </button>
            ),
          )}
        </div>
      </section>
      <section>
        <div className="section-label">Tarefas internas</div>
        <Card className="task-manager-card">
          <div className="card-heading">
            <div>
              <ListChecks size={18} />
              <strong>Ações e compromissos de acompanhamento</strong>
            </div>
            <Button className="secondary" onClick={() => setTaskOpen(true)}>
              <Plus size={15} /> Nova tarefa
            </Button>
          </div>
          <div className="task-list">
            {tasks.map((task) => (
              <article className={task.feita ? "done" : ""} key={task.id}>
                <input
                  type="checkbox"
                  aria-label={`Concluir ${task.texto}`}
                  checked={task.feita}
                  disabled={taskPending}
                  onChange={(event) => toggleTaskDone(task.id, event.target.checked)}
                />
                <span>
                  <strong>{task.texto}</strong>
                  <small>
                    {task.dataInicial
                      ? new Date(task.dataInicial).toLocaleDateString("pt-BR")
                      : "Sem data"}
                    {" → "}
                    {task.dataFinal
                      ? new Date(task.dataFinal).toLocaleDateString("pt-BR")
                      : "Sem prazo"}
                  </small>
                </span>
                <select
                  className="input compact"
                  aria-label={`Responsável por ${task.texto}`}
                  value={task.responsavelId || ""}
                  disabled={taskPending}
                  onChange={(event) => moveTask(task.id, event.target.value)}
                >
                  <option value="">Sem responsável</option>
                  {data.staffList.map((member) => (
                    <option key={member.id} value={member.id}>{member.nome}</option>
                  ))}
                </select>
                <button
                  aria-label={`Excluir ${task.texto}`}
                  disabled={taskPending}
                  onClick={() => removeTask(task.id)}
                >
                  <X size={15} />
                </button>
              </article>
            ))}
            {!tasks.length && <EmptyState>Nenhuma tarefa pendente.</EmptyState>}
          </div>
        </Card>
      </section>
      {taskOpen && (
        <div className="dialog-backdrop">
          <Card className="profile-dialog compact" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div>
                <h2>Nova tarefa</h2>
                <p>Registre uma ação interna com início e prazo.</p>
              </div>
              <Button className="icon ghost" onClick={() => setTaskOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form">
              <label>
                Descrição
                <Input
                  autoFocus
                  value={taskForm.texto}
                  onChange={(event) =>
                    setTaskForm({ ...taskForm, texto: event.target.value })
                  }
                  placeholder="Ex.: Enviar relatório — Ana Silva"
                />
              </label>
              <div className="form-grid">
                <label>
                  Data inicial
                  <Input
                    type="date"
                    value={taskForm.dataInicial}
                    onChange={(event) =>
                      setTaskForm({ ...taskForm, dataInicial: event.target.value })
                    }
                  />
                </label>
                <label>
                  Prazo final
                  <Input
                    type="date"
                    value={taskForm.dataFinal}
                    onChange={(event) =>
                      setTaskForm({ ...taskForm, dataFinal: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="dialog-actions">
              <Button className="secondary" onClick={() => setTaskOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={taskPending || !taskForm.texto.trim()}
                onClick={addTask}
              >
                Criar tarefa
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function AtendimentoView({
  clientsData = emptyClientsData,
  operationsData = emptyOperationsData,
  currentStaffId,
  filaRestrita = false,
}: {
  clientsData?: ClientsData;
  operationsData?: OperationsData;
  currentStaffId?: string;
  filaRestrita?: boolean;
}) {
  const [queue, setQueue] = useState<"Chats" | "Agenda do dia">("Chats");
  const [tool, setTool] = useState<"fila" | "copilot">("fila");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [messages, setMessages] = useState<ClientMessage[]>(
    clientsData.messages,
  );
  const [chatDocuments, setChatDocuments] = useState(clientsData.documents);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotAnswer, setCopilotAnswer] = useState("");
  const skillValue = operationsData.settings.find(
    (item) => item.chave === "ia_skills",
  )?.valor;
  const copilotSkills = Array.isArray(skillValue)
    ? skillValue.filter(
        (item): item is { id: string; name: string; tema?: string; active?: boolean } =>
          Boolean(
            item &&
              typeof item === "object" &&
              "id" in item &&
              "name" in item &&
              item.active !== false,
          ),
      )
    : [];
  const timerValue = operationsData.settings.find(
    (item) => item.chave === "timer_config",
  )?.valor;
  const timerStored =
    timerValue && typeof timerValue === "object" && !Array.isArray(timerValue)
      ? (timerValue as Record<string, unknown>)
      : {};
  const timerConfig = {
    autoIniciar: timerStored.autoIniciar ?? timerStored.auto ?? true,
    direcao: String(timerStored.direcao ?? timerStored.direction ?? "crescente"),
    duracaoMinutos: Math.max(1, Number(timerStored.duracaoMinutos ?? timerStored.duration) || 40),
    avisoMinutosAntes: Math.max(1, Number(timerStored.avisoMinutosAntes ?? timerStored.warning) || 5),
    avisarCliente: timerStored.avisarCliente ?? timerStored.notifyClient ?? true,
    avisoSonoro: timerStored.avisoSonoro ?? timerStored.sound ?? true,
  };
  const panelPreferencesValue = operationsData.settings.find(
    (item) => item.chave === "painel_preferencias",
  )?.valor;
  const systemSoundsEnabled = !(
    panelPreferencesValue &&
    typeof panelPreferencesValue === "object" &&
    !Array.isArray(panelPreferencesValue) &&
    (panelPreferencesValue as Record<string, unknown>).systemSounds === false
  );
  const appearanceValue = operationsData.settings.find((item) => item.chave === "chat_appearance")?.valor;
  const appearanceStored = appearanceValue && typeof appearanceValue === "object" && !Array.isArray(appearanceValue)
    ? appearanceValue as Record<string, unknown> : {};
  const chatAppearance = {
    dark: appearanceStored.dark === true,
    chatBackground: String(appearanceStored.chatBackground || appearanceStored.chatBg || "#f1f5f9"),
    accountantBubble: String(appearanceStored.accountantBubble || appearanceStored.bubbleContador || "#0f172a"),
    clientBubble: String(appearanceStored.clientBubble || appearanceStored.bubbleCliente || "#ffffff"),
    copilotBackground: String(appearanceStored.copilotBackground || appearanceStored.copilotBg || "#eaf1f6"),
  };
  const shortcutValue = operationsData.settings.find((item) => item.chave === "chat_shortcuts")?.valor;
  const defaultChatShortcuts = [
    { id: "1", action: "reply", text: "/boasvindas", label: "/boasvindas" },
    { id: "2", action: "reply", text: "/doc-malha", label: "/doc-malha" },
    { id: "3", action: "reply", text: "/honorarios", label: "/honorarios" },
    { id: "4", action: "doc", text: "CPF e RG", label: "Pedir CPF/RG" },
    { id: "5", action: "doc", text: "Notificação da Receita", label: "Pedir Notificação" },
  ];
  const rawChatShortcuts: unknown[] = Array.isArray(shortcutValue) && shortcutValue.length ? shortcutValue : defaultChatShortcuts;
  const chatShortcuts = rawChatShortcuts
    .filter((item) => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item, index) => { const value=item as Record<string,unknown>; return { id: String(value.id || index), action: String(value.action || "reply"), text: String(value.text || ""), label: String(value.label || value.text || "Atalho") }; });
  const copilotShortcutValue = operationsData.settings.find((item) => item.chave === "copilot_shortcuts")?.valor;
  const rawCopilotShortcuts: unknown[] = Array.isArray(copilotShortcutValue) && copilotShortcutValue.length ? copilotShortcutValue : [
    { id: "cp-1", label: "Ganho Capital", prompt: "Analise se este cliente tem direito à isenção de Ganho de Capital no caso relatado.", enabled: true },
    { id: "cp-2", label: "PJ vs PF", prompt: "Compare se vale mais a pena abrir um CNPJ ou permanecer na Pessoa Física neste caso.", enabled: true },
    { id: "cp-3", label: "Checklist", prompt: "Gere o checklist exato de documentos para este caso.", enabled: true },
    { id: "cp-4", label: "Resumir Chat", prompt: "Faça um resumo objetivo do que o cliente pediu.", enabled: true },
  ];
  const copilotShortcuts = rawCopilotShortcuts.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return (item as Record<string,unknown>).enabled !== false;
  }).map((item, index) => { const value=item as Record<string,unknown>; return { id: String(value.id || index), label: String(value.label || "Atalho"), prompt: String(value.prompt || "") }; });
  const [selectedSkill, setSelectedSkill] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queueQuery, setQueueQuery] = useState("");
  const attachmentRef = useRef<HTMLInputElement>(null);
  const timerSnapshotRef = useRef({ clientId: "", elapsed: 0, running: false });
  const timerSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const warnedTimersRef = useRef(new Set<string>());
  const [isSending, startSending] = useTransition();
  const chatClients = clientsData.clients
    .filter((client) => !client.arquivado_em)
    .filter(
      (client) =>
        messages.some((message) => message.cliente_id === client.id) ||
        ["active", "pending", "waiting", "locked"].includes(
          client.status || "",
        ),
    )
    .filter(
      (client) =>
        !queueQuery.trim() ||
        [client.name, client.cpf, client.email].some((value) =>
          value?.toLowerCase().includes(queueQuery.trim().toLowerCase()),
        ),
    )
    .filter(
      (client) =>
        !filaRestrita ||
        !client.responsavel_id ||
        client.responsavel_id === currentStaffId,
    )
    .sort((a, b) => {
      const unread = (clientId: string) =>
        messages.filter(
          (message) =>
            message.cliente_id === clientId &&
            message.sender === "client" &&
            !message.read_at,
        ).length;
      const unreadDifference = unread(b.id) - unread(a.id);
      if (unreadDifference) return unreadDifference;
      const lastSequence = (clientId: string) =>
        messages.reduce(
          (latest, message) =>
            message.cliente_id === clientId
              ? Math.max(latest, message.seq)
              : latest,
          0,
        );
      return lastSequence(b.id) - lastSequence(a.id);
    });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const todayAppointments = operationsData.appointments.filter(
    (item) => item.date === today && item.status !== "done",
  );
  const queueCount = clientsData.clients.filter((client) =>
    messages.some(
      (message) =>
        message.cliente_id === client.id &&
        message.sender === "client" &&
        !message.read_at,
    ),
  ).length;
  const selectedClient =
    clientsData.clients.find((client) => client.id === selectedClientId) ||
    null;
  const selectedMessages = messages
    .filter((item) => item.cliente_id === selectedClientId)
    .sort((a, b) => a.seq - b.seq);
  const displayedSeconds = timerConfig.direcao === "decrescente"
    ? Math.max(0, timerConfig.duracaoMinutos * 60 - elapsed)
    : elapsed;
  const formattedElapsed = `${String(Math.floor(displayedSeconds / 60)).padStart(2, "0")}:${String(displayedSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);
  useEffect(() => {
    timerSnapshotRef.current = {
      clientId: selectedClientId || "",
      elapsed,
      running: timerRunning,
    };
  }, [elapsed, selectedClientId, timerRunning]);
  useEffect(() => {
    if (!selectedClientId || !timerRunning) return;
    const persist = window.setInterval(() => {
      const snapshot = timerSnapshotRef.current;
      if (snapshot.clientId)
        void persistTimer({
          clientId: snapshot.clientId,
          elapsedSeconds: snapshot.elapsed,
          running: snapshot.running,
        });
    }, 15_000);
    return () => window.clearInterval(persist);
  }, [selectedClientId, timerRunning]);
  useEffect(() => {
    if (!selectedClientId || !timerRunning) return;
    const threshold = Math.max(
      0,
      (timerConfig.duracaoMinutos - timerConfig.avisoMinutosAntes) * 60,
    );
    const key = `${selectedClientId}:${timerConfig.duracaoMinutos}:${timerConfig.avisoMinutosAntes}`;
    if (elapsed < threshold || warnedTimersRef.current.has(key)) return;
    warnedTimersRef.current.add(key);
    if (timerConfig.avisoSonoro) {
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 740;
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.35);
      } catch { /* o navegador pode bloquear áudio sem interação */ }
    }
    if (timerConfig.avisarCliente) {
      void sendChatTimerWarning({
        clientId: selectedClientId,
        durationMinutes: timerConfig.duracaoMinutos,
        warningMinutes: timerConfig.avisoMinutosAntes,
      }).then((result) => {
        if (result.ok)
          setMessages((items) =>
            items.some((item) => item.id === result.data.id)
              ? items
              : [...items, result.data],
          );
        else feedback(result.message);
      });
    } else feedback(`Faltam ${timerConfig.avisoMinutosAntes} minuto(s) para o limite do atendimento.`);
  }, [elapsed, selectedClientId, timerRunning, timerConfig.avisoMinutosAntes, timerConfig.avisoSonoro, timerConfig.avisarCliente, timerConfig.duracaoMinutos]);
  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("contador-mensagens-next")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        (payload) => {
          const incoming = payload.new as ClientMessage;
          setMessages((items) =>
            items.some((item) => item.id === incoming.id)
              ? items
              : [...items, incoming],
          );
          if (incoming.sender === "client" && systemSoundsEnabled) {
            try {
              const context = new AudioContext();
              const oscillator = context.createOscillator();
              const gain = context.createGain();
              oscillator.type = "sine";
              oscillator.frequency.setValueAtTime(523.25, context.currentTime);
              oscillator.frequency.setValueAtTime(659.25, context.currentTime + 0.1);
              gain.gain.setValueAtTime(0.001, context.currentTime);
              gain.gain.linearRampToValueAtTime(0.08, context.currentTime + 0.04);
              gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.38);
              oscillator.connect(gain).connect(context.destination);
              oscillator.start();
              oscillator.stop(context.currentTime + 0.4);
            } catch { /* alguns navegadores exigem interação antes do áudio */ }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensagens" },
        (payload) => {
          const updated = payload.new as ClientMessage;
          setMessages((items) =>
            items.map((item) => (item.id === updated.id ? { ...item, read_at: updated.read_at } : item)),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [systemSoundsEnabled]);
  // Contraparte de useContadorPresence no portal do cliente: sem isso, o
  // "Online"/"Visto há X min" no chat do cliente nunca acende porque
  // ninguém do lado do contador publica no canal oc-presence.
  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("oc-presence", { config: { broadcast: { self: false } } });
    channel.subscribe();
    const pingInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        channel.send({ type: "broadcast", event: "ping", payload: { role: "contador" } });
      }
    }, 5000);
    return () => {
      clearInterval(pingInterval);
      void supabase.removeChannel(channel);
    };
  }, []);
  // Contraparte de useTypingIndicator no portal do cliente (que só escuta
  // from: "agent"): sem publicar aqui, o indicador de "contador digitando"
  // no chat do cliente nunca acende.
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSentRef = useRef(0);
  useEffect(() => {
    if (!selectedClientId) {
      typingChannelRef.current = null;
      return;
    }
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`oc-typing-${selectedClientId}`, { config: { broadcast: { self: false } } });
    channel.subscribe();
    typingChannelRef.current = channel;
    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [selectedClientId]);
  function notifyClientTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: "agent" } });
  }
  useEffect(() => {
    const requestedClient = window.sessionStorage.getItem(
      "contador-open-client",
    );
    if (
      !requestedClient ||
      !clientsData.clients.some((client) => client.id === requestedClient)
    )
      return;
    window.sessionStorage.removeItem("contador-open-client");
    openClient(requestedClient);
  }, []);

  function openClient(clientId: string) {
    const client = clientsData.clients.find((item) => item.id === clientId);
    const previous = timerSnapshotRef.current;
    if (previous.clientId && previous.clientId !== clientId) {
      void persistTimer({
        clientId: previous.clientId,
        elapsedSeconds: previous.elapsed,
        running: previous.running,
      });
    }
    const profile =
      client?.perfil_operacional &&
      typeof client.perfil_operacional === "object" &&
      !Array.isArray(client.perfil_operacional)
        ? (client.perfil_operacional as Record<string, unknown>)
        : {};
    const savedTimer =
      profile.chatTimer &&
      typeof profile.chatTimer === "object" &&
      !Array.isArray(profile.chatTimer)
        ? (profile.chatTimer as Record<string, unknown>)
        : {};
    const savedElapsed = Math.max(0, Number(savedTimer.elapsedSeconds) || 0);
    const savedAt = Date.parse(String(savedTimer.updatedAt || ""));
    const hasSavedTimer = Object.keys(savedTimer).length > 0;
    const wasRunning = savedTimer.running === true || (!hasSavedTimer && timerConfig.autoIniciar === true);
    const restoredElapsed =
      savedElapsed +
      (wasRunning && Number.isFinite(savedAt)
        ? Math.max(0, Math.round((Date.now() - savedAt) / 1000))
        : 0);
    setSelectedClientId(clientId);
    const normalizedTheme = String(client?.tax_type || "").toLocaleLowerCase("pt-BR");
    const automaticSkill = copilotSkills.find((skill) => {
      const theme = String(skill.tema || "").trim().toLocaleLowerCase("pt-BR");
      return Boolean(
        theme &&
          normalizedTheme &&
          (normalizedTheme.includes(theme) || theme.includes(normalizedTheme)),
      );
    });
    setSelectedSkill(automaticSkill?.id || "");
    setChatLocked(client?.status === "locked");
    setElapsed(restoredElapsed);
    setTimerRunning(wasRunning);
    setPanelCollapsed(false);
    setMessages((items) =>
      items.map((item) =>
        item.cliente_id === clientId &&
        item.sender === "client" &&
        !item.read_at
          ? { ...item, read_at: new Date().toISOString() }
          : item,
      ),
    );
    startSending(async () => {
      await markClientMessagesRead(clientId);
    });
  }
  function persistTimer(input: {
    clientId: string;
    elapsedSeconds: number;
    running: boolean;
  }) {
    timerSaveChainRef.current = timerSaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const result = await saveChatTimer(input);
        if (!result.ok) feedback(result.message);
      });
    return timerSaveChainRef.current;
  }
  function toggleTimer() {
    if (!selectedClientId) return;
    const running = !timerRunning;
    setTimerRunning(running);
    void persistTimer({
      clientId: selectedClientId,
      elapsedSeconds: elapsed,
      running,
    });
  }
  function resetTimer() {
    if (!selectedClientId) return;
    setTimerRunning(false);
    setElapsed(0);
    void persistTimer({
      clientId: selectedClientId,
      elapsedSeconds: 0,
      running: false,
    });
  }
  function submitMessage() {
    if (!selectedClientId || !messageText.trim() || chatLocked) return;
    const value = messageText;
    setMessageText("");
    startSending(async () => {
      const result = await sendMessage({
        clientId: selectedClientId,
        text: value,
      });
      if (result.ok) {
        setMessages((items) =>
          items.some((item) => item.id === result.data.id)
            ? items
            : [...items, result.data],
        );
      } else {
        setMessageText(value);
        feedback(result.message);
      }
    });
  }
  function useChatShortcut(shortcut: {action:string;text:string}) {
    if (!selectedClientId) return feedback("Selecione um atendimento.");
    if (shortcut.action === "doc") {
      startSending(async () => {
        const result = await sendChatShortcut({ clientId: selectedClientId, kind: "document", value: shortcut.text });
        if (result.ok) setMessages((items) => items.some((item) => item.id === result.data.id) ? items : [...items, result.data]);
        feedback(result.message);
      });
      return;
    }
    const canned: Record<string,string> = {
      "/boasvindas": "Olá! Seja muito bem-vindo ao Olá, Contador. Meu nome é Felipe e serei o profissional responsável pelo seu atendimento hoje. Como posso ajudar você?",
      "/doc-malha": "Para analisar a pendência de malha fina, envie CPF e RG, extrato completo da pendência no e-CAC e informes de rendimentos do ano em questão.",
      "/honorarios": `Para a análise e regularização do seu caso, os honorários profissionais avulsos são de R$ ${Number(selectedClient?.honorarios || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Posso preparar o prontuário?`,
    };
    setMessageText(canned[shortcut.text] || shortcut.text);
  }
  async function startRecording() {
    if (!selectedClientId) return feedback("Selecione um atendimento.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        void enviarAudioGravado(blob, recordingSeconds);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } catch {
      feedback("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  function enviarAudioGravado(blob: Blob, durationSeconds: number) {
    if (!selectedClientId) return;
    startSending(async () => {
      const supabase = createBrowserClient();
      if (!supabase) return feedback("Conexão indisponível.");
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fileName = `audio-${Date.now()}.${ext}`;
      const path = `${selectedClientId}/${fileName}`;
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
      if (storageError) return feedback("Não foi possível enviar o áudio agora.");
      const { data: document, error: documentError } = await supabase
        .from("documentos")
        .insert({ cliente_ref: selectedClientId, file_name: fileName, mime: blob.type || "audio/webm", size_bytes: blob.size, storage_path: path, uploaded_by: "agent" })
        .select("id,cliente_ref,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,ai_extracted")
        .single();
      if (documentError || !document) return feedback("Não foi possível salvar o áudio.");
      setChatDocuments((items) => [...items, document]);
      const duracao = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;
      const result = await sendAudioMessage({ clientId: selectedClientId, fileName, duration: duracao });
      if (result.ok) setMessages((items) => (items.some((item) => item.id === result.data.id) ? items : [...items, result.data]));
      feedback(result.message);
    });
  }
  function changeStage(action: "followup" | "finish") {
    if (!selectedClientId) return feedback("Selecione um atendimento.");
    const question =
      action === "finish"
        ? "Encerrar a conversa e registrar este atendimento no histórico?"
        : "Encaminhar este caso para acompanhamento?";
    if (!window.confirm(question)) return;
    startSending(async () => {
      const result = await changeChatStage({
        clientId: selectedClientId,
        action,
        elapsedSeconds: elapsed,
      });
      if (result.ok && result.locked) {
        setChatLocked(true);
        setTimerRunning(false);
        void persistTimer({
          clientId: selectedClientId,
          elapsedSeconds: elapsed,
          running: false,
        });
      }
      feedback(result.message);
    });
  }
  function toggleChatLock() {
    if (!selectedClientId) return feedback("Selecione um atendimento.");
    const next = !chatLocked;
    startSending(async () => {
      const result = await persistChatLocked({
        clientId: selectedClientId,
        locked: next,
      });
      if (result.ok) setChatLocked(result.locked);
      feedback(result.message);
    });
  }
  async function askCopilot(
    mode: "resumo" | "rascunho" | "pergunta" | "pendencias",
    promptOverride?: string,
  ) {
    if (!selectedClientId) {
      feedback("Selecione um atendimento antes de consultar o copiloto.");
      return;
    }
    setCopilotLoading(true);
    setCopilotAnswer("");
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          mode,
          prompt: promptOverride ?? copilotPrompt,
          skillId: selectedSkill || undefined,
        }),
      });
      const result = (await response.json()) as {
        text?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          result.error === "ia_not_configured"
            ? "O provedor de IA ainda não está configurado neste ambiente."
            : "Não foi possível consultar o copiloto agora.",
        );
      setCopilotAnswer(result.text || "Sem resposta.");
      if (mode === "rascunho" && result.text) setCopilotPrompt(result.text);
    } catch (error) {
      feedback(
        error instanceof Error
          ? error.message
          : "Falha ao consultar o copiloto.",
      );
    } finally {
      setCopilotLoading(false);
    }
  }
  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedClientId) return;
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
      feedback("Envie um PDF, PNG ou JPEG.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      feedback("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    const supabase = createBrowserClient();
    if (!supabase) {
      feedback("Conexão indisponível.");
      return;
    }
    setUploading(true);
    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-120);
    const path = `${selectedClientId}/${Date.now()}_${safeName}`;
    try {
      const { error: storageError } = await supabase.storage
        .from("documentos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) throw storageError;
      const { data: document, error: recordError } = await supabase
        .from("documentos")
        .insert({
          cliente_ref: selectedClientId,
          file_name: file.name,
          mime: file.type,
          size_bytes: file.size,
          storage_path: path,
          uploaded_by: "contador",
        })
        .select("id,cliente_ref,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,ai_extracted")
        .single();
      if (recordError) {
        await supabase.storage.from("documentos").remove([path]);
        throw recordError;
      }
      const announced = await announceChatDocument({
        clientId: selectedClientId,
        documentId: document.id,
      });
      if (announced.ok) {
        setChatDocuments((items) => [document, ...items]);
        setMessages((items) =>
          items.some((item) => item.id === announced.data.id)
            ? items
            : [...items, announced.data],
        );
      }
      feedback(announced.message);
    } catch {
      feedback("Não foi possível anexar o documento.");
    } finally {
      setUploading(false);
    }
  }

  function selectTool(nextTool: "fila" | "copilot") {
    if (tool === nextTool) {
      setPanelCollapsed((value) => !value);
      return;
    }
    setTool(nextTool);
    setPanelCollapsed(false);
  }

  return (
    <div
      className={`chat-layout tool-${tool} ${panelCollapsed ? "queue-collapsed" : ""} ${chatAppearance.dark ? "chat-dark" : ""}`}
      style={{
        "--custom-chat-bg": chatAppearance.chatBackground,
        "--custom-agent-bubble": chatAppearance.accountantBubble,
        "--custom-client-bubble": chatAppearance.clientBubble,
        "--custom-copilot-bg": chatAppearance.copilotBackground,
      } as CSSProperties}
    >
      <aside className="chat-tool-rail" aria-label="Ferramentas do atendimento">
        <button
          className={tool === "fila" && !panelCollapsed ? "active" : ""}
          onClick={() => selectTool("fila")}
          aria-label="Fila de atendimento"
          data-tooltip="Fila de atendimento"
        >
          <MessageCircle size={19} />
          <span>Fila</span>
        </button>
        <button
          className={tool === "copilot" && !panelCollapsed ? "active" : ""}
          onClick={() => selectTool("copilot")}
          aria-label="Copiloto IA"
          data-tooltip="Copiloto IA"
        >
          <Bot size={19} />
          <span>Copiloto</span>
        </button>
        <div className="chat-tool-spacer" />
        <button
          className="collapse-tool"
          onClick={() => setPanelCollapsed((value) => !value)}
          aria-label={
            panelCollapsed
              ? "Expandir painel lateral"
              : "Recolher painel lateral"
          }
          data-tooltip={panelCollapsed ? "Expandir painel" : "Recolher painel"}
        >
          {panelCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
          <span>{panelCollapsed ? "Expandir" : "Recolher"}</span>
        </button>
      </aside>

      <aside
        className={`chat-side-panel ${tool === "copilot" ? "copilot-panel" : "queue-panel"}`}
        aria-label={tool === "fila" ? "Fila de atendimento" : "Copiloto IA"}
      >
        {tool === "fila" ? (
          <>
            <div className="side-panel-heading">
              <div>
                <strong>Fila de atendimento</strong>
                <small>Conversas e agenda do dia</small>
              </div>
              <Badge className={queueCount ? "attention" : ""}>
                {queueCount} nova{queueCount === 1 ? "" : "s"}
              </Badge>
            </div>
            <div
              className="chat-capsule"
              role="tablist"
              aria-label="Origem dos atendimentos"
            >
              <button
                role="tab"
                aria-selected={queue === "Chats"}
                className={queue === "Chats" ? "active" : ""}
                onClick={() => setQueue("Chats")}
              >
                <MessageCircle size={14} /> Chats{" "}
                <span
                  className={`capsule-count ${queueCount ? "has-items" : ""}`}
                >
                  {queueCount}
                </span>
              </button>
              <button
                role="tab"
                aria-selected={queue === "Agenda do dia"}
                className={queue === "Agenda do dia" ? "active" : ""}
                onClick={() => setQueue("Agenda do dia")}
              >
                <CalendarDays size={14} /> Agenda do dia{" "}
                <span
                  className={`capsule-count ${todayAppointments.length ? "has-items" : ""}`}
                >
                  {todayAppointments.length}
                </span>
              </button>
            </div>
            <div className="queue-search search-field">
              <Search size={15} />
              <Input
                value={queueQuery}
                onChange={(event) => setQueueQuery(event.target.value)}
                aria-label="Buscar cliente na fila"
                placeholder="Buscar cliente por nome..."
              />
            </div>
            <div className="queue-content">
              {queue === "Chats" ? (
                chatClients.length ? (
                  <div className="queue-real-list">
                    {chatClients.map((client) => {
                      const unread = messages.filter(
                        (message) =>
                          message.cliente_id === client.id &&
                          message.sender === "client" &&
                          !message.read_at,
                      ).length;
                      return <button
                        className={
                          selectedClientId === client.id ? "selected" : ""
                        }
                        key={client.id}
                        onClick={() => openClient(client.id)}
                      >
                        <div className="avatar small">
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>
                          <strong>{client.name}</strong>
                          <small>
                            {messages.find(
                              (message) => message.cliente_id === client.id,
                            )?.text || "Nova mensagem"}
                          </small>
                        </span>
                        {unread > 0 && <Badge className="attention">{unread}</Badge>}
                      </button>;
                    })}
                  </div>
                ) : (
                  <EmptyState>Nenhum cliente aguardando na fila.</EmptyState>
                )
              ) : todayAppointments.length ? (
                <div className="queue-real-list">
                  {todayAppointments.map((item) => (
                    <button
                      className={
                        selectedClientId === item.cliente_ref ? "selected" : ""
                      }
                      key={item.id}
                      onClick={() =>
                        item.cliente_ref
                          ? openClient(item.cliente_ref)
                          : feedback(
                              "Este agendamento ainda não está vinculado a um cliente.",
                            )
                      }
                    >
                      <CalendarDays size={17} />
                      <span>
                        <strong>{item.client_name}</strong>
                        <small>{item.time || "Horário não definido"}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState>Nenhum agendamento para hoje.</EmptyState>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="side-panel-heading">
              <div>
                <strong>
                  <Sparkles size={15} /> Copiloto IA
                </strong>
                <small>Apoio durante o atendimento</small>
              </div>
              <Badge className="attention">IA</Badge>
            </div>
            <div className="copilot-context">
              <MessageCircle size={14} />
              <span>
                Falando sobre:{" "}
                <strong>
                  {selectedClient?.name || "nenhum atendimento aberto"}
                </strong>
              </span>
            </div>
            <div className="copilot-body">
              <div className="copilot-welcome">
                <div className="copilot-avatar">
                  <Bot size={15} />
                </div>
                <p>
                  {copilotLoading
                    ? "Analisando o contexto com segurança…"
                    : copilotAnswer ||
                      (selectedClient
                        ? `Contexto de ${selectedClient.name} carregado com ${selectedMessages.length} mensagens.`
                        : "Olá, contador! Abra um atendimento para receber sugestões contextualizadas.")}
                </p>
              </div>
              {copilotAnswer && (
                <Button
                  className="secondary full"
                  onClick={() => {
                    setMessageText(copilotAnswer);
                    feedback(
                      "Rascunho levado ao campo de mensagem para sua revisão.",
                    );
                  }}
                >
                  Usar como rascunho
                </Button>
              )}
            </div>
            <div className="copilot-skill">
              <Brain size={15} />
              <select
                aria-label="Skill ativa"
                value={selectedSkill}
                onChange={(event) => setSelectedSkill(event.target.value)}
              >
                <option value="">Sem skill ativa — resposta padrão</option>
                {copilotSkills.map((skill) => (
                  <option value={skill.id} key={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="copilot-chips">
              {copilotShortcuts.map((shortcut) => (
                <button
                  key={shortcut.id}
                  disabled={copilotLoading || !selectedClient}
                  onClick={() => {
                    setCopilotPrompt(shortcut.prompt);
                    void askCopilot("pergunta", shortcut.prompt);
                  }}
                >
                  {shortcut.label}
                </button>
              ))}
              <button
                disabled={copilotLoading}
                onClick={() => askCopilot("resumo")}
              >
                Resumir conversa
              </button>
              <button
                disabled={copilotLoading}
                onClick={() => askCopilot("rascunho")}
              >
                Sugerir resposta
              </button>
              <button
                disabled={copilotLoading}
                onClick={() => askCopilot("pendencias")}
              >
                Identificar pendências
              </button>
            </div>
            <div className="copilot-composer">
              <Input
                value={copilotPrompt}
                onChange={(event) => setCopilotPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void askCopilot("pergunta");
                  }
                }}
                aria-label="Pergunta para o copiloto"
                placeholder="Pergunte algo à IA..."
              />
              <Button
                disabled={copilotLoading || !selectedClient}
                className="icon orange-action"
                aria-label="Enviar ao copiloto"
                onClick={() => askCopilot("pergunta")}
              >
                <Send size={15} />
              </Button>
            </div>
          </>
        )}
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="avatar">
            {selectedClient
              ? selectedClient.name.slice(0, 2).toUpperCase()
              : "AS"}
          </div>
          <div className="chat-client-copy">
            <strong>
              {selectedClient?.name || "Selecione um atendimento"}
            </strong>
            <small>
              {selectedClient?.email ||
                selectedClient?.cpf ||
                "CPF ou CNPJ do cliente"}
            </small>
          </div>
          <div className="chat-actions">
            <div className={`timer-capsule ${timerRunning ? "running" : ""}`}>
              <Clock3 size={14} />
              <strong>{formattedElapsed}</strong>
              <button
                disabled={!selectedClient}
                onClick={toggleTimer}
                aria-label={
                  timerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"
                }
              >
                {timerRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                disabled={!selectedClient || elapsed === 0}
                onClick={resetTimer}
                aria-label="Zerar cronômetro"
                title="Zerar cronômetro"
              >
                <RotateCcw size={13} />
              </button>
            </div>
            <button
              disabled={isSending || !selectedClient}
              className={`chat-action-button ${chatLocked ? "active-warning" : ""}`}
              onClick={toggleChatLock}
              aria-label={chatLocked ? "Desbloquear chat" : "Bloquear chat"}
              title={chatLocked ? "Desbloquear chat" : "Bloquear chat"}
            >
              {chatLocked ? (
                <UnlockKeyhole size={16} />
              ) : (
                <LockKeyhole size={16} />
              )}
            </button>
            <button
              className="chat-action-button has-label"
              disabled={isSending || !selectedClient}
              aria-label="Enviar para acompanhamento"
              title="Enviar para acompanhamento"
              onClick={() => changeStage("followup")}
            >
              <ListChecks size={16} />
              <span className="chat-action-label">Acompanhamento</span>
            </button>
            <button
              className="chat-finish-button"
              disabled={isSending || !selectedClient || chatLocked}
              aria-label="Encerrar conversa e preparar entrega"
              onClick={() => changeStage("finish")}
            >
              <CircleCheckBig size={16} />
              <span>Encerrar</span>
            </button>
          </div>
        </header>
        {selectedClient ? (
          <div className="chat-messages" aria-live="polite">
            {selectedMessages.map((item) => {
              const document =
                item.type === "document" || item.type === "audio"
                  ? chatDocuments.find(
                      (value) =>
                        value.cliente_ref === item.cliente_id &&
                        value.file_name === item.doc_name,
                    )
                  : undefined;
              return (
              <article className={`chat-message ${item.sender}`} key={item.id}>
                <div>
                  <strong>
                    {item.sender === "client" ? selectedClient.name : "Equipe"}
                  </strong>
                  <p>{item.text || item.type || "Mensagem"}</p>
                  {item.type === "document" && document && (
                    <a
                      className="chat-document-link"
                      href={`/api/documents/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={14} /> Abrir documento
                    </a>
                  )}
                  {item.type === "audio" && document && (
                    <audio controls preload="none" src={`/api/documents/${document.id}`} />
                  )}
                  {item.type === "audio" && item.duration && (
                    <small>Áudio · {item.duration}</small>
                  )}
                  <small>{item.time || ""}</small>
                </div>
              </article>
              );
            })}
            {!selectedMessages.length && (
              <EmptyState>
                Conversa iniciada. Envie a primeira mensagem.
              </EmptyState>
            )}
          </div>
        ) : (
          <div className="chat-empty">
            <div className="big-icon">
              <MessageCircle size={28} />
            </div>
            <h2>Atendimento em tempo real</h2>
            <p>
              Escolha um cliente na fila ou um agendamento do dia para abrir a
              conversa.
            </p>
          </div>
        )}
        <footer className="composer">
          <div className="chat-shortcuts" aria-label="Atalhos de mensagem">
            {chatShortcuts.map((shortcut) => (
              <button key={shortcut.id} disabled={!selectedClient || isSending || chatLocked} onClick={() => useChatShortcut(shortcut)}>
                {shortcut.label}
              </button>
            ))}
            {recording ? (
              <button className="chat-recording-button" disabled={isSending} onClick={stopRecording} title="Parar gravação e enviar">
                <Square size={14} /> Gravando {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
              </button>
            ) : (
              <button disabled={!selectedClient || isSending || chatLocked} onClick={startRecording} title="Gravar uma mensagem de áudio pelo microfone">
                <Mic size={14} /> Gravar áudio
              </button>
            )}
          </div>
          <Button
            className="icon ai-assist"
            title="Pedir sugestão à IA"
            aria-label="Pedir sugestão à IA"
            onClick={() => {
              if (selectedClient) {
                setTool("copilot");
                setPanelCollapsed(false);
                void askCopilot("rascunho");
              } else
                feedback(
                  "Selecione um atendimento antes de pedir uma sugestão.",
                );
            }}
          >
            <Sparkles size={17} />
          </Button>
          <input
            ref={attachmentRef}
            className="sr-only"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={uploadAttachment}
          />
          <Button
            className="icon secondary"
            title="Anexar arquivo"
            aria-label="Anexar arquivo"
            disabled={!selectedClient || uploading}
            onClick={() => attachmentRef.current?.click()}
          >
            {uploading ? <Upload size={17} /> : <Paperclip size={17} />}
          </Button>
          <Input
            value={messageText}
            onChange={(event) => {
              setMessageText(event.target.value);
              if (event.target.value.trim()) notifyClientTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            placeholder={
              chatLocked ? "Chat bloqueado" : "Digite uma mensagem ou '/'..."
            }
            disabled={!selectedClient || chatLocked || isSending}
          />
          <Button
            className="icon orange-action"
            aria-label="Enviar mensagem"
            onClick={submitMessage}
            disabled={
              !selectedClient || chatLocked || isSending || !messageText.trim()
            }
          >
            <Send size={17} />
          </Button>
        </footer>
      </main>
    </div>
  );
}

const emptyDossier = (client: ClientRecord): ClientDossierInput => ({
  id: client.id,
  name: client.name,
  cpf: client.cpf || "",
  email: client.email || "",
  phone: client.phone || "",
  status: client.status || "waiting",
  taxType: client.tax_type || "",
  regimeTributario: client.regime_tributario || "",
  sexo: client.sexo || "",
  cep: client.cep || "",
  endereco: client.endereco || "",
  numero: client.numero || "",
  bairro: client.bairro || "",
  cidade: client.cidade || "",
  estado: client.estado || "",
  canalResultado: client.canal_resultado || "area_cliente",
  diagnosis: client.diagnosis || "",
  treatment: client.treatment || "",
  honorarios: Number(client.honorarios) || 0,
  notas: client.notas || "",
  checklist:
    client.checklist &&
    typeof client.checklist === "object" &&
    !Array.isArray(client.checklist)
      ? (client.checklist as Record<string, boolean>)
      : {},
  evidences: Array.isArray(client.evidences)
    ? client.evidences
        .filter(
          (item): item is { id: string; text: string; selected: boolean } =>
            Boolean(item && typeof item === "object" && "text" in item),
        )
        .map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          text: String(item.text),
          selected: Boolean(item.selected),
        }))
    : [],
});

export function ClientesIntegralView({
  data = emptyClientsData,
  operationsData = emptyOperationsData,
  currentStaffId,
  filaRestrita = false,
}: {
  data?: ClientsData;
  operationsData?: OperationsData;
  currentStaffId?: string;
  filaRestrita?: boolean;
}) {
  const [tab, setTab] = useState(tabsByView.clientes[0]);
  const [clients, setClients] = useState(data.clients);
  const [clientGuides, setClientGuides] = useState(data.guides);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [dossier, setDossier] = useState<ClientDossierInput | null>(null);
  const [section, setSection] = useState<
    "cadastro" | "prontuario" | "historico" | "pagamentos" | "recorrencia"
  >("cadastro");
  const [pending, startTransition] = useTransition();
  const [newChecklist, setNewChecklist] = useState("");
  const [newEvidence, setNewEvidence] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    cpf: "",
    email: "",
    phone: "",
    senha: "",
  });
  const [resetPassword, setResetPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [vault, setVault] = useState<{
    status: "idle" | "loading" | "empty" | "pending" | "viewed" | "deleted" | "expired" | "error";
    expiresAt?: string;
    password?: string;
  }>({ status: "idle" });
  const [documentAnalysis, setDocumentAnalysis] = useState<
    Record<number, Record<string, unknown>>
  >({});
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    void fetch("/api/team", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : []))
      .then((items: Array<{ id?: string | null; name?: string | null; nome?: string | null; email?: string | null }>) =>
        setAssignees(
          items
            .filter((item) => item.id)
            .map((item) => ({ id: String(item.id), name: item.nome || item.name || item.email || "Equipe" })),
        ),
      )
      .catch(() => setAssignees([]));
  }, []);
  function assignResponsavel(clientId: string, responsavelId: string) {
    startTransition(async () => {
      const result = await assignClientResponsavel({
        clientId,
        responsavelId: responsavelId || null,
      });
      feedback(result.message);
      if (result.ok)
        setClients((items) =>
          items.map((item) =>
            item.id === clientId ? { ...item, responsavel_id: responsavelId || null } : item,
          ),
        );
    });
  }
  const [showArquivados, setShowArquivados] = useState(false);
  function reactivate(clientId: string) {
    startTransition(async () => {
      const result = await reactivateClient({ clientId });
      feedback(result.message);
      if (result.ok)
        setClients((items) =>
          items.map((item) =>
            item.id === clientId ? { ...item, arquivado_em: null } : item,
          ),
        );
    });
  }
  const [analyzingDocument, setAnalyzingDocument] = useState<number | null>(null);
  const [aiDossierPending, setAiDossierPending] = useState(false);
  const [recurrence, setRecurrence] = useState({
    tipo: "Acompanhamento mensal",
    diaVenc: 10,
    valor: 0,
  });
  const [finishedFilter, setFinishedFilter] = useState<
    "todos" | "hoje" | "semana" | "mes"
  >("todos");
  function finishedInWindow(client: ClientRecord) {
    if (finishedFilter === "todos") return true;
    if (
      !["done", "locked"].includes(client.status || "") ||
      !client.ultimo_atendimento_finalizado_em
    )
      return false;
    const finalizado = new Date(client.ultimo_atendimento_finalizado_em);
    if (Number.isNaN(finalizado.getTime())) return false;
    const agora = new Date();
    if (finishedFilter === "hoje")
      return finalizado.toDateString() === agora.toDateString();
    if (finishedFilter === "semana") {
      const start = new Date(agora);
      start.setDate(agora.getDate() - agora.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return finalizado >= start && finalizado < end;
    }
    return (
      finalizado.getFullYear() === agora.getFullYear() &&
      finalizado.getMonth() === agora.getMonth()
    );
  }
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = clients
    .filter(
      (client) =>
        (tab !== "Clientes Recorrentes" || client.recorrente) &&
        (showArquivados || !client.arquivado_em) &&
        finishedInWindow(client) &&
        (!filaRestrita ||
          !client.responsavel_id ||
          client.responsavel_id === currentStaffId) &&
        (!normalized ||
          [client.name, client.cpf, client.email, client.phone].some((value) =>
            value?.toLocaleLowerCase("pt-BR").includes(normalized),
          )),
    )
    .sort((a, b) =>
      finishedFilter === "todos"
        ? 0
        : new Date(b.ultimo_atendimento_finalizado_em || 0).getTime() -
          new Date(a.ultimo_atendimento_finalizado_em || 0).getTime(),
    );
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((value) => value[0])
      .join("")
      .toUpperCase();
  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  const selectedDocuments = selected
    ? data.documents.filter((item) => item.cliente_ref === selected.id)
    : [];
  const selectedHistory = selected
    ? data.history.filter((item) => item.cliente_id === selected.id)
    : [];
  const selectedTriages = selected
    ? data.triages.filter((item) => item.cliente_ref === selected.id)
    : [];
  const selectedCharges = selected
    ? operationsData.charges.filter((item) => item.cliente_ref === selected.id)
    : [];
  const latestTriage = selectedTriages.find((item) => item.status !== "arquivada") || selectedTriages[0];
  const triageCatalogValue = operationsData.settings.find(
    (item) => item.chave === "triagem_assuntos",
  )?.valor;
  const triageCatalog = Array.isArray(triageCatalogValue)
    ? triageCatalogValue
        .filter(
          (item) =>
            Boolean(item && typeof item === "object" && !Array.isArray(item)),
        )
        .map((item) => item as Record<string, unknown>)
    : [];
  const selectedGuides = selected
    ? clientGuides.filter((item) => item.cliente_ref === selected.id)
    : [];
  function completeClientGuide(id: number) {
    startTransition(async () => {
      const result = await markMonthlyGuideGenerated(id);
      if (result.ok)
        setClientGuides((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, status: "gerada", gerada_em: new Date().toISOString() }
              : item,
          ),
        );
      feedback(result.message);
    });
  }
  async function analyzeDocument(documentId: number) {
    setAnalyzingDocument(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ai?: Record<string, unknown>;
        detail?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.detail ||
            (payload.error === "ia_not_configured"
              ? "A leitura por IA ainda não está configurada."
              : "Não foi possível analisar o documento."),
        );
      setDocumentAnalysis((current) => ({
        ...current,
        [documentId]: payload.ai || {},
      }));
      feedback("Documento analisado pela IA.");
    } catch (reason) {
      feedback(
        reason instanceof Error
          ? reason.message
          : "Não foi possível analisar o documento.",
      );
    } finally {
      setAnalyzingDocument(null);
    }
  }
  async function suggestDossierWithAI() {
    if (!selected || !dossier) return;
    setAiDossierPending(true);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selected.id, mode: "diagnostico" }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        diagnosis?: string;
        treatment?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          result.error === "ia_not_configured"
            ? "A IA ainda não está configurada."
            : "Não foi possível gerar a sugestão.",
        );
      setDossier((current) =>
        current
          ? {
              ...current,
              diagnosis: result.diagnosis || current.diagnosis,
              treatment: result.treatment || current.treatment,
            }
          : current,
      );
      feedback("Sugestão aplicada. Revise e salve o prontuário.");
    } catch (reason) {
      feedback(reason instanceof Error ? reason.message : "Falha ao consultar a IA.");
    } finally {
      setAiDossierPending(false);
    }
  }
  function applyTriageToDossier() {
    if (!dossier || !latestTriage?.assunto) return;
    const subject = triageCatalog.find(
      (item) => String(item.id || "") === latestTriage.assunto,
    );
    if (!subject) {
      feedback("O assunto desta triagem não existe mais no catálogo atual.");
      return;
    }
    const answers =
      latestTriage.respostas &&
      typeof latestTriage.respostas === "object" &&
      !Array.isArray(latestTriage.respostas)
        ? (latestTriage.respostas as Record<string, unknown>)
        : {};
    const conditional =
      subject.diagnosticoPorResposta &&
      typeof subject.diagnosticoPorResposta === "object" &&
      !Array.isArray(subject.diagnosticoPorResposta)
        ? (subject.diagnosticoPorResposta as Record<string, unknown>)
        : {};
    const map =
      conditional.mapa &&
      typeof conditional.mapa === "object" &&
      !Array.isArray(conditional.mapa)
        ? (conditional.mapa as Record<string, unknown>)
        : {};
    const answer = answers[String(conditional.pergunta || "")];
    const diagnosis = String(
      (answer != null ? map[String(answer)] : "") ||
        subject.diagnosticoProvavel ||
        dossier.diagnosis,
    );
    const documents = Array.isArray(subject.documentos)
      ? subject.documentos.filter((item): item is string => typeof item === "string")
      : [];
    const delivered = new Set(
      selectedDocuments.map((item) => item.checklist_item).filter(Boolean),
    );
    setDossier({
      ...dossier,
      diagnosis,
      checklist: {
        ...Object.fromEntries(documents.map((item) => [item, delivered.has(item)])),
        ...dossier.checklist,
      },
    });
    feedback("Triagem aplicada ao dossiê. Revise e salve as alterações.");
  }
  const notesEditorRef = useRef<HTMLDivElement>(null);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesStatus, setNotesStatus] = useState("");
  function scheduleSaveNotes(clientId: string, html: string) {
    setNotesStatus("Salvando…");
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(
      () => void saveNotesNow(clientId, html),
      800,
    );
  }
  async function saveNotesNow(clientId: string, html: string) {
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    const result = await persistClientNotes({ clientId, notas: html });
    setNotesStatus(result.ok ? "Anotações salvas." : result.message);
  }
  function execNotesCommand(command: string, value?: string) {
    notesEditorRef.current?.focus();
    if (command === "hiliteColor" && value) {
      if (!document.execCommand("hiliteColor", false, value))
        document.execCommand("backColor", false, value);
    } else {
      document.execCommand(command, false, value);
    }
    if (selected && notesEditorRef.current)
      scheduleSaveNotes(selected.id, notesEditorRef.current.innerHTML);
  }
  function open(
    client: ClientRecord,
    next:
      | "cadastro"
      | "prontuario"
      | "historico"
      | "pagamentos"
      | "recorrencia" = "cadastro",
  ) {
    setSelected(client);
    setDossier(emptyDossier(client));
    setSection(next);
    setRecurrence({
      tipo: client.recorrente_tipo || "Acompanhamento mensal",
      diaVenc: client.recorrente_dia_venc || 10,
      valor: Number(client.honorarios) || 0,
    });
    setResetPassword("");
    setVault({ status: "loading" });
    void loadVault(client.id);
  }
  useEffect(() => {
    if (section !== "prontuario" || !notesEditorRef.current || !dossier) return;
    notesEditorRef.current.innerHTML = dossier.notas || "";
    setNotesStatus("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, section]);
  useEffect(() => {
    const requestedClient = window.sessionStorage.getItem("contador-open-client");
    if (!requestedClient) return;
    const client = data.clients.find((item) => item.id === requestedClient);
    if (!client) return;
    window.sessionStorage.removeItem("contador-open-client");
    open(client, "recorrencia");
  }, []);
  async function callVault(action: "status" | "reveal" | "delete", clientId: string) {
    const response = await fetch("/api/clients/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, clientId }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      status?: "empty" | "pending" | "viewed" | "deleted" | "expired";
      expiresAt?: string;
      password?: string;
      error?: string;
    };
    if (!response.ok) throw new Error(result.error || "vault_failed");
    return result;
  }
  async function loadVault(clientId: string) {
    try {
      const result = await callVault("status", clientId);
      setVault({
        status: result.status || "empty",
        expiresAt: result.expiresAt,
      });
    } catch {
      setVault({ status: "error" });
    }
  }
  async function revealVault() {
    if (!selected) return;
    setVault((value) => ({ ...value, status: "loading" }));
    try {
      const result = await callVault("reveal", selected.id);
      setVault({ status: "viewed", password: result.password });
      window.setTimeout(
        () => setVault((value) => ({ ...value, password: undefined })),
        60_000,
      );
    } catch {
      setVault({ status: "error" });
      feedback("A credencial já foi aberta, apagada ou expirou.");
    }
  }
  async function deleteVault() {
    if (!selected || !window.confirm("Apagar a credencial sem visualizá-la?")) return;
    setVault((value) => ({ ...value, status: "loading" }));
    try {
      await callVault("delete", selected.id);
      setVault({ status: "deleted" });
      feedback("Credencial apagada do cofre.");
    } catch {
      setVault({ status: "error" });
      feedback("Não foi possível apagar a credencial agora.");
    }
  }
  function resetClientAccess() {
    if (!selected || resetPassword.length < 6) return;
    startTransition(async () => {
      const response = await fetch("/api/clients/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resetar_senha",
          payload: { clientId: selected.id, novaSenha: resetPassword },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        feedback(result.error || "Não foi possível redefinir a senha.");
        return;
      }
      setResetOpen(false);
      setResetPassword("");
      feedback("Senha do portal atualizada com segurança.");
    });
  }
  function save() {
    if (!dossier) return;
    startTransition(async () => {
      const result = await saveClientDossier(dossier);
      feedback(result.message);
      if (result.ok) {
        const updated = result.data as ClientRecord;
        setClients((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSelected(updated);
        setDossier(emptyDossier(updated));
      }
    });
  }
  function addChecklist() {
    if (!dossier || !newChecklist.trim()) return;
    const next = {
      ...dossier.checklist,
      [newChecklist.trim().slice(0, 120)]: false,
    };
    setDossier({ ...dossier, checklist: next });
    void persistClientChecklist({ clientId: dossier.id, checklist: next });
    setNewChecklist("");
  }
  function addEvidence() {
    if (!dossier || !newEvidence.trim()) return;
    setDossier((value) =>
      value
        ? {
            ...value,
            evidences: [
              ...value.evidences,
              {
                id: crypto.randomUUID(),
                text: newEvidence.trim(),
                selected: false,
              },
            ],
          }
        : value,
    );
    setNewEvidence("");
  }
  function create() {
    const senha = createForm.senha;
    if (senha.length < 6) {
      feedback("A senha inicial precisa ter pelo menos 6 caracteres.");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/clients/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "criar",
          payload: {
            name: createForm.name,
            cpfCnpj: createForm.cpf,
            email: createForm.email,
            phone: createForm.phone,
            senha,
          },
        }),
      });
      const result = await response
        .json()
        .catch(() => ({ error: "Resposta inválida" }));
      if (!response.ok) {
        feedback(result.error || "Não foi possível cadastrar o cliente.");
        return;
      }
      feedback("Cliente e acesso ao portal cadastrados.");
      setCreating(false);
      setCreateForm({ name: "", cpf: "", email: "", phone: "", senha: "" });
      window.location.reload();
    });
  }
  async function toggleRecurrence(ativar: boolean) {
    if (!selected) return;
    if (ativar && recurrence.valor <= 0) {
      feedback("Informe um valor mensal maior que zero.");
      return;
    }
    if (
      !ativar &&
      !window.confirm(
        "Cancelar a assinatura e desativar o acompanhamento recorrente?",
      )
    )
      return;
    const response = await fetch("/api/finance/recurrence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selected.id, ativar, ...recurrence }),
    });
    const result = await response
      .json()
      .catch(() => ({ error: "invalid_response" }));
    if (!response.ok) {
      feedback(
        result.error === "asaas_not_configured"
          ? "Configure a chave do Asaas antes de ativar."
          : "Não foi possível alterar a recorrência.",
      );
      return;
    }
    const updated = {
      ...selected,
      recorrente: ativar,
      recorrente_tipo: ativar ? recurrence.tipo : null,
      recorrente_dia_venc: ativar ? recurrence.diaVenc : null,
      honorarios: ativar ? recurrence.valor : selected.honorarios,
    };
    setSelected(updated);
    setDossier(emptyDossier(updated));
    setClients((items) =>
      items.map((item) => (item.id === updated.id ? updated : item)),
    );
    feedback(
      ativar
        ? "Recorrência e cobrança automática ativadas."
        : "Recorrência cancelada.",
    );
  }
  return (
    <div className="view-stack">
      <PageTitle
        title="Clientes"
        description="CRM, cadastro completo, prontuário e recorrência financeira."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} /> Novo cliente
          </Button>
        }
      />
      <div className="stats-grid three">
        <Stat
          label="Clientes cadastrados"
          value={String(clients.length)}
          hint="Carteira completa"
        />
        <Stat
          label="Recorrentes"
          value={String(clients.filter((item) => item.recorrente).length)}
          hint="Assinaturas mensais"
          tone="blue"
        />
        <Stat
          label="Mensagens pendentes"
          value={String(
            data.messages.filter(
              (item) => item.sender === "client" && !item.read_at,
            ).length,
          )}
          hint="Aguardando resposta"
          tone="orange"
        />
      </div>
      <Tabs view="clientes" active={tab} onChange={setTab} />
      <Card>
        <div className="table-tools">
          <div className="search-field">
            <Search size={15} />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
            />
          </div>
          <div className="tabs" role="tablist">
            {(
              [
                ["todos", "Todos"],
                ["hoje", "Hoje"],
                ["semana", "Semana"],
                ["mes", "Mês"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={finishedFilter === value}
                className={finishedFilter === value ? "active" : ""}
                onClick={() => setFinishedFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={showArquivados}
              onChange={(event) => setShowArquivados(event.target.checked)}
            />
            Mostrar arquivados
          </label>
          <Badge>{visible.length} resultados</Badge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Serviço</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="person">
                      <div className="avatar small">
                        {initials(client.name)}
                      </div>
                      <strong>{client.name}</strong>
                    </div>
                  </td>
                  <td>{client.cpf || "—"}</td>
                  <td>
                    <div className="table-person-copy">
                      <span>{client.email || "Sem e-mail"}</span>
                      <small>{client.phone || "Sem telefone"}</small>
                    </div>
                  </td>
                  <td>
                    {client.recorrente ? (
                      <Badge className="success">
                        {client.recorrente_tipo || "Mensal"}
                      </Badge>
                    ) : (
                      <span className="muted">Avulso</span>
                    )}
                  </td>
                  <td>
                    <Badge>{client.status || "waiting"}</Badge>
                  </td>
                  <td>
                    <Button
                      className="icon ghost"
                      onClick={() =>
                        open(
                          client,
                          tab === "Clientes Recorrentes"
                            ? "recorrencia"
                            : "cadastro",
                        )
                      }
                      aria-label={`Abrir ${client.name}`}
                    >
                      <ChevronRight size={17} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>Nenhum cliente neste filtro.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {selected && dossier && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <Card className="client-dossier" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div className="client-detail-title">
                <div className="avatar profile">{initials(selected.name)}</div>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.cpf || selected.email || "Cadastro interno"}</p>
                </div>
              </div>
              <div className="dialog-head-actions">
                <Button
                  className="secondary"
                  onClick={() => {
                    setResetPassword("");
                    setResetOpen(true);
                  }}
                >
                  Redefinir senha
                </Button>
                <Button className="icon ghost" onClick={() => setSelected(null)}>
                  <X size={18} />
                </Button>
              </div>
            </div>
            <div className="dossier-tabs">
              {(
                [
                  "cadastro",
                  "prontuario",
                  "historico",
                  "pagamentos",
                  "recorrencia",
                ] as const
              ).map((item) => (
                <button
                  key={item}
                  className={section === item ? "active" : ""}
                  onClick={() => setSection(item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            {section === "cadastro" && (
              <div className="profile-form dossier-body">
                {selected.arquivado_em && (
                  <div className="archived-banner">
                    <span>
                      Cliente arquivado por inatividade em{" "}
                      {new Date(selected.arquivado_em).toLocaleDateString("pt-BR")}
                      . Documentos e relatórios continuam guardados.
                    </span>
                    <Button onClick={() => reactivate(selected.id)}>
                      Reativar cliente
                    </Button>
                  </div>
                )}
                <label>
                  Responsável pelo atendimento
                  <select
                    value={selected.responsavel_id || ""}
                    onChange={(event) =>
                      assignResponsavel(selected.id, event.target.value)
                    }
                  >
                    <option value="">Sem responsável (fila geral)</option>
                    {assignees.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Card className="gov-readiness-card">
                  <div className="card-heading">
                    <div>
                      <ShieldCheck size={18} />
                      <strong>Preparação gov.br e cofre temporário</strong>
                    </div>
                    <Badge className={vault.status === "pending" ? "success" : ""}>
                      {vault.status === "loading"
                        ? "Consultando…"
                        : vault.status === "pending"
                          ? "Credencial disponível"
                          : vault.status === "error"
                            ? "Indisponível"
                            : "Sem credencial pendente"}
                    </Badge>
                  </div>
                  <p className="muted">
                    Nenhuma senha é salva no cadastro, chat ou relatórios. O cofre
                    permite uma única visualização e apaga o conteúdo cifrado.
                  </p>
                  {vault.status === "pending" && (
                    <div className="inline-actions">
                      <Button className="secondary" onClick={revealVault}>
                        Revelar uma única vez
                      </Button>
                      <Button className="ghost" onClick={deleteVault}>
                        Apagar sem visualizar
                      </Button>
                      {vault.expiresAt && (
                        <small>
                          Expira em {new Date(vault.expiresAt).toLocaleString("pt-BR")}
                        </small>
                      )}
                    </div>
                  )}
                  {vault.password && (
                    <div className="vault-reveal" role="status">
                      <strong>Exibição única — será ocultada em 60 segundos</strong>
                      <code>{vault.password}</code>
                      <Button
                        className="secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(vault.password || "");
                          feedback("Senha copiada; apague-a da área de transferência após o uso.");
                        }}
                      >
                        Copiar senha
                      </Button>
                    </div>
                  )}
                </Card>
                <div className="form-grid">
                  <label>
                    Nome completo
                    <Input
                      value={dossier.name}
                      onChange={(event) =>
                        setDossier({ ...dossier, name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    CPF/CNPJ
                    <Input
                      value={dossier.cpf}
                      onChange={(event) =>
                        setDossier({ ...dossier, cpf: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    E-mail
                    <Input
                      type="email"
                      value={dossier.email}
                      onChange={(event) =>
                        setDossier({ ...dossier, email: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Telefone
                    <Input
                      value={dossier.phone}
                      onChange={(event) =>
                        setDossier({ ...dossier, phone: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={dossier.status}
                      onChange={(event) =>
                        setDossier({ ...dossier, status: event.target.value })
                      }
                    >
                      <option value="waiting">Aguardando</option>
                      <option value="active">Ativo</option>
                      <option value="docs">Aguardando documentos</option>
                      <option value="locked">Chat bloqueado</option>
                      <option value="done">Concluído</option>
                    </select>
                  </label>
                  <label>
                    Regime tributário
                    <Input
                      value={dossier.regimeTributario}
                      onChange={(event) =>
                        setDossier({
                          ...dossier,
                          regimeTributario: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    CEP
                    <Input
                      value={dossier.cep}
                      onChange={(event) =>
                        setDossier({ ...dossier, cep: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Endereço
                    <Input
                      value={dossier.endereco}
                      onChange={(event) =>
                        setDossier({ ...dossier, endereco: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Número
                    <Input
                      value={dossier.numero}
                      onChange={(event) =>
                        setDossier({ ...dossier, numero: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Bairro
                    <Input
                      value={dossier.bairro}
                      onChange={(event) =>
                        setDossier({ ...dossier, bairro: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Cidade
                    <Input
                      value={dossier.cidade}
                      onChange={(event) =>
                        setDossier({ ...dossier, cidade: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    UF
                    <Input
                      value={dossier.estado}
                      maxLength={2}
                      onChange={(event) =>
                        setDossier({ ...dossier, estado: event.target.value })
                      }
                    />
                  </label>
                </div>
              </div>
            )}
            {section === "prontuario" && (
              <div className="dossier-body dossier-prontuario">
                <div className="profile-form">
                  <div className="dossier-ai-actions">
                    <Button
                      className="secondary"
                      disabled={aiDossierPending}
                      onClick={() => void suggestDossierWithAI()}
                    >
                      <Sparkles size={15} />
                      {aiDossierPending ? "Analisando…" : "Sugerir diagnóstico com IA"}
                    </Button>
                    <Button
                      className="secondary"
                      disabled={!latestTriage?.assunto}
                      onClick={applyTriageToDossier}
                    >
                      <ClipboardList size={15} /> Aplicar triagem ao dossiê
                    </Button>
                  </div>
                  {latestTriage && (
                    <div className="triage-inline-summary">
                      <strong>{latestTriage.assunto || "Triagem"}</strong>
                      <span>{latestTriage.descricao || "Sem relato complementar."}</span>
                      <small>Status: {latestTriage.status}</small>
                    </div>
                  )}
                  <label>
                    Diagnóstico fiscal
                    <textarea
                      rows={3}
                      value={dossier.diagnosis}
                      onChange={(event) =>
                        setDossier({
                          ...dossier,
                          diagnosis: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Tratamento recomendado (passos)
                    <textarea
                      rows={7}
                      value={dossier.treatment}
                      onChange={(event) =>
                        setDossier({
                          ...dossier,
                          treatment: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Honorários (R$)
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={dossier.honorarios}
                      onChange={(event) =>
                        setDossier({
                          ...dossier,
                          honorarios: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="notes-label-row">
                      Notas internas
                      <small>{notesStatus}</small>
                    </span>
                    <div className="notes-toolbar">
                      <button
                        type="button"
                        onClick={() => execNotesCommand("bold")}
                        title="Negrito"
                      >
                        <b>N</b>
                      </button>
                      <button
                        type="button"
                        onClick={() => execNotesCommand("insertUnorderedList")}
                        title="Lista"
                      >
                        <ListChecks size={14} />
                      </button>
                      {["#fef08a", "#bbf7d0", "#bfdbfe"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="notes-color-swatch"
                          style={{ backgroundColor: color }}
                          title="Destacar"
                          onClick={() => execNotesCommand("hiliteColor", color)}
                        />
                      ))}
                    </div>
                    <div
                      ref={notesEditorRef}
                      className="notes-editor"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(event) => {
                        if (!selected) return;
                        scheduleSaveNotes(
                          selected.id,
                          event.currentTarget.innerHTML,
                        );
                        setDossier((value) =>
                          value
                            ? { ...value, notas: event.currentTarget.innerHTML }
                            : value,
                        );
                      }}
                      onBlur={(event) => {
                        if (!selected) return;
                        void saveNotesNow(
                          selected.id,
                          event.currentTarget.innerHTML,
                        );
                      }}
                    />
                  </label>
                </div>
                <div>
                  <Card>
                    <strong>Checklist de documentos</strong>
                    <div className="dossier-checklist">
                      {Object.entries(dossier.checklist).map(
                        ([label, checked]) => (
                          <label key={label}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = {
                                  ...dossier.checklist,
                                  [label]: !checked,
                                };
                                setDossier({ ...dossier, checklist: next });
                                void persistClientChecklist({
                                  clientId: dossier.id,
                                  checklist: next,
                                });
                              }}
                            />
                            <span>{label}</span>
                            <button
                              onClick={() => {
                                const next = { ...dossier.checklist };
                                delete next[label];
                                setDossier({ ...dossier, checklist: next });
                                void persistClientChecklist({
                                  clientId: dossier.id,
                                  checklist: next,
                                });
                              }}
                            >
                              <X size={12} />
                            </button>
                          </label>
                        ),
                      )}
                    </div>
                    <div className="inline-form">
                      <Input
                        value={newChecklist}
                        onChange={(event) =>
                          setNewChecklist(event.target.value)
                        }
                        placeholder="Novo documento"
                      />
                      <Button className="secondary" onClick={addChecklist}>
                        <Plus size={14} />
                      </Button>
                    </div>
                  </Card>
                  <Card>
                    <strong>Evidências</strong>
                    <div className="availability-pills">
                      {dossier.evidences.map((item) => (
                        <button
                          className={item.selected ? "selected" : ""}
                          key={item.id}
                          onClick={() =>
                            setDossier({
                              ...dossier,
                              evidences: dossier.evidences.map((value) =>
                                value.id === item.id
                                  ? { ...value, selected: !value.selected }
                                  : value,
                              ),
                            })
                          }
                        >
                          {item.text}
                        </button>
                      ))}
                    </div>
                    <div className="inline-form">
                      <Input
                        value={newEvidence}
                        onChange={(event) => setNewEvidence(event.target.value)}
                        placeholder="Nova evidência"
                      />
                      <Button className="secondary" onClick={addEvidence}>
                        <Plus size={14} />
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}
            {section === "historico" && (
              <div className="dossier-body">
                <div className="client-detail-grid">
                  <section>
                    <span>Documentos</span>
                    <strong>{selectedDocuments.length}</strong>
                  </section>
                  <section>
                    <span>Triagens</span>
                    <strong>{selectedTriages.length}</strong>
                  </section>
                  <section>
                    <span>Atendimentos</span>
                    <strong>{selectedHistory.length}</strong>
                  </section>
                  <section>
                    <span>Honorários</span>
                    <strong>{money(Number(selected.honorarios) || 0)}</strong>
                  </section>
                </div>
                <div className="client-document-list">
                  {selectedDocuments.map((document) => {
                    const stored =
                      document.ai_extracted &&
                      typeof document.ai_extracted === "object" &&
                      !Array.isArray(document.ai_extracted)
                        ? (document.ai_extracted as Record<string, unknown>)
                        : null;
                    const analysis = documentAnalysis[document.id] || stored;
                    return (
                      <article className="client-document-card" key={document.id}>
                        <div className="client-document-row">
                          <a
                            href={`/api/documents/${document.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileText size={16} />
                            <span>
                              <strong>{document.file_name}</strong>
                              <small>
                                {document.mime || "Arquivo"}
                                {document.size_bytes
                                  ? ` · ${Math.ceil(document.size_bytes / 1024)} KB`
                                  : ""}
                              </small>
                            </span>
                            <ArrowUpRight size={15} />
                          </a>
                          {!analysis && (
                            <Button
                              className="secondary compact"
                              disabled={analyzingDocument === document.id}
                              onClick={() => analyzeDocument(document.id)}
                            >
                              <Sparkles size={14} />
                              {analyzingDocument === document.id
                                ? "Lendo…"
                                : "Ler com IA"}
                            </Button>
                          )}
                        </div>
                        {analysis && (
                          <div className="document-ai-result">
                            <strong>{String(analysis.tipo || "Documento")}</strong>
                            <p>{String(analysis.resumo || "Análise concluída.")}</p>
                            {Boolean(analysis.diagnostico) && (
                              <span>
                                <b>Diagnóstico:</b> {String(analysis.diagnostico)}
                              </span>
                            )}
                            {Boolean(analysis.dados) && <small>{String(analysis.dados)}</small>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!selectedDocuments.length && (
                    <EmptyState>Nenhum documento no prontuário.</EmptyState>
                  )}
                </div>
                <div className="client-timeline">
                  {selectedHistory.map((item) => (
                    <article key={item.id}>
                      <span className="timeline-dot history" />
                      <div>
                        <strong>
                          {item.assunto || "Atendimento finalizado"}
                        </strong>
                        <p>
                          {item.modalidade || "Atendimento"} ·{" "}
                          {item.honorarios
                            ? money(item.honorarios)
                            : "sem honorários"}
                        </p>
                        <small>
                          {item.finalizado_em
                            ? new Date(item.finalizado_em).toLocaleString(
                                "pt-BR",
                              )
                            : "—"}
                        </small>
                      </div>
                    </article>
                  ))}
                  {!selectedHistory.length && (
                    <EmptyState>Nenhum atendimento finalizado.</EmptyState>
                  )}
                </div>
              </div>
            )}
            {section === "pagamentos" && (
              <div className="dossier-body">
                <div className="client-detail-grid">
                  <section>
                    <span>Cobranças</span>
                    <strong>{selectedCharges.length}</strong>
                  </section>
                  <section>
                    <span>Pagas</span>
                    <strong>
                      {money(
                        selectedCharges
                          .filter((item) => item.status === "paid")
                          .reduce((total, item) => total + (item.valor_cents || 0), 0) / 100,
                      )}
                    </strong>
                  </section>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Serviço</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCharges.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td>{item.servico_id || item.modalidade || "—"}</td>
                        <td>{money((item.valor_cents || 0) / 100)}</td>
                        <td>
                          <Badge
                            className={item.status === "paid" ? "success" : ""}
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td>
                          {item.paid_at
                            ? new Date(item.paid_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selectedCharges.length && (
                  <EmptyState>Nenhuma cobrança para este cliente.</EmptyState>
                )}
              </div>
            )}
            {section === "recorrencia" && (
              <div className="dossier-body">
                <Card
                  className={selected.recorrente ? "recurrence-active" : ""}
                >
                  <div className="card-heading">
                    <div>
                      <CircleDollarSign size={18} />
                      <strong>Acompanhamento recorrente</strong>
                    </div>
                    <Badge className={selected.recorrente ? "success" : ""}>
                      {selected.recorrente ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="muted">
                    Cria ou cancela a assinatura mensal real no Asaas e
                    sincroniza o cadastro.
                  </p>
                  <div className="form-grid">
                    <label>
                      Tipo
                      <Input
                        value={recurrence.tipo}
                        disabled={Boolean(selected.recorrente)}
                        onChange={(event) =>
                          setRecurrence({
                            ...recurrence,
                            tipo: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Dia do vencimento
                      <Input
                        type="number"
                        min="1"
                        max="28"
                        value={recurrence.diaVenc}
                        disabled={Boolean(selected.recorrente)}
                        onChange={(event) =>
                          setRecurrence({
                            ...recurrence,
                            diaVenc: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Valor mensal (R$)
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={recurrence.valor}
                        disabled={Boolean(selected.recorrente)}
                        onChange={(event) =>
                          setRecurrence({
                            ...recurrence,
                            valor: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <Button
                    className={selected.recorrente ? "danger" : ""}
                    onClick={() => void toggleRecurrence(!selected.recorrente)}
                  >
                    {selected.recorrente
                      ? "Cancelar recorrência"
                      : "Ativar cobrança mensal"}
                  </Button>
                </Card>
                <Card>
                  <div className="card-heading">
                    <div>
                      <ReceiptText size={18} />
                      <strong>Guias mensais</strong>
                    </div>
                    <Badge>{selectedGuides.length}</Badge>
                  </div>
                  {selectedGuides.length ? (
                    <div className="records-list appointment-list">
                      {selectedGuides.map((guide) => (
                        <article key={guide.id}>
                          <div>
                            <strong>{guide.competencia}</strong>
                            <span>{guide.observacao || "Acompanhamento mensal"}</span>
                            <small>
                              {guide.status === "gerada" ? "Gerada" : "Pendente"}
                              {guide.gerada_em
                                ? ` · ${new Date(guide.gerada_em).toLocaleDateString("pt-BR")}`
                                : ""}
                            </small>
                          </div>
                          {guide.status !== "gerada" && (
                            <Button className="secondary compact" disabled={pending} onClick={() => completeClientGuide(guide.id)}>
                              <Check size={14} /> Marcar gerada
                            </Button>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>Nenhuma guia registrada para este cliente.</EmptyState>
                  )}
                </Card>
                <Card>
                  <div className="card-heading">
                    <div>
                      <Paperclip size={18} />
                      <strong>Documentos</strong>
                    </div>
                    <Badge>{selectedDocuments.length}</Badge>
                  </div>
                  <div className="client-document-list">
                    {selectedDocuments.map((document) => (
                      <a key={document.id} href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer">
                        <FileText size={15} />
                        <span><strong>{document.file_name}</strong><small>{document.mime || "Arquivo"}</small></span>
                        <ArrowUpRight size={14} />
                      </a>
                    ))}
                    {!selectedDocuments.length && <EmptyState>Nenhum documento enviado.</EmptyState>}
                  </div>
                </Card>
              </div>
            )}
            <div className="dialog-actions">
              <Button
                className="secondary"
                onClick={() => {
                  window.location.hash = "atendimento";
                  setSelected(null);
                }}
              >
                <MessageCircle size={15} /> Abrir atendimento
              </Button>
              {section !== "historico" && section !== "recorrencia" && (
                <Button disabled={pending} onClick={save}>
                  <Save size={15} />
                  {pending ? "Salvando…" : "Salvar cadastro e prontuário"}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
      {resetOpen && selected && (
        <div className="dialog-backdrop dialog-backdrop-raised">
          <Card className="profile-dialog compact" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div>
                <h2>Redefinir senha do portal</h2>
                <p>Defina uma nova senha de acesso para {selected.name}.</p>
              </div>
              <Button className="icon ghost" onClick={() => setResetOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <label>
              Nova senha
              <Input
                autoFocus
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Mínimo de 6 caracteres"
              />
            </label>
            <div className="dialog-actions">
              <Button className="secondary" onClick={() => setResetOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={pending || resetPassword.length < 6}
                onClick={resetClientAccess}
              >
                {pending ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {creating && (
        <div className="dialog-backdrop">
          <Card className="profile-dialog">
            <div className="dialog-head">
              <div>
                <h2>Novo cliente</h2>
                <p>
                  Cadastre os dados mínimos; o prontuário pode ser completado
                  depois.
                </p>
              </div>
              <Button className="icon ghost" onClick={() => setCreating(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form">
              <label>
                Nome completo
                <Input
                  autoFocus
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, name: event.target.value })
                  }
                />
              </label>
              <label>
                CPF/CNPJ
                <Input
                  value={createForm.cpf}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, cpf: event.target.value })
                  }
                />
              </label>
              <label>
                E-mail
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, email: event.target.value })
                  }
                />
              </label>
              <label>
                Telefone
                <Input
                  value={createForm.phone}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, phone: event.target.value })
                  }
                />
              </label>
              <label>
                Senha inicial do portal
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={createForm.senha}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, senha: event.target.value })
                  }
                  placeholder="Mínimo de 6 caracteres"
                />
              </label>
            </div>
            <div className="dialog-actions">
              <Button className="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  pending ||
                  createForm.name.trim().length < 2 ||
                  createForm.senha.length < 6
                }
                onClick={create}
              >
                {pending ? "Cadastrando…" : "Cadastrar cliente"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const radarDescriptions: Record<string, string> = {
  "Caixa Postal": "Comunicações recebidas do e-CAC.",
  "Situação Fiscal": "Pendencias e diagnóstico fiscal consolidado.",
  Parcelamentos: "Parcelamentos ativos, atrasados e oportunidades.",
  "Dívida Ativa": "Débitos inscritos na PGFN.",
  CND: "Certidões, validade e impedimentos.",
};
type RadarPayload = Record<string, unknown>;
function RadarResult({
  result,
  clientDocument,
  onAction,
  busy,
}: {
  result: RadarPayload;
  clientDocument: string;
  onAction: (action: string, extra: RadarPayload) => void;
  busy: boolean;
}) {
  const pdf = typeof result.pdfBase64 === "string" ? result.pdfBase64 : "";
  const messages = Array.isArray(result.mensagens)
    ? (result.mensagens as RadarPayload[])
    : [];
  const systems = Array.isArray(result.sistemas)
    ? (result.sistemas as RadarPayload[])
    : [];
  const registrations = Array.isArray(result.inscricoes)
    ? (result.inscricoes as RadarPayload[])
    : [];
  if (pdf)
    return (
      <div className="radar-result-success">
        <CheckCircle2 size={18} />
        <div>
          <strong>Documento oficial gerado</strong>
          <span>Arquivo pronto para conferência.</span>
        </div>
        <a
          className="button"
          download={`documento-fiscal-${clientDocument || "cliente"}.pdf`}
          href={`data:application/pdf;base64,${pdf}`}
        >
          Baixar PDF
        </a>
      </div>
    );
  if (messages.length)
    return (
      <div className="radar-result-list">
        {messages.map((item, index) => (
          <article
            key={String(item.isn || index)}
          >
            <div>
              <strong>
                {String(
                  item.assunto ||
                    "Resultado",
                )}
              </strong>
              <span>
                {String(item.remetente || item.situacao || item.erro || "")}
              </span>
              <small>
                {item.data
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(String(item.data)))
                  : Array.isArray(item.pedidos)
                    ? `${item.pedidos.length} parcelamento(s)`
                    : ""}
              </small>
            </div>
            <Button
              className="secondary compact"
              disabled={busy || !item.isn}
              onClick={() => onAction("mensagem-detalhe", { isn: item.isn })}
            >
              Abrir mensagem
            </Button>
          </article>
        ))}
        <div className="radar-result-actions">
          <Button
            className="secondary compact"
            disabled={busy || Number(result.pagina || 1) <= 1}
            onClick={() =>
              onAction("caixa-postal", {
                pagina: Math.max(1, Number(result.pagina || 1) - 1),
                forcar: true,
              })
            }
          >
            Página anterior
          </Button>
          <Badge>Página {String(result.pagina || 1)}</Badge>
          <Button
            className="secondary compact"
            disabled={busy || result.temProxima === false}
            onClick={() =>
              onAction("caixa-postal", {
                pagina: Number(result.pagina || 1) + 1,
                forcar: true,
              })
            }
          >
            Próxima página
          </Button>
        </div>
      </div>
    );
  if (systems.length)
    return (
      <div className="radar-result-list">
        {systems.map((system, index) => {
          const requests = Array.isArray(system.pedidos)
            ? (system.pedidos as RadarPayload[])
            : [];
          const installments = Array.isArray(system.parcelas)
            ? (system.parcelas as RadarPayload[])
            : [];
          return (
            <article className="radar-system-result" key={String(system.sistema || index)}>
              <div>
                <strong>{String(system.sistema || "Parcelamento")}</strong>
                <span>{String(system.situacao || "Dados disponíveis")}</span>
                <small>{requests.length} pedido(s) · {installments.length} parcela(s)</small>
              </div>
              <div className="radar-inline-actions">
                {requests.map((request, requestIndex) => (
                  <Button
                    key={String(request.numeroParcelamento || requestIndex)}
                    className="secondary compact"
                    disabled={busy}
                    onClick={() =>
                      onAction("parcelamento-detalhe", {
                        sistema: system.sistema,
                        numeroParcelamento: request.numeroParcelamento || request.numero,
                        regime: result.regime,
                      })
                    }
                  >
                    Extrato {String(request.numeroParcelamento || request.numero || requestIndex + 1)}
                  </Button>
                ))}
                {installments.map((installment, installmentIndex) => (
                  <Button
                    key={String(installment.parcela || installment.numero || installmentIndex)}
                    className="secondary compact"
                    disabled={busy}
                    onClick={() =>
                      onAction("emitir-das", {
                        sistema: system.sistema,
                        parcela: installment.parcela || installment.numero || installment,
                        regime: result.regime,
                      })
                    }
                  >
                    Emitir DAS {String(installment.parcela || installment.numero || installmentIndex + 1)}
                  </Button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    );
  if (registrations.length)
    return (
      <div className="radar-result-list">
        {registrations.map((item, index) => (
          <article key={String(item.numeroInscricao || index)}>
            <div>
              <strong>{String(item.numeroInscricao || "Inscrição")}</strong>
              <span>{String(item.situacao || item.tipo || "")}</span>
            </div>
            <Button
              className="secondary compact"
              disabled={busy || !item.numeroInscricao}
              onClick={() => onAction("divida-ativa-detalhe", { numeroInscricao: item.numeroInscricao })}
            >
              Ver detalhe
            </Button>
          </article>
        ))}
      </div>
    );
  return (
    <pre className="radar-json-result">{JSON.stringify(result, null, 2)}</pre>
  );
}
export function RadarFiscalView({
  data = emptyOperationsData,
  clientsData: suppliedClients = emptyClientsData,
}: {
  data?: OperationsData;
  clientsData?: ClientsData;
}) {
  const clientsData: ClientsData = suppliedClients.clients.length
    ? suppliedClients
    : {
        ...suppliedClients,
        clients: data.radarClients as unknown as ClientRecord[],
      };
  const [tab, setTab] = useState(tabsByView.radar[0]);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [regime, setRegime] = useState("");
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarPayload | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const [detail, setDetail] = useState<RadarPayload | null>(null);
  const clients = clientsData.clients.filter(
    (item) =>
      item.cpf &&
      (!clientQuery ||
        `${item.name} ${item.cpf}`
          .toLowerCase()
          .includes(clientQuery.toLowerCase())),
  );
  const selected =
    clientsData.clients.find((item) => item.id === selectedId) || null;
  const related = data.serproQueries.filter(
    (item) =>
      (!selectedId || item.cliente_ref === selectedId) &&
      (tab === "Caixa Postal" ||
        `${item.id_sistema} ${item.id_servico}`
          .toLowerCase()
          .includes(tab.toLowerCase().split(" ")[0])),
  );
  async function callRadar(action: string, extra: RadarPayload = {}) {
    const response = await fetch("/api/radar-fiscal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: action,
        clienteRef: selectedId || undefined,
        ...extra,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as RadarPayload;
    if (!response.ok)
      throw new Error(
        String(payload.detail || payload.error || "Falha na consulta fiscal."),
      );
    return payload;
  }
  async function testConnection() {
    setLoading(true);
    setConnection("");
    try {
      const payload = await callRadar("capacidades");
      const authentication = await callRadar("testar-autenticacao", {
        documento: "00000000000",
      });
      setConnection(
        `Integra Contador: ${payload.integraContador ? "configurado" : "pendente"} • Autenticação: ${authentication.ok === false ? "falhou" : "validada"} • Dívida Ativa: ${payload.dividaAtiva ? "configurada" : "pendente"} • CND: ${payload.cnd ? "configurada" : "pendente"}`,
      );
    } catch (reason) {
      setConnection(
        reason instanceof Error ? reason.message : "Falha ao testar conexão.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function executeSubAction(action: string, extra: RadarPayload) {
    if (!selected) return;
    if (
      ["emitir-das", "parcelamento-detalhe", "divida-ativa-detalhe"].includes(action) &&
      !window.confirm("Continuar com esta consulta fiscal? Ela pode consumir uma requisição do provedor.")
    ) return;
    setLoading(true);
    setError("");
    try {
      const payload = await callRadar(action, extra);
      if (action === "caixa-postal") setResult(payload);
      else setDetail(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a ação.");
    } finally {
      setLoading(false);
    }
  }
  async function execute() {
    if (!selected) {
      feedback("Selecione um cliente com procuração eletrônica.");
      return;
    }
    if (tab === "Parcelamentos" && !regime) {
      feedback("Selecione MEI ou Simples Nacional.");
      return;
    }
    if (
      !window.confirm(
        `Consultar ${tab} para ${selected.name}? A atualização pode consumir uma requisição do serviço fiscal.`,
      )
    )
      return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let payload: RadarPayload;
      if (tab === "Situação Fiscal") {
        const protocol = await callRadar("sitfis-solicitar");
        if (!protocol.protocolo)
          throw new Error("A Receita não devolveu o protocolo SITFIS.");
        const wait = Math.min(Number(protocol.tempoEsperaMs) || 0, 20000);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        payload = await callRadar("sitfis-emitir", {
          protocolo: protocol.protocolo,
        });
      } else {
        const actions: Record<string, string> = {
          "Caixa Postal": "caixa-postal",
          Parcelamentos: "parcelamentos",
          "Dívida Ativa": "divida-ativa",
          CND: "cnd",
        };
        payload = await callRadar(actions[tab], {
          pagina: 1,
          regime: regime || undefined,
          forcar: force,
        });
      }
      setResult(payload);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível concluir a consulta.",
      );
    } finally {
      setLoading(false);
    }
  }
  const labels: Record<string, string> = {
    "Caixa Postal": "Consultar Caixa Postal",
    "Situação Fiscal": "Emitir Situação Fiscal",
    Parcelamentos: "Consultar Parcelamentos",
    "Dívida Ativa": "Consultar Dívida Ativa",
    CND: "Emitir CND oficial",
  };
  return (
    <div className="view-stack">
      <PageTitle
        title="Radar Fiscal"
        description="Consulte um serviço por vez e reutilize os dados já salvos para controlar o custo do Integra Contador."
      />
      <Card className="radar-client-selector">
        <div className="radar-client-search">
          <label>Cliente com procuração eletrônica</label>
          <div className="search-field">
            <Search size={15} />
            <Input
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Pesquisar cliente por nome ou CPF/CNPJ"
            />
          </div>
          <select
            value={selectedId}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedId(id);
              const client = clientsData.clients.find((item) => item.id === id);
              setRegime(client?.regime_tributario || "");
              setResult(null);
            }}
          >
            <option value="">Selecione um cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · {client.cpf}
              </option>
            ))}
          </select>
        </div>
        <div className="radar-client-meta">
          {selected ? (
            <>
              <strong>
                {selected.name} · {selected.cpf}
              </strong>
              <span>
                {selected.cpf} · uso somente interno
                {selected.regime_tributario
                  ? ` · ${selected.regime_tributario}`
                  : ""}
              </span>
            </>
          ) : (
            <>
              <strong>Nenhum cliente selecionado</strong>
              <span>
                Escolha um cliente para vincular o resultado e evitar consultas
                repetidas.
              </span>
            </>
          )}
        </div>
        <Button
          className="secondary"
          disabled={loading}
          onClick={testConnection}
        >
          <ShieldCheck size={16} /> Testar conexão
        </Button>
        {connection && (
          <div className="radar-connection" role="status">
            {connection}
          </div>
        )}
      </Card>
      <Tabs
        view="radar"
        active={tab}
        onChange={(value) => {
          setTab(value);
          setResult(null);
          setError("");
        }}
      />
      <Card className="radar-service-card">
        <div className="card-heading">
          <div>
            <Landmark size={18} />
            <strong>{tab}</strong>
          </div>
          <Badge>{related.length} no histórico</Badge>
        </div>
        <p className="muted">{radarDescriptions[tab]}</p>
        {tab === "Parcelamentos" && (
          <div className="radar-options">
            <select
              value={regime}
              onChange={(event) => setRegime(event.target.value)}
            >
              <option value="">Selecione o regime</option>
              <option value="simples">Simples Nacional</option>
              <option value="mei">MEI</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
              />{" "}
              Atualizar mesmo se houver dados salvos
            </label>
          </div>
        )}
        {tab === "Dívida Ativa" && (
          <label className="radar-force">
            <input
              type="checkbox"
              checked={force}
              onChange={(event) => setForce(event.target.checked)}
            />{" "}
            Atualizar mesmo se houver dados das últimas 24 horas
          </label>
        )}
        <Button disabled={loading || !selected} onClick={execute}>
          {loading ? <Clock3 size={16} /> : <ShieldCheck size={16} />}{" "}
          {loading ? "Consultando…" : labels[tab]}
        </Button>
        {error && (
          <div className="form-message" role="alert">
            {error}
          </div>
        )}
        {result && (
          <RadarResult
            result={result}
            clientDocument={selected?.cpf?.replace(/\D/g, "") || ""}
            onAction={(action, extra) => void executeSubAction(action, extra)}
            busy={loading}
          />
        )}
        {detail && (
          <div className="radar-detail-result">
            <div className="card-heading">
              <strong>Detalhe da consulta</strong>
              <Button className="icon ghost" onClick={() => setDetail(null)} aria-label="Fechar detalhe">
                <X size={15} />
              </Button>
            </div>
            <RadarResult
              result={detail}
              clientDocument={selected?.cpf?.replace(/\D/g, "") || ""}
              onAction={(action, extra) => void executeSubAction(action, extra)}
              busy={loading}
            />
          </div>
        )}
      </Card>
      <Card>
        <div className="card-heading">
          <div>
            <ClipboardList size={18} />
            <strong>Histórico de consultas</strong>
          </div>
          <Badge>{related.length}</Badge>
        </div>
        {related.length ? (
          <div className="records-list">
            {related.slice(0, 30).map((item) => (
              <article key={item.id}>
                <div className="record-icon">
                  <Landmark size={17} />
                </div>
                <div>
                  <strong>{item.id_servico}</strong>
                  <span>
                    {item.id_sistema} • {item.acao}
                  </span>
                  <small>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.criado_em))}
                  </small>
                </div>
                <Badge className={item.sucesso ? "success" : "attention"}>
                  {item.sucesso ? "Concluída" : item.erro_codigo || "Falha"}
                </Badge>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Nenhuma consulta registrada para este filtro.</EmptyState>
        )}
      </Card>
    </div>
  );
}

export function InsightsView({
  data = emptyOperationsData,
  clientsData = emptyClientsData,
}: {
  data?: OperationsData;
  clientsData?: ClientsData;
}) {
  const [period, setPeriod] = useState<
    "hoje" | "semana" | "mes" | "ano" | "tudo" | "custom"
  >("ano");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [operationalErrors, setOperationalErrors] = useState<Array<{
    id: number;
    codigo: string | null;
    origem: string;
    mensagem: string;
    rota: string | null;
    ocorrencias: number;
    ultimo_em: string;
    severidade: string;
  }>>([]);
  const [errorsLoading, setErrorsLoading] = useState(true);
  async function loadOperationalErrors() {
    setErrorsLoading(true);
    try {
      const response = await fetch("/api/operational-errors", { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as {
        erros?: typeof operationalErrors;
      };
      if (!response.ok) throw new Error("monitoring_unavailable");
      setOperationalErrors(result.erros || []);
    } catch {
      feedback("Não foi possível carregar os erros operacionais agora.");
    } finally {
      setErrorsLoading(false);
    }
  }
  async function resolveOperationalError(id: number) {
    const response = await fetch("/api/operational-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setOperationalErrors((items) => items.filter((item) => item.id !== id));
      feedback("Erro marcado como resolvido.");
    } else feedback("Não foi possível resolver este registro.");
  }
  useEffect(() => {
    void loadOperationalErrors();
  }, []);
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;
  if (period === "hoje") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start.getTime() + 86400000);
  }
  if (period === "semana") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start.getTime() + 7 * 86400000);
  }
  if (period === "mes") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  if (period === "ano") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  }
  if (period === "custom") {
    start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    end = dateTo
      ? new Date(new Date(`${dateTo}T00:00:00`).getTime() + 86400000)
      : null;
  }
  const history = clientsData.history.filter((item) => {
    const value = new Date(item.finalizado_em);
    return (!start || value >= start) && (!end || value < end);
  });
  const durations = history
    .map((item) => item.duracao_segundos)
    .filter((value): value is number => value !== null);
  const fees = history
    .map((item) => item.honorarios)
    .filter((value): value is number => value !== null);
  const averageDuration = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : null;
  const averageTicket = fees.length
    ? fees.reduce((sum, value) => sum + value, 0) / fees.length
    : null;
  const totalHours = durations.reduce((sum, value) => sum + value, 0) / 3600;
  const profitability = totalHours
    ? fees.reduce((sum, value) => sum + value, 0) / totalHours
    : null;
  const formatDuration = (seconds: number | null) =>
    seconds === null
      ? "—"
      : seconds >= 3600
        ? `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}min`
        : `${Math.round(seconds / 60)} min`;
  const money = (value: number | null) =>
    value === null
      ? "—"
      : new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
  const services = Object.entries(
    history.reduce<Record<string, number>>((acc, item) => {
      const key = item.tax_type || item.assunto || "Sem categoria";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const serviceDurations = Object.entries(
    history.reduce<Record<string, { total: number; count: number }>>(
      (acc, item) => {
        if (item.duracao_segundos === null) return acc;
        const key = item.tax_type || item.assunto || "Sem categoria";
        acc[key] ??= { total: 0, count: 0 };
        acc[key].total += item.duracao_segundos;
        acc[key].count += 1;
        return acc;
      },
      {},
    ),
  )
    .map(([name, value]) => ({
      name,
      value: Math.round(value.total / value.count / 60),
    }))
    .sort((a, b) => b.value - a.value);
  const sameDay = durations.filter((value) => value <= 86400);
  const extended = durations.filter((value) => value > 86400);
  const resolution = [
    { name: "Mesmo dia", value: sameDay.length },
    { name: "Acompanhamento", value: extended.length },
  ].filter((item) => item.value);
  const cities = Object.entries(
    clientsData.clients.reduce<Record<string, number>>((acc, item) => {
      if (item.cidade) acc[item.cidade] = (acc[item.cidade] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const sexes = Object.entries(
    clientsData.clients.reduce<Record<string, number>>((acc, item) => {
      if (item.sexo) acc[item.sexo] = (acc[item.sexo] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  const profitabilityByService = Object.entries(
    history.reduce<Record<string, { fees: number; seconds: number }>>(
      (acc, item) => {
        if (!item.duracao_segundos || item.honorarios === null) return acc;
        const key = item.tax_type || item.assunto || "Sem categoria";
        acc[key] ??= { fees: 0, seconds: 0 };
        acc[key].fees += item.honorarios;
        acc[key].seconds += item.duracao_segundos;
        return acc;
      },
      {},
    ),
  )
    .map(([name, values]) => ({
      name,
      value: Math.round(values.fees / (values.seconds / 3600)),
    }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
  const platformHealth = Object.entries(
    data.charges.reduce<Record<string, number>>((acc, item) => {
      const key = ["RECEIVED", "CONFIRMED", "PAID"].includes(
        String(item.status).toUpperCase(),
      )
        ? "Pagas"
        : ["PENDING", "OVERDUE"].includes(String(item.status).toUpperCase())
          ? "Em aberto"
          : "Outras";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  const chartData = [
    services,
    serviceDurations,
    resolution,
    profitabilityByService,
    sexes,
    cities,
    platformHealth,
  ];
  const pieData = [
    services,
    serviceDurations,
    resolution,
    profitabilityByService,
    sexes,
    cities,
    platformHealth,
  ];
  const titles = [
    "Distribuição por serviço",
    "Duração média por serviço",
    "Resolvido na hora x acompanhamento",
    "Ranking de rentabilidade",
    "Clientes por sexo",
    "Clientes por cidade",
    "Saúde da plataforma",
  ];
  return (
    <div className="view-stack">
      <PageTitle
        title="Insights"
        description="Números do seu negócio: volume, tempo de atendimento, rentabilidade e perfil dos clientes."
      />
      <Card className="insights-filter">
        <div className="period-capsule">
          {(["hoje", "semana", "mes", "ano", "tudo"] as const).map((value) => (
            <button
              className={period === value ? "active" : ""}
              key={value}
              onClick={() => setPeriod(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <div className="date-range">
          <Input
            type="date"
            aria-label="Data inicial"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <span>até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <Button
            className="secondary"
            disabled={!dateFrom && !dateTo}
            onClick={() => setPeriod("custom")}
          >
            Aplicar
          </Button>
        </div>
        <Badge className="success">Dados reais</Badge>
      </Card>
      <div className="stats-grid">
        <Stat
          label="Atendimentos no período"
          value={String(history.length)}
          hint="Histórico finalizado"
        />
        <Stat
          label="Duração média"
          value={formatDuration(averageDuration)}
          hint="Tempo por atendimento"
          tone="blue"
        />
        <Stat
          label="Ticket médio"
          value={money(averageTicket)}
          hint="Honorários por atendimento"
        />
        <Stat
          label="Rentabilidade média"
          value={profitability === null ? "—" : `${money(profitability)}/h`}
          hint="Receita por hora"
          tone="orange"
        />
      </div>
      <div className="chart-grid">
        {titles.map((title, index) => (
          <Card className="chart-card" key={title}>
            <div className="chart-card-head">
              <div>
                <strong>{title}</strong>
                <small>
                  {period === "custom"
                    ? `${dateFrom || "início"} até ${dateTo || "hoje"}`
                    : `Período: ${period}`}
                </small>
              </div>
              <ArrowUpRight size={16} />
            </div>
            <InsightChart
              variant={index}
              data={chartData[index]}
              pieData={pieData[index]}
            />
          </Card>
        ))}
      </div>
      <Card className="operational-errors-card">
        <div className="card-heading">
          <div>
            <AlertTriangle size={18} />
            <strong>Erros operacionais</strong>
          </div>
          <Button className="secondary compact" disabled={errorsLoading} onClick={() => void loadOperationalErrors()}>
            <RotateCcw size={14} /> {errorsLoading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
        {errorsLoading ? (
          <EmptyState>Carregando monitoramento…</EmptyState>
        ) : operationalErrors.length ? (
          <div className="records-list">
            {operationalErrors.map((error) => (
              <article key={error.id}>
                <div className="record-icon"><AlertTriangle size={16} /></div>
                <div>
                  <strong>{error.codigo || "Erro"} · {error.origem}</strong>
                  <span>{error.mensagem}{error.rota ? ` · ${error.rota}` : ""}</span>
                  <small>{error.ocorrencias || 1} ocorrência(s) · {new Date(error.ultimo_em).toLocaleString("pt-BR")}</small>
                </div>
                <Button className="secondary compact" onClick={() => void resolveOperationalError(error.id)}>
                  <Check size={14} /> Resolvido
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Nenhum erro operacional aberto nos últimos 30 dias.</EmptyState>
        )}
      </Card>
    </div>
  );
}

export function NotificacoesIntegralView({
  notifications = [],
  data = emptyOperationsData,
  clientsData = emptyClientsData,
  onNotificationsChanged,
  onNavigate,
}: {
  notifications?: NotificationItem[];
  data?: OperationsData;
  clientsData?: ClientsData;
  onNotificationsChanged?: (items: NotificationItem[]) => void;
  onNavigate?: (section: string, clientId?: string | null) => void;
}) {
  const [tab, setTab] = useState(tabsByView.notificacoes[0]);
  const [notices, setNotices] = useState(notifications);
  const [mail, setMail] = useState(data.mail);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    setNotices(notifications);
  }, [notifications]);
  useEffect(() => {
    const clientId = window.sessionStorage.getItem("contador-open-client");
    if (!clientId) return;
    window.sessionStorage.removeItem("contador-open-client");
    setSelected(clientId);
    setTab("Mensagens");
  }, []);
  // Sem isso, um aviso novo na Caixa Postal só aparecia pro contador que
  // estava com a tela aberta ao recarregar a página.
  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("contador-caixa-postal-next")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "caixa_postal" },
        (payload) => {
          const incoming = payload.new as MailItem;
          setMail((items) =>
            items.some((item) => item.id === incoming.id) ? items : [...items, incoming],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "caixa_postal" },
        (payload) => {
          const updated = payload.new as MailItem;
          setMail((items) => items.map((item) => (item.id === updated.id ? { ...item, lida: updated.lida } : item)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
  const ids = Array.from(
    new Set([
      ...clientsData.clients.map((item) => item.id),
      ...mail.map((item) => item.cliente_ref),
    ]),
  ).filter((id) => {
    const client = clientsData.clients.find((item) => item.id === id);
    return (client?.name || id).toLowerCase().includes(query.toLowerCase());
  });
  const thread = mail
    .filter((item) => item.cliente_ref === selected)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  function markAll() {
    startTransition(async () => {
      const result = await markNotificationsRead();
      if (result.ok) {
        const next = notices.map((item) => ({ ...item, unread: false }));
        setNotices(next);
        onNotificationsChanged?.(next);
      }
      feedback(result.message);
    });
  }
  function openNotice(item: NotificationItem) {
    startTransition(async () => {
      const result = item.unread
        ? await markNotificationsRead(item.id)
        : { ok: true as const, message: "Notificação aberta." };
      if (result.ok) {
        const next = notices.map((value) =>
          value.id === item.id ? { ...value, unread: false } : value,
        );
        setNotices(next);
        onNotificationsChanged?.(next);
      }
      feedback(result.message);
      if (result.ok && item.cliente_ref)
        onNavigate?.("atendimento", item.cliente_ref);
    });
  }
  function removeNotice(event: MouseEvent, item: NotificationItem) {
    event.stopPropagation();
    startTransition(async () => {
      const result = await deleteNotification(item.id);
      if (result.ok) {
        const next = notices.filter((value) => value.id !== item.id);
        setNotices(next);
        onNotificationsChanged?.(next);
      }
      feedback(result.message);
    });
  }
  function clearNoticeHistory() {
    if (!window.confirm("Limpar todo o histórico de notificações? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const result = await clearNotifications();
      if (result.ok) {
        setNotices([]);
        onNotificationsChanged?.([]);
      }
      feedback(result.message);
    });
  }
  function openThread(id: string) {
    setSelected(id);
    setMail((items) =>
      items.map((item) =>
        item.cliente_ref === id && item.remetente === "cliente"
          ? { ...item, lida: true }
          : item,
      ),
    );
    startTransition(async () => {
      await markMailThreadRead(id);
    });
  }
  function send() {
    if (!selected) return;
    startTransition(async () => {
      const result = await sendMailMessage({
        clientId: selected,
        subject,
        message,
      });
      feedback(result.message);
      if (result.ok) {
        setMail((items) => [...items, result.data]);
        setSubject("");
        setMessage("");
      }
    });
  }
  return (
    <div className="view-stack">
      <PageTitle
        title="Caixa Postal"
        description="Avisos internos e comunicação assíncrona com a área do cliente."
        action={
          tab === "Avisos do Sistema" ? (
            <div className="page-title-actions">
              <Button
                className="secondary"
                disabled={pending || !notices.some((item) => item.unread)}
                onClick={markAll}
              >
                Marcar todas como lidas
              </Button>
              <Button
                className="secondary danger-text"
                disabled={pending || !notices.length}
                onClick={clearNoticeHistory}
              >
                <Trash2 size={15} /> Limpar histórico
              </Button>
            </div>
          ) : undefined
        }
      />
      <Tabs view="notificacoes" active={tab} onChange={setTab} />
      {tab === "Avisos do Sistema" ? (
        <Card className="notification-page-list">
          {notices.map((item) => (
            <div
              className={
                item.unread ? "notification-row unread" : "notification-row"
              }
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => openNotice(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  openNotice(item);
              }}
            >
              <span className="notification-dot" />
              <span>
                <strong>{item.text}</strong>
                <small>
                  {item.time ||
                    (item.created_at
                      ? new Date(item.created_at).toLocaleString("pt-BR")
                      : "Agora")}
                </small>
              </span>
              {item.unread && <Badge className="attention">Nova</Badge>}
              <button
                className="notification-delete"
                aria-label="Excluir notificação"
                disabled={pending}
                onClick={(event) => removeNotice(event, item)}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          {!notices.length && <EmptyState>Nenhum aviso do sistema.</EmptyState>}
        </Card>
      ) : (
        <div className="mail-layout">
          <Card className="mail-list">
            <div className="search-field">
              <Search size={15} />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente..."
              />
            </div>
            <div className="mail-client-list">
              {ids.map((id) => {
                const client = clientsData.clients.find(
                  (item) => item.id === id,
                );
                const unread = mail.filter(
                  (item) =>
                    item.cliente_ref === id &&
                    item.remetente === "cliente" &&
                    !item.lida,
                ).length;
                return (
                  <button
                    className={selected === id ? "active" : ""}
                    key={id}
                    onClick={() => openThread(id)}
                  >
                    <div className="avatar small">
                      {(client?.name || id).slice(0, 2).toUpperCase()}
                    </div>
                    <span>
                      <strong>{client?.name || id}</strong>
                      <small>
                        {mail.filter((item) => item.cliente_ref === id).length}{" "}
                        mensagens
                      </small>
                    </span>
                    {unread > 0 && (
                      <Badge className="attention">{unread}</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="mail-thread">
            <div className="chat-header">
              <Mail size={18} />
              <strong>
                {selected
                  ? clientsData.clients.find((item) => item.id === selected)
                      ?.name || "Mensagens do cliente"
                  : "Mensagens da Área do Cliente"}
              </strong>
            </div>
            {selected ? (
              <>
                <div className="chat-messages">
                  {thread.map((item) => (
                    <article
                      className={`chat-message ${item.remetente === "cliente" ? "client" : "agent"}`}
                      key={item.id}
                    >
                      <div>
                        <strong>{item.assunto || item.remetente}</strong>
                        <p>{item.mensagem}</p>
                        <small>
                          {new Date(item.created_at).toLocaleString("pt-BR")}
                        </small>
                      </div>
                    </article>
                  ))}
                  {!thread.length && (
                    <EmptyState>Inicie a conversa abaixo.</EmptyState>
                  )}
                </div>
                <footer className="mail-composer">
                  <Input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Assunto (opcional)"
                  />
                  <div>
                    <Input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Escreva um aviso para o cliente..."
                    />
                    <Button
                      className="icon orange-action"
                      disabled={pending || !message.trim()}
                      onClick={send}
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                </footer>
              </>
            ) : (
              <EmptyState>
                Escolha um cliente para abrir ou iniciar uma conversa.
              </EmptyState>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

const settingsContent: Record<string, [string, string, string[]]> = {
  "Geral & Notificações": [
    "Geral & Notificações",
    "Preferencias do painel e cronometro do atendimento.",
    [
      "Sons do sistema",
      "Inicio automatico do cronometro",
      "Direcao e duracao",
      "Avisos ao cliente",
    ],
  ],
  "Área do Cliente": [
    "Área do Cliente",
    "Como o cliente ve o contador e regras do pre-atendimento.",
    [
      "Nome e CRC do contador",
      "Especialidade",
      "Triagem obrigatoria",
      "Valor minimo",
      "Assuntos da triagem",
    ],
  ],
  "Radar Fiscal": [
    "Radar Fiscal",
    "Regras de consulta e clientes liberados.",
    [
      "Exibir no portal",
      "Consulta automatica da caixa postal",
      "Validade dos parcelamentos",
      "Emissao de DAS",
    ],
  ],
  "Acessos e Equipe": [
    "Gerenciamento de Acessos",
    "Membros, papeis e permissoes da equipe.",
    ["Contador responsavel", "Membros da equipe", "Convites pendentes"],
  ],
  Integracoes: [
    "Integracoes",
    "Serviços conectados ao Ola, Contador.",
    [
      "Nota Fiscal de Servico (Asaas)",
      "WhatsApp Business API",
      "Portal e-CAC (Receita Federal)",
    ],
  ],
  "Inteligência Artificial (AIA)": [
    "Inteligência Artificial & Skills",
    "Bases de conhecimento utilizadas pelo copiloto.",
    ["Skills ativas", "Arquivos indexados", "Prompts do copiloto"],
  ],
  "Aparência do Chat": [
    "Aparência do Chat & Atalhos",
    "Personalizacao visual e respostas rapidas.",
    [
      "Modo escuro",
      "Cores do chat",
      "Atalhos de mensagem rapida",
      "Atalhos do Copiloto IA",
    ],
  ],
};
type TeamMember = {
  id: string | null;
  email: string;
  name: string | null;
  nome: string | null;
  role: string | null;
  fila_restrita?: boolean;
  acesso_insights_radar?: boolean;
};
function configObject(data: OperationsData, key: string) {
  const value = data.settings.find((item) => item.chave === key)?.valor;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
type SkillItem = {
  id: string;
  name: string;
  tema: string;
  content: string;
  active: boolean;
};
function normalizeSkillItem(item: unknown, index: number): SkillItem {
  const value =
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
  return {
    id: String(value.id || `skill-${index}`),
    name: String(value.name || ""),
    tema: String(value.tema || ""),
    content: String(value.content || ""),
    active: value.active !== false,
  };
}
type ChatShortcutItem = {
  id: string;
  action: "reply" | "doc";
  text: string;
  label: string;
  enabled: boolean;
};
function normalizeChatShortcutItem(item: unknown, index: number): ChatShortcutItem {
  const value =
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
  return {
    id: String(value.id || `cs-${index}`),
    action: value.action === "doc" ? "doc" : "reply",
    text: String(value.text || ""),
    label: String(value.label || value.text || ""),
    enabled: value.enabled !== false,
  };
}
type CopilotShortcutItem = { id: string; label: string; prompt: string; enabled: boolean };
function normalizeCopilotShortcutItem(item: unknown, index: number): CopilotShortcutItem {
  const value =
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
  return {
    id: String(value.id || `cp-${index}`),
    label: String(value.label || ""),
    prompt: String(value.prompt || ""),
    enabled: value.enabled !== false,
  };
}
export function ConfiguracoesIntegralView({
  data = emptyOperationsData,
}: {
  data?: OperationsData;
}) {
  const [tab, setTab] = useState(tabsByView.configuracoes[0]);
  const [pending, startTransition] = useTransition();
  const [timer, setTimer] = useState({
    ...{
      autoIniciar: true,
      direcao: "crescente",
      duracaoMinutos: 40,
      avisoMinutosAntes: 5,
      avisarCliente: true,
      avisoSonoro: true,
    },
    ...configObject(data, "timer_config"),
  });
  const [panelPreferences, setPanelPreferences] = useState({
    systemSounds: true,
    ...configObject(data, "painel_preferencias"),
  });
  const [clientArea, setClientArea] = useState({
    ...{
      triageRequired: Boolean(configObject(data, "triagem_regras").obrigatoriaParaChat),
      minLength: Number(configObject(data, "triagem_regras").minimoRelato || 20),
      showReports: true,
      showRadar: false,
    },
    ...configObject(data, "area_cliente_config"),
  });
  const initialTriageSubjects = data.settings.find(
    (item) => item.chave === "triagem_assuntos",
  )?.valor;
  const [triageSubjects, setTriageSubjects] = useState(
    JSON.stringify(Array.isArray(initialTriageSubjects) ? initialTriageSubjects : [], null, 2),
  );
  const legacyRadar = configObject(data, "radar_fiscal_config");
  const [radar, setRadar] = useState({
    ...{
      portalAtivo: legacyRadar.portal ?? true,
      caixaPostalAutomatica: legacyRadar.automaticMail ?? true,
      caixaPostalIntervaloDias: legacyRadar.mailInterval ?? 7,
      parcelamentosValidadeDias: legacyRadar.installmentsValidity ?? 0,
      clientePodeEmitirDas: legacyRadar.clientCanIssueGuides ?? true,
    },
    ...legacyRadar,
  });
  const [radarClients, setRadarClients] = useState<Record<string, boolean>>({
    ...(configObject(data, "radar_fiscal_clientes") as Record<string, boolean>),
    ...((Array.isArray(legacyRadar.allowedClients)
      ? Object.fromEntries((legacyRadar.allowedClients as string[]).map((id) => [id, true]))
      : {}) as Record<string, boolean>),
  });
  const legacyNfse = {
    ...configObject(data, "nfse_config"),
    ...configObject(data, "nota_fiscal_config"),
  };
  const [nfse, setNfse] = useState({
    ...{
      ativo: legacyNfse.active ?? false,
      municipality: "",
      serviceCode: "",
      descricao: legacyNfse.description ?? "Serviços contábeis",
      observacoes: "",
      municipalRegistration: "",
      issRate: 0,
      municipalServiceId: "",
      municipalServiceName: "",
    },
    ...legacyNfse,
  });
  const [appearance, setAppearance] = useState({
    ...{
      dark: false,
      chatBackground: "#FFFFFF",
      accountantBubble: "#164E37",
      clientBubble: "#F0EDE6",
      copilotBackground: "#EAF1F6",
    },
    ...configObject(data, "chat_appearance"),
  });
  const initialSkills = data.settings.find(
    (item) => item.chave === "ia_skills",
  )?.valor;
  const [skills, setSkills] = useState<SkillItem[]>(
    Array.isArray(initialSkills)
      ? initialSkills.map(normalizeSkillItem)
      : [],
  );
  const [municipalServices, setMunicipalServices] = useState<Array<{
    id: string | number;
    description?: string;
    name?: string;
  }>>([]);
  const [municipalLoading, setMunicipalLoading] = useState(false);
  const [skillUploadName, setSkillUploadName] = useState("");
  const [skillUploadFile, setSkillUploadFile] = useState<File | null>(null);
  const [skillUploading, setSkillUploading] = useState(false);
  const initialShortcuts = data.settings.find(
    (item) => item.chave === "chat_shortcuts",
  )?.valor;
  const [shortcuts, setShortcuts] = useState<ChatShortcutItem[]>(
    Array.isArray(initialShortcuts)
      ? initialShortcuts.map(normalizeChatShortcutItem)
      : [],
  );
  const initialCopilotShortcuts = data.settings.find(
    (item) => item.chave === "copilot_shortcuts",
  )?.valor;
  const [copilotShortcutsConfig, setCopilotShortcutsConfig] = useState<
    CopilotShortcutItem[]
  >(
    Array.isArray(initialCopilotShortcuts)
      ? initialCopilotShortcuts.map(normalizeCopilotShortcutItem)
      : [],
  );
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [invite, setInvite] = useState({
    nome: "",
    email: "",
    role: "parceiro",
    filaRestrita: false,
    acessoInsightsRadar: true,
  });
  function save(key: string, value: unknown, visible = false) {
    startTransition(async () => {
      const result = await saveSystemSetting({
        key,
        value,
        visibleToClient: visible,
      });
      feedback(result.message);
    });
  }
  function saveMany(entries: Array<{ key: string; value: unknown; visible?: boolean }>) {
    startTransition(async () => {
      for (const entry of entries) {
        const result = await saveSystemSetting({
          key: entry.key,
          value: entry.value,
          visibleToClient: Boolean(entry.visible),
        });
        if (!result.ok) {
          feedback(result.message);
          return;
        }
      }
      feedback("Configurações salvas e sincronizadas.");
    });
  }
  async function teamAction(
    action: "listar" | "convidar" | "remover" | "atualizar",
    payload?: Record<string, string | boolean>,
  ) {
    const response = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const result = await response
      .json()
      .catch(() => ({ error: "Resposta inválida" }));
    if (!response.ok) {
      feedback(result.error || "Não foi possível gerenciar a equipe.");
      return;
    }
    if (action === "listar") {
      setTeam(result);
      setTeamLoaded(true);
    } else {
      feedback(
        action === "convidar"
          ? "Convite enviado."
          : action === "atualizar"
            ? "Permissões atualizadas."
            : "Acesso revogado.",
      );
      await teamAction("listar");
    }
  }
  async function loadMunicipalServices() {
    setMunicipalLoading(true);
    try {
      const response = await fetch("/api/integrations/municipal-services", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || result.error || "integration_failed");
      const list = Array.isArray(result) ? result : Array.isArray(result.data) ? result.data : [];
      setMunicipalServices(list);
      feedback(`${list.length} serviço(s) municipal(is) encontrado(s).`);
    } catch {
      feedback("Não foi possível buscar os serviços municipais. Confira a configuração fiscal no Asaas.");
    } finally {
      setMunicipalLoading(false);
    }
  }
  async function uploadSkillPDF() {
    if (!skillUploadFile || skillUploadName.trim().length < 3) return;
    if (skillUploadFile.type !== "application/pdf" || skillUploadFile.size > 10 * 1024 * 1024) {
      feedback("Use um PDF com até 10 MB.");
      return;
    }
    setSkillUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(skillUploadFile);
      });
      const response = await fetch("/api/skills/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName: skillUploadName.trim(), base64 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "upload_failed");
      setSkillUploadFile(null);
      feedback(`PDF vetorizado: ${result.chunksProcessed || 0} bloco(s) salvos.`);
    } catch (reason) {
      feedback(
        reason instanceof Error && reason.message === "ia_not_configured"
          ? "A chave de embeddings ainda não está configurada."
          : "Não foi possível processar o PDF da skill.",
      );
    } finally {
      setSkillUploading(false);
    }
  }
  useEffect(() => {
    if (tab === "Acessos e Equipe" && !teamLoaded) void teamAction("listar");
  }, [tab, teamLoaded]);
  const footer = (key: string, value: unknown, visible = false) => (
    <div className="form-actions">
      <small>As alterações valem para o sistema publicado.</small>
      <Button disabled={pending} onClick={() => save(key, value, visible)}>
        <Save size={15} />
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </div>
  );
  return (
    <div className="view-stack">
      <PageTitle
        title="Configurações do Sistema"
        description="Operação, portal, integrações, equipe, IA e aparência em dados reais."
      />
      <div className="settings-layout">
        <Tabs view="configuracoes" active={tab} onChange={setTab} />
        <Card className="settings-card integral-settings">
          <h2>{settingsContent[tab][0]}</h2>
          <p className="muted">{settingsContent[tab][1]}</p>
          {tab === "Geral & Notificações" && (
            <>
              <div className="settings-list">
                <SettingSwitch
                  label="Sons do sistema"
                  note="Toca um alerta discreto para novas mensagens, agendamentos e notificações."
                  checked={Boolean(panelPreferences.systemSounds)}
                  onChange={(value) => setPanelPreferences({ ...panelPreferences, systemSounds: value })}
                />
                <SettingSwitch
                  label="Iniciar cronômetro automaticamente"
                  note="Começa a contagem ao abrir o chat."
                  checked={Boolean(timer.autoIniciar)}
                  onChange={(value) => setTimer({ ...timer, autoIniciar: value })}
                />
                <SettingSwitch
                  label="Avisar o cliente"
                  note="Inclui o alerta de prazo na conversa compartilhada."
                  checked={Boolean(timer.avisarCliente)}
                  onChange={(value) =>
                    setTimer({ ...timer, avisarCliente: value })
                  }
                />
                <SettingSwitch
                  label="Aviso sonoro"
                  note="Toca o alerta quando o prazo configurado for atingido."
                  checked={Boolean(timer.avisoSonoro)}
                  onChange={(value) => setTimer({ ...timer, avisoSonoro: value })}
                />
              </div>
              <div className="form-grid">
                <label>
                  Sentido da contagem
                  <select
                    value={String(timer.direcao)}
                    onChange={(event) =>
                      setTimer({ ...timer, direcao: event.target.value })
                    }
                  >
                    <option value="crescente">Crescente</option>
                    <option value="decrescente">Decrescente</option>
                  </select>
                </label>
                <label>
                  Duração padrão (min)
                  <Input
                    type="number"
                    min="1"
                    max="240"
                    value={Number(timer.duracaoMinutos)}
                    onChange={(event) =>
                      setTimer({
                        ...timer,
                        duracaoMinutos: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Avisar quando faltarem (min)
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={Number(timer.avisoMinutosAntes)}
                    onChange={(event) =>
                      setTimer({
                        ...timer,
                        avisoMinutosAntes: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="form-actions">
                <small>As preferências valem no sistema publicado.</small>
                <Button disabled={pending} onClick={() => saveMany([
                  { key: "timer_config", value: timer },
                  { key: "painel_preferencias", value: panelPreferences },
                ])}>
                  <Save size={15} /> {pending ? "Salvando…" : "Salvar configurações"}
                </Button>
              </div>
            </>
          )}
          {tab === "Área do Cliente" && (
            <>
              <div className="settings-list">
                <SettingSwitch
                  label="Exigir triagem para liberar o chat"
                  note="Garante contexto antes do atendimento."
                  checked={Boolean(clientArea.triageRequired)}
                  onChange={(value) =>
                    setClientArea({ ...clientArea, triageRequired: value })
                  }
                />
                <SettingSwitch
                  label="Exibir relatórios entregues"
                  note="Mantém o histórico de entregas no portal."
                  checked={Boolean(clientArea.showReports)}
                  onChange={(value) =>
                    setClientArea({ ...clientArea, showReports: value })
                  }
                />
                <SettingSwitch
                  label="Exibir Radar Fiscal"
                  note="A liberação individual ainda é respeitada."
                  checked={Boolean(clientArea.showRadar)}
                  onChange={(value) =>
                    setClientArea({ ...clientArea, showRadar: value })
                  }
                />
              </div>
              <div className="form-grid">
                <label>
                  Tamanho mínimo do relato
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    value={Number(clientArea.minLength)}
                    onChange={(event) =>
                      setClientArea({
                        ...clientArea,
                        minLength: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="full">
                  Catálogo completo da triagem (JSON)
                  <textarea
                    className="code-editor-label"
                    rows={12}
                    value={triageSubjects}
                    onChange={(event) => setTriageSubjects(event.target.value)}
                  />
                </label>
              </div>
              <div className="form-actions">
                <small>Preserva perguntas, opções, documentos e diagnósticos do portal antigo.</small>
                <Button
                  disabled={pending}
                  onClick={() => {
                    try {
                      const catalog = JSON.parse(triageSubjects);
                      if (!Array.isArray(catalog)) throw new Error("invalid");
                      saveMany([
                        { key: "area_cliente_config", value: clientArea, visible: true },
                        { key: "triagem_regras", value: { obrigatoriaParaChat: Boolean(clientArea.triageRequired), minimoRelato: Number(clientArea.minLength) }, visible: true },
                        { key: "triagem_assuntos", value: catalog, visible: true },
                      ]);
                    } catch {
                      feedback("O catálogo da triagem precisa ser uma lista JSON válida.");
                    }
                  }}
                >
                  <Save size={15} /> {pending ? "Salvando…" : "Salvar área do cliente"}
                </Button>
              </div>
            </>
          )}
          {tab === "Radar Fiscal" && (
            <>
              <div className="settings-list">
                <SettingSwitch
                  label="Radar no portal do cliente"
                  note="Exibe somente para clientes liberados abaixo."
                  checked={Boolean(radar.portalAtivo)}
                  onChange={(value) => setRadar({ ...radar, portalAtivo: value })}
                />
                <SettingSwitch
                  label="Caixa Postal automática"
                  note="Monitora os clientes liberados."
                  checked={Boolean(radar.caixaPostalAutomatica)}
                  onChange={(value) =>
                    setRadar({ ...radar, caixaPostalAutomatica: value })
                  }
                />
                <SettingSwitch
                  label="Cliente pode emitir guias"
                  note="Libera emissão de parcelas encontradas."
                  checked={Boolean(radar.clientePodeEmitirDas)}
                  onChange={(value) =>
                    setRadar({ ...radar, clientePodeEmitirDas: value })
                  }
                />
              </div>
              <div className="form-grid">
                <label>
                  Intervalo da Caixa Postal (dias)
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={Number(radar.caixaPostalIntervaloDias)}
                    onChange={(event) =>
                      setRadar({
                        ...radar,
                        caixaPostalIntervaloDias: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Validade dos parcelamentos (dias)
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={Number(radar.parcelamentosValidadeDias)}
                    onChange={(event) =>
                      setRadar({
                        ...radar,
                        parcelamentosValidadeDias: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="radar-config-list">
                {data.radarClients.map((client) => (
                  <label key={client.id}>
                    <input
                      type="checkbox"
                      checked={radarClients[client.id] === true}
                      onChange={(event) =>
                        setRadarClients({ ...radarClients, [client.id]: event.target.checked })
                      }
                    />
                    <span>
                      <strong>{client.name}</strong>
                      <small>{client.cpf || "Sem documento"}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="form-actions">
                <small>As permissões individuais também valem no portal do cliente.</small>
                <Button disabled={pending} onClick={() => saveMany([
                  { key: "radar_fiscal_config", value: radar, visible: true },
                  { key: "radar_fiscal_clientes", value: radarClients, visible: true },
                ])}>
                  <Save size={15} /> {pending ? "Salvando…" : "Salvar Radar Fiscal"}
                </Button>
              </div>
            </>
          )}
          {tab === "Acessos e Equipe" && (
            <>
              <div className="team-integral-list">
                {team.map((member) => (
                  <div key={member.id || member.email}>
                    <div className="avatar small">
                      {(member.nome || member.name || member.email)
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <span>
                      <strong>
                        {member.nome || member.name || "Sem nome"}
                      </strong>
                      <small>{member.email}</small>
                    </span>
                    <Badge>
                      {member.role === "admin"
                        ? "Administrador"
                        : "Contador parceiro"}
                    </Badge>
                    {member.id && (
                      <div className="team-member-toggles">
                        <label className="inline-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(member.fila_restrita)}
                            onChange={(event) =>
                              void teamAction("atualizar", {
                                id: member.id!,
                                filaRestrita: event.target.checked,
                              })
                            }
                          />
                          Fila restrita
                        </label>
                        <label className="inline-checkbox">
                          <input
                            type="checkbox"
                            checked={member.acesso_insights_radar !== false}
                            onChange={(event) =>
                              void teamAction("atualizar", {
                                id: member.id!,
                                acessoInsightsRadar: event.target.checked,
                              })
                            }
                          />
                          Insights/Radar
                        </label>
                      </div>
                    )}
                    {member.id && (
                      <Button
                        className="icon ghost danger-text"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Revogar o acesso de ${member.email}?`,
                            )
                          )
                            void teamAction("remover", { id: member.id! });
                        }}
                      >
                        <X size={15} />
                      </Button>
                    )}
                  </div>
                ))}
                {!teamLoaded && <EmptyState>Carregando equipe…</EmptyState>}
              </div>
              <Card className="team-invite">
                <strong>Convidar membro</strong>
                <div className="form-grid">
                  <label>
                    Nome
                    <Input
                      value={invite.nome}
                      onChange={(event) =>
                        setInvite({ ...invite, nome: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    E-mail
                    <Input
                      type="email"
                      value={invite.email}
                      onChange={(event) =>
                        setInvite({ ...invite, email: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Nível de acesso
                    <select
                      value={invite.role}
                      onChange={(event) =>
                        setInvite({ ...invite, role: event.target.value })
                      }
                    >
                      <option value="parceiro">Contador parceiro</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                </div>
                <div className="settings-item-row">
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={invite.filaRestrita}
                      onChange={(event) =>
                        setInvite({ ...invite, filaRestrita: event.target.checked })
                      }
                    />
                    Fila restrita (só vê os próprios casos)
                  </label>
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={invite.acessoInsightsRadar}
                      onChange={(event) =>
                        setInvite({ ...invite, acessoInsightsRadar: event.target.checked })
                      }
                    />
                    Acesso a Insights/Radar Fiscal
                  </label>
                </div>
                <Button
                  disabled={!invite.nome.trim() || !invite.email.includes("@")}
                  onClick={() => void teamAction("convidar", invite)}
                >
                  <Plus size={15} /> Enviar convite
                </Button>
              </Card>
            </>
          )}
          {tab === "Integracoes" && (
            <>
              <div className="settings-list">
                <SettingSwitch
                  label="Emitir NFS-e automaticamente"
                  note="Emite depois da confirmação do pagamento."
                  checked={Boolean(nfse.ativo)}
                  onChange={(value) => setNfse({ ...nfse, ativo: value })}
                />
                <div className="setting-row">
                  <div>
                    <strong>WhatsApp Business API</strong>
                    <small>
                      Canal de entrega usado pelo pós-atendimento legado.
                    </small>
                  </div>
                  <Badge>Servidor</Badge>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Integra Contador / SERPRO</strong>
                    <small>
                      Credenciais permanecem protegidas no ambiente do servidor.
                    </small>
                  </div>
                  <Badge>Servidor</Badge>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Município
                  <Input
                    value={String(nfse.municipality)}
                    onChange={(event) =>
                      setNfse({ ...nfse, municipality: event.target.value })
                    }
                  />
                </label>
                <label>
                  Serviço municipal no Asaas
                  <select
                    value={String(nfse.municipalServiceId || nfse.serviceCode)}
                    onChange={(event) => {
                      const option = event.target.selectedOptions[0];
                      setNfse({
                        ...nfse,
                        serviceCode: event.target.value,
                        municipalServiceId: event.target.value,
                        municipalServiceName: option?.textContent || "",
                      });
                    }}
                  >
                    <option value="">Selecione depois de buscar</option>
                    {String(nfse.municipalServiceId || nfse.serviceCode) &&
                      !municipalServices.some(
                        (item) => String(item.id) === String(nfse.municipalServiceId || nfse.serviceCode),
                      ) && (
                        <option value={String(nfse.municipalServiceId || nfse.serviceCode)}>
                          {String(nfse.municipalServiceName || nfse.serviceCode)}
                        </option>
                      )}
                    {municipalServices.map((service) => (
                      <option key={String(service.id)} value={String(service.id)}>
                        {service.description || service.name || String(service.id)}
                      </option>
                    ))}
                  </select>
                  <Button className="secondary compact" disabled={municipalLoading} onClick={() => void loadMunicipalServices()}>
                    <RotateCcw size={14} /> {municipalLoading ? "Buscando…" : "Buscar serviços"}
                  </Button>
                </label>
                <label>
                  Inscrição municipal
                  <Input
                    value={String(nfse.municipalRegistration)}
                    onChange={(event) =>
                      setNfse({
                        ...nfse,
                        municipalRegistration: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Alíquota ISS (%)
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={Number(nfse.issRate)}
                    onChange={(event) =>
                      setNfse({ ...nfse, issRate: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="full">
                  Descrição do serviço
                  <Input
                    value={String(nfse.descricao)}
                    onChange={(event) =>
                      setNfse({ ...nfse, descricao: event.target.value })
                    }
                  />
                </label>
              </div>
              {footer("nota_fiscal_config", nfse)}
            </>
          )}
          {tab === "Inteligência Artificial (AIA)" && (
            <>
              <Card className="skill-upload-card">
                <div className="card-heading">
                  <div><Brain size={17} /><strong>Indexar legislação em PDF</strong></div>
                  <Badge>Embeddings</Badge>
                </div>
                <div className="form-grid">
                  <label>
                    Nome da skill
                    <Input value={skillUploadName} onChange={(event) => setSkillUploadName(event.target.value)} placeholder="Ex.: Ganho de Capital" />
                  </label>
                  <label>
                    Arquivo PDF
                    <Input type="file" accept="application/pdf" onChange={(event) => setSkillUploadFile(event.target.files?.[0] || null)} />
                  </label>
                </div>
                <Button disabled={skillUploading || !skillUploadFile || skillUploadName.trim().length < 3} onClick={() => void uploadSkillPDF()}>
                  <Upload size={15} /> {skillUploading ? "Vetorizando PDF…" : "Enviar e indexar PDF"}
                </Button>
              </Card>
              <div className="settings-item-list">
                {skills.map((skill, index) => (
                  <Card className="settings-item-card" key={skill.id}>
                    <div className="form-grid">
                      <label>
                        Nome
                        <Input
                          value={skill.name}
                          onChange={(event) =>
                            setSkills((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Tema
                        <Input
                          value={skill.tema}
                          onChange={(event) =>
                            setSkills((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, tema: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Conteúdo
                      <textarea
                        rows={4}
                        value={skill.content}
                        onChange={(event) =>
                          setSkills((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, content: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="settings-item-row">
                      <label className="inline-checkbox">
                        <input
                          type="checkbox"
                          checked={skill.active}
                          onChange={(event) =>
                            setSkills((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, active: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        Ativa
                      </label>
                      <Button
                        className="icon ghost"
                        onClick={() =>
                          setSkills((items) =>
                            items.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </Card>
                ))}
                {!skills.length && (
                  <EmptyState>Nenhuma skill cadastrada.</EmptyState>
                )}
              </div>
              <div className="form-actions">
                <Button
                  className="secondary"
                  onClick={() =>
                    setSkills((items) => [
                      ...items,
                      normalizeSkillItem({}, items.length),
                    ])
                  }
                >
                  <Plus size={15} /> Nova skill
                </Button>
                <Button onClick={() => save("ia_skills", skills)}>
                  <Save size={15} /> Salvar skills
                </Button>
              </div>
            </>
          )}
          {tab === "Aparência do Chat" && (
            <>
              <div className="settings-list">
                <SettingSwitch
                  label="Modo escuro"
                  note="Preferência visual do chat."
                  checked={Boolean(appearance.dark)}
                  onChange={(value) =>
                    setAppearance({ ...appearance, dark: value })
                  }
                />
              </div>
              <div className="color-config-grid">
                {[
                  ["Fundo do chat", "chatBackground"],
                  ["Balão do contador", "accountantBubble"],
                  ["Balão do cliente", "clientBubble"],
                  ["Fundo do Copiloto", "copilotBackground"],
                ].map(([label, key]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="color"
                      value={String(appearance[key as keyof typeof appearance])}
                      onChange={(event) =>
                        setAppearance({
                          ...appearance,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              {footer("chat_appearance", appearance, true)}
              <strong>Atalhos rápidos do chat</strong>
              <div className="settings-item-list">
                {shortcuts.map((shortcut, index) => (
                  <div className="settings-item-row" key={shortcut.id}>
                    <select
                      value={shortcut.action}
                      onChange={(event) =>
                        setShortcuts((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, action: event.target.value as "reply" | "doc" }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="reply">Resposta</option>
                      <option value="doc">Pedir documento</option>
                    </select>
                    <Input
                      placeholder="Rótulo"
                      value={shortcut.label}
                      onChange={(event) =>
                        setShortcuts((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="Texto"
                      value={shortcut.text}
                      onChange={(event) =>
                        setShortcuts((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={shortcut.enabled}
                        onChange={(event) =>
                          setShortcuts((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, enabled: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      Ativo
                    </label>
                    <Button
                      className="icon ghost"
                      onClick={() =>
                        setShortcuts((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {!shortcuts.length && (
                  <EmptyState>Nenhum atalho cadastrado.</EmptyState>
                )}
              </div>
              <div className="form-actions">
                <Button
                  className="secondary"
                  onClick={() =>
                    setShortcuts((items) => [
                      ...items,
                      normalizeChatShortcutItem({}, items.length),
                    ])
                  }
                >
                  <Plus size={15} /> Novo atalho
                </Button>
                <Button onClick={() => save("chat_shortcuts", shortcuts, true)}>
                  Salvar atalhos
                </Button>
              </div>
              <strong>Atalhos do Copiloto</strong>
              <div className="settings-item-list">
                {copilotShortcutsConfig.map((shortcut, index) => (
                  <div className="settings-item-row" key={shortcut.id}>
                    <Input
                      placeholder="Rótulo"
                      value={shortcut.label}
                      onChange={(event) =>
                        setCopilotShortcutsConfig((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="Prompt"
                      value={shortcut.prompt}
                      onChange={(event) =>
                        setCopilotShortcutsConfig((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, prompt: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={shortcut.enabled}
                        onChange={(event) =>
                          setCopilotShortcutsConfig((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, enabled: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      Ativo
                    </label>
                    <Button
                      className="icon ghost"
                      onClick={() =>
                        setCopilotShortcutsConfig((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {!copilotShortcutsConfig.length && (
                  <EmptyState>Nenhum atalho do Copiloto cadastrado.</EmptyState>
                )}
              </div>
              <div className="form-actions">
                <Button
                  className="secondary"
                  onClick={() =>
                    setCopilotShortcutsConfig((items) => [
                      ...items,
                      normalizeCopilotShortcutItem({}, items.length),
                    ])
                  }
                >
                  <Plus size={15} /> Novo atalho
                </Button>
                <Button
                  onClick={() =>
                    save("copilot_shortcuts", copilotShortcutsConfig)
                  }
                >
                  Salvar atalhos do Copiloto
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
function SettingSwitch({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <small>{note}</small>
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span />
      </label>
    </div>
  );
}

type ProfessionalProfile = {
  name: string;
  crc: string;
  tags: string;
  bio: string;
  education: string;
  logoDataUrl: string;
  assinaturaDataUrl: string;
};
const fallbackProfile: ProfessionalProfile = {
  name: "Contador",
  crc: "CRC não informado",
  tags: "",
  bio: "",
  education: "",
  logoDataUrl: "",
  assinaturaDataUrl: "",
};
export function PerfilView({
  user = { name: "Contador", email: "", role: "Equipe" },
  data = emptyOperationsData,
  clientsData = emptyClientsData,
  onUpdated,
}: {
  user?: { name: string; email: string; role: string };
  data?: OperationsData;
  clientsData?: ClientsData;
  onUpdated?: (name: string) => void;
}) {
  const stored = data.settings.find(
    (item) => item.chave === "perfil_contador",
  )?.valor;
  const initial = {
    ...fallbackProfile,
    name: user.name,
    ...(stored && typeof stored === "object" && !Array.isArray(stored)
      ? stored
      : {}),
  } as ProfessionalProfile;
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initial);
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const tags = profile.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const education = profile.education
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const paid = data.charges.filter((item) => item.status === "paid");
  const total = paid.reduce((sum, item) => sum + (item.valor_cents || 0), 0);
  const money = (cents: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  useEffect(() => {
    if (stored) return;
    const supabase = createBrowserClient();
    if (!supabase) return;
    void supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "perfil_contador")
      .maybeSingle()
      .then(({ data: row }) => {
        const value = row?.valor;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const loaded = {
            ...fallbackProfile,
            name: user.name,
            ...value,
          } as ProfessionalProfile;
          setProfile(loaded);
          setForm(loaded);
        }
      });
  }, [stored, user.name]);
  function readImage(
    event: ChangeEvent<HTMLInputElement>,
    field: "logoDataUrl" | "assinaturaDataUrl",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      feedback("Use PNG ou JPEG com até 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((value) => ({ ...value, [field]: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }
  function save() {
    startTransition(async () => {
      const result = await updateProfile(form);
      setMessage(result.message);
      if (result.ok) {
        setProfile(result.profile);
        onUpdated?.(result.name);
        setEditing(false);
        feedback(result.message);
      }
    });
  }
  return (
    <div className="view-stack">
      <PageTitle
        title="Meu Perfil Profissional"
        description="Identidade, marca e desempenho do contador."
        action={
          <Button
            className="secondary"
            onClick={() => {
              setForm(profile);
              setMessage("");
              setEditing(true);
            }}
          >
            <UserRound size={16} /> Editar Meu Perfil
          </Button>
        }
      />
      <Card className="profile-hero">
        {profile.logoDataUrl ? (
          <img
            className="profile-brand-image"
            src={profile.logoDataUrl}
            alt="Logo profissional"
          />
        ) : (
          <div className="avatar profile">{initials}</div>
        )}
        <div>
          <h2>
            {profile.name} <CheckCircle2 size={18} />
          </h2>
          <p>
            {profile.crc} • {user.email}
          </p>
          <div className="badge-row">
            {tags.map((tag) => (
              <Badge className="success" key={tag}>
                {tag}
              </Badge>
            ))}
            {!tags.length && <Badge>Perfil verificado</Badge>}
          </div>
        </div>
      </Card>
      <div className="stats-grid three">
        <Stat
          label="Atendimentos realizados"
          value={String(clientsData.history.length)}
          hint="Histórico real"
        />
        <Stat
          label="Faturamento gerado"
          value={money(total)}
          hint={`${paid.length} pagamentos confirmados`}
          tone="orange"
        />
        <Stat
          label="Ticket médio"
          value={money(paid.length ? Math.round(total / paid.length) : 0)}
          hint="Média dos pagamentos"
          tone="blue"
        />
      </div>
      <div className="two-columns">
        <Card>
          <h3>Sobre mim</h3>
          <p className="muted">
            {profile.bio || "Adicione sua apresentação profissional."}
          </p>
        </Card>
        <Card>
          <h3>Formação Acadêmica</h3>
          {education.length ? (
            <ul className="profile-education">
              {education.map((item) => (
                <li key={item}>
                  <Check size={14} />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma formação informada.</p>
          )}
        </Card>
      </div>
      {editing && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(false);
          }}
        >
          <Card
            className="profile-dialog profile-dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
          >
            <div className="dialog-head">
              <div>
                <h2 id="profile-dialog-title">Editar Meu Perfil</h2>
                <p>
                  Estas informações também aparecem nos relatórios do cliente.
                </p>
              </div>
              <Button
                className="icon ghost"
                aria-label="Fechar edição"
                onClick={() => setEditing(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form profile-complete-form">
              <div className="form-grid">
                <label>
                  Nome Completo
                  <Input
                    value={form.name}
                    maxLength={80}
                    autoFocus
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Registro (CRC e UF)
                  <Input
                    value={form.crc}
                    maxLength={80}
                    placeholder="CRC/SC 047967-O-2"
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        crc: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full">
                  Especialidades (separadas por vírgula)
                  <Input
                    value={form.tags}
                    placeholder="MEI, Imposto de Renda, Lucro Real..."
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        tags: event.target.value,
                      }))
                    }
                  />
                  <small>
                    Elas aparecerão como pílulas verdes no seu perfil.
                  </small>
                </label>
                <label className="full">
                  Sobre Mim (Biografia)
                  <textarea
                    rows={4}
                    value={form.bio}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        bio: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full">
                  Formação Acadêmica (uma por linha)
                  <textarea
                    rows={3}
                    value={form.education}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        education: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="profile-branding">
                <div>
                  <strong>Marca no Relatório do Cliente</strong>
                  <small>
                    Aparecem no cabeçalho e na assinatura do PDF entregue ao
                    cliente.
                  </small>
                </div>
                <div className="profile-upload-grid">
                  <div className="profile-upload">
                    <div className="profile-upload-preview">
                      {form.logoDataUrl ? (
                        <img src={form.logoDataUrl} alt="Prévia da logo" />
                      ) : (
                        <Upload size={21} />
                      )}
                    </div>
                    <label className="button secondary">
                      Logo (quadrada)
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(event) => readImage(event, "logoDataUrl")}
                      />
                    </label>
                    {form.logoDataUrl && (
                      <Button
                        className="icon ghost"
                        aria-label="Remover logo"
                        onClick={() =>
                          setForm((value) => ({ ...value, logoDataUrl: "" }))
                        }
                      >
                        <X size={15} />
                      </Button>
                    )}
                  </div>
                  <div className="profile-upload">
                    <div className="profile-upload-preview signature">
                      {form.assinaturaDataUrl ? (
                        <img
                          src={form.assinaturaDataUrl}
                          alt="Prévia da assinatura"
                        />
                      ) : (
                        <Upload size={21} />
                      )}
                    </div>
                    <label className="button secondary">
                      Assinatura (imagem)
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(event) =>
                          readImage(event, "assinaturaDataUrl")
                        }
                      />
                    </label>
                    {form.assinaturaDataUrl && (
                      <Button
                        className="icon ghost"
                        aria-label="Remover assinatura"
                        onClick={() =>
                          setForm((value) => ({
                            ...value,
                            assinaturaDataUrl: "",
                          }))
                        }
                      >
                        <X size={15} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {message && (
                <div className="form-message" role="status">
                  {message}
                </div>
              )}
            </div>
            <div className="dialog-actions">
              <Button className="secondary" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  isPending ||
                  form.name.trim().length < 3 ||
                  form.crc.trim().length < 4
                }
                onClick={save}
              >
                <Save size={16} />
                {isPending ? "Salvando…" : "Salvar Perfil"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

type FinanceChargeResult = {
  cobrancaId?: number;
  valor?: number;
  metodoPagamento?: string;
  pixPayload?: string;
  invoiceUrl?: string;
  error?: string;
  detail?: string;
};
const blankService = {
  id: "",
  name: "",
  description: "",
  price: "",
  recurrence: "avulso" as "avulso" | "monthly",
  active: true,
  prazo: "2",
  items: "",
};

const integralStages = [
  {
    label: "Pendente de Início",
    express: "aguardando_triagem",
    legacy: "pending",
  },
  { label: "Em Análise Fiscal", express: "em_analise", legacy: "active" },
  { label: "Em Execução", express: "em_execucao", legacy: "active" },
  {
    label: "Aguardando Docs",
    express: "aguardando_documentos",
    legacy: "docs",
  },
  { label: "Pronto para Envio", express: "pronto_envio", legacy: "ready" },
  { label: "Concluído", express: "concluido", legacy: "done" },
  // Segundo gatilho de recorrência — só existe para casos "legado" (Express
  // é atendimento avulso, não tem conceito de mensalidade).
  { label: "Recorrência", express: null, legacy: "recorrencia" },
] as const;
export function AcompanhamentoIntegralView({
  data = emptyOperationsData,
  clientsData = emptyClientsData,
}: {
  data?: OperationsData;
  clientsData?: ClientsData;
}) {
  const [express, setExpress] = useState(data.express);
  const [moving, setMoving] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Array<{id:string;name:string}>>([]);
  const kanbanValue = data.settings.find(
    (item) => item.chave === "kanban_etapas",
  )?.valor;
  const legacyMap =
    kanbanValue &&
    typeof kanbanValue === "object" &&
    !Array.isArray(kanbanValue)
      ? (kanbanValue as Record<string, string>)
      : {};
  const clientName = (id: string) =>
    clientsData.clients.find((item) => item.id === id)?.name ||
    data.radarClients.find((item) => item.id === id)?.name ||
    id;
  useEffect(() => {
    void fetch("/api/team", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : [])
      .then((items: Array<{id?:string|null;name?:string|null;nome?:string|null;email?:string|null}>) =>
        setAssignees(items.filter((item) => item.id).map((item) => ({
          id: String(item.id),
          name: item.nome || item.name || item.email || "Equipe",
        }))),
      )
      .catch(() => setAssignees([]));
  }, []);
  async function moveExpress(id: number, status: string) {
    setMoving(`e-${id}`);
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "express-status", id, status }),
    });
    const result = await response
      .json()
      .catch(() => ({ error: "invalid_response" }));
    setMoving(null);
    if (!response.ok) {
      feedback(
        result.error === "resultado_ainda_nao_entregue"
          ? "Entregue o relatório antes de concluir o caso."
          : "Não foi possível mover este atendimento.",
      );
      return;
    }
    setExpress((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    feedback("Etapa atualizada e cliente notificado.");
  }
  async function moveLegacy(clientId: string, status: string) {
    setMoving(`l-${clientId}`);
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "kanban-stage", clientId, status }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      recurrenceMessage?: string;
    };
    setMoving(null);
    feedback(
      response.ok
        ? result.recurrenceMessage || "Etapa atualizada e cliente notificado."
        : "Não foi possível mover este caso.",
    );
    if (response.ok) window.location.reload();
  }
  async function assignExpress(id: number, responsavelId: string) {
    setMoving(`a-${id}`);
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "express-assign", id, responsavelId }),
    });
    const result = await response.json().catch(() => ({ error: "invalid_response" }));
    setMoving(null);
    if (!response.ok) {
      feedback(result.error === "forbidden" ? "Somente um administrador pode transferir este caso." : "Não foi possível atribuir o responsável.");
      return;
    }
    setExpress((items) => items.map((item) => item.id === id ? {
      ...item,
      responsavel_id: result.responsavel_id,
      responsavel_nome: result.responsavel_nome,
    } : item));
    feedback(result.responsavel_nome ? `Caso atribuído a ${result.responsavel_nome}.` : "Responsável removido do caso.");
  }
  return (
    <div className="view-stack">
      <PageTitle
        title="Esteira de Acompanhamento"
        description="Movimente casos, atribua execução e acompanhe o SLA até a entrega."
        action={
          <Badge className="success">
            {express.length + Object.keys(legacyMap).length} processos
          </Badge>
        }
      />
      <div className="kanban integral-kanban">
        {integralStages.map((stage, index) => {
          const expressItems = express.filter(
            (item) =>
              item.status === stage.express ||
              (stage.express === "em_analise" && item.status === "processing"),
          );
          const legacyItems = Object.entries(legacyMap).filter(
            ([, status]) =>
              status === stage.legacy && stage.label !== "Em Execução",
          );
          return (
            <div className="kanban-column" key={stage.label}>
              <div className="kanban-title">
                <span className={`stage-dot s${index % 5}`} />
                <strong>{stage.label}</strong>
                <Badge
                  className={
                    expressItems.length + legacyItems.length ? "attention" : ""
                  }
                >
                  {expressItems.length + legacyItems.length}
                </Badge>
              </div>
              <div
                className="kanban-items"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  let payload: { kind?: string; id?: number; clientId?: string };
                  try {
                    payload = JSON.parse(
                      event.dataTransfer.getData("text/plain") || "{}",
                    );
                  } catch {
                    return;
                  }
                  if (payload.kind === "express" && stage.express && payload.id)
                    void moveExpress(payload.id, stage.express);
                  else if (payload.kind === "legacy" && stage.legacy && payload.clientId)
                    void moveLegacy(payload.clientId, stage.legacy);
                }}
              >
                {expressItems.map((item) => (
                  <Card
                    className="kanban-item"
                    key={`e-${item.id}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({ kind: "express", id: item.id }),
                      )
                    }
                  >
                    <strong>
                      {item.assunto || item.servico_id || `Express #${item.id}`}
                    </strong>
                    <span>{clientName(item.cliente_ref)}</span>
                    <small>
                      Prazo{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.prazo_conclusao_em))}
                    </small>
                    <label className="kanban-assignee">
                      <span>Responsável</span>
                      <select
                        aria-label={`Responsável por ${item.assunto || `Express ${item.id}`}`}
                        disabled={moving === `a-${item.id}`}
                        value={item.responsavel_id || ""}
                        onChange={(event) => void assignExpress(item.id, event.target.value)}
                      >
                        <option value="">Sem responsável</option>
                        {item.responsavel_id && !assignees.some((member) => member.id === item.responsavel_id) && (
                          <option value={item.responsavel_id}>{item.responsavel_nome || "Responsável atual"}</option>
                        )}
                        {assignees.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                      </select>
                    </label>
                    <select
                      disabled={moving === `e-${item.id}`}
                      value={item.status}
                      onChange={(event) =>
                        void moveExpress(item.id, event.target.value)
                      }
                    >
                      {integralStages
                        .filter(
                          (option): option is typeof option & { express: string } =>
                            Boolean(option.express),
                        )
                        .map((option) => (
                          <option key={option.express} value={option.express}>
                            {option.label}
                          </option>
                        ))}
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </Card>
                ))}
                {legacyItems.map(([clientId]) => (
                  <Card
                    className="kanban-item"
                    key={`l-${clientId}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({ kind: "legacy", clientId }),
                      )
                    }
                  >
                    <strong>Acompanhamento</strong>
                    <span>{clientName(clientId)}</span>
                    <small>Fluxo originado no atendimento</small>
                    <select
                      disabled={moving === `l-${clientId}`}
                      value={stage.legacy}
                      onChange={(event) =>
                        void moveLegacy(clientId, event.target.value)
                      }
                    >
                      {Array.from(
                        new Map(
                          integralStages.map((item) => [
                            item.legacy,
                            item.label,
                          ]),
                        ).entries(),
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Card>
                ))}
                {!expressItems.length && !legacyItems.length && (
                  <EmptyState>Sem processos.</EmptyState>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const blankCompleteReport = {
  reportId: undefined as number | undefined,
  clientId: "",
  title: "",
  type: "atendimento" as "atendimento" | "pendencias",
  format: "completo" as "essencial" | "completo",
  problem: "",
  solution: "",
  workDone: "",
  howDone: "",
  pendingIssues: "",
  deliverables: "",
  status: "rascunho" as "rascunho" | "entrega_pendente" | "arquivado_interno",
};
// Textos-base por tipo de caso — porte 1:1 de MODELOS_RELATORIO (app.js).
const REPORT_TEMPLATES = {
  geral: {
    problem: "Descreva de forma objetiva a situação apresentada pelo cliente.",
    solution: "Informe o resultado obtido e deixe claro o que foi concluído.",
    workDone: "• Análise das informações e documentos recebidos\n• Execução do serviço contratado",
    howDone: "• Confira o resultado e guarde este relatório\n• Acompanhe abaixo somente os passos que ainda estiverem pendentes",
  },
  pf: {
    problem: "Descreva a demanda da pessoa física, os períodos envolvidos e eventual dificuldade de acesso ao gov.br.",
    solution: "Informe o que foi regularizado, consultado, transmitido ou orientado e o resultado atual.",
    workDone: "• Conferência cadastral e fiscal\n• Consulta dos serviços necessários\n• Execução e conferência do resultado",
    howDone: "• Guarde protocolos e comprovantes\n• Reative a autenticação em duas etapas do gov.br, caso ela tenha sido desativada\n• Exclua o acesso compartilhado quando o serviço terminar",
  },
  pj: {
    problem: "Descreva a demanda da empresa, CNPJ, competências e obrigações envolvidas.",
    solution: "Informe a situação final da empresa e o que foi efetivamente entregue.",
    workDone: "• Conferência cadastral e tributária\n• Análise das obrigações e pendências\n• Execução do serviço e validação dos comprovantes",
    howDone: "• Arquive guias, recibos e protocolos\n• Observe os próximos vencimentos informados neste relatório",
  },
  regularizacao: {
    problem: "Descreva as pendências, débitos, inscrições e competências localizadas.",
    solution: "Informe o que foi regularizado e a situação de cada débito ou parcelamento.",
    workDone: "• Levantamento da situação fiscal\n• Conferência de dívida ativa e parcelamentos\n• Emissão de guias, protocolos e comprovantes aplicáveis",
    howDone: "• Pague as parcelas até o vencimento\n• Acompanhe a consolidação e eventual baixa nos órgãos responsáveis",
  },
} as const;
export function RelatoriosIntegralView({
  data = emptyOperationsData,
}: {
  data?: OperationsData;
}) {
  const [tab, setTab] = useState(tabsByView.relatorios[0]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(false);
  const [form, setForm] = useState(blankCompleteReport);
  const [channels, setChannels] = useState({
    email: true,
    caixa: true,
    chat: false,
  });
  const [message, setMessage] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportTemplate, setReportTemplate] =
    useState<keyof typeof REPORT_TEMPLATES>("geral");
  const [manualAttachment, setManualAttachment] = useState({
    titulo: "",
    url: "",
    tipo: "link" as "link" | "guia" | "protocolo" | "comprovante" | "outro",
  });
  const [attachments, setAttachments] = useState(data.reportAttachments);
  const [aiReportPending, setAiReportPending] = useState(false);
  const [pending, startTransition] = useTransition();
  const clientDocuments = data.documents.filter(
    (item) => item.cliente_ref === form.clientId,
  );
  const source =
    tab === "Aguardando Relatório"
      ? data.reports.filter(
          (item) => !["entregue", "arquivado_interno"].includes(item.status),
        )
      : tab === "Relatórios Finalizados"
        ? data.reports.filter((item) =>
            ["entregue", "arquivado_interno"].includes(item.status),
          )
        : data.reports;
  const filtered = source.filter(
    (item) =>
      !query ||
      [item.cliente_nome, item.titulo, item.caso_ref].some((value) =>
        value?.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  function applyReportTemplate() {
    const template = REPORT_TEMPLATES[reportTemplate];
    const hasText = [form.problem, form.solution, form.workDone, form.howDone].some(
      (value) => value.trim(),
    );
    if (
      hasText &&
      !window.confirm(
        "Aplicar o modelo vai substituir os textos desses campos. Continuar?",
      )
    )
      return;
    setForm((value) => ({
      ...value,
      ...template,
      type: reportTemplate === "regularizacao" ? "pendencias" : "atendimento",
    }));
    feedback("Modelo aplicado. Personalize o texto antes de entregar.");
  }
  function draftKey(reportId?: number) {
    return `oc-relatorio-rascunho-${reportId ?? "novo"}`;
  }
  function openEditor(report?: OperationsData["reports"][number]) {
    const base = !report
      ? blankCompleteReport
      : {
          reportId: report.id,
          clientId: report.cliente_ref,
          title: report.titulo || "",
          type:
            report.tipo_relatorio === "pendencias"
              ? ("pendencias" as const)
              : ("atendimento" as const),
          format:
            report.formato === "essencial"
              ? ("essencial" as const)
              : ("completo" as const),
          problem: report.problema || "",
          solution: report.solucao || "",
          workDone: report.oque_feito || "",
          howDone: report.como_feito || "",
          pendingIssues: report.pendencias || "",
          deliverables: report.entregas || "",
          status: [
            "rascunho",
            "entrega_pendente",
            "arquivado_interno",
          ].includes(report.status)
            ? (report.status as
                | "rascunho"
                | "entrega_pendente"
                | "arquivado_interno")
            : "rascunho",
        };
    let restored = false;
    try {
      const raw = window.localStorage.getItem(draftKey(report?.id));
      if (raw) {
        const saved = JSON.parse(raw) as { savedAt: number; form: typeof base };
        if (Date.now() - saved.savedAt < 24 * 60 * 60 * 1000) {
          setForm(saved.form);
          restored = true;
        } else window.localStorage.removeItem(draftKey(report?.id));
      }
    } catch {
      /* rascunho local corrompido, ignora */
    }
    if (!restored) setForm(base);
    setMessage(restored ? "Rascunho não salvo recuperado desta sessão." : "");
    setEditor(true);
  }
  useEffect(() => {
    if (!editor) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey(form.reportId),
          JSON.stringify({ form, savedAt: Date.now() }),
        );
      } catch {
        /* localStorage indisponível, autosave apenas em memória */
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [editor, form]);
  useEffect(() => {
    if (!editor) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editor]);
  function save(status: "rascunho" | "entrega_pendente" | "arquivado_interno") {
    startTransition(async () => {
      const result = await saveCompleteReport({ ...form, status });
      setMessage(result.message);
      if (result.ok) {
        try {
          window.localStorage.removeItem(draftKey(form.reportId));
          window.localStorage.removeItem(draftKey(undefined));
        } catch {
          /* ignora */
        }
        setForm((value) => ({
          ...value,
          reportId: result.data.id,
          status: result.data.status as typeof value.status,
        }));
        feedback(result.message);
        if (status === "arquivado_interno") window.location.reload();
      }
    });
  }
  function toggleDocument(documentId: number, attached: boolean) {
    if (!form.reportId) {
      feedback("Salve o rascunho antes de vincular documentos.");
      return;
    }
    startTransition(async () => {
      const result = await setReportDocument({
        reportId: form.reportId!,
        documentId,
        attached,
        visibleToClient: true,
      });
      feedback(result.message);
      if (result.ok) {
        const savedAttachment = "data" in result ? result.data : undefined;
        if (attached && savedAttachment) {
          setAttachments((items) => [
            ...items.filter(
              (item) =>
                !(
                  item.relatorio_id === form.reportId &&
                  item.documento_id === documentId
                ),
            ),
            savedAttachment,
          ]);
        } else
          setAttachments((items) =>
            items.filter(
              (item) =>
                !(
                  item.relatorio_id === form.reportId &&
                  item.documento_id === documentId
                ),
            ),
          );
      }
    });
  }
  function addManualAttachment() {
    if (!form.reportId) {
      feedback("Salve o rascunho antes de adicionar anexos.");
      return;
    }
    startTransition(async () => {
      const result = await addManualReportAttachment({
        reportId: form.reportId!,
        titulo: manualAttachment.titulo,
        url: manualAttachment.url,
        tipo: manualAttachment.tipo,
        visibleToClient: true,
      });
      feedback(result.message);
      if (result.ok) {
        setAttachments((items) => [...items, result.data]);
        setManualAttachment({ titulo: "", url: "", tipo: "link" });
      }
    });
  }
  function removeManualAttachment(attachmentId: number) {
    startTransition(async () => {
      const result = await removeManualReportAttachment(attachmentId);
      feedback(result.message);
      if (result.ok)
        setAttachments((items) =>
          items.filter((item) => item.id !== attachmentId),
        );
    });
  }
  async function fillReportWithAI() {
    if (!form.clientId) {
      feedback("Selecione o cliente antes de usar a IA.");
      return;
    }
    setAiReportPending(true);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          mode: "relatorio",
          tipoRelatorio: form.type,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok)
        throw new Error(
          result.error === "ia_not_configured"
            ? "A IA ainda não está configurada."
            : "Não foi possível gerar o relatório.",
        );
      setForm((current) => ({
        ...current,
        title: String(result.titulo || current.title),
        problem: String(result.problema || current.problem),
        solution: String(result.solucao || current.solution),
        workDone: String(result.oqueFeito || current.workDone),
        howDone: String(result.comoFeito || current.howDone),
        pendingIssues: String(result.pendencias || current.pendingIssues),
        deliverables: String(result.entregas || current.deliverables),
      }));
      feedback("Rascunho gerado pela IA. Revise antes de salvar ou entregar.");
    } catch (reason) {
      feedback(reason instanceof Error ? reason.message : "Falha ao consultar a IA.");
    } finally {
      setAiReportPending(false);
    }
  }
  async function deliver() {
    if (!form.reportId) return;
    setReviewOpen(false);
    setMessage("");
    const selected = [];
    if (channels.email) selected.push("email");
    if (channels.caixa) selected.push("caixa_postal");
    if (channels.chat) selected.push("chat");
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "finalize-report",
        reportId: form.reportId,
        channels: selected,
      }),
    });
    const result = await response
      .json()
      .catch(() => ({ error: "invalid_response" }));
    if (!response.ok) {
      const labels: Record<string, string> = {
        relatorio_incompleto: "O relatório ainda está incompleto.",
        assinatura_contador_incompleta:
          "Complete sua assinatura e CRC no perfil.",
        finalizacao_falhou:
          "A transação de entrega falhou; o caso continua pendente.",
      };
      setMessage(
        labels[result.error] ||
          result.detail ||
          "Não foi possível entregar o relatório.",
      );
      return;
    }
    feedback(
      result.caseKeptOpen
        ? "Relatório de pendências entregue; caso mantido aberto."
        : "Relatório entregue e caso concluído.",
    );
    window.location.reload();
  }
  function revise(report: OperationsData["reports"][number]) {
    startTransition(async () => {
      const result = await createReportRevision(report.id);
      feedback(result.message);
      if (result.ok) {
        openEditor(result.data);
        setTab("Novo Relatório");
      }
    });
  }
  async function retryDelivery(report: OperationsData["reports"][number]) {
    if (!window.confirm("Tentar novamente a entrega deste relatório?")) return;
    const savedChannels = Array.isArray(report.canais_entrega)
      ? report.canais_entrega.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "finalize-report",
        reportId: report.id,
        channels: savedChannels.length
          ? savedChannels
          : ["email", "caixa_postal"],
      }),
    });
    const result = await response.json().catch(() => ({}));
    feedback(
      response.ok
        ? "Entrega reprocessada com sucesso."
        : result.detail ||
            "A entrega continua pendente; tente novamente mais tarde.",
    );
    if (response.ok) window.location.reload();
  }
  function printReport(report: OperationsData["reports"][number]) {
    void baixarRelatorioPdf({
      id: report.id,
      versao: report.versao,
      tipoRelatorio: report.tipo_relatorio,
      titulo: report.titulo,
      clienteNome: report.cliente_nome,
      clienteCpf: report.cliente_cpf,
      problema: report.problema,
      solucao: report.solucao,
      oqueFeito: report.oque_feito,
      comoFeito: report.como_feito,
      pendencias: report.pendencias,
      contadorAssinatura: report.contador_assinatura,
      contadorNome: report.contador_nome,
      contadorCrc: report.contador_crc,
      codigoValidacao: report.codigo_validacao,
      entregueEm: report.entregue_em,
      createdAt: report.created_at,
    }).then((ok) => {
      if (!ok) feedback("Não foi possível gerar o PDF agora. Tente novamente.");
    });
  }
  return (
    <div className="view-stack">
      <PageTitle
        title="Relatórios de Atendimento"
        description="Rascunho, validação, entrega transacional, histórico e PDF."
        action={
          <Button
            onClick={() => {
              openEditor();
              setTab("Novo Relatório");
            }}
          >
            <Plus size={16} /> Novo relatório
          </Button>
        }
      />
      <Tabs
        view="relatorios"
        active={tab}
        onChange={(value) => {
          setTab(value);
          if (value === "Novo Relatório") openEditor();
        }}
      />
      {tab === "Novo Relatório" && editor ? (
        <Card className="report-editor">
          <div className="report-editor-head">
            <div>
              <h2>
                {form.reportId
                  ? `Relatório #${form.reportId}`
                  : "Novo relatório"}
              </h2>
              <p>O caso só é concluído após a confirmação da entrega.</p>
            </div>
            <div className="report-editor-actions">
              <Button className="secondary" disabled={aiReportPending || !form.clientId} onClick={() => void fillReportWithAI()}>
                <Sparkles size={15} />
                {aiReportPending ? "A IA está lendo…" : "Preencher com IA"}
              </Button>
              <Badge className={form.status === "entrega_pendente" ? "attention" : ""}>
                {form.status.replaceAll("_", " ")}
              </Badge>
            </div>
          </div>
          <div className="form-grid">
            <label className="full">
              Cliente
              <select
                value={form.clientId}
                disabled={Boolean(form.reportId)}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    clientId: event.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {data.radarClients.map((client) => (
                  <option value={client.id} key={client.id}>
                    {client.name} · {client.cpf || "sem documento"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    type: event.target.value as "atendimento" | "pendencias",
                  }))
                }
              >
                <option value="atendimento">Relatório de atendimento</option>
                <option value="pendencias">Relatório de pendências</option>
              </select>
            </label>
            <label>
              Formato
              <select
                value={form.format}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    format: event.target.value as "essencial" | "completo",
                  }))
                }
              >
                <option value="completo">Completo</option>
                <option value="essencial">Essencial</option>
              </select>
            </label>
            <label>
              Modelo
              <select
                value={reportTemplate}
                onChange={(event) =>
                  setReportTemplate(event.target.value as keyof typeof REPORT_TEMPLATES)
                }
              >
                <option value="geral">Geral</option>
                <option value="pf">Pessoa Física</option>
                <option value="pj">Pessoa Jurídica</option>
                <option value="regularizacao">Regularização</option>
              </select>
            </label>
            <div className="full inline-form">
              <Button className="secondary compact" onClick={applyReportTemplate}>
                <Sparkles size={14} /> Aplicar modelo
              </Button>
              <small>Preenche problema, solução e providências com um texto-base — revise antes de entregar.</small>
            </div>
            <label className="full">
              Título
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((value) => ({ ...value, title: event.target.value }))
                }
              />
            </label>
            <label className="full">
              Descrição objetiva do caso
              <textarea
                rows={4}
                value={form.problem}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    problem: event.target.value,
                  }))
                }
              />
            </label>
            <label className="full">
              Resolução
              <textarea
                rows={4}
                value={form.solution}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    solution: event.target.value,
                  }))
                }
              />
            </label>
            <label className="full">
              Providências realizadas
              <textarea
                rows={4}
                value={form.workDone}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    workDone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="full">
              Como foi realizado
              <textarea
                rows={3}
                value={form.howDone}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    howDone: event.target.value,
                  }))
                }
              />
            </label>
            {form.type === "pendencias" && (
              <label className="full">
                Pendências levantadas
                <textarea
                  rows={4}
                  value={form.pendingIssues}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      pendingIssues: event.target.value,
                    }))
                  }
                />
              </label>
            )}
            <label className="full">
              Entregas e documentos
              <textarea
                rows={3}
                value={form.deliverables}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    deliverables: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <Card className="report-attachments">
            <div className="card-heading">
              <div>
                <Paperclip size={17} />
                <strong>Anexos do relatório</strong>
              </div>
              <Badge>
                {
                  attachments.filter(
                    (item) => item.relatorio_id === form.reportId,
                  ).length
                }
              </Badge>
            </div>
            {!form.reportId ? (
              <EmptyState>
                Salve o rascunho para escolher os documentos da entrega.
              </EmptyState>
            ) : clientDocuments.length ? (
              <div className="report-document-list">
                {clientDocuments.map((document) => {
                  const attached = attachments.some(
                    (item) =>
                      item.relatorio_id === form.reportId &&
                      item.documento_id === document.id,
                  );
                  return (
                    <label key={document.id}>
                      <input
                        type="checkbox"
                        checked={attached}
                        disabled={pending}
                        onChange={(event) =>
                          toggleDocument(document.id, event.target.checked)
                        }
                      />
                      <FileText size={16} />
                      <span>
                        <strong>{document.file_name}</strong>
                        <small>
                          {document.mime || "Documento"} · {Math.max(1, Math.round((document.size_bytes || 0) / 1024))} KB
                        </small>
                      </span>
                      <Badge className={attached ? "success" : ""}>
                        {attached ? "Incluído" : "Disponível"}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            ) : (
              <EmptyState>
                Nenhum documento foi enviado para este cliente.
              </EmptyState>
            )}
            {form.reportId && (
              <div className="report-manual-attachments">
                {attachments
                  .filter(
                    (item) =>
                      item.relatorio_id === form.reportId &&
                      !item.documento_id,
                  )
                  .map((item) => (
                    <div className="report-manual-attachment-row" key={item.id}>
                      <LinkIcon size={15} />
                      <span>
                        <strong>{item.titulo}</strong>
                        <small>{item.tipo}</small>
                      </span>
                      <Button
                        className="icon ghost"
                        disabled={pending}
                        onClick={() => removeManualAttachment(item.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                <div className="inline-form">
                  <Input
                    placeholder="Título (ex: Guia DAS, Protocolo e-CAC)"
                    value={manualAttachment.titulo}
                    onChange={(event) =>
                      setManualAttachment((value) => ({
                        ...value,
                        titulo: event.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Link (URL)"
                    value={manualAttachment.url}
                    onChange={(event) =>
                      setManualAttachment((value) => ({
                        ...value,
                        url: event.target.value,
                      }))
                    }
                  />
                  <select
                    value={manualAttachment.tipo}
                    onChange={(event) =>
                      setManualAttachment((value) => ({
                        ...value,
                        tipo: event.target.value as typeof value.tipo,
                      }))
                    }
                  >
                    <option value="link">Link</option>
                    <option value="guia">Guia</option>
                    <option value="protocolo">Protocolo</option>
                    <option value="comprovante">Comprovante</option>
                    <option value="outro">Outro</option>
                  </select>
                  <Button
                    className="secondary compact"
                    disabled={pending}
                    onClick={addManualAttachment}
                  >
                    <Paperclip size={14} /> Adicionar
                  </Button>
                </div>
              </div>
            )}
          </Card>
          {message && (
            <div className="form-message" role="status">
              {message}
            </div>
          )}
          {form.status === "entrega_pendente" && (
            <div className="report-delivery">
              <strong>Canais de aviso</strong>
              <label>
                <input type="checkbox" checked disabled /> Área do Cliente
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={channels.email}
                  onChange={(event) =>
                    setChannels((value) => ({
                      ...value,
                      email: event.target.checked,
                    }))
                  }
                />{" "}
                E-mail
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={channels.caixa}
                  onChange={(event) =>
                    setChannels((value) => ({
                      ...value,
                      caixa: event.target.checked,
                    }))
                  }
                />{" "}
                Caixa Postal
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={channels.chat}
                  onChange={(event) =>
                    setChannels((value) => ({
                      ...value,
                      chat: event.target.checked,
                    }))
                  }
                />{" "}
                Chat
              </label>
            </div>
          )}
          <div className="dialog-actions report-actions">
            <Button
              className="ghost"
              disabled={pending || !form.reportId}
              onClick={() => save("arquivado_interno")}
            >
              Arquivar sem enviar
            </Button>
            <Button
              className="secondary"
              disabled={pending}
              onClick={() => save("rascunho")}
            >
              <Save size={15} /> Salvar rascunho
            </Button>
            {form.status !== "entrega_pendente" ? (
              <Button
                disabled={pending}
                onClick={() => save("entrega_pendente")}
              >
                <FileCheck2 size={15} /> Validar entrega
              </Button>
            ) : (
              <Button disabled={pending} onClick={() => setReviewOpen(true)}>
                <Send size={15} /> Confirmar envio e encerrar
              </Button>
            )}
          </div>
          {reviewOpen && (
            <div className="dialog-overlay" role="dialog" aria-label="Revisar entrega">
              <Card className="report-review-card">
                <strong>Revisar antes de entregar</strong>
                <div className="client-detail-grid">
                  <section>
                    <span>Cliente</span>
                    <strong>
                      {data.reports.find((item) => item.id === form.reportId)
                        ?.cliente_nome || "—"}
                    </strong>
                  </section>
                  <section>
                    <span>Título</span>
                    <strong>{form.title || "Sem título"}</strong>
                  </section>
                  <section>
                    <span>Formato</span>
                    <strong>
                      {form.format === "essencial" ? "Essencial" : "Completo"}
                    </strong>
                  </section>
                  <section>
                    <span>Tipo</span>
                    <strong>
                      {form.type === "pendencias"
                        ? "Pendências"
                        : "Atendimento"}
                    </strong>
                  </section>
                </div>
                <p>
                  Canais de entrega:{" "}
                  {[
                    channels.email && "E-mail",
                    channels.caixa && "Caixa Postal",
                    channels.chat && "Chat",
                  ]
                    .filter(Boolean)
                    .join(", ") || "Nenhum canal selecionado"}
                </p>
                <p>
                  {form.type === "pendencias"
                    ? "O caso será mantido em aberto por haver pendências."
                    : "O caso será concluído após esta entrega."}
                </p>
                <div className="dialog-actions">
                  <Button className="ghost" onClick={() => setReviewOpen(false)}>
                    Voltar e revisar
                  </Button>
                  <Button disabled={pending} onClick={() => void deliver()}>
                    <Send size={15} /> Confirmar entrega
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="table-tools">
            <div className="search-field">
              <Search size={15} />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente, assunto ou caso"
              />
            </div>
            <Badge>{filtered.length}</Badge>
          </div>
          <div className="records-list report-list">
            {filtered.map((report) => (
              <article key={report.id}>
                <div className="record-icon">
                  <FileText size={17} />
                </div>
                <div>
                  <strong>
                    {report.titulo || report.cliente_nome || "Relatório"}
                  </strong>
                  <span>
                    {report.cliente_nome || report.cliente_ref} · versão{" "}
                    {report.versao}
                  </span>
                  <small>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                    }).format(new Date(report.updated_at))}
                  </small>
                </div>
                <Badge
                  className={
                    report.status === "entregue"
                      ? "success"
                      : report.falha_entrega
                        ? "attention"
                        : ""
                  }
                >
                  {report.status.replaceAll("_", " ")}
                </Badge>
                <div className="table-actions">
                  {report.status !== "entregue" && (
                    <Button
                      className="secondary"
                      onClick={() => {
                        openEditor(report);
                        setTab("Novo Relatório");
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  {report.status === "entregue" && (
                    <Button
                      className="secondary"
                      disabled={pending}
                      onClick={() => revise(report)}
                    >
                      Revisar
                    </Button>
                  )}
                  {(Boolean(report.falha_entrega) ||
                    report.status === "falha_na_entrega") && (
                    <Button
                      className="secondary"
                      disabled={pending}
                      onClick={() => void retryDelivery(report)}
                    >
                      Reenviar
                    </Button>
                  )}
                  <Button
                    className="secondary"
                    onClick={() => printReport(report)}
                  >
                    Imprimir/PDF
                  </Button>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <EmptyState>Nenhum relatório encontrado.</EmptyState>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export function AgendaIntegralView({
  data = emptyOperationsData,
}: {
  data?: OperationsData;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [month, setMonth] = useState(() => {
    const value = new Date();
    return new Date(value.getFullYear(), value.getMonth(), 1);
  });
  const [mode, setMode] = useState<"mes" | "lista">("mes");
  const [filter, setFilter] = useState("proximos");
  const [selectedDay, setSelectedDay] = useState(today);
  const availabilitySetting = data.settings.find(
    (item) => item.chave === "agenda_disponibilidade",
  )?.valor;
  const blockedSetting = data.settings.find(
    (item) => item.chave === "agenda_dias_bloqueados",
  )?.valor;
  const initialTimes = Array.isArray(availabilitySetting)
    ? availabilitySetting.filter(
        (value): value is string => typeof value === "string",
      )
    : ["09:00", "10:00", "11:00", "14:00", "15:00", "16:30"];
  const initialBlocked = Array.isArray(blockedSetting)
    ? blockedSetting.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const [times, setTimes] = useState(initialTimes);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [newTime, setNewTime] = useState("");
  const [newBlocked, setNewBlocked] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    taxType: "Imposto de Renda",
    date: today,
    time: initialTimes[0] || "09:00",
  });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const key = (date: Date) => new Intl.DateTimeFormat("en-CA").format(date);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const appointmentsFor = (day: string) =>
    data.appointments.filter((item) => item.date === day);
  const dayItems = appointmentsFor(selectedDay);
  const list = data.appointments.filter(
    (item) =>
      filter === "todos" ||
      (filter === "hoje" && item.date === today) ||
      (filter === "concluidos" && item.status === "done") ||
      (filter === "proximos" &&
        Boolean(item.date && item.date >= today && item.status !== "done")),
  );
  function saveAvailability() {
    startTransition(async () => {
      const result = await saveAgendaAvailability({
        times,
        blockedDays: blocked,
      });
      setMessage(result.message);
      feedback(result.message);
    });
  }
  function addTime() {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime) && !times.includes(newTime)) {
      setTimes((value) => [...value, newTime].sort());
      setNewTime("");
    }
  }
  function addBlocked() {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(newBlocked) &&
      !blocked.includes(newBlocked)
    ) {
      setBlocked((value) => [...value, newBlocked].sort());
      setNewBlocked("");
    }
  }
  function createAppointment() {
    startTransition(async () => {
      const selected = data.radarClients.find(
        (item) => item.id === form.clientId,
      );
      const result = await createManualAppointment({
        ...form,
        clientName: selected?.name || form.clientName,
      });
      setMessage(result.message);
      feedback(result.message);
      if (result.ok) window.location.reload();
    });
  }
  function setStatus(
    id: number,
    status: "pending" | "confirmed" | "done" | "cancelled",
  ) {
    startTransition(async () => {
      const result = await updateAppointmentStatus(id, status);
      feedback(result.message);
      if (result.ok) window.location.reload();
    });
  }
  function removeAppointment(id: number) {
    if (!window.confirm("Excluir definitivamente este agendamento?")) return;
    startTransition(async () => {
      const result = await deleteAppointment(id);
      feedback(result.message);
      if (result.ok) window.location.reload();
    });
  }
  return (
    <div className="view-stack">
      <PageTitle
        title="Agenda"
        description="Calendário, disponibilidade pública, bloqueios e consultas manuais."
        action={
          <Badge className="success">
            {data.appointments.length} registros
          </Badge>
        }
      />
      <div className="agenda-integral">
        <Card className="agenda-main">
          <div className="calendar-head">
            <Button
              className="secondary"
              onClick={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDay(today);
              }}
            >
              Hoje
            </Button>
            <div>
              <Button
                className="icon ghost"
                onClick={() =>
                  setMonth(
                    (value) =>
                      new Date(value.getFullYear(), value.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={17} />
              </Button>
              <strong>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric",
                }).format(month)}
              </strong>
              <Button
                className="icon ghost"
                onClick={() =>
                  setMonth(
                    (value) =>
                      new Date(value.getFullYear(), value.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={17} />
              </Button>
            </div>
            <div className="period-capsule">
              <button
                className={mode === "mes" ? "active" : ""}
                onClick={() => setMode("mes")}
              >
                Mês
              </button>
              <button
                className={mode === "lista" ? "active" : ""}
                onClick={() => setMode("lista")}
              >
                Lista
              </button>
            </div>
          </div>
          {mode === "mes" ? (
            <>
              <div className="calendar-weekdays">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="calendar-month-grid">
                {days.map((day) => {
                  const value = key(day);
                  const items = appointmentsFor(value);
                  return (
                    <button
                      key={value}
                      className={`${day.getMonth() !== month.getMonth() ? "outside " : ""}${selectedDay === value ? "selected " : ""}${blocked.includes(value) ? "blocked" : ""}`}
                      onClick={() => setSelectedDay(value)}
                    >
                      <span>{day.getDate()}</span>
                      {items.slice(0, 3).map((item) => (
                        <small key={item.id}>
                          {item.time} · {item.client_name}
                        </small>
                      ))}
                      {items.length > 3 && <em>+{items.length - 3}</em>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="period-capsule agenda-list-filter">
                {["proximos", "hoje", "concluidos", "todos"].map((value) => (
                  <button
                    key={value}
                    className={filter === value ? "active" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
              <AppointmentList
                items={list}
                pending={pending}
                setStatus={setStatus}
                remove={removeAppointment}
              />
            </>
          )}
        </Card>
        <aside className="agenda-sidebar">
          <Card>
            <div className="card-heading">
              <div>
                <CalendarDays size={18} />
                <strong>
                  Agenda de{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  }).format(new Date(`${selectedDay}T12:00:00`))}
                </strong>
              </div>
              <Badge>{dayItems.length}</Badge>
            </div>
            <AppointmentList
              items={dayItems}
              pending={pending}
              setStatus={setStatus}
              remove={removeAppointment}
            />
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <Clock3 size={18} />
                <strong>Disponibilidade</strong>
              </div>
            </div>
            <div className="availability-pills">
              {times.map((time) => (
                <button
                  key={time}
                  onClick={() =>
                    setTimes((value) => value.filter((item) => item !== time))
                  }
                >
                  {time}
                  <X size={12} />
                </button>
              ))}
            </div>
            <div className="inline-form">
              <Input
                type="time"
                value={newTime}
                onChange={(event) => setNewTime(event.target.value)}
              />
              <Button className="secondary" onClick={addTime}>
                <Plus size={15} /> Horário
              </Button>
            </div>
            <p className="muted">Dias bloqueados</p>
            <div className="availability-pills blocked">
              {blocked.map((day) => (
                <button
                  key={day}
                  onClick={() =>
                    setBlocked((value) => value.filter((item) => item !== day))
                  }
                >
                  {new Intl.DateTimeFormat("pt-BR").format(
                    new Date(`${day}T12:00:00`),
                  )}
                  <X size={12} />
                </button>
              ))}
            </div>
            <div className="inline-form">
              <Input
                type="date"
                value={newBlocked}
                onChange={(event) => setNewBlocked(event.target.value)}
              />
              <Button className="secondary" onClick={addBlocked}>
                <Plus size={15} /> Bloquear
              </Button>
            </div>
            <Button
              className="full"
              disabled={pending}
              onClick={saveAvailability}
            >
              <Save size={15} /> Salvar disponibilidade
            </Button>
          </Card>
          <Card>
            <div className="card-heading">
              <div>
                <Plus size={18} />
                <strong>Nova Consulta Manual</strong>
              </div>
            </div>
            <div className="profile-form">
              <label>
                Cliente cadastrado
                <select
                  value={form.clientId}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      clientId: event.target.value,
                      clientName: "",
                    }))
                  }
                >
                  <option value="">Informar manualmente</option>
                  {data.radarClients.map((client) => (
                    <option value={client.id} key={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              {!form.clientId && (
                <label>
                  Contribuinte
                  <Input
                    value={form.clientName}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        clientName: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <label>
                Assunto
                <Input
                  value={form.taxType}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      taxType: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Data
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Horário
                  <select
                    value={form.time}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        time: event.target.value,
                      }))
                    }
                  >
                    {times.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                </label>
              </div>
              {message && <div className="form-message">{message}</div>}
              <Button
                disabled={
                  pending || (!form.clientId && !form.clientName.trim())
                }
                onClick={createAppointment}
              >
                <CalendarDays size={15} />
                {pending ? "Salvando…" : "Agendar consulta"}
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AppointmentList({
  items,
  pending,
  setStatus,
  remove,
}: {
  items: OperationsData["appointments"];
  pending: boolean;
  setStatus: (
    id: number,
    status: "pending" | "confirmed" | "done" | "cancelled",
  ) => void;
  remove: (id: number) => void;
}) {
  return items.length ? (
    <div className="records-list appointment-list">
      {items.map((item) => (
        <article key={item.id}>
          <div className="record-date">
            <strong>
              {item.date
                ? new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  }).format(new Date(`${item.date}T12:00:00`))
                : "—"}
            </strong>
            <small>{item.time || "A definir"}</small>
          </div>
          <div>
            <strong>{item.client_name}</strong>
            <span>{item.tax_type || "Atendimento"}</span>
            <small>Status: {item.status || "pending"}</small>
          </div>
          <div className="table-actions">
            <select
              disabled={pending}
              value={item.status || "pending"}
              onChange={(event) =>
                setStatus(
                  item.id,
                  event.target.value as
                    | "pending"
                    | "confirmed"
                    | "done"
                    | "cancelled",
                )
              }
            >
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmado</option>
              <option value="done">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <Button className="icon ghost danger-text" aria-label={`Excluir agendamento de ${item.client_name}`} disabled={pending} onClick={() => remove(item.id)}>
              <X size={15} />
            </Button>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState>Nenhum agendamento neste filtro.</EmptyState>
  );
}

export function FinanceiroIntegralView({
  data = emptyOperationsData,
}: {
  data?: OperationsData;
}) {
  const [tab, setTab] = useState(tabsByView.financeiro[0]);
  const [openFilter, setOpenFilter] = useState("todas");
  const [serviceModal, setServiceModal] = useState(false);
  const [chargeModal, setChargeModal] = useState(false);
  const [creditModal, setCreditModal] = useState(false);
  const [serviceForm, setServiceForm] = useState(blankService);
  const [chargeForm, setChargeForm] = useState({
    clientId: "",
    servicoId: "",
    modalidade: "sem_agendamento",
    metodoPagamento: "pix",
    date: "",
    time: "",
  });
  const [creditForm, setCreditForm] = useState({
    value: "",
    note: "",
    expiresAt: "",
  });
  const [message, setMessage] = useState("");
  const [chargeResult, setChargeResult] = useState<FinanceChargeResult | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const money = (value: number | null | undefined) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((value || 0) / 100);
  const clientName = (id: string | null) =>
    data.radarClients.find((item) => item.id === id)?.name ||
    id ||
    "Cliente não vinculado";
  const serviceName = (id: string | null) =>
    data.services.find((item) => item.id === id)?.name || id || "Serviço";
  const paid = data.charges.filter((item) => item.status === "paid");
  const open = data.charges.filter((item) =>
    ["pending", "overdue"].includes(item.status || ""),
  );
  const paidTotal = paid.reduce(
    (sum, item) => sum + (item.valor_cents || 0),
    0,
  );
  const openTotal = open.reduce(
    (sum, item) => sum + (item.valor_cents || 0),
    0,
  );
  const age = (created: string | null) =>
    created
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(created).getTime()) / 86400000),
        )
      : 0;
  const filteredOpen = open.filter(
    (item) =>
      openFilter === "todas" ||
      (openFilter === "0-3" && age(item.created_at) <= 3) ||
      (openFilter === "4-7" &&
        age(item.created_at) >= 4 &&
        age(item.created_at) <= 7) ||
      (openFilter === "8+" && age(item.created_at) >= 8),
  );
  const statusLabel = (status: string | null) =>
    ({
      paid: "Pago",
      pending: "Pendente",
      overdue: "Vencido",
      refunded: "Estornado",
      cancelled: "Cancelado",
    })[status || ""] ||
    status ||
    "Pendente";

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      feedback(`${label} copiado.`);
    } catch {
      window.prompt("Copie o conteúdo:", value);
    }
  }
  function editService(service?: ServicePlan) {
    if (!service) setServiceForm(blankService);
    else {
      const items = Array.isArray(service.itens)
        ? (service.itens as Array<{ titulo?: string; resumo?: string }>)
        : [];
      setServiceForm({
        id: service.id,
        name: service.name,
        description: service.description || "",
        price: String((service.price_cents / 100).toFixed(2)).replace(".", ","),
        recurrence: service.recurrence === "monthly" ? "monthly" : "avulso",
        active: service.active !== false,
        prazo: String(service.prazo_express_dias_uteis || 2),
        items: items
          .map(
            (item) =>
              `${item.titulo || ""}${item.resumo ? ` | ${item.resumo}` : ""}`,
          )
          .join("\n"),
      });
    }
    setMessage("");
    setServiceModal(true);
  }
  function submitService() {
    const itens = serviceForm.items
      .split("\n")
      .map((line) => {
        const [titulo, ...rest] = line.split("|");
        return { titulo: titulo.trim(), resumo: rest.join("|").trim() };
      })
      .filter((item) => item.titulo);
    startTransition(async () => {
      const result = await saveServicePlan({
        id: serviceForm.id || undefined,
        name: serviceForm.name,
        description: serviceForm.description,
        priceCents: Math.round(
          Number(serviceForm.price.replace(",", ".")) * 100,
        ),
        recurrence: serviceForm.recurrence,
        active: serviceForm.active,
        prazoExpressDiasUteis: Number(serviceForm.prazo),
        itens,
      });
      setMessage(result.message);
      if (result.ok) {
        feedback(result.message);
        setServiceModal(false);
        window.location.reload();
      }
    });
  }
  function removeService(service: ServicePlan) {
    if (!window.confirm(`Excluir o plano “${service.name}”?`)) return;
    startTransition(async () => {
      const result = await deleteServicePlan(service.id);
      feedback(result.message);
      if (result.ok) window.location.reload();
    });
  }
  async function generateCharge() {
    setMessage("");
    setChargeResult(null);
    const response = await fetch("/api/finance/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chargeForm),
    });
    const result = (await response
      .json()
      .catch(() => ({ error: "invalid_response" }))) as FinanceChargeResult;
    if (!response.ok) {
      const labels: Record<string, string> = {
        asaas_not_configured:
          "A chave do Asaas ainda não está configurada no ambiente financeiro.",
        invalid_schedule: "Informe data e horário para o atendimento agendado.",
        forbidden: "Seu usuário não tem permissão para gerar cobranças.",
        asaas_timeout:
          "O Asaas demorou para responder. Confira o histórico antes de tentar novamente.",
      };
      setMessage(
        labels[result.error || ""] ||
          result.detail ||
          "Não foi possível gerar a cobrança.",
      );
      return;
    }
    setChargeResult(result);
    feedback(`Cobrança #${result.cobrancaId} criada no Asaas.`);
  }
  function generateCredit() {
    const valueCents = Math.round(
      Number(creditForm.value.replace(",", ".")) * 100,
    );
    startTransition(async () => {
      const result = await createServiceCredit({
        valueCents,
        note: creditForm.note,
        expiresAt: creditForm.expiresAt || undefined,
      });
      setMessage(result.message);
      if (result.ok) {
        await copy(
          `${window.location.origin}/agendar?credito=${encodeURIComponent(result.data.codigo)}`,
          "Link do crédito",
        );
        setCreditModal(false);
        window.location.reload();
      }
    });
  }
  function cancelCredit(id: number) {
    if (!window.confirm("Cancelar este crédito?")) return;
    startTransition(async () => {
      const result = await cancelServiceCredit(id);
      feedback(result.message);
      if (result.ok) window.location.reload();
    });
  }

  const chargesTable = (charges: OperationsData["charges"]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Aberta há</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((charge) => (
            <tr key={charge.id}>
              <td>
                <strong>{clientName(charge.cliente_ref)}</strong>
                <small className="table-subline">
                  #{charge.id} · {charge.billing_type || "Cobrança"}
                </small>
              </td>
              <td>{serviceName(charge.servico_id)}</td>
              <td>
                <strong>{money(charge.valor_cents)}</strong>
                {Boolean(charge.desconto_cents) && (
                  <small className="table-subline">
                    Desconto {money(charge.desconto_cents)}
                  </small>
                )}
              </td>
              <td>
                <Badge
                  className={
                    charge.status === "paid"
                      ? "success"
                      : charge.status === "overdue"
                        ? "attention"
                        : ""
                  }
                >
                  {statusLabel(charge.status)}
                </Badge>
              </td>
              <td>
                {charge.status === "paid"
                  ? "Pago"
                  : `${age(charge.created_at)} dia(s)`}
              </td>
              <td>
                <div className="table-actions">
                  {charge.invoice_url && (
                    <>
                      <Button
                        className="secondary"
                        onClick={() =>
                          window.open(
                            charge.invoice_url || "",
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Abrir
                      </Button>
                      <Button
                        className="secondary"
                        onClick={() =>
                          copy(charge.invoice_url || "", "Link da cobrança")
                        }
                      >
                        Copiar link
                      </Button>
                    </>
                  )}
                  {charge.pix_payload && (
                    <Button
                      className="secondary"
                      onClick={() => copy(charge.pix_payload || "", "Pix")}
                    >
                      Copiar Pix
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!charges.length && (
            <tr>
              <td colSpan={6}>
                <EmptyState>
                  Nenhuma cobrança encontrada neste filtro.
                </EmptyState>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="view-stack">
      <PageTitle
        title="Painel Financeiro (Asaas)"
        description="Faturamento, cobranças em aberto, planos, links de pagamento e créditos."
        action={
          <Button
            onClick={() => {
              setChargeResult(null);
              setMessage("");
              setChargeModal(true);
            }}
          >
            <Plus size={16} /> Gerar cobrança
          </Button>
        }
      />
      <Tabs view="financeiro" active={tab} onChange={setTab} />
      {tab === "Faturamento" && (
        <>
          <div className="stats-grid three">
            <Stat
              label="Recebimentos"
              value={money(paidTotal)}
              hint={`${paid.length} pagamentos confirmados`}
            />
            <Stat
              label="A Receber"
              value={money(openTotal)}
              hint={`${open.length} cobranças abertas`}
              tone="orange"
            />
            <Stat
              label="Ticket Médio Pago"
              value={money(
                paid.length ? Math.round(paidTotal / paid.length) : 0,
              )}
              hint="Média dos pagamentos"
              tone="blue"
            />
          </div>
          <Card className="finance-section">
            <div className="card-heading">
              <div>
                <ReceiptText size={18} />
                <strong>Cobranças recentes</strong>
              </div>
              <Badge>{data.charges.length}</Badge>
            </div>
            {chargesTable(data.charges.slice(0, 20))}
          </Card>
          <Card className="finance-section">
            <div className="card-heading">
              <div>
                <ArrowUpRight size={18} />
                <strong>Funil financeiro</strong>
              </div>
              <Badge>Dados reais</Badge>
            </div>
            <div className="finance-funnel">
              <Stat
                label="Cobranças criadas"
                value={String(data.charges.length)}
                hint="Base carregada"
              />
              <Stat
                label="Pagamentos"
                value={String(paid.length)}
                hint={
                  data.charges.length
                    ? `${Math.round((paid.length / data.charges.length) * 100)}% de conversão`
                    : "Sem base"
                }
                tone="blue"
              />
              <Stat
                label="Em aberto"
                value={String(open.length)}
                hint="Aguardando pagamento"
                tone="orange"
              />
            </div>
          </Card>
        </>
      )}
      {tab === "Cobranças em Aberto" && (
        <Card className="finance-section">
          <div className="finance-toolbar">
            <div>
              <h3>Cobranças geradas e não pagas</h3>
              <p>Reenvie pelo link seguro do Asaas.</p>
            </div>
            <div className="period-capsule">
              {["todas", "0-3", "4-7", "8+"].map((value) => (
                <button
                  className={openFilter === value ? "active" : ""}
                  key={value}
                  onClick={() => setOpenFilter(value)}
                >
                  {value === "todas" ? "Todas" : `${value} dias`}
                </button>
              ))}
            </div>
          </div>
          {chargesTable(filteredOpen)}
        </Card>
      )}
      {tab === "Planos & Links de Pagamento" && (
        <Card className="finance-section">
          <div className="finance-toolbar">
            <div>
              <h3>Planos de Serviço (Checkout)</h3>
              <p>Cadastre, pause e compartilhe os links públicos.</p>
            </div>
            <Button onClick={() => editService()}>
              <Plus size={16} /> Novo serviço
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plano / Serviço</th>
                  <th>Valor</th>
                  <th>Frequência</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.name}</strong>
                      <small className="table-subline">
                        {service.description ||
                          `${Array.isArray(service.itens) ? service.itens.length : 0} item(ns)`}
                      </small>
                    </td>
                    <td>{money(service.price_cents)}</td>
                    <td>
                      {service.recurrence === "monthly" ? "Mensal" : "Avulso"}
                    </td>
                    <td>
                      <Badge
                        className={
                          service.active !== false ? "success" : "attention"
                        }
                      >
                        {service.active !== false ? "Ativo" : "Pausado"}
                      </Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Button
                          className="secondary"
                          onClick={() => editService(service)}
                        >
                          Editar
                        </Button>
                        <Button
                          className="secondary"
                          onClick={() =>
                            copy(
                              `${window.location.origin}/agendar?servico=${encodeURIComponent(service.id)}`,
                              "Link de pagamento",
                            )
                          }
                        >
                          Link
                        </Button>
                        <Button
                          className="ghost danger-text"
                          disabled={pending}
                          onClick={() => removeService(service)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.services.length && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState>Nenhum serviço cadastrado.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "Creditos de Atendimento" && (
        <Card className="finance-section">
          <div className="finance-toolbar">
            <div>
              <h3>Créditos de Atendimento</h3>
              <p>Cortesia, reembolso ou parceria sem pagamento.</p>
            </div>
            <Button
              onClick={() => {
                setMessage("");
                setCreditModal(true);
              }}
            >
              <Plus size={16} /> Gerar crédito
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Cliente</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.credits.map((credit) => (
                  <tr key={credit.id}>
                    <td>
                      <code>{credit.codigo}</code>
                      <small className="table-subline">
                        {credit.observacao || "Sem observação"}
                      </small>
                    </td>
                    <td>{money(credit.valor_cents)}</td>
                    <td>
                      <Badge
                        className={
                          credit.status === "ativo"
                            ? "success"
                            : credit.status === "cancelado"
                              ? "attention"
                              : ""
                        }
                      >
                        {credit.status}
                      </Badge>
                    </td>
                    <td>{clientName(credit.cliente_ref)}</td>
                    <td>
                      <div className="table-actions">
                        <Button
                          className="secondary"
                          onClick={() => copy(credit.codigo, "Código")}
                        >
                          Código
                        </Button>
                        <Button
                          className="secondary"
                          onClick={() =>
                            copy(
                              `${window.location.origin}/agendar?credito=${encodeURIComponent(credit.codigo)}`,
                              "Link",
                            )
                          }
                        >
                          Link
                        </Button>
                        {credit.status === "ativo" && (
                          <Button
                            className="ghost danger-text"
                            disabled={pending}
                            onClick={() => cancelCredit(credit.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.credits.length && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState>Nenhum crédito gerado.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {serviceModal && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setServiceModal(false);
          }}
        >
          <Card
            className="profile-dialog profile-dialog-wide"
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-head">
              <div>
                <h2>{serviceForm.id ? "Editar plano" : "Novo plano"}</h2>
                <p>Configuração usada no checkout e no agendamento.</p>
              </div>
              <Button
                className="icon ghost"
                onClick={() => setServiceModal(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form">
              <div className="form-grid">
                <label>
                  Nome
                  <Input
                    value={serviceForm.name}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Valor (R$)
                  <Input
                    inputMode="decimal"
                    value={serviceForm.price}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        price: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full">
                  Descrição
                  <Input
                    value={serviceForm.description}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Frequência
                  <select
                    value={serviceForm.recurrence}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        recurrence: event.target.value as "avulso" | "monthly",
                      }))
                    }
                  >
                    <option value="avulso">Avulso</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </label>
                <label>
                  Prazo Express
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={serviceForm.prazo}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        prazo: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="full">
                  Itens incluídos (um por linha)
                  <textarea
                    rows={6}
                    value={serviceForm.items}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        items: event.target.value,
                      }))
                    }
                    placeholder="Título | explicação curta"
                  />
                </label>
                <label className="checkbox-row full">
                  <input
                    type="checkbox"
                    checked={serviceForm.active}
                    onChange={(event) =>
                      setServiceForm((value) => ({
                        ...value,
                        active: event.target.checked,
                      }))
                    }
                  />{" "}
                  Ativo no checkout
                </label>
              </div>
              {message && <div className="form-message">{message}</div>}
            </div>
            <div className="dialog-actions">
              <Button
                className="secondary"
                onClick={() => setServiceModal(false)}
              >
                Cancelar
              </Button>
              <Button disabled={pending} onClick={submitService}>
                <Save size={16} />
                {pending ? "Salvando…" : "Salvar plano"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {chargeModal && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChargeModal(false);
          }}
        >
          <Card
            className="profile-dialog profile-dialog-wide"
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-head">
              <div>
                <h2>Gerar cobrança</h2>
                <p>Cria no Asaas e vincula ao cliente e serviço.</p>
              </div>
              <Button
                className="icon ghost"
                onClick={() => setChargeModal(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form">
              <div className="form-grid">
                <label className="full">
                  Cliente
                  <select
                    value={chargeForm.clientId}
                    onChange={(event) =>
                      setChargeForm((value) => ({
                        ...value,
                        clientId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {data.radarClients.map((client) => (
                      <option value={client.id} key={client.id}>
                        {client.name} ·{" "}
                        {client.cpf || client.email || "sem documento"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Serviço
                  <select
                    value={chargeForm.servicoId}
                    onChange={(event) =>
                      setChargeForm((value) => ({
                        ...value,
                        servicoId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {data.services
                      .filter((service) => service.active !== false)
                      .map((service) => (
                        <option value={service.id} key={service.id}>
                          {service.name} · {money(service.price_cents)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Pagamento
                  <select
                    value={chargeForm.metodoPagamento}
                    onChange={(event) =>
                      setChargeForm((value) => ({
                        ...value,
                        metodoPagamento: event.target.value,
                      }))
                    }
                  >
                    <option value="pix">Pix</option>
                    <option value="cartao">Cartão no Asaas</option>
                  </select>
                </label>
                <label>
                  Modalidade
                  <select
                    value={chargeForm.modalidade}
                    onChange={(event) =>
                      setChargeForm((value) => ({
                        ...value,
                        modalidade: event.target.value,
                      }))
                    }
                  >
                    <option value="sem_agendamento">Express</option>
                    <option value="agendado">Agendado</option>
                  </select>
                </label>
                {chargeForm.modalidade === "agendado" && (
                  <>
                    <label>
                      Data
                      <Input
                        type="date"
                        value={chargeForm.date}
                        onChange={(event) =>
                          setChargeForm((value) => ({
                            ...value,
                            date: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Horário
                      <Input
                        type="time"
                        value={chargeForm.time}
                        onChange={(event) =>
                          setChargeForm((value) => ({
                            ...value,
                            time: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              {message && (
                <div className="form-message" role="alert">
                  {message}
                </div>
              )}
              {chargeResult && (
                <div className="charge-success">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Cobrança #{chargeResult.cobrancaId} criada</strong>
                    <span>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(chargeResult.valor || 0)}
                    </span>
                  </div>
                  {chargeResult.invoiceUrl && (
                    <Button
                      className="secondary"
                      onClick={() =>
                        window.open(
                          chargeResult.invoiceUrl,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Abrir no Asaas
                    </Button>
                  )}
                  {chargeResult.pixPayload && (
                    <Button
                      className="secondary"
                      onClick={() => copy(chargeResult.pixPayload || "", "Pix")}
                    >
                      Copiar Pix
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="dialog-actions">
              <Button
                className="secondary"
                onClick={() => setChargeModal(false)}
              >
                Fechar
              </Button>
              <Button
                disabled={
                  !chargeForm.clientId ||
                  !chargeForm.servicoId ||
                  Boolean(chargeResult)
                }
                onClick={() => void generateCharge()}
              >
                <ReceiptText size={16} /> Gerar no Asaas
              </Button>
            </div>
          </Card>
        </div>
      )}
      {creditModal && (
        <div className="dialog-backdrop">
          <Card className="profile-dialog" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div>
                <h2>Gerar crédito</h2>
                <p>Benefício resgatável sem pagamento.</p>
              </div>
              <Button
                className="icon ghost"
                onClick={() => setCreditModal(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form">
              <label>
                Valor (R$)
                <Input
                  inputMode="decimal"
                  value={creditForm.value}
                  onChange={(event) =>
                    setCreditForm((value) => ({
                      ...value,
                      value: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Validade
                <Input
                  type="date"
                  value={creditForm.expiresAt}
                  onChange={(event) =>
                    setCreditForm((value) => ({
                      ...value,
                      expiresAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Observação
                <textarea
                  rows={3}
                  value={creditForm.note}
                  onChange={(event) =>
                    setCreditForm((value) => ({
                      ...value,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
              {message && <div className="form-message">{message}</div>}
            </div>
            <div className="dialog-actions">
              <Button
                className="secondary"
                onClick={() => setCreditModal(false)}
              >
                Cancelar
              </Button>
              <Button disabled={pending} onClick={generateCredit}>
                <WalletCards size={16} />
                {pending ? "Gerando…" : "Gerar e copiar link"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
