export interface BlogAuthor {
  name: string;
  role: string;
  crc: string;
  bio: string;
}

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogCallout {
  type: "tip" | "warning" | "info" | "quote";
  title?: string;
  text: string;
}

export interface BlogTable {
  headers: string[];
  rows: string[][];
}

export interface BlogSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: BlogCallout;
  table?: BlogTable;
}

export interface BlogPost {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  description: string;
  category: "Contabilidade Sem Mensalidade" | "Imposto de Renda" | "Empresas & MEI" | "Dívida Ativa & Regularização";
  categorySlug: string;
  publishedAt: string;
  updatedAt: string;
  readTime: string;
  author: BlogAuthor;
  tags: string[];
  keyTakeaways: string[];
  content: BlogSection[];
  faqs: BlogFaq[];
  relatedSlugs: string[];
  cta: {
    badge: string;
    title: string;
    description: string;
    buttonText: string;
    buttonHref: string;
  };
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "contabilidade-sob-demanda-sem-mensalidade",
    title: "Contabilidade Sob Demanda: O que é, como funciona e por que você não precisa pagar mensalidade",
    subtitle: "Entenda o modelo sem mensalidade fixa com contadores de verdade com CRC para resolver demandas pontuais.",
    excerpt: "Você não precisa ficar preso a uma mensalidade contábil de R$ 300 a R$ 800 todos os meses se só precisa de suporte esporádico. Conheça a contabilidade sob demanda com preço fixo por atendimento.",
    description: "Guia completo sobre contabilidade sob demanda: como funciona o atendimento sem mensalidade, garantia de devolução, parecer técnico com CRC e comparativo de custos.",
    category: "Contabilidade Sem Mensalidade",
    categorySlug: "contabilidade-sem-mensalidade",
    publishedAt: "2026-09-01T08:00:00-03:00",
    updatedAt: "2026-09-04T18:00:00-03:00",
    readTime: "6 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em direito tributário e contabilidade sob demanda para pessoas físicas e pequenas empresas.",
    },
    tags: ["contabilidade sob demanda", "preço fixo", "sem mensalidade", "contador online", "relatório crc"],
    keyTakeaways: [
      "A contabilidade tradicional cobra mensalidade mesmo nos meses em que o cliente não tem movimentação ou dúvidas.",
      "No modelo sob demanda, você só paga quando tem um problema real a resolver (R$ 199 para PF, R$ 399 para PJ).",
      "Todo atendimento gera um parecer técnico assinado por contador habilitado no CRC com valor legal.",
      "Se o contador avaliar o caso e constatar que não há solução viável, o valor pago é devolvido em 100% integralmente.",
      "Ideal para autônomos, prestadores de serviço, sócios de empresas inativas e pessoas físicas com pendências fiscais."
    ],
    content: [
      {
        id: "o-que-e-modelo-tradicional-vs-demanda",
        heading: "1. O dilema da mensalidade contábil obrigatória",
        paragraphs: [
          "Durante décadas, o mercado contábil brasileiro operou sob um único modelo comercial: a mensalidade fixa. Seja você uma grande indústria ou um profissional autônomo que emite apenas uma nota fiscal por trimestre, os escritórios tradicionais costumam cobrar honorários recorrentes de R$ 350 a mais de R$ 1.200 todo santo mês.",
          "Para empresas com folha de pagamento densa e dezenas de obrigações acessórias mensais (como EFD-Reinf, DCTFWeb e SPED Fiscal), esse modelo faz sentido. No entanto, para a imensa maioria dos brasileiros — pessoas físicas com pendências de IRPF, microempreendedores, médicos, programadores, advogados e quem vendeu um imóvel —, a mensalidade é um custo fixo desnecessário.",
          "A Contabilidade Sob Demanda surge exatamente para romper essa barreira: você contrata e paga somente pelo serviço específico que precisa, com escopo definido, preço fixo e garantia de resolução."
        ],
        callout: {
          type: "tip",
          title: "Economia Real",
          text: "Um profissional que paga R$ 400 de mensalidade contábil gasta R$ 4.800 por ano. Na contabilidade sob demanda, se você tiver apenas 2 demandas no ano (ex: declaração anual de IR e uma consulta fiscal), seu gasto total fica em torno de R$ 398."
        }
      },
      {
        id: "como-funciona-atendimento-passo-a-passo",
        heading: "2. Como funciona na prática um atendimento sob demanda?",
        paragraphs: [
          "O fluxo foi desenhado para eliminar burocracia, reuniões demoradas e termos incompreensíveis de contabilidade:",
          "Você não precisa saber os termos técnicos da Receita Federal. O cliente simplesmente relata com suas próprias palavras o que aconteceu — por exemplo: 'recebi uma notificação do e-CAC', 'vendi um apartamento e quero apurar ganho de capital' ou 'preciso desenquadrar do MEI'."
        ],
        bullets: [
          "Escolha do serviço com preço fixo divulgado com antecedência e transparência.",
          "Opção entre Atendimento Express (mais ágil, resposta em até 1 dia útil sem precisar de reunião) ou Agendamento com hora marcada.",
          "Upload seguro dos documentos diretamente pelo celular ou computador.",
          "Análise técnica realizada por contador com CRC ativo com emissão de diagnóstico completo.",
          "Recebimento de Parecer Técnico Contábil formal em PDF, timbrado e assinado digitalmente."
        ]
      },
      {
        id: "tabela-comparativa-modelos",
        heading: "3. Comparativo direto: Contabilidade Tradicional vs. Olá, Contador",
        paragraphs: [
          "Veja as principais diferenças estruturais entre os modelos de contratação no Brasil:"
        ],
        table: {
          headers: ["Característica", "Escritório Tradicional", "Plataforma Sob Demanda"],
          rows: [
            ["Custo Financeiro", "R$ 350 a R$ 900 / mês (R$ 4.200 a R$ 10.800/ano)", "Preço fixo por serviço (R$ 199 a R$ 399)"],
            ["Contrato e Fidelidade", "Contrato anual com multa de rescisão", "Sem contrato, sem fidelidade, use quando quiser"],
            ["Assinatura e CRC", "Geralmente apenas em balanços anuais", "Parecer técnico assinado com CRC em cada caso"],
            ["Garantia de Devolução", "Raramente oferecida", "100% de reembolso se não pudermos ajudar"],
            ["Forma de Atendimento", "E-mails lentos ou reuniões presenciais", "Chat seguro e portal do cliente em tempo real"]
          ]
        }
      },
      {
        id: "validade-juridica-e-seguranca",
        heading: "4. Validade jurídica e segurança do parecer técnico",
        paragraphs: [
          "Uma dúvida muito comum de quem contrata contabilidade online é sobre a confiabilidade do trabalho. No Olá, Contador, todo atendimento é conduzido exclusivamente por profissionais habilitados junto ao Conselho Regional de Contabilidade (CRC).",
          "O relatório final não é uma simples mensagem de chat: é um documento formal com selo de autenticidade, histórico da operação, memória de cálculo detalhada e a fundamentação legal embasada nas instruções normativas vigentes da Receita Federal do Brasil."
        ],
        callout: {
          type: "warning",
          title: "Atenção ao escolher contador",
          text: "Exija sempre o número de registro no CRC de quem analisa suas finanças. O exercício ilegal da profissão contábil coloca em risco seu patrimônio e sua situação cadastral perante o Fisco."
        }
      }
    ],
    faqs: [
      {
        question: "Preciso ter empresa aberta (CNPJ) para usar a contabilidade sob demanda?",
        answer: "Não. Atendemos pessoas físicas para questões de malha fina, imposto de renda, ganho de capital em imóveis/veículos, previdência e profissionais liberais autônomos. Se tiver CNPJ (MEI, Simples Nacional ou Ltda), temos o plano dedicado para Pessoa Jurídica."
      },
      {
        question: "O que acontece se o contador não conseguir resolver minha pendência?",
        answer: "Temos garantia incondicional de devolução de 100% do valor. Se após a análise documental nosso contador identificar que não há recurso ou alternativa viável, você é reembolsado integralmente."
      },
      {
        question: "Qual o prazo de resposta do atendimento?",
        answer: "No Atendimento Express, o prazo padrão de resolução é de até 1 dia útil para pessoa física e 2 dias úteis para empresas, contado a partir do envio dos documentos necessários."
      },
      {
        question: "Como posso conferir a autenticidade do relatório emitido?",
        answer: "Cada parecer técnico conta com um código identificador único que pode ser validado publicamente em nossa página de validação oficial (/validar-relatorio)."
      }
    ],
    relatedSlugs: [
      "como-sair-da-malha-fina-irpf",
      "autonomo-mei-ou-simples-nacional-qual-escolher",
      "radar-fiscal-consultar-dividas-receita-pgfn"
    ],
    cta: {
      badge: "Preço Fixo Sem Mensalidade",
      title: "Tem uma dúvida fiscal ou pendência para resolver hoje?",
      description: "Fale diretamente com nossos contadores certificados. Atendimento rápido, preço fixo e garantia total de devolução.",
      buttonText: "Resolver meu caso agora",
      buttonHref: "/precos"
    }
  },
  {
    slug: "radar-fiscal-consultar-dividas-receita-pgfn",
    title: "Radar Fiscal: Como consultar dívidas na Receita Federal, PGFN e Prefeituras antes de virar execução",
    subtitle: "Aprenda a monitorar sua situação cadastral e fiscal continuamente e evite bloqueios de conta bancária.",
    excerpt: "Descobrir uma dívida tributária só quando a conta bancária é bloqueada é o pior pesadelo do contribuinte. Conheça o Radar Fiscal e veja como acompanhar suas certidões e Caixa Postal do e-CAC.",
    description: "Saiba como funciona o monitoramento fiscal de CPF e CNPJ: consulta de certidões CND/CPEND, mensagens da Caixa Postal e-CAC, dívida ativa da PGFN e parcelamentos.",
    category: "Dívida Ativa & Regularização",
    categorySlug: "divida-ativa-regularizacao",
    publishedAt: "2026-09-02T09:00:00-03:00",
    updatedAt: "2026-09-04T18:00:00-03:00",
    readTime: "7 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em auditoria fiscal, SITFIS e parcelamentos especiais da Receita Federal e PGFN.",
    },
    tags: ["radar fiscal", "certidão negativa", "cnd", "pgfn", "ecac", "caixa postal", "regularize"],
    keyTakeaways: [
      "A Receita Federal notifica cobranças na Caixa Postal do e-CAC com contagem de prazo processual automática de 15 dias.",
      "Se não houver leitura no e-CAC, a intimação é considerada feita por edital, gerando inscrição em dívida ativa sem o contribuinte saber.",
      "A Certidão Negativa de Débitos (CND) pode ser emitida como Positiva com Efeitos de Negativa (CPEND) quando há parcelamento ativo.",
      "Monitorar o CPF/CNPJ periodicamente previne bloqueios de faturamento, travamento de emissão de NF e penhora judicial SISBAJUD.",
      "O Radar Fiscal faz essa varredura contínua de forma automatizada e emite alertas antes do vencimento dos prazos de defesa."
    ],
    content: [
      {
        id: "por-que-dividas-aparecem-sem-aviso",
        heading: "1. Por que as dívidas fiscais aparecem 'do nada'?",
        paragraphs: [
          "Muitos empresários e pessoas físicas são surpreendidos ao descobrir que seu CPF está com status de 'Pendente de Regularização' ou que seu CNPJ perdeu a Certidão Negativa de Débitos (CND).",
          "A razão é simples: a Receita Federal e a Procuradoria-Geral da Fazenda Nacional (PGFN) não enviam mais cartas de cobrança em papel pelos Correios para a maioria dos casos. Todas as intimações, avisos de divergência de GFIP, débitos de DCTFWeb e cobranças de Simples Nacional são depositadas eletronicamente na Caixa Postal do portal e-CAC.",
          "De acordo com a legislação fiscal brasileira, 15 dias após o envio da mensagem na Caixa Postal do e-CAC, a ciência do contribuinte é considerada automática e presumida, iniciando a contagem dos prazos de defesa e eventual inscrição em Dívida Ativa da União."
        ],
        callout: {
          type: "warning",
          title: "O Perigo da Ciência Ficta",
          text: "Ignorar a caixa postal do e-CAC não impede a cobrança. Decorrido o prazo legal, a dívida é transferida para a PGFN com acréscimo de 20% de encargos legais e registro no CADIN."
        }
      },
      {
        id: "o-que-e-o-radar-fiscal",
        heading: "2. O que é o Radar Fiscal e como ele protege seu CPF/CNPJ?",
        paragraphs: [
          "O Radar Fiscal funciona como uma espécie de 'vigilante contínuo' da sua saúde tributária perante os órgãos governamentais. Em vez de você precisar lembrar de acessar o e-CAC com certificado digital ou senha gov.br toda semana, o sistema faz essa checagem automática.",
          "Os pilares do monitoramento incluem:"
        ],
        bullets: [
          "Varredura semanal da Caixa Postal do e-CAC para identificar avisos e intimações antes do prazo limite.",
          "Emissão e acompanhamento contínuo da CND (Certidão Negativa) ou CPEND (Positiva com Efeitos de Negativa).",
          "Consulta da situação cadastral e de débitos fiscais consolidados (SITFIS).",
          "Acompanhamento de parcelamentos tributários ativos (Simples Nacional, MEI, PGFN/SISPAR).",
          "Emissão preventiva de guias mensais para evitar cancelamento de parcelamentos por atraso."
        ]
      },
      {
        id: "etapas-de-uma-cobranca-tributaria",
        heading: "3. As etapas de uma dívida fiscal: Da divergência à execução",
        paragraphs: [
          "Entender a linha do tempo de uma cobrança tributária é essencial para agir na hora certa:"
        ],
        table: {
          headers: ["Fase", "Órgão Responsável", "Consequência", "Ação Recomendada"],
          rows: [
            ["1. Divergência Declaratória", "Receita Federal (e-CAC)", "Notificação na caixa postal", "Retificar declaração ou pagar diferença"],
            ["2. Débito em Cobrança", "Receita Federal (SITFIS)", "Impossibilidade de emitir CND", "Solicitar parcelamento ordinário"],
            ["3. Inscrição em Dívida Ativa", "PGFN (Portal REGULARIZE)", "Acréscimo de 20% de encargos + CADIN", "Negociação via Transação Tributária"],
            ["4. Execução Fiscal Judicial", "Justiça Federal / Estadual", "Bloqueio de contas (SISBAJUD) e bens", "Defesa jurídica / Embargos à execução"]
          ]
        }
      },
      {
        id: "como-manter-sua-empresa-regular",
        heading: "4. Como regularizar e manter sua situação em dia",
        paragraphs: [
          "Se você já possui pendências ou recebeu uma notificação, o primeiro passo é extrair o Relatório de Situação Fiscal (SITFIS). Nele constam com exatidão o código da receita, o período de apuração, a data de vencimento e se o débito está na Receita Federal ou se já foi enviado para a Procuradoria.",
          "Com esses dados em mãos, um contador avalia se o débito é legítimo (caso em que se recomenda o parcelamento em até 60 vezes) ou se decorre de erro na transmissão de obrigações acessórias (como DCTF ou PGDAS-D sem baixa de pagamento)."
        ],
        callout: {
          type: "tip",
          title: "Dica de Especialista",
          text: "Nunca pague uma guia de dívida ativa sem antes verificar se o débito não prescreveu (mais de 5 anos sem cobrança judicial) ou se não houve pagamento em duplicidade."
        }
      }
    ],
    faqs: [
      {
        question: "O que é procuração eletrônica da Receita Federal e é seguro conceder?",
        answer: "A procuração eletrônica é outorgada diretamente dentro do portal e-CAC da Receita Federal com certificado ou gov.br. Ela permite apenas consulta de certidões e leitura de mensagens, sem dar poderes para movimentar contas bancárias ou assumir compromissos em seu nome."
      },
      {
        question: "Quem tem MEI precisa monitorar certidões?",
        answer: "Sim! O MEI que acumula dívidas no DAS pode ser desenquadrado do regime simplificado e ter o CNPJ baixado de ofício pela Receita Federal, transferindo a dívida diretamente para o CPF do titular."
      },
      {
        question: "Qual a diferença entre CND e CPEND?",
        answer: "CND é a Certidão Negativa de Débitos (quando não existe nenhuma pendência). CPEND é a Certidão Positiva com Efeitos de Negativa, emitida quando há débitos, mas eles estão com exigibilidade suspensa (por exemplo, devidamente parcelados e em dia). Para licitações e empréstimos bancários, ambas têm o mesmo valor legal."
      }
    ],
    relatedSlugs: [
      "divida-ativa-da-uniao-como-consultar-e-parcelar-pgfn",
      "como-sair-da-malha-fina-irpf",
      "contabilidade-sob-demanda-sem-mensalidade"
    ],
    cta: {
      badge: "Diagnóstico Fiscal Completo",
      title: "Suspeita de dívida no CPF ou CNPJ? Descubra agora",
      description: "Nosso serviço de Radar Fiscal emite o diagnóstico completo da Receita Federal e PGFN com plano de ação claro para regularização imediata.",
      buttonText: "Consultar meu caso",
      buttonHref: "/radar"
    }
  },
  {
    slug: "como-sair-da-malha-fina-irpf",
    title: "Caí na Malha Fina do Imposto de Renda: O guia definitivo para sair sem pagar multas indevidas",
    subtitle: "Entenda os principais motivos de retenção da declaração e como retificar seu IRPF com rapidez.",
    excerpt: "Cair na malha fina do Imposto de Renda assusta, mas a maioria das pendências pode ser resolvida rapidamente com retificação ou comprovação documental. Veja o passo a passo com contador.",
    description: "Guia completo sobre Malha Fina da Receita Federal: como consultar o extrato de processamento, tipos de inconsistências (médicas, dependentes, omissão), retificação e como evitar multas de 75%.",
    category: "Imposto de Renda",
    categorySlug: "imposto-de-renda",
    publishedAt: "2026-09-03T10:00:00-03:00",
    updatedAt: "2026-09-04T18:00:00-03:00",
    readTime: "8 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em declaração de ajuste anual, malha fiscal de IRPF e regularização cadastral perante a Receita Federal.",
    },
    tags: ["malha fina", "imposto de renda", "irpf", "retificadora", "restituicao", "receita federal", "pendencia cpf"],
    keyTakeaways: [
      "A malha fina ocorre quando há divergência entre o que você declarou e o que terceiros (empresas, bancos, planos de saúde) informaram à Receita.",
      "Enquanto a declaração estiver em análise na malha fiscal, sua restituição de imposto de renda fica retida.",
      "Se você agir antes de receber o Termo de Intimação formal, pode enviar Declaração Retificadora sem pagar qualquer multa de ofício.",
      "As causas mais frequentes são: despesas médicas sem recibo idôneo, dependentes informados por mais de um declarante e omissão de rendimentos de aluguel ou bicos.",
      "Contar com o apoio de um contador garante que os documentos comprobatórios sejam enviados no padrão exigido pelo e-CAC."
    ],
    content: [
      {
        id: "o-que-e-malha-fina",
        heading: "1. O que realmente acontece quando você cai na malha fina?",
        paragraphs: [
          "A chamada 'Malha Fiscal da Pessoa Física' nada mais é do que um cruzamento massivo e automatizado de dados realizado pelos supercomputadores da Receita Federal.",
          "Quando você envia a sua declaração de IRPF, o sistema confronta suas informações com bases de dados externas: informes de rendimentos enviados pelas fontes pagadoras (DIRF/eSocial), declarações de serviços médicos (DMED), declarações de operações imobiliárias (DIMOB) e movimentações bancárias (e-Financeira).",
          "Se for encontrada qualquer discrepância de valores — mesmo que seja de centavos —, o processamento da sua declaração é travado e o status muda para 'Com Pendências'."
        ],
        callout: {
          type: "info",
          title: "Sua restituição fica presa",
          text: "Enquanto a pendência não for sanada, a Receita Federal não libera os lotes de restituição a que você teria direito."
        }
      },
      {
        id: "principais-motivos-de-retencao",
        heading: "2. Os 5 motivos mais comuns para cair na malha fina",
        paragraphs: [
          "Historicamente, mais de 80% das retenções em malha fiscal decorrem de cinco falhas previsíveis:"
        ],
        bullets: [
          "Despesas Médicas: Valores lançados que diferem do que a clínica ou médico declarou na DMED, ou recibos que não contêm o CPF/CNPJ do prestador.",
          "Omissão de Rendimentos do Titular: Esquecer de declarar rendimentos de um segundo emprego, rescisão trabalhista ou previdência privada (PGBL).",
          "Omissão de Rendimentos de Dependentes: Incluir filho estagiário ou cônjuge como dependente sem somar a remuneração ou bolsa que ele recebeu no ano.",
          "Aluguéis Recebidos: Não recolher o Carnê-Leão mensal e não informar os aluguéis recebidos de pessoas físicas ou imobiliárias.",
          "Incompatibilidade com o Ganho de Capital: Venda de imóveis ou ações em bolsa sem a devida apuração do imposto através do GCAP no mês da operação."
        ]
      },
      {
        id: "como-consultar-e-resolver",
        heading: "3. Passo a passo para consultar e resolver sua situação",
        paragraphs: [
          "Para verificar o motivo exato da retenção, acesse o portal e-CAC com sua conta gov.br (nível Prata ou Ouro), entre em 'Meu Imposto de Renda' e clique na aba 'Processamento' > 'Pendências de Malha'.",
          "A partir daí, existem dois caminhos possíveis:"
        ],
        bullets: [
          "Cenário A (Você errou ou esqueceu algo): Basta fazer uma Declaração Retificadora corrigindo os dados. A declaração volta para a fila de processamento sem multa.",
          "Cenário B (Você está certo e tem os comprovantes): Você pode antecipar a entrega de documentos no e-CAC através de um processo digital, enviando laudos, notas fiscais e comprovantes bancários de pagamento."
        ],
        callout: {
          type: "warning",
          title: "Cuidado com o Termo de Intimação",
          text: "Se a Receita Federal emitir uma Notificação de Lançamento formal antes de você retificar, a multa de ofício é de 75% sobre o imposto devido (podendo chegar a 150% se houver indício de fraude)."
        }
      },
      {
        id: "quando-contratar-um-contador",
        heading: "4. Por que contar com um contador especialista em IRPF?",
        paragraphs: [
          "Montar um dossiê comprobatório para a Receita Federal exige atenção aos detalhes: comprovantes precisam ser legíveis, notas de telemedicina exigem prescrição associada e declarações retificadoras não podem alterar a opção de tributação (Deduções Legais vs. Desconto Simplificado) após o prazo legal.",
          "No Olá, Contador, nosso atendimento para Pessoa Física analisa sua notificação, elabora a retificação ou protocola a defesa no e-CAC com parecer técnico assinado por profissional credenciado no CRC por um preço fixo de R$ 199."
        ]
      }
    ],
    faqs: [
      {
        question: "Cair na malha fina significa que vou ser multado imediatamente?",
        answer: "Não. A malha fina inicial é apenas uma oportunidade para você corrigir inconsistências. As multas punitivas só incidem caso a Receita Federal faça a autuação formal e você não apresente documentos idôneos dentro do prazo."
      },
      {
        question: "Quanto tempo demora para a Receita processar a declaração retificadora?",
        answer: "Em média, a análise da retificadora leva de 2 a 8 semanas quando não há novas divergências. Após a aprovação, a restituição entra no lote residual subsequente."
      },
      {
        question: "Posso retificar declarações de anos anteriores?",
        answer: "Sim, você pode retificar declarações de até 5 anos anteriores, desde que a Receita Federal ainda não tenha instaurado procedimento de fiscalização formal contra o ano em questão."
      }
    ],
    relatedSlugs: [
      "contabilidade-sob-demanda-sem-mensalidade",
      "radar-fiscal-consultar-dividas-receita-pgfn",
      "autonomo-mei-ou-simples-nacional-qual-escolher"
    ],
    cta: {
      badge: "Regularização de IRPF",
      title: "Declaração presa na malha fina ou CPF pendente?",
      description: "Conte o seu caso para nossa equipe. Analisamos sua notificação e enviamos a solução completa por preço fixo e sem mensalidade.",
      buttonText: "Destravar meu Imposto de Renda",
      buttonHref: "/precos"
    }
  },
  {
    slug: "autonomo-mei-ou-simples-nacional-qual-escolher",
    title: "Autônomo, MEI ou Simples Nacional: Qual a melhor opção para pagar menos impostos legalmente?",
    subtitle: "Compare a tributação de Pessoa Física, Microempreendedor Individual e ME para economizar na prestação de serviços.",
    excerpt: "Trabalhar como autônomo na pessoa física pode fazer você pagar até 27,5% de IRPF mais 20% de INSS. Veja quando vale a pena abrir MEI ou migrar para o Simples Nacional.",
    description: "Comparativo completo de impostos: Autônomo Pessoa Física vs MEI vs Simples Nacional. Entenda tabela de alíquotas, Carnê-Leão, Fator R e como formalizar seu negócio.",
    category: "Empresas & MEI",
    categorySlug: "empresas-mei",
    publishedAt: "2026-09-04T09:00:00-03:00",
    updatedAt: "2026-09-04T18:00:00-03:00",
    readTime: "7 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em planejamento tributário para prestadores de serviços, PJs e microempresas.",
    },
    tags: ["mei", "simples nacional", "autonomo", "planejamento tributario", "abrir empresa", "impostos servicos"],
    keyTakeaways: [
      "Profissionais autônomos que faturam acima de R$ 4.000/mês na pessoa física quase sempre pagam mais imposto do que se tivessem um CNPJ.",
      "O MEI possui taxa fixa mensal (em torno de R$ 75 a R$ 80), mas tem limite de faturamento anual de R$ 81.000 e veda diversas profissões intelectuais regulamentadas.",
      "Atividades como medicina, advocacia, engenharia, psicologia e desenvolvimento de software não podem ser MEI por força de lei.",
      "No Simples Nacional (Microempresa), através do mecanismo do 'Fator R', a alíquota de impostos sobre serviços pode começar em apenas 6% em vez de 15,5%.",
      "Um diagnóstico contábil prévio evita o erro comum de abrir o tipo societário errado ou pagar impostos em duplicidade."
    ],
    content: [
      {
        id: "o-peso-dos-tributos-na-pessoa-fisica",
        heading: "1. O alto custo de atuar como autônomo (Pessoa Física)",
        paragraphs: [
          "Muitos profissionais liberais e freelancers iniciam suas carreiras recebendo na conta bancária física sem saber que estão sujeitos à tabela progressiva do Imposto de Renda Pessoa Física (IRPF), que atinge rapidamente a alíquota máxima de 27,5%.",
          "Além do imposto de renda mensal apurado pelo programa Carnê-Leão da Receita Federal, o profissional autônomo é obrigado por lei a recolher 20% sobre sua remuneração a título de contribuição previdenciária ao INSS (respeitado o teto previdenciário).",
          "Somando IRPF + INSS + ISS Municipal, a carga tributária total de um autônomo pode ultrapassar 35% do seu faturamento bruto."
        ]
      },
      {
        id: "quando-o-mei-vale-a-pena",
        heading: "2. O Microempreendedor Individual (MEI): Vantagens e limitações",
        paragraphs: [
          "O MEI é a porta de entrada da formalização no Brasil. Com custo fixo mensal muito baixo (guia DAS em torno de R$ 75 a R$ 80), ele isenta a empresa de impostos federais (IRPJ, CSLL, PIS, Cofins).",
          "Porém, o MEI possui restrições rígidas que muitos desconhecem:"
        ],
        bullets: [
          "Limite de faturamento anual de até R$ 81.000 (ou proporcional no ano de abertura).",
          "Permissão para contratar no máximo 1 empregado.",
          "Vedação expressa a atividades regulamentadas e de cunho intelectual/científico (como médicos, arquitetos, advogados, consultores e programadores).",
          "O titular não pode ser sócio ou administrador de qualquer outra empresa."
        ],
        callout: {
          type: "warning",
          title: "Risco de Desenquadramento",
          text: "Ultrapassar o limite de faturamento do MEI sem realizar a comunicação tempestiva pode gerar cobrança retroativa de impostos pelo Simples Nacional com juros e multas pesadas."
        }
      },
      {
        id: "o-simples-nacional-e-o-fator-r",
        heading: "3. Simples Nacional: A melhor alternativa para quem não pode ser MEI",
        paragraphs: [
          "Para quem ultrapassa o teto do MEI ou exerce atividade intelectual, a Microempresa (ME) enquadrada no Simples Nacional é geralmente a alternativa mais vantajosa.",
          "No Simples, todos os tributos (municipais, estaduais e federais) são unificados em uma única guia mensal (DAS). Para prestadores de serviço, a chave da economia é o chamado **Fator R**:",
          "Se a sua folha de pagamento (incluindo o pró-labore dos sócios) representar 28% ou mais do seu faturamento, sua empresa é tributada pelo Anexo III (alíquota inicial de **6%**). Se ficar abaixo de 28%, cai no Anexo V (alíquota inicial de **15,5%**)."
        ]
      },
      {
        id: "tabela-comparativa-de-custos",
        heading: "4. Comparativo de Custo Tributário para Faturamento de R$ 10.000 / mês",
        paragraphs: [
          "Veja a simulação prática de quanto sobra no seu bolso em cada formato:"
        ],
        table: {
          headers: ["Formato", "Tributação Estimada", "Imposto Mensal Médio", "Restrição Principal"],
          rows: [
            ["Pessoa Física (Autônomo)", "Carnê-Leão (até 27,5%) + INSS (20%)", "~ R$ 2.400 a R$ 2.800", "Sem limite, porém carga tributária muito alta"],
            ["MEI (quando permitido)", "Guia única fixa", "~ R$ 80", "Limite de R$ 6.750/mês e lista restrita de atividades"],
            ["Simples Nacional (com Fator R)", "Anexo III (6% inicial) + Pró-labore", "~ R$ 850 a R$ 1.100", "Exige controle contábil e emissão de pró-labore"],
            ["Simples Nacional (sem Fator R)", "Anexo V (15,5% inicial)", "~ R$ 1.550", "Sem exigência de folha mínima, mas alíquota maior"]
          ]
        }
      }
    ],
    faqs: [
      {
        question: "Quem é MEI precisa fazer Declaração de Imposto de Renda Pessoa Física?",
        answer: "Depende. O MEI tem a declaração anual da empresa (DASN-SIMEI) e pode precisar fazer a declaração de Pessoa Física se o lucro distribuído tributável ultrapassar o teto de isenção da Receita Federal."
      },
      {
        question: "Posso transformar meu MEI em Microempresa sem fechar o CNPJ?",
        answer: "Sim. O processo chama-se desenquadramento do MEI e mantém o mesmo número de CNPJ, histórico bancário e contratos vigentes."
      },
      {
        question: "Como funciona o suporte contábil para emissão de pró-labore no Olá, Contador?",
        answer: "Nosso atendimento para Pessoa Jurídica avalia sua composição de faturamento, calcula a proporção exata do Fator R e emite sua guia de pró-labore e DAS com garantia técnica por preço fixo e sem mensalidade."
      }
    ],
    relatedSlugs: [
      "contabilidade-sob-demanda-sem-mensalidade",
      "radar-fiscal-consultar-dividas-receita-pgfn",
      "divida-ativa-da-uniao-como-consultar-e-parcelar-pgfn"
    ],
    cta: {
      badge: "Planejamento Tributário Sob Demanda",
      title: "Quer pagar menos imposto na emissão das suas notas?",
      description: "Nossos contadores analisam seu caso e mostram a melhor estrutura societária para o seu perfil sem empurrar mensalidades.",
      buttonText: "Falar com um contador",
      buttonHref: "/precos"
    }
  },
  {
    slug: "divida-ativa-da-uniao-como-consultar-e-parcelar-pgfn",
    title: "Inscrição em Dívida Ativa da União: O que significa, prazos e como parcelar no portal REGULARIZE",
    subtitle: "Tudo o que você precisa saber sobre débitos transferidos para a PGFN e as vantagens da Transação Tributária.",
    excerpt: "Quando a dívida sai da Receita Federal e entra na Dívida Ativa da PGFN, o débito aumenta 20% e vai para cobrança judicial. Saiba como consultar e conseguir até 70% de desconto.",
    description: "Guia passo a passo sobre Dívida Ativa da União na PGFN: consulta pelo portal REGULARIZE, negociação por transação tributária, prazos antes do protesto e parcelamento.",
    category: "Dívida Ativa & Regularização",
    categorySlug: "divida-ativa-regularizacao",
    publishedAt: "2026-09-04T14:00:00-03:00",
    updatedAt: "2026-09-04T18:00:00-03:00",
    readTime: "6 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em regularização de dívida ativa da PGFN, certidões conjuntas e defesas administrativas.",
    },
    tags: ["divida ativa", "pgfn", "regularize", "transacao tributaria", "sispar", "desconto multas", "protesto"],
    keyTakeaways: [
      "A dívida ativa é a fase em que o crédito tributário é encaminhado pela Receita Federal aos procuradores da Fazenda Nacional para cobrança judicial.",
      "A inscrição automática acresce imediatamente 20% de Encargo Legal (Decreto-Lei 1.025/69) sobre o valor total consolidado.",
      "O órgão de negociação deixa de ser o e-CAC e passa a ser o portal REGULARIZE da PGFN.",
      "Programas de Transação Tributária permitem descontos de até 70% em juros e multas e prazos de pagamento de até 145 meses para ME, EPP e pessoas físicas.",
      "Negociar a dívida antes da citação judicial da Execução Fiscal evita custos adicionais com custas judiciais e penhora eletrônica."
    ],
    content: [
      {
        id: "o-que-e-a-divida-ativa-da-uniao",
        heading: "1. O que significa ter um débito inscrito em Dívida Ativa?",
        paragraphs: [
          "Quando um tributo federal (como IRPF, IRPJ, CSLL, PIS/Cofins, contribuição previdenciária ou DAS-MEI) não é pago no prazo e não há recurso administrativo pendente no e-CAC, a Receita Federal encerra o processo de cobrança amigável.",
          "O processo é então remetido à Procuradoria-Geral da Fazenda Nacional (PGFN), que emite a Certidão de Dívida Ativa (CDA) — um título executivo extrajudicial dotado de certeza e liquidez.",
          "A partir desse momento, a cobrança entra na esfera da PGFN e o devedor perde o acesso de negociação pelo e-CAC comum, passando a ser gerenciado exclusivamente no portal REGULARIZE."
        ],
        callout: {
          type: "warning",
          title: "O Custo Adicional dos 20%",
          text: "Pela legislação brasileira, toda inscrição em Dívida Ativa sofre a incidência imediata de 20% de encargos legais. Uma dívida de R$ 10.000 sobe imediatamente para R$ 12.000 antes mesmo de qualquer negociação."
        }
      },
      {
        id: "consequencias-da-inscricao-na-pgfn",
        heading: "2. Consequências práticas para o titular do CPF ou CNPJ",
        paragraphs: [
          "Estar com débito ativo na PGFN traz impactos imediatos na vida financeira e empresarial:"
        ],
        bullets: [
          "Inscrição no CADIN (Cadastro Informativo de Créditos não Quitados do Setor Público Federal), bloqueando empréstimos em bancos públicos (Caixa, Banco do Brasil, BNDES).",
          "Protesto em cartório de títulos, com negativação automática no Serasa e Boa Vista SCPC.",
          "Ajuizamento de Ação de Execução Fiscal na Justiça Federal.",
          "Ordem de penhora de valores em contas bancárias via sistema SISBAJUD (antigo BacenJud).",
          "Impossibilidade de obter Certidão Negativa de Débitos (CND), travando renovação de contratos e emissão de notas fiscais."
        ]
      },
      {
        id: "como-consultar-e-negociar-no-regularize",
        heading: "3. Como consultar e aproveitar as vantagens da Transação Tributária",
        paragraphs: [
          "A consulta de inscrições em Dívida Ativa pode ser feita diretamente no portal oficial REGULARIZE (regularize.pgfn.gov.br) através de certificado digital ou login gov.br nível Prata/Ouro.",
          "A grande vantagem de ter o débito na PGFN é a possibilidade de adesão à **Transação Tributária** por Adesão:",
          "Diferente do parcelamento convencional da Receita Federal (que apenas parcela o valor cheio com juros Selic), os editais de Transação da PGFN oferecem reduções reais de até 70% sobre os juros, multas e encargos legais para pessoas físicas, microempresas (ME) e empresas de pequeno porte (EPP), com entrada facilitada e pagamento em até 145 parcelas."
        ]
      },
      {
        id: "como-o-ola-contador-ajuda-na-negociacao",
        heading: "4. Acompanhamento e negociação por especialistas",
        paragraphs: [
          "Aderir a uma modalidade de transação inadequada pode gerar parcelas mensais insustentáveis ou perda dos benefícios de desconto por inadimplência posterior.",
          "No Olá, Contador, nossa equipe consulta a integridade dos seus débitos na base do SERPRO e PGFN, simula os cenários de desconto da Transação Tributária mais vantajosa para sua capacidade de pagamento e formaliza o acordo com emissão da guia inicial de pagamento."
        ],
        callout: {
          type: "tip",
          title: "Emissão de CPEND Imediata",
          text: "Assim que a primeira parcela da negociação é paga e compensada no sistema da PGFN, a Certidão Positiva com Efeitos de Negativa (CPEND) é liberada em até 48 horas úteis."
        }
      }
    ],
    faqs: [
      {
        question: "Dívida no MEI também vai para a Dívida Ativa da União?",
        answer: "Sim. Os débitos acumulados de DAS do MEI são repassados periodicamente pela Receita Federal para a PGFN e passam a ser cobrados com os acréscimos legais no portal REGULARIZE."
      },
      {
        question: "Qual o prazo para a dívida da Receita Federal prescrever?",
        answer: "O prazo prescricional para cobrança de tributos federais é de 5 anos contados da data da constituição definitiva do crédito tributário. No entanto, ações de cobrança e parcelamentos interrompem ou suspendem esse prazo."
      },
      {
        question: "Posso incluir débitos de anos diferentes no mesmo parcelamento?",
        answer: "Sim, a PGFN permite consolidar diversas inscrições em um único acordo de parcelamento ou transação tributária."
      }
    ],
    relatedSlugs: [
      "radar-fiscal-consultar-dividas-receita-pgfn",
      "como-sair-da-malha-fina-irpf",
      "contabilidade-sob-demanda-sem-mensalidade"
    ],
    cta: {
      badge: "Negociação PGFN",
      title: "Possui débitos inscritos em Dívida Ativa?",
      description: "Simulamos as melhores condições de parcelamento e descontos de até 70% da Transação Tributária para o seu CPF ou CNPJ.",
      buttonText: "Negociar minha dívida ativa",
      buttonHref: "/radar"
    }
  },
  {
    slug: "como-calcular-ganho-de-capital-venda-imovel-gcap",
    title: "Ganho de Capital na Venda de Imóveis: Como Calcular no GCAP, Prazos e Regras de Isenção",
    subtitle: "Entenda as alíquotas do imposto de renda sobre lucro imobiliário, a regra dos 180 dias e como emitir o DARF sem multas.",
    excerpt: "Vendeu um imóvel e teve lucro? Saiba como apurar o Ganho de Capital no programa GCAP da Receita Federal, as hipóteses legais de isenção e os prazos fatais para pagamento do imposto.",
    description: "Guia completo sobre Ganho de Capital na alienação de imóveis: como funciona o GCAP, prazos do DARF, fatores de redução da Lei 11.196/2005 e isenção de 180 dias.",
    category: "Imposto de Renda",
    categorySlug: "imposto-de-renda",
    publishedAt: "2026-09-05T09:00:00-03:00",
    updatedAt: "2026-09-05T09:00:00-03:00",
    readTime: "7 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em tributação sobre patrimônio imobiliário e apuração de ganho de capital para pessoas físicas.",
    },
    tags: ["ganho de capital", "gcap", "venda de imovel", "darf ganho de capital", "isencao 180 dias", "irpf"],
    keyTakeaways: [
      "O imposto sobre o lucro imobiliário NÃO é pago na declaração anual do ano seguinte, mas até o último dia útil do mês subsequente à venda.",
      "A alíquota inicial é de 15% sobre o ganho de capital líquido para lucros de até R$ 5 milhões.",
      "Quem vende imóvel residencial e compra outro residencial no Brasil em até 180 dias tem isenção total ou proporcional do IR.",
      "Imóveis adquiridos até 1969 são totalmente isentos de ganho de capital, e imóveis comprados entre 1969 e 1988 possuem percentuais crescentes de redução.",
      "Custos de corretagem, ITBI, reformas comprovadas com notas fiscais e juros de financiamento podem ser incorporados ao custo de aquisição para reduzir o imposto."
    ],
    content: [
      {
        id: "o-que-e-ganho-de-capital",
        heading: "1. O que é o Ganho de Capital e quando ele incide?",
        paragraphs: [
          "O Ganho de Capital é a diferença positiva entre o valor de alienação (venda) de um bem ou direito e o seu respectivo custo de aquisição (valor histórico declarado no IRPF).",
          "Se você comprou um apartamento por R$ 300.000 e vendeu por R$ 500.000, o seu ganho de capital bruto é de R$ 200.000. Sobre essa parcela incide o Imposto de Renda da Pessoa Física (IRPF), apurado por meio do software oficial da Receita Federal: o GCAP (Programa de Ganhos de Capital)."
        ],
        callout: {
          type: "warning",
          title: "Atenção ao Prazo Fatal do DARF",
          text: "Muitos contribuintes erram achando que só pagarão o imposto na declaração de ajuste anual do ano seguinte. O imposto de ganho de capital deve ser pago até o último dia útil do mês seguinte ao do recebimento da venda. Atrasos geram multa diária de 0,33% até 20% mais juros pela taxa SELIC."
        }
      },
      {
        id: "tabela-aliquotas-progressivas",
        heading: "2. Tabela de Alíquotas do Ganho de Capital",
        paragraphs: [
          "Desde a edição da Lei nº 13.259/2016, as alíquotas de ganho de capital para pessoas físicas são progressivas de acordo com o montante do lucro apurado:"
        ],
        table: {
          headers: ["Faixa de Ganho de Capital", "Alíquota do IRPF"],
          rows: [
            ["Até R$ 5.000.000,00", "15%"],
            ["De R$ 5.000.000,01 até R$ 10.000.000,00", "17,5%"],
            ["De R$ 10.000.000,01 até R$ 30.000.000,00", "20%"],
            ["Acima de R$ 30.000.000,00", "22,5%"]
          ]
        }
      },
      {
        id: "hipoteses-de-isencao-legal",
        heading: "3. Principais hipóteses de isenção de imposto na venda",
        paragraphs: [
          "A legislação prevê situações específicas em que o contribuinte é dispensado do recolhimento de imposto de renda sobre o ganho imobiliário:",
          "Conhecer essas exceções pode representar uma economia de dezenas de milhares de reais."
        ],
        bullets: [
          "Regra dos 180 dias (Art. 39 da Lei 11.196/2005): Isenção total ou proporcional para quem vende imóvel residencial e utiliza todo o produto da venda na aquisição de outro imóvel residencial no Brasil dentro do prazo improrrogável de 180 dias. Esse benefício só pode ser usufruído uma vez a cada 5 anos.",
          "Venda de único imóvel até R$ 440.000: Isento se o valor de venda for igual ou inferior a R$ 440 mil, desde que o contribuinte não tenha realizado outra alienação de imóvel nos últimos 5 anos.",
          "Bens de pequeno valor: Vendas de bens e direitos cujo valor total seja igual ou inferior a R$ 35.000 no mês são isentas.",
          "Imóveis adquiridos até 1969: Totalmente isentos por lei.",
          "Fatores de redução (FR1 e FR2): Imóveis adquiridos entre 1969 e 1988, ou entre 1988 e 2005, contam com coeficientes de redução que diminuem expressivamente a base de cálculo."
        ],
        callout: {
          type: "tip",
          title: "Despesas que Reduzem o Imposto",
          text: "Você tem o direito legal de abater da base de cálculo: a comissão de corretagem imobiliária comprovada, o imposto ITBI pago na compra, custos com escritura e registro de imóveis, e benfeitorias/reformas comprovadas com notas fiscais desde que incorporadas à declaração de bens."
        }
      },
      {
        id: "passo-a-passo-apuracao-gcap",
        heading: "4. Passo a passo para apurar no programa GCAP",
        paragraphs: [
          "O preenchimento do GCAP exige atenção aos detalhes para não cair na malha fina nem pagar tributo a mais:",
          "1. Faça o download do programa GCAP correspondente ao ano-calendário da alienação.",
          "2. Cadastre a operação na aba 'Bens Imóveis', informando dados da matrícula, cartório, data de aquisição e custo original.",
          "3. Informe se houve parcelamento ou pagamento à vista.",
          "4. Se for utilizar a isenção dos 180 dias, assinale o campo específico informando a intenção de compra do novo imóvel.",
          "5. O programa calculará o imposto devido e emitirá o DARF com código de receita 4600.",
          "6. Na declaração anual de ajuste seguinte, basta importar o arquivo gerado pelo GCAP direto no programa do IRPF."
        ]
      }
    ],
    faqs: [
      {
        question: "Vendi meu imóvel parcelado, quando pago o DARF?",
        answer: "No caso de venda a prazo ou em parcelas, o ganho de capital é tributado proporcionalmente a cada mês em que a parcela for recebida pelo vendedor."
      },
      {
        question: "Posso usar a isenção dos 180 dias para quitar financiamento de imóvel existente?",
        answer: "Sim, a Receita Federal alterou seu entendimento recente (Instrução Normativa RFB nº 2.070/2022) permitindo que o valor da venda seja utilizado na quitação total ou amortização de financiamento imobiliário residencial pré-existente no prazo de 180 dias."
      },
      {
        question: "E se eu não conseguir comprar o novo imóvel dentro dos 180 dias?",
        answer: "Se o prazo expirar sem a compra, o imposto se torna exigível retroativamente à data original da venda, incidindo multa de mora e juros SELIC acumulados desde o mês subsequente à alienação."
      },
      {
        question: "Como um contador pode me ajudar no ganho de capital?",
        answer: "O contador analisa sua escritura, contratos e comprovantes de reforma para maximizar todas as deduções legais possíveis e aplicar corretamente os fatores de redução, evitando que você pague imposto indevido ou seja autuado pela Receita."
      }
    ],
    relatedSlugs: [
      "como-sair-da-malha-fina-irpf",
      "radar-fiscal-consultar-dividas-receita-pgfn",
      "contabilidade-sob-demanda-sem-mensalidade"
    ],
    cta: {
      badge: "Apuração de Ganho de Capital",
      title: "Vendeu um imóvel ou está planejando vender?",
      description: "Nossa equipe calcula seu GCAP com parecer técnico assinado, aplica todas as deduções e isenções legais e emite sua memória de cálculo.",
      buttonText: "Apurar meu ganho de capital (R$ 199)",
      buttonHref: "/precos?servico=irpf"
    }
  },
  {
    slug: "cpf-suspenso-ou-pendente-regularizacao-como-resolver",
    title: "CPF Suspenso ou Pendente de Regularização: Causas, Riscos e Como Resolver Urgente",
    subtitle: "Entenda por que a Receita Federal bloqueia o documento, o perigo de contas bancárias congeladas e o passo a passo para regularizar.",
    excerpt: "Descubra o motivo exato do seu CPF estar pendente ou suspenso na Receita Federal, como consultar no portal e-CAC e como regularizar seu documento em poucas horas sem filas.",
    description: "Saiba como regularizar CPF suspenso ou pendente de regularização na Receita Federal: passo a passo no e-CAC, resolução de declarações de IRPF em atraso e desbloqueio bancário.",
    category: "Dívida Ativa & Regularização",
    categorySlug: "divida-ativa-regularizacao",
    publishedAt: "2026-09-05T09:30:00-03:00",
    updatedAt: "2026-09-05T09:30:00-03:00",
    readTime: "6 min de leitura",
    author: {
      name: "Equipe Técnica Olá, Contador",
      role: "Contadores Certificados com CRC Ativo",
      crc: "CRC/SC 042819/O",
      bio: "Especialistas em regularização cadastral e fiscal de pessoas físicas junto à Receita Federal do Brasil.",
    },
    tags: ["cpf irregular", "cpf suspenso", "cpf pendente de regularizacao", "receita federal", "regularizar cpf", "ecac"],
    keyTakeaways: [
      "A causa mais frequente de CPF Pendente de Regularização é a falta de entrega de alguma declaração de Imposto de Renda (IRPF) obrigatória nos últimos 5 anos.",
      "CPF Suspenso normalmente decorre de inconsistências cadastrais (nome divergente de certidão, data de nascimento errada ou ausência de título de eleitor).",
      "Um CPF irregular bloqueia abertura e movimentação de contas bancárias, recebimento de Pix, emissão de passaporte, financiamentos habitacionais e concursos públicos.",
      "A regularização pela entrega da declaração em atraso costuma restabelecer o status de 'Regular' no sistema da Receita Federal em até 48 a 72 horas.",
      "O Olá, Contador identifica a pendência exata através do e-CAC e elabora as retificações ou declarações necessárias para regularizar seu documento imediatamente."
    ],
    content: [
      {
        id: "diferenca-status-cpf",
        heading: "1. As diferenças entre CPF Regular, Pendente, Suspenso e Cancelado",
        paragraphs: [
          "Muitas pessoas confundem os status da situação cadastral do CPF no banco de dados da Receita Federal. Cada situação possui uma causa jurídica distinta e requer uma solução diferente:"
        ],
        table: {
          headers: ["Status do CPF", "Significado Legal", "Como Resolver"],
          rows: [
            ["Regular", "Cadastro sem pendências ativas conhecidas", "Nenhuma ação necessária"],
            ["Pendente de Regularização", "O contribuinte deixou de entregar pelo menos uma declaração de IRPF obrigatória nos últimos 5 anos", "Transmitir a declaração omissa ou retificadora correspondente"],
            ["Suspenso", "Informações cadastrais incorretas ou incompletas (nome, mãe, data de nascimento, título)", "Pedido de regularização cadastral pelo site da RFB ou processo digital"],
            ["Cancelado", "Decisão administrativa ou judicial (ex: multiplicidade de inscrições) ou perda", "Exige atendimento presencial ou processo administrativo"],
            ["Nulo", "Fraude confirmada na inscrição", "Processo fiscal especial na Receita Federal"],
            ["Titular Falecido", "Registrado após a certidão de óbito ser informada pelo cartório", "Regularização via inventário/espólio"]
          ]
        }
      },
      {
        id: "consequencias-praticas-cpf-irregular",
        heading: "2. O que acontece na sua vida quando o CPF fica irregular?",
        paragraphs: [
          "Manter o CPF com pendências na Receita Federal desencadeia um efeito cascata imediato em toda a sua vida financeira e civil:",
          "Os bancos e fintechs realizam varreduras automáticas periódicas contra a base de dados da Receita Federal. Ao detectar irregularidade, as instituições são obrigadas por normas do Banco Central a bloquear transações."
        ],
        bullets: [
          "Bloqueio de contas correntes, poupanças e contas de pagamento (Nubank, Inter, Itaú, Bradesco etc.).",
          "Impossibilidade de realizar ou receber transferências via Pix.",
          "Impedimento para emitir ou renovar Passaporte na Polícia Federal.",
          "Bloqueio de benefícios previdenciários e assistenciais (INSS, Bolsa Família).",
          "Impedimento para contratação de empréstimos, consórcios e financiamento imobiliário.",
          "Impossibilidade de assumir cargos públicos em caso de aprovação em concurso.",
          "Impossibilidade de matrícula em universidades públicas ou privadas conveniadas ao MEC."
        ],
        callout: {
          type: "warning",
          title: "Alerta de Fraudes",
          text: "Cuidado com sites falsos cobrando taxas ilegítimas para 'limpar CPF'. A regularização cadastral na Receita é gratuita. O único custo legítimo pode ser o pagamento de eventual multa por entrega de IRPF em atraso (mínimo de R$ 165,74) devida à União via DARF oficial."
        }
      },
      {
        id: "como-consultar-e-resolver",
        heading: "3. Como consultar a pendência no e-CAC e regularizar",
        paragraphs: [
          "O primeiro passo para resolver é acessar o portal e-CAC da Receita Federal utilizando uma conta gov.br nível Prata ou Ouro.",
          "Dentro do portal, acesse a aba 'Declarações e Demonstrativos' > 'Meu Imposto de Renda' e verifique os anos com o status de 'Omissão de Declaração' ou 'Pendências de Malha'.",
          "Ao identificar o ano pendente, basta levantar os informes de rendimentos de fontes pagadoras, saldos bancários e despesas daquele ano-base e transmitir a declaração correspondente.",
          "Assim que a declaração for processada pela base da Receita (geralmente em 24 a 48 horas), o status do seu CPF retorna automaticamente para 'Regular'."
        ]
      }
    ],
    faqs: [
      {
        question: "Quanto tempo demora para o CPF voltar a ficar regular?",
        answer: "Após o envio da declaração em atraso ou correção cadastral, o sistema da Receita Federal costuma atualizar a situação cadastral em 24 a 72 horas úteis."
      },
      {
        question: "O que acontece com o meu saldo bancário enquanto o CPF estiver pendente?",
        answer: "O seu dinheiro continua sendo seu e não é confiscado, mas a instituição financeira pode bloquear retiradas, saques e transferências para cumprir a regulação do Banco Central até a regularização."
      },
      {
        question: "Qual o valor da multa por entregar declaração em atraso?",
        answer: "A multa mínima por atraso na entrega da declaração de IRPF é de R$ 165,74, podendo chegar a até 20% do imposto devido. Se você tiver imposto a restituir, a multa é deduzida automaticamente do valor da restituição."
      },
      {
        question: "O Olá, Contador pode resolver meu CPF sem eu ter que ir na Receita Federal?",
        answer: "Sim! Nossos contadores habilitados identificam a causa exata no e-CAC, confeccionam e transmitem a declaração de regularização e fornecem o comprovante oficial com parecer técnico assinado por R$ 199."
      }
    ],
    relatedSlugs: [
      "como-sair-da-malha-fina-irpf",
      "radar-fiscal-consultar-dividas-receita-pgfn",
      "divida-ativa-da-uniao-como-consultar-e-parcelar-pgfn"
    ],
    cta: {
      badge: "Regularização de CPF",
      title: "Seu CPF está suspenso ou com pendências?",
      description: "Descubra a causa imediatamente e receba auxílio de um contador com CRC para regularizar seu documento e liberar suas contas.",
      buttonText: "Regularizar meu CPF agora",
      buttonHref: "/radar"
    }
  }
];

export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllCategories(): { name: string; slug: string; count: number }[] {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const post of BLOG_POSTS) {
    const existing = map.get(post.categorySlug);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(post.categorySlug, {
        name: post.category,
        slug: post.categorySlug,
        count: 1,
      });
    }
  }
  return Array.from(map.values());
}

export function getRelatedPosts(currentSlug: string, limit = 3): BlogPost[] {
  const current = getPostBySlug(currentSlug);
  if (!current) return BLOG_POSTS.slice(0, limit);

  const related = current.relatedSlugs
    .map((s) => getPostBySlug(s))
    .filter((p): p is BlogPost => p !== undefined && p.slug !== currentSlug);

  if (related.length < limit) {
    const others = BLOG_POSTS.filter(
      (p) => p.slug !== currentSlug && !related.some((r) => r.slug === p.slug)
    );
    related.push(...others);
  }

  return related.slice(0, limit);
}
