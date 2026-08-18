"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import {
  BarChart3, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign,
  ClipboardList, FileText, House, Landmark, LogOut, Menu, MessageCircle,
  Settings, UserRound, Users, X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { AcompanhamentoIntegralView as AcompanhamentoView, AgendaIntegralView as AgendamentosView, AtendimentoView, ClientesIntegralView as ClientesView, ConfiguracoesIntegralView as ConfiguracoesView, DashboardView, FinanceiroIntegralView as FinanceiroView, InsightsView, NotificacoesIntegralView as NotificacoesView, PerfilView, RadarFiscalView as RadarView, RelatoriosIntegralView as RelatoriosView, type NotificationItem } from "@/components/views";
import type { DashboardData } from "@/lib/dashboard";
import type { ClientsData } from "@/lib/clients";
import type { OperationsData } from "@/lib/operations";
import { signOut } from "@/app/auth/actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

type NavItem = { id: string; label: string; icon: ElementType; badge?: number };

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House },
  { id: "atendimento", label: "Atendimentos", icon: MessageCircle, badge: 0 },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "acompanhamento", label: "Acompanhamento", icon: ClipboardList },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "agendamentos", label: "Agendamentos", icon: CalendarDays },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign },
  { id: "radar", label: "Radar Fiscal", icon: Landmark },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

const allowedSections = new Set([
  ...navItems.map((item) => item.id),
  "perfil",
  "configuracoes",
]);

// RBAC: seções restritas para o papel "parceiro" (paridade com app.js:175-182 legado).
const partnerRestrictedSections = new Set(["relatorios", "financeiro", "configuracoes"]);

