import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { CATALOGO_PADRAO, REGRAS_PADRAO, type TriagemAssunto, type TriagemRegras } from "@/lib/triagemCatalogo";

export type PortalMessage = {
  id: string;
  sender: string;
  text: string | null;
  type: string | null;
  docName: string | null;
  duration: string | null;
  transcricao: string | null;
  time: string | null;
  createdAt: string | null;
  readAt: string | null;
  seq: number;
};

export type PortalAppointment = {
  id: number;
  date: string | null;
  time: string | null;
  status: string | null;
  taxType: string | null;
};

export type PortalAtendimentoExpress = {
  id: number;
  servicoId: string | null;
  assunto: string | null;
  status: string;
  contratadoEm: string;
  prazoConclusaoEm: string;
  concluidoEm: string | null;
};

export type PortalDocument = {
  id: number;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string | null;
  checklistItem: string | null;
  storagePath: string;
};

export type PortalMailItem = {
  id: number;
  assunto: string | null;
  mensagem: string;
  remetente: string;
  lida: boolean;
  status: string;
  createdAt: string;
};

export type PortalReportAnexo = { id: number; titulo: string; url: string | null; tipo: string };
export type PortalAvaliacao = { id: number; casoRef: string | null; relatorioId: number | null; nota: number; comentario: string | null; createdAt: string };

export type PortalReport = {
  id: number;
  titulo: string | null;
  status: string;
  tipoRelatorio: string;
  entregueEm: string | null;
  createdAt: string;
  codigoValidacao: string;
  casoRef: string | null;
  clienteNome: string | null;
  clienteCpf: string | null;
  problema: string | null;
  solucao: string | null;
  oqueFeito: string | null;
  comoFeito: string | null;
  pendencias: string | null;
  contadorAssinatura: string | null;
  contadorNome: string | null;
  contadorCrc: string | null;
  versao: number;
  prazoProximoPasso: string | null;
  anexos: PortalReportAnexo[];
};

export type PortalTriagem = {
  id: number;
  assunto: string | null;
  descricao: string | null;
  status: string;
  respostas: unknown;
  enviadaEm: string | null;
};

export type PortalServico = { id: string; name: string; priceCents: number };
export type PortalOcupado = { date: string; time: string };

export type PortalContador = {
  name: string;
  crc: string;
  logoDataUrl: string;
  verified: boolean;
};

export type PortalObrigacao = { id: string; title: string; description: string | null; dueDate: string; daysUntil: number; reminderDays: number | null };

export type PortalData = {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    taxType: string | null;
    status: string | null;
    honorarios: number | null;
    recorrente: boolean | null;
    recorrenteTipo: string | null;
    onboardingPendente: boolean;
    caixaPostalNovas: boolean;
    cpf: string | null;
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    atendimentoModalidade: string | null;
  };
  contador: PortalContador;
  messages: PortalMessage[];
  unreadMessages: number;
  appointments: PortalAppointment[];
  atendimentosExpress: PortalAtendimentoExpress[];
  triagem: PortalTriagem | null;
  documents: PortalDocument[];
  mailbox: PortalMailItem[];
  unreadMail: number;
  reports: PortalReport[];
  avaliacoes: PortalAvaliacao[];
  triagemCatalogo: TriagemAssunto[];
  triagemRegras: TriagemRegras;
  servicos: PortalServico[];
  agendaHorarios: string[];
  agendaDiasBloqueados: string[];
  agendaOcupados: PortalOcupado[];
  agendaFiscal: PortalObrigacao[];
};

// Porte 1:1 de agenda.js do legado (lógica pura, sem DOM) — calcula próximos
// vencimentos aplicáveis a partir do catálogo de obrigações fiscais.
function lastDayOfMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

