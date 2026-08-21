"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign,
  ClipboardList, FileText, House, Landmark, LogOut, Menu, MessageCircle,
  PanelLeftClose, PanelLeftOpen, Settings, UserRound, Users, Users2, X, Zap,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { AcompanhamentoIntegralView as AcompanhamentoView, AgendaIntegralView as AgendamentosView, AtendimentoView, ClientesIntegralView as ClientesView, ConfiguracoesIntegralView as ConfiguracoesView, DashboardView, EquipeIntegralView as EquipeView, FinanceiroIntegralView as FinanceiroView, InsightsView, NotificacoesIntegralView as NotificacoesView, PerfilView, RadarFiscalView as RadarView, RelatoriosIntegralView as RelatoriosView, type NotificationItem } from "@/components/views";
import type { DashboardData } from "@/lib/dashboard";
import type { ClientsData } from "@/lib/clients";
import type { OperationsData } from "@/lib/operations";
import { signOut } from "@/app/auth/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { playNotificationChime } from "@/lib/notificationSound";

type NavItem = { id: string; label: string; icon: ElementType; badge?: number };

type NavGroup = {
  groupLabel?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    groupLabel: "Operacional",
    items: [
      { id: "dashboard", label: "Dashboard", icon: House },
      { id: "atendimento", label: "Fila de Atendimento", icon: MessageCircle, badge: 0 },
      { id: "clientes", label: "Clientes", icon: Users },
      { id: "acompanhamento", label: "Processos & Dossiês", icon: ClipboardList },
      { id: "agendamentos", label: "Agendamentos", icon: CalendarDays },
    ],
  },
  {
    groupLabel: "Gestão & Análise",
    items: [
      { id: "relatorios", label: "Relatórios & Pareceres", icon: FileText },
      { id: "financeiro", label: "Financeiro", icon: CircleDollarSign },
      { id: "radar", label: "Radar Fiscal", icon: Landmark },
      { id: "insights", label: "Insights & Funil", icon: BarChart3 },
    ],
  },
  {
    groupLabel: "Sistema",
    items: [
      { id: "notificacoes", label: "Notificações", icon: Bell },
      { id: "equipe", label: "Equipe", icon: Users2 },
      { id: "configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

const allowedSections = new Set([
  ...allNavItems.map((item) => item.id),
  "perfil",
]);

// RBAC: seções restritas para o papel "parceiro" (paridade com app.js:175-182 legado).
// "equipe" fica restrita também: só admin gerencia senha/papel de outras pessoas.
const partnerRestrictedSections = new Set(["relatorios", "financeiro", "configuracoes", "equipe"]);

export function AccountantShell({ dashboardData, clientsData, operationsData, user, notifications }: { dashboardData: DashboardData; clientsData: ClientsData; operationsData: OperationsData; user: { id: string; name: string; email: string; role: string; filaRestrita: boolean; acessoInsightsRadar: boolean }; notifications: NotificationItem[] }) {
  const storedProfessionalProfile = operationsData.settings.find(
    (item) => item.chave === "perfil_contador",
  )?.valor;
  const storedProfessionalName =
    storedProfessionalProfile &&
    typeof storedProfessionalProfile === "object" &&
    !Array.isArray(storedProfessionalProfile) &&
    typeof (storedProfessionalProfile as Record<string, unknown>).name === "string"
      ? String((storedProfessionalProfile as Record<string, unknown>).name).trim()
      : "";
  const storedPanelPreferences = operationsData.settings.find(
    (item) => item.chave === "painel_preferencias",
  )?.valor;
  const systemSoundsEnabled = !(
    storedPanelPreferences &&
    typeof storedPanelPreferences === "object" &&
    !Array.isArray(storedPanelPreferences) &&
    (storedPanelPreferences as Record<string, unknown>).systemSounds === false
  );
  const storedChatAppearance = operationsData.settings.find(
    (item) => item.chave === "chat_appearance",
  )?.valor;
  const darkModeEnabled = Boolean(
    storedChatAppearance &&
    typeof storedChatAppearance === "object" &&
    !Array.isArray(storedChatAppearance) &&
    (storedChatAppearance as Record<string, unknown>).dark === true,
  );
  const [active, setActive] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState({
    ...user,
    name:
      user.name && user.name !== "Contador"
        ? user.name
        : storedProfessionalName || user.name,
  });
  const [currentNotifications, setCurrentNotifications] = useState(notifications);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(dashboardData.unreadMessages);
  const [collapsed, setCollapsed] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const isPartner = currentUser.role === "parceiro";
  // Restrição por papel (fixa) + restrição por pessoa (configurável na Equipe).
  function isSectionRestricted(id: string) {
    if (isPartner && partnerRestrictedSections.has(id)) return true;
    if (!currentUser.acessoInsightsRadar && (id === "insights" || id === "radar")) return true;
    return false;
  }

  useEffect(() => {
    // Sincroniza a seção ativa com a hash da URL — tanto na carga inicial
    // quanto sempre que o usuário aperta "voltar"/"avançar" (nativo do
    // celular incluso). Sem o listener de popstate, navigate() empilhava a
    // hash certinho, mas nada reagia ao voltar: a tela ficava presa na
    // última seção até o histórico esgotar e sair do app de vez.
    function syncFromHash() {
      const section = window.location.hash.replace("#", "");
      setActive(allowedSections.has(section) && !isSectionRestricted(section) ? section : "dashboard");
    }
    syncFromHash();
    window.addEventListener("popstate", syncFromHash);
    return () => window.removeEventListener("popstate", syncFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const client = supabase;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    function refreshUnreadCount() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!client) return;
        void client
          .from("mensagens")
          .select("id", { count: "exact", head: true })
          .eq("sender", "client")
          .is("read_at", null)
          .then(({ count }) => {
            if (typeof count === "number") setUnreadMessagesCount(count);
          });
      }, 300);
    }
    const channel = supabase
      .channel("contador-badge-mensagens-next")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        refreshUnreadCount,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensagens" },
        refreshUnreadCount,
      )
      .subscribe();
    return () => {
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("contador-notificacoes-next")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as Partial<NotificationItem>;
            if (typeof removed.id === "number")
              setCurrentNotifications((items) =>
                items.filter((item) => item.id !== removed.id),
              );
            return;
          }
          const incoming = payload.new as NotificationItem;
          if (payload.eventType === "INSERT" && systemSoundsEnabled) playNotificationChime();
          setCurrentNotifications((items) => {
            const next = items.some((item) => item.id === incoming.id)
              ? items.map((item) =>
                  item.id === incoming.id ? incoming : item,
                )
              : [incoming, ...items];
            return next.slice(0, 100);
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [systemSoundsEnabled]);

  // Alerta de sistema operacional quando um cliente novo cai na triagem
  // (ex.: pagou o Pix). Porte 1:1 de notifyNewLead em app.js do legado.
  useEffect(() => {
    if ("Notification" in window) void Notification.requestPermission();
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("contador-novo-lead-next")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clientes" },
        (payload) => {
          if ("Notification" in window && Notification.permission === "granted") {
            const nome = (payload.new as { name?: string }).name || "Desconhecido";
            new Notification("Novo Cliente na Triagem!", {
              body: `O cliente ${nome} pagou o PIX e está aguardando atendimento.`,
              icon: "https://olacontador.com.br/favicon.ico",
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
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
    if (!notificationOpen) return;
    const close = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setNotificationOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [notificationOpen]);

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

  function navigate(id: string, clientId?: string | null) {
    if (isSectionRestricted(id)) return;
    if (clientId) window.sessionStorage.setItem("contador-open-client", clientId);
    setActive(id);
    setMobile(false);
    setAccountMenuOpen(false);
    setNotificationOpen(false);
    // pushState (não replaceState) empilha uma entrada de histórico por
    // navegação — é o que faz o botão "voltar" do celular voltar pra seção
    // anterior do app em vez de sair direto pro site público.
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  }

  const initials = currentUser.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "OC";
  const unreadCount = currentNotifications.filter(item => item.unread).length;
  return (
    <div className={`app-shell ${darkModeEnabled ? "dark-mode" : ""} view-${active} ${active !== "dashboard" ? "hide-mobile-topbar" : "show-mobile-topbar"} ${active === "atendimento" ? "chat-view-active" : ""}`}>
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
            <Button aria-label="Fechar menu" className="icon ghost mobile-close" onClick={() => setMobile(false)}>
              <X size={18} />
            </Button>
          )}
        </div>
        <nav>
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => !isSectionRestricted(item.id));
            if (!visibleItems.length) return null;

            return (
              <div key={group.groupLabel || groupIdx} className="nav-group-block">
                {group.groupLabel && (!collapsed || mobile) && (
                  <span className="nav-group-label">{group.groupLabel}</span>
                )}
                {group.groupLabel && collapsed && !mobile && groupIdx > 0 && (
                  <div className="nav-group-divider" />
                )}
                {visibleItems.map(({ id, label, icon: Icon, badge }) => {
                  const count = id === "notificacoes" ? unreadCount : id === "atendimento" ? unreadMessagesCount : badge;
                  return (
                    <button
                      className={active === id ? "active" : ""}
                      key={id}
                      onClick={() => navigate(id)}
                      title={collapsed && !mobile ? label : undefined}
                      data-tooltip={collapsed && !mobile ? label : undefined}
                      aria-label={collapsed && !mobile ? label : undefined}
                      aria-current={active === id ? "page" : undefined}
                    >
                      <Icon size={20} strokeWidth={1.9} />
                      {(!collapsed || mobile) && <span>{label}</span>}
                      {typeof count === "number" && count > 0 && (
                        <Badge className="nav-count">{count > 99 ? "99+" : count}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <Button aria-label="Abrir menu" className="icon ghost mobile-menu" onClick={() => setMobile(true)}>
              <Menu size={20} />
            </Button>
            <div className="topbar-brand-wrap">
              <Link href="/painel" className="topbar-brand-link" onClick={() => navigate("dashboard")}>
                <Image src="/logo.svg" alt="Olá, Contador" width={32} height={33} priority />
                <span className="topbar-brand-text">
                  Olá<i>,</i> Contador<i>.</i>
                </span>
              </Link>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="notification-wrap" ref={notificationRef}>
              <Button
                aria-label="Abrir notificações"
                aria-expanded={notificationOpen}
                className={`icon floating-notification notification-button ${notificationOpen ? "is-open" : ""}`}
                onClick={() => {
                  setNotificationOpen((value) => !value);
                  setAccountMenuOpen(false);
                }}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="top-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </Button>
              {notificationOpen && (
                <div className="notification-popover" role="dialog" aria-label="Notificações recentes">
                  <div className="popover-title">
                    <div>
                      <strong>Notificações</strong>
                      <small>{unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}</small>
                    </div>
                    <Badge>{currentNotifications.length}</Badge>
                  </div>
                  <div className="notification-list">
                    {currentNotifications.length ? (
                      currentNotifications.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.cliente_ref ? "atendimento" : "notificacoes", item.cliente_ref)}
                          className={item.unread ? "unread" : ""}
                        >
                          <span className="notification-dot" />
                          <span>
                            <strong>{item.text}</strong>
                            <small>{item.time || (item.created_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at)) : "Agora")}</small>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="notification-empty">Nenhuma notificação por aqui.</div>
                    )}
                  </div>
                  <button className="popover-footer" onClick={() => navigate("notificacoes")}>
                    Ver todas as notificações <ChevronDown size={15} />
                  </button>
                </div>
              )}
            </div>
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button
                className="account-glass"
                onClick={() => {
                  setAccountMenuOpen((value) => !value);
                  setNotificationOpen(false);
                }}
                aria-label={`Abrir menu de ${currentUser.name}`}
                aria-expanded={accountMenuOpen}
                aria-controls="account-popover"
              >
                <div className="avatar">{initials}</div>
                <div className="account-copy">
                  <strong>{currentUser.name}</strong>
                  <small>{currentUser.role === "admin" ? "Administrador" : currentUser.role === "contador" ? "Contador CRC" : currentUser.role}</small>
                </div>
                <ChevronDown className={accountMenuOpen ? "rotated" : ""} size={15} />
              </button>
              {accountMenuOpen && (
                <div className="account-popover" id="account-popover" role="menu">
                  <div className="account-popover-head">
                    <strong>{currentUser.name}</strong>
                    <small>{currentUser.email}</small>
                  </div>
                  <button role="menuitem" onClick={() => navigate("perfil")}>
                    <UserRound size={16} />
                    <span>Meu perfil</span>
                  </button>
                  {!isPartner && (
                    <button role="menuitem" onClick={() => navigate("configuracoes")}>
                      <Settings size={16} />
                      <span>Configurações</span>
                    </button>
                  )}
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
        <div className="workspace-scroll">
          <div className="view-transition" key={active}>
            {active === "dashboard" ? (
              <DashboardView data={dashboardData} onNavigate={navigate} />
            ) : active === "clientes" ? (
              <ClientesView data={clientsData} operationsData={operationsData} currentStaffId={currentUser.id} filaRestrita={currentUser.filaRestrita} />
            ) : active === "atendimento" ? (
              <AtendimentoView clientsData={clientsData} operationsData={operationsData} currentStaffId={currentUser.id} filaRestrita={currentUser.filaRestrita} />
            ) : active === "acompanhamento" ? (
              <AcompanhamentoView data={operationsData} clientsData={clientsData} onNavigate={navigate} />
            ) : active === "relatorios" ? (
              isSectionRestricted("relatorios") ? <DashboardView data={dashboardData} onNavigate={navigate} /> : <RelatoriosView data={operationsData} />
            ) : active === "agendamentos" ? (
              <AgendamentosView data={operationsData} />
            ) : active === "financeiro" ? (
              isSectionRestricted("financeiro") ? <DashboardView data={dashboardData} onNavigate={navigate} /> : <FinanceiroView data={operationsData} />
            ) : active === "radar" ? (
              isSectionRestricted("radar") ? <DashboardView data={dashboardData} onNavigate={navigate} /> : <RadarView data={operationsData} />
            ) : active === "insights" ? (
              isSectionRestricted("insights") ? <DashboardView data={dashboardData} onNavigate={navigate} /> : <InsightsView data={operationsData} clientsData={clientsData} />
            ) : active === "configuracoes" ? (
              isSectionRestricted("configuracoes") ? <DashboardView data={dashboardData} onNavigate={navigate} /> : <ConfiguracoesView data={operationsData} />
            ) : active === "perfil" ? (
              <PerfilView user={currentUser} data={operationsData} clientsData={clientsData} onUpdated={(name) => setCurrentUser((value) => ({ ...value, name }))} />
            ) : active === "notificacoes" ? (
              <NotificacoesView notifications={currentNotifications} data={operationsData} clientsData={clientsData} onNotificationsChanged={setCurrentNotifications} onNavigate={navigate} />
            ) : active === "equipe" ? (
              isSectionRestricted("equipe") ? <DashboardView data={dashboardData} onNavigate={navigate} /> : <EquipeView currentStaffId={currentUser.id} />
            ) : (
              <DashboardView data={dashboardData} onNavigate={navigate} />
            )}
          </div>
        </div>
      </main>

      {/* BOTTOM NAVIGATION BAR MOBILE */}
      <nav className="bottom-nav" aria-label="Navegação rápida mobile">
        <button
          type="button"
          className={`bottom-nav-item ${active === "dashboard" ? "active" : ""}`}
          onClick={() => navigate("dashboard")}
        >
          <House size={20} />
          <span>Início</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${active === "acompanhamento" ? "active" : ""}`}
          onClick={() => navigate("acompanhamento")}
        >
          <Zap size={20} />
          <span>Processos</span>
          {dashboardData.expressPending > 0 && (
            <span className="bottom-nav-badge">
              {dashboardData.expressPending > 9 ? "9+" : dashboardData.expressPending}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${active === "atendimento" ? "active" : ""}`}
          onClick={() => navigate("atendimento")}
        >
          <MessageCircle size={20} />
          <span>Chat</span>
          {dashboardData.unreadMessages > 0 && (
            <span className="bottom-nav-badge">
              {dashboardData.unreadMessages > 9 ? "9+" : dashboardData.unreadMessages}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${active === "clientes" ? "active" : ""}`}
          onClick={() => navigate("clientes")}
        >
          <Users size={20} />
          <span>Clientes</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${!["dashboard", "acompanhamento", "atendimento", "clientes"].includes(active) ? "active" : ""}`}
          onClick={() => setMobile(true)}
          aria-label="Abrir menu completo"
        >
          <Menu size={20} />
          <span>Mais</span>
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
