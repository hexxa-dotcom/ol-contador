import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

const HORARIOS_PADRAO = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:30"];

type Assunto = { id: string; titulo: string; resumo: string };

// GET /api/agendamento-opcoes — dados públicos da tela de agendamento (sem
// login). Existe porque o RLS bloqueia leitura anônima de
// servicos/agendamentos e a página de agendamento é pública. Devolve num
// request só tudo que a tela precisa: catálogo, horários e o que já está
// ocupado — sem isso dois visitantes conseguiriam marcar o mesmo horário.
export async function GET() {
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const hoje = new Date().toISOString().slice(0, 10);

  const [servicosRes, configRes, apptRes, assuntosRes, diasBloqueadosRes] = await Promise.all([
    // Só avulso: a assessoria MEI é mensal e passa pelo fluxo de recorrência,
    // não por este Pix único.
    admin.from("servicos").select("id,name,description,price_cents,price_agendado_cents,itens").eq("active", true).eq("recurrence", "avulso").order("price_cents"),
    admin.from("configuracoes").select("valor").eq("chave", "agenda_disponibilidade").maybeSingle(),
    // Só o pagamento confirmado vira linha em `agendamentos`, então é ela que
    // bloqueia horário — cobrança pendente continua liberando o slot.
    admin.from("agendamentos").select("date,time").neq("status", "done").gte("date", hoje),
    // Lista genérica — usada quando o plano ainda não tem `itens` cadastrados.
    admin.from("configuracoes").select("valor").eq("chave", "triagem_assuntos").maybeSingle(),
    // Feriados/folgas marcados pelo contador.
    admin.from("configuracoes").select("valor").eq("chave", "agenda_dias_bloqueados").maybeSingle(),
  ]);

  if (servicosRes.error) {
    await registrarErro(admin, {
      origem: "api/agendamento-opcoes",
      codigo: "db_error",
      mensagem: servicosRes.error.message,
      rota: "/api/agendamento-opcoes",
    });
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }

  const cfg = configRes.data?.valor;
  const horarios = Array.isArray(cfg) && cfg.length ? cfg : HORARIOS_PADRAO;

  const ocupados: Record<string, string[]> = {};
  (apptRes.data || []).forEach((a) => {
    if (!a.date || !a.time) return;
    (ocupados[a.date] ||= []).push(a.time);
  });

  const ITENS_PADRAO: Record<string, Assunto[]> = {
    pf: [
      { id: "cpf-pendente", titulo: "CPF cancelado, pendente de regularização ou suspenso", resumo: "Regularização de cadastro para contas e bancos" },
      { id: "malha-fina", titulo: "Caí na malha fina ou recebi intimação / carta da Receita", resumo: "Notificação, intimação ou pendência no e-CAC" },
      { id: "ir-declaracao", titulo: "Declaração de IR atrasada, omitida ou retificadora", resumo: "Envio de declarações em atraso ou correção de dados" },
      { id: "carne-leao", titulo: "Carnê-Leão e rendimentos de autônomo / exterior", resumo: "Apuração mensal, livro-caixa e emissão de DARF" },
      { id: "parcelamento-pf", titulo: "Parcelamento de dívidas fiscais e CND da Pessoa Física", resumo: "Negociação de débitos na Receita Federal e PGFN" },
      { id: "restituicao-travada", titulo: "Restituição de Imposto de Renda travada ou retida", resumo: "Identificação da pendência e liberação na Receita" },
      { id: "isencao-molestia", titulo: "Isenção de IRPF por moléstia / doença grave", resumo: "Processo de isenção e restituição retroativa" },
      { id: "outro", titulo: "Outra regularização de Pessoa Física", resumo: "Descreva sua situação com suas palavras" }
    ],
    "pj-atendimento": [
      { id: "parcelamento-pj", titulo: "Parcelamento de dívidas e débitos fiscais (Simples & PGFN)", resumo: "Negociação de débitos junto à Receita Federal e Procuradoria" },
      { id: "guias-das", titulo: "Guias DAS / impostos do MEI em atraso e recálculo", resumo: "Emissão, recálculo de juros e quitação" },
      { id: "dasn-simei", titulo: "Declaração Anual do MEI (DASN-SIMEI) em atraso", resumo: "Transmissão fora do prazo e regularização de multas" },
      { id: "cnpj-inapto", titulo: "CNPJ inapto, suspenso ou bloqueado no Simples Nacional", resumo: "Levantamento de omissões e reativação do CNPJ" },
      { id: "desenquadramento-mei", titulo: "Desenquadramento de MEI para Microempresa (ME)", resumo: "Excesso de faturamento ou transição de atividade" },
      { id: "cnd-pj", titulo: "Certidão Negativa de Débitos (CND) e desembaraço fiscal", resumo: "Emissão de certidões e regularidade cadastral da empresa" },
      { id: "outro", titulo: "Outra regularização de MEI ou Simples Nacional", resumo: "Descreva sua situação com suas palavras" }
    ],
    consulta: [
      { id: "abertura-empresa", titulo: "Abertura de Empresa / CNPJ completo", resumo: "Contrato social, Junta Comercial, CNPJ e alvarás" },
      { id: "baixa-cnpj", titulo: "Baixa e encerramento definitivo de CNPJ", resumo: "Distrato social e baixa em todos os órgãos" },
      { id: "decore", titulo: "Emissão de DECORE com registro CRC", resumo: "Comprovação de renda oficial para bancos e financiamentos" },
      { id: "gcap-venda", titulo: "Ganho de Capital (GCAP) — Venda de imóveis e bens", resumo: "Cálculo do imposto, apuração de lucro, isenções e DARF" },
      { id: "alteracao-contratual", titulo: "Alteração Contratual, troca de sócios ou CNAE", resumo: "Aditivo contratual e adequação cadastral" },
      { id: "multiplos-anos", titulo: "Regularização de múltiplos anos fiscais acumulados", resumo: "Levantamento e regularização histórica completa" },
      { id: "lucro-presumido-real", titulo: "Empresas de Lucro Presumido ou Lucro Real", resumo: "Demandas e consultoria para empresas de médio/grande porte" },
      { id: "planejamento", titulo: "Planejamento tributário e consultoria preventiva", resumo: "Estratégia legal de redução de carga tributária" },
      { id: "outro", titulo: "Outro projeto ou serviço sob medida", resumo: "Descreva seu caso com suas palavras" }
    ]
  };

  const servicos = (servicosRes.data || []).map((s) => {
    const padrao = ITENS_PADRAO[s.id] || ITENS_PADRAO.pf;
    return {
      ...s,
      itens: padrao,
    };
  });

  const diasBloqueadosCfg = diasBloqueadosRes.data?.valor;
  const diasBloqueados = Array.isArray(diasBloqueadosCfg) ? diasBloqueadosCfg : [];

  return NextResponse.json({ servicos, horarios, ocupados, diasBloqueados }, { headers: { "Cache-Control": "no-store" } });
}