function nextDueDate(ob: { recurrence: string; day_of_month: number; month: number | null }, from: Date): Date | null {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (ob.recurrence === "monthly") {
    let y = base.getFullYear();
    let m = base.getMonth();
    for (let i = 0; i < 13; i++) {
      const day = Math.min(ob.day_of_month, lastDayOfMonth(y, m));
      const d = new Date(y, m, day);
      if (d >= base) return d;
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  } else if (ob.recurrence === "yearly") {
    const month0 = (ob.month || 1) - 1;
    for (let y = base.getFullYear(); y <= base.getFullYear() + 1; y++) {
      const day = Math.min(ob.day_of_month, lastDayOfMonth(y, month0));
      const d = new Date(y, month0, day);
      if (d >= base) return d;
    }
  }
  return null;
}

function obrigacaoAplica(keywords: string[] | null, taxType: string | null) {
  const kw = keywords || [];
  if (!kw.length) return true;
  const t = (taxType || "").toLowerCase();
  return kw.some((k) => t.includes(String(k).toLowerCase()));
}

function diasEntre(date: Date, from: Date) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function proximosVencimentos(
  obrigacoes: { id: string; title: string; description: string | null; active: boolean | null; recurrence: string; day_of_month: number; month: number | null; keywords: string[] | null; reminder_days: number | null }[],
  taxType: string | null,
  from = new Date(),
): PortalObrigacao[] {
  return obrigacoes
    .filter((ob) => ob.active !== false && obrigacaoAplica(ob.keywords, taxType))
    .map((ob) => {
      const due = nextDueDate(ob, from);
      return { id: ob.id, title: ob.title, description: ob.description, dueDate: due ? toISODate(due) : null, daysUntil: due ? diasEntre(due, from) : null, reminderDays: ob.reminder_days };
    })
    .filter((x): x is PortalObrigacao => Boolean(x.dueDate) && x.daysUntil !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function loadPortalData(supabase: SupabaseClient<Database>, clientId: string): Promise<PortalData> {
  const today = new Date();
  today.setHours(today.getHours() - 3);
  const todayStr = today.toISOString().slice(0, 10);
  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 60);
  const limitStr = limitDate.toISOString().slice(0, 10);

  const [clientResult, messagesResult, appointmentsResult, triagensResult, documentsResult, mailResult, reportsResult, perfilResult, configResult, servicosResult, ocupadosResult, anexosResult, avaliacoesResult, expressResult, obrigacoesResult] = await Promise.all([
    supabase.from("clientes").select("id,name,email,phone,tax_type,status,honorarios,recorrente,recorrente_tipo,onboarding_pendente,caixa_postal_novas,cpf,endereco,numero,bairro,cidade,estado,cep,atendimento_modalidade").eq("id", clientId).single(),
    supabase.from("mensagens").select("id,sender,text,type,doc_name,duration,transcricao,time,created_at,read_at,seq").eq("cliente_id", clientId).order("seq", { ascending: true }).limit(200),
    supabase.from("agendamentos").select("id,date,time,status,tax_type").eq("cliente_ref", clientId).order("date", { ascending: false }).limit(50),
    // Só a triagem ativa (a mais recente ainda não arquivada) — igual ao
    // /api/triagem do legado: é uma linha só por vez, não uma lista.
    supabase.from("triagens").select("id,assunto,descricao,status,respostas,enviada_at").eq("cliente_ref", clientId).neq("status", "arquivada").order("created_at", { ascending: false }).limit(1),
    supabase.from("documentos").select("id,file_name,mime,size_bytes,uploaded_by,created_at,checklist_item,storage_path").eq("cliente_ref", clientId).order("created_at", { ascending: false }).limit(100),
    supabase.from("caixa_postal").select("id,assunto,mensagem,remetente,lida,status,created_at").eq("cliente_ref", clientId).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("relatorios")
      .select("id,titulo,status,tipo_relatorio,entregue_em,created_at,codigo_validacao,caso_ref,cliente_nome,cliente_cpf,problema,solucao,oque_feito,como_feito,pendencias,contador_assinatura,contador_nome,contador_crc,versao,prazo_proximo_passo")
      .eq("cliente_ref", clientId)
      .in("status", ["entregue", "arquivado_interno"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("configuracoes").select("valor").eq("chave", "perfil_contador").maybeSingle(),
    supabase.from("configuracoes").select("chave,valor").in("chave", ["triagem_assuntos", "triagem_regras", "agenda_disponibilidade", "agenda_dias_bloqueados"]),
    supabase.from("servicos").select("id,name,price_cents").eq("active", true).order("price_cents"),
    // Leitura ampla (todos os clientes) só de data/hora/status — precisa saber
    // quais horários já estão ocupados na agenda geral do escritório, igual ao
    // /api/appointments que o cliente.html consulta pra montar o calendário.
    supabase.from("agendamentos").select("date,time,status").not("status", "eq", "cancelled").gte("date", todayStr).lte("date", limitStr),
    supabase.from("relatorio_anexos").select("id,relatorio_id,titulo,url,tipo").eq("cliente_ref", clientId).eq("visivel_cliente", true),
    supabase.from("avaliacoes").select("id,caso_ref,relatorio_id,nota,comentario,created_at").eq("cliente_ref", clientId).order("created_at", { ascending: false }),
    supabase.from("atendimentos_express").select("id,servico_id,assunto,status,contratado_em,prazo_conclusao_em,concluido_em").eq("cliente_ref", clientId).order("contratado_em", { ascending: false }).limit(20),
    // Agenda fiscal só é relevante pra quem tem serviço recorrente ativo —
    // mas o catálogo em si (`obrigacoes`) é o mesmo pra todo mundo, então
    // sempre buscamos e filtramos depois pelo `client.recorrente`.
    supabase.from("obrigacoes").select("id,title,description,active,recurrence,day_of_month,month,keywords,reminder_days").eq("active", true),
  ]);

  if (clientResult.error || !clientResult.data) throw clientResult.error || new Error("client_not_found");

  const perfilRaw = perfilResult.data?.valor;
  const perfil = perfilRaw && typeof perfilRaw === "object" && !Array.isArray(perfilRaw) ? (perfilRaw as Record<string, unknown>) : {};
  const crc = typeof perfil.crc === "string" ? perfil.crc : "";
  const contador: PortalContador = {
    name: typeof perfil.name === "string" && perfil.name.trim() ? perfil.name : "Olá, Contador",
    crc,
    logoDataUrl: typeof perfil.logoDataUrl === "string" ? perfil.logoDataUrl : "",
    // Selo "verificado" é uma marca de confiança da plataforma, sempre visível
    // no chat — mesmo comportamento do cliente.html legado (não depende do
    // contador ter preenchido o CRC).
    verified: true,
  };

  const configPorChave: Record<string, unknown> = {};
  (configResult.data ?? []).forEach((row) => {
    configPorChave[row.chave] = row.valor;
  });
  const catalogoRemoto = configPorChave.triagem_assuntos;
  const triagemCatalogo: TriagemAssunto[] = Array.isArray(catalogoRemoto) && catalogoRemoto.length ? (catalogoRemoto as TriagemAssunto[]) : CATALOGO_PADRAO;
  const regrasRemoto = configPorChave.triagem_regras;
  const triagemRegras: TriagemRegras =
    regrasRemoto && typeof regrasRemoto === "object" && !Array.isArray(regrasRemoto) ? { ...REGRAS_PADRAO, ...(regrasRemoto as Partial<TriagemRegras>) } : REGRAS_PADRAO;

  const horariosRemoto = configPorChave.agenda_disponibilidade;
  const agendaHorarios = Array.isArray(horariosRemoto) && horariosRemoto.length ? (horariosRemoto as string[]) : ["09:00", "10:00", "11:00", "14:00", "15:00", "16:30"];
  const bloqueadosRemoto = configPorChave.agenda_dias_bloqueados;
  const agendaDiasBloqueados = Array.isArray(bloqueadosRemoto) ? (bloqueadosRemoto as string[]) : [];

  const messages = (messagesResult.data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    type: m.type,
    docName: m.doc_name,
    duration: m.duration,
    transcricao: m.transcricao,
    time: m.time,
    createdAt: m.created_at,
    readAt: m.read_at,
    seq: m.seq,
  }));

  return {
    client: {
      id: clientResult.data.id,
      name: clientResult.data.name,
      email: clientResult.data.email,
      phone: clientResult.data.phone,
      taxType: clientResult.data.tax_type,
      status: clientResult.data.status,
      honorarios: clientResult.data.honorarios,
      recorrente: clientResult.data.recorrente,
      recorrenteTipo: clientResult.data.recorrente_tipo,
      onboardingPendente: clientResult.data.onboarding_pendente,
      caixaPostalNovas: !!clientResult.data.caixa_postal_novas,
      cpf: clientResult.data.cpf,
      endereco: clientResult.data.endereco,
      numero: clientResult.data.numero,
      bairro: clientResult.data.bairro,
      cidade: clientResult.data.cidade,
      estado: clientResult.data.estado,
      cep: clientResult.data.cep,
      atendimentoModalidade: clientResult.data.atendimento_modalidade,
    },
    contador,
    messages,
    unreadMessages: messages.filter((m) => m.sender === "agent" && !m.readAt).length,
    appointments: (appointmentsResult.data ?? []).map((a) => ({ id: a.id, date: a.date, time: a.time, status: a.status, taxType: a.tax_type })),
    atendimentosExpress: (expressResult.data ?? []).map((e) => ({
      id: e.id,
      servicoId: e.servico_id,
      assunto: e.assunto,
      status: e.status,
      contratadoEm: e.contratado_em,
      prazoConclusaoEm: e.prazo_conclusao_em,
      concluidoEm: e.concluido_em,
    })),
    triagem: triagensResult.data && triagensResult.data.length
      ? (() => {
          const t = triagensResult.data[0];
          return { id: t.id, assunto: t.assunto, descricao: t.descricao, status: t.status, respostas: t.respostas, enviadaEm: t.enviada_at };
        })()
      : null,
    documents: (documentsResult.data ?? []).map((d) => ({ id: d.id, fileName: d.file_name, mime: d.mime, sizeBytes: d.size_bytes, uploadedBy: d.uploaded_by, createdAt: d.created_at, checklistItem: d.checklist_item, storagePath: d.storage_path })),
    mailbox: (mailResult.data ?? []).map((m) => ({ id: m.id, assunto: m.assunto, mensagem: m.mensagem, remetente: m.remetente, lida: m.lida, status: m.status, createdAt: m.created_at })),
    unreadMail: (mailResult.data ?? []).filter((m) => !m.lida).length,
    reports: (reportsResult.data ?? []).map((r) => ({
      id: r.id,
      titulo: r.titulo,
      status: r.status,
      tipoRelatorio: r.tipo_relatorio,
      entregueEm: r.entregue_em,
      createdAt: r.created_at,
      codigoValidacao: r.codigo_validacao,
      casoRef: r.caso_ref,
      clienteNome: r.cliente_nome,
      clienteCpf: r.cliente_cpf,
      problema: r.problema,
      solucao: r.solucao,
      oqueFeito: r.oque_feito,
      comoFeito: r.como_feito,
      pendencias: r.pendencias,
      contadorAssinatura: r.contador_assinatura,
      contadorNome: r.contador_nome,
      contadorCrc: r.contador_crc,
      versao: r.versao,
      prazoProximoPasso: r.prazo_proximo_passo,
      anexos: (anexosResult.data ?? []).filter((a) => a.relatorio_id === r.id).map((a) => ({ id: a.id, titulo: a.titulo, url: a.url, tipo: a.tipo })),
    })),
    avaliacoes: (avaliacoesResult.data ?? []).map((a) => ({ id: a.id, casoRef: a.caso_ref, relatorioId: a.relatorio_id, nota: a.nota, comentario: a.comentario, createdAt: a.created_at })),
    triagemCatalogo,
    triagemRegras,
    servicos: (servicosResult.data ?? []).map((s) => ({ id: s.id, name: s.name, priceCents: s.price_cents })),
    agendaHorarios,
    agendaDiasBloqueados,
    agendaOcupados: (ocupadosResult.data ?? []).filter((a): a is { date: string; time: string; status: string | null } => Boolean(a.date && a.time)).map((a) => ({ date: a.date, time: a.time })),
    agendaFiscal: clientResult.data.recorrente ? proximosVencimentos(obrigacoesResult.data ?? [], clientResult.data.tax_type) : [],
  };
}
