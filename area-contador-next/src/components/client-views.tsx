"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, BadgeCheck, CalendarCheck, CalendarClock, CalendarPlus, Camera, Check, CheckCheck,
  CheckCircle2, CircleAlert, ClipboardList, Download, FileCheck2, FilePlus2,
  FileText, Inbox, KeyRound, Landmark, ListChecks, Lock, MessageCircle, Play, Search, Send, Star, Upload, UserRound, X, Zap,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui/primitives";
import { PageTitle } from "@/components/views";
import type { PortalAppointment, PortalAtendimentoExpress, PortalAvaliacao, PortalContador, PortalData, PortalDocument, PortalMailItem, PortalMessage, PortalObrigacao, PortalOcupado, PortalReport, PortalServico, PortalTriagem } from "@/lib/portal";
import { getDocumentDownloadUrl, markMailRead, markPortalMessagesRead, saveTriagem, sendPortalMailMessage, sendPortalMessage, submitAvaliacao } from "@/app/portal/actions";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { acharAssunto, completude, type TriagemAssunto, type TriagemPergunta, type TriagemRegras } from "@/lib/triagemCatalogo";
import { abrirImpressaoRelatorio } from "@/lib/reportPrint";

const PRESENCE_CHANNEL = "oc-presence";
const PRESENCE_TIMEOUT_MS = 15000;

function feedback(message: string) {
  window.dispatchEvent(new CustomEvent("app-feedback", { detail: message }));
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const statusLabel: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  done: "Concluído",
  cancelled: "Cancelado",
};

function PortalAvaliacaoCard({ report, avaliacoes }: { report: PortalReport | undefined; avaliacoes: PortalAvaliacao[] }) {
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviada, setEnviada] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (!report) return null;
  const jaAvaliada = report.casoRef ? avaliacoes.find((a) => a.casoRef === report.casoRef) : avaliacoes[0];
  const notaFinal = enviada ?? jaAvaliada?.nota ?? null;

  if (notaFinal) {
    return (
      <Card className="portal-tile avaliacao-tile">
        <p>Você deu nota {notaFinal} de 5. Obrigado por ajudar a melhorar o atendimento.</p>
      </Card>
    );
  }

  function enviar() {
    if (!nota || !report) return;
    startTransition(async () => {
      const result = await submitAvaliacao({ relatorioId: report.id, nota, comentario: comentario.trim() || null });
      if (result.ok) setEnviada(result.nota);
      else feedback(result.message);
    });
  }

  return (
    <Card className="portal-tile avaliacao-tile">
      <strong>Como foi o seu atendimento?</strong>
      <div className="avaliacao-estrelas">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} estrela${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setNota(n)}>
            <Star size={22} fill={(hover || nota) >= n ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <textarea placeholder="Quer comentar alguma coisa? (opcional)" rows={2} value={comentario} onChange={(event) => setComentario(event.target.value)} />
      <Button disabled={!nota || pending} onClick={enviar}>
        {pending ? "Enviando…" : "Enviar avaliação"}
      </Button>
    </Card>
  );
}

