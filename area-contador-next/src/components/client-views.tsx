"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CalendarCheck, CalendarClock, CalendarPlus, Camera, Check, CheckCheck,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Copy, CreditCard, Download, Eye, EyeOff, FileCheck2, FileDown, FilePlus2,
  FileText, HelpCircle, Inbox, KeyRound, Landmark, ListChecks, Lock, Mail, MapPin, MessageCircle, Mic, Phone, Play, QrCode, Search, Send, ShieldAlert, ShieldCheck, Sparkles, Square, Star, Trash2, Upload, UserRound, Volume2, X, Zap,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui/primitives";
import { PageTitle } from "@/components/views";
import type { PortalAppointment, PortalAtendimentoExpress, PortalAvaliacao, PortalContador, PortalData, PortalDocument, PortalMailItem, PortalMessage, PortalObrigacao, PortalOcupado, PortalReport, PortalServico, PortalTriagem } from "@/lib/portal";
import { attachTriagemAudio, getDocumentDownloadUrl, markMailRead, markPortalMessagesRead, saveTriagem, sendPortalAudioMessage, sendPortalMailMessage, sendPortalMessage, submitAvaliacao } from "@/app/portal/actions";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { acharAssunto, completude, type TriagemAssunto, type TriagemPergunta, type TriagemRegras } from "@/lib/triagemCatalogo";
import { baixarRelatorioPdf } from "@/lib/reportPdf";

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

  const notaLegendas = ["", "Muito insatisfeito", "Insatisfeito", "Atendimento bom", "Muito bom!", "Excelente! ⭐"];

  if (notaFinal) {
    return (
      <Card className="portal-avaliacao-card avaliada">
        <div className="portal-avaliacao-success">
          <div className="portal-avaliacao-star-badge">
            <Star size={20} fill="#f59e0b" color="#f59e0b" />
          </div>
          <div>
            <strong>Avaliação enviada com sucesso</strong>
            <p>Você atribuiu nota <strong>{notaFinal} de 5</strong> ao atendimento. Agradecemos pelo seu feedback!</p>
          </div>
        </div>
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

  const activeRating = hover || nota;

  return (
    <Card className="portal-avaliacao-card">
      <div className="portal-avaliacao-header">
        <div className="portal-avaliacao-icon">
          <Star size={18} />
        </div>
        <div>
          <h3 className="portal-avaliacao-title">Como foi sua experiência no atendimento?</h3>
          <p className="portal-avaliacao-desc">Sua opinião é fundamental para aprimorarmos nossos serviços.</p>
        </div>
      </div>
      <div className="portal-avaliacao-body">
        <div className="avaliacao-estrelas-wrap">
          <div className="avaliacao-estrelas">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`star-btn ${activeRating >= n ? "active" : ""}`}
                aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setNota(n)}
              >
                <Star size={28} fill={activeRating >= n ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          {activeRating > 0 && (
            <span className="avaliacao-legenda">{notaLegendas[activeRating]}</span>
          )}
        </div>
        <textarea
          className="portal-avaliacao-textarea"
          placeholder="Deixe um comentário ou sugestão sobre o atendimento (opcional)…"
          rows={2}
          value={comentario}
          onChange={(event) => setComentario(event.target.value)}
        />
        <div className="portal-avaliacao-actions">
          <Button disabled={!nota || pending} onClick={enviar}>
            <Star size={15} />
            <span>{pending ? "Enviando…" : "Confirmar avaliação"}</span>
          </Button>
        </div>
      </div>
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
type ProximaAcaoTom = "coral" | "green" | "pine" | "purple";
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
  if (semAgendamento && atendimentoExpress?.status === "aguardando_documentos") {
    return { Icon: Zap, title: "Precisamos de mais um documento", text: "Abra seu caso para ver exatamente o que falta e continuar a análise express.", buttonLabel: "Ver o que falta", target: "triagem", tone: "purple" };
  }
  if (!triagemEnviada) {
    return {
      Icon: semAgendamento ? Zap : ClipboardList,
      title: semAgendamento ? "Envie os dados do seu Atendimento Express" : "Conte o que aconteceu",
      text: semAgendamento ? "Preencha as informações e anexe os comprovantes para o contador iniciar a execução." : "Responda perguntas simples, do seu jeito. O rascunho fica salvo automaticamente.",
      buttonLabel: semAgendamento ? "Preencher formulário" : "Começar triagem",
      target: "triagem",
      tone: semAgendamento ? "purple" : "coral",
    };
  }
  if (!qtdDocs) {
    return {
      Icon: semAgendamento ? Zap : Camera,
      title: "Envie os documentos que você já tiver",
      text: semAgendamento ? "Você pode fotografar pelo celular. Se não tiver algum agora, avisaremos caso ele seja necessário." : "Eles ajudam o contador a analisar o caso antes da conversa.",
      buttonLabel: "Tirar foto ou anexar",
      target: "triagem",
      tone: semAgendamento ? "purple" : "pine",
    };
  }
  if (semAgendamento) {
    return {
      Icon: Zap,
      title: "Atendimento Express em andamento",
      text: "Seu caso está em execução com a equipe contábil." + (atendimentoExpress?.prazoConclusaoEm ? ` Previsão de conclusão: ${formatDate(atendimentoExpress.prazoConclusaoEm.slice(0, 10))}.` : " Avisaremos quando houver uma atualização."),
      buttonLabel: "Acompanhar meu caso",
      target: "triagem",
      tone: "purple",
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
    <div className={`portal-spotlight-card tone-${acao.tone}`}>
      <div className="portal-spotlight-left">
        <div className={`portal-spotlight-icon-wrap tone-${acao.tone}`}>
          <Icon size={24} />
        </div>
        <div className="portal-spotlight-content">
          <div className="portal-spotlight-tag">
            <span>Ação Recomendada</span>
          </div>
          <h2 className="portal-spotlight-title">{acao.title}</h2>
          <p className="portal-spotlight-desc">{acao.text}</p>
        </div>
      </div>
      <button 
        type="button" 
        className={`portal-spotlight-btn tone-${acao.tone}`} 
        onClick={() => onNavigate(acao.target)}
      >
        <span>{acao.buttonLabel}</span>
        <ArrowRight size={16} />
      </button>
    </div>
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
  const semAgendamento = data.client.atendimentoModalidade === "sem_agendamento";
  const feitos = passos.filter((p) => p.feito).length;
  const pct = Math.round((feitos / passos.length) * 100);

  return (
    <Card className={`portal-timeline-box ${semAgendamento ? "is-express" : ""}`}>
      <div className="portal-timeline-header">
        <div className="portal-timeline-header-left">
          <h3 className="portal-timeline-title">Linha do tempo do seu caso</h3>
          <span className="portal-timeline-subtitle">Acompanhe cada fase do diagnóstico contábil</span>
        </div>
        <div className="portal-timeline-progress-badge">
          <span>{feitos} de {passos.length} etapas concluídas ({pct}%)</span>
          <div className="portal-timeline-bar-track">
            <div className="portal-timeline-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="portal-timeline-steps">
        {passos.map((p, i) => {
          const isDone = p.feito;
          const isCurrent = i === ativoIndex;
          return (
            <div key={p.titulo} className={`portal-timeline-step ${isDone ? "is-done" : isCurrent ? "is-current" : "is-pending"}`}>
              <div className="portal-timeline-node">
                <div className="portal-timeline-icon">
                  {isDone ? <Check size={13} strokeWidth={3} /> : <span>{i + 1}</span>}
                </div>
                {i < passos.length - 1 && <div className="portal-timeline-line" />}
              </div>
              <div className="portal-timeline-info">
                <strong className="portal-timeline-step-title">{p.titulo}</strong>
                <p className="portal-timeline-step-desc">{p.descricao}</p>
              </div>
            </div>
          );
        })}
      </div>
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
  const primeiroNome = data.client.name.split(" ")[0] || "Cliente";

  return (
    <div className="view-stack portal-dashboard-stack">
      {/* CABEÇALHO DO CLIENTE */}
      <div className="portal-hero-header">
        <div className="portal-hero-info">
          <h1 className="portal-hero-title">
            Olá, {primeiroNome}! 👋
          </h1>
          <p className="portal-hero-desc">
            Acompanhe em tempo real o status do seu caso, mensagens e relatórios oficiais.
          </p>
        </div>
        <div className="portal-hero-status-pill">
          <span className="portal-hero-status-dot" />
          <span>Área do Cliente</span>
        </div>
      </div>

      {/* CARD DE DESTAQUE: PRÓXIMA AÇÃO */}
      <PortalProximaAcaoCard data={data} onNavigate={onNavigate} />

      {/* CARD DE CRIAR SENHA (DISPENSÁVEL) */}
      <PortalCriarSenhaCard clientId={data.client.id} />

      {/* GRID DE CARDS PRINCIPAIS (4 COLUNAS / 2x2 NO TABLET/MOBILE) */}
      <section className="portal-dashboard-section">
        <div className="portal-tiles-grid">
          {/* TILE 1: PRÓXIMO ATENDIMENTO OU EXPRESS */}
          <button 
            type="button" 
            className={`portal-action-tile tile-agenda ${expressAtivo && !proximo ? "is-express" : ""}`}
            onClick={() => onNavigate(expressAtivo && !proximo ? "triagem" : proximo ? "agendamento" : "agendamento")}
          >
            <div className="portal-tile-top">
              <div className={`portal-tile-icon-box ${expressAtivo && !proximo ? "express" : "agenda"}`}>
                {expressAtivo && !proximo ? <Zap size={20} /> : <CalendarClock size={20} />}
              </div>
              <span className={`portal-tile-tag ${expressAtivo && !proximo ? "express" : ""}`}>
                {expressAtivo && !proximo ? "Express" : "Reunião"}
              </span>
            </div>
            <div className="portal-tile-body">
              <h3 className="portal-tile-title">
                {expressAtivo && !proximo ? "Atendimento Express" : "Próximo Atendimento"}
              </h3>
              {proximo ? (
                <div className="portal-tile-snippet">
                  <strong>{formatDate(proximo.date)} às {proximo.time}</strong>
                  <span>{proximo.taxType || "Atendimento agendado"}</span>
                </div>
              ) : expressAtivo ? (
                <div className="portal-tile-snippet">
                  <strong className="text-express">{STATUS_EXPRESS_LABEL[expressAtivo.status] || expressAtivo.status}</strong>
                  <span>{expressAtivo.assunto || "Em andamento"} · previsão {formatDate(expressAtivo.prazoConclusaoEm.slice(0, 10))}</span>
                </div>
              ) : (
                <div className="portal-tile-snippet empty">
                  <span>Nenhum horário marcado</span>
                </div>
              )}
            </div>
            <div className="portal-tile-footer">
              <span className="portal-tile-action-label">
                {expressAtivo && !proximo ? "Acompanhar caso" : proximo ? "Ver agendamento" : "Agendar consultoria"}
              </span>
              <ChevronRight size={16} className="portal-tile-arrow" />
            </div>
          </button>

          {/* TILE 2: PRÉ-ATENDIMENTO / TRIAGEM */}
          <button 
            type="button" 
            className="portal-action-tile tile-triagem" 
            onClick={() => onNavigate("triagem")}
          >
            <div className="portal-tile-top">
              <div className="portal-tile-icon-box triagem">
                <ClipboardList size={20} />
              </div>
              {triagemPendente ? (
                <span className="portal-tile-badge pending">Pendente</span>
              ) : (
                <span className="portal-tile-badge ok">Enviado</span>
              )}
            </div>
            <div className="portal-tile-body">
              <h3 className="portal-tile-title">Pré-atendimento</h3>
              {triagemPendente ? (
                <div className="portal-tile-snippet">
                  <strong>{triagemPendente.assunto ? nomeDoAssunto(data.triagemCatalogo, triagemPendente.assunto) : "Conte o que aconteceu"}</strong>
                  <span>Responda as perguntas rápidas</span>
                </div>
              ) : (
                <div className="portal-tile-snippet">
                  <strong>Informações enviadas</strong>
                  <span>Contador analisando seu caso</span>
                </div>
              )}
            </div>
            <div className="portal-tile-footer">
              <span className="portal-tile-action-label">
                {triagemPendente ? "Completar diagnóstico" : "Ver respostas"}
              </span>
              <ChevronRight size={16} className="portal-tile-arrow" />
            </div>
          </button>

          {/* TILE 3: MENSAGENS / ATENDIMENTO */}
          <button 
            type="button" 
            className="portal-action-tile tile-chat" 
            onClick={() => onNavigate("atendimento")}
          >
            <div className="portal-tile-top">
              <div className="portal-tile-icon-box chat">
                <MessageCircle size={20} />
              </div>
              {data.unreadMessages > 0 ? (
                <Badge className="portal-tile-counter">{data.unreadMessages} nova{data.unreadMessages > 1 ? "s" : ""}</Badge>
              ) : (
                <span className="portal-tile-tag">Canal Direto</span>
              )}
            </div>
            <div className="portal-tile-body">
              <h3 className="portal-tile-title">Mensagens & Chat</h3>
              {ultimaMensagem ? (
                <div className="portal-tile-snippet">
                  <p className="portal-tile-msg-preview">
                    {ultimaMensagem.text || (ultimaMensagem.type === "audio" ? "🎙️ Mensagem de áudio" : "📎 Anexo enviado")}
                  </p>
                  <span>{ultimaMensagem.createdAt ? formatDateTime(ultimaMensagem.createdAt) : ultimaMensagem.time || ""}</span>
                </div>
              ) : (
                <div className="portal-tile-snippet empty">
                  <span>Inicie uma conversa com seu contador</span>
                </div>
              )}
            </div>
            <div className="portal-tile-footer">
              <span className="portal-tile-action-label">Abrir atendimento</span>
              <ChevronRight size={16} className="portal-tile-arrow" />
            </div>
          </button>

          {/* TILE 4: CAIXA POSTAL & DOCUMENTOS */}
          <button 
            type="button" 
            className="portal-action-tile tile-docs" 
            onClick={() => onNavigate(data.unreadMail > 0 ? "caixa-postal" : "documentos")}
          >
            <div className="portal-tile-top">
              <div className="portal-tile-icon-box docs">
                <Inbox size={20} />
              </div>
              {data.unreadMail > 0 ? (
                <Badge className="portal-tile-counter">{data.unreadMail} não lida{data.unreadMail > 1 ? "s" : ""}</Badge>
              ) : (
                <span className="portal-tile-tag">{data.documents.length} doc{data.documents.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <div className="portal-tile-body">
              <h3 className="portal-tile-title">Documentos & Avisos</h3>
              <div className="portal-tile-snippet">
                <strong>{data.reports.length} relatório(s) oficial(is)</strong>
                <span>{data.mailbox.length} comunicado(s) na Caixa Postal</span>
              </div>
            </div>
            <div className="portal-tile-footer">
              <span className="portal-tile-action-label">Acessar documentos</span>
              <ChevronRight size={16} className="portal-tile-arrow" />
            </div>
          </button>
        </div>
      </section>

      {/* LINHA DO TEMPO DO ATENDIMENTO */}
      <PortalTimelineCard data={data} />

      {/* AGENDA FISCAL (SE HOUVER OBRIGAÇÕES) */}
      <PortalAgendaFiscalCard obrigacoes={data.agendaFiscal} />

      {/* AVALIAÇÃO DO ATENDIMENTO */}
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
// (clientes.status === 'locked' OU atendimento Express em aberto, sem
// agendamento pendente) e "finalizado" (clientes.status === 'done'). Só o
// "finalizado" desabilita o campo — nos outros dois a mensagem digitada é
// redirecionada pra Caixa Postal. Express fica preso a "parcial" porque, uma
// vez contratado, o atendimento passa a rodar por fora do chat em tempo
// real — o cliente só acompanha e manda recado pela Caixa Postal.
type ChatLockMode = "none" | "total" | "parcial" | "finalizado";
type ChatLockAppointment = { date: string | null; time: string | null; status: string | null };

function computeChatLock(status: string | null, appointments: ChatLockAppointment[], expressAtivo: boolean): { mode: ChatLockMode; proximo: ChatLockAppointment | null } {
  if (status === "done") return { mode: "finalizado", proximo: null };
  const now = Date.now();
  const proximo =
    appointments
      .filter((a) => a.status !== "done" && a.status !== "cancelled" && a.date && a.time)
      .map((a) => ({ a, when: new Date(`${a.date}T${a.time}:00`).getTime() }))
      .filter(({ when }) => when > now)
      .sort((x, y) => x.when - y.when)[0]?.a ?? null;
  if (proximo) return { mode: "total", proximo };
  if (status === "locked" || expressAtivo) return { mode: "parcial", proximo: null };
  return { mode: "none", proximo: null };
}

function useChatLock(clientId: string, initialStatus: string | null, initialAppointments: PortalAppointment[], initialExpressAtivo: boolean) {
  const [status, setStatus] = useState(initialStatus);
  const [appointments, setAppointments] = useState<ChatLockAppointment[]>(initialAppointments);
  const [expressAtivo, setExpressAtivo] = useState(initialExpressAtivo);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;

    async function refetch() {
      if (!supabase) return;
      const [clientResult, appointmentsResult, expressResult] = await Promise.all([
        supabase.from("clientes").select("status").eq("id", clientId).maybeSingle(),
        supabase.from("agendamentos").select("date,time,status").eq("cliente_ref", clientId),
        supabase.from("atendimentos_express").select("status").eq("cliente_ref", clientId).not("status", "in", "(concluido,cancelado)"),
      ]);
      if (clientResult.data) setStatus(clientResult.data.status);
      if (appointmentsResult.data) setAppointments(appointmentsResult.data);
      if (expressResult.data) setExpressAtivo(expressResult.data.length > 0);
    }

    const channel = supabase
      .channel(`oc-status-${clientId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clientes", filter: `id=eq.${clientId}` }, (payload) => {
        setStatus((payload.new as { status: string | null }).status);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos_express", filter: `cliente_ref=eq.${clientId}` }, () => {
        void refetch();
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

  return computeChatLock(status, appointments, expressAtivo);
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
          const row = payload.new as { id: string; sender: string; text: string | null; type: string | null; doc_name: string | null; duration: string | null; transcricao: string | null; time: string | null; created_at: string | null; read_at: string | null; seq: number };
          setMessages((items) =>
            items.some((item) => item.id === row.id)
              ? items
              : [...items, { id: row.id, sender: row.sender, text: row.text, type: row.type, docName: row.doc_name, duration: row.duration, transcricao: row.transcricao, time: row.time, createdAt: row.created_at, readAt: row.read_at, seq: row.seq }],
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
  atendimentosExpress = [],
  triagem,
  reports,
  catalogo,
  documents: initialDocuments,
  onNavigate,
}: {
  messages: PortalMessage[];
  contador: PortalContador;
  clientId: string;
  clientStatus: string | null;
  appointments: PortalAppointment[];
  atendimentosExpress?: PortalAtendimentoExpress[];
  triagem: PortalTriagem | null;
  reports: PortalReport[];
  catalogo: TriagemAssunto[];
  documents: PortalDocument[];
  onNavigate?: (id: string) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [documents, setDocuments] = useState(initialDocuments);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presence = useContadorPresence(clientId);
  const expressAtivoInicial = atendimentosExpress.some((item) => item.status !== "concluido" && item.status !== "cancelado");
  const lock = useChatLock(clientId, clientStatus, appointments, expressAtivoInicial);
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

  const [falando, setFalando] = useState<string | null>(null);
  // Acessibilidade: ouvir a resposta do contador em voz alta, pra quem tem
  // dificuldade de leitura. Só o navegador — sem custo, sem servidor.
  function ouvirMensagem(id: string, texto: string) {
    if (!("speechSynthesis" in window)) return feedback("Seu navegador não suporta leitura em voz alta.");
    if (falando === id) {
      window.speechSynthesis.cancel();
      setFalando(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.onend = () => setFalando(null);
    utterance.onerror = () => setFalando(null);
    setFalando(id);
    window.speechSynthesis.speak(utterance);
  }

  async function startRecording() {
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
    startTransition(async () => {
      const supabase = createBrowserClient();
      if (!supabase) return feedback("Conexão indisponível.");
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fileName = `audio-${Date.now()}.${ext}`;
      const path = `${clientId}/${fileName}`;
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
      if (storageError) return feedback("Não foi possível enviar o áudio agora.");
      const { data: document, error: documentError } = await supabase
        .from("documentos")
        .insert({ cliente_ref: clientId, file_name: fileName, mime: blob.type || "audio/webm", size_bytes: blob.size, storage_path: path, uploaded_by: "client" })
        .select("id,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,storage_path")
        .single();
      if (documentError || !document) return feedback("Não foi possível salvar o áudio.");
      setDocuments((items) => [
        ...items,
        {
          id: document.id,
          fileName: document.file_name,
          mime: document.mime,
          sizeBytes: document.size_bytes,
          uploadedBy: document.uploaded_by,
          createdAt: document.created_at,
          checklistItem: document.checklist_item,
          storagePath: document.storage_path,
        },
      ]);
      const duracao = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;
      const result = await sendPortalAudioMessage({ fileName, duration: duracao });
      if (result.ok) setMessages((items) => (items.some((item) => item.id === result.data.id) ? items : [...items, result.data]));
      else feedback(result.message);
    });
  }

  const lockPlaceholder =
    lock.mode === "finalizado"
      ? "Atendimento encerrado."
      : lock.mode === "total" || lock.mode === "parcial"
        ? "Chat bloqueado — sua mensagem vai para a Caixa Postal…"
        : "Escreva sua mensagem…";

  return (
    <div className="view-stack portal-chat-view-stack">
      <Card className="portal-chat-card">
        <div className="chat-header">
          {onNavigate && (
            <button
              type="button"
              className="chat-back-mobile-btn"
              onClick={() => onNavigate("dashboard")}
              aria-label="Voltar para a área inicial"
              title="Voltar ao início"
            >
              <ChevronLeft size={20} />
            </button>
          )}
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
        </div>

        {/* Faixa do atendimento: discreta, 1 linha, abaixo do cabeçalho */}
        <div className="chat-assunto-faixa">
          <div className="chat-assunto-info">
            <span className="chat-assunto-tag">Caso:</span>
            <strong className="chat-assunto-nome" title={nomeCaso}>{nomeCaso}</strong>
          </div>
          <span className="chat-assunto-sep">·</span>
          <span className="chat-assunto-protocolo">Protocolo: #OC-{protocolo}</span>
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
                  {item.text && (
                    <p>
                      {item.text}
                      {item.sender !== "client" && item.type !== "audio" && (
                        <button
                          type="button"
                          className="chat-ouvir-btn"
                          onClick={() => ouvirMensagem(item.id, item.text || "")}
                          aria-label={falando === item.id ? "Parar leitura" : "Ouvir esta mensagem"}
                          title={falando === item.id ? "Parar leitura" : "Ouvir esta mensagem"}
                        >
                          {falando === item.id ? <Square size={11} /> : <Volume2 size={13} />}
                        </button>
                      )}
                    </p>
                  )}
                  {item.docName && item.type !== "audio" && (
                    <div className="chat-doc-attachment">
                      <FileText size={15} />
                      <span>{item.docName}</span>
                    </div>
                  )}
                  {item.type === "audio" &&
                    (() => {
                      const documento = documents.find((d) => d.fileName === item.docName);
                      return documento ? <ChatAudioPlayer documentId={documento.id} duration={item.duration} /> : null;
                    })()}
                  {item.type === "audio" && item.transcricao && (
                    <p className="chat-audio-transcricao">&ldquo;{item.transcricao}&rdquo;</p>
                  )}
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
            {lock.mode === "none" &&
              (recording ? (
                <button type="button" className="chat-recording-button" disabled={pending} onClick={stopRecording} title="Parar gravação e enviar" aria-label="Parar gravação e enviar áudio">
                  <span className="chat-recording-rings" aria-hidden="true">
                    <span className="chat-recording-ring" />
                    <span className="chat-recording-ring" />
                  </span>
                  <Square size={14} />
                  <span className="chat-recording-time">{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</span>
                </button>
              ) : (
                <button type="button" className="composer-attach-btn" disabled={pending || !!text.trim()} onClick={() => void startRecording()} title="Gravar uma mensagem de áudio pelo microfone" aria-label="Gravar mensagem de áudio">
                  <Mic size={18} />
                </button>
              ))}
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
  const [showSenha, setShowSenha] = useState(false);
  const [ttl, setTtl] = useState(48);
  const [autoriza, setAutoriza] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState("");

  async function chamar(action: string, extra?: Record<string, unknown>) {
    const response = await fetch("/api/clients/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, clientId, ...extra }),
    });
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
    if (senha.length < 6) {
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
        feedback("Senha protegida com sucesso no cofre.");
      } catch {
        setErro("Não foi possível proteger a senha agora. Tente novamente.");
      }
    });
  }

  function apagar() {
    if (!window.confirm("Revogar o acesso e apagar agora a senha protegida do cofre?")) return;
    startTransition(async () => {
      try {
        setStatus(await chamar("delete"));
        feedback("Senha do cofre revogada e apagada.");
      } catch {
        setErro("Não foi possível apagar agora. Tente novamente.");
      }
    });
  }

  const pendente = status?.status === "pending";

  return (
    <Card className="portal-perfil-card cofre">
      <div className="portal-perfil-card-header">
        <div className="portal-perfil-card-title-wrap">
          <div className="portal-perfil-icon cofre">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="portal-perfil-card-title">Cofre gov.br Seguro</h3>
            <p className="portal-perfil-card-desc">
              Envio criptografado e temporário de credenciais para procedimentos fiscais
            </p>
          </div>
        </div>
        {status && (
          <span className={`portal-cofre-status-badge ${status.status}`}>
            {status.status === "pending" && <ShieldCheck size={13} />}
            {status.status === "empty" && <ShieldAlert size={13} />}
            <span>{VAULT_STATUS_LABEL[status.status] || "Nenhuma senha no cofre"}</span>
          </span>
        )}
      </div>

      <div className="portal-cofre-notice">
        <p>
          🔒 <strong>Segurança Nível Bancário:</strong> A senha fica criptografada e só pode ser visualizada uma única vez pelo contador responsável. Assim que consultada (ou atingido o prazo), ela é <strong>apagada para sempre</strong>.
        </p>
      </div>

      {pendente && status?.expiresAt && (
        <div className="portal-cofre-expiration-alert">
          <span>⏳ Senha ativa no cofre até <strong>{new Date(status.expiresAt).toLocaleString("pt-BR")}</strong>.</span>
        </div>
      )}

      <div className="portal-cofre-form">
        <div className="triagem-field-group">
          <div className="triagem-field-header">
            <span className="triagem-field-label">Senha do gov.br</span>
          </div>
          <div className="portal-password-input-wrap">
            <Input
              type={showSenha ? "text" : "password"}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Digite a senha temporária"
              disabled={pending}
            />
            <button
              type="button"
              className="portal-password-toggle-btn"
              onClick={() => setShowSenha(!showSenha)}
              title={showSenha ? "Ocultar senha" : "Ver senha"}
            >
              {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="triagem-field-group">
          <div className="triagem-field-header">
            <span className="triagem-field-label">Tempo de validade no cofre</span>
          </div>
          <select
            className="input portal-select"
            value={ttl}
            onChange={(event) => setTtl(Number(event.target.value))}
            disabled={pending}
          >
            <option value={24}>24 horas (recomendado)</option>
            <option value={48}>48 horas</option>
            <option value={72}>72 horas</option>
          </select>
        </div>

        <label className="portal-cofre-checkbox-row">
          <input
            type="checkbox"
            checked={autoriza}
            onChange={(event) => setAutoriza(event.target.checked)}
            disabled={pending}
          />
          <span>Autorizo o uso temporário desta senha pelo contador exclusivamente para o atendimento solicitado.</span>
        </label>

        {erro && <p className="login-error">{erro}</p>}

        <div className="portal-cofre-actions">
          <Button
            className="portal-agenda-confirm-btn"
            disabled={pending || !senha}
            onClick={enviar}
          >
            <ShieldCheck size={16} />
            <span>{pendente ? "Substituir Senha no Cofre" : "Guardar no Cofre Seguro"}</span>
          </Button>
          {pendente && (
            <Button
              className="secondary compact portal-cofre-delete-btn"
              disabled={pending}
              onClick={apagar}
            >
              <Trash2 size={14} />
              <span>Revogar e Apagar Agora</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PortalPerfilView({ client }: { client: PortalData["client"] }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);
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
      setMensagem("Senha alterada com sucesso! Você já pode usá-la no seu próximo login.");
      setErro(false);
    });
  }

  const endereco =
    [
      client.endereco && `${client.endereco}${client.numero ? `, ${client.numero}` : ""}`,
      client.bairro,
      [client.cidade, client.estado].filter(Boolean).join(" - ") || null,
      client.cep && `CEP: ${client.cep}`,
    ]
      .filter(Boolean)
      .join(" • ") || "Endereço não informado";

  const cpfFmt = client.cpf
    ? (() => {
        const clean = client.cpf!.replace(/\D/g, "");
        return clean.length === 11
          ? `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`
          : client.cpf;
      })()
    : "Não informado";

  const initials = (client.name || "C")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="view-stack">
      <PageTitle
        title="Meu Perfil & Segurança"
        description="Gerencie seus dados cadastrais, segurança da conta e cofre seguro de credenciais gov.br."
      />

      {/* HERO DO PERFIL */}
      <Card className="portal-perfil-hero-card">
        <div className="portal-perfil-hero-avatar">
          <span>{initials}</span>
        </div>
        <div className="portal-perfil-hero-info">
          <div className="portal-perfil-hero-top">
            <h2 className="portal-perfil-hero-name">{client.name}</h2>
            <span className="portal-perfil-verified-pill">
              <BadgeCheck size={14} />
              <span>Conta Verificada</span>
            </span>
          </div>
          <div className="portal-perfil-hero-meta">
            <span>CPF/CNPJ: <strong>{cpfFmt}</strong></span>
            {client.taxType && <span>· Serviço: <strong>{client.taxType}</strong></span>}
          </div>
        </div>
      </Card>

      {/* GRID DE INFORMAÇÕES: DADOS CADASTRAIS & SEGURANÇA */}
      <div className="portal-perfil-grid">
        {/* CARD DE DADOS CADASTRAIS */}
        <Card className="portal-perfil-card">
          <div className="portal-perfil-card-header">
            <div className="portal-perfil-card-title-wrap">
              <div className="portal-perfil-icon">
                <UserRound size={20} />
              </div>
              <div>
                <h3 className="portal-perfil-card-title">Dados Cadastrais</h3>
                <p className="portal-perfil-card-desc">Informações do titular para registros fiscais</p>
              </div>
            </div>
          </div>

          <div className="portal-perfil-info-tiles">
            <div className="portal-perfil-info-tile">
              <div className="portal-perfil-tile-icon">
                <UserRound size={15} />
              </div>
              <div className="portal-perfil-tile-body">
                <span className="portal-perfil-tile-label">Nome Completo</span>
                <strong className="portal-perfil-tile-value">{client.name}</strong>
              </div>
            </div>

            <div className="portal-perfil-info-tile">
              <div className="portal-perfil-tile-icon">
                <ShieldCheck size={15} />
              </div>
              <div className="portal-perfil-tile-body">
                <span className="portal-perfil-tile-label">Documento Principal</span>
                <strong className="portal-perfil-tile-value">{cpfFmt}</strong>
              </div>
            </div>

            <div className="portal-perfil-info-tile">
              <div className="portal-perfil-tile-icon">
                <Phone size={15} />
              </div>
              <div className="portal-perfil-tile-body">
                <span className="portal-perfil-tile-label">Telefone / WhatsApp</span>
                <strong className="portal-perfil-tile-value">{client.phone || "Não informado"}</strong>
              </div>
            </div>

            <div className="portal-perfil-info-tile">
              <div className="portal-perfil-tile-icon">
                <Mail size={15} />
              </div>
              <div className="portal-perfil-tile-body">
                <span className="portal-perfil-tile-label">E-mail de Contato</span>
                <strong className="portal-perfil-tile-value">{client.email || "Não informado"}</strong>
              </div>
            </div>

            <div className="portal-perfil-info-tile full">
              <div className="portal-perfil-tile-icon">
                <MapPin size={15} />
              </div>
              <div className="portal-perfil-tile-body">
                <span className="portal-perfil-tile-label">Endereço Cadastrado</span>
                <strong className="portal-perfil-tile-value">{endereco}</strong>
              </div>
            </div>
          </div>

          <div className="portal-perfil-card-footer">
            <p>Precisa alterar algum dado cadastral? Solicite a alteração diretamente pelo Chat.</p>
          </div>
        </Card>

        {/* CARD DE SEGURANÇA E SENHA */}
        <Card className="portal-perfil-card">
          <div className="portal-perfil-card-header">
            <div className="portal-perfil-card-title-wrap">
              <div className="portal-perfil-icon">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="portal-perfil-card-title">Segurança de Acesso</h3>
                <p className="portal-perfil-card-desc">Altere sua senha de login na Área do Cliente</p>
              </div>
            </div>
          </div>

          <div className="portal-perfil-form-stack">
            <div className="triagem-field-group">
              <div className="triagem-field-header">
                <span className="triagem-field-label">Nova Senha</span>
              </div>
              <div className="portal-password-input-wrap">
                <Input
                  type={showNova ? "text" : "password"}
                  value={novaSenha}
                  onChange={(event) => setNovaSenha(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  className="portal-password-toggle-btn"
                  onClick={() => setShowNova(!showNova)}
                  title={showNova ? "Ocultar" : "Mostrar"}
                >
                  {showNova ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="triagem-field-group">
              <div className="triagem-field-header">
                <span className="triagem-field-label">Confirmar Nova Senha</span>
              </div>
              <div className="portal-password-input-wrap">
                <Input
                  type={showConfirma ? "text" : "password"}
                  value={confirmaSenha}
                  onChange={(event) => setConfirmaSenha(event.target.value)}
                  placeholder="Digite a nova senha novamente"
                />
                <button
                  type="button"
                  className="portal-password-toggle-btn"
                  onClick={() => setShowConfirma(!showConfirma)}
                  title={showConfirma ? "Ocultar" : "Mostrar"}
                >
                  {showConfirma ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mensagem && (
              <div className={`portal-form-feedback ${erro ? "erro" : "sucesso"}`}>
                <span>{mensagem}</span>
              </div>
            )}

            <Button
              className="portal-agenda-confirm-btn"
              disabled={pending || !novaSenha}
              onClick={salvarSenha}
            >
              <span>{pending ? "Salvando nova senha…" : "Atualizar Senha de Acesso"}</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* COFRE GOV.BR */}
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
  const [copiado, setCopiado] = useState(false);
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

  function copiarPix() {
    if (!resultado?.pixPayload) return;
    void navigator.clipboard.writeText(resultado.pixPayload);
    setCopiado(true);
    feedback("Código Pix copiado para a área de transferência!");
    setTimeout(() => setCopiado(false), 3000);
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
        <PageTitle
          title={pago ? "Atendimento Confirmado" : "Pagamento do Atendimento"}
          description={pago ? "Seu atendimento foi confirmado e começará no horário agendado." : "Finalize o pagamento para garantir seu horário com o contador."}
        />
        <div className="portal-checkout-wrap">
          <Card className="portal-checkout-card">
            {pago ? (
              <div className="portal-checkout-success">
                <div className="portal-checkout-success-icon">
                  <CheckCheck size={28} />
                </div>
                <h3 className="portal-checkout-success-title">Agendamento Confirmado com Sucesso!</h3>
                <p className="portal-checkout-success-desc">
                  <strong>{resultado.servico?.name}</strong> agendado para <strong>{formatDate(diaAtual)}</strong> às <strong>{horaAtual}</strong>.
                </p>
                <div className="portal-checkout-success-box">
                  <p>Você pode acessar a sala de atendimento pelo Chat quando chegar a data e horário marcados.</p>
                </div>
              </div>
            ) : (
              <div className="portal-checkout-pending">
                <div className="portal-checkout-summary">
                  <div className="portal-checkout-service-pill">
                    <span>{resultado.servico?.name}</span>
                  </div>
                  <strong className="portal-checkout-price">{precoFmt} {descontoFmt}</strong>
                  <span className="portal-checkout-date">
                    📅 {formatDate(diaAtual)} às {horaAtual}
                  </span>
                </div>

                {resultado.pixImage ? (
                  <div className="portal-checkout-pix-box">
                    <span className="portal-checkout-pix-title">Escaneie o QR Code no seu aplicativo do banco</span>
                    <div className="portal-checkout-qr-frame">
                      <img src={`data:image/png;base64,${resultado.pixImage}`} alt="QR Code Pix" className="portal-checkout-qr-img" />
                    </div>
                    <div className="portal-checkout-copy-wrap">
                      <span className="portal-checkout-copy-label">Ou copie a chave Pix Copia e Cola:</span>
                      <div className="portal-checkout-copy-row">
                        <input type="text" readOnly value={resultado.pixPayload || ""} className="portal-checkout-copy-input" />
                        <Button className="portal-checkout-copy-btn" onClick={copiarPix}>
                          <Copy size={14} />
                          <span>{copiado ? "Copiado!" : "Copiar"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : resultado.invoiceUrl ? (
                  <div className="portal-checkout-card-box">
                    <p>Abrimos a página segura de pagamento em outra aba.</p>
                    <a href={resultado.invoiceUrl} target="_blank" rel="noopener noreferrer" className="button">
                      Abrir página de pagamento
                    </a>
                  </div>
                ) : null}

                <div className="portal-checkout-status-ticker">
                  <div className="portal-checkout-ticker-dot" />
                  <span>Aguardando confirmação bancária em tempo real…</span>
                </div>
              </div>
            )}
            <div className="portal-checkout-actions">
              <Button className="secondary" onClick={() => { setResultado(null); setPago(false); }}>
                {pago ? "Agendar outro horário" : "Voltar e escolher outro horário"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <PageTitle
        title="Agendar Atendimento"
        description="Selecione o serviço contábil, escolha o melhor dia e horário na agenda e confirme sua consulta."
      />

      <div className="portal-agenda-grid">
        {/* COLUNA 1: SERVIÇOS */}
        <Card className="portal-agenda-card">
          <div className="portal-agenda-step-header">
            <span className="portal-agenda-step-num">1</span>
            <div>
              <h3 className="portal-agenda-step-title">Escolha o serviço contábil</h3>
              <p className="portal-agenda-step-desc">Selecione o tipo de atendimento que você precisa</p>
            </div>
          </div>
          <div className="portal-servicos-list">
            {servicos.length ? (
              servicos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`portal-servico-choice ${servicoId === item.id ? "selecionado" : ""}`}
                  onClick={() => setServicoId(item.id)}
                >
                  <div className="portal-servico-choice-body">
                    <strong className="portal-servico-choice-title">{item.name}</strong>
                    <span className="portal-servico-choice-price">
                      {(item.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className={`portal-choice-radio ${servicoId === item.id ? "checked" : ""}`}>
                    {servicoId === item.id && <Check size={13} />}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState>Nenhum serviço disponível no momento.</EmptyState>
            )}
          </div>
        </Card>

        {/* COLUNA 2: DATA, HORA & PAGAMENTO */}
        <Card className="portal-agenda-card">
          <div className="portal-agenda-step-header">
            <span className="portal-agenda-step-num">2</span>
            <div>
              <h3 className="portal-agenda-step-title">Data e horário da consulta</h3>
              <p className="portal-agenda-step-desc">Horários com atendimento ao vivo do contador</p>
            </div>
          </div>

          {/* NAVEGAÇÃO DE SEMANAS */}
          <div className="portal-agenda-nav-bar">
            <button
              type="button"
              className="portal-agenda-nav-btn"
              disabled={offsetSemanas === 0}
              onClick={() => irSemana(-1)}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="portal-agenda-nav-label">
              {formatDate(dias[0])} a {formatDate(dias[dias.length - 1])}
            </span>
            <button
              type="button"
              className="portal-agenda-nav-btn"
              onClick={() => irSemana(1)}
              aria-label="Próxima semana"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* GRADE DE DIAS */}
          <div className="portal-agenda-days-grid">
            {dias.map((dia) => {
              const livre = primeiroLivre(dia);
              const isSelected = diaAtual === dia;
              return (
                <button
                  key={dia}
                  type="button"
                  className={`portal-agenda-day-card ${isSelected ? "selecionado" : ""} ${!livre ? "lotado" : ""}`}
                  onClick={() => escolherDia(dia)}
                >
                  <small className="portal-agenda-day-name">
                    {DIA_SEMANA_CURTO[new Date(`${dia}T12:00:00`).getDay()]}
                  </small>
                  <strong className="portal-agenda-day-num">{dia.slice(8, 10)}/{dia.slice(5, 7)}</strong>
                  <span className="portal-agenda-day-status">{livre ? "Livre" : "Fechado"}</span>
                </button>
              );
            })}
          </div>

          {diaBloqueado ? (
            <div className="portal-agenda-notice-box">
              <p>Não há horários de atendimento nesta data. Por favor, escolha outro dia útil.</p>
            </div>
          ) : (
            <div className="portal-agenda-hours-wrap">
              <span className="portal-agenda-subheading">Horários disponíveis:</span>
              <div className="portal-agenda-hours-grid">
                {agendaHorarios.map((hora) => {
                  const ocupado = horaOcupada(diaAtual, hora);
                  const passou = horaPassada(diaAtual, hora);
                  const isSelected = horaAtual === hora;
                  return (
                    <button
                      key={hora}
                      type="button"
                      className={`portal-agenda-hour-chip ${isSelected ? "selecionado" : ""}`}
                      disabled={ocupado || passou}
                      onClick={() => escolherHora(hora)}
                    >
                      {hora}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* FORMA DE PAGAMENTO */}
          <div className="portal-agenda-step-header" style={{ marginTop: 12 }}>
            <span className="portal-agenda-step-num">3</span>
            <div>
              <h3 className="portal-agenda-step-title">Forma de pagamento</h3>
              <p className="portal-agenda-step-desc">Confirmação automática e segura</p>
            </div>
          </div>

          <div className="portal-payment-methods-grid">
            <button
              type="button"
              className={`portal-payment-card ${metodoPagamento === "pix" ? "selecionado" : ""}`}
              onClick={() => setMetodoPagamento("pix")}
            >
              <div className="portal-payment-card-icon pix">
                <QrCode size={20} />
              </div>
              <div className="portal-payment-card-body">
                <strong>Pix Instantâneo</strong>
                <span>Liberação imediata da agenda</span>
              </div>
            </button>
            <button
              type="button"
              className={`portal-payment-card ${metodoPagamento === "cartao" ? "selecionado" : ""}`}
              onClick={() => setMetodoPagamento("cartao")}
            >
              <div className="portal-payment-card-icon card">
                <CreditCard size={20} />
              </div>
              <div className="portal-payment-card-body">
                <strong>Cartão de Crédito</strong>
                <span>À vista ou parcelado</span>
              </div>
            </button>
          </div>

          {erro && <p className="login-error">{erro}</p>}

          <Button
            className="portal-agenda-confirm-btn"
            disabled={pending || !servico || !horaAtual || diaBloqueado}
            onClick={gerarPagamento}
          >
            <span>
              {pending
                ? "Gerando agendamento…"
                : metodoPagamento === "pix"
                ? `Confirmar e Gerar Pix (${servico ? (servico.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""})`
                : `Ir para Pagamento com Cartão`}
            </span>
            <ArrowRight size={15} />
          </Button>
        </Card>
      </div>

      {/* HISTÓRICO DE AGENDAMENTOS DO CLIENTE */}
      {appointments.length > 0 && (
        <Card className="portal-agenda-history-card">
          <div className="card-heading">
            <div>
              <CalendarCheck size={18} />
              <strong>Seus Agendamentos Cadastrados</strong>
            </div>
          </div>
          <div className="portal-agenda-history-list">
            {appointments.map((item) => (
              <div key={item.id} className="portal-agenda-history-item">
                <div className="portal-agenda-history-date-box">
                  <strong>{formatDate(item.date)}</strong>
                  <span>{item.time || "A definir"}</span>
                </div>
                <div className="portal-agenda-history-info">
                  <strong className="portal-agenda-history-title">{item.taxType || "Atendimento Contábil"}</strong>
                  <span className="portal-agenda-history-status">
                    Status: {statusLabel[item.status || ""] || item.status || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function nomeDoAssunto(catalogo: TriagemAssunto[], assuntoId: string | null): string {
  if (!assuntoId) return "Assunto não informado";
  return acharAssunto(catalogo, assuntoId)?.titulo || assuntoId;
}

function QuestionField({
  pergunta,
  value,
  onChange,
  disabled,
}: {
  pergunta: TriagemPergunta;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  if (pergunta.tipo === "escolha" || pergunta.tipo === "sim-nao") {
    const opcoes = pergunta.tipo === "sim-nao" ? ["Sim", "Não"] : pergunta.opcoes || [];
    return (
      <div className="triagem-chips">
        {opcoes.map((opcao) => (
          <button
            key={opcao}
            type="button"
            className={`triagem-chip ${value === opcao ? "selecionado" : ""}`}
            disabled={disabled}
            onClick={() => onChange(opcao)}
          >
            {opcao}
          </button>
        ))}
      </div>
    );
  }
  if (pergunta.tipo === "textao") {
    return (
      <textarea
        className="portal-input textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={3}
      />
    );
  }
  return (
    <Input
      type={pergunta.tipo === "data" ? "date" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  );
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
  atendimentosExpress = [],
  onNavigate,
}: {
  triagem: PortalTriagem | null;
  catalogo: TriagemAssunto[];
  regras: TriagemRegras;
  clientId: string;
  documents: PortalDocument[];
  appointments: PortalAppointment[];
  atendimentosExpress?: PortalAtendimentoExpress[];
  onNavigate?: (view: string) => void;
}) {
  const router = useRouter();

  // Identifica se há atendimento express em aberto ou agendamento ao vivo
  const expressAtivo = atendimentosExpress.find((e) => e.status !== "concluido" && e.status !== "cancelado") ?? null;
  const proximoAtendimento = appointments
    .filter((item) => item.status !== "done" && item.status !== "cancelled")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0] ?? null;

  const isExpress = Boolean(expressAtivo);
  const isAgendado = Boolean(proximoAtendimento) && !isExpress;

  // Pré-seleciona o assunto se vier de atendimento express
  const initialAssunto =
    (triagem?.assunto && acharAssunto(catalogo, triagem.assunto) ? triagem.assunto : null) ||
    (expressAtivo?.assunto && acharAssunto(catalogo, expressAtivo.assunto) ? expressAtivo.assunto : null);

  const [assuntoId, setAssuntoId] = useState<string | null>(initialAssunto);
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
  const [gravandoRelato, setGravandoRelato] = useState(false);
  const [relatoSegundos, setRelatoSegundos] = useState(0);
  const [transcrevendoRelato, setTranscrevendoRelato] = useState(false);
  const relatoRecorderRef = useRef<MediaRecorder | null>(null);
  const relatoChunksRef = useRef<Blob[]>([]);
  const relatoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const RELATO_AUDIO_MAX_SEGUNDOS = 60;

  const assunto = assuntoId ? acharAssunto(catalogo, assuntoId) : null;
  const minimo = regras.minimoRelato || 20;
  const mostrarResumo = status === "enviada" && !editando;
  const pct = completude({ assunto: assuntoId, descricao, respostas }, catalogo, regras);
  const medidorTexto = pct >= 90
    ? isExpress
      ? "Pronto para envio e execução express"
      : "Pronto para análise do contador"
    : pct >= 60
    ? "Bom contexto — se puder, anexe comprovantes"
    : pct >= 30
    ? "Falta descrever o que aconteceu"
    : "Preencha as informações iniciais";

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
          setSalvo("Problema ao salvar");
          if (enviar) feedback(result.message || "Não foi possível enviar.");
          return;
        }
        setStatus(result.data.status);
        setEnviadaEm(result.data.enviadaEm);
        if (salvoTimer.current) clearTimeout(salvoTimer.current);
        setSalvo("Salvo automaticamente ✓");
        salvoTimer.current = setTimeout(() => setSalvo(""), 2500);
        if (enviar) {
          feedback(isExpress ? "Documentos enviados para execução express!" : "Pré-atendimento enviado ao escritório com sucesso!");
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
      feedback("Escolha sobre o que você precisa falar no Passo 1.");
      return;
    }
    if (descricao.trim().length < minimo) {
      feedback(`Conte um pouco do que aconteceu no Passo 2 (mínimo ${minimo} caracteres).`);
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
      feedback("Documento anexado com sucesso!");
    } catch {
      feedback("Não foi possível anexar esse arquivo agora.");
    } finally {
      setUploadingItem(null);
    }
  }

  async function iniciarRelatoAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      relatoChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) relatoChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(relatoChunksRef.current, { type: mimeType || "audio/webm" });
        void enviarRelatoAudio(blob);
      };
      relatoRecorderRef.current = recorder;
      recorder.start();
      setGravandoRelato(true);
      setRelatoSegundos(0);
      relatoTimerRef.current = setInterval(() => {
        setRelatoSegundos((value) => {
          const next = value + 1;
          if (next >= RELATO_AUDIO_MAX_SEGUNDOS) pararRelatoAudio();
          return next;
        });
      }, 1000);
    } catch {
      feedback("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function pararRelatoAudio() {
    if (relatoTimerRef.current) clearInterval(relatoTimerRef.current);
    setGravandoRelato(false);
    relatoRecorderRef.current?.stop();
  }

  async function enviarRelatoAudio(blob: Blob) {
    setTranscrevendoRelato(true);
    try {
      const supabase = createBrowserClient();
      if (!supabase) return feedback("Conexão indisponível.");
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fileName = `relato-${Date.now()}.${ext}`;
      const path = `${clientId}/${fileName}`;
      const { error: storageError } = await supabase.storage.from("documentos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
      if (storageError) return feedback("Não foi possível enviar o áudio agora.");
      const { data: doc, error: documentError } = await supabase
        .from("documentos")
        .insert({ cliente_ref: clientId, file_name: fileName, mime: blob.type || "audio/webm", size_bytes: blob.size, storage_path: path, uploaded_by: "client", checklist_item: "Relato em áudio" })
        .select("id,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,storage_path")
        .single();
      if (documentError || !doc) return feedback("Não foi possível salvar o áudio.");
      setDocuments((items) => [
        { id: doc.id, fileName: doc.file_name, mime: doc.mime, sizeBytes: doc.size_bytes, uploadedBy: doc.uploaded_by, createdAt: doc.created_at, checklistItem: doc.checklist_item, storagePath: doc.storage_path },
        ...items,
      ]);
      const duracao = `${Math.floor(relatoSegundos / 60)}:${String(relatoSegundos % 60).padStart(2, "0")}`;
      const result = await attachTriagemAudio({ fileName, duration: duracao });
      if (!result.ok) return feedback(result.message);
      if (result.transcricao) {
        setDescricao((atual) => (atual.trim() ? `${atual.trim()}\n\n[Relatado por áudio]: ${result.transcricao}` : result.transcricao || ""));
        feedback("Áudio transcrito e adicionado ao relato.");
      } else {
        feedback("Áudio enviado — a transcrição não ficou pronta, mas o contador pode ouvir o arquivo.");
      }
    } finally {
      setTranscrevendoRelato(false);
    }
  }

  return (
    <div className="view-stack">
      <PageTitle
        title={isExpress ? "Atendimento Express · Envio de Documentos" : "Pré-atendimento & Diagnóstico"}
        description={
          isExpress
            ? "Como você escolheu o Atendimento Express, não é necessária reunião ao vivo. Preencha as informações e anexe os comprovantes para o contador executar o serviço diretamente."
            : "Conte o que aconteceu antes do seu atendimento. Quanto mais o contador souber antes, mais ágil e precisa será sua orientação."
        }
      />

      {/* CARD DE CRIAR SENHA (DISPENSÁVEL) — quem entra direto na triagem
          pelo link automático do pagamento não passa pelo dashboard, então
          precisa ver esse aviso aqui também. */}
      <PortalCriarSenhaCard clientId={clientId} />

      {/* BANNER DE MODALIDADE CONTEXTUAL */}
      {isExpress ? (
        <Card className="triagem-espera-banner express">
          <div className="triagem-espera-icon express">
            <Zap size={22} />
          </div>
          <div className="triagem-espera-body">
            <div className="triagem-espera-badge-row">
              <span className="triagem-badge-express">Atendimento Express Contratado</span>
              {expressAtivo?.prazoConclusaoEm && (
                <span className="triagem-badge-sla">
                  Prazo de entrega: até {formatDateTime(expressAtivo.prazoConclusaoEm)}
                </span>
              )}
            </div>
            <strong className="triagem-espera-title">
              {status === "enviada" ? "Documentos enviados para execução do contador" : "Envio de Documentos para Execução Contábil"}
            </strong>
            <p className="triagem-espera-desc">
              Esta modalidade é 100% assíncrona. Preencha os campos e anexe os arquivos solicitados para que o contador faça o procedimento e entregue sua guia ou relatório na aba Documentos.
            </p>
          </div>
        </Card>
      ) : isAgendado && proximoAtendimento ? (
        <Card className={`triagem-espera-banner ${status === "enviada" ? "pronto" : ""}`}>
          <div className="triagem-espera-icon">
            {status === "enviada" ? <CheckCheck size={22} /> : <CalendarClock size={22} />}
          </div>
          <div className="triagem-espera-body">
            <div className="triagem-espera-badge-row">
              <span className="triagem-badge-agendado">Consulta com Contador Agendada</span>
            </div>
            <strong className="triagem-espera-title">
              {status === "enviada" ? "Diagnóstico prévio enviado ao contador responsável" : "Pré-atendimento para sua Consulta ao Vivo"}
            </strong>
            <p className="triagem-espera-desc">
              📅 {formatarQuando(proximoAtendimento.date || "", proximoAtendimento.time)}
              {status !== "enviada" ? " · Preencha os dados e anexe o que tiver para o contador estudar seu caso antes da reunião." : " · Nossa equipe já tem acesso ao seu pré-diagnóstico."}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="triagem-mode-switch-card">
          <div className="triagem-mode-switch-info">
            <strong className="triagem-mode-switch-title">Diagnóstico Preliminar Gratuito</strong>
            <p className="triagem-mode-switch-desc">
              Preencha os dados do seu caso para análise preliminar ou escolha agendar uma reunião ao vivo com o contador.
            </p>
          </div>
          {onNavigate && (
            <div className="triagem-mode-switch-actions">
              <Button className="secondary compact" onClick={() => onNavigate("agendamento")}>
                <CalendarClock size={14} />
                <span>Ver Agenda de Horários</span>
              </Button>
            </div>
          )}
        </Card>
      )}

      {mostrarResumo ? (
        <Card className="triagem-resumo-card">
          <div className="triagem-resumo-topo">
            <div>
              <span className="triagem-resumo-badge">
                <BadgeCheck size={13} />
                {isExpress ? "Documentos Enviados para Execução" : "Diagnóstico Pré-atendimento Enviado"}
              </span>
              <h3 className="triagem-resumo-title">{assunto?.titulo || "Caso em Análise"}</h3>
            </div>
            <Button className="secondary compact" onClick={() => setEditando(true)}>
              Editar informações
            </Button>
          </div>

          <div className="triagem-resumo-grid">
            <div className="triagem-resumo-item full">
              <span className="triagem-resumo-label">Relato / Descrição da Necessidade:</span>
              <p className="triagem-resumo-text">{descricao || "—"}</p>
            </div>
            {assunto?.perguntas.filter((p) => respostas[p.id]).map((p) => (
              <div key={p.id} className="triagem-resumo-item">
                <span className="triagem-resumo-label">{p.label}:</span>
                <p className="triagem-resumo-text">{respostas[p.id]}</p>
              </div>
            ))}
          </div>

          {documents.some((d) => d.checklistItem) && (
            <div className="triagem-resumo-docs-section">
              <span className="triagem-resumo-label">Comprovantes anexados:</span>
              <div className="triagem-resumo-docs-pills">
                {documents.filter((d) => d.checklistItem).map((doc) => (
                  <span key={doc.id} className="triagem-resumo-doc-pill">
                    <FileText size={12} />
                    <strong>{doc.checklistItem}</strong>: {doc.fileName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* PASSO 1: SELEÇÃO DE ASSUNTO */}
          <Card className="portal-agenda-card">
            <div className="portal-agenda-step-header">
              <span className="portal-agenda-step-num">1</span>
              <div>
                <h3 className="portal-agenda-step-title">
                  {isExpress ? "Serviço Express Selecionado" : "Sobre o que você precisa falar?"}
                </h3>
                <p className="portal-agenda-step-desc">
                  {isExpress ? "Confira o serviço contratado para envio dos dados" : "Selecione o tema principal da sua necessidade fiscal ou contábil"}
                </p>
              </div>
            </div>

            <div className="triagem-assuntos-grid">
              {catalogo.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`triagem-assunto-card ${assuntoId === item.id ? "selecionado" : ""}`}
                  onClick={() => setAssuntoId(item.id)}
                >
                  <div className="triagem-assunto-card-body">
                    <strong className="triagem-assunto-title">{item.titulo}</strong>
                    <span className="triagem-assunto-desc">{item.resumo}</span>
                  </div>
                  <div className={`portal-choice-radio ${assuntoId === item.id ? "checked" : ""}`}>
                    {assuntoId === item.id && <Check size={12} />}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {assunto && (
            <>
              {/* PASSO 2: PERGUNTAS ESPECÍFICAS E DESCRIÇÃO */}
              <Card className="portal-agenda-card">
                <div className="portal-agenda-step-header">
                  <span className="portal-agenda-step-num">2</span>
                  <div>
                    <h3 className="portal-agenda-step-title">
                      {isExpress ? "Informações para Execução do Serviço" : "Conte os detalhes da sua situação"}
                    </h3>
                    <p className="portal-agenda-step-desc">
                      {isExpress ? "Responda as questões necessárias para o contador dar entrada no processo" : "Responda as questões para que o contador prepare as respostas"}
                    </p>
                  </div>
                </div>

                <div className="triagem-form-stack">
                  {assunto.perguntas.map((pergunta) => (
                    <div key={pergunta.id} className="triagem-field-group">
                      <div className="triagem-field-header">
                        <span className="triagem-field-label">{pergunta.label}</span>
                        {!pergunta.opcional && <span className="triagem-obrigatorio-tag">Obrigatório</span>}
                      </div>
                      {pergunta.dica && <small className="triagem-field-dica">{pergunta.dica}</small>}
                      <QuestionField
                        pergunta={pergunta}
                        value={respostas[pergunta.id] || ""}
                        disabled={enviando}
                        onChange={(value) => setRespostas((current) => ({ ...current, [pergunta.id]: value }))}
                      />
                    </div>
                  ))}

                  <div className="triagem-field-group">
                    <div className="triagem-field-header">
                      <span className="triagem-field-label">
                        {isExpress ? "Orientações ou observações adicionais" : "O que está acontecendo?"}
                      </span>
                      <span className="triagem-obrigatorio-tag">Obrigatório</span>
                    </div>
                    <small className="triagem-field-dica">
                      {isExpress
                        ? "Descreva qualquer detalhe relevante para o contador realizar a emissão/declaração."
                        : "Escreva livremente com as suas palavras — não se preocupe com terminologias técnicas."}
                    </small>
                    <textarea
                      className="portal-input textarea"
                      value={descricao}
                      onChange={(event) => setDescricao(event.target.value)}
                      disabled={enviando}
                      rows={4}
                      placeholder={
                        isExpress
                          ? `Descreva sua solicitação express com detalhes (mínimo ${minimo} caracteres)...`
                          : `Descreva sua dúvida, pendência ou notificação recebida (mínimo ${minimo} caracteres)...`
                      }
                    />
                    <div className="triagem-textarea-counter">
                      <span>{descricao.trim().length} / {minimo} caracteres mínimos</span>
                    </div>
                    <div className="triagem-audio-relato">
                      {gravandoRelato ? (
                        <button type="button" className="triagem-doc-action-btn" onClick={pararRelatoAudio}>
                          <Square size={13} />
                          <span>Gravando {Math.floor(relatoSegundos / 60)}:{String(relatoSegundos % 60).padStart(2, "0")} — toque para enviar</span>
                        </button>
                      ) : (
                        <button type="button" className="triagem-doc-action-btn" disabled={enviando || transcrevendoRelato} onClick={iniciarRelatoAudio}>
                          <Mic size={13} />
                          <span>{transcrevendoRelato ? "Transcrevendo…" : "Prefere contar por áudio? (até 1 min)"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* PASSO 3: CHECKLIST DE DOCUMENTOS */}
              <Card className="portal-agenda-card">
                <div className="portal-agenda-step-header">
                  <span className="portal-agenda-step-num">3</span>
                  <div>
                    <h3 className="portal-agenda-step-title">
                      {isExpress ? "Comprovantes Obrigatórios para Execução" : "Anexar documentos e comprovantes"}
                    </h3>
                    <p className="portal-agenda-step-desc">
                      {isExpress
                        ? "Envie fotos ou PDFs dos documentos para que o contador execute o procedimento."
                        : "Tire uma foto pelo celular ou selecione do computador"}
                    </p>
                  </div>
                </div>

                <div className="triagem-docs-list">
                  {assunto.documentos.map((nome) => {
                    const enviado = documents.find((d) => d.checklistItem === nome);
                    const carregando = uploadingItem === nome;
                    return (
                      <div key={nome} className={`triagem-doc-card ${enviado ? "pronto" : ""}`}>
                        <div className={`triagem-doc-status-icon ${enviado ? "pronto" : ""}`}>
                          {enviado ? <CheckCheck size={16} /> : <CircleAlert size={16} />}
                        </div>
                        <div className="triagem-doc-info">
                          <strong className="triagem-doc-title">{nome}</strong>
                          {enviado ? (
                            <span className="triagem-doc-file-tag">
                              <FileText size={11} /> {enviado.fileName}
                            </span>
                          ) : (
                            <span className="triagem-doc-hint">
                              {isExpress ? "Necessário para execução" : "Pendente de anexo (opcional)"}
                            </span>
                          )}
                        </div>
                        <div className="triagem-doc-actions">
                          <button
                            type="button"
                            className="triagem-doc-action-btn"
                            disabled={carregando}
                            onClick={() => anexarDocumento(nome, true)}
                            title="Tirar foto com a câmera"
                          >
                            <Camera size={13} />
                            <span>{carregando ? "Enviando…" : enviado ? "Tirar outra" : "Tirar foto"}</span>
                          </button>
                          <button
                            type="button"
                            className="triagem-doc-action-btn"
                            disabled={carregando}
                            onClick={() => anexarDocumento(nome, false)}
                            title="Escolher arquivo do dispositivo"
                          >
                            <Upload size={13} />
                            <span>{enviado ? "Trocar arquivo" : "Escolher arquivo"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* BARRA FLUTUANTE DE COMPLETUDE E ENVIO */}
              <div className="triagem-floating-bar">
                <div className="triagem-progress-block">
                  <div className="triagem-progress-header">
                    <span className="triagem-progress-label">{medidorTexto}</span>
                    <strong className="triagem-progress-pct">{pct}% concluído</strong>
                  </div>
                  <div className="triagem-progress-track">
                    <div className="triagem-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="triagem-submit-actions">
                  {salvo && <span className="triagem-autosave-tag">{salvo}</span>}
                  <Button
                    className="portal-agenda-confirm-btn triagem-submit-btn"
                    disabled={enviando}
                    onClick={enviar}
                  >
                    <span>
                      {enviando
                        ? "Enviando…"
                        : status === "enviada"
                        ? isExpress
                          ? "Atualizar Documentos Express"
                          : "Atualizar Diagnóstico"
                        : isExpress
                        ? "Enviar para Execução Express"
                        : "Enviar para o Contador"}
                    </span>
                    <ArrowRight size={15} />
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

function DocumentList({
  title,
  documents,
  busyId,
  pending,
  onDownload,
}: {
  title: string;
  documents: PortalDocument[];
  busyId: number | null;
  pending: boolean;
  onDownload: (doc: PortalDocument) => void;
}) {
  const isSent = title.includes("Enviados");

  return (
    <div className="portal-doc-section">
      <div className="portal-doc-section-header">
        <div className={`portal-doc-section-icon ${isSent ? "sent" : "received"}`}>
          {isSent ? <Upload size={15} /> : <Download size={15} />}
        </div>
        <h4 className="portal-doc-section-title">{title}</h4>
        <span className="count-pill">{documents.length}</span>
      </div>
      {documents.length ? (
        <div className="portal-doc-items-list">
          {documents.map((item) => {
            const isPdf = item.mime === "application/pdf" || item.fileName.toLowerCase().endsWith(".pdf");
            const isImg = Boolean(item.mime?.startsWith("image/")) || /\.(png|jpe?g)$/i.test(item.fileName);
            return (
              <div key={item.id} className="portal-doc-item">
                <div className={`portal-doc-item-icon ${isPdf ? "pdf" : isImg ? "img" : "generic"}`}>
                  <FileText size={18} />
                </div>
                <div className="portal-doc-item-info">
                  <strong className="portal-doc-item-name">{item.fileName}</strong>
                  <div className="portal-doc-item-meta">
                    <span>{formatBytes(item.sizeBytes)}</span>
                    {item.createdAt && <span>· {formatDateTime(item.createdAt)}</span>}
                  </div>
                </div>
                <Button
                  className="secondary compact portal-doc-download-btn"
                  disabled={pending && busyId === item.id}
                  onClick={() => onDownload(item)}
                  title="Baixar arquivo"
                  aria-label={`Baixar ${item.fileName}`}
                >
                  <Download size={14} />
                  <span>{pending && busyId === item.id ? "Baixando…" : "Baixar"}</span>
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="portal-doc-empty-box">
          <p>Nenhum documento {isSent ? "enviado por você" : "recebido do contador"} ainda.</p>
        </div>
      )}
    </div>
  );
}

function ReportList({ reports }: { reports: PortalReport[] }) {
  if (!reports.length) return null;
  return (
    <div className="portal-doc-section reports">
      <div className="portal-doc-section-header">
        <div className="portal-doc-section-icon report">
          <FileCheck2 size={16} />
        </div>
        <h4 className="portal-doc-section-title">Relatórios Oficiais & Diagnósticos</h4>
        <span className="count-pill">{reports.length}</span>
      </div>
      <div className="portal-doc-items-list">
        {reports.map((report) => (
          <div key={report.id} className="portal-report-card">
            <div className="portal-report-top">
              <div className="portal-report-badge">
                <BadgeCheck size={13} />
                <span>Emitido por Contador CRC</span>
              </div>
              <span className="portal-report-date">
                {report.entregueEm ? `Entregue em ${formatDateTime(report.entregueEm)}` : "Disponível"}
              </span>
            </div>
            <h3 className="portal-report-title">{report.titulo || "Relatório Oficial de Atendimento"}</h3>
            {report.anexos.length > 0 && (
              <div className="portal-report-anexos">
                <span className="portal-report-anexos-label">Anexos complementares:</span>
                <div className="portal-report-anexos-pills">
                  {report.anexos.map((anexo) => (
                    <span key={anexo.id} className="portal-report-anexo-pill">
                      <FileText size={12} />
                      {anexo.url ? (
                        <a href={anexo.url} target="_blank" rel="noopener noreferrer">
                          {anexo.titulo}
                        </a>
                      ) : (
                        anexo.titulo
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="portal-report-footer">
              <Button
                className="portal-report-download-btn"
                onClick={() =>
                  void baixarRelatorioPdf({
                    id: report.id,
                    versao: report.versao,
                    tipoRelatorio: report.tipoRelatorio,
                    titulo: report.titulo,
                    clienteNome: report.clienteNome,
                    clienteCpf: report.clienteCpf,
                    problema: report.problema,
                    solucao: report.solucao,
                    oqueFeito: report.oqueFeito,
                    comoFeito: report.comoFeito,
                    pendencias: report.pendencias,
                    contadorAssinatura: report.contadorAssinatura,
                    contadorNome: report.contadorNome,
                    contadorCrc: report.contadorCrc,
                    codigoValidacao: report.codigoValidacao,
                    entregueEm: report.entregueEm,
                    createdAt: report.createdAt,
                  })
                }
              >
                <Download size={14} />
                <span>Baixar Relatório Oficial (PDF)</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortalDocumentosView({
  clientId,
  documents: initialDocuments,
  reports,
}: {
  clientId: string;
  documents: PortalDocument[];
  reports: PortalReport[];
}) {
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
      feedback("Documento enviado com sucesso.");
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
      <PageTitle
        title="Documentos & Guias Fiscais"
        description="Envie comprovantes e documentos solicitados ou faça o download de guias e relatórios emitidos pelo contador."
      />
      <div className="portal-documentos-grid">
        <div
          className={`portal-dropzone-container ${dragOver ? "arrastando" : ""}`}
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
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={onInputChange} />
          <div className="portal-dropzone-icon-wrap">
            <Upload size={24} />
          </div>
          <div className="portal-dropzone-texts">
            <strong className="portal-dropzone-title">
              {uploading ? "Enviando arquivo…" : "Clique ou arraste seus arquivos aqui"}
            </strong>
            <p className="portal-dropzone-desc">
              Envie comprovantes, documentos de identificação ou contratos para análise do escritório.
            </p>
          </div>
          <div className="portal-dropzone-badges">
            <span className="portal-dropzone-badge">.PDF</span>
            <span className="portal-dropzone-badge">.PNG</span>
            <span className="portal-dropzone-badge">.JPG</span>
            <span className="portal-dropzone-badge max">Máx. 10MB</span>
          </div>
        </div>
        <Card className="portal-doc-collections">
          <ReportList reports={reports} />
          <DocumentList title="Meus Arquivos Enviados" documents={meusArquivos} busyId={busyId} pending={pending} onDownload={download} />
          <DocumentList title="Documentos Recebidos do Escritório" documents={recebidos} busyId={busyId} pending={pending} onDownload={download} />
        </Card>
      </div>
    </div>
  );
}

const ASSUNTO_SEM_CATEGORIA = "Outro assunto";

export function PortalCaixaPostalView({ clientId, mailbox: initialMailbox }: { clientId: string; mailbox: PortalMailItem[] }) {
  const [mailbox, setMailbox] = useState(initialMailbox);

  // Sem isso, um aviso novo do contador só aparecia pro cliente ao
  // recarregar a página — igual já acontece no chat de atendimento.
  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`oc-caixa-postal-${clientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "caixa_postal", filter: `cliente_ref=eq.${clientId}` },
        (payload) => {
          const row = payload.new as { id: number; assunto: string | null; mensagem: string; remetente: string; lida: boolean; status: string; created_at: string };
          setMailbox((items) =>
            items.some((item) => item.id === row.id)
              ? items
              : [...items, { id: row.id, assunto: row.assunto, mensagem: row.mensagem, remetente: row.remetente, lida: row.lida, status: row.status, createdAt: row.created_at }],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "caixa_postal", filter: `cliente_ref=eq.${clientId}` },
        (payload) => {
          const row = payload.new as { id: number; lida: boolean; status: string };
          setMailbox((items) => items.map((item) => (item.id === row.id ? { ...item, lida: row.lida, status: row.status } : item)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId]);
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
    const threadEncerrada = modo === "thread" && mensagensDaThread[mensagensDaThread.length - 1]?.status === "encerrado";
    return (
      <div className="view-stack">
        <PageTitle
          title={modo === "compose" ? "Nova mensagem" : threadAtiva || ASSUNTO_SEM_CATEGORIA}
          badge={
            modo === "thread" ? (
              <span className={`portal-tile-badge ${threadEncerrada ? "ok" : "pending"}`}>{threadEncerrada ? "Encerrado" : "Em aberto"}</span>
            ) : undefined
          }
          description="Comunicação com o escritório contábil — resposta em até 1 dia útil."
          action={
            <button type="button" className="portal-back-btn" onClick={() => setModo("inbox")}>
              <ArrowLeft size={16} />
              <span>Voltar</span>
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
            <div className="portal-form portal-compose-form">
              <label>
                <span>Assunto da mensagem</span>
                <select className="input" value={assuntoNovo} onChange={(event) => setAssuntoNovo(event.target.value)}>
                  {["Dúvida sobre pagamento", "Dúvida sobre documentos", "Reagendar atendimento", ASSUNTO_SEM_CATEGORIA].map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Mensagem</span>
                <textarea
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                  placeholder="Escreva detalhadamente sua dúvida ou solicitação…"
                  rows={4}
                  disabled={pending}
                />
              </label>
              <div className="portal-form-acoes">
                <Button disabled={pending || !texto.trim()} onClick={enviar}>
                  <Send size={15} />
                  <span>{pending ? "Enviando…" : "Enviar mensagem"}</span>
                </Button>
              </div>
            </div>
          )}
          {modo === "thread" && (
            <div className="composer">
              <Input
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    enviar();
                  }
                }}
                placeholder="Responder nesta conversa…"
                disabled={pending}
              />
              <Button className="icon" disabled={pending || !texto.trim()} onClick={enviar} aria-label="Enviar mensagem">
                <Send size={16} />
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <PageTitle
        title="Caixa Postal"
        description="Avisos oficiais do escritório e mensagens enviadas fora do horário ao vivo (resposta em até 1 dia útil)."
        action={
          <Button
            onClick={() => {
              setAssuntoNovo(ASSUNTO_SEM_CATEGORIA);
              setTexto("");
              setModo("compose");
            }}
          >
            <Mail size={15} />
            <span>Nova mensagem</span>
          </Button>
        }
      />
      <div className="portal-mailbox-container">
        {threads.length ? (
          <div className="portal-mailbox-list">
            {threads.map((itens) => {
              const ultima = itens[itens.length - 1];
              const assunto = ultima.assunto || ASSUNTO_SEM_CATEGORIA;
              const naoLidas = itens.some((item) => !item.lida && item.remetente !== "cliente");
              const encerrada = ultima.status === "encerrado";
              return (
                <button
                  type="button"
                  key={assunto}
                  className={`portal-mailbox-row ${naoLidas ? "is-unread" : ""}`}
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
                  <div className={`portal-mailbox-icon ${naoLidas ? "unread" : ""}`}>
                    <Inbox size={18} />
                  </div>
                  <div className="portal-mailbox-body">
                    <div className="portal-mailbox-row-top">
                      <strong className="portal-mailbox-subject">{assunto}</strong>
                      <span className="portal-mailbox-time">{formatDateTime(ultima.createdAt)}</span>
                    </div>
                    <p className="portal-mailbox-snippet">{ultima.mensagem}</p>
                    <div className="portal-mailbox-row-bottom">
                      <span className="portal-mailbox-count">{itens.length} mensagem(ns)</span>
                      <span className={`portal-tile-badge ${encerrada ? "ok" : "pending"}`}>{encerrada ? "Encerrado" : "Em aberto"}</span>
                      {naoLidas && <span className="portal-tile-badge pending">Nova mensagem</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="portal-mailbox-arrow" />
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="portal-tile">
            <EmptyState>Nenhuma mensagem ainda. Clique em &quot;Nova mensagem&quot; para enviar uma dúvida ao escritório.</EmptyState>
          </Card>
        )}
      </div>
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
  const [filtro, setFiltro] = useState<"todos" | "Atendimento" | "Relatório" | "Express">("todos");

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

  const itensFiltrados = filtro === "todos" ? itens : itens.filter((i) => i.tipo === filtro);

  return (
    <div className="view-stack">
      <PageTitle
        title="Histórico de Serviços"
        description="Acompanhe todos os seus atendimentos, relatórios fiscais oficiais e serviços contratados."
      />

      {/* TABS DE FILTRO */}
      <div className="portal-filter-tabs">
        <button
          type="button"
          className={`portal-filter-tab ${filtro === "todos" ? "active" : ""}`}
          onClick={() => setFiltro("todos")}
        >
          <span>Todos</span>
          <span className="count-pill">{itens.length}</span>
        </button>
        <button
          type="button"
          className={`portal-filter-tab ${filtro === "Atendimento" ? "active" : ""}`}
          onClick={() => setFiltro("Atendimento")}
        >
          <span>Atendimentos</span>
          <span className="count-pill">{itens.filter((i) => i.tipo === "Atendimento").length}</span>
        </button>
        <button
          type="button"
          className={`portal-filter-tab ${filtro === "Relatório" ? "active" : ""}`}
          onClick={() => setFiltro("Relatório")}
        >
          <span>Relatórios Fiscais</span>
          <span className="count-pill">{itens.filter((i) => i.tipo === "Relatório").length}</span>
        </button>
        <button
          type="button"
          className={`portal-filter-tab ${filtro === "Express" ? "active" : ""}`}
          onClick={() => setFiltro("Express")}
        >
          <span>Express</span>
          <span className="count-pill">{itens.filter((i) => i.tipo === "Express").length}</span>
        </button>
      </div>

      <div className="portal-historico-container">
        {itensFiltrados.length ? (
          <div className="portal-historico-list">
            {itensFiltrados.map((item) => (
              <div key={item.key} className="portal-historico-card">
                <div className={`portal-historico-icon-wrap ${item.tipo.toLowerCase()}`}>
                  {item.tipo === "Relatório" ? (
                    <FileText size={20} />
                  ) : item.tipo === "Express" ? (
                    <Zap size={20} />
                  ) : (
                    <CalendarClock size={20} />
                  )}
                </div>
                <div className="portal-historico-body">
                  <div className="portal-historico-top">
                    <span className={`portal-historico-tag ${item.tipo.toLowerCase()}`}>
                      {item.tipo === "Relatório"
                        ? "Relatório Oficial"
                        : item.tipo === "Express"
                        ? "Serviço Express"
                        : "Atendimento Online"}
                    </span>
                    <span className="portal-historico-date">{item.quando}</span>
                  </div>
                  <h3 className="portal-historico-title">{item.titulo}</h3>
                  <div className="portal-historico-footer">
                    <span className={`portal-tile-badge ${item.concluido ? "done" : "pending"}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="portal-historico-action">
                  <Button className="secondary compact" onClick={() => onNavigate(item.destino)}>
                    <span>Acessar</span>
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="portal-tile">
            <EmptyState>Nenhum registro encontrado nesta categoria do histórico.</EmptyState>
          </Card>
        )}
      </div>
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
      <PageTitle title="Radar Fiscal" description="Diagnóstico fiscal e monitoramento contínuo de pendências junto à Receita Federal e órgãos públicos." />

      <div className="portal-spotlight-card tone-green">
        <div className="portal-spotlight-left">
          <div className="portal-spotlight-icon-wrap tone-green">
            <Landmark size={24} />
          </div>
          <div className="portal-spotlight-content">
            <div className="portal-spotlight-tag">
              <span>Monitoramento Ativo</span>
            </div>
            <h2 className="portal-spotlight-title">Radar Fiscal Integrado</h2>
            <p className="portal-spotlight-desc">
              Caixa Postal e-CAC e parcelamentos verificados a cada {estado.configuracao.caixaPostalIntervaloDias || 7} dias pelo escritório.
            </p>
          </div>
        </div>
      </div>

      <div className="portal-radar-grid">
        {/* CAIXA POSTAL E-CAC */}
        <Card className="portal-radar-card">
          <div className="portal-radar-card-header">
            <div className="portal-radar-card-icon inbox">
              <Inbox size={18} />
            </div>
            <div>
              <h3 className="portal-radar-card-title">Caixa Postal (e-CAC / Receita)</h3>
              <span className="portal-radar-card-desc">Comunicados oficiais emitidos pelo fisco</span>
            </div>
          </div>
          <div className="portal-radar-card-body">
            {caixaPostalNovas ? (
              <div className="radar-alerta">
                <CircleAlert size={18} />
                <div>
                  <strong>Chegou mensagem nova da Receita Federal</strong>
                  <p>Seu contador foi avisado e vai verificar o teor da notificação. Se for necessária qualquer ação, entraremos em contato.</p>
                </div>
              </div>
            ) : mensagens.length ? (
              <div className="portal-radar-msg-list">
                {mensagens.map((m, index) => (
                  <div key={index} className="portal-radar-msg-item">
                    <div className="portal-radar-msg-icon">
                      <Inbox size={15} />
                    </div>
                    <div className="portal-radar-msg-info">
                      <strong>{m.assunto}</strong>
                      <span>{dataCurtaRadar(m.data)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Nenhuma notificação pendente desde a última verificação{caixa ? ` (${dataCurtaRadar(caixa.obtido_em)})` : ""}.</EmptyState>
            )}
          </div>
        </Card>

        {/* SITUAÇÃO FISCAL */}
        <Card className="portal-radar-card">
          <div className="portal-radar-card-header">
            <div className="portal-radar-card-icon docs">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="portal-radar-card-title">Situação Fiscal</h3>
              <span className="portal-radar-card-desc">Relatório de diagnóstico cadastral</span>
            </div>
          </div>
          <div className="portal-radar-card-body">
            {sitfis ? (
              <div className="portal-radar-sitfis-box">
                <p>
                  Relatório emitido em <strong>{dataCurtaRadar(sitfis.obtido_em)}</strong> e arquivado em <strong>Documentos</strong>.
                </p>
              </div>
            ) : (
              <div className="portal-radar-sitfis-box empty">
                <p>
                  Nenhum relatório de situação fiscal emitido no momento. Você pode solicitar um ao contador pelo chat a qualquer momento.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* PARCELAMENTOS ATIVOS */}
      <Card className="portal-radar-card">
        <div className="portal-radar-card-header">
          <div className="portal-radar-card-icon agenda">
            <Landmark size={18} />
          </div>
          <div>
            <h3 className="portal-radar-card-title">Parcelamentos & Guias Tributárias</h3>
            <span className="portal-radar-card-desc">Emissão rápida de DAS e parcelas ativas</span>
          </div>
        </div>
        <div className="portal-radar-card-body">
          {parcelamentos ? (
            <>
              <p className="triagem-dica">Última consulta realizada em {dataCurtaRadar(parcelamentos.obtido_em)}.</p>
              {sistemas.length ? (
                sistemas.map((bloco) => (
                  <div key={bloco.sistema} className="radar-sistema">
                    <div className="radar-sistema-topo">
                      <strong>{bloco.sistema}</strong>
                      <span className="portal-tile-tag">{bloco.pedidos.length} parcelamento(s)</span>
                    </div>
                    {bloco.parcelas.length ? (
                      <div className="portal-parcelas-grid">
                        {bloco.parcelas.map((p, index) => {
                          const chave = `${bloco.sistema}:${p.parcela}`;
                          return (
                            <div key={index} className="radar-parcela">
                              <div>
                                <strong>Parcela {p.parcela}</strong>
                                <span className="radar-parcela-vencimento">Vencimento: {p.vencimento || "—"}</span>
                              </div>
                              {podeEmitirDas && (
                                <Button
                                  className="secondary compact"
                                  disabled={emitindo === chave}
                                  onClick={() => emitirGuia(bloco.sistema, p.parcela)}
                                >
                                  <FileDown size={14} />
                                  <span>{emitindo === chave ? "Emitindo…" : "Emitir DAS"}</span>
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="triagem-dica">Nenhuma parcela pendente para emissão neste sistema.</p>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState>Nenhum parcelamento tributário ativo encontrado.</EmptyState>
              )}
            </>
          ) : estado.regime ? (
            <div className="portal-radar-empty-actions">
              <p>Ainda não há dados salvos. A primeira consulta será guardada e reutilizada nas próximas vezes.</p>
              <Button onClick={consultarParcelamentos} disabled={pending}>
                <span>Consultar parcelamentos</span>
              </Button>
            </div>
          ) : (
            <p className="triagem-dica">Peça ao seu contador para definir se a empresa é MEI ou Simples Nacional antes da primeira consulta.</p>
          )}
          {error && <p className="login-error">{error}</p>}
        </div>
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

export function PortalFaqView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("todos");
  const termo = normalizarBusca(busca.trim());

  function bate(texto: string) {
    return normalizarBusca(texto).includes(termo);
  }

  const categorias = ["todos", ...FAQ_GRUPOS.map((g) => g.titulo)];

  const gruposFiltrados = FAQ_GRUPOS.filter((grupo) => categoriaAtiva === "todos" || grupo.titulo === categoriaAtiva)
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter((item) => !termo || bate(item.pergunta)),
    }))
    .filter((grupo) => grupo.itens.length > 0);

  const totalItens = gruposFiltrados.reduce((acc, g) => acc + g.itens.length, 0);

  return (
    <div className="view-stack">
      <PageTitle
        title="Central de Ajuda & Dúvidas"
        description="Respostas claras sobre acesso ao gov.br, etapas do atendimento e utilização da plataforma."
      />

      {/* HERO / SEARCH BAR */}
      <Card className="portal-faq-search-card">
        <div className="portal-faq-search-box">
          <Search size={18} className="portal-faq-search-icon" />
          <input
            type="search"
            placeholder="Buscar por palavra-chave (ex: duas etapas, bloqueada, nível prata, relatório)..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar nas dúvidas frequentes"
          />
          {busca && (
            <button
              type="button"
              className="portal-faq-clear-btn"
              onClick={() => setBusca("")}
              title="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="portal-faq-categories-row">
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`portal-faq-cat-pill ${categoriaAtiva === cat ? "ativo" : ""}`}
              onClick={() => setCategoriaAtiva(cat)}
            >
              {cat === "todos" ? "Todas as Dúvidas" : cat}
            </button>
          ))}
          {busca && (
            <span className="portal-faq-count-badge">
              {totalItens} {totalItens === 1 ? "resultado" : "resultados"}
            </span>
          )}
        </div>
      </Card>

      {gruposFiltrados.length === 0 ? (
        <Card className="portal-faq-empty-card">
          <div className="portal-faq-empty-icon">
            <HelpCircle size={28} />
          </div>
          <strong className="portal-faq-empty-title">Nenhuma dúvida encontrada</strong>
          <p className="portal-faq-empty-desc">
            Não encontramos nenhum artigo correspondente a &quot;{busca}&quot;. Tente outros termos ou entre em contato com nosso time.
          </p>
          {onNavigate && (
            <Button className="secondary compact" onClick={() => onNavigate("caixa-postal")}>
              <Mail size={14} />
              <span>Enviar Dúvida na Caixa Postal</span>
            </Button>
          )}
        </Card>
      ) : (
        <div className="portal-faq-groups-stack">
          {gruposFiltrados.map((grupo) => (
            <Card key={grupo.titulo} className="portal-faq-group-card">
              <div className="portal-faq-group-header">
                <div className="portal-faq-group-icon">
                  {grupo.titulo === "Conta gov.br" ? <KeyRound size={18} /> : <Sparkles size={18} />}
                </div>
                <div>
                  <h3 className="portal-faq-group-title">{grupo.titulo}</h3>
                  <span className="portal-faq-group-subtitle">{grupo.itens.length} tópicos explicativos</span>
                </div>
              </div>

              <div className="portal-faq-items-list">
                {grupo.itens.map((item) => (
                  <details key={item.pergunta} className="portal-faq-accordion-item" open={Boolean(termo)}>
                    <summary className="portal-faq-accordion-summary">
                      <span className="portal-faq-question-text">{item.pergunta}</span>
                      <div className="portal-faq-chevron-wrap">
                        <ChevronDown size={17} />
                      </div>
                    </summary>
                    <div className="portal-faq-accordion-content">
                      <div className="portal-faq-answer-body">{item.resposta}</div>
                    </div>
                  </details>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CARD DE CONTATO / SUPORTE */}
      <Card className="portal-faq-contact-card">
        <div className="portal-faq-contact-info">
          <div className="portal-faq-contact-icon">
            <MessageCircle size={22} />
          </div>
          <div>
            <strong className="portal-faq-contact-title">Ainda precisa de orientação específica?</strong>
            <p className="portal-faq-contact-desc">
              Envie uma mensagem para a equipe do escritório ou converse com o contador no seu horário agendado.
            </p>
          </div>
        </div>
        {onNavigate && (
          <div className="portal-faq-contact-actions">
            <Button className="secondary compact" onClick={() => onNavigate("caixa-postal")}>
              <Inbox size={14} />
              <span>Abrir Caixa Postal</span>
            </Button>
            <Button className="portal-agenda-confirm-btn compact" onClick={() => onNavigate("atendimento")}>
              <MessageCircle size={14} />
              <span>Ir para o Chat</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
