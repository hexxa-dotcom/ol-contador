// ============================================================================
// triagem-catalogo.js — a LÓGICA da triagem. O conteúdo mora no banco.
//
// Os assuntos, perguntas e documentos vêm da tabela `configuracoes`
// (chave 'triagem_assuntos') e o contador edita tudo em Configurações →
// Área do Cliente. A lista aqui embaixo é só a REDE DE SEGURANÇA: se o banco
// não responder, a triagem abre com ela em vez de aparecer vazia para alguém
// que acabou de pagar.
//
// Carregado pelos DOIS portais: o do cliente monta o formulário, e o do contador
// traduz as respostas ao exibir. Se cada um tivesse a sua cópia, uma pergunta
// renomeada viraria resposta órfã na tela do contador.
//
// COMO O CLIENTE FALA ≠ COMO O CONTADOR FALA. O cliente chega dizendo "recebi
// uma carta da Receita"; o diagnóstico "Malha Fina - Omissão de Rendimentos" é
// conclusão técnica, e quem conclui é o contador. Por isso `diagnosticoProvavel`
// é HIPÓTESE: entra no prontuário como sugestão a confirmar, nunca decidido.
// ============================================================================
window.OC_TRIAGEM = {

  // Regras editáveis (chave 'triagem_regras'). Os valores aqui são o padrão.
  regras: { minimoRelato: 20, obrigatoriaParaChat: false },

  carregado: false,

  // Busca o catálogo do banco. Em silêncio, de propósito: se falhar, a lista
  // embutida assume e o cliente nem percebe — melhor um catálogo velho do que
  // uma tela vazia.
  async carregar() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      if (cfg && Array.isArray(cfg.triagem_assuntos) && cfg.triagem_assuntos.length) {
        this.assuntos = cfg.triagem_assuntos;
      }
      if (cfg && cfg.triagem_regras) {
        this.regras = Object.assign({}, this.regras, cfg.triagem_regras);
      }
      this.carregado = true;
    } catch (e) {
      console.warn('[triagem] usando o catálogo embutido:', e && e.message);
    }
    return this.assuntos;
  },

  // Tipos de pergunta aceitos: 'texto', 'textao', 'data', 'escolha', 'sim-nao'.
  assuntos: [
    {
      id: 'malha-fina',
      titulo: 'Caí na malha fina ou recebi uma carta da Receita',
      resumo: 'Intimação, notificação ou aviso no e-CAC',
      icone: 'fa-triangle-exclamation',
      diagnosticoProvavel: 'Malha Fina - Omissão de Rendimentos de Trabalho',
      // A resposta refina a hipótese: "despesa médica" aponta para outra coisa.
      diagnosticoPorResposta: {
        pergunta: 'motivo',
        mapa: {
          'Despesas médicas': 'Malha Fina - Glosa de Despesas Médicas sem Comprovante',
          'Rendimentos que não declarei': 'Malha Fina - Omissão de Rendimentos de Trabalho'
        }
      },
      perguntas: [
        { id: 'ano', label: 'De qual ano é a declaração?', tipo: 'texto',
          dica: 'Costuma estar no topo da carta. Ex.: 2024' },
        { id: 'motivo', label: 'A carta diz o motivo?', tipo: 'escolha',
          opcoes: ['Rendimentos que não declarei', 'Despesas médicas', 'Dependentes',
                   'Aluguéis', 'Não diz / não entendi'],
          dica: 'Se não souber, tudo bem — o contador descobre na hora' },
        { id: 'prazo', label: 'A carta dá algum prazo?', tipo: 'data', opcional: true,
          dica: 'Se houver data limite, ela muda a ordem das coisas' },
        { id: 'valor', label: 'A Receita cobra algum valor?', tipo: 'texto', opcional: true,
          dica: 'Ex.: R$ 3.200,00' }
      ],
      documentos: ['Notificação da Receita', 'Declaração do IR do ano citado',
                   'Comprovante de Rendimentos', 'CPF e RG']
    },

    {
      id: 'vendi-bem',
      titulo: 'Vendi um imóvel, carro ou outro bem',
      resumo: 'Venda com lucro pode gerar imposto',
      icone: 'fa-house-circle-check',
      diagnosticoProvavel: 'Ganho de Capital - Venda de Imóvel sem Recolhimento de ITBI/IR',
      perguntas: [
        { id: 'oque', label: 'O que você vendeu?', tipo: 'escolha',
          opcoes: ['Imóvel residencial', 'Imóvel comercial', 'Terreno', 'Veículo', 'Outro bem'] },
        { id: 'quando', label: 'Quando foi a venda?', tipo: 'data',
          dica: 'A data importa: alguns prazos contam a partir dela' },
        { id: 'valores', label: 'Por quanto comprou e por quanto vendeu?', tipo: 'texto',
          dica: 'Ex.: comprei por 200 mil, vendi por 350 mil' },
        { id: 'reinvestiu', label: 'Comprou outro imóvel com esse dinheiro?', tipo: 'sim-nao',
          opcional: true, dica: 'Existe isenção em alguns casos — por isso a pergunta' }
      ],
      documentos: ['Escritura ou contrato de venda', 'Documento da compra original',
                   'Comprovantes de reformas', 'CPF e RG']
    },

    {
      id: 'mei-pendencia',
      titulo: 'Sou MEI e estou com pendências',
      resumo: 'Guias atrasadas, declaração anual ou desenquadramento',
      icone: 'fa-store',
      diagnosticoProvavel: 'Desenquadramento e Débitos retroativos do MEI',
      perguntas: [
        { id: 'oque', label: 'Qual é a situação?', tipo: 'escolha',
          opcoes: ['Tenho guias DAS atrasadas', 'Não entreguei a declaração anual',
                   'Faturei acima do limite', 'Fui desenquadrado', 'Não sei ao certo'] },
        { id: 'desde', label: 'Desde quando está assim?', tipo: 'texto', opcional: true,
          dica: 'Ex.: desde o começo de 2025' },
        { id: 'faturamento', label: 'Quanto faturou no último ano, mais ou menos?', tipo: 'texto',
          opcional: true, dica: 'Um número aproximado já ajuda' }
      ],
      documentos: ['CNPJ do MEI', 'Guias DAS em aberto', 'Extrato do Simples Nacional', 'CPF e RG']
    },

    {
      id: 'autonomo',
      titulo: 'Recebo como autônomo e não sei se pago certo',
      resumo: 'Carnê-leão, INSS e recibos',
      icone: 'fa-user-clock',
      diagnosticoProvavel: 'Carnê-Leão - Falta de Recolhimento Mensal de Autônomo',
      perguntas: [
        { id: 'atividade', label: 'Do que você trabalha?', tipo: 'texto',
          dica: 'Ex.: sou dentista, atendo em consultório próprio' },
        { id: 'dequem', label: 'Recebe de pessoas físicas ou de empresas?', tipo: 'escolha',
          opcoes: ['Só de pessoas físicas', 'Só de empresas', 'Dos dois'],
          dica: 'Isso muda quem tem obrigação de recolher' },
        { id: 'recolhe', label: 'Já recolhe o carnê-leão todo mês?', tipo: 'sim-nao' }
      ],
      documentos: ['Recibos ou notas emitidas', 'Extratos bancários do período',
                   'Comprovantes de INSS', 'CPF e RG']
    },

    {
      id: 'ir-atrasado',
      titulo: 'Não declarei o IR ou declarei errado',
      resumo: 'Declaração atrasada, retificação ou primeira vez',
      icone: 'fa-file-circle-exclamation',
      diagnosticoProvavel: null, // Depende demais do caso: o contador decide.
      perguntas: [
        { id: 'situacao', label: 'Qual é o caso?', tipo: 'escolha',
          opcoes: ['Nunca declarei', 'Atrasei a entrega', 'Declarei com erro e quero corrigir',
                   'Não sei se preciso declarar'] },
        { id: 'anos', label: 'De quais anos?', tipo: 'texto', opcional: true,
          dica: 'Ex.: 2023 e 2024' },
        { id: 'multa', label: 'Já recebeu alguma cobrança de multa?', tipo: 'sim-nao', opcional: true }
      ],
      documentos: ['Comprovante de Rendimentos', 'Informes bancários',
                   'Declarações anteriores', 'CPF e RG']
    },

    {
      id: 'outro',
      titulo: 'Meu caso é outro',
      resumo: 'Conte com suas palavras e o contador se prepara',
      icone: 'fa-comment-dots',
      diagnosticoProvavel: null,
      perguntas: [],
      documentos: ['CPF e RG']
    }
  ],

  acharAssunto(id) {
    return this.assuntos.filter(function (a) { return a.id === id; })[0] || null;
  },

  // A hipótese que vai para o prontuário do contador. Nunca é conclusão: o painel
  // mostra "sugerido pela triagem" e o contador confirma ou troca.
  diagnosticoSugerido(assuntoId, respostas) {
    const a = this.acharAssunto(assuntoId);
    if (!a) return null;
    const regra = a.diagnosticoPorResposta;
    if (regra && respostas) {
      const resposta = respostas[regra.pergunta];
      if (resposta && regra.mapa[resposta]) return regra.mapa[resposta];
    }
    return a.diagnosticoProvavel;
  },

  // Vira o clientes.checklist ({"Documento": jáEntregue}). O contador já enxerga
  // essa lista no prontuário, então a triagem só precisa preenchê-la.
  checklistDoAssunto(assuntoId) {
    const a = this.acharAssunto(assuntoId);
    const out = {};
    if (a) a.documentos.forEach(function (d) { out[d] = false; });
    return out;
  },

  // Quanto da triagem está preenchido. Serve para o medidor do cliente e para o
  // contador saber, de relance, se o contexto é confiável ou raso.
  completude(triagem) {
    if (!triagem || !triagem.assunto) return 0;
    const a = this.acharAssunto(triagem.assunto);
    if (!a) return 0;
    const respostas = triagem.respostas || {};

    // Peso maior no relato: é o que mais economiza tempo na hora do atendimento.
    let pontos = 30;                                        // escolheu o assunto
    if ((triagem.descricao || '').trim().length >= (this.regras.minimoRelato || 20)) pontos += 30;

    const total = a.perguntas.length;
    if (total === 0) return Math.min(100, pontos + 40);     // assunto 'outro'
    let respondidas = 0;
    a.perguntas.forEach(function (p) {
      const v = respostas[p.id];
      if (v !== undefined && v !== null && String(v).trim() !== '') respondidas++;
    });
    pontos += Math.round((respondidas / total) * 40);
    return Math.min(100, pontos);
  }
};
