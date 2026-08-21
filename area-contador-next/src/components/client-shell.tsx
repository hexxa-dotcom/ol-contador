"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, FolderOpen,
  HelpCircle, History, House, Inbox, Landmark, Lock, LogOut, Menu, MessageCircle,
  PanelLeftClose, PanelLeftOpen, UserRound, X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import {
  PortalAgendaView, PortalAtendimentoView, PortalCaixaPostalView,
  PortalDashboardView, PortalDocumentosView, PortalFaqView, PortalHistoricoView,
  PortalPerfilView, PortalRadarView, PortalTriagemView,
} from "@/components/client-views";
import type { PortalData } from "@/lib/portal";
import { signOut } from "@/app/auth/actions";

type NavItem = { id: string; label: string; icon: ElementType; badge?: number };

export function ClientShell({ data }: { data: PortalData }) {
  const navItems: NavItem[] = [
    { id: "dashboard", label: "Início", icon: House },
    { id: "atendimento", label: "Falar com Contador", icon: MessageCircle, badge: data.unreadMessages },
    { id: "triagem", label: "O que você precisa", icon: ClipboardList, badge: !data.triagem || data.triagem.status !== "enviada" ? 1 : undefined },
    { id: "caixa-postal", label: "Mensagens", icon: Inbox, badge: data.unreadMail },
    { id: "documentos", label: "Meus Documentos", icon: FolderOpen },
    { id: "agendamento", label: "Agendar Horário", icon: CalendarDays },
    { id: "radar", label: "Consultar CPF/CNPJ", icon: Landmark },
    { id: "historico", label: "Histórico de Atendimentos", icon: History },
  ];
  const allowedSections = new Set([...navItems.map((item) => item.id), "perfil", "faq"]);
  // Onboarding obrigatório: cliente que acabou de pagar pela primeira vez
  // fica preso na triagem até enviá-la — mesmo comportamento do cliente.js
  // legado (entrarNaTriagemObrigatoria). Só "Sair com segurança" continua
  // liberado, como válvula de escape.
  const onboardingPendente = data.client.onboardingPendente;

  const [active, setActive] = useState(onboardingPendente ? "triagem" : "dashboard");
  const [collapsed, setCollapsed] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // Acessibilidade: tamanho de texto ajustável pelo cliente, persistido no
  // navegador. `zoom` (não `font-size`) porque escala o portal inteiro —
  // botões, ícones, espaçamento — não só o texto, que é o que de fato ajuda
  // quem tem baixa visão ou pouca familiaridade com telas pequenas.
  const [fontScale, setFontScale] = useState(1);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem("oc-portal-zoom"));
    if (saved && [0.9, 1, 1.15, 1.3].includes(saved)) setFontScale(saved);
  }, []);
  function ajustarFontScale(value: number) {
    setFontScale(value);
    window.localStorage.setItem("oc-portal-zoom", String(value));
  }

  useEffect(() => {
    // Sincroniza a seção ativa com a hash da URL — carga inicial e sempre
    // que o usuário aperta "voltar"/"avançar" (nativo do celular incluso).
    // Sem o listener de popstate, navigate() empilhava a hash certinho, mas
    // nada reagia ao voltar: ficava preso na última seção até o histórico
    // esgotar e sair do app de vez, direto pro site público.
    function syncFromHash() {
      if (onboardingPendente) return;
      const section = window.location.hash.replace("#", "");
      setActive(allowedSections.has(section) ? section : "dashboard");
    }
    syncFromHash();
    window.addEventListener("popstate", syncFromHash);
    return () => window.removeEventListener("popstate", syncFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const showFeedback = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setFeedback(message);
      clearTimeout(timer);
      timer = setTimeout(() => setFeedback(""), 3600);
    };
    window.addEventListener("app-feedback", showFeedback);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("app-feedback", showFeedback);
    };
  }, []);

  function navigate(id: string) {
    if (onboardingPendente && id !== "triagem") return;
    setActive(id);
    setMobile(false);
    setAccountMenuOpen(false);
    // pushState (não replaceState) empilha uma entrada de histórico por
    // navegação — é o que faz o botão "voltar" do celular voltar pra seção
    // anterior do app em vez de sair direto pro site público.
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  }

  const initials = data.client.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OC";
  const notificationCount = data.unreadMessages + data.unreadMail;

  return (
    <div
      className={`app-shell portal-shell view-${active} ${active !== "dashboard" ? "hide-mobile-topbar" : "show-mobile-topbar"} ${active === "atendimento" ? "chat-view-active" : ""}`}
      style={{ zoom: fontScale }}
    >
      <div className="preview-banner">
        <span>HOMOLOGAÇÃO</span> Migração funcional em validação; a versão anterior permanece preservada.
      </div>
      {mobile && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-toggle-btn"
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={collapsed && !mobile ? "Expandir menu" : undefined}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            {(!collapsed || mobile) && <span>Recolher</span>}
          </button>
          {mobile && (
            <div className="sidebar-mobile-title-wrap">
              <Image src="/logo.svg" alt="Olá, Contador" width={26} height={27} priority />
              <span className="sidebar-mobile-title">Menu</span>
            </div>
          )}
          {mobile && (
            <Button aria-label="Fechar menu" className="icon ghost mobile-close" onClick={() => setMobile(false)}>
              <X size={18} />
            </Button>
          )}
        </div>
        <nav>
          {navItems.map(({ id, label, icon: Icon, badge }) => {
            const bloqueado = onboardingPendente && id !== "triagem";
            return (
              <button
                className={active === id ? "active" : ""}
                key={id}
                onClick={() => navigate(id)}
                disabled={bloqueado}
                title={bloqueado ? `${label} — disponível após enviar o pré-atendimento` : (collapsed && !mobile ? label : undefined)}
                data-tooltip={collapsed && !mobile ? label : undefined}
                aria-label={collapsed && !mobile ? label : undefined}
                aria-current={active === id ? "page" : undefined}
                aria-disabled={bloqueado}
              >
                {bloqueado ? <Lock size={18} strokeWidth={1.9} /> : <Icon size={21} strokeWidth={1.9} />}
                {(!collapsed || mobile) && <span>{label}</span>}
                {!bloqueado && typeof badge === "number" && badge > 0 && <Badge className="nav-count">{badge > 99 ? "99+" : badge}</Badge>}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-brand-wrap">
              <Link href="/portal" className="topbar-brand-link" onClick={() => navigate("dashboard")}>
                <Image src="/logo.svg" alt="Olá, Contador" width={32} height={33} priority />
                <span className="topbar-brand-text">
                  Olá<i>,</i> Contador<i>.</i>
                </span>
              </Link>
            </div>
          </div>
          <div className="topbar-actions">
            <Button
              aria-label="Notificações"
              className="icon floating-notification"
              onClick={() => navigate("atendimento")}
              disabled={onboardingPendente}
              title={onboardingPendente ? "Disponível após enviar o pré-atendimento" : "Notificações"}
            >
              <Bell size={18} />
              {!onboardingPendente && notificationCount > 0 && <span className="top-notification-count">{notificationCount > 99 ? "99+" : notificationCount}</span>}
            </Button>
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button className="account-glass" onClick={() => setAccountMenuOpen((value) => !value)} aria-label={`Abrir menu de ${data.client.name}`} aria-expanded={accountMenuOpen} aria-controls="account-popover">
                <div className="avatar">{initials}</div>
                <div className="account-copy">
                  <strong>{data.client.name}</strong>
                  <small>Cliente</small>
                </div>
                <ChevronDown className={accountMenuOpen ? "rotated" : ""} size={15} />
              </button>
              {accountMenuOpen && (
                <div className="account-popover" id="account-popover" role="menu">
                  <div className="account-popover-head">
                    <strong>{data.client.name}</strong>
                    <small>{data.client.email}</small>
                  </div>
                  <button role="menuitem" onClick={() => navigate("perfil")} disabled={onboardingPendente}>
                    <UserRound size={16} />
                    <span>Meu perfil</span>
                  </button>
                  <button role="menuitem" onClick={() => navigate("faq")} disabled={onboardingPendente}>
                    <HelpCircle size={16} />
                    <span>Ajuda</span>
                  </button>
                  <div className="account-menu-separator" />
                  <div className="account-menu-font-size" role="group" aria-label="Tamanho do texto">
                    <span>Tamanho do texto</span>
                    <div className="account-menu-font-buttons">
                      <button type="button" aria-label="Texto normal" aria-pressed={fontScale === 1} onClick={() => ajustarFontScale(1)}>A</button>
                      <button type="button" aria-label="Texto grande" aria-pressed={fontScale === 1.15} onClick={() => ajustarFontScale(1.15)}>A+</button>
                      <button type="button" aria-label="Texto extra grande" aria-pressed={fontScale === 1.3} onClick={() => ajustarFontScale(1.3)}>A++</button>
                    </div>
                  </div>
                  <div className="account-menu-separator" />
                  <form action={signOut}>
                    <button className="danger" role="menuitem" type="submit">
                      <LogOut size={16} />
                      <span>Sair com segurança</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>
        {onboardingPendente && (
          <div className="onboarding-banner">
            <Lock size={15} />
            <span>Conte o que aconteceu para liberar o resto da sua área — é rápido, e o rascunho fica salvo sozinho.</span>
          </div>
        )}
        <div className="workspace-scroll">
          <div className="view-transition" key={active}>
            {active === "dashboard" ? (
              <PortalDashboardView data={data} onNavigate={navigate} />
            ) : active === "atendimento" ? (
              <PortalAtendimentoView messages={data.messages} contador={data.contador} clientId={data.client.id} clientStatus={data.client.status} appointments={data.appointments} atendimentosExpress={data.atendimentosExpress} triagem={data.triagem} reports={data.reports} catalogo={data.triagemCatalogo} documents={data.documents} onNavigate={navigate} />
            ) : active === "agendamento" ? (
              <PortalAgendaView
                clientId={data.client.id}
                appointments={data.appointments}
                servicos={data.servicos}
                agendaHorarios={data.agendaHorarios}
                agendaDiasBloqueados={data.agendaDiasBloqueados}
                agendaOcupados={data.agendaOcupados}
              />
            ) : active === "triagem" ? (
              <PortalTriagemView
                triagem={data.triagem}
                catalogo={data.triagemCatalogo}
                regras={data.triagemRegras}
                clientId={data.client.id}
                documents={data.documents}
                appointments={data.appointments}
                atendimentosExpress={data.atendimentosExpress}
                onNavigate={navigate}
              />
            ) : active === "documentos" ? (
              <PortalDocumentosView clientId={data.client.id} documents={data.documents} reports={data.reports} />
            ) : active === "caixa-postal" ? (
              <PortalCaixaPostalView clientId={data.client.id} mailbox={data.mailbox} />
            ) : active === "radar" ? (
              <PortalRadarView clientId={data.client.id} caixaPostalNovas={data.client.caixaPostalNovas} />
            ) : active === "historico" ? (
              <PortalHistoricoView appointments={data.appointments} reports={data.reports} atendimentosExpress={data.atendimentosExpress} onNavigate={navigate} />
            ) : active === "perfil" ? (
              <PortalPerfilView client={data.client} />
            ) : active === "faq" ? (
              <PortalFaqView onNavigate={navigate} />
            ) : (
              <PortalDashboardView data={data} onNavigate={navigate} />
            )}
          </div>
        </div>
      </main>

      {/* BOTTOM NAVIGATION BAR MOBILE CLIENTE */}
      <nav className="bottom-nav" aria-label="Navegação rápida do cliente">
        <button
          type="button"
          className={`bottom-nav-item ${active === "dashboard" ? "active" : ""}`}
          onClick={() => navigate("dashboard")}
          disabled={onboardingPendente}
        >
          <House size={20} />
          <span>Início</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${active === "documentos" ? "active" : ""}`}
          onClick={() => navigate("documentos")}
          disabled={onboardingPendente}
        >
          <FolderOpen size={20} />
          <span>Documentos</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${active === "atendimento" ? "active" : ""}`}
          onClick={() => navigate("atendimento")}
          disabled={onboardingPendente}
        >
          <MessageCircle size={20} />
          <span>Suporte</span>
          {!onboardingPendente && data.unreadMessages > 0 && (
            <span className="bottom-nav-badge">
              {data.unreadMessages > 9 ? "9+" : data.unreadMessages}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${active === "agendamento" ? "active" : ""}`}
          onClick={() => navigate("agendamento")}
          disabled={onboardingPendente}
        >
          <CalendarDays size={20} />
          <span>Agenda</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${!["dashboard", "documentos", "atendimento", "agendamento"].includes(active) ? "active" : ""}`}
          onClick={() => setMobile(true)}
          aria-label="Abrir menu completo"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>

      {feedback && (
        <div className="action-toast" role="status">
          <CheckCircle2 size={17} />
          <span>{feedback}</span>
          <button aria-label="Fechar aviso" onClick={() => setFeedback("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
