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
  CalendarClock,
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
  MoreVertical,
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
  Smartphone,
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
  type ExpressItem,
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
  sendWhatsAppMessage,
  setCaixaPostalThreadStatus,
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
import { playNotificationChime, playTimerWarningSound } from "@/lib/notificationSound";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NotificationItem = {
  id: number;
  text: string;
  time: string | null;
  created_at: string | null;
  unread: boolean | null;
  cliente_ref: string | null;
};

export function OlaSymbol({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 616 640"
      fill="currentColor"
      className={`ola-logo-symbol ${className}`}
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path d="M287 64.93C289.21 64.66 293.62 64.17 296.94 64.02C300.27 63.86 303.61 64 306.94 64C310.28 64 313.61 64 316.94 64C320.28 64 323.61 64 326.94 64C330.28 64 333.61 64 336.94 64C340.28 64 343.62 63.84 346.94 64.02C350.27 64.19 353.59 64.51 356.87 65.06C360.15 65.61 363.34 66.69 366.61 67.32C369.88 67.95 373.24 68.15 376.5 68.83C379.75 69.51 382.94 70.52 386.15 71.4C389.37 72.29 392.57 73.22 395.77 74.17C398.96 75.12 402.16 76.05 405.32 77.11C408.48 78.17 411.62 79.3 414.73 80.51C417.83 81.71 420.93 82.97 423.97 84.32C427.02 85.67 430.02 87.13 433 88.61C435.98 90.1 438.94 91.65 441.87 93.22C444.81 94.79 447.75 96.38 450.62 98.06C453.5 99.74 456.33 101.5 459.14 103.3C461.94 105.11 464.71 106.97 467.44 108.88C470.17 110.79 472.85 112.78 475.52 114.77C478.19 116.76 480.8 118.83 483.46 120.85C486.12 122.86 488.88 124.74 491.45 126.86C494.02 128.97 496.48 131.24 498.9 133.52C501.32 135.81 503.65 138.2 505.99 140.58C508.32 142.96 510.72 145.29 512.9 147.8C515.08 150.31 517.05 153.01 519.09 155.65C521.12 158.29 523.1 160.97 525.11 163.63C527.12 166.29 529.21 168.89 531.13 171.62C533.04 174.34 534.84 177.16 536.61 179.98C538.38 182.8 540.17 185.63 541.75 188.56C543.34 191.48 544.86 194.47 546.12 197.54C547.38 200.62 548.52 203.79 549.32 207.01C550.12 210.23 550.69 213.56 550.92 216.86C551.14 220.17 551.09 223.56 550.68 226.85C550.27 230.14 549.39 233.39 548.46 236.58C547.52 239.77 546.42 242.95 545.07 245.98C543.71 249.02 542.19 252.03 540.34 254.78C538.5 257.53 536.28 260.08 534 262.5C531.71 264.91 529.26 267.21 526.65 269.27C524.04 271.32 521.26 273.24 518.35 274.83C515.44 276.41 512.31 277.65 509.19 278.79C506.06 279.93 502.86 280.99 499.61 281.67C496.37 282.36 493.01 282.91 489.71 282.89C486.42 282.86 483.08 282.21 479.83 281.53C476.58 280.85 473.35 279.89 470.21 278.8C467.07 277.72 463.91 276.55 460.98 275C458.05 273.45 455.26 271.54 452.64 269.51C450.02 267.47 447.56 265.17 445.26 262.77C442.96 260.37 440.83 257.78 438.84 255.11C436.84 252.45 435.15 249.56 433.3 246.79C431.45 244.02 429.73 241.14 427.74 238.48C425.75 235.82 423.58 233.27 421.33 230.81C419.09 228.35 416.68 226.04 414.27 223.73C411.87 221.42 409.45 219.12 406.9 216.97C404.36 214.83 401.7 212.8 399 210.86C396.29 208.92 393.5 207.09 390.65 205.35C387.8 203.62 384.89 201.98 381.92 200.47C378.95 198.96 375.92 197.56 372.84 196.29C369.76 195.03 366.61 193.91 363.45 192.87C360.28 191.83 357.06 190.95 353.84 190.08C350.63 189.21 347.43 188.16 344.15 187.64C340.88 187.13 337.51 187.11 334.19 187C330.86 186.89 327.52 187 324.19 187C320.85 187 317.52 186.99 314.19 187C310.85 187.01 307.5 186.8 304.19 187.08C300.88 187.35 297.59 187.95 294.33 188.64C291.08 189.33 287.87 190.29 284.67 191.22C281.47 192.14 278.25 193.03 275.12 194.17C272 195.31 268.94 196.67 265.92 198.08C262.9 199.48 259.89 200.93 257.01 202.59C254.12 204.25 251.36 206.14 248.62 208.03C245.88 209.92 243.22 211.93 240.56 213.95C237.91 215.96 235.23 217.95 232.71 220.13C230.19 222.31 227.77 224.62 225.44 227C223.12 229.39 220.87 231.86 218.76 234.43C216.64 237 214.69 239.72 212.76 242.43C210.83 245.14 208.87 247.86 207.16 250.71C205.44 253.56 203.94 256.55 202.45 259.53C200.96 262.51 199.53 265.52 198.22 268.59C196.92 271.65 195.7 274.76 194.64 277.92C193.57 281.07 192.54 284.26 191.83 287.5C191.11 290.75 190.95 294.12 190.34 297.39C189.72 300.66 188.69 303.86 188.14 307.14C187.58 310.42 187.19 313.75 187.03 317.07C186.88 320.38 186.86 323.76 187.21 327.06C187.55 330.36 188.46 333.6 189.09 336.86C189.73 340.13 190.34 343.41 191.01 346.67C191.68 349.93 192.21 353.23 193.1 356.44C193.98 359.64 195.15 362.79 196.34 365.9C197.53 369.01 198.85 372.08 200.26 375.09C201.68 378.11 203.2 381.08 204.82 383.99C206.44 386.9 208.18 389.75 209.99 392.55C211.81 395.34 213.7 398.1 215.71 400.75C217.72 403.4 219.84 405.99 222.07 408.46C224.29 410.94 226.84 413.14 229.07 415.6C231.29 418.07 234.24 420.36 235.44 423.26C236.64 426.15 236.53 429.76 236.25 433C235.97 436.23 234.64 439.46 233.78 442.68C232.92 445.9 231.99 449.11 231.11 452.32C230.22 455.53 229.06 458.71 228.46 461.97C227.87 465.22 226.54 469.23 227.51 471.85C228.49 474.46 231.62 477.29 234.29 477.66C236.97 478.03 240.54 475.43 243.57 474.07C246.6 472.71 249.51 471.03 252.47 469.51C255.43 467.99 258.41 466.48 261.35 464.92C264.3 463.36 267.2 461.72 270.14 460.15C273.08 458.59 275.98 456.91 279.01 455.53C282.03 454.15 285.09 452.55 288.29 451.88C291.49 451.2 294.91 451.45 298.23 451.47C301.55 451.49 304.88 451.91 308.21 452C311.54 452.08 314.88 452 318.21 452C321.55 452 324.88 452.01 328.21 452C331.55 451.99 334.9 452.21 338.21 451.93C341.52 451.65 344.81 451.04 348.06 450.33C351.31 449.62 354.5 448.61 357.7 447.67C360.9 446.74 364.11 445.83 367.25 444.71C370.38 443.58 373.48 442.33 376.5 440.93C379.52 439.53 382.47 437.95 385.37 436.33C388.28 434.7 391.13 432.97 393.95 431.18C396.76 429.39 399.58 427.6 402.24 425.6C404.9 423.6 407.43 421.41 409.92 419.2C412.41 416.98 414.84 414.69 417.17 412.31C419.5 409.94 421.81 407.51 423.92 404.94C426.03 402.37 427.91 399.6 429.85 396.89C431.79 394.18 433.61 391.39 435.55 388.67C437.48 385.96 439.31 383.15 441.46 380.61C443.61 378.08 445.96 375.68 448.44 373.47C450.92 371.26 453.58 369.2 456.35 367.36C459.12 365.53 462.03 363.83 465.05 362.45C468.07 361.08 471.28 360.09 474.47 359.13C477.65 358.16 480.88 357.1 484.15 356.65C487.42 356.2 490.82 356.12 494.11 356.44C497.39 356.76 500.65 357.72 503.86 358.59C507.07 359.47 510.32 360.39 513.36 361.69C516.41 363 519.38 364.61 522.16 366.43C524.93 368.25 527.54 370.38 530.01 372.61C532.47 374.83 534.83 377.23 536.96 379.78C539.09 382.33 541.11 385.03 542.78 387.89C544.46 390.75 545.8 393.85 547 396.95C548.2 400.05 549.31 403.24 549.98 406.48C550.64 409.73 550.86 413.09 550.99 416.41C551.11 419.73 551.16 423.12 550.72 426.4C550.29 429.69 549.4 432.94 548.4 436.1C547.39 439.27 546.1 442.37 544.68 445.38C543.26 448.39 541.59 451.29 539.89 454.15C538.19 457.01 536.34 459.79 534.47 462.55C532.6 465.31 530.69 468.05 528.68 470.71C526.68 473.37 524.51 475.9 522.44 478.51C520.36 481.12 518.33 483.76 516.25 486.37C514.17 488.97 512.15 491.63 509.95 494.13C507.75 496.63 505.39 499 503.04 501.36C500.69 503.72 498.33 506.09 495.84 508.3C493.34 510.5 490.68 512.51 488.07 514.59C485.47 516.67 482.84 518.71 480.23 520.79C477.61 522.86 475.1 525.06 472.41 527.02C469.72 528.99 466.9 530.77 464.11 532.59C461.31 534.4 458.48 536.17 455.64 537.91C452.79 539.64 449.93 541.35 447.02 542.98C444.11 544.61 441.16 546.15 438.2 547.68C435.24 549.22 432.29 550.78 429.28 552.19C426.26 553.6 423.18 554.88 420.1 556.14C417.01 557.41 413.91 558.62 410.78 559.77C407.65 560.92 404.5 562.01 401.33 563.05C398.17 564.09 394.98 565.06 391.78 566.02C388.59 566.97 385.41 568 382.18 568.81C378.95 569.61 375.68 570.24 372.41 570.85C369.13 571.46 365.82 571.85 362.55 572.47C359.28 573.1 356.08 574.19 352.79 574.61C349.5 575.03 346.13 574.94 342.8 575C339.47 575.06 336.13 575 332.8 575C329.47 575 326.13 575 322.8 575C319.47 575 316.13 575 312.8 575C309.47 575 306.13 575.02 302.8 575C299.47 574.98 296.11 575.15 292.8 574.86C289.5 574.56 286.23 573.82 282.96 573.22C279.68 572.62 276.43 571.88 273.16 571.25C269.89 570.62 266.58 570.17 263.33 569.43C260.09 568.7 256.89 567.73 253.67 566.85C250.46 565.98 247.22 565.17 244.04 564.17C240.86 563.18 237.74 562 234.6 560.87C231.47 559.74 228.33 558.62 225.23 557.38C222.14 556.15 219.06 554.85 216.03 553.47C213 552.08 210.03 550.58 207.05 549.07C204.08 547.56 201.13 546.02 198.2 544.42C195.28 542.82 192.36 541.2 189.5 539.48C186.65 537.77 183.84 535.97 181.05 534.15C178.26 532.32 175.49 530.46 172.78 528.53C170.06 526.59 167.42 524.56 164.77 522.55C162.11 520.53 159.47 518.49 156.86 516.42C154.25 514.35 151.59 512.34 149.08 510.14C146.58 507.94 144.21 505.59 141.84 503.24C139.48 500.9 137.11 498.54 134.88 496.07C132.64 493.6 130.56 491 128.46 488.41C126.36 485.82 124.36 483.15 122.28 480.55C120.19 477.95 117.98 475.45 115.94 472.81C113.9 470.18 111.94 467.48 110.03 464.75C108.12 462.02 106.27 459.24 104.48 456.43C102.69 453.62 100.96 450.77 99.28 447.89C97.6 445.01 95.94 442.12 94.4 439.16C92.85 436.21 91.44 433.19 90.03 430.17C88.61 427.15 87.23 424.12 85.91 421.06C84.6 418 83.37 414.9 82.14 411.8C80.92 408.7 79.67 405.6 78.56 402.46C77.46 399.32 76.47 396.13 75.52 392.94C74.57 389.74 73.61 386.55 72.84 383.31C72.07 380.07 71.61 376.75 70.9 373.5C70.19 370.24 69.11 367.05 68.58 363.77C68.05 360.49 68.13 357.12 67.72 353.82C67.31 350.51 66.64 347.24 66.12 343.95C65.6 340.66 64.95 337.38 64.61 334.07C64.26 330.76 64.14 327.42 64.04 324.09C63.94 320.76 63.93 317.42 64.01 314.09C64.08 310.76 64.11 307.41 64.5 304.11C64.89 300.81 65.8 297.57 66.36 294.29C66.91 291 67.47 287.71 67.83 284.41C68.19 281.1 68.04 277.72 68.53 274.44C69.02 271.15 70.04 267.95 70.78 264.7C71.53 261.45 72.16 258.17 73.01 254.95C73.86 251.73 74.89 248.56 75.88 245.37C76.87 242.19 77.9 239.02 78.98 235.87C80.06 232.71 81.16 229.57 82.37 226.46C83.58 223.36 84.9 220.3 86.23 217.24C87.55 214.18 88.86 211.11 90.29 208.1C91.72 205.09 93.25 202.13 94.83 199.19C96.41 196.26 98.04 193.35 99.75 190.49C101.47 187.64 103.32 184.86 105.12 182.06C106.93 179.25 108.71 176.43 110.57 173.67C112.44 170.91 114.36 168.18 116.32 165.49C118.29 162.8 120.33 160.16 122.36 157.52C124.4 154.88 126.37 152.19 128.53 149.65C130.69 147.11 133 144.71 135.31 142.31C137.62 139.9 139.99 137.55 142.38 135.23C144.77 132.91 147.15 130.56 149.67 128.39C152.18 126.21 154.87 124.22 157.49 122.16C160.11 120.1 162.73 118.04 165.39 116.04C168.06 114.03 170.75 112.07 173.47 110.14C176.18 108.21 178.92 106.31 181.7 104.46C184.48 102.62 187.27 100.79 190.13 99.09C192.99 97.38 195.95 95.83 198.88 94.25C201.82 92.67 204.75 91.09 207.74 89.61C210.72 88.13 213.75 86.73 216.79 85.37C219.83 84.01 222.91 82.72 226 81.47C229.09 80.22 232.21 79.04 235.32 77.86C238.44 76.69 241.53 75.41 244.71 74.41C247.89 73.42 251.15 72.72 254.38 71.89C257.61 71.06 260.82 70.15 264.08 69.45C267.33 68.74 270.64 68.3 273.91 67.66C277.18 67.03 281.52 66.11 283.7 65.66C285.88 65.2 284.79 65.2 287 64.93Z" />
      <circle cx="259.5" cy="307.5" r="27.5" />
      <circle cx="331.5" cy="307.5" r="27.5" />
      <circle cx="403.5" cy="307.5" r="27.5" />
    </svg>
  );
}

