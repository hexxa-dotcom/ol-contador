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
      { id: "malha-fina", titulo: "Caí na malha fina ou recebi intimação / carta da Receita", resumo: "Notificação, intimação ou pendência no e-CAC" },
      { id: "cpf-pendente", titulo: "CPF cancelado, pendente de regularização ou suspenso", resumo: "Regularização de cadastro para contas e bancos" },
      { id: "ir-declaracao", titulo: "Declaração de IR atrasada, omitida ou retificadora", resumo: "Envio de declarações em atraso ou correção de dados" },
      { id: "gcap-venda", titulo: "Venda de imóvel, veículo ou Ganho de Capital (GCAP)", resumo: "Cálculo do imposto, apuração de lucro e isenções" },
      { id: "carne-leao", titulo: "Carnê-Leão e rendimentos de autônomo / exterior", resumo: "Apuração mensal, livro-caixa e DARF" },
      { id: "investimentos-cripto", titulo: "Criptomoedas, ações ou investimentos financeiros", resumo: "Apuração de operações, DARFs e bens" },
      { id: "exterior-adsense", titulo: "Rendimentos do exterior, trabalho remoto ou AdSense", resumo: "Tributação internacional e carnê-leão" },
      { id: "isencao-molestia", titulo: "Isenção de IRPF por moléstia / doença grave", resumo: "Processo de isenção e restituição retroativa" },
      { id: "restituicao-travada", titulo: "Restituição de Imposto de Renda travada", resumo: "Identificação do motivo e liberação na Receita" },
      { id: "espolio", titulo: "Declaração de espólio / herança e partilha de bens", resumo: "Declaração inicial, intermediária ou final" },
      { id: "parcelamento-pf", titulo: "Parcelamento de débitos e Certidão Negativa (CND)", resumo: "Negociação de débitos na Receita e PGFN" },
      { id: "outro", titulo: "Meu caso é outro", resumo: "Descreva seu caso com suas palavras" }
    ],
    "pj-atendimento": [
      { id: "guias-das", titulo: "Guias DAS / impostos do MEI em atraso", resumo: "Emissão, recálculo de juros e parcelamento" },
      { id: "dasn-simei", titulo: "Declaração Anual do MEI (DASN-SIMEI) pendente", resumo: "Transmissão fora do prazo e regularização" },
      { id: "desenquadramento-mei", titulo: "Desenquadramento de MEI para ME / Simples", resumo: "Excesso de faturamento ou transição de atividade" },
      { id: "cnpj-inapto", titulo: "CNPJ inapto, suspenso ou baixado na Receita", resumo: "Levantamento de omissões e reativação do CNPJ" },
      { id: "simples-rotina", titulo: "Dúvidas, cálculo e rotina fiscal do Simples Nacional", resumo: "Orientação fiscal e enquadramento de notas" },
      { id: "baixa-dividas", titulo: "Baixa ou encerramento de CNPJ com pendências", resumo: "Extinção regular e encerramento fiscal" },
      { id: "parcelamento-pj", titulo: "Parcelamento de dívidas fiscais e CND da empresa", resumo: "Negociação de débitos junto à Receita e PGFN" },
      { id: "socios-procuracoes", titulo: "Regularização de sócios e procuração eletrônica", resumo: "Ajustes societários e acesso ao e-CAC" },
      { id: "outro", titulo: "Meu caso é outro", resumo: "Descreva seu caso com suas palavras" }
    ],
    consulta: [
      { id: "diagnostico", titulo: "Diagnóstico fiscal e análise profunda do caso", resumo: "Parecer técnico detalhado sobre sua situação" },
      { id: "multiplos-anos", titulo: "Regularização de múltiplos anos fiscais em atraso", resumo: "Levantamento e regularização histórica completa" },
      { id: "planejamento", titulo: "Planejamento tributário para PF ou empresa", resumo: "Estratégia legal de redução de carga tributária" },
      { id: "outro", titulo: "Meu caso é outro", resumo: "Descreva seu caso com suas palavras" }
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