const STATUS_EXPRESS_LABEL: Record<string, string> = {
  aguardando_triagem: "Aguardando suas informações",
  em_analise: "Em análise",
  em_execucao: "Em execução",
  aguardando_documentos: "Aguardando documento",
  pronto_envio: "Resultado sendo preparado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// Porte 1:1 de atualizarProximaAcao do cliente.js legado — árvore de 9
// estados, primeiro que casar vence. A ordem dos `if`s é a regra.
type ProximaAcaoTom = "coral" | "green" | "pine";
type ProximaAcao = { Icon: typeof ListChecks; title: string; text: string; buttonLabel: string; target: string; tone: ProximaAcaoTom };

function computeProximaAcao(data: PortalData): ProximaAcao {
  const semAgendamento = data.client.atendimentoModalidade === "sem_agendamento";
  const triagemEnviada = data.triagem?.status === "enviada";
  const qtdDocs = data.documents.length;
  const temAppt = data.appointments.length > 0;
  const apptFeito = data.appointments.some((a) => a.status === "done");
  const relatorio = data.reports[0];
  const temRelatorio = Boolean(relatorio);
  const atendimentoExpress = data.atendimentosExpress.find((item) => item.status !== "concluido" && item.status !== "cancelado");

  if (temRelatorio && relatorio?.pendencias) {
    return {
      Icon: ListChecks,
      title: "Seu resultado foi entregue — há um próximo passo",
      text: relatorio.pendencias + (relatorio.prazoProximoPasso ? ` Prazo: ${formatDate(relatorio.prazoProximoPasso)}.` : ""),
      buttonLabel: "Ver relatório e próximos passos",
      target: "documentos",
      tone: "coral",
    };
  }
  if (temRelatorio) {
    return { Icon: FileCheck2, title: "Seu relatório está pronto", text: "O atendimento foi concluído. Baixe seu relatório quando quiser.", buttonLabel: "Ver relatório", target: "documentos", tone: "green" };
  }
  if (!triagemEnviada) {
    return { Icon: ClipboardList, title: "Conte o que aconteceu", text: "Responda perguntas simples, do seu jeito. O rascunho fica salvo automaticamente.", buttonLabel: "Começar triagem", target: "triagem", tone: "coral" };
  }
  if (semAgendamento && atendimentoExpress?.status === "aguardando_documentos") {
    return { Icon: FilePlus2, title: "Precisamos de mais um documento", text: "Abra seu caso para ver exatamente o que falta e continuar a análise.", buttonLabel: "Ver o que falta", target: "documentos", tone: "coral" };
  }
  if (!qtdDocs) {
    return {
      Icon: Camera,
      title: "Envie os documentos que você já tiver",
      text: semAgendamento ? "Você pode fotografar pelo celular. Se não tiver algum agora, avisaremos caso ele seja necessário." : "Eles ajudam o contador a analisar o caso antes da conversa.",
      buttonLabel: "Tirar foto ou anexar",
      target: "triagem",
      tone: "pine",
    };
  }
  if (semAgendamento) {
    return {
      Icon: CheckCircle2,
      title: "Está tudo conosco agora",
      text: "Você não precisa fazer nada neste momento." + (atendimentoExpress?.prazoConclusaoEm ? ` Previsão de conclusão: ${formatDate(atendimentoExpress.prazoConclusaoEm.slice(0, 10))}.` : " Avisaremos quando houver uma atualização."),
      buttonLabel: "Ver meu caso",
      target: "triagem",
      tone: "green",
    };
  }
  if (!temAppt) {
    return { Icon: CalendarPlus, title: "Escolha o horário do seu atendimento", text: "Depois da confirmação, seu chat será liberado no horário marcado.", buttonLabel: "Agendar atendimento", target: "agendamento", tone: "pine" };
  }
  if (!apptFeito) {
    return { Icon: CalendarCheck, title: "Seu atendimento está agendado", text: "Confira data e horário na sua agenda. O chat abre no momento da reunião.", buttonLabel: "Ver agendamento", target: "agendamento", tone: "pine" };
  }
  return { Icon: FileText, title: "Seu relatório está sendo preparado", text: "Assim que ele estiver pronto, você receberá um aviso aqui.", buttonLabel: "Acompanhar atendimento", target: "atendimento", tone: "pine" };
}

function PortalProximaAcaoCard({ data, onNavigate }: { data: PortalData; onNavigate: (id: string) => void }) {
  const acao = computeProximaAcao(data);
  const Icon = acao.Icon;
  return (
    <Card className={`portal-tile next-action-card tone-${acao.tone}`}>
      <div className="next-action-icon">
        <Icon size={20} />
      </div>
      <div className="next-action-body">
        <strong>{acao.title}</strong>
        <p>{acao.text}</p>
      </div>
      <Button className="secondary" onClick={() => onNavigate(acao.target)}>
        {acao.buttonLabel}
      </Button>
    </Card>
  );
}

// Porte 1:1 de montarLinhaDoTempo — duas listas de passos dependendo da
// modalidade (Express: 4 passos; agendado: 5), com a primeira não-feita
// marcada como "etapa atual".
type PassoTimeline = { titulo: string; descricao: string; feito: boolean };

function computeTimeline(data: PortalData): { passos: PassoTimeline[]; ativoIndex: number } {
  const semAgendamento = data.client.atendimentoModalidade === "sem_agendamento";
  const triagemEnviada = data.triagem?.status === "enviada";
  const qtdDocs = data.documents.length;
  const apptFeito = data.appointments.some((a) => a.status === "done");
  const temRelatorio = data.reports.length > 0;
  const atendimentoExpress = data.atendimentosExpress.find((item) => item.status !== "concluido" && item.status !== "cancelado");

  const passos: PassoTimeline[] = semAgendamento
    ? [
        { titulo: "Serviço contratado", descricao: "Seu pagamento foi confirmado.", feito: true },
        { titulo: "Triagem recebida", descricao: "Você contou o que aconteceu.", feito: Boolean(triagemEnviada) },
        {
          titulo: "Análise e execução",
          descricao: atendimentoExpress ? STATUS_EXPRESS_LABEL[atendimentoExpress.status] || "Em análise" : "Aguardando início da análise.",
          feito: atendimentoExpress ? ["em_execucao", "pronto_envio", "concluido"].includes(atendimentoExpress.status) : false,
        },
        { titulo: "Resultado entregue", descricao: "Relatório disponível em Documentos.", feito: temRelatorio },
      ]
    : [
        { titulo: "Serviço contratado", descricao: "Seu pagamento foi confirmado.", feito: true },
        { titulo: "Pré-atendimento", descricao: "Você contou o que aconteceu.", feito: Boolean(triagemEnviada) },
        { titulo: "Documentos", descricao: qtdDocs ? `${qtdDocs} documento(s) enviado(s).` : "Envie os documentos do seu caso.", feito: qtdDocs > 0 },
        { titulo: "Atendimento", descricao: apptFeito ? "Atendimento realizado." : "Agende um horário para conversar.", feito: apptFeito },
        { titulo: "Relatório entregue", descricao: "Relatório disponível em Documentos.", feito: temRelatorio },
      ];

  const ativoIndex = passos.findIndex((p) => !p.feito);
  return { passos, ativoIndex };
}

function PortalTimelineCard({ data }: { data: PortalData }) {
  const { passos, ativoIndex } = computeTimeline(data);
  const passoAtivo = ativoIndex >= 0 ? passos[ativoIndex] : null;
  const feitos = passos.filter((p) => p.feito).length;
  return (
    <Card className="portal-tile timeline-card">
      <strong>Linha do tempo do seu caso</strong>
      <div className="timeline-passos">
        {passos.map((p, i) => (
          <div key={p.titulo} className={`timeline-passo ${p.feito ? "feito" : i === ativoIndex ? "ativo" : ""}`}>
            <span className="timeline-marca">{p.feito ? <Check size={13} /> : i + 1}</span>
            <div>
              <strong>{p.titulo}</strong>
              <p>{p.descricao}</p>
            </div>
          </div>
        ))}
      </div>
      {passoAtivo ? (
        <p className="timeline-resumo">
          Etapa atual: <strong>{passoAtivo.titulo}</strong> · {feitos} de {passos.length} etapas concluídas.
        </p>
      ) : (
        <p className="timeline-resumo">Tudo certo — atendimento concluído.</p>
      )}
    </Card>
  );
}

// Porte 1:1 de loadAgendaFiscal — só existe pra quem tem serviço recorrente
// ativo (client.recorrente); a lista já vem calculada e ordenada de portal.ts.
function PortalAgendaFiscalCard({ obrigacoes }: { obrigacoes: PortalObrigacao[] }) {
  if (!obrigacoes.length) return null;
  return (
    <Card className="portal-tile agenda-fiscal-card">
      <div className="card-heading">
        <div>
          <Landmark size={18} />
          <strong>Agenda fiscal</strong>
        </div>
      </div>
      <div className="agenda-fiscal-lista">
        {obrigacoes.map((ob) => {
          const urgente = ob.reminderDays != null && ob.daysUntil <= ob.reminderDays;
          return (
            <div key={ob.id} className={`agenda-fiscal-item ${urgente ? "urgente" : ""}`}>
              <div>
                <strong>{ob.title}</strong>
                {ob.description && <p>{ob.description}</p>}
              </div>
              <div className="agenda-fiscal-data">
                {urgente && <AlertTriangle size={13} />}
                <span>{formatDate(ob.dueDate)}</span>
                <small>{ob.daysUntil === 0 ? "vence hoje" : ob.daysUntil === 1 ? "vence amanhã" : `em ${ob.daysUntil} dias`}</small>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Porte 1:1 do card dispensável "criar senha" — é 100% client-side
// (localStorage), sem coluna nem tabela nova. `null` = ainda não sabemos se
// já foi dispensado (evita flash), decidido no primeiro efeito.
function PortalCriarSenhaCard({ clientId }: { clientId: string }) {
  const storageKey = `oc_senha_feita_${clientId}`;
  const [show, setShow] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    setShow(window.localStorage.getItem(storageKey) !== "true");
  }, [storageKey]);

  if (!show) return null;

  function dispensar() {
    window.localStorage.setItem(storageKey, "true");
    setShow(false);
  }

  function salvar() {
    if (senha.length < 6) {
      setMensagem("Use pelo menos 6 caracteres.");
      return;
    }
    startTransition(async () => {
      const supabase = createBrowserClient();
      if (!supabase) {
        setMensagem("Conexão indisponível.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setMensagem("Não foi possível criar a senha agora.");
        return;
      }
      setMensagem("Senha criada!");
      window.setTimeout(dispensar, 1200);
    });
  }

  return (
    <Card className="portal-tile criar-senha-card">
      <div className="card-heading">
        <div>
          <KeyRound size={18} />
          <strong>Crie uma senha pra sua conta</strong>
        </div>
        <button type="button" className="icon-dismiss" aria-label="Dispensar" onClick={dispensar}>
          <X size={15} />
        </button>
      </div>
      <p>Hoje você entra só pelo link do e-mail. Com uma senha, fica mais rápido acessar depois.</p>
      <div className="criar-senha-form">
        <Input
          type="password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") salvar();
          }}
          placeholder="Mínimo de 6 caracteres"
        />
        <Button disabled={pending} onClick={salvar}>
          {pending ? "Salvando…" : "Criar senha"}
        </Button>
      </div>
      {mensagem && <small className="criar-senha-msg">{mensagem}</small>}
    </Card>
  );
}

export function PortalDashboardView({ data, onNavigate }: { data: PortalData; onNavigate: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const proximo = data.appointments
    .filter((item) => item.status !== "done" && item.status !== "cancelled" && item.date && item.date >= today)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
  const expressAtivo = data.atendimentosExpress.find((item) => item.status !== "concluido" && item.status !== "cancelado");
  const triagemPendente = data.triagem && data.triagem.status !== "enviada" ? data.triagem : null;
  const ultimaMensagem = data.messages[data.messages.length - 1];

  return (
    <div className="view-stack">
      <PageTitle title={`Olá, ${data.client.name.split(" ")[0]}`} description="Resumo do seu atendimento — o que precisa da sua atenção primeiro." />
      <PortalProximaAcaoCard data={data} onNavigate={onNavigate} />
      <PortalCriarSenhaCard clientId={data.client.id} />
      <section>
        <div className="stats-grid">
          <button type="button" className="card dashboard-link-card portal-tile" onClick={() => onNavigate(proximo || !expressAtivo ? "agendamento" : "historico")}>
            <div className="card-heading">
              <div>
                <CalendarClock size={18} />
                <strong>{expressAtivo && !proximo ? "Atendimento Express" : "Próximo atendimento"}</strong>
              </div>
            </div>
            {proximo ? (
              <p>
                {formatDate(proximo.date)} às {proximo.time}
                <br />
                <small>{proximo.taxType || "Atendimento agendado"}</small>
              </p>
            ) : expressAtivo ? (
              <p>
                {STATUS_EXPRESS_LABEL[expressAtivo.status] || expressAtivo.status}
                <br />
                <small>{expressAtivo.assunto || "Em andamento"} · previsão {formatDate(expressAtivo.prazoConclusaoEm.slice(0, 10))}</small>
              </p>
            ) : (
              <EmptyState>Nenhum atendimento agendado.</EmptyState>
            )}
          </button>

          <button type="button" className="card dashboard-link-card portal-tile" onClick={() => onNavigate("triagem")}>
            <div className="card-heading">
              <div>
                <CircleAlert size={18} />
                <strong>Pré-atendimento</strong>
              </div>
            </div>
            {triagemPendente ? (
              <p>
                Pendente: <strong>{triagemPendente.assunto ? nomeDoAssunto(data.triagemCatalogo, triagemPendente.assunto) : "conte o que aconteceu"}</strong>
              </p>
            ) : (
              <p>Nenhuma pendência no momento.</p>
            )}
          </button>

          <button type="button" className="card dashboard-link-card portal-tile" onClick={() => onNavigate("atendimento")}>
            <div className="card-heading">
              <div>
                <MessageCircle size={18} />
                <strong>Atendimento</strong>
              </div>
              {data.unreadMessages > 0 && <Badge className="nav-count">{data.unreadMessages}</Badge>}
            </div>
            {ultimaMensagem ? <p>{ultimaMensagem.text || (ultimaMensagem.type === "audio" ? "Mensagem de áudio" : "Anexo enviado")}</p> : <EmptyState>Nenhuma mensagem ainda.</EmptyState>}
          </button>

          <button type="button" className="card dashboard-link-card portal-tile" onClick={() => onNavigate("caixa-postal")}>
            <div className="card-heading">
              <div>
                <Inbox size={18} />
                <strong>Caixa Postal</strong>
              </div>
              {data.unreadMail > 0 && <Badge className="nav-count">{data.unreadMail}</Badge>}
            </div>
            <p>{data.mailbox.length} mensagem(ns) do escritório.</p>
          </button>
        </div>
      </section>
      <PortalTimelineCard data={data} />
      <PortalAgendaFiscalCard obrigacoes={data.agendaFiscal} />
      <PortalAvaliacaoCard report={data.reports.find((r) => r.status === "entregue")} avaliacoes={data.avaliacoes} />
    </div>
  );
}

function useContadorPresence(clientId: string) {
  const [lastSeen, setLastSeen] = useState(0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "ping" }, ({ payload }) => {
      if ((payload as { role?: string })?.role === "contador") setLastSeen(Date.now());
    });
    channel.subscribe();

    const pingInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        channel.send({ type: "broadcast", event: "ping", payload: { role: "client", id: clientId } });
      }
    }, 5000);
    // Recalcula "há X min" mesmo sem novo ping — o relógio precisa andar sozinho.
    const tickInterval = setInterval(() => forceTick((value) => value + 1), 10000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(tickInterval);
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  const isOnline = lastSeen > 0 && Date.now() - lastSeen < PRESENCE_TIMEOUT_MS;
  const label = isOnline
    ? "Online"
    : lastSeen === 0
      ? "Offline"
      : (() => {
          const min = Math.floor((Date.now() - lastSeen) / 60000);
          return min < 1 ? "Visto agora mesmo" : `Visto há ${min} min`;
        })();
  return { isOnline, label };
}

// Porta 1:1 a lógica de aplicarEstadoDoChat do cliente.js legado: "total"
// (agendamento futuro pendente, vence sobre tudo), "parcial"
// (clientes.status === 'locked', sem agendamento pendente) e "finalizado"
// (clientes.status === 'done'). Só o "finalizado" desabilita o campo — nos
// outros dois a mensagem digitada é redirecionada pra Caixa Postal.
type ChatLockMode = "none" | "total" | "parcial" | "finalizado";
type ChatLockAppointment = { date: string | null; time: string | null; status: string | null };

function computeChatLock(status: string | null, appointments: ChatLockAppointment[]): { mode: ChatLockMode; proximo: ChatLockAppointment | null } {
  if (status === "done") return { mode: "finalizado", proximo: null };
  const now = Date.now();
  const proximo =
    appointments
      .filter((a) => a.status !== "done" && a.status !== "cancelled" && a.date && a.time)
      .map((a) => ({ a, when: new Date(`${a.date}T${a.time}:00`).getTime() }))
      .filter(({ when }) => when > now)
      .sort((x, y) => x.when - y.when)[0]?.a ?? null;
  if (proximo) return { mode: "total", proximo };
  if (status === "locked") return { mode: "parcial", proximo: null };
  return { mode: "none", proximo: null };
}

function useChatLock(clientId: string, initialStatus: string | null, initialAppointments: PortalAppointment[]) {
  const [status, setStatus] = useState(initialStatus);
  const [appointments, setAppointments] = useState<ChatLockAppointment[]>(initialAppointments);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;

    async function refetch() {
      if (!supabase) return;
      const [clientResult, appointmentsResult] = await Promise.all([
        supabase.from("clientes").select("status").eq("id", clientId).maybeSingle(),
        supabase.from("agendamentos").select("date,time,status").eq("cliente_ref", clientId),
      ]);
      if (clientResult.data) setStatus(clientResult.data.status);
      if (appointmentsResult.data) setAppointments(appointmentsResult.data);
    }

    const channel = supabase
      .channel(`oc-status-${clientId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clientes", filter: `id=eq.${clientId}` }, (payload) => {
        setStatus((payload.new as { status: string | null }).status);
      })
      .subscribe();

    // Sem isso, ninguém pega a destravagem automática por horário — nada
    // escreve no banco quando o relógio passa da hora marcada, só o polling
    // percebe. Mesmo intervalo do legado (buscarStatusAtual a cada 10s).
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 10000);
    document.addEventListener("visibilitychange", refetch);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refetch);
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  return computeChatLock(status, appointments);
}

const TYPING_THROTTLE_MS = 2000;
const TYPING_HIDE_MS = 3000;

// Broadcast efêmero, nunca grava em tabela — mesmo desenho do legado
// (oc-typing-<clientId>): o payload só carrega quem está digitando, nunca
// o texto, porque o nome do canal é previsível a partir do id do cliente.
function useTypingIndicator(clientId: string) {
  const [agentTyping, setAgentTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`oc-typing-${clientId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if ((payload as { from?: string })?.from !== "agent") return;
      setAgentTyping(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setAgentTyping(false), TYPING_HIDE_MS);
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: "client" } });
  }

  return { agentTyping, notifyTyping };
}

