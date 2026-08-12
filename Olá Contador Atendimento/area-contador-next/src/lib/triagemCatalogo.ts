// Porte de triagem-catalogo.js (a REDE DE SEGURANÇA embutida). O conteúdo de
// verdade mora em configuracoes.triagem_assuntos — isto só entra em cena se o
// banco não responder ou a chave ainda não tiver sido preenchida.
export type TriagemPergunta = {
  id: string;
  label: string;
  tipo: "texto" | "textao" | "data" | "escolha" | "sim-nao";
  opcoes?: string[];
  dica?: string;
  opcional?: boolean;
};

export type TriagemAssunto = {
  id: string;
  titulo: string;
  resumo: string;
  icone: string;
  perguntas: TriagemPergunta[];
  documentos: string[];
};

export type TriagemRegras = { minimoRelato: number; obrigatoriaParaChat: boolean };

export const REGRAS_PADRAO: TriagemRegras = { minimoRelato: 20, obrigatoriaParaChat: false };

export const CATALOGO_PADRAO: TriagemAssunto[] = [
  {
    id: "malha-fina",
    titulo: "Caí na malha fina ou recebi uma carta da Receita",
    resumo: "Intimação, notificação ou aviso no e-CAC",
    icone: "triangle-alert",
    perguntas: [
      { id: "ano", label: "De qual ano é a declaração?", tipo: "texto", dica: "Costuma estar no topo da carta. Ex.: 2024" },
      { id: "motivo", label: "A carta diz o motivo?", tipo: "escolha", opcoes: ["Rendimentos que não declarei", "Despesas médicas", "Dependentes", "Aluguéis", "Não diz / não entendi"], dica: "Se não souber, tudo bem — o contador descobre na hora" },
      { id: "prazo", label: "A carta dá algum prazo?", tipo: "data", opcional: true, dica: "Se houver data limite, ela muda a ordem das coisas" },
      { id: "valor", label: "A Receita cobra algum valor?", tipo: "texto", opcional: true, dica: "Ex.: R$ 3.200,00" },
    ],
    documentos: ["Notificação da Receita", "Declaração do IR do ano citado", "Comprovante de Rendimentos", "CPF e RG"],
  },
  {
    id: "vendi-bem",
    titulo: "Vendi um imóvel, carro ou outro bem",
    resumo: "Venda com lucro pode gerar imposto",
    icone: "house-check",
    perguntas: [
      { id: "oque", label: "O que você vendeu?", tipo: "escolha", opcoes: ["Imóvel residencial", "Imóvel comercial", "Terreno", "Veículo", "Outro bem"] },
      { id: "quando", label: "Quando foi a venda?", tipo: "data", dica: "A data importa: alguns prazos contam a partir dela" },
      { id: "valores", label: "Por quanto comprou e por quanto vendeu?", tipo: "texto", dica: "Ex.: comprei por 200 mil, vendi por 350 mil" },
      { id: "reinvestiu", label: "Comprou outro imóvel com esse dinheiro?", tipo: "sim-nao", opcional: true, dica: "Existe isenção em alguns casos — por isso a pergunta" },
    ],
    documentos: ["Escritura ou contrato de venda", "Documento da compra original", "Comprovantes de reformas", "CPF e RG"],
  },
  {
    id: "mei-pendencia",
    titulo: "Sou MEI e estou com pendências",
    resumo: "Guias atrasadas, declaração anual ou desenquadramento",
    icone: "store",
    perguntas: [
      { id: "oque", label: "Qual é a situação?", tipo: "escolha", opcoes: ["Tenho guias DAS atrasadas", "Não entreguei a declaração anual", "Faturei acima do limite", "Fui desenquadrado", "Não sei ao certo"] },
      { id: "desde", label: "Desde quando está assim?", tipo: "texto", opcional: true, dica: "Ex.: desde o começo de 2025" },
      { id: "faturamento", label: "Quanto faturou no último ano, mais ou menos?", tipo: "texto", opcional: true, dica: "Um número aproximado já ajuda" },
    ],
    documentos: ["CNPJ do MEI", "Guias DAS em aberto", "Extrato do Simples Nacional", "CPF e RG"],
  },
  {
    id: "autonomo",
    titulo: "Recebo como autônomo e não sei se pago certo",
    resumo: "Carnê-leão, INSS e recibos",
    icone: "user-clock",
    perguntas: [
      { id: "atividade", label: "Do que você trabalha?", tipo: "texto", dica: "Ex.: sou dentista, atendo em consultório próprio" },
      { id: "dequem", label: "Recebe de pessoas físicas ou de empresas?", tipo: "escolha", opcoes: ["Só de pessoas físicas", "Só de empresas", "Dos dois"], dica: "Isso muda quem tem obrigação de recolher" },
      { id: "recolhe", label: "Já recolhe o carnê-leão todo mês?", tipo: "sim-nao" },
    ],
    documentos: ["Recibos ou notas emitidas", "Extratos bancários do período", "Comprovantes de INSS", "CPF e RG"],
  },
  {
    id: "ir-atrasado",
    titulo: "Não declarei o IR ou declarei errado",
    resumo: "Declaração atrasada, retificação ou primeira vez",
    icone: "file-warning",
    perguntas: [
      { id: "situacao", label: "Qual é o caso?", tipo: "escolha", opcoes: ["Nunca declarei", "Atrasei a entrega", "Declarei com erro e quero corrigir", "Não sei se preciso declarar"] },
      { id: "anos", label: "De quais anos?", tipo: "texto", opcional: true, dica: "Ex.: 2023 e 2024" },
      { id: "multa", label: "Já recebeu alguma cobrança de multa?", tipo: "sim-nao", opcional: true },
    ],
    documentos: ["Comprovante de Rendimentos", "Informes bancários", "Declarações anteriores", "CPF e RG"],
  },
  {
    id: "outro",
    titulo: "Meu caso é outro",
    resumo: "Conte com suas palavras e o contador se prepara",
    icone: "message-circle",
    perguntas: [],
    documentos: ["CPF e RG"],
  },
];

export function acharAssunto(catalogo: TriagemAssunto[], id: string): TriagemAssunto | null {
  return catalogo.find((item) => item.id === id) || null;
}

// Porte de OC_TRIAGEM.completude — peso maior no relato, que é o que mais
// economiza tempo na hora do atendimento.
export function completude(
  triagem: { assunto: string | null; descricao: string | null; respostas: unknown } | null,
  catalogo: TriagemAssunto[],
  regras: TriagemRegras,
): number {
  if (!triagem || !triagem.assunto) return 0;
  const assunto = acharAssunto(catalogo, triagem.assunto);
  if (!assunto) return 0;
  const respostas = (triagem.respostas as Record<string, string>) || {};

  let pontos = 30;
  if ((triagem.descricao || "").trim().length >= (regras.minimoRelato || 20)) pontos += 30;

  const total = assunto.perguntas.length;
  if (total === 0) return Math.min(100, pontos + 40);
  const respondidas = assunto.perguntas.filter((p) => {
    const v = respostas[p.id];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  pontos += Math.round((respondidas / total) * 40);
  return Math.min(100, pontos);
}