export function AccountantShell({ dashboardData, clientsData, operationsData, user, notifications }: { dashboardData: DashboardData; clientsData: ClientsData; operationsData: OperationsData; user: { name: string; email: string; role: string }; notifications: NotificationItem[] }) {
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
  const [collapsed, setCollapsed] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const isPartner = currentUser.role === "parceiro";

  useEffect(() => {
    const section = window.location.hash.replace("#", "");
    if (allowedSections.has(section) && !(isPartner && partnerRestrictedSections.has(section)))
      setActive(section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          if (payload.eventType === "INSERT" && systemSoundsEnabled) {
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
    if (isPartner && partnerRestrictedSections.has(id)) return;
    if (clientId) window.sessionStorage.setItem("contador-open-client", clientId);
    setActive(id);
    setMobile(false);
    setAccountMenuOpen(false);
    setNotificationOpen(false);
    window.history.replaceState(null, "", `#${id}`);
  }

  const initials = currentUser.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "OC";
  const unreadCount = currentNotifications.filter(item => item.unread).length;
  const visibleNavItems = isPartner ? navItems.filter(item => !partnerRestrictedSections.has(item.id)) : navItems;
  const activeNavIndex = visibleNavItems.findIndex(item => item.id === active);

  return <div className={`app-shell ${darkModeEnabled ? "dark-mode" : ""}`}>
    <div className="preview-banner"><span>HOMOLOGAÇÃO</span> Migração funcional em validação; a versão anterior permanece preservada.</div>
    {mobile && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobile(false)}/>} 
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}>
      <div className="brand"><button className="brand-mark" aria-label={collapsed?"Expandir menu lateral":"Recolher menu lateral"} onClick={() => setCollapsed(value=>!value)}><Image src="/logo.svg" alt="Símbolo Olá, Contador" width={29} height={30} priority/></button>{(!collapsed || mobile) && <div><strong>Olá, Contador</strong><small>Área profissional</small></div>}<Button aria-label="Fechar menu" className="icon ghost mobile-close" onClick={() => setMobile(false)}><X size={18}/></Button></div>
      <nav><span className="nav-indicator" aria-hidden="true" style={{ opacity: activeNavIndex < 0 ? 0 : 1, transform: `translateY(${Math.max(activeNavIndex, 0) * 53}px)` }}/>{visibleNavItems.map(({id,label,icon:Icon,badge}) => { const count = id === "notificacoes" ? unreadCount : id === "atendimento" ? dashboardData.unreadMessages : badge; return <button className={active===id?"active":""} key={id} onClick={() => navigate(id)} title={label} data-tooltip={label} aria-label={collapsed&&!mobile?label:undefined} aria-current={active===id?"page":undefined}><Icon size={21} strokeWidth={1.9}/>{(!collapsed || mobile) && <span>{label}</span>}{typeof count === "number" && count>0 && <Badge className="nav-count">{count > 99 ? "99+" : count}</Badge>}</button>; })}</nav>
    </aside>
    <main className="workspace"><header className="topbar"><Button aria-label="Abrir menu" className="icon ghost mobile-menu" onClick={() => setMobile(true)}><Menu size={20}/></Button><div className="topbar-actions"><div className="notification-wrap" ref={notificationRef}><Button aria-label="Abrir notificações" aria-expanded={notificationOpen} className={`icon floating-notification notification-button ${notificationOpen ? "is-open" : ""}`} onClick={() => { setNotificationOpen(value=>!value); setAccountMenuOpen(false); }}><Bell size={20}/>{unreadCount > 0 && <span className="top-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Button>{notificationOpen && <div className="notification-popover" role="dialog" aria-label="Notificações recentes"><div className="popover-title"><div><strong>Notificações</strong><small>{unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}</small></div><Badge>{currentNotifications.length}</Badge></div><div className="notification-list">{currentNotifications.length ? currentNotifications.slice(0,5).map(item => <button key={item.id} onClick={() => navigate(item.cliente_ref ? "atendimento" : "notificacoes", item.cliente_ref)} className={item.unread ? "unread" : ""}><span className="notification-dot"/><span><strong>{item.text}</strong><small>{item.time || (item.created_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at)) : "Agora")}</small></span></button>) : <div className="notification-empty">Nenhuma notificação por aqui.</div>}</div><button className="popover-footer" onClick={() => navigate("notificacoes")}>Ver todas as notificações <ChevronDown size={15}/></button></div>}</div><div className="account-menu-wrap" ref={accountMenuRef}><button className="account-glass" onClick={() => { setAccountMenuOpen(value=>!value); setNotificationOpen(false); }} aria-label={`Abrir menu de ${currentUser.name}`} aria-expanded={accountMenuOpen} aria-controls="account-popover"><div className="avatar">{initials}</div><div className="account-copy"><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div><ChevronDown className={accountMenuOpen?"rotated":""} size={15}/></button>{accountMenuOpen && <div className="account-popover" id="account-popover" role="menu"><div className="account-popover-head"><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div><button role="menuitem" onClick={() => navigate("perfil")}><UserRound size={16}/><span>Meu perfil</span></button>{!isPartner && <button role="menuitem" onClick={() => navigate("configuracoes")}><Settings size={16}/><span>Configurações</span></button>}<div className="account-menu-separator"/><form action={signOut}><button className="danger" role="menuitem" type="submit"><LogOut size={16}/><span>Sair com segurança</span></button></form></div>}</div></div></header><div className="workspace-scroll"><div className="view-transition" key={active}>{active === "dashboard" ? <DashboardView data={dashboardData} onNavigate={navigate}/> : active === "clientes" ? <ClientesView data={clientsData} operationsData={operationsData}/> : active === "atendimento" ? <AtendimentoView clientsData={clientsData} operationsData={operationsData}/> : active === "acompanhamento" ? <AcompanhamentoView data={operationsData} clientsData={clientsData}/> : active === "relatorios" ? (isPartner ? <DashboardView data={dashboardData} onNavigate={navigate}/> : <RelatoriosView data={operationsData}/>) : active === "agendamentos" ? <AgendamentosView data={operationsData}/> : active === "financeiro" ? (isPartner ? <DashboardView data={dashboardData} onNavigate={navigate}/> : <FinanceiroView data={operationsData}/>) : active === "radar" ? <RadarView data={operationsData}/> : active === "insights" ? <InsightsView data={operationsData} clientsData={clientsData}/> : active === "configuracoes" ? (isPartner ? <DashboardView data={dashboardData} onNavigate={navigate}/> : <ConfiguracoesView data={operationsData}/>) : active === "perfil" ? <PerfilView user={currentUser} data={operationsData} clientsData={clientsData} onUpdated={(name) => setCurrentUser(value => ({...value, name}))}/> : active === "notificacoes" ? <NotificacoesView notifications={currentNotifications} data={operationsData} clientsData={clientsData} onNotificationsChanged={setCurrentNotifications} onNavigate={navigate}/> : <DashboardView data={dashboardData} onNavigate={navigate}/>}</div></div></main>
    {feedback && <div className="action-toast" role="status"><CheckCircle2 size={17}/><span>{feedback}</span><button aria-label="Fechar aviso" onClick={()=>setFeedback("")}><X size={15}/></button></div>}
  </div>;
}