function useLiveMessages(clientId: string, setMessages: (updater: (items: PortalMessage[]) => PortalMessage[]) => void) {
  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`oc-mensagens-${clientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `cliente_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as { id: string; sender: string; text: string | null; type: string | null; doc_name: string | null; duration: string | null; time: string | null; created_at: string | null; read_at: string | null; seq: number };
          setMessages((items) =>
            items.some((item) => item.id === row.id)
              ? items
              : [...items, { id: row.id, sender: row.sender, text: row.text, type: row.type, docName: row.doc_name, duration: row.duration, time: row.time, createdAt: row.created_at, readAt: row.read_at, seq: row.seq }],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensagens", filter: `cliente_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as { id: string; read_at: string | null };
          setMessages((items) => items.map((item) => (item.id === row.id ? { ...item, readAt: row.read_at } : item)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, setMessages]);
}

function MessageTicks({ item }: { item: PortalMessage }) {
  if (item.readAt) return <CheckCheck size={13} className="chat-tick lida" />;
  return <Check size={13} className="chat-tick" />;
}

function ChatAudioPlayer({ documentId, duration }: { documentId: number; duration: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (url) return <audio controls autoPlay preload="none" src={url} />;
  return (
    <button
      type="button"
      className="chat-audio-play"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const result = await getDocumentDownloadUrl(documentId);
        setLoading(false);
        if (result.ok) setUrl(result.url);
        else feedback(result.message);
      }}
    >
      <Play size={13} /> {loading ? "Carregando…" : `Tocar áudio${duration ? ` · ${duration}` : ""}`}
    </button>
  );
}

