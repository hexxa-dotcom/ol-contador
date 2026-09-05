export type CategoriaServico = "Pessoa Física" | "MEI" | "Pequenas Empresas";

export interface ServicoFaq {
  question: string;
  answer: string;
}

export interface ServicoItem {
  slug: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  category: CategoriaServico;
  categorySlug: "pessoa-fisica" | "mei" | "pequenas-empresas";
  badge: string;
  priceCents: number;
  prazo: string;
  modalidadePadrao: "express" | "agendado" | "sob-medida";
  description: string;
  excerpt: string;
  tags: string[];
  publicoAlvo: string;
  oQueEstaIncluso: string[];
  documentosNecessarios: string[];
  passoAPasso: {
    passo: string;
    titulo: string;
    descricao: string;
  }[];
  faqs: ServicoFaq[];
  serviceParam: string; // Parâmetro para enviar para /agendar ou /checkout
}

export const SERVICOS: ServicoItem[] = [
  // ==========================================
  // PESSOA FÍSICA (PF)
  // ==========================================
  {
    slug: "decore-contador-declaracao-renda",
    title: "Emissão de DECORE com Registro no CRC: Comprovação de Renda Oficial",
    shortTitle: "Emissão de DECORE",
    subtitle: "Declaração Comprobatória de Percepção de Rendimentos com Declaração de Habilitação Profissional (DHP) para bancos e financiamentos.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Alta Procura Bancária",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Emissão oficial de DECORE eletrônica direto pelo sistema do Conselho Regional de Contabilidade (CRC), com validação de lastro financeiro e emissão de parecer para aprovação de crédito, financiamento habitacional ou locação.",
    excerpt: "Precisa comprovar renda para banco, financiamento de imóvel ou visto? Emitimos sua DECORE oficial com registro no CRC e validação de documentos comprobatórios em 24h.",
    tags: ["decore", "comprovacao de renda", "decore contador", "decore autonomo", "decore financiamento", "dhp crc"],
    publicoAlvo: "Autônomos, profissionais liberais, empresários, motoristas de app e quem precisa comprovar renda sem holerite formal.",
    oQueEstaIncluso: [
      "Análise preliminar do lastro documental (extratos bancários, livro-caixa, recibos ou RPA).",
      "Transmissão e registro oficial da DECORE no sistema eletrônico do CRC.",
      "Emissão da DHP (Declaração de Habilitação Profissional) com assinatura digital do contador.",
      "Código de controle e autenticidade para conferência direta pela instituição financeira.",
      "Parecer explicativo das fontes pagadoras e suporte pelo chat seguro."
    ],
    documentosNecessarios: [
      "Documento de identificação oficial com foto (RG ou CNH).",
      "Extratos bancários dos meses a serem comprovados.",
      "Última declaração do IRPF com recibo de entrega (se houver).",
      "Comprovantes de recebimento: notas fiscais emitidas, recibos de autônomo (RPA), contratos de prestação ou informe de rendimentos."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Envio dos Documentos", descricao: "Você anexa seus extratos e comprovantes pelo celular no portal seguro do Olá, Contador." },
      { passo: "2", titulo: "Validação do Lastro", descricao: "O contador habilitado confere os valores de acordo com as normas da Resolução CFC vigente." },
      { passo: "3", titulo: "Emissão no Sistema CRC", descricao: "A DECORE é gerada diretamente no portal do Conselho de Contabilidade com código de barras e chave de segurança." },
      { passo: "4", titulo: "Download Imediato", descricao: "Você baixa o PDF pronto e oficial com valor legal imediato para entregar ao gerente do banco ou financeira." }
    ],
    faqs: [
      {
        question: "O que é DECORE e para que serve?",
        answer: "A DECORE (Declaração Comprobatória de Percepção de Rendimentos) é o documento contábil oficial regulamentado pelo Conselho Federal de Contabilidade (CFC), emitido exclusivamente por contadores registrados, para comprovar a renda de pessoas físicas que não possuem carteira assinada (CLT)."
      },
      {
        question: "Qualquer pessoa pode emitir DECORE?",
        answer: "Para a emissão ser válida, é obrigatório existir lastro documental verídico que comprove o recebimento da renda (como extratos bancários, livro-caixa, contratos, notas ou declaração de IR). O contador analisa os documentos antes de transmitir ao CRC."
      },
      {
        question: "O banco aceita a DECORE emitida pelo Olá, Contador?",
        answer: "Sim! Nossa DECORE é emitida no sistema nacional do CFC/CRC, acompanhada do código de autenticidade eletrônica e da DHP assinada digitalmente com certificado ICP-Brasil, aceita por Caixa, Itaú, Bradesco, Santander, Banco do Brasil e demais instituições."
      },
      {
        question: "Qual o prazo para ficar pronta?",
        answer: "Após o envio dos comprovantes completos no portal do cliente, nossa equipe conclui a análise e disponibiliza a DECORE em até 24 horas úteis."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "regularizar-cpf-suspenso-pendente",
    title: "Regularização de CPF Suspenso, Cancelado ou Pendente na Receita Federal",
    shortTitle: "Regularização de CPF",
    subtitle: "Desbloqueie suas contas bancárias, chave Pix e situação fiscal com parecer formal e protocolo oficial.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Urgência Bancária",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Identificação imediata da causa da irregularidade no sistema e-CAC da Receita Federal e execução dos procedimentos necessários para restabelecer o CPF como 'Regular', liberando contas bancárias e Pix.",
    excerpt: "Seu CPF está suspenso ou pendente de regularização e o banco bloqueou sua conta? Nossos contadores identificam a pendência no e-CAC e regularizam sua situação com agilidade.",
    tags: ["regularizar cpf", "cpf suspenso", "cpf pendente de regularizacao", "desbloquear conta bancaria", "receita federal cpf"],
    publicoAlvo: "Pessoas físicas que tiveram movimentações bancárias bloqueadas, Pix rejeitado ou precisam emitir passaporte e prestar concurso.",
    oQueEstaIncluso: [
      "Diagnóstico completo de todas as pendências ativas no cadastro da Receita Federal.",
      "Elaboração e transmissão das declarações de IRPF em atraso ou retificadoras necessárias.",
      "Correção de divergências de dados cadastrais.",
      "Emissão de protocolo oficial da Receita Federal com parecer técnico assinado.",
      "Instruções para desbloqueio prioritário junto ao seu banco."
    ],
    documentosNecessarios: [
      "Documento de identidade (RG ou CNH) e número do CPF.",
      "Acesso à conta gov.br (nível Prata ou Ouro).",
      "Informes de rendimentos ou dados bancários dos anos pendentes (se houver omissão de declaração)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico no e-CAC", descricao: "Acessamos a base da Receita Federal para apurar exatamente qual ano ou dado gerou a trava." },
      { passo: "2", titulo: "Execução da Regularização", descricao: "Confeccionamos a retificação ou transmissão da obrigação pendente sem você sair de casa." },
      { passo: "3", titulo: "Protocolo & Baixa", descricao: "Geramos o comprovante oficial e acompanhamos o processamento pelo sistema central da RFB." }
    ],
    faqs: [
      {
        question: "Por que meu CPF ficou pendente de regularização?",
        answer: "Em 90% dos casos, o status 'Pendente de Regularização' decorre da omissão na entrega de pelo menos uma Declaração de Imposto de Renda (IRPF) obrigatória nos últimos 5 anos."
      },
      {
        question: "Quanto tempo demora para o banco liberar a conta?",
        answer: "Após a transmissão da declaração pelo nosso contador, o sistema da Receita processa a informação em 24 a 48 horas úteis, atualizando a situação para 'Regular'. Com o protocolo fornecido por nós, muitos bancos antecipam o desbloqueio."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "malha-fina-imposto-de-renda",
    title: "Defesa e Resolução de Malha Fina do IRPF na Receita Federal",
    shortTitle: "Resolução de Malha Fina",
    subtitle: "Atendimento técnico para notificações, intimações, termos de retenção de malha fiscal e liberação de restituição travada.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Defesa Técnica",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Análise aprofundada dos cruzamentos do sistema da Receita Federal (DIRF, DMED, DIMOB, carnê-leão) para sanar divergências de despesas médicas, dependentes ou rendimentos, evitando multas punitivas de 75%.",
    excerpt: "Caiu na malha fina do Imposto de Renda ou recebeu carta da Receita Federal? Corrigimos sua declaração, montamos dossiê digital no e-CAC e liberamos sua restituição retida.",
    tags: ["malha fina", "malha fina irpf", "notificacao receita federal", "termo de intimacao", "restituicao travada"],
    publicoAlvo: "Contribuintes que tiveram a declaração retida em malha, receberam notificação de lançamento ou estão com a restituição bloqueada.",
    oQueEstaIncluso: [
      "Auditoria eletrônica completa do extrato de processamento da declaração retida no e-CAC.",
      "Identificação do motivo do cruzamento fiscal (glosa médica, omissão de rendimento de dependente, previdência privada, pensão).",
      "Elaboração e transmissão de Declaração Retificadora de IRPF ou montagem de Dossiê Digital com impugnação fundamentada.",
      "Emissão de Parecer Técnico Contábil formal assinado com CRC."
    ],
    documentosNecessarios: [
      "Cópia da declaração original e recibo do ano retido.",
      "Notificação recebida ou espelho da pendência do e-CAC.",
      "Comprovantes das despesas ou deduções questionadas (recibos médicos, laudos, informes)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Análise da Malha", descricao: "Avaliamos a pendência exata apontada pelo robô fiscal da Receita Federal." },
      { passo: "2", titulo: "Definição da Estratégia", descricao: "Se houve erro de digitação, retificamos; se o lançamento está correto, preparamos a juntada de provas documentais." },
      { passo: "3", titulo: "Envio & Liberação", descricao: "Transmitimos os dados e orientamos o acompanhamento até a liberação final da declaração." }
    ],
    faqs: [
      {
        question: "O que acontece se eu não responder à intimação da malha fina?",
        answer: "Se a pendência não for regularizada antes do início do procedimento fiscal formal, a Receita emite Auto de Infração com cobrança do imposto devido acrescido de multa de 75% a 150% mais juros SELIC."
      },
      {
        question: "Minha restituição é liberada depois de resolver a malha?",
        answer: "Sim! Assim que a declaração retificada é processada e sai da malha, a Receita Federal inclui o contribuinte nos lotes residuais mensais de restituição com correção pela taxa SELIC."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "ganho-de-capital-gcap-imoveis",
    title: "Apuração de Ganho de Capital (GCAP) na Venda de Imóveis e Bens",
    shortTitle: "Ganho de Capital (GCAP)",
    subtitle: "Cálculo do imposto sobre lucro imobiliário, aplicação das isenções de 180 dias, fatores de redução e emissão do DARF.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Economia Tributária",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Apuração precisa de lucro na venda de imóveis residenciais, comerciais, terrenos, veículos ou bens no exterior, aplicando todos os benefícios legais de redução e isenção previstos em lei.",
    excerpt: "Vendeu um imóvel ou veículo e precisa calcular o imposto de ganho de capital? Fazemos sua apuração no GCAP, aplicamos as deduções legais e emitimos o DARF oficial.",
    tags: ["ganho de capital", "gcap", "venda de imovel", "darf gcap", "isencao 180 dias", "lucro imobiliario"],
    publicoAlvo: "Proprietários que venderam imóveis, cotas societárias, veículos ou terrenos e precisam recolher o imposto ou declarar a isenção.",
    oQueEstaIncluso: [
      "Levantamento do histórico de aquisição e benfeitorias incorporáveis ao custo do imóvel.",
      "Aplicação dos Fatores de Redução da Lei 11.196/2005 (FR1 e FR2).",
      "Avaliação e aplicação da regra de isenção de 180 dias para compra de outro imóvel residencial.",
      "Preenchimento e exportação oficial do arquivo no programa GCAP da Receita Federal.",
      "Emissão do DARF com código de barras para pagamento sem multas e memória de cálculo em PDF."
    ],
    documentosNecessarios: [
      "Escritura pública ou contrato de compra e venda da aquisição (antiga).",
      "Escritura pública ou contrato de venda (atual).",
      "Comprovantes de pagamento de corretagem imobiliária, ITBI e reformas realizadas.",
      "Cópia da última declaração de IRPF onde constava o bem."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Envio das Escrituras", descricao: "Você anexa as cópias dos contratos e documentos de compra e venda no portal seguro." },
      { passo: "2", titulo: "Cálculo das Reduções", descricao: "Aplicamos os abatimentos de corretagem, ITBI e fatores de tempo para reduzir ao máximo o imposto legalmente." },
      { passo: "3", titulo: "Emissão do DARF & Arquivo", descricao: "Entregamos o DARF calculado para pagamento e o arquivo do GCAP para integração ao seu próximo IRPF." }
    ],
    faqs: [
      {
        question: "Qual o prazo para pagar o imposto sobre a venda do imóvel?",
        answer: "O DARF de ganho de capital vence impreterivelmente no último dia útil do mês subsequente ao recebimento do valor da venda. Não deixe para a declaração anual do ano seguinte, sob pena de multa e juros."
      },
      {
        question: "Quem tem direito à isenção de 180 dias?",
        answer: "O contribuinte pessoa física residente no Brasil que vender imóvel residencial e aplicar todo o produto da venda na aquisição de outro imóvel residencial no país em até 180 dias. O benefício pode ser usado uma vez a cada 5 anos."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "carne-leao-autonomos-exterior",
    title: "Apuração de Carnê-Leão para Autônomos, Médicos e Rendimentos do Exterior",
    shortTitle: "Carnê-Leão Mensal",
    subtitle: "Cálculo mensal obrigatório do imposto de renda, escrituração do Livro-Caixa e abatimento de despesas operacionais.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Obrigatoriedade Mensal",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Cálculo mensal do recolhimento obrigatório de imposto de renda sobre rendimentos recebidos de outras pessoas físicas ou do exterior (Google AdSense, plataformas de freelancers, aluguéis, consultas particulares).",
    excerpt: "Médico, psicólogo, dentista, freelancer ou recebe do exterior? Calculamos seu Carnê-Leão mensal, escrituramos o livro-caixa para reduzir o imposto e emitimos o DARF.",
    tags: ["carne-leao", "livro-caixa", "autonomo", "rendimentos exterior", "adsense irpf", "darf carne leao"],
    publicoAlvo: "Profissionais liberais da saúde, advogados autônomos, criadores de conteúdo com receitas do exterior, proprietários que recebem aluguéis de PF.",
    oQueEstaIncluso: [
      "Escrituração eletrônica do Carnê-Leão Web no portal e-CAC.",
      "Análise e inclusão de todas as despesas dedutíveis permitidas pela legislação (aluguel de consultório, água, luz, materiais de consumo).",
      "Apuração da base tributável progressiva do IRPF.",
      "Emissão do DARF mensal de código 0190 para pagamento.",
      "Relatório mensal consolidado para posterior importação direta na Declaração Anual de Ajuste."
    ],
    documentosNecessarios: [
      "Planilha ou extrato com recibos emitidos a clientes/pacientes no mês (com CPF).",
      "Comprovantes de despesas operacionais do consultório/escritório para dedução.",
      "Extratos de fechamento de câmbio ou comprovantes de remessas internacionais (para recebimentos do exterior)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Envio dos Rendimentos", descricao: "Você anexa a lista de receitas recebidas e notas de despesas do mês no sistema." },
      { passo: "2", titulo: "Apuração no Livro-Caixa", descricao: "Nosso contador aplica as deduções legais para diminuir a base do imposto devido." },
      { passo: "3", titulo: "Entrega do DARF", descricao: "Você recebe o DARF mensal pronto para pagamento e o demonstrativo oficial." }
    ],
    faqs: [
      {
        question: "Quem é obrigado a recolher Carnê-Leão?",
        answer: "Qualquer pessoa física que receba rendimentos de outra pessoa física (como aluguéis, consultas particulares de saúde, honorários de autônomo) ou rendimentos originados no exterior, cujo valor mensal ultrapasse a faixa de isenção da tabela progressiva do IRPF."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "cnd-pessoa-fisica-receita-federal",
    title: "Emissão e Desembaraço de CND da Pessoa Física (Receita Federal e PGFN)",
    shortTitle: "CND Pessoa Física",
    subtitle: "Obtenção de Certidão Negativa de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União para seu CPF.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Certidão Oficial",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Levantamento das pendências que impedem a emissão da Certidão Negativa de Débitos (CND) do seu CPF, saneamento de débitos ou parcelamentos e emissão da certidão oficial para compra/venda de imóveis, inventários ou financiamentos.",
    excerpt: "Precisa de CND da Receita Federal no seu CPF para vender imóvel, financiar ou assumir cargo público e a certidão não sai? Identificamos e destravamos sua certidão.",
    tags: ["cnd pessoa fisica", "certidao negativa receita federal", "cnd cpf", "certidao conjunta rfb pgfn"],
    publicoAlvo: "Pessoas físicas que vão assinar escritura de compra e venda de imóveis, inventários em cartório, bancos ou posse em concurso.",
    oQueEstaIncluso: [
      "Consulta detalhada na base da Receita Federal e na Procuradoria-Geral da Fazenda Nacional (PGFN).",
      "Identificação do débito impeditivo (DARF vencido, omissão de declaração ou débito inscrito em dívida ativa).",
      "Ajuste, quitação ou parcelamento do débito impeditivo.",
      "Emissão da Certidão Conjunta Negativa (ou Positiva com Efeitos de Negativa) válida em todo o território nacional."
    ],
    documentosNecessarios: [
      "Documento de identificação (RG ou CNH).",
      "Número do CPF e acesso gov.br."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Varredura Fiscal", descricao: "Localizamos o motivo exato pelo qual o sistema da RFB/PGFN está travando a emissão da certidão." },
      { passo: "2", titulo: "Saneamento", descricao: "Efetuamos a retificação, emissão de guia de quitação ou adesão a parcelamento para suspender a exigibilidade." },
      { passo: "3", titulo: "Emissão da Certidão", descricao: "Disponibilizamos a CND oficial assinada digitalmente pela Receita Federal." }
    ],
    faqs: [
      {
        question: "Qual a diferença entre Certidão Negativa e Positiva com Efeitos de Negativa?",
        answer: "A Certidão Negativa atesta que não constam débitos. A Certidão Positiva com Efeitos de Negativa atesta que constam débitos, mas com exigibilidade suspensa (por exemplo, por estarem devidamente parcelados). Ambas têm exatamente o mesmo valor legal para bancos e cartórios."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "declaracao-saida-definitiva-pais",
    title: "Comunicação e Declaração de Saída Definitiva do País (DSDP)",
    shortTitle: "Saída Definitiva do País",
    subtitle: "Regularize sua condição de não residente fiscal no Brasil e evite bitributação internacional de forma 100% legal.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Brasileiros no Exterior",
    priceCents: 19900,
    prazo: "Em até 48h úteis",
    modalidadePadrao: "express",
    description: "Assessoria completa para brasileiros que mudaram para o exterior: transmissão da Comunicação de Saída Definitiva (CSDP) e da Declaração de Saída Definitiva do País (DSDP), prevenindo bitributação e pendências futuras com a Receita Federal.",
    excerpt: "Mudou para o exterior ou vai morar fora do Brasil? Realizamos sua Comunicação e Declaração de Saída Definitiva do País na Receita Federal para evitar dupla tributação.",
    tags: ["saida definitiva do brasil", "dsdp", "nao residente fiscal", "imposto de renda exterior"],
    publicoAlvo: "Brasileiros que residem ou estão se mudando para trabalhar, estudar ou viver no exterior.",
    oQueEstaIncluso: [
      "Análise da data exata de perda da residência fiscal perante a Receita Federal.",
      "Elaboração e transmissão da Comunicação de Saída Definitiva do País (CSDP).",
      "Elaboração e transmissão da Declaração de Saída Definitiva do País (DSDP).",
      "Emissão da Certidão Negativa de Débitos para saída do país.",
      "Orientações práticas sobre a comunicação a fontes pagadoras no Brasil e contas bancárias de não residente (CDE)."
    ],
    documentosNecessarios: [
      "Documento de identificação e CPF.",
      "Data de saída do território nacional (ou data em que completou 12 meses consecutivos de ausência).",
      "Informes de rendimentos e bens mantidos no Brasil até a data da saída."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Análise da Data", descricao: "Definimos o marco temporal exato da mudança de domicílio fiscal." },
      { passo: "2", titulo: "Transmissão", descricao: "Enviamos as declarações oficiais perante a Receita Federal do Brasil." },
      { passo: "3", titulo: "Parecer de Encerramento", descricao: "Entregamos seu recibo formal e as orientações para suas contas e bens no Brasil." }
    ],
    faqs: [
      {
        question: "O que acontece se eu não fizer a declaração de saída definitiva?",
        answer: "Se você morar no exterior e não formalizar a saída, continuará sendo considerado residente fiscal no Brasil, sendo obrigado a declarar e tributar no Brasil toda a renda que você ganha no exterior, correndo sério risco de bitributação e malha fina."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "isencao-irpf-molestia-grave",
    title: "Processo de Isenção de IRPF por Moléstia Grave e Restituição Retroativa",
    shortTitle: "Isenção por Moléstia Grave",
    subtitle: "Aposentados e pensionistas portadores de doenças graves: pedido de isenção e recuperação dos últimos 5 anos.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Direito do Contribuinte",
    priceCents: 19900,
    prazo: "Em até 48h úteis",
    modalidadePadrao: "express",
    description: "Estruturação contábil do pedido de isenção de imposto de renda sobre proventos de aposentadoria ou pensão para portadores de moléstias graves previstas na Lei 7.713/88, com cálculo e pedido de restituição retroativa dos valores retidos nos últimos 5 anos.",
    excerpt: "Aposentado ou pensionista com diagnóstico de doença grave? Tenha isenção legal de IRPF e recupere o imposto descontado nos últimos 5 anos com parecer de contador especializado.",
    tags: ["isencao irpf molestia grave", "restituicao doenca grave", "isencao aposentadoria", "lei 7713"],
    publicoAlvo: "Aposentados, pensionistas e reformados que possuem diagnósticos como câncer, cardiopatia grave, Parkinson, esclerose múltipla, entre outras.",
    oQueEstaIncluso: [
      "Auditoria médica-contábil dos laudos periciais e relatórios de saúde.",
      "Cálculo exato de todo o imposto retido na fonte passível de restituição nos últimos 60 meses.",
      "Transmissão das retificadoras de IRPF com alteração para rendimentos isentos.",
      "Abertura de processo administrativo digital no e-CAC para homologação da isenção.",
      "Emissão de Parecer Técnico Contábil formal assinado com CRC."
    ],
    documentosNecessarios: [
      "Laudo médico oficial contendo CID da doença e data de início dos sintomas/diagnóstico.",
      "Comprovante do benefício de aposentadoria ou pensão (INSS ou órgão público).",
      "Cópias das declarações de IRPF dos últimos 5 anos."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Conferência do Laudo", descricao: "Avaliamos se o laudo cumpre os requisitos formais exigidos pela Receita Federal." },
      { passo: "2", titulo: "Cálculo do Retroativo", descricao: "Calculamos centavo por centavo todo o imposto pago indevidamente nos últimos 5 anos com correção pela SELIC." },
      { passo: "3", titulo: "Protocolo de Isenção", descricao: "Abrimos o pedido formal e transmitimos as retificadoras para colocar o dinheiro na sua conta bancária." }
    ],
    faqs: [
      {
        question: "Quais doenças dão direito à isenção de IRPF?",
        answer: "A Lei 7.713/88 lista doenças como: neoplasia maligna (câncer), cardiopatia grave, doença de Parkinson, alienação mental, cegueira, esclerose múltipla, nefropatia grave, paralisia irreversível, entre outras."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "declaracao-irpf-atrasada-anos-anteriores",
    title: "Declaração de IRPF em Atraso: Regularização de Múltiplos Anos Fiscais",
    shortTitle: "IRPF em Atraso (Múltiplos Anos)",
    subtitle: "Envio de declarações de imposto de renda não entregues nos últimos 5 anos com cálculo de multa mínima e recuperação de dados.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Regularização Histórica",
    priceCents: 19900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Levantamento do histórico fiscal junto ao e-CAC, recuperação de informes de rendimentos esquecidos e transmissão de declarações em atraso dos anos de 2020 a 2025 para regularização definitiva.",
    excerpt: "Deixou de declarar Imposto de Renda nos anos anteriores? Levantamos todos os seus informes esquecidos na Receita e transmitimos suas declarações pendentes com segurança.",
    tags: ["irpf em atraso", "declarar imposto atrasado", "multa atraso irpf", "regularizar anos anteriores ir"],
    publicoAlvo: "Contribuintes que não declararam IRPF em anos anteriores e estão com pendências ou CPF bloqueado.",
    oQueEstaIncluso: [
      "Acesso aos informes pré-preenchidos e bases históricas da Receita Federal.",
      "Elaboração técnica da declaração escolhendo a modalidade mais vantajosa (simplificada ou deduções legais).",
      "Transmissão oficial ao sistema da Receita Federal.",
      "Emissão do recibo de entrega oficial e do DARF da multa por atraso (se houver).",
      "Parecer de regularidade cadastral emitido por contador."
    ],
    documentosNecessarios: [
      "Documento pessoal e acesso gov.br.",
      "Informes de rendimentos bancários e de fontes pagadoras dos anos em aberto (auxiliamos na obtenção direta pelo e-CAC)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Levantamento Histórico", descricao: "Puxamos do sistema da Receita os dados que os bancos e empresas já enviaram sobre você." },
      { passo: "2", titulo: "Preenchimento Seguro", descricao: "Confeccionamos cada ano pendente evitando inconsistências que pudessem gerar malha fina." },
      { passo: "3", titulo: "Emissão dos Recibos", descricao: "Você recebe os comprovantes oficiais e sua situação fica 100% limpa perante o Fisco." }
    ],
    faqs: [
      {
        question: "Qual o valor da multa por entregar IRPF atrasado?",
        answer: "A multa mínima por atraso na entrega da declaração é de R$ 165,74 por ano, podendo chegar até 20% do imposto devido. Se você tiver restituição a receber, o valor da multa é descontado automaticamente da própria restituição."
      }
    ],
    serviceParam: "pf"
  },
  {
    slug: "irpf-espolio-inventario-falecido",
    title: "Declaração de IRPF de Espólio: Inicial, Intermediária e Final de Inventário",
    shortTitle: "IRPF de Espólio / Inventário",
    subtitle: "Obrigações fiscais do falecido até a partilha dos bens para lavratura de escritura ou formal de partilha judicial.",
    category: "Pessoa Física",
    categorySlug: "pessoa-fisica",
    badge: "Direito Sucessório",
    priceCents: 19900,
    prazo: "Em até 48h úteis",
    modalidadePadrao: "express",
    description: "Assessoria especializada para inventariantes e advogados na elaboração das declarações de espólio, apuração de eventuais ganhos de capital na partilha e emissão da Certidão Negativa exigida pelo cartório ou juiz.",
    excerpt: "Precisa fazer a declaração de imposto de renda de pessoa falecida para concluir inventário? Cuidamos da declaração inicial, intermediária ou final de espólio com parecer formal.",
    tags: ["declaracao espolio", "irpf falecido", "declaracao final espolio", "inventario cartorio irpf"],
    publicoAlvo: "Inventariantes, herdeiros e advogados que precisam concluir inventários judiciais ou extrajudiciais em cartório.",
    oQueEstaIncluso: [
      "Avaliação da modalidade correta (declaração inicial, intermediária ou final de espólio).",
      "Distribuição proporcional dos bens e direitos partilhados aos herdeiros e meeiros.",
      "Apuração de eventual ganho de capital na transmissão dos bens a valor de mercado.",
      "Emissão da Certidão de Quitação de Tributos Federais de Espólio para juntada no cartório/processo."
    ],
    documentosNecessarios: [
      "Certidão de óbito do titular.",
      "Termo de inventariante ou certidão de nomeação.",
      "Minuta da escritura pública de inventário ou decisão homologatória de partilha.",
      "Última declaração de IRPF entregue pelo falecido em vida."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Análise da Partilha", descricao: "Avaliamos a minuta de partilha e a forma como os bens serão transferidos para os herdeiros." },
      { passo: "2", titulo: "Transmissão da Declaração", descricao: "Transmitimos a Declaração Final de Espólio no programa oficial da Receita." },
      { passo: "3", titulo: "Emissão da Certidão", descricao: "Geramos a certidão de regularidade do espólio para anexação direta no cartório de notas." }
    ],
    faqs: [
      {
        question: "O que acontece se não fizer a declaração final de espólio?",
        answer: "O inventário não pode ser registrado no cartório de registro de imóveis sem a quitação fiscal do falecido, e o CPF do falecido permanece em situação irregular, gerando entraves para liberação de contas e bens."
      }
    ],
    serviceParam: "pf"
  },

  // ==========================================
  // MICROEMPREENDEDOR INDIVIDUAL (MEI)
  // ==========================================
  {
    slug: "regularizacao-mei-das-atrasado",
    title: "Regularização de MEI e Parcelamento de Guias DAS em Atraso",
    shortTitle: "Regularização de MEI & DAS",
    subtitle: "Recalcule impostos atrasados, evite o cancelamento do CNPJ e negocie parcelamentos no Simples Nacional.",
    category: "MEI",
    categorySlug: "mei",
    badge: "Mais Procurado MEI",
    priceCents: 34900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Levantamento de todas as guias DAS não pagas desde a abertura do MEI, renegociação com parcelamento oficial em até 60 parcelas e desbloqueio dos benefícios previdenciários (aposentadoria, auxílio-doença, salário-maternidade).",
    excerpt: "Acumulou guias DAS do MEI atrasadas e tem medo de perder o CNPJ ou a aposentadoria? Levantamos todas as dívidas, renegociamos em até 60x e regularizamos seu MEI.",
    tags: ["regularizar mei", "das mei atrasado", "parcelamento mei", "divida mei simples", "regularizar dasn simei"],
    publicoAlvo: "Microempreendedores individuais com débitos acumulados, guias DAS pendentes ou notificação de exclusão do Simples Nacional.",
    oQueEstaIncluso: [
      "Auditoria cadastral e fiscal de todos os anos de atividade do MEI.",
      "Emissão consolidada de guias DAS vencidas com cálculo automático de juros e multa.",
      "Adesão a parcelamento oficial ordinário do Simples Nacional (até 60 meses) com parcela mínima de R$ 50.",
      "Emissão da primeira parcela do acordo para ativação imediata.",
      "Relatório de regularidade do MEI assinado por contador com CRC."
    ],
    documentosNecessarios: [
      "Número do CNPJ do MEI.",
      "Acesso à conta gov.br do titular (ou Código de Acesso do Simples Nacional)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Varredura do CNPJ", descricao: "Identificamos todas as competências em aberto na Receita Federal e na PGFN." },
      { passo: "2", titulo: "Simulação de Parcelamento", descricao: "Montamos a melhor condição de parcelamento para caber no seu orçamento mensal." },
      { passo: "3", titulo: "Ativação do Acordo", descricao: "Transmitimos a adesão e emitimos a guia inicial que restabelece seus direitos previdenciários." }
    ],
    faqs: [
      {
        question: "Deixar o DAS atrasado cancela o CNPJ do MEI?",
        answer: "Sim! A Receita Federal publica periodicamente editais de cancelamento e exclusão do Simples Nacional para MEIs com débitos. Além disso, as dívidas são transferidas para o CPF do titular na Dívida Ativa da União."
      },
      {
        question: "Posso parcelar a dívida do MEI em quantas vezes?",
        answer: "O parcelamento convencional do MEI permite dividir os débitos em até 60 vezes, com valor mínimo de R$ 50 por parcela."
      }
    ],
    serviceParam: "pj-atendimento"
  },
  {
    slug: "baixa-cancelamento-cnpj-mei",
    title: "Baixa e Cancelamento Definitivo de CNPJ MEI (Mesmo com Dívidas)",
    shortTitle: "Baixa de CNPJ MEI",
    subtitle: "Encerre as atividades do seu MEI com segurança jurídica, transmita a declaração de extinção e pare de gerar novas guias DAS.",
    category: "MEI",
    categorySlug: "mei",
    badge: "Encerramento Seguro",
    priceCents: 34900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Procedimento completo de encerramento do CNPJ do MEI no Portal do Empreendedor, elaboração e envio da Declaração Anual de Extinção (DASN-SIMEI Situação Especial) e baixa nas esferas municipal e estadual.",
    excerpt: "Não usa mais seu MEI e quer cancelar o CNPJ para parar de acumular impostos? Damos baixa definitiva no seu MEI em até 24h, mesmo se houver dívidas pendentes.",
    tags: ["baixa mei", "cancelar cnpj mei", "encerrar mei", "fechar mei com divida", "dasn extincao"],
    publicoAlvo: "Pessoas que abriram MEI e não utilizam mais a empresa, ou que arrumaram emprego CLT e desejam encerrar a pessoa jurídica.",
    oQueEstaIncluso: [
      "Processamento da baixa no Portal do Empreendedor e Receita Federal.",
      "Elaboração e transmissão da DASN-SIMEI de Situação Especial (Extinção).",
      "Emissão do Certificado da Condição de Microempreendedor Individual (CCMEI) com status de 'Baixado'.",
      "Instruções e levantamento de débitos remanescentes para parcelamento no CPF.",
      "Parecer técnico de encerramento formal assinado com CRC."
    ],
    documentosNecessarios: [
      "Número do CNPJ do MEI.",
      "Conta gov.br nível Prata ou Ouro do titular."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Solicitação da Baixa", descricao: "Processamos a baixa imediata no sistema federal." },
      { passo: "2", titulo: "Declaração de Extinção", descricao: "Transmitimos a última declaração anual obrigatória para não gerar multas futuras." },
      { passo: "3", titulo: "Certificado de Baixa", descricao: "Entregamos o comprovante oficial de CNPJ baixado na hora." }
    ],
    faqs: [
      {
        question: "Posso dar baixa no MEI mesmo com guias DAS atrasadas?",
        answer: "Sim! Pela Lei Complementar nº 123/2006, é proibido impedir a baixa de empresas com débitos. O CNPJ é cancelado imediatamente e as novas cobranças são interrompidas. As dívidas anteriores continuam vinculadas ao CPF do titular e podem ser parceladas posteriormente."
      }
    ],
    serviceParam: "pj-atendimento"
  },
  {
    slug: "declaracao-anual-dasn-simei-atrasada",
    title: "Declaração Anual do MEI (DASN-SIMEI) em Atraso ou Retificadora",
    shortTitle: "Declaração Anual MEI (DASN)",
    subtitle: "Transmissão da declaração de faturamento do MEI fora do prazo, correção de valores e cálculo do DARF de multa.",
    category: "MEI",
    categorySlug: "mei",
    badge: "Evite Multas Extras",
    priceCents: 34900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Envio de declarações anuais de faturamento do MEI atrasadas perante o Simples Nacional, apuração do limite anual de R$ 81.000 e emissão do DARF da penalidade por atraso com 50% de desconto legal.",
    excerpt: "Esqueceu de entregar a Declaração Anual do MEI (DASN-SIMEI)? Transmitimos sua declaração em atraso ou retificadora em poucas horas e regularizamos seu cadastro.",
    tags: ["dasn simei atrasada", "declaracao anual mei", "multa dasn simei", "retificar declaracao mei"],
    publicoAlvo: "MEIs que perderam o prazo final de maio ou que precisam corrigir valores informados para bancos ou financiamentos.",
    oQueEstaIncluso: [
      "Cálculo correto do faturamento anual por segmento (comércio, indústria e serviços).",
      "Transmissão oficial ao sistema SIMEI da Receita Federal.",
      "Emissão do recibo de entrega com autenticidade eletrônica.",
      "Emissão da guia de multa por entrega em atraso com desconto de 50% se paga no prazo.",
      "Comprovante de regularidade fiscal do CNPJ."
    ],
    documentosNecessarios: [
      "Número do CNPJ do MEI.",
      "Estimativa ou relatório das receitas brutas obtidas no ano-calendário correspondente.",
      "Informação se houve contratação de empregado no período."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Apuração das Vendas", descricao: "Avaliamos os valores brutos recebidos para garantir que não ultrapassem o teto de R$ 81.000." },
      { passo: "2", titulo: "Transmissão Oficial", descricao: "Enviamos a declaração diretamente ao sistema da Receita Federal." },
      { passo: "3", titulo: "Recibo Entregue", descricao: "Disponibilizamos o recibo timbrado oficial e as instruções fiscais." }
    ],
    faqs: [
      {
        question: "Qual o valor da multa por não entregar a DASN-SIMEI?",
        answer: "A multa mínima por atraso é de R$ 50,00 por ano não declarado. Pagando a guia dentro do prazo de vencimento gerado na transmissão, a Receita concede 50% de desconto, caindo para R$ 25,00."
      }
    ],
    serviceParam: "pj-atendimento"
  },
  {
    slug: "desenquadramento-mei-para-microempresa",
    title: "Desenquadramento de MEI para Microempresa (ME - Simples Nacional)",
    shortTitle: "Desenquadramento de MEI para ME",
    subtitle: "Transição segura quando seu faturamento ultrapassou R$ 81.000 ou você precisa admitir sócios ou novas atividades.",
    category: "MEI",
    categorySlug: "mei",
    badge: "Crescimento de Empresa",
    priceCents: 34900,
    prazo: "Em até 48h úteis",
    modalidadePadrao: "express",
    description: "Planejamento e execução da transição do MEI para ME (Microempresa): comunicação de desenquadramento na Receita Federal, adequação na Junta Comercial e cálculo de eventual imposto retroativo sobre o excedente de faturamento.",
    excerpt: "Faturou mais de R$ 81 mil no MEI, quer colocar sócio ou exercer atividade não permitida? Fazemos o desenquadramento do seu MEI para Microempresa no Simples Nacional com segurança.",
    tags: ["desenquadramento mei", "mei para me", "estourou faturamento mei", "transformar mei em me"],
    publicoAlvo: "MEIs em expansão de faturamento, que precisam contratar mais de 1 funcionário ou incluir atividades intelectuais.",
    oQueEstaIncluso: [
      "Diagnóstico do percentual de estouro de faturamento (até 20% ou acima de 20%).",
      "Comunicação formal de desenquadramento no portal do Simples Nacional.",
      "Adequação cadastral junto à Junta Comercial do seu estado.",
      "Cálculo dos impostos complementares devidos no PGDAS-D sem cobrança abusiva.",
      "Parecer técnico assinado com CRC contendo o plano de transição tributária."
    ],
    documentosNecessarios: [
      "Número do CNPJ do MEI.",
      "Conta gov.br com selo Prata/Ouro.",
      "Total de notas fiscais emitidas ou faturamento real do ano."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Auditoria do Faturamento", descricao: "Verificamos a data de efeito do desenquadramento para evitar multas surpresas." },
      { passo: "2", titulo: "Comunicação no SIMEI", descricao: "Registramos o pedido de desenquadramento oficial no portal da Receita Federal." },
      { passo: "3", titulo: "Enquadramento em ME", descricao: "Orientamos a transição contratual para a nova fase da sua empresa." }
    ],
    faqs: [
      {
        question: "O que acontece se faturei até 20% acima do limite do MEI?",
        answer: "Se o faturamento ficou entre R$ 81.000 e R$ 97.200 (até 20%), o desenquadramento só tem efeito a partir de 1º de janeiro do ano seguinte, e você recolhe um DAS complementar sobre o excedente. Acima de 20%, o desenquadramento é retroativo a janeiro do ano corrente."
      }
    ],
    serviceParam: "pj-atendimento"
  },
  {
    slug: "certidoes-negativas-cnd-mei",
    title: "Emissão de CNDs e Regularidade Completa do MEI (Federal, Estadual, Municipal e FGTS)",
    shortTitle: "Certidões Negativas do MEI (CND)",
    subtitle: "Pacote completo de certidões negativas de débito para licitações, empréstimos bancários e credenciamento de fornecedores.",
    category: "MEI",
    categorySlug: "mei",
    badge: "Crédito & Licitação",
    priceCents: 34900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Emissão do dossiê completo de regularidade cadastral e fiscal do CNPJ MEI: Certidão Conjunta Federal (RFB/PGFN), Certidão Estadual, Certidão Municipal (Mobiliária) e Certificado de Regularidade do FGTS (CRF).",
    excerpt: "Precisa de Certidão Negativa (CND) do seu MEI para pegar empréstimo no banco ou fornecer para empresas e prefeituras? Emitimos todo o pacote de certidões e destravamos pendências.",
    tags: ["cnd mei", "certidao negativa mei", "crf fgts mei", "cnd federal mei", "regularidade fiscal mei"],
    publicoAlvo: "MEIs concorrendo em licitações públicas, contratados por grandes corporações ou solicitando linhas de crédito bancário.",
    oQueEstaIncluso: [
      "Emissão da CND Federal e Dívida Ativa da União (RFB/PGFN).",
      "Emissão da CND Estadual da Fazenda Estadual (SEFAZ).",
      "Emissão da CND Municipal de Tributos Imobiliários e Mobiliários (Prefeitura).",
      "Emissão do CRF da Caixa Econômica Federal (Regularidade do FGTS).",
      "Relatório consolidado com parecer de aptidão para contratação pública e bancária."
    ],
    documentosNecessarios: [
      "Número do CNPJ do MEI.",
      "Inscrição Municipal ou Estadual (se houver)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Varredura dos Órgãos", descricao: "Acessamos os 4 órgãos públicos simultaneamente para emissão dos documentos." },
      { passo: "2", titulo: "Desembaraço", descricao: "Caso algum órgão aponte pendência, identificamos o problema e orientamos a resolução." },
      { passo: "3", titulo: "Entrega do Pacote", descricao: "Você recebe todas as certidões reunidas em um único arquivo PDF organizado." }
    ],
    faqs: [
      {
        question: "Por que o banco exige a Certidão do FGTS se não tenho funcionário no MEI?",
        answer: "As instituições financeiras são obrigadas por lei a exigir o CRF da Caixa para liberar financiamentos PJ. Para quem não tem funcionário, emitimos a declaração e o certificado de inexistência de débitos junto à Caixa."
      }
    ],
    serviceParam: "pj-atendimento"
  },
  {
    slug: "parcelamento-divida-ativa-mei-pgfn",
    title: "Negociação de Dívidas do MEI na Dívida Ativa da União (PGFN / Regularize)",
    shortTitle: "Dívida Ativa do MEI (PGFN)",
    subtitle: "Negocie débitos de DAS inscritos em dívida ativa com descontos de até 70% pela Transação Tributária.",
    category: "MEI",
    categorySlug: "mei",
    badge: "Descontos até 70%",
    priceCents: 34900,
    prazo: "Em até 24h úteis",
    modalidadePadrao: "express",
    description: "Quando o MEI passa anos sem pagar, a Receita transfere a cobrança para os procuradores federais na PGFN. Negociamos seu débito pelo portal Regularize aproveitando os editais de transação por adesão com desconto expressivo.",
    excerpt: "Recebeu aviso da Procuradoria (PGFN) ou sua dívida de MEI foi para o Regularize? Negociamos suas dívidas com descontos de até 70% e parcelamento facilitado.",
    tags: ["divida ativa mei", "pgfn regularize mei", "parcelamento pgfn", "transacao tributaria mei"],
    publicoAlvo: "MEIs ou ex-MEIs com inscrições em Dívida Ativa da União, restrição no CADIN ou protesto em cartório pela União.",
    oQueEstaIncluso: [
      "Levantamento de todas as inscrições em dívida ativa na PGFN.",
      "Simulação das modalidades de transação tributária mais vantajosas.",
      "Adesão com abatimento de até 70% sobre juros, multas e encargos legais.",
      "Geração da primeira guia de entrada para cancelamento de protesto e baixa de CADIN.",
      "Parecer de regularização da dívida ativa assinado com CRC."
    ],
    documentosNecessarios: [
      "Número do CNPJ do MEI ou CPF do titular.",
      "Acesso ao portal Regularize ou conta gov.br."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Consulta no Regularize", descricao: "Apuramos o total consolidado das inscrições em cobrança executiva." },
      { passo: "2", titulo: "Aplicação dos Descontos", descricao: "Enquadramos sua empresa no melhor edital de transação disponível na Fazenda Nacional." },
      { passo: "3", titulo: "Emissão da Parcela", descricao: "Geramos a guia de entrada que suspende a cobrança judicial e libera certidões." }
    ],
    faqs: [
      {
        question: "Minha dívida do MEI pode penhorar minha conta física pessoal?",
        answer: "Sim! Por ser empresário individual, o patrimônio do MEI e o patrimônio da pessoa física são juridicamente unificados. A PGFN pode solicitar penhora de contas bancárias (Sisbajud) no CPF do titular se a dívida não for negociada."
      }
    ],
    serviceParam: "pj-atendimento"
  },

  // ==========================================
  // PEQUENAS EMPRESAS (SIMPLES NACIONAL / SOB MEDIDA)
  // ==========================================
  {
    slug: "regularizacao-cnpj-inapto-omissao",
    title: "Regularização de CNPJ Inapto por Omissão de Declarações na Receita Federal",
    shortTitle: "Reativação de CNPJ Inapto",
    subtitle: "Levantamento de declarações omissas (DEFIS, DCTF, ECF), transmissão das obrigações e reativação da empresa.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Reativação de empresas declaradas 'Inaptas' por omissão contínua de obrigações acessórias perante a Receita Federal do Brasil, eliminando bloqueio de emissão de notas fiscais, contas bancárias e responsabilidade ilimitada dos sócios.",
    excerpt: "Seu CNPJ está como 'Inapto' por omissão de declarações na Receita Federal? O contador diagnostica seu caso por R$ 99 e passa o orçamento exato para reativar seu CNPJ (com valor 100% abatido).",
    tags: ["cnpj inapto", "regularizar cnpj", "omissao declaracoes receita", "reativar empresa", "defis atrasada"],
    publicoAlvo: "Empresas do Simples Nacional ou Lucro Presumido que ficaram anos sem contador e tiveram o CNPJ declarado inapto.",
    oQueEstaIncluso: [
      "Diagnóstico técnico inicial aprofundado por R$ 99 com orçamento fechado (100% abatido se aprovar o serviço).",
      "Auditoria eletrônica de todas as pendências que motivaram o ato declaratório de inaptidão.",
      "Elaboração e transmissão de todas as declarações omissas (DEFIS, DCTFWeb, PGDAS, SPED, ECF ou DCTF).",
      "Protocolo de restabelecimento cadastral do CNPJ junto à Receita Federal.",
      "Emissão do Comprovante de Inscrição e de Situação Cadastral atualizado para 'Ativa'.",
      "Parecer técnico contábil assinado por contador habilitado no CRC."
    ],
    documentosNecessarios: [
      "Número do CNPJ e Contrato Social consolidado.",
      "Certificado digital da empresa (e-CNPJ) ou procuração eletrônica no e-CAC via gov.br do sócio administrador."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico Inicial (R$ 99)", descricao: "O contador acessa o dossiê da empresa no e-CAC e mapeia todas as obrigações que faltam ser entregues." },
      { passo: "2", titulo: "Proposta por Escrito", descricao: "Apresentamos o escopo completo, prazo e valor total fechado. Os R$ 99 pagos no diagnóstico são 100% abatidos." },
      { passo: "3", titulo: "Execução & Reativação", descricao: "Confeccionamos e transmitimos as declarações e acompanhamos até o CNPJ voltar ao status de 'Ativa'." }
    ],
    faqs: [
      {
        question: "Como funciona o valor de R$ 99 do diagnóstico?",
        answer: "O valor de R$ 99 é pago na hora de agendar para que o contador analise a fundo o histórico do CNPJ e monte um parecer formal com escopo e valor fechado. Se você aprovar a proposta, esses R$ 99 são integralmente abatidos do valor final do serviço."
      },
      {
        question: "Quais os perigos de manter um CNPJ inapto?",
        answer: "A inaptidão do CNPJ impede a emissão de notas fiscais, anula a idoneidade de documentos fiscais, bloqueia contas bancárias da empresa e, mais grave: a Receita pode responsabilizar pessoalmente os sócios pelos débitos tributários, afetando o CPF e bens particulares."
      }
    ],
    serviceParam: "sob-demanda"
  },
  {
    slug: "baixa-encerramento-cnpj-com-dividas",
    title: "Baixa e Encerramento Definitivo de CNPJ Inativo ou com Débitos",
    shortTitle: "Baixa de CNPJ com Dívidas",
    subtitle: "Extinção regular de empresas na Junta Comercial, Receita Federal, Estado e Prefeitura sem impedimento de débitos fiscais.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Encerramento formal de microempresas (ME) e empresas de pequeno porte (EPP): elaboração de Distrato Social, registro na Junta Comercial, baixa do CNPJ na Receita Federal e cancelamento de inscrições estadual e municipal.",
    excerpt: "Quer fechar de vez uma empresa parada que só gera taxas e dor de cabeça? Diagnosticamos as pendências por R$ 99 e passamos o orçamento fechado para extinguir seu CNPJ.",
    tags: ["baixa cnpj", "fechar empresa com divida", "distrato social", "encerrar cnpj simples nacional"],
    publicoAlvo: "Sócios de empresas inativas, sem movimentação ou com débitos acumulados que desejam estancar a geração de novas taxas e obrigações.",
    oQueEstaIncluso: [
      "Diagnóstico técnico inicial por R$ 99 com levantamento de débitos e taxas da Junta Comercial (100% abatido do serviço aprovado).",
      "Redação do Distrato Social formal ou Requerimento de Empresário para extinção.",
      "Protocolo e registro na Junta Comercial do Estado.",
      "Baixa definitiva da inscrição no CNPJ perante a Receita Federal.",
      "Cancelamento da Inscrição Municipal na Prefeitura e Inscrição Estadual na SEFAZ.",
      "Emissão de Certidão de Baixa de Inscrição no CNPJ."
    ],
    documentosNecessarios: [
      "Última alteração do Contrato Social da empresa.",
      "Documento de identificação (RG/CNH) dos sócios.",
      "Certificado digital dos sócios ou acesso gov.br nível Prata/Ouro."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico das Pendências", descricao: "Analisamos o contrato e as exigências da Junta Comercial do seu estado." },
      { passo: "2", titulo: "Redação do Distrato", descricao: "Preparamos a minuta de distrato formalizando o encerramento das atividades societárias." },
      { passo: "3", titulo: "Baixa nos Órgãos", descricao: "Protocolamos o processo digital integrado e entregamos a certidão do CNPJ extinto." }
    ],
    faqs: [
      {
        question: "É verdade que posso fechar empresa mesmo devendo imposto?",
        answer: "Sim! Desde a Lei Complementar 147/2014, nenhuma empresa pode ser impedida de dar baixa por motivo de dívidas tributárias ou previdenciárias. As dívidas são transferidas para a responsabilidade dos sócios, mas a empresa para de gerar novas obrigações mensais."
      }
    ],
    serviceParam: "sob-demanda"
  },
  {
    slug: "parcelamento-dividas-simples-nacional",
    title: "Parcelamento de Dívidas do Simples Nacional e Transação Tributária PGFN",
    shortTitle: "Parcelamento do Simples Nacional",
    subtitle: "Negociação de débitos de DAS, Simples Nacional e PGFN com prazo de até 60 a 145 meses e descontos sobre juros.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Consolidação e parcelamento de débitos do Simples Nacional apurados no PGDAS-D, evitando exclusão do regime tributário favorecido e suspendendo cobranças executivas com emissão de CND Positiva com Efeitos de Negativa.",
    excerpt: "Sua empresa acumulou dívidas no Simples Nacional e corre risco de exclusão? Analisamos seus débitos por R$ 99 e estruturamos a negociação em até 60x ou 145x com descontos.",
    tags: ["parcelamento simples nacional", "divida das simples", "parcelamento pgfn empresa", "exclusao simples nacional parcelar"],
    publicoAlvo: "Micro e pequenas empresas do Simples Nacional com débitos em cobrança na Receita Federal ou em Dívida Ativa da PGFN.",
    oQueEstaIncluso: [
      "Diagnóstico inicial por R$ 99 com simulação dos melhores editais de parcelamento e transação (100% abatido do serviço aprovado).",
      "Levantamento consolidado de todas as competências não quitadas no portal do Simples Nacional e e-CAC.",
      "Simulação de parcelamento convencional (até 60 meses) vs. Transação Tributária da PGFN (com descontos de até 70%).",
      "Transmissão do pedido de adesão oficial ao parcelamento.",
      "Emissão da primeira guia DAS de entrada para confirmação do acordo.",
      "Liberação e emissão da Certidão Negativa com Efeitos de Positiva (CPEN)."
    ],
    documentosNecessarios: [
      "Número do CNPJ e Código de Acesso do Simples Nacional ou Certificado Digital e-CNPJ.",
      "Acesso à conta gov.br do responsável legal."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico Consolidado", descricao: "Apuramos o total dos débitos com juros e multas e montamos a simulação comparativa." },
      { passo: "2", titulo: "Adesão ao Melhor Plano", descricao: "Selecionamos a modalidade que garante o menor valor de parcela mensal viável para a sua empresa." },
      { passo: "3", titulo: "Guia de Ativação", descricao: "Entregamos a primeira parcela para quitação e proteção imediata do seu CNPJ." }
    ],
    faqs: [
      {
        question: "O parcelamento impede a exclusão da minha empresa do Simples Nacional?",
        answer: "Sim! Ao aderir ao parcelamento e pagar a primeira parcela antes do prazo fatal do Termo de Exclusão, a exigibilidade dos créditos tributários fica suspensa e sua empresa permanece enquadrada no Simples Nacional."
      }
    ],
    serviceParam: "sob-demanda"
  },
  {
    slug: "defesa-exclusao-simples-nacional",
    title: "Defesa e Reenquadramento Contra Exclusão do Simples Nacional",
    shortTitle: "Defesa Exclusão do Simples",
    subtitle: "Atuação técnica para impugnar o Termo de Exclusão do Simples Nacional (ADE) ou solicitar reenquadramento extraordinário.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Intervenção contábil rápida para empresas que receberam o Termo de Exclusão do Simples Nacional por débitos fiscais ou divergências cadastrais, realizando a regularização emergencial para garantir a permanência no regime.",
    excerpt: "Recebeu o Termo de Exclusão do Simples Nacional? Diagnosticamos as causas por R$ 99 e elaboramos a defesa e regularização tempestiva para manter sua empresa no Simples.",
    tags: ["exclusao simples nacional", "termo de exclusao simples", "impugnacao simples nacional", "reenquadramento simples"],
    publicoAlvo: "Empresas intimadas com Ato Declaratório Executivo (ADE) de exclusão do Simples Nacional.",
    oQueEstaIncluso: [
      "Diagnóstico emergencial por R$ 99 dos motivos listados no Ato Declaratório Executivo (100% abatido do serviço aprovado).",
      "Plano emergencial de quitação ou parcelamento das pendências apontadas dentro do prazo legal de 30 dias.",
      "Protocolo de impugnação administrativa digital no e-CAC fundamentada em parecer contábil.",
      "Acompanhamento da homologação da opção retroativa pelo Simples Nacional.",
      "Parecer de regularidade e conformidade tributária com CRC."
    ],
    documentosNecessarios: [
      "Cópia do Termo de Exclusão / Notificação recebida na Caixa Postal do e-CAC.",
      "Certificado Digital (e-CNPJ) ou procuração eletrônica."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico do Prazo", descricao: "Avaliamos o prazo improrrogável de 30 dias a partir da ciência da notificação." },
      { passo: "2", titulo: "Saneamento Emergencial", descricao: "Parcelamos ou quitamos os débitos específicos listados no ato de exclusão." },
      { passo: "3", titulo: "Manutenção do Enquadramento", descricao: "Garantimos a permanência no Simples para o ano-calendário seguinte com economia tributária." }
    ],
    faqs: [
      {
        question: "Quanto tempo tenho para regularizar após receber a notificação?",
        answer: "O contribuinte tem 30 dias contados a partir da data de leitura da notificação no Domicílio Tributário Eletrônico (DTE-SN) para regularizar a totalidade dos débitos ou parcelá-los."
      }
    ],
    serviceParam: "sob-demanda"
  },
  {
    slug: "emissao-cnd-conjunta-empresa-rfb-pgfn",
    title: "Emissão e Desbloqueio de CND Conjunta para Empresas (RFB / PGFN / FGTS)",
    shortTitle: "CND para Empresas",
    subtitle: "Identificação e remoção de travas cadastrais para emissão de Certidão Negativa de Débitos Federal para sua empresa.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Auditoria fiscal em todas as bases tributárias federais para localizar a causa do travamento da CND da empresa, efetuando acertos em DCTF, EFD-Reinf ou parcelamentos para emissão imediata da certidão.",
    excerpt: "Sua empresa precisa de Certidão Negativa de Débitos (CND) e ela não sai? Identificamos a trava fiscal por R$ 99 e passamos o plano de desembaraço imediato.",
    tags: ["cnd empresa", "certidao negativa pessoa juridica", "cnd conjunta rfb pgfn", "certidao federal empresa"],
    publicoAlvo: "Pequenas empresas com pagamentos retidos por clientes, aprovação de crédito bancário ou participação em concorrências.",
    oQueEstaIncluso: [
      "Diagnóstico inicial por R$ 99 com varredura completa nas bases da Receita e PGFN (100% abatido do serviço aprovado).",
      "Identificação de divergências de GFIP/DCTFWeb ou pagamentos não alocados (REDARF).",
      "Pedido eletrônico de revisão ou desembaraço de débitos com exigibilidade suspensa.",
      "Emissão da Certidão Conjunta Negativa ou Positiva com Efeitos de Negativa.",
      "Relatório com memória das ações executadas pelo contador."
    ],
    documentosNecessarios: [
      "Número do CNPJ da empresa.",
      "Acesso ao e-CAC via certificado digital ou gov.br."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico da Trava", descricao: "Descobrimos exatamente qual guia ou obrigação está impedindo a emissão da certidão." },
      { passo: "2", titulo: "Correção Imediata", descricao: "Realizamos o ajuste do pagamento (REDARF) ou retificação contábil sem filas." },
      { passo: "3", titulo: "Liberação da CND", descricao: "Apresentamos a certidão válida e ativa para seus clientes ou instituição financeira." }
    ],
    faqs: [
      {
        question: "Por que minha empresa tem débitos suspensos mas a certidão não sai automaticamente?",
        answer: "Geralmente ocorre por atraso na compensação bancária ou falta de sincronização entre o sistema de parcelamento e a base central da Receita. Nosso contador realiza o procedimento de reconhecimento para forçar a emissão."
      }
    ],
    serviceParam: "sob-demanda"
  },
  {
    slug: "alteracao-contratual-socios-cnae",
    title: "Alteração Contratual: Troca de Sócios (QSA), Endereço e Atividades (CNAE)",
    shortTitle: "Alteração Contratual & CNAE",
    subtitle: "Elaboração de aditivo contratual consolidado, DBE na Receita Federal e registro na Junta Comercial.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Serviço societário completo para atualizar dados da sua empresa: entrada ou saída de sócios, transferência de quotas, inclusão de novas atividades econômicas (CNAE), mudança de endereço ou razão social.",
    excerpt: "Precisa alterar sócios, endereço ou atividades da sua empresa? Fazemos o diagnóstico por R$ 99 com orçamento fechado para todo o trâmite na Junta e Receita.",
    tags: ["alteracao contratual", "troca de socios qsa", "incluir cnae empresa", "mudar endereco cnpj"],
    publicoAlvo: "Empresários que estão reestruturando a sociedade ou expandindo a gama de serviços oferecidos pelo CNPJ.",
    oQueEstaIncluso: [
      "Diagnóstico prévio por R$ 99 com viabilidade locacional e enquadramento tributário do novo CNAE (100% abatido do serviço aprovado).",
      "Redação jurídica e contábil do Aditivo ao Contrato Social.",
      "Emissão do Documento Básico de Entrada (DBE) no portal Redesim da Receita Federal.",
      "Protocolo e tramitação eletrônica na Junta Comercial estadual.",
      "Atualização das inscrições cadastrais estadual e municipal.",
      "Comprovante de CNPJ atualizado com o novo quadro de sócios e atividades."
    ],
    documentosNecessarios: [
      "Último Contrato Social consolidado.",
      "Documentos dos sócios (RG/CNH e comprovante de residência).",
      "Novo endereço ou descrição das novas atividades que a empresa irá exercer."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico Societário", descricao: "Avaliamos a viabilidade e impacto no imposto do Simples Nacional." },
      { passo: "2", titulo: "Minuta do Aditivo", descricao: "Redigimos o instrumento contratual de acordo com o Código Civil e regras do DREI." },
      { passo: "3", titulo: "Registro Final", descricao: "Registramos o aditivo na Junta Comercial e entregamos o CNPJ devidamente atualizado." }
    ],
    faqs: [
      {
        question: "Mudar o CNAE pode alterar o valor do imposto do Simples Nacional?",
        answer: "Sim! Cada atividade econômica (CNAE) é enquadrada em um anexo diferente do Simples Nacional (com alíquotas que variam de 4,5% a 15,5% ou mais). Nosso contador orienta os melhores códigos para pagar o menor imposto legalmente possível."
      }
    ],
    serviceParam: "sob-demanda"
  },
  {
    slug: "processos-digitais-dossie-ecac",
    title: "Abertura de Processos Digitais e Dossiês de Atendimento no e-CAC",
    shortTitle: "Processos Digitais no e-CAC",
    subtitle: "Protocolo de requerimentos administrativos, pedidos de restituição (PER/DCOMP) e juntada de documentos oficiais.",
    category: "Pequenas Empresas",
    categorySlug: "pequenas-empresas",
    badge: "Diagnóstico R$ 99 · Sob Medida",
    priceCents: 9900,
    prazo: "Diagnóstico em até 48h úteis",
    modalidadePadrao: "sob-medida",
    description: "Representação técnica contábil para abertura de processos administrativos e dossiês digitais de atendimento perante auditores da Receita Federal do Brasil, eliminando a necessidade de agendamento presencial.",
    excerpt: "Precisa protocolar um requerimento formal na Receita Federal? Diagnosticamos a viabilidade por R$ 99 e passamos o valor fechado para instruir seu processo com parecer assinado.",
    tags: ["processo digital ecac", "dossie de atendimento receita", "requerimento rfb", "redarf per dcomp"],
    publicoAlvo: "Empresas e pessoas físicas que possuem demandas complexas ou atípicas que exigem análise manual por parte de um auditor fiscal.",
    oQueEstaIncluso: [
      "Diagnóstico inicial por R$ 99 com análise documental e fundamentação legal (100% abatido do serviço aprovado).",
      "Estruturação jurídica e contábil da petição ou requerimento inicial.",
      "Formatação e indexação dos documentos comprobatórios conforme padrões da Portaria RFB.",
      "Abertura do Dossiê Digital de Atendimento (DDA) no sistema oficial do e-CAC.",
      "Geração de protocolo de processo administrativo com número de tramitação nacional.",
      "Acompanhamento das intimações e notificações de despacho até a decisão final."
    ],
    documentosNecessarios: [
      "Documentos comprobatórios da demanda (guias pagas, contratos, notificações).",
      "Procuração eletrônica no e-CAC ou certificado digital (e-CPF ou e-CNPJ)."
    ],
    passoAPasso: [
      { passo: "1", titulo: "Diagnóstico Inicial", descricao: "Analisamos o caso e a instrução normativa aplicável à sua solicitação." },
      { passo: "2", titulo: "Montagem da Peça", descricao: "Elaboramos a petição técnica com os fundamentos contábeis cabíveis." },
      { passo: "3", titulo: "Protocolo Digital", descricao: "Protocolamos o processo no e-CAC e fornecemos o número para acompanhamento." }
    ],
    faqs: [
      {
        question: "Ainda é necessário ir presencialmente a uma agência da Receita Federal?",
        answer: "Não! Mais de 95% dos serviços da Receita Federal hoje são obrigatoriamente realizados por meio de Processos Digitais no e-CAC. Nossos contadores realizam todo o trâmite eletronicamente com validade jurídica nacional."
      }
    ],
    serviceParam: "sob-demanda"
  }
];

export function getAllServicos(): ServicoItem[] {
  return SERVICOS;
}

export function getServicoBySlug(slug: string): ServicoItem | undefined {
  return SERVICOS.find((s) => s.slug === slug);
}

export function getServicosByCategoria(categoriaSlug: string): ServicoItem[] {
  return SERVICOS.filter((s) => s.categorySlug === categoriaSlug);
}

export function getRelatedServicos(currentSlug: string, limit = 3): ServicoItem[] {
  const current = getServicoBySlug(currentSlug);
  if (!current) return SERVICOS.slice(0, limit);

  // Primeiro serviços da mesma categoria
  const sameCategory = SERVICOS.filter(
    (s) => s.categorySlug === current.categorySlug && s.slug !== currentSlug
  );

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const others = SERVICOS.filter(
    (s) => s.slug !== currentSlug && !sameCategory.some((sc) => sc.slug === s.slug)
  );

  return [...sameCategory, ...others].slice(0, limit);
}