function feedback(message: string) {
  window.dispatchEvent(new CustomEvent("app-feedback", { detail: message }));
}

// Mapeia a aba visível do Radar Fiscal pros prefixos reais de id_sistema
// gravados em serpro_consultas (ver src/app/api/radar-fiscal/route.ts). Os
// nomes das abas nunca bateram com os códigos técnicos do SERPRO (SITFIS,
// PARCSN/PARCMEI, PGFN-SIDA), então o histórico ficava sempre vazio nelas.
const radarSistemasPorAba: Record<string, string[]> = {
  "Caixa Postal": ["CAIXAPOSTAL"],
  "Situação Fiscal": ["SITFIS"],
  Parcelamentos: ["PARCSN", "PARCMEI"],
  "Dívida Ativa": ["PGFN-SIDA"],
  CND: ["CND"],
};

const tabsByView: Record<string, string[]> = {
  agenda: [
    "Agenda do Dia",
    "Calendário Geral & Lista",
    "Disponibilidade & Consulta Manual",
  ],
  acompanhamento: ["Fila de Atendimento", "Acompanhamento"],
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
    "Integracoes",
    "Inteligência Artificial (AIA)",
    "Aparência do Chat",
    "Log do Sistema",
    "Integrações Externas",
    "Chaves de API",
  ],
};