export function PortalAtendimentoView({
  messages: initialMessages,
  contador,
  clientId,
  clientStatus,
  appointments,
  triagem,
  reports,
  catalogo,
  documents,
  onNavigate,
}: {
  messages: PortalMessage[];
  contador: PortalContador;
  clientId: string;
  clientStatus: string | null;
  appointments: PortalAppointment[];
  triagem: PortalTriagem | null;
  reports: PortalReport[];
  catalogo: TriagemAssunto[];
  documents: PortalDocument[];
  onNavigate?: (id: string) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const presence = useContadorPresence(clientId);
  const lock = useChatLock(clientId, clientStatus, appointments);
  const typing = useTypingIndicator(clientId);
  useLiveMessages(clientId, setMessages);
  const initials = contador.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OC";
  // Mesma lógica do cliente.html: assunto vem do relatório mais recente, senão
  // da triagem ativa (traduzida pelo catálogo); protocolo vem do id da
  // triagem, senão do CPF/CNPJ.
  const nomeCaso = reports[0]?.titulo || (triagem?.assunto && nomeDoAssunto(catalogo, triagem.assunto)) || "Atendimento Geral";
  const protocolo = triagem ? String(triagem.id).padStart(4, "0") : clientId.replace(/\D/g, "").slice(0, 6) || "2026-001";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const router = useRouter();
  useEffect(() => {
    markPortalMessagesRead().then((result) => {
      if (result.ok) router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send() {
    const value = text.trim();
    if (!value) return;
    // Mesma regra do legado: com o chat travado (total ou parcial), a
    // mensagem não vai pro atendimento — vira Caixa Postal, e quem escreveu
    // é avisado que a resposta demora até 1 dia útil.
    if (lock.mode === "total" || lock.mode === "parcial") {
      startTransition(async () => {
        const result = await sendPortalMailMessage({ assunto: "", mensagem: value });
        if (result.ok) {
          setText("");
          feedback("Chat bloqueado no momento — sua mensagem foi enviada para a Caixa Postal. Resposta em até 1 dia útil.");
        } else {
          feedback(result.message);
        }
      });
      return;
    }
    startTransition(async () => {
      const result = await sendPortalMessage(value);
      if (result.ok) {
        setMessages((items) => [...items, result.data]);
        setText("");
      } else {
        feedback(result.message);
      }
    });
  }

  const lockPlaceholder =
    lock.mode === "finalizado"
      ? "Atendimento encerrado."
      : lock.mode === "total" || lock.mode === "parcial"
        ? "Chat bloqueado — sua mensagem vai para a Caixa Postal…"
        : "Escreva sua mensagem…";

  return (
    <div className="view-stack">
      <PageTitle title="Atendimento" description="Converse com o escritório sobre o seu caso." />
      <Card className="portal-chat-card">
        <div className="chat-header">
          <div className="chat-header-avatar" aria-hidden="true">
            {contador.logoDataUrl ? <img src={contador.logoDataUrl} alt="" /> : initials}
          </div>
          <div className="chat-header-info">
            <div className="chat-header-nome">
              <h3>{contador.name}</h3>
              {contador.verified && (
                <span className="chat-verificado" role="img" aria-label="Contador verificado" title="Contador verificado">
                  <BadgeCheck size={15} />
                </span>
              )}
            </div>
            {contador.crc && <p className="chat-header-crc">{contador.crc}</p>}
            <div className={`status-indicator ${presence.isOnline ? "online" : "offline"}`}>
              <span className="dot">●</span>
              <span className="status-text">{presence.label}</span>
            </div>
          </div>
          <div className="chat-header-meta">
            <span className="chat-header-meta-label">Atendimento sobre:</span>
            <strong className="chat-header-assunto">{nomeCaso}</strong>
            <span className="chat-header-codigo">Protocolo: #OC-{protocolo}</span>
          </div>
        </div>
        {lock.mode !== "none" && (
          <div className={`chat-lock-banner ${lock.mode}`}>
            {lock.mode === "finalizado" ? (
              <>
                <CheckCheck size={18} />
                <div>
                  <strong>Atendimento concluído</strong>
                  <p>O relatório do seu caso está em Documentos.</p>
                </div>
                {onNavigate && (
                  <Button className="secondary" onClick={() => onNavigate("documentos")}>
                    Ver relatório
                  </Button>
                )}
              </>
            ) : lock.mode === "total" ? (
              <>
                <CalendarClock size={18} />
                <div>
                  <strong>Seu atendimento ainda não começou</strong>
                  <p>
                    O chat abre no horário marcado. Se escrever agora, sua mensagem vai para a Caixa Postal (resposta em até 1 dia útil).
                    {lock.proximo?.date && lock.proximo?.time && (
                      <> Marcado para {formatDate(lock.proximo.date)} às {lock.proximo.time}.</>
                    )}
                  </p>
                </div>
                {onNavigate && (
                  <Button className="secondary" onClick={() => onNavigate("agendamento")}>
                    Ver agendamento
                  </Button>
                )}
              </>
            ) : (
              <>
                <Lock size={18} />
                <div>
                  <strong>Chat bloqueado temporariamente</strong>
                  <p>Se escrever agora, sua mensagem vai para a Caixa Postal (resposta em até 1 dia útil).</p>
                </div>
              </>
            )}
          </div>
        )}
        <div className="chat-messages">
          {messages.length ? (
            messages.map((item) => (
              // O trilho de cores é o mesmo do chat do contador (chat-message.client/.agent),
              // só que invertido: "agent" aqui alinha à direita e representa a MINHA mensagem.
              <div key={item.id} className={`chat-message ${item.sender === "client" ? "agent" : "client"}`}>
                <div>
                  <p>{item.text || (item.type === "audio" ? "Mensagem de áudio" : item.docName || "Anexo")}</p>
                  {item.type === "audio" &&
                    (() => {
                      const documento = documents.find((d) => d.fileName === item.docName);
                      return documento ? <ChatAudioPlayer documentId={documento.id} duration={item.duration} /> : null;
                    })()}
                  <small>
                    {item.time}
                    {item.sender === "client" && <MessageTicks item={item} />}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <EmptyState>Nenhuma mensagem ainda — escreva para o escritório abaixo.</EmptyState>
          )}
          {typing.agentTyping && (
            <div className="chat-digitando">
              <span /><span /><span />
              {contador.name} está digitando
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {lock.mode !== "finalizado" && (
          <div className="composer">
            <Input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (event.target.value.trim()) typing.notifyTyping();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={lockPlaceholder}
              disabled={pending}
            />
            <Button className="icon" disabled={pending || !text.trim()} onClick={send} aria-label="Enviar mensagem">
              <Send size={16} />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

type VaultStatus = { status: "empty" | "pending" | "viewed" | "deleted" | "expired"; expiresAt?: string | null };

const VAULT_STATUS_LABEL: Record<string, string> = {
  empty: "Nenhuma senha enviada",
  pending: "Protegida no cofre",
  viewed: "Aberta e apagada",
  deleted: "Revogada e apagada",
  expired: "Expirada e apagada",
};

function PortalCofreGovBr({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [senha, setSenha] = useState("");
  const [ttl, setTtl] = useState(48);
  const [autoriza, setAutoriza] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState("");

  async function chamar(action: string, extra?: Record<string, unknown>) {
    const response = await fetch("/api/clients/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, clientId, ...extra }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "vault_failed");
    return body as VaultStatus;
  }

  useEffect(() => {
    chamar("status")
      .then(setStatus)
      .catch(() => setStatus({ status: "empty" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar() {
    setErro("");
    if (senha.length < 8) {
      setErro("Digite a senha completa do gov.br no campo do cofre.");
      return;
    }
    if (!autoriza) {
      setErro("Confirme a autorização específica para o uso temporário da credencial.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await chamar("store", { password: senha, ttlHours: ttl, authorized: true });
        setSenha("");
        setAutoriza(false);
        setStatus(result);
        feedback("Senha protegida no cofre.");
      } catch {
        setErro("Não foi possível proteger a senha agora. Não a envie por outro canal; tente novamente.");
      }
    });
  }

  function apagar() {
    if (!window.confirm("Revogar o acesso e apagar agora a senha protegida?")) return;
    startTransition(async () => {
      try {
        setStatus(await chamar("delete"));
      } catch {
        setErro("Não foi possível apagar agora. Tente novamente.");
      }
    });
  }

  const pendente = status?.status === "pending";

  return (
    <Card className="portal-tile">
      <div className="card-heading">
        <div>
          <Lock size={18} />
          <strong>Cofre gov.br</strong>
        </div>
        {status && <Badge className={`cofre-badge cofre-${status.status}`}>{VAULT_STATUS_LABEL[status.status] || "Nenhuma senha enviada"}</Badge>}
      </div>
      <p className="triagem-dica">
        Use só se o contador pedir acesso temporário à sua conta gov.br. A senha fica criptografada e só pode ser aberta uma única vez pelo contador — depois é apagada para sempre.
      </p>
      {pendente && status?.expiresAt && <p className="triagem-dica">Disponível para uma única abertura até {new Date(status.expiresAt).toLocaleString("pt-BR")}.</p>}
      <label>
        Senha do gov.br
        <Input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Digite a senha" />
      </label>
      <label>
        Expira em
        <select className="input" value={ttl} onChange={(event) => setTtl(Number(event.target.value))}>
          <option value={24}>24 horas</option>
          <option value={48}>48 horas</option>
          <option value={72}>72 horas</option>
        </select>
      </label>
      <label className="perfil-checkbox">
        <input type="checkbox" checked={autoriza} onChange={(event) => setAutoriza(event.target.checked)} />
        <span>Autorizo o uso temporário desta senha pelo contador para o atendimento solicitado.</span>
      </label>
      {erro && <p className="login-error">{erro}</p>}
      <div className="portal-form-acoes">
        <Button disabled={pending} onClick={enviar}>
          {pendente ? "Substituir senha do cofre" : "Enviar ao cofre seguro"}
        </Button>
        {pendente && (
          <button type="button" className="secondary compact" disabled={pending} onClick={apagar}>
            Apagar senha
          </button>
        )}
      </div>
    </Card>
  );
}

export function PortalPerfilView({ client }: { client: PortalData["client"] }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  function salvarSenha() {
    setMensagem("");
    if (novaSenha.length < 6) {
      setMensagem("A senha precisa ter pelo menos 6 caracteres.");
      setErro(true);
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setMensagem("As senhas digitadas não coincidem.");
      setErro(true);
      return;
    }
    startTransition(async () => {
      const supabase = createBrowserClient();
      if (!supabase) {
        setMensagem("Conexão indisponível.");
        setErro(true);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) {
        setMensagem("Não foi possível alterar a senha. Tente novamente.");
        setErro(true);
        return;
      }
      setNovaSenha("");
      setConfirmaSenha("");
      setMensagem("Senha alterada com sucesso! Você já pode usá-la para acessar sua conta.");
      setErro(false);
    });
  }

  const endereco =
    [client.endereco && `${client.endereco}${client.numero ? `, ${client.numero}` : ""}`, client.bairro, [client.cidade, client.estado].filter(Boolean).join(" - ") || null, client.cep && `CEP: ${client.cep}`]
      .filter(Boolean)
      .join(" • ") || "Endereço não informado";
  const cpfFmt = client.cpf
    ? (() => {
        const clean = client.cpf!.replace(/\D/g, "");
        return clean.length === 11 ? `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}` : client.cpf;
      })()
    : "Não informado";

  return (
    <div className="view-stack">
      <PageTitle title="Meu perfil" description="Seus dados e segurança da conta." />
      <Card className="portal-tile">
        <div className="card-heading">
          <div>
            <UserRound size={18} />
            <strong>Dados cadastrais</strong>
          </div>
        </div>
        <div className="perfil-dados-grid">
          <div>
            <span>Nome</span>
            <strong>{client.name}</strong>
          </div>
          <div>
            <span>CPF/CNPJ</span>
            <strong>{cpfFmt}</strong>
          </div>
          <div>
            <span>Telefone</span>
            <strong>{client.phone || "Não informado"}</strong>
          </div>
          <div>
            <span>E-mail</span>
            <strong>{client.email || "Não informado"}</strong>
          </div>
          <div>
            <span>Endereço</span>
            <strong>{endereco}</strong>
          </div>
          <div>
            <span>Serviço</span>
            <strong>{client.taxType || "Atendimento Olá, Contador"}</strong>
          </div>
        </div>
        <p className="triagem-dica">Para corrigir algum dado cadastral, fale com o escritório pelas Mensagens.</p>
      </Card>

      <Card className="portal-tile">
        <div className="card-heading">
          <div>
            <Lock size={18} />
            <strong>Segurança</strong>
          </div>
        </div>
        <label>
          Nova senha
          <Input type="password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} />
        </label>
        <label>
          Confirmar nova senha
          <Input type="password" value={confirmaSenha} onChange={(event) => setConfirmaSenha(event.target.value)} />
        </label>
        {mensagem && <p className={erro ? "login-error" : "triagem-salvo"}>{mensagem}</p>}
        <Button disabled={pending || !novaSenha} onClick={salvarSenha}>
          {pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </Card>

      <PortalCofreGovBr clientId={client.id} />
    </div>
  );
}

const DIA_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Só dias úteis (o escritório não atende fim de semana) — mesma janela do
// cliente.html: 5 dias a partir de hoje + offset de semanas inteiras.
function diasUteisSemana(offsetSemanas: number): string[] {
  const base = new Date();
  base.setDate(base.getDate() + offsetSemanas * 7);
  const dias: string[] = [];
  const cursor = new Date(base);
  while (dias.length < 5) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

type ChargeResult = {
  cobrancaId?: number;
  pixPayload?: string;
  pixImage?: string;
  invoiceUrl?: string;
  metodoPagamento?: string;
  valor?: number;
  valorOriginal?: number;
  desconto?: boolean;
  servico?: { name: string };
};

export function PortalAgendaView({
  clientId,
  appointments,
  servicos,
  agendaHorarios,
  agendaDiasBloqueados,
  agendaOcupados,
}: {
  clientId: string;
  appointments: PortalAppointment[];
  servicos: PortalServico[];
  agendaHorarios: string[];
  agendaDiasBloqueados: string[];
  agendaOcupados: PortalOcupado[];
}) {
  const [servicoId, setServicoId] = useState(servicos[0]?.id || "");
  const [offsetSemanas, setOffsetSemanas] = useState(0);
  const dias = diasUteisSemana(offsetSemanas);
  const hoje = new Date().toISOString().slice(0, 10);
  const agora = new Date();
  const horaAgoraStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [diaManual, setDiaManual] = useState(false);
  const [horaEscolhida, setHoraEscolhida] = useState<string | null>(null);
  const [horaManual, setHoraManual] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao">("pix");
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ChargeResult | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState("");
  const router = useRouter();

  function horaOcupada(dia: string, hora: string) {
    return agendaOcupados.some((item) => item.date === dia && item.time === hora);
  }
  function horaPassada(dia: string, hora: string) {
    return dia === hoje && hora <= horaAgoraStr;
  }
  // Primeiro horário livre do dia — usado tanto pra marcar o dia como
  // "lotado" na pill quanto pra pré-selecionar o horário, igual ao
  // cliente.html (o cliente só precisa confirmar, não montar do zero).
  function primeiroLivre(dia: string): string | null {
    if (agendaDiasBloqueados.includes(dia)) return null;
    return agendaHorarios.find((hora) => !horaOcupada(dia, hora) && !horaPassada(dia, hora)) ?? null;
  }

  const diaAtual = diaManual && diaEscolhido && dias.includes(diaEscolhido) ? diaEscolhido : (dias.find((d) => primeiroLivre(d)) ?? dias[0]);
  const diaBloqueado = agendaDiasBloqueados.includes(diaAtual);
  const horaAtual = horaManual && horaEscolhida && !horaOcupada(diaAtual, horaEscolhida) && !horaPassada(diaAtual, horaEscolhida) ? horaEscolhida : primeiroLivre(diaAtual);

  function irSemana(delta: number) {
    setOffsetSemanas((v) => Math.max(0, v + delta));
    setDiaManual(false);
    setHoraManual(false);
  }

  function escolherDia(dia: string) {
    setDiaEscolhido(dia);
    setDiaManual(true);
    setHoraManual(false);
  }

  function escolherHora(hora: string) {
    setHoraEscolhida(hora);
    setHoraManual(true);
  }

  const servico = servicos.find((item) => item.id === servicoId);

  function gerarPagamento() {
    if (!servico || !horaAtual) return;
    setErro("");
    startTransition(async () => {
      const response = await fetch("/api/finance/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, servicoId: servico.id, date: diaAtual, time: horaAtual, modalidade: "agendado", metodoPagamento }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setErro(body?.error === "asaas_not_configured" ? "Pagamento ainda não está disponível neste ambiente." : "Não foi possível gerar o pagamento agora.");
        return;
      }
      if (body.invoiceUrl && metodoPagamento === "cartao") {
        window.open(body.invoiceUrl, "_blank", "noopener,noreferrer");
      }
      setResultado(body);
    });
  }

  // Confere a cada 4s se a cobrança foi paga (mesmo polling do checkout do
  // cliente.html) — assim que confirma, atualiza a lista de agendamentos.
  useEffect(() => {
    if (!resultado?.cobrancaId || pago) return;
    const supabase = createBrowserClient();
    if (!supabase) return;
    const timer = setInterval(async () => {
      const { data } = await supabase.from("cobrancas").select("status").eq("id", resultado.cobrancaId!).maybeSingle();
      if (data?.status === "paid") {
        clearInterval(timer);
        setPago(true);
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [resultado?.cobrancaId, pago, router]);

  if (resultado) {
    const precoFmt = typeof resultado.valor === "number" ? resultado.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
    const descontoFmt = resultado.desconto && resultado.valorOriginal ? ` (10% de desconto — de ${resultado.valorOriginal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})` : "";
    return (
      <div className="view-stack">
        <PageTitle title={pago ? "Atendimento confirmado" : "Pagamento gerado"} description={pago ? "Seu atendimento começará no horário agendado." : "Finalize o pagamento para confirmar seu atendimento."} />
        <Card className="portal-form">
          {pago ? (
            <div className="triagem-espera pronto">
              <CheckCheck size={20} />
              <div>
                <strong>Pagamento confirmado</strong>
                <p>
                  {resultado.servico?.name} · {formatDate(diaAtual)} às {horaAtual}. Seu atendimento começará no horário agendado.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p>
                {resultado.servico?.name} — {precoFmt}
                {descontoFmt} · {formatDate(diaAtual)} às {horaAtual}
              </p>
              <span className="triagem-passo">{resultado.metodoPagamento === "cartao" ? "Pague com cartão para confirmar" : "Pague com Pix para confirmar"}</span>
              {resultado.pixImage ? (
                <>
                  <img src={`data:image/png;base64,${resultado.pixImage}`} alt="QR Code Pix" style={{ maxWidth: 220 }} />
                  <label>
                    Pix copia e cola
                    <textarea readOnly value={resultado.pixPayload || ""} onClick={(event) => (event.target as HTMLTextAreaElement).select()} />
                  </label>
                </>
              ) : resultado.invoiceUrl ? (
                <p>
                  Abrimos a página segura de pagamento em outra aba. Se não abriu,{" "}
                  <a href={resultado.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    clique aqui
                  </a>
                  .
                </p>
              ) : null}
              <p className="triagem-dica">Assim que o pagamento for confirmado, esta tela atualiza sozinha.</p>
            </>
          )}
          <Button onClick={() => { setResultado(null); setPago(false); }}>{pago ? "Agendar outro horário" : "Cancelar e escolher outro horário"}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <PageTitle title="Agendar Atendimento" description="Escolha o serviço, veja os horários disponíveis e confirme seu atendimento com o contador." />
      <div className="portal-agenda-grid">
        <Card className="portal-form">
          <span className="triagem-passo">1. Escolha o serviço</span>
          {servicos.length ? (
            servicos.map((item) => (
              <button key={item.id} type="button" className={`triagem-assunto-card ${servicoId === item.id ? "selecionado" : ""}`} onClick={() => setServicoId(item.id)}>
                <strong>{item.name}</strong>
                <span>{(item.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </button>
            ))
          ) : (
            <EmptyState>Nenhum serviço disponível no momento.</EmptyState>
          )}
        </Card>

        <Card className="portal-form">
          <span className="triagem-passo">2. Data e horário</span>
          <div className="portal-agenda-semana">
            <button type="button" className="secondary compact" disabled={offsetSemanas === 0} onClick={() => irSemana(-1)}>
              ‹
            </button>
            <span>
              {formatDate(dias[0])} a {formatDate(dias[dias.length - 1])}
            </span>
            <button type="button" className="secondary compact" onClick={() => irSemana(1)}>
              ›
            </button>
          </div>
          <div className="portal-agenda-dias">
            {dias.map((dia) => (
              <button key={dia} type="button" className={`portal-agenda-dia ${diaAtual === dia ? "selecionado" : ""} ${!primeiroLivre(dia) ? "lotado" : ""}`} onClick={() => escolherDia(dia)}>
                <small>{DIA_SEMANA_CURTO[new Date(`${dia}T12:00:00`).getDay()]}</small>
                <strong>{dia.slice(8, 10)}/{dia.slice(5, 7)}</strong>
              </button>
            ))}
          </div>
          {diaBloqueado ? (
            <p>Não atendemos neste dia. Escolha outra data.</p>
          ) : (
            <div className="portal-agenda-horarios">
              {agendaHorarios.map((hora) => {
                const ocupado = horaOcupada(diaAtual, hora);
                const passou = horaPassada(diaAtual, hora);
                return (
                  <button key={hora} type="button" className={`triagem-chip ${horaAtual === hora ? "selecionado" : ""}`} disabled={ocupado || passou} onClick={() => escolherHora(hora)}>
                    {hora}
                  </button>
                );
              })}
            </div>
          )}
          <span className="triagem-passo">3. Pagamento</span>
          <div className="portal-agenda-pagamento">
            <button type="button" className={`triagem-assunto-card ${metodoPagamento === "pix" ? "selecionado" : ""}`} onClick={() => setMetodoPagamento("pix")}>
              <strong>Pix</strong>
              <span>Confirmação na hora</span>
            </button>
            <button type="button" className={`triagem-assunto-card ${metodoPagamento === "cartao" ? "selecionado" : ""}`} onClick={() => setMetodoPagamento("cartao")}>
              <strong>Cartão de crédito</strong>
              <span>à vista ou parcelado</span>
            </button>
          </div>
          {erro && <p className="login-error">{erro}</p>}
          <Button disabled={pending || !servico || !horaAtual || diaBloqueado} onClick={gerarPagamento}>
            {pending ? "Gerando…" : metodoPagamento === "pix" ? "Gerar pagamento Pix" : "Ir para pagamento"}
          </Button>
        </Card>
      </div>

      <Card>
        {appointments.length ? (
          <div className="records-list appointment-list">
            {appointments.map((item) => (
              <article key={item.id}>
                <div className="record-date">
                  <strong>{formatDate(item.date)}</strong>
                  <small>{item.time || "A definir"}</small>
                </div>
                <div>
                  <strong>{item.taxType || "Atendimento"}</strong>
                  <span>Status: {statusLabel[item.status || ""] || item.status || "—"}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Nenhum agendamento encontrado.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function nomeDoAssunto(catalogo: TriagemAssunto[], assuntoId: string | null): string {
  if (!assuntoId) return "Assunto não informado";
  return acharAssunto(catalogo, assuntoId)?.titulo || assuntoId;
}

function QuestionField({ pergunta, value, onChange, disabled }: { pergunta: TriagemPergunta; value: string; onChange: (value: string) => void; disabled: boolean }) {
  if (pergunta.tipo === "escolha" || pergunta.tipo === "sim-nao") {
    const opcoes = pergunta.tipo === "sim-nao" ? ["Sim", "Não"] : pergunta.opcoes || [];
    return (
      <div className="triagem-chips">
        {opcoes.map((opcao) => (
          <button key={opcao} type="button" className={`triagem-chip ${value === opcao ? "selecionado" : ""}`} disabled={disabled} onClick={() => onChange(opcao)}>
            {opcao}
          </button>
        ))}
      </div>
    );
  }
  if (pergunta.tipo === "textao") {
    return <textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />;
  }
  return <Input type={pergunta.tipo === "data" ? "date" : "text"} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />;
}

function formatarQuando(data: string, hora: string | null): string {
  const quando = new Date(`${data}T${hora || "00:00"}:00`);
  if (Number.isNaN(quando.getTime())) return "Horário a confirmar";
  const hoje = new Date();
  const zera = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((zera(quando).getTime() - zera(hoje).getTime()) / 86400000);
  const horaTxt = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias === 0) return `Hoje às ${horaTxt}`;
  if (dias === 1) return `Amanhã às ${horaTxt}`;
  if (dias > 1) return `Em ${dias} dias, ${quando.toLocaleDateString("pt-BR")} às ${horaTxt}`;
  return `${quando.toLocaleDateString("pt-BR")} às ${horaTxt}`;
}

export function PortalTriagemView({
  triagem,
  catalogo,
  regras,
  clientId,
  documents: initialDocuments,
  appointments,
}: {
  triagem: PortalTriagem | null;
  catalogo: TriagemAssunto[];
  regras: TriagemRegras;
  clientId: string;
  documents: PortalDocument[];
  appointments: PortalAppointment[];
}) {
  const router = useRouter();
  const [assuntoId, setAssuntoId] = useState<string | null>(triagem?.assunto && acharAssunto(catalogo, triagem.assunto) ? triagem.assunto : null);
  const [respostas, setRespostas] = useState<Record<string, string>>((triagem?.respostas as Record<string, string>) || {});
  const [descricao, setDescricao] = useState(triagem?.descricao || "");
  const [status, setStatus] = useState(triagem?.status || "rascunho");
  const [enviadaEm, setEnviadaEm] = useState(triagem?.enviadaEm || null);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvo, setSalvo] = useState("");
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const montado = useRef(false);
  const salvoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const assunto = assuntoId ? acharAssunto(catalogo, assuntoId) : null;
  const minimo = regras.minimoRelato || 20;
  const mostrarResumo = status === "enviada" && !editando;
  const pct = completude({ assunto: assuntoId, descricao, respostas }, catalogo, regras);
  const medidorTexto = pct >= 90 ? "O contador vai chegar sabendo do seu caso" : pct >= 60 ? "Já dá um bom contexto — se puder, complete" : pct >= 30 ? "Falta o principal: o que aconteceu" : "Vamos lá";

  const proximoAtendimento = appointments
    .filter((item) => item.status !== "done" && item.status !== "cancelled")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];

  // Rascunho salva sozinho (debounce de 800ms) — mesma UX do cliente.html:
  // quem está contando um problema fiscal não deveria ter que lembrar de
  // clicar em "salvar".
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    if (status === "enviada" && !editando) return;
    const timer = setTimeout(() => {
      startSave(false);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assuntoId, descricao, respostas]);

  function startSave(enviar: boolean) {
    if (enviar) setEnviando(true);
    saveTriagem({ assunto: assuntoId, descricao, respostas, enviar })
      .then((result) => {
        if (!result.ok) {
          if (salvoTimer.current) clearTimeout(salvoTimer.current);
          setSalvo("Problema de conexão ao salvar.");
          if (enviar) feedback(result.message || "Não foi possível enviar.");
          return;
        }
        setStatus(result.data.status);
        setEnviadaEm(result.data.enviadaEm);
        if (salvoTimer.current) clearTimeout(salvoTimer.current);
        setSalvo("Salvo");
        salvoTimer.current = setTimeout(() => setSalvo(""), 2000);
        if (enviar) {
          feedback("Pré-atendimento enviado ao escritório.");
          setTimeout(() => setEditando(false), 800);
          router.refresh();
        }
      })
      .finally(() => {
        if (enviar) setEnviando(false);
      });
  }

  function enviar() {
    if (!assuntoId) {
      setSalvo("Escolha do que se trata, ali em cima.");
      return;
    }
    if (descricao.trim().length < minimo) {
      setSalvo("Conte um pouco do que aconteceu — nem que sejam duas linhas.");
      return;
    }
    startSave(true);
  }

  async function anexarDocumento(nomeItem: string, usarCamera: boolean) {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = usarCamera ? "image/*" : "image/*,application/pdf";
      if (usarCamera) input.setAttribute("capture", "environment");
      input.addEventListener("change", () => resolve(input.files?.[0] || null));
      input.click();
    });
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      feedback("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    const supabase = createBrowserClient();
    if (!supabase) {
      feedback("Conexão indisponível.");
      return;
    }
    setUploadingItem(nomeItem);
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${clientId}/${Date.now()}_${safeName}`;
    try {
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (storageError) throw storageError;
      const { data: doc, error: recordError } = await supabase
        .from("documentos")
        .insert({ cliente_ref: clientId, file_name: file.name, mime: file.type, size_bytes: file.size, storage_path: path, uploaded_by: "client", checklist_item: nomeItem })
        .select("id,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,storage_path")
        .single();
      if (recordError || !doc) throw recordError;
      setDocuments((items) => [
        { id: doc.id, fileName: doc.file_name, mime: doc.mime, sizeBytes: doc.size_bytes, uploadedBy: doc.uploaded_by, createdAt: doc.created_at, checklistItem: doc.checklist_item, storagePath: doc.storage_path },
        ...items,
      ]);
      feedback("Documento anexado.");
    } catch {
      feedback("Não foi possível anexar esse arquivo agora.");
    } finally {
      setUploadingItem(null);
    }
  }

  return (
    <div className="view-stack">
      <PageTitle title="Pré-atendimento" description="Conte o que aconteceu antes do seu atendimento. Quanto mais o contador souber antes, menos tempo vocês gastam se apresentando." />

      {proximoAtendimento && (
        <Card className={`triagem-espera ${status === "enviada" ? "pronto" : ""}`}>
          {status === "enviada" ? <CheckCheck size={20} /> : <CalendarClock size={20} />}
          <div>
            <strong>{status === "enviada" ? "Tudo certo — nosso time já está cuidando" : "Seu atendimento já começou"}</strong>
            <p>
              {formatarQuando(proximoAtendimento.date || "", proximoAtendimento.time)}
              {status !== "enviada" ? ". Aproveite a espera para contar seu caso aqui embaixo." : ""}
            </p>
          </div>
        </Card>
      )}

      {mostrarResumo ? (
        <Card className="triagem-resumo">
          <div className="triagem-resumo-topo">
            <div>
              <span className="triagem-resumo-eyebrow">Você já contou seu caso</span>
              <h3>{assunto?.titulo || "Seu caso"}</h3>
            </div>
            <Button className="ghost" onClick={() => setEditando(true)}>Editar</Button>
          </div>
          <div className="triagem-resumo-item">
            <span className="triagem-resumo-label">O que aconteceu</span>
            <p>{descricao || "—"}</p>
          </div>
          {assunto?.perguntas.filter((p) => respostas[p.id]).map((p) => (
            <div key={p.id} className="triagem-resumo-item">
              <span className="triagem-resumo-label">{p.label}</span>
              <p>{respostas[p.id]}</p>
            </div>
          ))}
        </Card>
      ) : (
        <>
          <Card className="portal-form">
            <span className="triagem-passo">1 · Sobre o que você precisa falar?</span>
            <div className="triagem-assuntos-grid">
              {catalogo.map((item) => (
                <button key={item.id} type="button" className={`triagem-assunto-card ${assuntoId === item.id ? "selecionado" : ""}`} onClick={() => setAssuntoId(item.id)}>
                  <strong>{item.titulo}</strong>
                  <span>{item.resumo}</span>
                </button>
              ))}
            </div>
          </Card>

          {assunto && (
            <>
              <Card className="portal-form">
                <span className="triagem-passo">2 · Me conta um pouco mais</span>
                {assunto.perguntas.map((pergunta) => (
                  <label key={pergunta.id}>
                    {pergunta.label} {!pergunta.opcional && <span className="triagem-obrigatorio">obrigatório</span>}
                    {pergunta.dica && <small className="triagem-dica">{pergunta.dica}</small>}
                    <QuestionField pergunta={pergunta} value={respostas[pergunta.id] || ""} disabled={enviando} onChange={(value) => setRespostas((current) => ({ ...current, [pergunta.id]: value }))} />
                  </label>
                ))}
                <label>
                  O que aconteceu? <span className="triagem-obrigatorio">obrigatório</span>
                  <small className="triagem-dica">Escreva com suas palavras, do seu jeito — não precisa saber os termos técnicos.</small>
                  <textarea value={descricao} onChange={(event) => setDescricao(event.target.value)} disabled={enviando} placeholder={`Conte o que está acontecendo (pelo menos ${minimo} caracteres).`} />
                </label>
              </Card>

              <Card className="portal-form">
                <span className="triagem-passo">3 · Envie o que você já tem</span>
                <p className="triagem-dica">Use a câmera do celular ou escolha um arquivo. Se algo importante estiver faltando, avisaremos exatamente o que enviar.</p>
                <div className="triagem-docs">
                  {assunto.documentos.map((nome) => {
                    const enviado = documents.find((d) => d.checklistItem === nome);
                    const carregando = uploadingItem === nome;
                    return (
                      <div key={nome} className={`triagem-doc ${enviado ? "pronto" : ""}`}>
                        {enviado ? <CheckCheck size={16} /> : <CircleAlert size={16} />}
                        <div className="triagem-doc-nome">
                          {nome}
                          {enviado && <span className="triagem-doc-arquivo">{enviado.fileName}</span>}
                        </div>
                        <div className="triagem-doc-acoes">
                          <button type="button" className="triagem-doc-btn" disabled={carregando} onClick={() => anexarDocumento(nome, true)}>
                            {carregando ? "Enviando…" : enviado ? "Nova foto" : "Tirar foto"}
                          </button>
                          <button type="button" className="triagem-doc-btn" disabled={carregando} onClick={() => anexarDocumento(nome, false)}>
                            {enviado ? "Trocar arquivo" : "Escolher arquivo"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="triagem-barra">
                <div className="triagem-medidor">
                  <div className="triagem-medidor-topo">
                    <span>{medidorTexto}</span>
                    <strong>{pct}%</strong>
                  </div>
                  <div className="triagem-medidor-trilho">
                    <div className="triagem-medidor-barra" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="triagem-acoes">
                  <span className="triagem-salvo">{salvo}</span>
                  <Button disabled={enviando} onClick={enviar}>
                    {enviando ? "Enviando…" : status === "enviada" ? "Enviado — atualizar" : "Enviar para o contador"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DocumentList({ title, documents, busyId, pending, onDownload }: { title: string; documents: PortalDocument[]; busyId: number | null; pending: boolean; onDownload: (doc: PortalDocument) => void }) {
  return (
    <div className="portal-doc-list">
      <h4>{title}</h4>
      {documents.length ? (
        <div className="records-list">
          {documents.map((item) => (
            <article key={item.id}>
              <div className="record-icon">
                <FileText size={16} />
              </div>
              <div>
                <strong>{item.fileName}</strong>
                <small>{formatBytes(item.sizeBytes)}{item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ""}</small>
              </div>
              <div className="table-actions">
                <button type="button" className="secondary compact" disabled={pending && busyId === item.id} onClick={() => onDownload(item)}>
                  <Download size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="portal-doc-empty">Nenhum documento {title === "Meus Arquivos (Enviados)" ? "enviado" : "recebido"} ainda.</p>
      )}
    </div>
  );
}

function ReportList({ reports }: { reports: PortalReport[] }) {
  if (!reports.length) return null;
  return (
    <div className="portal-doc-list">
      <h4>Relatórios de Atendimento</h4>
      <div className="records-list">
        {reports.map((report) => (
          <article key={report.id}>
            <div className="record-icon">
              <FileText size={16} />
            </div>
            <div>
              <strong>{report.titulo || "Relatório de atendimento"}</strong>
              <span>{report.entregueEm ? `Entregue em ${formatDateTime(report.entregueEm)}` : "Disponível"}</span>
              {report.anexos.length > 0 && (
                <small>
                  {report.anexos.map((anexo, index) => (
                    <span key={anexo.id}>
                      {index > 0 && " · "}
                      {anexo.url ? (
                        <a href={anexo.url} target="_blank" rel="noopener noreferrer">
                          {anexo.titulo}
                        </a>
                      ) : (
                        anexo.titulo
                      )}
                    </span>
                  ))}
                </small>
              )}
            </div>
            <button
              type="button"
              className="secondary compact"
              onClick={() =>
                abrirImpressaoRelatorio({
                  titulo: report.titulo,
                  cliente_nome: report.clienteNome,
                  cliente_cpf: report.clienteCpf,
                  problema: report.problema,
                  solucao: report.solucao,
                  oque_feito: report.oqueFeito,
                  como_feito: report.comoFeito,
                  pendencias: report.pendencias,
                  contador_assinatura: report.contadorAssinatura,
                  contador_nome: report.contadorNome,
                  contador_crc: report.contadorCrc,
                  codigo_validacao: report.codigoValidacao,
                })
              }
            >
              Ver relatório
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function PortalDocumentosView({ clientId, documents: initialDocuments, reports }: { clientId: string; documents: PortalDocument[]; reports: PortalReport[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function download(document: PortalDocument) {
    setBusyId(document.id);
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(document.id);
      setBusyId(null);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else feedback(result.message);
    });
  }

  async function uploadFile(file: File) {
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
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${clientId}/${Date.now()}_${safeName}`;
    try {
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) throw storageError;
      const { data: document, error: recordError } = await supabase
        .from("documentos")
        .insert({ cliente_ref: clientId, file_name: file.name, mime: file.type, size_bytes: file.size, storage_path: path, uploaded_by: "client" })
        .select("id,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,storage_path")
        .single();
      if (recordError || !document) throw recordError;
      setDocuments((items) => [
        { id: document.id, fileName: document.file_name, mime: document.mime, sizeBytes: document.size_bytes, uploadedBy: document.uploaded_by, createdAt: document.created_at, checklistItem: document.checklist_item, storagePath: document.storage_path },
        ...items,
      ]);
      feedback("Documento enviado.");
    } catch {
      feedback("Não foi possível enviar o documento agora.");
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadFile(file);
  }

  const meusArquivos = documents.filter((item) => item.uploadedBy === "client");
  const recebidos = documents.filter((item) => item.uploadedBy !== "client");

  return (
    <div className="view-stack">
      <PageTitle title="Seus Documentos" description="Faça upload de recibos, RGs e baixe as guias enviadas pelo contador." />
      <div className="portal-documentos-grid">
        <button
          type="button"
          className={`portal-dropzone ${dragOver ? "arrastando" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={onInputChange} />
          <Upload size={28} />
          <strong>{uploading ? "Enviando…" : "Clique ou arraste arquivos aqui"}</strong>
          <span>Envie PDFs, Imagens (JPG/PNG). Máx: 10MB.</span>
        </button>
        <Card className="portal-doc-lists">
          <ReportList reports={reports} />
          <DocumentList title="Meus Arquivos (Enviados)" documents={meusArquivos} busyId={busyId} pending={pending} onDownload={download} />
          <DocumentList title="Documentos Recebidos (Contador)" documents={recebidos} busyId={busyId} pending={pending} onDownload={download} />
        </Card>
      </div>
    </div>
  );
}

const ASSUNTO_SEM_CATEGORIA = "Outro assunto";

export function PortalCaixaPostalView({ mailbox: initialMailbox }: { mailbox: PortalMailItem[] }) {
  const [mailbox, setMailbox] = useState(initialMailbox);
  const [modo, setModo] = useState<"inbox" | "thread" | "compose">("inbox");
  const [threadAtiva, setThreadAtiva] = useState<string | null>(null);
  const [assuntoNovo, setAssuntoNovo] = useState(ASSUNTO_SEM_CATEGORIA);
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Não existe thread_id no banco — o assunto agrupa as mensagens em
  // "conversas", igual ao cliente.html.
  const threads = Object.values(
    mailbox.reduce<Record<string, PortalMailItem[]>>((acc, item) => {
      const chave = item.assunto || ASSUNTO_SEM_CATEGORIA;
      (acc[chave] ||= []).push(item);
      return acc;
    }, {})
  )
    .map((items) => items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    .sort((a, b) => b[b.length - 1].createdAt.localeCompare(a[a.length - 1].createdAt));

  function enviar() {
    const value = texto.trim();
    if (!value) return;
    const assunto = modo === "compose" ? assuntoNovo : threadAtiva || ASSUNTO_SEM_CATEGORIA;
    startTransition(async () => {
      const result = await sendPortalMailMessage({ assunto, mensagem: value });
      if (result.ok) {
        setMailbox((items) => [...items, result.data]);
        setTexto("");
        setThreadAtiva(assunto);
        setModo("thread");
      } else {
        feedback(result.message);
      }
    });
  }

  if (modo === "thread" || modo === "compose") {
    const mensagensDaThread = modo === "thread" ? threads.find((t) => (t[0]?.assunto || ASSUNTO_SEM_CATEGORIA) === threadAtiva) || [] : [];
    return (
      <div className="view-stack">
        <PageTitle
          title={modo === "compose" ? "Nova mensagem" : threadAtiva || ASSUNTO_SEM_CATEGORIA}
          description="Fora do horário do chat ao vivo — resposta em até 1 dia útil."
          action={
            <button type="button" className="secondary compact" onClick={() => setModo("inbox")}>
              Voltar
            </button>
          }
        />
        <Card className="portal-chat-card">
          {modo === "thread" && (
            <div className="chat-messages">
              {mensagensDaThread.map((item) => (
                <div key={item.id} className={`chat-message ${item.remetente === "cliente" ? "agent" : "client"}`}>
                  <div>
                    <p>{item.mensagem}</p>
                    <small>{formatDateTime(item.createdAt)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          {modo === "compose" && (
            <div className="portal-form">
              <label>
                Assunto
                <select className="input" value={assuntoNovo} onChange={(event) => setAssuntoNovo(event.target.value)}>
                  {["Dúvida sobre pagamento", "Dúvida sobre documentos", "Reagendar atendimento", ASSUNTO_SEM_CATEGORIA].map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="composer">
            <Input value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Escreva sua mensagem…" disabled={pending} />
            <Button className="icon" disabled={pending || !texto.trim()} onClick={enviar} aria-label="Enviar mensagem">
              <Send size={16} />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <PageTitle
        title="Mensagens"
        description="Fora do horário do chat ao vivo — resposta em até 1 dia útil."
        action={
          <Button
            onClick={() => {
              setAssuntoNovo(ASSUNTO_SEM_CATEGORIA);
              setTexto("");
              setModo("compose");
            }}
          >
            Criar nova mensagem
          </Button>
        }
      />
      <Card>
        {threads.length ? (
          <div className="records-list">
            {threads.map((itens) => {
              const ultima = itens[itens.length - 1];
              const assunto = ultima.assunto || ASSUNTO_SEM_CATEGORIA;
              const naoLidas = itens.some((item) => !item.lida && item.remetente !== "cliente");
              return (
                <button
                  type="button"
                  key={assunto}
                  className="portal-thread-row"
                  onClick={() => {
                    setThreadAtiva(assunto);
                    setModo("thread");
                    if (naoLidas) {
                      setMailbox((current) => current.map((item) => (item.remetente === "contador" ? { ...item, lida: true } : item)));
                      markMailRead().then((result) => {
                        if (result.ok) router.refresh();
                      });
                    }
                  }}
                >
                  <div className="record-icon">
                    <Inbox size={16} />
                  </div>
                  <div>
                    <strong>{assunto}</strong>
                    <span>{ultima.mensagem}</span>
                    <small>{formatDateTime(ultima.createdAt)}{naoLidas ? " · não lida" : ""}</small>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState>Nenhuma mensagem ainda. Clique em &quot;Criar nova mensagem&quot; pra escrever pro contador fora do horário do chat.</EmptyState>
        )}
      </Card>
    </div>
  );
}

type HistoricoItem = {
  key: string;
  tipo: "Atendimento" | "Relatório" | "Express";
  titulo: string;
  quando: string;
  status: string;
  concluido: boolean;
  destino: string;
};

const statusAgendamento: Record<string, string> = {
  done: "Concluído",
  active: "Em atendimento",
  pending: "Agendado",
  confirmed: "Agendado",
  cancelled: "Cancelado",
};

export function PortalHistoricoView({ appointments, reports, atendimentosExpress, onNavigate }: { appointments: PortalAppointment[]; reports: PortalReport[]; atendimentosExpress: PortalAtendimentoExpress[]; onNavigate: (id: string) => void }) {
  // Mesma composição do cliente.html: atendimentos + casos Express +
  // relatórios entregues, mais recentes primeiro.
  const itens: HistoricoItem[] = [
    ...appointments.map((item) => ({
      key: `apt-${item.id}`,
      tipo: "Atendimento" as const,
      titulo: item.taxType || "Atendimento contábil",
      quando: item.date ? `${formatDate(item.date)}${item.time ? ` às ${item.time}` : ""}` : "Data não definida",
      status: statusAgendamento[item.status || ""] || "Agendado",
      concluido: item.status === "done",
      destino: "atendimento",
    })),
    ...atendimentosExpress.map((item) => ({
      key: `express-${item.id}`,
      tipo: "Express" as const,
      titulo: item.assunto || "Atendimento Express",
      quando: `Contratado em ${formatDate(item.contratadoEm.slice(0, 10))}`,
      status: STATUS_EXPRESS_LABEL[item.status] || item.status,
      concluido: item.status === "concluido",
      destino: "documentos",
    })),
    ...reports.map((item) => ({
      key: `rel-${item.id}`,
      tipo: "Relatório" as const,
      titulo: item.titulo || "Relatório de atendimento",
      quando: item.entregueEm ? formatDate(item.entregueEm.slice(0, 10)) : "Disponível",
      status: "Disponível",
      concluido: true,
      destino: "documentos",
    })),
  ];

  return (
    <div className="view-stack">
      <PageTitle title="Histórico" description="Consulte serviços anteriores realizados com o escritório." />
      <Card>
        {itens.length ? (
          <div className="records-list">
            {itens.map((item) => (
              <article key={item.key}>
                <div className="record-icon">{item.tipo === "Relatório" ? <FileText size={16} /> : item.tipo === "Express" ? <Zap size={16} /> : <CalendarClock size={16} />}</div>
                <div>
                  <span>{item.tipo.toUpperCase()}</span>
                  <strong>{item.titulo}</strong>
                  <small>{item.quando}</small>
                </div>
                <div className="table-actions">
                  <Badge className={item.concluido ? "success" : ""}>{item.status}</Badge>
                  <button type="button" className="secondary compact" onClick={() => onNavigate(item.destino)}>
                    Ver
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Nenhum atendimento no histórico ainda.</EmptyState>
        )}
      </Card>
    </div>
  );
}

type RadarSistemaParcelamento = { sistema: string; pedidos: unknown[]; parcelas: { parcela: string | number; vencimento?: string }[]; erro: string | null };
type RadarCaixaPostalMsg = { assunto: string; data: string };
type RadarResultadoLinha = { servico: string; resultado: unknown; obtido_em: string };
type RadarEstado = {
  habilitado: boolean;
  configuracao: { caixaPostalIntervaloDias: number; clientePodeEmitirDas: boolean };
  regime: string | null;
  resultados: RadarResultadoLinha[];
};

function dataCurtaRadar(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export function PortalRadarView({ clientId, caixaPostalNovas }: { clientId: string; caixaPostalNovas: boolean }) {
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState<RadarEstado | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [emitindo, setEmitindo] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const response = await fetch("/api/radar-fiscal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "estado-cliente" }) });
      const body = await response.json().catch(() => null);
      setChecked(true);
      if (!response.ok || !body) {
        setLoadError(body?.error || "Não foi possível verificar o Radar Fiscal agora. Tente novamente em instantes.");
        return;
      }
      setEstado(body);
      setLoadError("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function atualizarResultado(servico: string, resultado: unknown) {
    setEstado((atual) => {
      if (!atual) return atual;
      const resultados = atual.resultados.filter((item) => item.servico !== servico);
      resultados.push({ servico, resultado, obtido_em: new Date().toISOString() });
      return { ...atual, resultados };
    });
  }

  function consultarParcelamentos() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/radar-fiscal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "parcelamentos" }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setError(body?.error === "regime_desconhecido" ? "Fale com o escritório para configurar o seu regime tributário antes de consultar." : "Não foi possível consultar agora.");
        return;
      }
      atualizarResultado("parcelamentos", body);
    });
  }

  function emitirGuia(sistema: string, parcela: string | number) {
    const chave = `${sistema}:${parcela}`;
    setEmitindo(chave);
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/radar-fiscal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "emitir-das", sistema, parcela }) });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.pdfBase64) {
          setError("Não foi possível emitir a guia agora.");
          return;
        }
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${body.pdfBase64}`;
        link.download = `das-${parcela}.pdf`;
        link.click();
      } finally {
        setEmitindo(null);
      }
    });
  }

  function assinar() {
    startTransition(async () => {
      const response = await fetch("/api/finance/recurrence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, ativar: true, tipo: "Radar Fiscal" }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        feedback(body?.error === "asaas_not_configured" ? "Pagamento ainda não está disponível." : "Não foi possível ativar agora.");
        return;
      }
      feedback("Assinatura ativada. Atualize a página para ver os dados liberados.");
    });
  }

  if (!checked) {
    return (
      <div className="view-stack">
        <PageTitle title="Radar Fiscal" description="Parcelamentos e guias disponíveis para você, com os dados que o escritório já consultou." />
        <Card className="portal-tile">
          <EmptyState>Verificando disponibilidade…</EmptyState>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="view-stack">
        <PageTitle title="Radar Fiscal" description="Parcelamentos e guias disponíveis para você, com os dados que o escritório já consultou." />
        <Card className="portal-tile">
          <p className="login-error">{loadError}</p>
        </Card>
      </div>
    );
  }

  if (!estado?.habilitado) {
    return (
      <div className="view-stack">
        <PageTitle title="Radar Fiscal" description="Parcelamentos e guias disponíveis para você, com os dados que o escritório já consultou." />
        <Card className="portal-tile">
          <p>O Radar Fiscal ainda não está ativo para o seu cadastro.</p>
          <button type="button" className="secondary compact" disabled={pending} onClick={assinar}>
            <Lock size={14} /> Assinar Radar Fiscal
          </button>
        </Card>
      </div>
    );
  }

  const caixa = estado.resultados.find((item) => item.servico === "caixa-postal");
  const mensagens = ((caixa?.resultado as { mensagens?: RadarCaixaPostalMsg[] })?.mensagens) || [];
  const sitfis = estado.resultados.find((item) => item.servico === "sitfis");
  const parcelamentos = estado.resultados.find((item) => item.servico === "parcelamentos");
  const sistemas = (parcelamentos?.resultado as { sistemas?: RadarSistemaParcelamento[] } | undefined)?.sistemas || [];
  const podeEmitirDas = estado.configuracao.clientePodeEmitirDas !== false;

  return (
    <div className="view-stack">
      <PageTitle title="Radar Fiscal" description="Parcelamentos e guias disponíveis para você, com os dados que o escritório já consultou." />

      <Card className="portal-tile radar-status-tile">
        <Badge className="radar-badge-ok">
          <Landmark size={13} /> Radar habilitado
        </Badge>
        <span className="triagem-dica">Caixa Postal verificada a cada {estado.configuracao.caixaPostalIntervaloDias || 7} dias.</span>
      </Card>

      <Card className="portal-tile">
        <div className="card-heading">
          <div>
            <Inbox size={18} />
            <strong>Caixa Postal (e-CAC)</strong>
          </div>
        </div>
        {caixaPostalNovas ? (
          <div className="radar-alerta">
            <CircleAlert size={18} />
            <div>
              <strong>Chegou mensagem nova da Receita</strong>
              <p>Seu contador foi avisado e vai verificar o conteúdo. Se for preciso agir, entramos em contato.</p>
            </div>
          </div>
        ) : mensagens.length ? (
          <div className="records-list">
            {mensagens.map((m, index) => (
              <article key={index}>
                <div className="record-icon">
                  <Inbox size={16} />
                </div>
                <div>
                  <strong>{m.assunto}</strong>
                  <small>{dataCurtaRadar(m.data)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Nenhuma mensagem nova desde a última verificação{caixa ? ` (${dataCurtaRadar(caixa.obtido_em)})` : ""}.</EmptyState>
        )}
      </Card>

      <Card className="portal-tile">
        <div className="card-heading">
          <div>
            <FileText size={18} />
            <strong>Situação fiscal</strong>
          </div>
        </div>
        {sitfis ? (
          <p>
            Seu relatório de situação fiscal foi emitido em <strong>{dataCurtaRadar(sitfis.obtido_em)}</strong> e está em <strong>Meus Documentos</strong>.
          </p>
        ) : (
          <p>
            Nenhum relatório de situação fiscal emitido ainda. Peça ao seu contador pelas <strong>Mensagens</strong> quando precisar de um.
          </p>
        )}
      </Card>

      <Card className="portal-tile">
        <div className="card-heading">
          <div>
            <Landmark size={18} />
            <strong>Parcelamentos</strong>
          </div>
        </div>
        {parcelamentos ? (
          <>
            <p className="triagem-dica">Dados consultados em {dataCurtaRadar(parcelamentos.obtido_em)}.</p>
            {sistemas.length ? (
              sistemas.map((bloco) => (
                <div key={bloco.sistema} className="radar-sistema">
                  <div className="radar-sistema-topo">
                    <strong>{bloco.sistema}</strong>
                    <span>{bloco.pedidos.length} parcelamento(s)</span>
                  </div>
                  {bloco.parcelas.length ? (
                    bloco.parcelas.map((p, index) => {
                      const chave = `${bloco.sistema}:${p.parcela}`;
                      return (
                        <div key={index} className="radar-parcela">
                          <span>
                            Parcela {p.parcela} · vence {p.vencimento || "—"}
                          </span>
                          {podeEmitirDas && (
                            <button type="button" className="triagem-doc-btn" disabled={emitindo === chave} onClick={() => emitirGuia(bloco.sistema, p.parcela)}>
                              {emitindo === chave ? "Emitindo…" : "Emitir guia"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="triagem-dica">Nenhuma parcela disponível para emissão.</p>
                  )}
                </div>
              ))
            ) : (
              <EmptyState>Nenhum parcelamento encontrado.</EmptyState>
            )}
          </>
        ) : estado.regime ? (
          <>
            <p>Ainda não há dados salvos. A primeira consulta será guardada e reutilizada nas próximas vezes.</p>
            <button type="button" className="secondary compact" disabled={pending} onClick={consultarParcelamentos}>
              Consultar parcelamentos
            </button>
          </>
        ) : (
          <p>Peça ao seu contador para definir se a empresa é MEI ou Simples Nacional antes da primeira consulta.</p>
        )}
        {error && <p className="login-error">{error}</p>}
      </Card>
    </div>
  );
}

type FaqItem = { pergunta: string; resposta: ReactNode };
type FaqGrupo = { titulo: string; itens: FaqItem[] };

const FAQ_GRUPOS: FaqGrupo[] = [
  {
    titulo: "Conta gov.br",
    itens: [
      {
        pergunta: "O que são os níveis bronze, prata e ouro da conta gov.br?",
        resposta: (
          <>
            <p>Os níveis mostram como a sua conta foi criada ou validada. Quanto mais alto o nível, mais serviços e transações o governo libera pra você — por isso alguns serviços exigem, no mínimo, o nível prata.</p>
            <p>
              <strong>Bronze</strong> — validação inicial: cadastro online com validação na Receita Federal ou no INSS, ou atendimento presencial numa agência do INSS ou unidade do Balcão gov.br.
            </p>
            <p>
              <strong>Prata</strong> — libera documentos digitais, assinatura eletrônica e verificação em duas etapas: reconhecimento facial pelo app (base CNH), internet banking de um banco credenciado, ou SIGEPE para servidor público.
            </p>
            <p>
              <strong>Ouro</strong> — nível máximo, exigido pelos serviços mais sensíveis: reconhecimento facial (base TSE), leitura do QR Code da CIN, ou certificado digital ICP-Brasil.
            </p>
            <p className="triagem-dica">Na dúvida sobre qual nível você tem: abra o app gov.br e veja o selo no seu perfil. Para a maioria dos serviços que tratamos aqui, o nível prata já é suficiente.</p>
          </>
        ),
      },
      {
        pergunta: "Como ativar a verificação em duas etapas no gov.br?",
        resposta: (
          <>
            <p>É uma camada extra de segurança: além da senha, o acesso passa a exigir um código gerado no seu celular. A ativação acontece somente pelo aplicativo gov.br, não pelo site.</p>
            <p>Antes de começar: sua conta precisa estar no nível prata ou ouro, o app instalado, você logado nele, e a data/hora do celular sincronizadas.</p>
            <p>Passo a passo: abra o app → Segurança da conta → Verificação em duas etapas → Habilite → Confirme.</p>
            <p className="triagem-dica">Só um celular pode ficar vinculado por vez. Não desinstale o app nem troque de celular sem desativar antes — sem isso, você perde o acesso à conta.</p>
          </>
        ),
      },
      {
        pergunta: "Como desativar a verificação em duas etapas no gov.br?",
        resposta: (
          <>
            <p>Precisa trocar de celular, formatar o aparelho ou desinstalar o app? Desative antes — esse é o passo que evita ficar trancado fora da conta.</p>
            <p>Passo a passo: abra o app → Segurança da conta → Verificação em duas etapas → Desabilitar. Também dá pra desativar saindo da sessão logada, em Menu → Sair.</p>
            <p className="triagem-dica">Se você já perdeu o acesso, use a opção &quot;Não tenho mais acesso ao código&quot; na tela de login — a recuperação pode ser feita pelo e-mail cadastrado, pela CIN ou por atendimento especializado.</p>
          </>
        ),
      },
      {
        pergunta: "Minha conta gov.br está bloqueada. Como desbloquear?",
        resposta: (
          <>
            <p>Primeiro é preciso saber por que ela bloqueou — o caminho muda em cada caso.</p>
            <p>
              <strong>Bloqueio por senha incorreta (o mais comum)</strong> — espere algumas horas para o desbloqueio automático, ou recupere a senha na hora: ao criar uma nova, a conta destrava imediatamente. A recuperação pode ser feita por reconhecimento facial, banco credenciado, e-mail cadastrado, celular cadastrado, ou formulário de atendimento.
            </p>
            <p>
              <strong>Bloqueio administrativo ou judicial</strong> — não adianta esperar nem recuperar a senha; é preciso falar com a equipe de atendimento do gov.br para entender o motivo.
            </p>
            <p className="triagem-dica">Se você tentou recuperar a senha e a conta continuou bloqueada, provavelmente é o segundo caso — nos avise pelas Mensagens que te orientamos sobre o próximo passo.</p>
          </>
        ),
      },
      {
        pergunta: "Por que preciso da conta gov.br para o meu atendimento?",
        resposta: (
          <p>
            A conta gov.br é a chave de acesso aos sistemas oficiais onde a sua situação fiscal realmente mora — e-CAC da Receita Federal, portal do Simples Nacional, INSS, entre outros. É por ela que se consulta pendência, emite guia, tira certidão e acompanha a caixa postal do e-CAC. Por isso, quando o serviço contratado depende de um desses sistemas, a conta precisa estar ativa, desbloqueada e no nível exigido pelo serviço.
          </p>
        ),
      },
    ],
  },
  {
    titulo: "Usando a plataforma",
    itens: [
      {
        pergunta: "Como funciona o atendimento, do começo ao fim?",
        resposta: (
          <ol className="faq-passos">
            <li>Contratação — você escolhe o serviço e o horário do atendimento.</li>
            <li>Pré-atendimento — responde perguntas simples e fotografa ou anexa os documentos pelo celular.</li>
            <li>Atendimento — o chat abre no horário marcado.</li>
            <li>Depois — o contador registra o que foi resolvido, e o relatório e os arquivos ficam guardados em Documentos e no Histórico.</li>
          </ol>
        ),
      },
      {
        pergunta: "Preciso preencher o pré-atendimento? O que acontece se eu não preencher?",
        resposta: (
          <>
            <p>Preencher é o que permite entender e começar o caso. Sem as suas respostas, não sabemos qual caminho seguir.</p>
            <p>Você encontra o formulário em Pré-atendimento. O rascunho é salvo automaticamente e você pode revisar depois.</p>
          </>
        ),
      },
      {
        pergunta: "Quais são as formas de pagamento?",
        resposta: (
          <>
            <ul>
              <li>Pix</li>
              <li>Cartão de crédito — à vista ou parcelado</li>
            </ul>
            <p>A escolha é feita na hora de agendar, antes da confirmação do pagamento.</p>
          </>
        ),
      },
      {
        pergunta: 'Qual a diferença entre "Atendimento" e "Caixa Postal"?',
        resposta: (
          <>
            <p>Atendimento é a conversa ao vivo, que abre no horário que você agendou — é ali que o caso é tratado.</p>
            <p>Caixa Postal é a sua caixa de mensagens com o escritório: recados, avisos e assuntos que não dependem de um horário marcado. Funciona como um e-mail, organizado por assunto.</p>
          </>
        ),
      },
      {
        pergunta: "Onde encontro o relatório e os documentos do meu atendimento?",
        resposta: (
          <>
            <p>Tudo fica em Documentos, separado em três blocos: os relatórios de atendimento gerados pelo contador, os arquivos que você enviou e os documentos que o contador enviou pra você (guias, certidões e afins).</p>
            <p>Já o Histórico lista os atendimentos anteriores, para consultar o que foi tratado em cada um.</p>
          </>
        ),
      },
      {
        pergunta: "O que é o Radar Fiscal?",
        resposta: (
          <>
            <p>É um serviço de monitoramento contínuo do seu CPF ou CNPJ. Ele acompanha a caixa postal do e-CAC e os parcelamentos, avisando quando aparece uma pendência.</p>
            <p>A ideia é você descobrir o problema enquanto ele ainda é pequeno, em vez de na hora em que o CPF trava num banco ou a empresa não consegue emitir nota.</p>
          </>
        ),
      },
      {
        pergunta: "Minha dúvida não está aqui. Com quem eu falo?",
        resposta: <p>Abra uma conversa em Caixa Postal e escreva sua dúvida — o escritório responde por lá. Se for algo que precisa de análise do seu caso, o próprio contador vai orientar se cabe agendar um atendimento.</p>,
      },
    ],
  },
];

function normalizarBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function PortalFaqView() {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca.trim());

  function bate(texto: string) {
    return normalizarBusca(texto).includes(termo);
  }

  const grupos = FAQ_GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => !termo || bate(item.pergunta)),
  })).filter((grupo) => grupo.itens.length > 0);

  return (
    <div className="view-stack">
      <PageTitle title="Ajuda e Dúvidas Frequentes" description="As dúvidas mais comuns sobre a conta gov.br e sobre como usar a plataforma." />
      <div className="faq-busca">
        <Search size={16} />
        <input type="search" placeholder="Buscar uma dúvida (ex: duas etapas, bloqueada, nível prata)" value={busca} onChange={(event) => setBusca(event.target.value)} aria-label="Buscar nas dúvidas frequentes" />
      </div>
      {grupos.length === 0 && (
        <Card className="portal-tile">
          <p>
            Nenhuma dúvida encontrada com esse termo. Tente outra palavra ou fale com seu contador pelas <strong>Mensagens</strong>.
          </p>
        </Card>
      )}
      {grupos.map((grupo) => (
        <Card key={grupo.titulo} className="portal-tile faq-grupo">
          <h3>{grupo.titulo}</h3>
          {grupo.itens.map((item) => (
            <details key={item.pergunta} className="faq-item" open={!!termo}>
              <summary>{item.pergunta}</summary>
              <div className="faq-resposta">{item.resposta}</div>
            </details>
          ))}
        </Card>
      ))}
      <p className="triagem-dica">As orientações sobre a conta gov.br seguem o que está publicado no portal oficial do Governo Digital. Procedimentos do governo mudam de tempos em tempos.</p>
    </div>
  );
}