export function PageTitle({
  title,
  badge,
  description,
  action,
}: {
  title: string;
  badge?: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="page-title-heading">
          <h1>{title}</h1>
          {badge}
        </div>
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
  const [taskFilter, setTaskFilter] = useState<"todas" | "pendentes" | "concluidas">("todas");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    texto: "",
    dataInicial: new Date().toISOString().slice(0, 10),
    dataFinal: new Date().toISOString().slice(0, 10),
  });
  const [taskPending, startTaskTransition] = useTransition();

  const todayIso = new Date().toISOString().slice(0, 10);

  function cleanTaskText(texto: string | null | undefined) {
    if (!texto) return "";
    return texto
      .replace(/\bSLA\s*vencido\b/gi, "Prazo vencido")
      .replace(/\bSLA\s*vence\b/gi, "Prazo vence")
      .replace(/\bAlerta\s*de\s*SLA\b/gi, "Alerta de prazo")
      .replace(/\bSLA\b/g, "Prazo")
      .replace(/\bsla\b/g, "prazo");
  }

  function formatShortDate(val: string | null) {
    if (!val) return "Sem data";
    try {
      const clean = val.includes("T") ? val.slice(0, 10) : val;
      const [year, month, day] = clean.split("-");
      if (day && month && year) return `${day}/${month}/${year}`;
      return new Date(val).toLocaleDateString("pt-BR");
    } catch {
      return val;
    }
  }

  function getDeadlineBadge(task: { feita: boolean; dataFinal: string | null }) {
    if (task.feita) {
      return (
        <span className="task-deadline-badge done">
          <Check size={11} /> Concluída
        </span>
      );
    }
    if (!task.dataFinal) {
      return <span className="task-deadline-badge sem-prazo">Sem prazo</span>;
    }
    const finalDate = task.dataFinal.includes("T") ? task.dataFinal.slice(0, 10) : task.dataFinal;
    if (finalDate < todayIso) {
      return (
        <span className="task-deadline-badge overdue">
          <AlertTriangle size={11} /> Prazo vencido ({formatShortDate(task.dataFinal)})
        </span>
      );
    }
    if (finalDate === todayIso) {
      return (
        <span className="task-deadline-badge today">
          <Clock3 size={11} /> Vence hoje
        </span>
      );
    }
    return (
      <span className="task-deadline-badge on-time">
        <Clock3 size={11} /> Prazo: {formatShortDate(task.dataFinal)}
      </span>
    );
  }

  const pendingTasksCount = tasks.filter((t) => !t.feita).length;
  const doneTasksCount = tasks.filter((t) => t.feita).length;
  const progressPercent = tasks.length > 0 ? Math.round((doneTasksCount / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === "pendentes") return !task.feita;
    if (taskFilter === "concluidas") return task.feita;
    return true;
  });

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
        title="Dashboard"
        badge={<span className="topbar-portal-badge">Área Profissional</span>}
        description="Faturamento, operação do dia, tarefas e guias mensais — nesta ordem."
        action={
          <Badge className={data.mode === "live" ? "success" : ""}>
            {data.mode === "live" ? "Dados ao vivo" : "Modo de prévia"}
          </Badge>
        }
      />
      {/* 1. FATURAMENTO */}
      <section>
        <div className="section-label">Faturamento</div>
        <div className="stats-grid billing-stats">
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

      {/* 2. OPERAÇÃO DO DIA */}
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

      {/* 3. TAREFAS E GESTÃO DE PROCESSOS */}
      <section className="dashboard-tasks-section">
        <div className="section-label">Tarefas e Gestão de Processos</div>
        <div className="tasks-dashboard-layout">
          {/* Card Principal: Gestão de Tarefas */}
          <Card className="task-manager-card">
            <div className="card-heading">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="task-heading-icon">
                  <ListChecks size={18} />
                </div>
                <div>
                  <strong>Tarefas & Ações Internas</strong>
                  <span className="task-heading-sub">Rotinas operacionais e prazos de entrega</span>
                </div>
              </div>
              <Button className="secondary compact" onClick={() => setTaskOpen(true)}>
                <Plus size={15} /> Nova tarefa
              </Button>
            </div>

            {/* Barra de Progresso & Filtros */}
            <div className="task-manager-toolbar">
              <div className="task-filter-pills">
                <button
                  type="button"
                  className={taskFilter === "todas" ? "active" : ""}
                  onClick={() => setTaskFilter("todas")}
                >
                  Todas ({tasks.length})
                </button>
                <button
                  type="button"
                  className={taskFilter === "pendentes" ? "active" : ""}
                  onClick={() => setTaskFilter("pendentes")}
                >
                  Pendentes ({pendingTasksCount})
                </button>
                <button
                  type="button"
                  className={taskFilter === "concluidas" ? "active" : ""}
                  onClick={() => setTaskFilter("concluidas")}
                >
                  Concluídas ({doneTasksCount})
                </button>
              </div>

              {tasks.length > 0 && (
                <div className="task-progress-wrap">
                  <div className="task-progress-text">
                    <span>{progressPercent}% concluído</span>
                    <small>{doneTasksCount} de {tasks.length}</small>
                  </div>
                  <div className="task-progress-bar">
                    <div className="task-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Lista Enriquecida de Tarefas */}
            <div className="task-list">
              {filteredTasks.map((task) => {
                const deadlineBadge = getDeadlineBadge(task);
                return (
                  <article className={`task-item-card ${task.feita ? "done" : ""}`} key={task.id}>
                    <button
                      type="button"
                      className={`task-checkbox-custom ${task.feita ? "checked" : ""}`}
                      aria-label={`Concluir ${cleanTaskText(task.texto)}`}
                      disabled={taskPending}
                      onClick={() => toggleTaskDone(task.id, !task.feita)}
                    >
                      {task.feita && <Check size={13} />}
                    </button>
                    <div className="task-item-content">
                      <div className="task-item-title-row">
                        <strong>{cleanTaskText(task.texto)}</strong>
                        {deadlineBadge}
                      </div>
                      <div className="task-item-meta-row">
                        <span className="task-meta-dates">
                          {task.dataInicial && (
                            <span>Início: {formatShortDate(task.dataInicial)}</span>
                          )}
                          {task.dataFinal && (
                            <span>Prazo de conclusão: {formatShortDate(task.dataFinal)}</span>
                          )}
                          {!task.dataInicial && !task.dataFinal && <span>Sem datas definidas</span>}
                        </span>

                        <div className="task-assignee-badge">
                          <UserRound size={13} />
                          <select
                            aria-label={`Responsável por ${cleanTaskText(task.texto)}`}
                            value={task.responsavelId || ""}
                            disabled={taskPending}
                            onChange={(event) => moveTask(task.id, event.target.value)}
                          >
                            <option value="">Sem responsável</option>
                            {data.staffList.map((member) => (
                              <option key={member.id} value={member.id}>{member.nome}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="task-delete-btn"
                      aria-label={`Excluir ${cleanTaskText(task.texto)}`}
                      disabled={taskPending}
                      onClick={() => removeTask(task.id)}
                      title="Excluir tarefa"
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                );
              })}
              {!filteredTasks.length && (
                <EmptyState>
                  {taskFilter === "concluidas"
                    ? "Nenhuma tarefa concluída ainda."
                    : taskFilter === "pendentes"
                    ? "Tudo em dia! Nenhuma tarefa pendente."
                    : "Nenhuma tarefa cadastrada. Clique em '+ Nova tarefa' para registrar."}
                </EmptyState>
              )}
            </div>
          </Card>

          {/* Card Lateral: Painel de Controle de Prazos & Processos */}
          <Card className="tasks-process-summary-card">
            <div className="card-heading">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="task-heading-icon orange">
                  <Clock3 size={18} />
                </div>
                <div>
                  <strong>Painel de Prazos do Processo</strong>
                  <span className="task-heading-sub">Indicadores de cumprimento e entregas</span>
                </div>
              </div>
            </div>

            <div className="process-metrics-grid">
              <div className="process-metric-box">
                <span className="process-metric-label">Atendimentos Express</span>
                <strong className="process-metric-val">{data.expressPending}</strong>
                <small className="process-metric-hint">Aguardando execução</small>
              </div>
              <div className="process-metric-box">
                <span className="process-metric-label">Guias do Mês</span>
                <strong className="process-metric-val">
                  {monthlyGuides.filter((g) => g.status !== "gerada").length}
                </strong>
                <small className="process-metric-hint">Pendentes de emissão</small>
              </div>
              <div className="process-metric-box">
                <span className="process-metric-label">Mensagens de Clientes</span>
                <strong className="process-metric-val">{data.unreadMessages}</strong>
                <small className="process-metric-hint">Dúvidas sem resposta</small>
              </div>
              <div className="process-metric-box">
                <span className="process-metric-label">Eficiência de Prazos</span>
                <strong className="process-metric-val">
                  {tasks.length > 0 ? `${progressPercent}%` : "100%"}
                </strong>
                <small className="process-metric-hint">Tarefas concluídas</small>
              </div>
            </div>

            <div className="process-guidance-box">
              <div className="process-guidance-title">
                <Sparkles size={15} />
                <span>Gestão de Prazos e Entregas</span>
              </div>
              <p>
                Acompanhe as datas finais dos processos para assegurar que relatórios, guias e consultorias sejam entregues dentro do prazo acordado com seus clientes.
              </p>
            </div>

            <Button
              className="secondary full process-shortcut-btn"
              onClick={() => onNavigate?.("acompanhamento")}
            >
              Abrir Esteira de Processos <ArrowUpRight size={15} />
            </Button>
          </Card>
        </div>
      </section>

      {/* 4. GUIAS MENSAIS */}
      <section>
        <div className="section-label">Guias mensais</div>
        <Card className="task-manager-card">
          <div className="card-heading">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="task-heading-icon">
                <ReceiptText size={18} />
              </div>
              <div>
                <strong>Obrigações dos clientes recorrentes</strong>
                <span className="task-heading-sub">Controle de emissão de guias e impostos</span>
              </div>
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
      {taskOpen && (
        <div className="dialog-backdrop">
          <Card className="profile-dialog compact" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div>
                <h2>Nova tarefa interna</h2>
                <p>Registre uma ação interna definindo início e prazo limite de entrega.</p>
              </div>
              <Button className="icon ghost" onClick={() => setTaskOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="profile-form">
              <label>
                Descrição da tarefa / processo
                <Input
                  autoFocus
                  value={taskForm.texto}
                  onChange={(event) =>
                    setTaskForm({ ...taskForm, texto: event.target.value })
                  }
                  placeholder="Ex.: Revisar documentação fiscal de abertura — Cliente XYZ"
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
                  Prazo limite de entrega
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
  const [tool, setTool] = useState<"fila" | "copilot" | "whatsapp">("fila");
  const [mobileChatView, setMobileChatView] = useState<"queue" | "chat" | "copilot">("queue");
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
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
  const selectedTriage =
    clientsData.triages.find((t) => t.cliente_ref === selectedClientId && t.status !== "finalizada") ||
    clientsData.triages.find((t) => t.cliente_ref === selectedClientId) ||
    null;
  const selectedAssunto =
    selectedTriage?.assunto ||
    selectedClient?.treatment ||
    selectedClient?.diagnosis ||
    "Atendimento Geral";
  const selectedProtocolo =
    selectedTriage?.id
      ? String(selectedTriage.id).padStart(4, "0")
      : (selectedClient ? String(selectedClient.id).replace(/\D/g, "").slice(0, 6) || "2026-001" : "2026-001");
  const selectedMessages = messages
    .filter((item) => item.cliente_id === selectedClientId && (tool === "whatsapp" ? item.canal === "whatsapp" : item.canal !== "whatsapp"))
    .sort((a, b) => a.seq - b.seq);
  const whatsappConversas = clientsData.clients
    .map((client) => {
      const msgs = messages.filter((m) => m.cliente_id === client.id && m.canal === "whatsapp").sort((a, b) => a.seq - b.seq);
      const unread = msgs.filter((m) => m.sender === "client" && !m.read_at).length;
      return { client, last: msgs[msgs.length - 1], unread };
    })
    .filter((item) => item.last)
    .sort((a, b) => new Date(b.last?.created_at || 0).getTime() - new Date(a.last?.created_at || 0).getTime());
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
    if (timerConfig.avisoSonoro) playTimerWarningSound();
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
          if (incoming.sender === "client" && systemSoundsEnabled) playNotificationChime();
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
    setMobileChatView("chat");
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
    if (!selectedClientId || !messageText.trim() || (chatLocked && tool !== "whatsapp")) return;
    const value = messageText;
    setMessageText("");
    startSending(async () => {
      const result = tool === "whatsapp"
        ? await sendWhatsAppMessage({ clientId: selectedClientId, text: value })
        : await sendMessage({ clientId: selectedClientId, text: value });
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
      const result = await sendAudioMessage({
        clientId: selectedClientId,
        fileName,
        duration: duracao,
        canal: tool === "whatsapp" ? "whatsapp" : "web",
      });
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
    const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name);
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type) && !isAudio) {
      feedback("Envie um PDF, PNG, JPEG ou arquivo de áudio.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      feedback("O arquivo deve ter no máximo 20 MB.");
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
        .upload(path, file, { contentType: file.type || (isAudio ? "audio/webm" : "application/octet-stream"), upsert: false });
      if (storageError) throw storageError;
      const { data: document, error: recordError } = await supabase
        .from("documentos")
        .insert({
          cliente_ref: selectedClientId,
          file_name: file.name,
          mime: file.type || (isAudio ? "audio/webm" : "application/octet-stream"),
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
      if (isAudio) {
        const audioMsg = await sendAudioMessage({
          clientId: selectedClientId,
          fileName: file.name,
          duration: "Áudio",
          canal: tool === "whatsapp" ? "whatsapp" : "web",
        });
        if (audioMsg.ok) {
          setChatDocuments((items) => [document, ...items]);
          setMessages((items) =>
            items.some((item) => item.id === audioMsg.data.id)
              ? items
              : [...items, audioMsg.data],
          );
        }
        feedback(audioMsg.message);
      } else {
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
      }
    } catch {
      feedback("Não foi possível anexar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function selectTool(nextTool: "fila" | "copilot" | "whatsapp") {
    if (tool === nextTool) {
      setPanelCollapsed((value) => !value);
      return;
    }
    setTool(nextTool);
    setPanelCollapsed(false);
    if (nextTool !== tool) setSelectedClientId(null);
    if (nextTool === "copilot") {
      setMobileChatView("copilot");
    } else {
      setMobileChatView("queue");
    }
  }

  return (
    <div
      className={`chat-layout tool-${tool} ${panelCollapsed ? "queue-collapsed" : ""} ${chatAppearance.dark ? "chat-dark" : ""} mobile-view-${mobileChatView}`}
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
          <MessageCircle size={20} />
          <span>Fila</span>
        </button>
        <button
          className={tool === "whatsapp" && !panelCollapsed ? "active" : ""}
          onClick={() => selectTool("whatsapp")}
          aria-label="WhatsApp"
          data-tooltip="WhatsApp"
        >
          <Smartphone size={20} />
          <span>WhatsApp</span>
        </button>
        <button
          className={tool === "copilot" && !panelCollapsed ? "active" : ""}
          onClick={() => selectTool("copilot")}
          aria-label="Copiloto IA"
          data-tooltip="Copiloto IA"
        >
          <OlaSymbol size={20} />
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
        aria-label={tool === "fila" ? "Fila de atendimento" : tool === "whatsapp" ? "WhatsApp" : "Copiloto IA"}
      >
        {tool === "whatsapp" ? (
          <>
            <div className="side-panel-heading">
              <div>
                <strong>WhatsApp</strong>
                <small>Conversas recebidas pelo número da empresa</small>
              </div>
            </div>
            <div className="queue-content">
              {whatsappConversas.length ? (
                <div className="queue-real-list">
                  {whatsappConversas.map(({ client, last, unread }) => (
                    <button
                      className={selectedClientId === client.id ? "selected" : ""}
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className="avatar small">{client.name.slice(0, 2).toUpperCase()}</div>
                      <span>
                        <strong>{client.name}</strong>
                        <small>{last?.text || "Mensagem"}</small>
                      </span>
                      {unread > 0 && <Badge className="attention">{unread}</Badge>}
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState>Nenhuma conversa por WhatsApp ainda.</EmptyState>
              )}
            </div>
          </>
        ) : tool === "fila" ? (
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
                  <OlaSymbol size={16} /> Copiloto IA
                </strong>
                <small>Apoio durante o atendimento</small>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Badge className="attention">IA</Badge>
                <button
                  type="button"
                  className="mobile-copilot-close-btn"
                  onClick={() => setMobileChatView(selectedClientId ? "chat" : "queue")}
                  aria-label="Fechar copiloto"
                >
                  <X size={16} />
                </button>
              </div>
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
                  <OlaSymbol size={16} />
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
              <button
                type="button"
                disabled={copilotLoading || !selectedClient || !copilotPrompt.trim()}
                className="copilot-send-btn"
                aria-label="Enviar ao copiloto"
                title="Consultar Copiloto IA"
                onClick={() => askCopilot("pergunta")}
              >
                <Sparkles size={15} />
              </button>
            </div>
          </>
        )}
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <button
            type="button"
            className="chat-back-mobile-btn"
            onClick={() => {
              setMobileChatView("queue");
              setMobileActionsOpen(false);
            }}
            aria-label="Voltar para a lista de conversas"
            title="Voltar para a fila"
          >
            <ChevronLeft size={20} />
          </button>
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
              {selectedClient?.cpf ||
                selectedClient?.email ||
                "Atendimento ativo"}
            </small>
          </div>

          {/* Ações Mobile: Timer compacto + Menu 3 pontinhos */}
          {tool !== "whatsapp" && <div className="chat-actions-mobile">
            <div className={`timer-capsule compact ${timerRunning ? "running" : ""}`}>
              <Clock3 size={13} />
              <strong>{formattedElapsed}</strong>
              <button
                disabled={!selectedClient}
                onClick={toggleTimer}
                aria-label={timerRunning ? "Pausar cronômetro" : "Iniciar cronômetro"}
              >
                {timerRunning ? <Pause size={12} /> : <Play size={12} />}
              </button>
            </div>

            <div className="mobile-chat-menu-wrap">
              <button
                type="button"
                className={`chat-action-button mobile-menu-trigger ${mobileActionsOpen ? "active" : ""}`}
                onClick={() => setMobileActionsOpen((v) => !v)}
                aria-label="Mais opções de atendimento"
                title="Mais opções"
              >
                <MoreVertical size={17} />
              </button>

              {mobileActionsOpen && (
                <>
                  <div
                    className="mobile-chat-menu-backdrop"
                    onClick={() => setMobileActionsOpen(false)}
                  />
                  <div className="mobile-chat-menu-popover" role="menu">
                    <div className="mobile-chat-menu-head">
                      <strong>Ações do Atendimento</strong>
                      <small>{selectedClient?.name || "Cliente"}</small>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileActionsOpen(false);
                        setMobileChatView("copilot");
                      }}
                      role="menuitem"
                    >
                      <OlaSymbol size={16} />
                      <span>Copiloto IA</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSending || !selectedClient}
                      onClick={() => {
                        setMobileActionsOpen(false);
                        toggleChatLock();
                      }}
                      role="menuitem"
                    >
                      {chatLocked ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}
                      <span>{chatLocked ? "Desbloquear Chat" : "Bloquear Chat"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSending || !selectedClient}
                      onClick={() => {
                        setMobileActionsOpen(false);
                        changeStage("followup");
                      }}
                      role="menuitem"
                    >
                      <ListChecks size={16} />
                      <span>Enviar p/ Acompanhamento</span>
                    </button>

                    <button
                      type="button"
                      disabled={!selectedClient || elapsed === 0}
                      onClick={() => {
                        setMobileActionsOpen(false);
                        resetTimer();
                      }}
                      role="menuitem"
                    >
                      <RotateCcw size={16} />
                      <span>Zerar Cronômetro</span>
                    </button>

                    <div className="mobile-chat-menu-divider" />

                    <button
                      type="button"
                      className="danger-item"
                      disabled={isSending || !selectedClient || chatLocked}
                      onClick={() => {
                        setMobileActionsOpen(false);
                        changeStage("finish");
                      }}
                      role="menuitem"
                    >
                      <CircleCheckBig size={16} />
                      <span>Encerrar Atendimento</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>}

          {/* Ações Desktop (barra completa tradicional) */}
          {tool !== "whatsapp" && <div className="chat-actions chat-actions-desktop">
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
          </div>}
        </header>
        {selectedClient && tool !== "whatsapp" && (
          <div className="chat-assunto-faixa">
            <div className="chat-assunto-info">
              <span className="chat-assunto-tag">Caso:</span>
              <strong className="chat-assunto-nome" title={selectedAssunto}>
                {selectedAssunto}
              </strong>
            </div>
            <span className="chat-assunto-sep">·</span>
            <span className="chat-assunto-protocolo">Protocolo: #OC-{selectedProtocolo}</span>
          </div>
        )}
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
                  {item.type === "audio" && item.transcricao && (
                    <p className="chat-audio-transcricao">&ldquo;{item.transcricao}&rdquo;</p>
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
          {tool !== "whatsapp" && <div className="chat-shortcuts" aria-label="Atalhos de mensagem">
            {chatShortcuts.map((shortcut) => (
              <button key={shortcut.id} disabled={!selectedClient || isSending || chatLocked} onClick={() => useChatShortcut(shortcut)}>
                {shortcut.label}
              </button>
            ))}
            <button
              type="button"
              className="shortcut-mic-pill"
              disabled={!selectedClient || isSending || chatLocked || recording}
              onClick={() => void startRecording()}
              title="Gravar mensagem de áudio pelo microfone"
            >
              <Mic size={13} /> Gravar áudio
            </button>
          </div>}
          {tool !== "whatsapp" && <Button
            className="icon ai-assist"
            title="Pedir sugestão ao Copiloto IA"
            aria-label="Pedir sugestão ao Copiloto IA"
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
            <OlaSymbol size={18} />
          </Button>}
          {tool !== "whatsapp" && <input
            ref={attachmentRef}
            className="sr-only"
            type="file"
            accept="application/pdf,image/png,image/jpeg,audio/*"
            onChange={uploadAttachment}
          />}
          {tool !== "whatsapp" && <Button
            className="icon secondary"
            title="Anexar arquivo ou áudio"
            aria-label="Anexar arquivo ou áudio"
            disabled={!selectedClient || uploading || recording}
            onClick={() => attachmentRef.current?.click()}
          >
            {uploading ? <Upload size={17} /> : <Paperclip size={17} />}
          </Button>}
          {recording ? (
            <div className="composer-recording-bar">
              <span className="recording-rec-dot" aria-hidden="true" />
              <span className="recording-status-text">Gravando áudio...</span>
              <span className="recording-waveform" aria-hidden="true">
                <span className="recording-waveform-bar" />
                <span className="recording-waveform-bar" />
                <span className="recording-waveform-bar" />
                <span className="recording-waveform-bar" />
              </span>
              <span className="chat-recording-time">
                {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
              </span>
              <button
                type="button"
                className="chat-recording-stop-btn"
                disabled={isSending}
                onClick={stopRecording}
                title="Parar gravação e enviar áudio"
                aria-label="Parar gravação e enviar áudio"
              >
                <Square size={10} fill="currentColor" />
                <span>Parar e Enviar</span>
              </button>
            </div>
          ) : (
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
                chatLocked && tool !== "whatsapp" ? "Chat bloqueado" : "Digite uma mensagem..."
              }
              disabled={!selectedClient || (chatLocked && tool !== "whatsapp") || isSending}
            />
          )}
          {!recording && (
            <Button
              type="button"
              className="icon secondary"
              disabled={!selectedClient || (chatLocked && tool !== "whatsapp") || isSending || !!messageText.trim()}
              onClick={() => void startRecording()}
              title={messageText.trim() ? "Apague o texto para gravar áudio" : "Gravar mensagem de áudio pelo microfone"}
              aria-label="Gravar áudio pelo microfone"
            >
              <Mic size={17} />
            </Button>
          )}
          <Button
            className="icon orange-action"
            aria-label="Enviar mensagem"
            onClick={submitMessage}
            disabled={
              !selectedClient || (chatLocked && tool !== "whatsapp") || isSending || !messageText.trim() || recording
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
  podeVoltarPagina,
  onProximaPagina,
  onPaginaAnterior,
}: {
  result: RadarPayload;
  clientDocument: string;
  onAction: (action: string, extra: RadarPayload) => void;
  busy: boolean;
  podeVoltarPagina?: boolean;
  onProximaPagina?: () => void;
  onPaginaAnterior?: () => void;
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
      <div className="radar-result-list">
        <div className="radar-origem-info">
          {result.cacheado
            ? `Dados salvos${result.obtidoEm ? ` de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(result.obtidoEm)))}` : ""} — sem custo de consulta.`
            : "Consulta feita agora ao SERPRO — consumiu uma requisição paga."}
        </div>
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
      </div>
    );
  const ehResultadoDeCaixaPostal = typeof result.naoLidas !== "undefined";
  if (messages.length || ehResultadoDeCaixaPostal)
    return (
      <div className="radar-result-list">
        {ehResultadoDeCaixaPostal && (
          <div className="radar-origem-info">
            {result.cacheado
              ? `Dados salvos${result.obtidoEm ? ` de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(result.obtidoEm)))}` : ""} — sem custo de consulta.`
              : "Consulta feita agora ao SERPRO — consumiu uma requisição paga."}
          </div>
        )}
        {messages.length ? (
          messages.map((item, index) => (
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
          ))
        ) : (
          <EmptyState>Nenhuma mensagem na Caixa Postal para esse CPF/CNPJ.</EmptyState>
        )}
        <div className="radar-result-actions">
          <Button
            className="secondary compact"
            disabled={busy || !podeVoltarPagina}
            onClick={() => onPaginaAnterior?.()}
          >
            Página anterior
          </Button>
          <Button
            className="secondary compact"
            disabled={busy || !result.temProxima}
            onClick={() => onProximaPagina?.()}
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarPayload | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const [detail, setDetail] = useState<RadarPayload | null>(null);
  // Paginação da Caixa Postal é por ponteiro (cursor), não por número —
  // essa pilha guarda os ponteiros já visitados pra permitir "página anterior".
  const [caixaPostalPilha, setCaixaPostalPilha] = useState<(string | null)[]>([]);
  const [caixaPostalPonteiroAtual, setCaixaPostalPonteiroAtual] = useState<string | null>(null);
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
      (radarSistemasPorAba[tab] || []).some((prefixo) =>
        item.id_sistema.startsWith(prefixo),
      ),
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
  async function caixaPostalProximaPagina() {
    const proximo = result?.ponteiroProximaPagina as string | undefined;
    if (!proximo) return;
    setLoading(true);
    setError("");
    try {
      const payload = await callRadar("caixa-postal", { ponteiroPagina: proximo, forcar: true });
      setCaixaPostalPilha((pilha) => [...pilha, caixaPostalPonteiroAtual]);
      setCaixaPostalPonteiroAtual(proximo);
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a próxima página.");
    } finally {
      setLoading(false);
    }
  }
  async function caixaPostalPaginaAnterior() {
    if (!caixaPostalPilha.length) return;
    const pilha = [...caixaPostalPilha];
    const anterior = pilha.pop() ?? null;
    setLoading(true);
    setError("");
    try {
      const payload = anterior
        ? await callRadar("caixa-postal", { ponteiroPagina: anterior, forcar: true })
        : await callRadar("caixa-postal");
      setCaixaPostalPilha(pilha);
      setCaixaPostalPonteiroAtual(anterior);
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível voltar a página.");
    } finally {
      setLoading(false);
    }
  }
  async function execute() {
    if (!selected) {
      feedback("Selecione um cliente com procuração eletrônica.");
      return;
    }
    if (tab === "Parcelamentos" && (selected.cpf || "").replace(/\D/g, "").length !== 14) {
      feedback("O Integra Contador só atende parcelamento de CNPJ (Simples Nacional/MEI) — o SERPRO ainda não aceita e-CPF nessa API.");
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
      let regimeParaConsulta = regime;
      // O regime (MEI/Simples) não é mais escolhido na mão — se ainda não
      // foi detectado pra esse cliente, detecta agora (consulta CCMEI) e
      // salva no cadastro, pra próxima vez já vir pronto.
      if (tab === "Parcelamentos" && !regimeParaConsulta) {
        const deteccao = await callRadar("regime");
        regimeParaConsulta = String(deteccao.regime || "");
        setRegime(regimeParaConsulta);
      }
      const actions: Record<string, string> = {
        "Caixa Postal": "caixa-postal",
        "Situação Fiscal": "situacao-fiscal",
        Parcelamentos: "parcelamentos",
        "Dívida Ativa": "divida-ativa",
        CND: "cnd",
      };
      const payload: RadarPayload = await callRadar(actions[tab], {
        regime: regimeParaConsulta || undefined,
        forcar: true,
      });
      setCaixaPostalPilha([]);
      setCaixaPostalPonteiroAtual(null);
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
  const servicoCacheavelPorAba: Record<string, string> = {
    "Caixa Postal": "caixa-postal",
    "Situação Fiscal": "situacao-fiscal",
    Parcelamentos: "parcelamentos",
    "Dívida Ativa": "divida-ativa",
  };
  async function verDadosSalvos() {
    const servico = servicoCacheavelPorAba[tab];
    if (!selected || !servico) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/radar-fiscal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "cache", clienteRef: selectedId }),
      });
      const data = (await response.json().catch(() => ({ resultados: [] }))) as {
        resultados?: Array<{ servico: string; resultado: unknown; obtido_em: string }>;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Falha ao buscar dados salvos.");
      const achado = (data.resultados || []).find((item) => item.servico === servico);
      if (!achado) {
        setResult(null);
        setError('Nenhuma consulta salva ainda pra esse serviço — use "Nova consulta".');
        return;
      }
      setCaixaPostalPilha([]);
      setCaixaPostalPonteiroAtual(null);
      setResult({ ...(achado.resultado as object), cacheado: true, obtidoEm: achado.obtido_em });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível buscar os dados salvos.");
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
        {tab === "Parcelamentos" && selected && (
          <p className="muted radar-regime-info">
            {regime === "mei"
              ? "Regime detectado: MEI (parcelas liberadas todo dia 1º)."
              : regime === "simples"
                ? "Regime detectado: Simples Nacional (parcelas liberadas todo dia 10)."
                : "Regime ainda não detectado — a primeira consulta identifica automaticamente."}
          </p>
        )}
        {servicoCacheavelPorAba[tab] ? (
          <div className="radar-options">
            <Button disabled={loading || !selected} onClick={execute}>
              {loading ? <Clock3 size={16} /> : <ShieldCheck size={16} />}{" "}
              {loading ? "Consultando…" : "Nova consulta"}
            </Button>
            <Button className="secondary" disabled={loading || !selected} onClick={() => void verDadosSalvos()}>
              <ClipboardList size={16} /> Ver dados salvos
            </Button>
          </div>
        ) : (
          <Button disabled={loading || !selected} onClick={execute}>
            {loading ? <Clock3 size={16} /> : <ShieldCheck size={16} />}{" "}
            {loading ? "Consultando…" : labels[tab]}
          </Button>
        )}
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
            podeVoltarPagina={caixaPostalPilha.length > 0}
            onProximaPagina={() => void caixaPostalProximaPagina()}
            onPaginaAnterior={() => void caixaPostalPaginaAnterior()}
          />
        )}
        {detail && (
          <div className="radar-detail-result">
            <div className="card-heading">
              <strong>{detail.detalhe ? "Mensagem" : "Detalhe da consulta"}</strong>
              <Button className="icon ghost" onClick={() => setDetail(null)} aria-label="Fechar detalhe">
                <X size={15} />
              </Button>
            </div>
            {detail.detalhe && typeof detail.detalhe === "object" && "corpoHtml" in (detail.detalhe as object) ? (
              (() => {
                const mensagem = detail.detalhe as {
                  assunto?: string;
                  remetente?: string | null;
                  dataEnvio?: string | null;
                  dataLeitura?: string | null;
                  corpoHtml?: string;
                };
                const formatarData = (iso?: string | null) =>
                  iso
                    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
                    : null;
                return (
                  <div className="radar-mensagem-leitura">
                    <strong>{mensagem.assunto || "Mensagem da Receita Federal"}</strong>
                    <div className="radar-mensagem-meta">
                      {mensagem.remetente && <span>De: {mensagem.remetente}</span>}
                      {formatarData(mensagem.dataEnvio) && <span>Enviada em {formatarData(mensagem.dataEnvio)}</span>}
                      {formatarData(mensagem.dataLeitura) && <span>Lida em {formatarData(mensagem.dataLeitura)}</span>}
                      <span>{detail.cacheado ? "Dados salvos — sem custo" : "Consultada agora ao SERPRO"}</span>
                    </div>
                    <div
                      className="radar-mensagem-corpo"
                      dangerouslySetInnerHTML={{ __html: mensagem.corpoHtml || "<p>Sem conteúdo.</p>" }}
                    />
                  </div>
                );
              })()
            ) : (
              <RadarResult
                result={detail}
                clientDocument={selected?.cpf?.replace(/\D/g, "") || ""}
                onAction={(action, extra) => void executeSubAction(action, extra)}
                busy={loading}
              />
            )}
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
                {item.sucesso && servicoCacheavelPorAba[tab] && (
                  <Button className="secondary compact" disabled={loading} onClick={() => void verDadosSalvos()}>
                    Ver resultado
                  </Button>
                )}
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
  const [funil, setFunil] = useState<{ iniciou: number; cobrancaGerada: number; conversaoConcluida: number } | null>(null);
  const [funilLoading, setFunilLoading] = useState(true);
  useEffect(() => {
    setFunilLoading(true);
    const params = new URLSearchParams();
    if (start) params.set("from", start.toISOString());
    if (end) params.set("to", end.toISOString());
    fetch(`/api/insights/funnel?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("funnel_unavailable");
        return response.json();
      })
      .then((result: { estagios: { iniciou: number; cobrancaGerada: number; conversaoConcluida: number } }) => setFunil(result.estagios))
      .catch(() => setFunil(null))
      .finally(() => setFunilLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dateFrom, dateTo]);
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
      <Card className="funnel-insights-card">
        <div className="card-heading">
          <div>
            <ArrowUpRight size={18} />
            <strong>Funil de conversão</strong>
          </div>
          <Badge className="success">Dados internos</Badge>
        </div>
        {funilLoading ? (
          <EmptyState>Carregando funil…</EmptyState>
        ) : !funil || funil.iniciou + funil.cobrancaGerada + funil.conversaoConcluida === 0 ? (
          <EmptyState>Nenhum evento de funil registrado nesse período.</EmptyState>
        ) : (
          <div className="funnel-stages">
            {(() => {
              const estagios = [
                { label: "Iniciaram checkout ou agendamento", value: funil.iniciou },
                { label: "Cobrança gerada", value: funil.cobrancaGerada },
                { label: "Conversão concluída", value: funil.conversaoConcluida },
              ];
              const topo = estagios[0].value || 1;
              return estagios.map((estagio, index) => {
                const largura = Math.round((estagio.value / topo) * 100);
                const anterior = index > 0 ? estagios[index - 1].value : null;
                const taxaEtapa = anterior ? Math.round((estagio.value / anterior) * 100) : null;
                return (
                  <div className="funnel-stage-row" key={estagio.label}>
                    <div className="funnel-stage-label">
                      <strong>{estagio.label}</strong>
                      <span>
                        {estagio.value}
                        {taxaEtapa !== null && ` · ${taxaEtapa}% da etapa anterior`}
                      </span>
                    </div>
                    <div className="funnel-stage-bar-track">
                      <div className="funnel-stage-bar-fill" style={{ width: `${estagio.value ? Math.max(largura, 4) : 0}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </Card>
    </div>
  );
}

const MAIL_ASSUNTO_SEM_CATEGORIA = "Outro assunto";

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
  const [statusPending, startStatusTransition] = useTransition();
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
          setMail((items) => items.map((item) => (item.id === updated.id ? { ...item, lida: updated.lida, status: updated.status, encerrado_em: updated.encerrado_em } : item)));
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
  // Não existe thread_id no banco — o assunto agrupa as mensagens em
  // "conversas", igual à Caixa Postal do cliente. O status "aberto"/
  // "encerrado" mostrado é o da última mensagem do grupo.
  const threadGroups = Object.values(
    thread.reduce<Record<string, MailItem[]>>((acc, item) => {
      const chave = item.assunto || MAIL_ASSUNTO_SEM_CATEGORIA;
      (acc[chave] ||= []).push(item);
      return acc;
    }, {}),
  ).sort((a, b) => new Date(b[b.length - 1].created_at).getTime() - new Date(a[a.length - 1].created_at).getTime());
  function toggleThreadStatus(assunto: string, currentStatus: string) {
    if (!selected) return;
    const nextStatus = currentStatus === "encerrado" ? "aberto" : "encerrado";
    startStatusTransition(async () => {
      const result = await setCaixaPostalThreadStatus({ clientId: selected, assunto, status: nextStatus });
      if (result.ok) {
        setMail((items) =>
          items.map((item) =>
            item.cliente_ref === selected && (item.assunto || MAIL_ASSUNTO_SEM_CATEGORIA) === assunto
              ? { ...item, status: nextStatus, encerrado_em: nextStatus === "encerrado" ? new Date().toISOString() : null }
              : item,
          ),
        );
      }
      feedback(result.message);
    });
  }
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
                const abertos = Object.values(
                  mail
                    .filter((item) => item.cliente_ref === id)
                    .reduce<Record<string, MailItem[]>>((acc, item) => {
                      const chave = item.assunto || MAIL_ASSUNTO_SEM_CATEGORIA;
                      (acc[chave] ||= []).push(item);
                      return acc;
                    }, {}),
                ).filter((grupo) => grupo[grupo.length - 1].status !== "encerrado").length;
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
                    {abertos > 0 && (
                      <span className="portal-tile-badge pending">{abertos} em aberto</span>
                    )}
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
                  {threadGroups.map((grupo) => {
                    const assunto = grupo[0].assunto || MAIL_ASSUNTO_SEM_CATEGORIA;
                    const ultima = grupo[grupo.length - 1];
                    const encerrado = ultima.status === "encerrado";
                    return (
                      <div className="mail-thread-group" key={assunto}>
                        <div className="mail-thread-group-header">
                          <strong>{assunto}</strong>
                          <span className={`portal-tile-badge ${encerrado ? "ok" : "pending"}`}>{encerrado ? "Encerrado" : "Em aberto"}</span>
                          <Button className="secondary" disabled={statusPending} onClick={() => toggleThreadStatus(assunto, ultima.status)}>
                            {encerrado ? <UnlockKeyhole size={13} /> : <LockKeyhole size={13} />}
                            <span>{encerrado ? "Reabrir" : "Encerrar"}</span>
                          </Button>
                        </div>
                        {grupo.map((item) => (
                          <article
                            className={`chat-message ${item.remetente === "cliente" ? "client" : "agent"}`}
                            key={item.id}
                          >
                            <div>
                              <p>{item.mensagem}</p>
                              <small>
                                {new Date(item.created_at).toLocaleString("pt-BR")}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    );
                  })}
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
  "Log do Sistema": [
    "Log do Sistema",
    "Erros e eventos de integrações — pra detectar problemas antes do cliente reclamar.",
    ["Erros registrados", "Eventos de webhook"],
  ],
  "Integrações Externas": [
    "Integrações Externas",
    "Conexão e credenciais dos serviços externos que o sistema depende pra funcionar de verdade.",
    ["SERPRO — Integra Contador", "Certificado digital e-CNPJ"],
  ],
  "Chaves de API": [
    "Chaves de API",
    "Credenciais de integrações editáveis por aqui — trocam na hora, sem depender de redeploy.",
    ["Inteligência Artificial"],
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
    checkoutCartaoTransparente: false,
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
  const [systemErrors, setSystemErrors] = useState<Array<{
    id: number;
    origem: string;
    codigo: string | null;
    mensagem: string;
    severidade: string;
    ocorrencias: number;
    primeiro_em: string;
    ultimo_em: string;
    rota: string | null;
  }>>([]);
  const [systemErrorsLoaded, setSystemErrorsLoaded] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<Array<{
    id: number;
    provedor: string;
    tipo: string | null;
    status: string;
    erro: string | null;
    recebido_em: string;
    processado_em: string | null;
  }>>([]);
  const [webhookEventsLoaded, setWebhookEventsLoaded] = useState(false);
  const [logAction, setLogAction] = useState<number | null>(null);
  async function carregarLogSistema() {
    setSystemErrorsLoaded(false);
    setWebhookEventsLoaded(false);
    const [errosRes, webhooksRes] = await Promise.all([
      fetch("/api/operational-errors").then((r) => (r.ok ? r.json() : { erros: [] })).catch(() => ({ erros: [] })),
      fetch("/api/webhooks/reprocess").then((r) => (r.ok ? r.json() : { eventos: [] })).catch(() => ({ eventos: [] })),
    ]);
    setSystemErrors(errosRes.erros || []);
    setSystemErrorsLoaded(true);
    setWebhookEvents(webhooksRes.eventos || []);
    setWebhookEventsLoaded(true);
  }
  async function resolverErro(id: number) {
    setLogAction(id);
    try {
      const response = await fetch("/api/operational-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        setSystemErrors((items) => items.filter((item) => item.id !== id));
        feedback("Erro marcado como resolvido.");
      } else {
        feedback("Não foi possível marcar como resolvido.");
      }
    } finally {
      setLogAction(null);
    }
  }
  async function reprocessarWebhook(id: number) {
    setLogAction(id);
    try {
      const response = await fetch("/api/webhooks/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json().catch(() => ({}));
      feedback(response.ok ? `Reprocessado: ${result.status}.` : result.error === "ja_processado" ? "Esse evento já tinha sido processado." : "Falha ao reprocessar — confira os detalhes do erro.");
      if (response.ok) {
        setWebhookEvents((items) =>
          items.map((item) => (item.id === id ? { ...item, status: result.status || "processed", erro: null } : item)),
        );
      }
    } finally {
      setLogAction(null);
    }
  }
  const [serproTeste, setSerproTeste] = useState<{ ok: boolean; detail?: string } | "loading" | null>(null);
  async function testarConexaoSerpro() {
    setSerproTeste("loading");
    const response = await fetch("/api/serpro/testar", { method: "POST" });
    const result = await response.json().catch(() => ({ ok: false, detail: "Resposta inválida" }));
    setSerproTeste(response.ok ? { ok: Boolean(result.ok), detail: result.detail } : { ok: false, detail: result.error || result.detail });
  }
  const [certMeta, setCertMeta] = useState<{ validoDesde: string; validoAte: string; titular: string } | null>(null);
  const [certDiasRestantes, setCertDiasRestantes] = useState<number | null>(null);
  const [certLoaded, setCertLoaded] = useState(false);
  const [certArquivo, setCertArquivo] = useState<File | null>(null);
  const [certSenha, setCertSenha] = useState("");
  const [certEnviando, setCertEnviando] = useState(false);
  const [certErro, setCertErro] = useState("");
  async function carregarCertificadoSerpro() {
    const response = await fetch("/api/serpro/certificado");
    const result = await response.json().catch(() => ({ meta: null }));
    setCertMeta(result.meta || null);
    setCertDiasRestantes(typeof result.diasRestantes === "number" ? result.diasRestantes : null);
    setCertLoaded(true);
  }
  async function enviarCertificadoSerpro() {
    if (!certArquivo || !certSenha) return;
    setCertEnviando(true);
    setCertErro("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(certArquivo);
      });
      const response = await fetch("/api/serpro/certificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, senha: certSenha }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCertErro(result.detail || "Não foi possível processar o certificado.");
        return;
      }
      setCertMeta(result.meta || null);
      setCertDiasRestantes(typeof result.diasRestantes === "number" ? result.diasRestantes : null);
      setCertArquivo(null);
      setCertSenha("");
      feedback(`Certificado atualizado — válido até ${new Date(result.meta.validoAte).toLocaleDateString("pt-BR")}.`);
    } finally {
      setCertEnviando(false);
    }
  }
  const [systemSecrets, setSystemSecrets] = useState<Array<{ chave: string; label: string; grupo: string; nota?: string; usosDisponiveis?: string[]; testavel?: boolean }>>([]);
  const [systemSecretsStatus, setSystemSecretsStatus] = useState<Record<string, { origem: "banco" | "ambiente" | "nenhuma"; atualizadoEm: string | null }>>({});
  const [systemSecretsUsos, setSystemSecretsUsos] = useState<Record<string, Record<string, boolean>>>({});
  const [usosDisponiveis, setUsosDisponiveis] = useState<Array<{ id: string; label: string }>>([]);
  const [systemSecretsLoaded, setSystemSecretsLoaded] = useState(false);
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [secretAction, setSecretAction] = useState<string | null>(null);
  const [secretTestResult, setSecretTestResult] = useState<Record<string, { ok: boolean; detail?: string } | "loading">>({});
  async function carregarChavesSistema() {
    const response = await fetch("/api/system-secrets");
    const result = await response.json().catch(() => ({ chaves: [], status: {}, usos: {}, usosDisponiveis: [] }));
    setSystemSecrets(result.chaves || []);
    setSystemSecretsStatus(result.status || {});
    setSystemSecretsUsos(result.usos || {});
    setUsosDisponiveis(result.usosDisponiveis || []);
    setSystemSecretsLoaded(true);
  }
  async function definirUsoChave(chave: string, uso: string, ativo: boolean) {
    setSystemSecretsUsos((prev) => ({ ...prev, [chave]: { ...prev[chave], [uso]: ativo } }));
    const response = await fetch("/api/system-secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave, uso, ativo, acao: "definir-uso" }),
    });
    if (!response.ok) {
      feedback("Não foi possível salvar esse uso.");
      await carregarChavesSistema();
    }
  }
  async function salvarChaveSistema(chave: string) {
    const valor = (secretDrafts[chave] || "").trim();
    if (!valor) return;
    setSecretAction(chave);
    try {
      const response = await fetch("/api/system-secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave, valor, acao: "salvar" }),
      });
      feedback(response.ok ? "Chave salva — já vale para a próxima chamada." : "Não foi possível salvar essa chave.");
      if (response.ok) {
        setSecretDrafts((items) => ({ ...items, [chave]: "" }));
        await carregarChavesSistema();
      }
    } finally {
      setSecretAction(null);
    }
  }
  async function testarChaveSistema(chave: string) {
    setSecretTestResult((prev) => ({ ...prev, [chave]: "loading" }));
    const response = await fetch("/api/system-secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave, valor: secretDrafts[chave] || "", acao: "testar" }),
    });
    const result = await response.json().catch(() => ({ ok: false, detail: "Resposta inválida" }));
    setSecretTestResult((prev) => ({ ...prev, [chave]: { ok: Boolean(result.ok), detail: result.detail } }));
  }
  async function limparChaveSistema(chave: string) {
    if (!window.confirm("Remover essa chave do banco? O sistema volta a usar a variável de ambiente da Vercel, se houver.")) return;
    setSecretAction(chave);
    try {
      const response = await fetch("/api/system-secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave, acao: "limpar" }),
      });
      feedback(response.ok ? "Chave removida do banco." : "Não foi possível remover.");
      if (response.ok) await carregarChavesSistema();
    } finally {
      setSecretAction(null);
    }
  }
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
    if (tab === "Log do Sistema" && !systemErrorsLoaded && !webhookEventsLoaded) void carregarLogSistema();
    if (tab === "Integrações Externas" && !certLoaded) void carregarCertificadoSerpro();
    if (tab === "Chaves de API" && !systemSecretsLoaded) void carregarChavesSistema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
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
          {tab === "Integracoes" && (
            <>
              <div className="settings-list">
                <SettingSwitch
                  label="Checkout transparente de cartão (Asaas)"
                  note="Mostra os campos de cartão direto no nosso checkout, sem redirecionar pra Asaas. Só ligue depois que a Asaas confirmar por escrito que essa função está liberada pra conta de vocês — o número do cartão passa a trafegar pelo nosso servidor antes de ir pra Asaas, o que exige atenção redobrada com segurança (PCI-DSS)."
                  checked={Boolean(panelPreferences.checkoutCartaoTransparente)}
                  onChange={(value) => setPanelPreferences({ ...panelPreferences, checkoutCartaoTransparente: value })}
                />
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
              <div className="form-actions">
                <small>As alterações valem para o sistema publicado.</small>
                <Button disabled={pending} onClick={() => saveMany([
                  { key: "nota_fiscal_config", value: nfse },
                  { key: "painel_preferencias", value: panelPreferences },
                ])}>
                  <Save size={15} /> {pending ? "Salvando…" : "Salvar configurações"}
                </Button>
              </div>
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
          {tab === "Log do Sistema" && (
            <>
              <div className="card-heading">
                <div>
                  <AlertTriangle size={18} />
                  <strong>Erros registrados</strong>
                </div>
                <Button className="secondary compact" disabled={!systemErrorsLoaded} onClick={() => void carregarLogSistema()}>
                  <RotateCcw size={14} /> {!systemErrorsLoaded ? "Atualizando…" : "Atualizar"}
                </Button>
              </div>
              {!systemErrorsLoaded ? (
                <EmptyState>Carregando erros…</EmptyState>
              ) : systemErrors.length ? (
                <div className="records-list">
                  {systemErrors.map((error) => (
                    <article key={error.id}>
                      <div className="record-icon"><AlertTriangle size={16} /></div>
                      <div>
                        <strong>{error.codigo || "Erro"} · {error.origem}</strong>
                        <span>{error.mensagem}{error.rota ? ` · ${error.rota}` : ""}</span>
                        <small>{error.ocorrencias || 1} ocorrência(s) · {error.severidade} · desde {new Date(error.primeiro_em).toLocaleString("pt-BR")} · último em {new Date(error.ultimo_em).toLocaleString("pt-BR")}</small>
                      </div>
                      <Button className="secondary compact" disabled={logAction === error.id} onClick={() => void resolverErro(error.id)}>
                        <Check size={14} /> {logAction === error.id ? "Salvando…" : "Resolvido"}
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>Nenhum erro aberto nos últimos 30 dias.</EmptyState>
              )}

              <div className="card-heading" style={{ marginTop: 24 }}>
                <div>
                  <AlertTriangle size={18} />
                  <strong>Eventos de webhook</strong>
                </div>
              </div>
              {!webhookEventsLoaded ? (
                <EmptyState>Carregando eventos…</EmptyState>
              ) : webhookEvents.length ? (
                <div className="records-list">
                  {webhookEvents.map((evento) => (
                    <article key={evento.id}>
                      <div className="record-icon"><AlertTriangle size={16} /></div>
                      <div>
                        <strong>{evento.provedor} · {evento.tipo || "evento"} · {evento.status}</strong>
                        <span>{evento.erro || "—"}</span>
                        <small>Recebido em {new Date(evento.recebido_em).toLocaleString("pt-BR")}{evento.processado_em ? ` · processado em ${new Date(evento.processado_em).toLocaleString("pt-BR")}` : ""}</small>
                      </div>
                      {evento.status === "failed" && (
                        <Button className="secondary compact" disabled={logAction === evento.id} onClick={() => void reprocessarWebhook(evento.id)}>
                          <RotateCcw size={14} /> {logAction === evento.id ? "Reprocessando…" : "Reprocessar"}
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>Nenhum evento de webhook registrado ainda.</EmptyState>
              )}
            </>
          )}
          {tab === "Integrações Externas" && (
            <>
              <div className="card-heading">
                <div>
                  <ShieldCheck size={18} />
                  <strong>SERPRO — Integra Contador</strong>
                </div>
              </div>
              <div className="settings-item-row">
                <div>
                  <strong>Conexão OAuth2 + mTLS</strong>
                  <small>Testa a autenticação com as credenciais configuradas (banco ou Vercel).</small>
                </div>
                <Button className="secondary compact" disabled={serproTeste === "loading"} onClick={() => void testarConexaoSerpro()}>
                  {serproTeste === "loading" ? "Testando…" : "Testar conexão"}
                </Button>
                {serproTeste && serproTeste !== "loading" && (
                  <small className={serproTeste.ok ? "system-secret-test-ok" : "system-secret-test-fail"}>
                    {serproTeste.ok ? "✓ Autenticou com o SERPRO." : `✗ Falhou: ${serproTeste.detail || "não autenticou."}`}
                  </small>
                )}
              </div>

              <div className="settings-item-row">
                <div>
                  <strong>Certificado digital e-CNPJ (mTLS)</strong>
                  <small>Suba o arquivo .pfx/.p12 e a senha — converte, salva criptografado e já vale sem redeploy.</small>
                  {certLoaded && certMeta && (
                    <small
                      className={
                        certDiasRestantes === null
                          ? "muted"
                          : certDiasRestantes < 0
                            ? "system-secret-test-fail"
                            : certDiasRestantes <= 30
                              ? "system-secret-test-fail"
                              : certDiasRestantes <= 60
                                ? "muted"
                                : "system-secret-test-ok"
                      }
                    >
                      {certDiasRestantes !== null && certDiasRestantes < 0
                        ? `✗ Venceu em ${new Date(certMeta.validoAte).toLocaleDateString("pt-BR")} — o Integra Contador vai falhar até subir um novo.`
                        : `${certMeta.titular ? `${certMeta.titular} · ` : ""}válido até ${new Date(certMeta.validoAte).toLocaleDateString("pt-BR")}${certDiasRestantes !== null ? ` (faltam ${certDiasRestantes} dia${certDiasRestantes === 1 ? "" : "s"})` : ""}${certDiasRestantes !== null && certDiasRestantes <= 60 ? " — vencimento próximo, já providencie a renovação." : ""}`}
                    </small>
                  )}
                  {certLoaded && !certMeta && <small className="muted">Nenhum certificado configurado ainda.</small>}
                </div>
              </div>
              <div className="settings-item-row">
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(event) => setCertArquivo(event.target.files?.[0] || null)}
                />
                <Input
                  type="password"
                  placeholder="Senha do certificado"
                  value={certSenha}
                  onChange={(event) => setCertSenha(event.target.value)}
                />
                <Button className="secondary compact" disabled={certEnviando || !certArquivo || !certSenha} onClick={() => void enviarCertificadoSerpro()}>
                  <Upload size={14} /> {certEnviando ? "Enviando…" : "Subir certificado"}
                </Button>
              </div>
              {certErro && (
                <small className="system-secret-test-fail" role="alert">✗ {certErro}</small>
              )}
            </>
          )}
          {tab === "Chaves de API" && (
            <>
              <p className="muted">
                Chaves salvas aqui ficam criptografadas no banco e valem na hora, sem precisar de redeploy. Use
                &quot;Testar chave&quot; pra confirmar que ela autentica de verdade no provedor antes (ou depois) de
                salvar — colar sozinho não garante que ela funciona. Fora dessa lista, as demais integrações (Asaas,
                SERPRO, Resend) continuam configuradas só por variável de ambiente na Vercel.
              </p>
              {!systemSecretsLoaded ? (
                <EmptyState>Carregando chaves…</EmptyState>
              ) : (
                Object.entries(
                  systemSecrets.reduce<Record<string, typeof systemSecrets>>((acc, item) => {
                    (acc[item.grupo] ||= []).push(item);
                    return acc;
                  }, {}),
                ).map(([grupo, itens]) => (
                  <div key={grupo} className="settings-item-list">
                    <strong>{grupo}</strong>
    {itens.map((item) => {
                      const status = systemSecretsStatus[item.chave];
                      const teste = secretTestResult[item.chave];
                      return (
                        <div className="settings-item-row" key={item.chave}>
                          <div>
                            <strong>{item.label}</strong>
                            <small>
                              {status?.origem === "banco"
                                ? `Configurada aqui${status.atualizadoEm ? ` · atualizada em ${new Date(status.atualizadoEm).toLocaleString("pt-BR")}` : ""}`
                                : status?.origem === "ambiente"
                                  ? "Configurada só na Vercel (variável de ambiente)"
                                  : "Não configurada"}
                            </small>
                            {item.nota && <small className="muted">{item.nota}</small>}
                          </div>
                          <Input
                            type="password"
                            placeholder="Colar nova chave…"
                            value={secretDrafts[item.chave] || ""}
                            onChange={(event) => setSecretDrafts((prev) => ({ ...prev, [item.chave]: event.target.value }))}
                          />
                          <Button
                            className="secondary compact"
                            disabled={secretAction === item.chave || !(secretDrafts[item.chave] || "").trim()}
                            onClick={() => void salvarChaveSistema(item.chave)}
                          >
                            {secretAction === item.chave ? "Salvando…" : "Salvar"}
                          </Button>
                          {item.testavel && (
                            <Button
                              className="secondary compact"
                              disabled={teste === "loading" || (status?.origem === "nenhuma" && !(secretDrafts[item.chave] || "").trim())}
                              onClick={() => void testarChaveSistema(item.chave)}
                            >
                              {teste === "loading" ? "Testando…" : "Testar chave"}
                            </Button>
                          )}
                          {status?.origem === "banco" && (
                            <Button className="icon ghost danger-text" disabled={secretAction === item.chave} onClick={() => void limparChaveSistema(item.chave)}>
                              <X size={15} />
                            </Button>
                          )}
                          {teste && teste !== "loading" && (
                            <small className={teste.ok ? "system-secret-test-ok" : "system-secret-test-fail"}>
                              {teste.ok ? "✓ Chave válida — autenticou com o provedor." : `✗ Falhou: ${teste.detail || "não autenticou."}`}
                            </small>
                          )}
                          {item.usosDisponiveis && item.usosDisponiveis.length > 0 && (
                            <div className="settings-item-row-usos">
                              <small className="muted">Usar em:</small>
                              {usosDisponiveis
                                .filter((uso) => item.usosDisponiveis!.includes(uso.id))
                                .map((uso) => (
                                  <label className="inline-checkbox" key={uso.id}>
                                    <input
                                      type="checkbox"
                                      checked={systemSecretsUsos[item.chave]?.[uso.id] !== false}
                                      onChange={(event) => void definirUsoChave(item.chave, uso.id, event.target.checked)}
                                    />
                                    {uso.label}
                                  </label>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
type TeamProfileData = {
  membro: TeamMember & { last_sign_in_at?: string | null; email_confirmado_em?: string | null; created_at?: string | null };
  clientes: Array<{ id: string; name: string; status: string | null; tax_type: string | null; created_at: string | null; arquivado_em: string | null; honorarios: number | null }>;
  atendimentos: Array<{ id: number; cliente_nome: string | null; assunto: string | null; finalizado_em: string; honorarios: number | null; modalidade: string | null }>;
  cobrancas: Array<{ id: number; valor_cents: number | null; status: string | null; paid_at: string | null; created_at: string | null; modalidade: string | null }>;
  agendamentos: Array<{ id: number; client_name: string; date: string | null; time: string | null; status: string | null }>;
  resumo: { clientesAtivos: number; clientesArquivados: number; atendimentosFinalizados: number; totalRecebidoCents: number; proximosAgendamentos: number };
};

function TeamMemberProfileModal({
  memberId,
  currentStaffId,
  actionId,
  resetInfo,
  onClose,
  onAction,
  onDismissResetInfo,
}: {
  memberId: string;
  currentStaffId?: string;
  actionId: string | null;
  resetInfo: { id: string; senha: string } | null;
  onClose: () => void;
  onAction: (action: "atualizar" | "resetar-senha" | "remover", payload?: Record<string, string | boolean>) => void;
  onDismissResetInfo: () => void;
}) {
  const [data, setData] = useState<TeamProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const data_ = (value: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—");

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "perfil", payload: { id: memberId } }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (ativo && result?.membro) setData(result);
      })
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [memberId]);

  const membro = data?.membro;
  const ehVocêMesmo = memberId === currentStaffId;

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <Card className="profile-dialog client-dossier" role="dialog" aria-modal="true">
        <div className="dialog-head">
          <div>
            <h2>{membro?.nome || membro?.name || "Perfil do membro"}</h2>
            <p>{membro?.email}</p>
          </div>
          <Button className="icon ghost" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {loading || !membro ? (
          <EmptyState>Carregando perfil…</EmptyState>
        ) : (
          <div className="dossier-body team-profile-body">
            <div className="team-profile-meta">
              <Badge>{membro.role === "admin" ? "Administrador" : "Contador parceiro"}</Badge>
              <small>
                {membro.last_sign_in_at
                  ? `Último acesso: ${new Date(membro.last_sign_in_at).toLocaleString("pt-BR")}`
                  : "Ainda não acessou o sistema"}
              </small>
              <small>Na equipe desde {data_(membro.created_at ?? null)}</small>
            </div>

            <div className="team-profile-stats">
              <div>
                <strong>{data!.resumo.clientesAtivos}</strong>
                <small>Clientes ativos</small>
              </div>
              <div>
                <strong>{data!.resumo.clientesArquivados}</strong>
                <small>Clientes arquivados</small>
              </div>
              <div>
                <strong>{data!.resumo.atendimentosFinalizados}</strong>
                <small>Atendimentos concluídos</small>
              </div>
              <div>
                <strong>{money(data!.resumo.totalRecebidoCents)}</strong>
                <small>Total recebido</small>
              </div>
              <div>
                <strong>{data!.resumo.proximosAgendamentos}</strong>
                <small>Próximos agendamentos</small>
              </div>
            </div>

            <div className="settings-item-list">
              <strong>Acesso e permissões</strong>
              <div className="settings-item-row">
                {!ehVocêMesmo ? (
                  <select
                    value={membro.role || "parceiro"}
                    onChange={(event) => onAction("atualizar", { id: memberId, role: event.target.value })}
                  >
                    <option value="parceiro">Contador parceiro</option>
                    <option value="admin">Administrador</option>
                  </select>
                ) : (
                  <small className="muted">Você não pode alterar seu próprio nível de acesso.</small>
                )}
              </div>
              <div className="team-member-toggles">
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(membro.fila_restrita)}
                    onChange={(event) => onAction("atualizar", { id: memberId, filaRestrita: event.target.checked })}
                  />
                  Fila restrita
                </label>
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={membro.acesso_insights_radar !== false}
                    onChange={(event) => onAction("atualizar", { id: memberId, acessoInsightsRadar: event.target.checked })}
                  />
                  Insights/Radar
                </label>
              </div>
              <div className="dialog-actions">
                <Button
                  className="secondary compact"
                  disabled={actionId === memberId}
                  onClick={() => {
                    if (membro.email && window.confirm(`Gerar uma senha temporária nova para ${membro.email}? A senha atual deixa de funcionar.`))
                      onAction("resetar-senha", { id: memberId });
                  }}
                >
                  {actionId === memberId ? "Gerando…" : "Resetar senha"}
                </Button>
                {!ehVocêMesmo && (
                  <Button
                    className="secondary compact danger-text"
                    onClick={() => {
                      if (membro.email && window.confirm(`Revogar o acesso de ${membro.email}?`)) {
                        onAction("remover", { id: memberId });
                        onClose();
                      }
                    }}
                  >
                    <X size={15} /> Revogar acesso
                  </Button>
                )}
              </div>
              {resetInfo?.id === memberId && (
                <div className="archived-banner">
                  <span>
                    Senha temporária gerada: <b>{resetInfo.senha}</b> — repasse com segurança para a pessoa; ela deve
                    trocar a senha no primeiro acesso.
                  </span>
                  <Button onClick={onDismissResetInfo}>Ok, copiei</Button>
                </div>
              )}
            </div>

            <div className="settings-item-list">
              <strong>Clientes sob responsabilidade ({data!.clientes.length})</strong>
              {data!.clientes.length ? (
                data!.clientes.slice(0, 8).map((cliente) => (
                  <div className="settings-item-row" key={cliente.id}>
                    <div>
                      <strong>{cliente.name}</strong>
                      <small>{cliente.tax_type || "Sem assunto"} · {cliente.arquivado_em ? "Arquivado" : cliente.status || "Ativo"}</small>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Nenhum cliente atribuído ainda.</EmptyState>
              )}
            </div>

            <div className="settings-item-list">
              <strong>Atendimentos recentes</strong>
              {data!.atendimentos.length ? (
                data!.atendimentos.slice(0, 8).map((item) => (
                  <div className="settings-item-row" key={item.id}>
                    <div>
                      <strong>{item.cliente_nome || "Cliente"}</strong>
                      <small>{item.assunto || item.modalidade || "Atendimento"} · finalizado em {data_(item.finalizado_em)}</small>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Nenhum atendimento concluído ainda.</EmptyState>
              )}
            </div>

            <div className="settings-item-list">
              <strong>Financeiro</strong>
              {data!.cobrancas.length ? (
                data!.cobrancas.slice(0, 8).map((cobranca) => (
                  <div className="settings-item-row" key={cobranca.id}>
                    <div>
                      <strong>{money(cobranca.valor_cents || 0)}</strong>
                      <small>
                        {cobranca.status === "paid" ? "Pago" : cobranca.status || "Pendente"} ·{" "}
                        {data_(cobranca.paid_at || cobranca.created_at)}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Nenhuma cobrança registrada ainda.</EmptyState>
              )}
            </div>

            <div className="settings-item-list">
              <strong>Agenda</strong>
              {data!.agendamentos.length ? (
                data!.agendamentos.slice(0, 8).map((agendamento) => (
                  <div className="settings-item-row" key={agendamento.id}>
                    <div>
                      <strong>{agendamento.client_name}</strong>
                      <small>
                        {agendamento.date ? new Date(`${agendamento.date}T00:00:00`).toLocaleDateString("pt-BR") : "Sem data"}
                        {agendamento.time ? ` às ${agendamento.time}` : ""} · {agendamento.status || "agendado"}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Nenhum agendamento vinculado.</EmptyState>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function EquipeIntegralView({ currentStaffId }: { currentStaffId?: string }) {
  const [team, setTeam] = useState<Array<TeamMember & { last_sign_in_at?: string | null }>>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<{ id: string; senha: string } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [invite, setInvite] = useState({
    nome: "",
    email: "",
    role: "parceiro",
    filaRestrita: false,
    acessoInsightsRadar: true,
  });

  async function teamAction(
    action: "listar" | "convidar" | "remover" | "atualizar" | "resetar-senha",
    payload?: Record<string, string | boolean>,
  ) {
    if (payload?.id) setActionId(String(payload.id));
    const response = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const result = await response.json().catch(() => ({ error: "Resposta inválida" }));
    setActionId(null);
    if (!response.ok) {
      feedback(result.error || "Não foi possível gerenciar a equipe.");
      return;
    }
    if (action === "listar") {
      setTeam(result);
      setTeamLoaded(true);
      return;
    }
    if (action === "resetar-senha" && result.senhaTemporaria) {
      setResetInfo({ id: String(payload?.id), senha: result.senhaTemporaria });
    } else {
      feedback(
        action === "convidar"
          ? "Convite enviado."
          : action === "atualizar"
            ? "Atualizado."
            : "Acesso revogado.",
      );
    }
    if (action === "convidar") setInvite({ nome: "", email: "", role: "parceiro", filaRestrita: false, acessoInsightsRadar: true });
    await teamAction("listar");
  }

  useEffect(() => {
    if (!teamLoaded) void teamAction("listar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="view-stack">
      <PageTitle
        title="Equipe"
        description="Membros, papéis, permissões e acesso da sua equipe. Clique em alguém para ver o perfil completo."
      />
      <Card>
        <div className="team-integral-list">
          {team.map((member) => (
            <button
              type="button"
              key={member.id || member.email}
              className="team-integral-row"
              onClick={() => member.id && setProfileId(member.id)}
              disabled={!member.id}
            >
              <div className="avatar small">
                {(member.nome || member.name || member.email).slice(0, 2).toUpperCase()}
              </div>
              <span>
                <strong>{member.nome || member.name || "Sem nome"}</strong>
                <small>{member.email}</small>
                <small>
                  {member.last_sign_in_at
                    ? `Último acesso: ${new Date(member.last_sign_in_at).toLocaleString("pt-BR")}`
                    : "Ainda não acessou o sistema"}
                </small>
              </span>
              <Badge>{member.role === "admin" ? "Administrador" : "Contador parceiro"}</Badge>
              <span className="team-integral-row-link">Ver perfil</span>
            </button>
          ))}
          {!teamLoaded && <EmptyState>Carregando equipe…</EmptyState>}
        </div>
      </Card>
      <Card className="team-invite">
        <strong>Convidar membro</strong>
        <div className="form-grid">
          <label>
            Nome
            <Input value={invite.nome} onChange={(event) => setInvite({ ...invite, nome: event.target.value })} />
          </label>
          <label>
            E-mail
            <Input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} />
          </label>
          <label>
            Nível de acesso
            <select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })}>
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
              onChange={(event) => setInvite({ ...invite, filaRestrita: event.target.checked })}
            />
            Fila restrita (só vê os próprios casos)
          </label>
          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={invite.acessoInsightsRadar}
              onChange={(event) => setInvite({ ...invite, acessoInsightsRadar: event.target.checked })}
            />
            Acesso a Insights/Radar Fiscal
          </label>
        </div>
        <Button disabled={!invite.nome.trim() || !invite.email.includes("@")} onClick={() => void teamAction("convidar", invite)}>
          <Plus size={15} /> Enviar convite
        </Button>
      </Card>
      {profileId && (
        <TeamMemberProfileModal
          memberId={profileId}
          currentStaffId={currentStaffId}
          actionId={actionId}
          resetInfo={resetInfo}
          onClose={() => setProfileId(null)}
          onAction={(action, payload) => void teamAction(action, payload)}
          onDismissResetInfo={() => setResetInfo(null)}
        />
      )}
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
// "Pendente de Início" saiu do quadro — agora vive só na aba Fila de
// Atendimento. Continua em integralStages pra não sumir das opções de
// mover-para-trás nos selects dos cards.
const kanbanStages = integralStages.filter((stage) => stage.label !== "Pendente de Início");
function tempoDesde(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias > 1 ? "s" : ""}`;
}
function formatDataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function AcompanhamentoIntegralView({
  data = emptyOperationsData,
  clientsData = emptyClientsData,
  onNavigate,
}: {
  data?: OperationsData;
  clientsData?: ClientsData;
  onNavigate?: (id: string, clientId?: string | null) => void;
}) {
  const [express, setExpress] = useState(data.express);
  const [moving, setMoving] = useState<string | null>(null);
  const [tab, setTab] = useState(tabsByView.acompanhamento[0]);
  const [detalhes, setDetalhes] = useState<ExpressItem | null>(null);
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
      return false;
    }
    setExpress((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    feedback("Etapa atualizada e cliente notificado.");
    return true;
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
  // Fila = casos ainda não iniciados (Express "aguardando_triagem" +
  // equivalente legado "pending"), em ordem de chegada. Some da esteira: só
  // aparece na esteira depois que "Iniciar atendimento" move o status.
  const filaExpress = express
    .filter((item) => item.status === "aguardando_triagem")
    .sort((a, b) => new Date(a.contratado_em).getTime() - new Date(b.contratado_em).getTime());
  const filaLegacy = Object.entries(legacyMap).filter(([, status]) => status === "pending");
  function iniciarExpress(item: ExpressItem) {
    void moveExpress(item.id, "em_analise").then((ok) => {
      if (ok) onNavigate?.("atendimento", item.cliente_ref);
    });
  }
  // moveLegacy recarrega a página no sucesso (comportamento pré-existente),
  // então não dá pra encadear navegação depois — perderia o SPA state.
  function iniciarLegacy(clientId: string) {
    void moveLegacy(clientId, "active");
  }
  return (
    <div className="view-stack">
      <PageTitle
        title={tab === "Fila de Atendimento" ? "Fila de Atendimento" : "Esteira de Acompanhamento"}
        description={
          tab === "Fila de Atendimento"
            ? "Casos já contratados que ainda não começaram a ser trabalhados, em ordem de chegada. Inicie para mover para a esteira."
            : "Movimente casos, atribua execução e acompanhe os prazos de entrega até a conclusão."
        }
        action={
          tab === "Fila de Atendimento" ? (
            <Badge className={filaExpress.length + filaLegacy.length ? "attention" : "success"}>
              {filaExpress.length + filaLegacy.length} na fila
            </Badge>
          ) : (
            <Badge className="success">
              {express.length + Object.keys(legacyMap).length} processos
            </Badge>
          )
        }
      />
      <Tabs view="acompanhamento" active={tab} onChange={setTab} />
      {tab === "Fila de Atendimento" ? (
        <Card className="fila-atendimento-list">
          {filaExpress.map((item, index) => (
            <div className="fila-atendimento-row" key={`e-${item.id}`}>
              <span className="fila-atendimento-posicao">{index + 1}</span>
              <div className="fila-atendimento-corpo">
                <strong>{clientName(item.cliente_ref)}</strong>
                <span>{item.assunto || item.servico_id || `Express #${item.id}`}</span>
                <small>
                  <Badge className="attention">Express</Badge> aguardando desde {tempoDesde(item.contratado_em)}
                </small>
                <small className="fila-atendimento-prazos">
                  Contratado em {formatDataHora(item.contratado_em)} · Prazo final {formatDataHora(item.prazo_conclusao_em)}
                </small>
              </div>
              <div className="fila-atendimento-acoes">
                <Button className="secondary" onClick={() => setDetalhes(item)}>
                  <ArrowUpRight size={14} />
                  <span>Ver detalhes</span>
                </Button>
                <Button className="orange-action" disabled={moving === `e-${item.id}`} onClick={() => iniciarExpress(item)}>
                  <Play size={14} />
                  <span>Iniciar atendimento</span>
                </Button>
              </div>
            </div>
          ))}
          {filaLegacy.map(([clientId]) => (
            <div className="fila-atendimento-row" key={`l-${clientId}`}>
              <span className="fila-atendimento-posicao">—</span>
              <div className="fila-atendimento-corpo">
                <strong>{clientName(clientId)}</strong>
                <span>Fluxo originado no atendimento</span>
              </div>
              <Button className="orange-action" disabled={moving === `l-${clientId}`} onClick={() => iniciarLegacy(clientId)}>
                <Play size={14} />
                <span>Iniciar atendimento</span>
              </Button>
            </div>
          ))}
          {!filaExpress.length && !filaLegacy.length && (
            <EmptyState>Fila vazia. Nenhum caso aguardando início.</EmptyState>
          )}
        </Card>
      ) : (
      <div className="kanban integral-kanban">
        {kanbanStages.map((stage, index) => {
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
                          // "Em Análise Fiscal" e "Em Execução" compartilham o
                          // mesmo código legado ("active") — mantém a
                          // primeira ocorrência (Em Análise Fiscal) pra não
                          // sobrescrever o rótulo certo com o da segunda.
                          [...integralStages].reverse().map((item) => [
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
      )}
      {detalhes && (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetalhes(null)}>
          <Card className="fila-detalhes-dialog" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div>
                <h2>{clientName(detalhes.cliente_ref)}</h2>
                <p>{detalhes.assunto || detalhes.servico_id || `Express #${detalhes.id}`}</p>
              </div>
              <Button className="icon ghost" onClick={() => setDetalhes(null)}>
                <X size={18} />
              </Button>
            </div>
            <div className="dossier-body">
              <div className="team-profile-stats">
                <div>
                  <strong>{integralStages.find((stage) => stage.express === detalhes.status)?.label || detalhes.status}</strong>
                  <small>Status atual</small>
                </div>
                <div>
                  <strong>{formatDataHora(detalhes.contratado_em)}</strong>
                  <small>Contratado em</small>
                </div>
                <div>
                  <strong>{formatDataHora(detalhes.prazo_conclusao_em)}</strong>
                  <small>Prazo final</small>
                </div>
              </div>
              {(() => {
                const cliente = clientsData.clients.find((item) => item.id === detalhes.cliente_ref);
                return (
                  <p className="fila-detalhes-contato">
                    {cliente?.email || "sem e-mail cadastrado"} · {cliente?.phone || "sem telefone cadastrado"}
                  </p>
                );
              })()}
              <h3>Documentos enviados pelo cliente</h3>
              <div className="client-document-list">
                {data.documents
                  .filter((doc) => doc.cliente_ref === detalhes.cliente_ref)
                  .map((doc) => (
                    <a key={doc.id} href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
                      <FileText size={16} />
                      <span>
                        <strong>{doc.file_name}</strong>
                        <small>
                          {doc.mime || "Arquivo"}
                          {doc.size_bytes ? ` · ${Math.ceil(doc.size_bytes / 1024)} KB` : ""}
                        </small>
                      </span>
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                {!data.documents.some((doc) => doc.cliente_ref === detalhes.cliente_ref) && (
                  <EmptyState>Nenhum documento enviado ainda.</EmptyState>
                )}
              </div>
            </div>
            <div className="dialog-actions">
              <Button className="secondary" onClick={() => setDetalhes(null)}>
                Fechar
              </Button>
              <Button
                className="orange-action"
                disabled={moving === `e-${detalhes.id}`}
                onClick={() => {
                  const item = detalhes;
                  setDetalhes(null);
                  iniciarExpress(item);
                }}
              >
                <Play size={14} />
                <span>Iniciar atendimento</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
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
  const [subTab, setSubTab] = useState<"dia" | "geral" | "disponibilidade">("dia");
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
  const todayItems = appointmentsFor(today);

  const list = data.appointments.filter(
    (item) =>
      filter === "todos" ||
      (filter === "hoje" && item.date === today) ||
      (filter === "concluidos" && item.status === "done") ||
      (filter === "proximos" &&
        Boolean(item.date && item.date >= today && item.status !== "done")),
  );

  function shiftDay(offset: number) {
    const d = new Date(`${selectedDay}T12:00:00`);
    d.setDate(d.getDate() + offset);
    setSelectedDay(new Intl.DateTimeFormat("en-CA").format(d));
  }

  function formatDayTitle(dayStr: string) {
    const isToday = dayStr === today;
    const dateObj = new Date(`${dayStr}T12:00:00`);
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(dateObj);
    return isToday ? `Hoje, ${formatted}` : formatted;
  }

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
        title="Agenda Operacional"
        description="Gestão diária de consultas, calendário geral, horários públicos e bloqueios."
        action={
          <Badge className="success">
            {data.appointments.length} agendamentos
          </Badge>
        }
      />

      <Tabs
        view="agenda"
        active={
          subTab === "dia"
            ? "Agenda do Dia"
            : subTab === "geral"
            ? "Calendário Geral & Lista"
            : "Disponibilidade & Consulta Manual"
        }
        onChange={(val) => {
          if (val === "Agenda do Dia") setSubTab("dia");
          else if (val === "Calendário Geral & Lista") setSubTab("geral");
          else setSubTab("disponibilidade");
        }}
      />

      {subTab === "dia" && (
        <div className="agenda-day-view-layout">
          <Card className="agenda-day-header-card">
            <div className="agenda-day-controls">
              <div className="agenda-day-nav-group">
                <Button
                  className="secondary"
                  onClick={() => shiftDay(-1)}
                  title="Dia anterior"
                >
                  <ChevronLeft size={16} /> Anterior
                </Button>
                <Button
                  className={selectedDay === today ? "primary" : "secondary"}
                  onClick={() => setSelectedDay(today)}
                >
                  Hoje
                </Button>
                <Button
                  className="secondary"
                  onClick={() => shiftDay(1)}
                  title="Próximo dia"
                >
                  Próximo <ChevronRight size={16} />
                </Button>
                <div className="agenda-date-picker-wrap">
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="agenda-native-date-input"
                  />
                </div>
              </div>

              <div className="agenda-day-actions">
                <Button
                  className="primary"
                  onClick={() => setSubTab("disponibilidade")}
                >
                  <Plus size={16} /> Nova Consulta Manual
                </Button>
              </div>
            </div>

            <div className="agenda-day-title-row">
              <h3>
                <CalendarClock size={20} />
                <span>{formatDayTitle(selectedDay)}</span>
              </h3>
            </div>

            <div className="agenda-day-stats-row">
              <div className="agenda-stat-pill">
                <span className="stat-label">Total do dia</span>
                <strong>{dayItems.length}</strong>
              </div>
              <div className="agenda-stat-pill tone-green">
                <span className="stat-label">Confirmados</span>
                <strong>{dayItems.filter((i) => i.status === "confirmed").length}</strong>
              </div>
              <div className="agenda-stat-pill tone-amber">
                <span className="stat-label">Pendentes</span>
                <strong>{dayItems.filter((i) => !i.status || i.status === "pending").length}</strong>
              </div>
              <div className="agenda-stat-pill tone-slate">
                <span className="stat-label">Concluídos</span>
                <strong>{dayItems.filter((i) => i.status === "done").length}</strong>
              </div>
            </div>
          </Card>

          <Card className="agenda-day-list-card">
            <div className="card-heading">
              <div>
                <ListChecks size={18} />
                <strong>Compromissos Agendados</strong>
              </div>
              <Badge>{dayItems.length} {dayItems.length === 1 ? "atendimento" : "atendimentos"}</Badge>
            </div>

            <AppointmentList
              items={dayItems}
              pending={pending}
              setStatus={setStatus}
              remove={removeAppointment}
            />
          </Card>
        </div>
      )}

      {subTab === "geral" && (
        <div className="agenda-general-layout">
          <Card className="agenda-main-card">
            <div className="calendar-head">
              <Button
                className="secondary"
                onClick={() => {
                  const now = new Date();
                  setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDay(today);
                }}
              >
                Mês Atual
              </Button>
              <div className="calendar-month-nav">
                <Button
                  className="icon ghost"
                  onClick={() =>
                    setMonth(
                      (value) =>
                        new Date(value.getFullYear(), value.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeft size={18} />
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
                  <ChevronRight size={18} />
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
                    const isSelected = selectedDay === value;
                    const isBlocked = blocked.includes(value);
                    const isCurrentMonth = day.getMonth() === month.getMonth();
                    return (
                      <button
                        key={value}
                        className={`${!isCurrentMonth ? "outside " : ""}${isSelected ? "selected " : ""}${isBlocked ? "blocked" : ""}`}
                        onClick={() => {
                          setSelectedDay(value);
                        }}
                      >
                        <span className="cal-day-num">{day.getDate()}</span>
                        <div className="cal-items-list">
                          {items.slice(0, 3).map((item) => (
                            <small key={item.id} title={`${item.time} - ${item.client_name}`}>
                              {item.time} · {item.client_name}
                            </small>
                          ))}
                          {items.length > 3 && <em>+{items.length - 3} mais</em>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedDay && (
                  <div className="calendar-selected-day-preview">
                    <div className="preview-head">
                      <strong>
                        <CalendarClock size={16} /> Agendamentos em{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }).format(new Date(`${selectedDay}T12:00:00`))}
                      </strong>
                      <Button
                        className="secondary"
                        onClick={() => setSubTab("dia")}
                      >
                        Abrir na Agenda do Dia <ArrowUpRight size={14} />
                      </Button>
                    </div>
                    <AppointmentList
                      items={dayItems}
                      pending={pending}
                      setStatus={setStatus}
                      remove={removeAppointment}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="agenda-list-filters-bar">
                  <div className="period-capsule agenda-list-filter">
                    {["proximos", "hoje", "concluidos", "todos"].map((value) => (
                      <button
                        key={value}
                        className={filter === value ? "active" : ""}
                        onClick={() => setFilter(value)}
                      >
                        {value === "proximos"
                          ? "Próximos"
                          : value === "hoje"
                          ? "Hoje"
                          : value === "concluidos"
                          ? "Concluídos"
                          : "Todos"}
                      </button>
                    ))}
                  </div>
                  <Badge>{list.length} registros</Badge>
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
        </div>
      )}

      {subTab === "disponibilidade" && (
        <div className="agenda-config-grid">
          <Card className="agenda-config-card">
            <div className="card-heading">
              <div>
                <Clock3 size={18} />
                <strong>Horários de Atendimento & Bloqueios</strong>
              </div>
            </div>
            
            <div className="config-section">
              <label className="section-title">Horários Disponíveis para Agendamento</label>
              <div className="availability-pills">
                {times.map((time) => (
                  <button
                    key={time}
                    title="Remover horário"
                    onClick={() =>
                      setTimes((value) => value.filter((item) => item !== time))
                    }
                  >
                    {time}
                    <X size={13} />
                  </button>
                ))}
              </div>
              <div className="inline-form">
                <Input
                  type="time"
                  value={newTime}
                  placeholder="00:00"
                  onChange={(event) => setNewTime(event.target.value)}
                />
                <Button className="secondary" onClick={addTime}>
                  <Plus size={15} /> Adicionar Horário
                </Button>
              </div>
            </div>

            <div className="config-section">
              <label className="section-title">Dias Bloqueados (Sem Atendimento)</label>
              <div className="availability-pills blocked">
                {blocked.length ? (
                  blocked.map((day) => (
                    <button
                      key={day}
                      title="Desbloquear dia"
                      onClick={() =>
                        setBlocked((value) => value.filter((item) => item !== day))
                      }
                    >
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(`${day}T12:00:00`),
                      )}
                      <X size={13} />
                    </button>
                  ))
                ) : (
                  <small className="muted">Nenhum dia bloqueado no momento.</small>
                )}
              </div>
              <div className="inline-form">
                <Input
                  type="date"
                  value={newBlocked}
                  onChange={(event) => setNewBlocked(event.target.value)}
                />
                <Button className="secondary" onClick={addBlocked}>
                  <Plus size={15} /> Bloquear Data
                </Button>
              </div>
            </div>

            <div className="form-actions">
              <Button
                className="primary full"
                disabled={pending}
                onClick={saveAvailability}
              >
                <Save size={15} /> Salvar Disponibilidade
              </Button>
            </div>
          </Card>

          <Card className="agenda-config-card">
            <div className="card-heading">
              <div>
                <Plus size={18} />
                <strong>Nova Consulta Manual</strong>
              </div>
            </div>
            <div className="profile-form">
              <label>
                Cliente Cadastrado
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
                  Nome do Contribuinte / Cliente
                  <Input
                    value={form.clientName}
                    placeholder="Ex: João da Silva"
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
                Assunto / Tipo de Atendimento
                <Input
                  value={form.taxType}
                  placeholder="Ex: Declaração de IRPF, Consultoria..."
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
              <div className="form-actions">
                <Button
                  className="primary full"
                  disabled={
                    pending || (!form.clientId && !form.clientName.trim())
                  }
                  onClick={createAppointment}
                >
                  <CalendarDays size={15} />
                  {pending ? "Salvando…" : "Agendar Consulta"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function AppointmentList({
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
        <article key={item.id} className="appointment-card-row">
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
          <div className="appointment-details">
            <div className="appointment-title-row">
              <strong>{item.client_name}</strong>
              <span className={`appointment-status-pill status-${item.status || "pending"}`}>
                {item.status === "confirmed"
                  ? "Confirmado"
                  : item.status === "done"
                  ? "Concluído"
                  : item.status === "cancelled"
                  ? "Cancelado"
                  : "Pendente"}
              </span>
            </div>
            <div className="appointment-meta-row">
              <span>{item.tax_type || "Atendimento Geral"}</span>
              {item.date && (
                <small>
                  •{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "long",
                  }).format(new Date(`${item.date}T12:00:00`))}
                </small>
              )}
            </div>
          </div>
          <div className="appointment-actions-wrap">
            <select
              className="appointment-status-select"
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
            <Button
              className="icon ghost danger-text"
              aria-label={`Excluir agendamento de ${item.client_name}`}
              title="Excluir agendamento"
              disabled={pending}
              onClick={() => remove(item.id)}
            >
              <X size={16} />
            </Button>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState>Nenhum agendamento encontrado.</EmptyState>
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
