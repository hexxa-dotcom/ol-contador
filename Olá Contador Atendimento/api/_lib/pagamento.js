// Confirmação de cobrança Asaas (compartilhado por checkout/status e webhook).
// Usa o cliente admin (service_role) porque cria agendamento/notificação cross-cliente.
const asaas = require('./asaas');
const notify = require('./notify');
const { registrarEventoFunil } = require('./metricas');

const SITE_URL = process.env.SITE_URL || 'https://ola-contador.vercel.app';
// Mesmo teto usado no formulário de agendamento.
const LIMITE_RESUMO = 150;

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// SLA comercial do Atendimento Express: quantidade de dias úteis configurada
// em cada plano, contada da confirmação. O instante final fica salvo na
// contratação, então mudar o plano depois não altera prazos já prometidos.
function prazoExpressEmDiasUteis(inicio = new Date(), quantidade = 2) {
  const prazo = new Date(inicio);
  let restantes = Math.min(10, Math.max(1, parseInt(quantidade, 10) || 2));
  while (restantes > 0) {
    prazo.setDate(prazo.getDate() + 1);
    if (prazo.getDay() !== 0 && prazo.getDay() !== 6) restantes--;
  }
  return prazo;
}

async function registrarAtendimentoExpress(admin, dados) {
  const contratadoEm = dados.contratadoEm ? new Date(dados.contratadoEm) : new Date();
  const prazoConclusao = prazoExpressEmDiasUteis(contratadoEm, dados.prazoDiasUteis).toISOString();
  const payload = {
    cobranca_id: dados.cobrancaId,
    cliente_ref: dados.clienteRef,
    servico_id: dados.servicoId || null,
    assunto: dados.assunto || 'Atendimento Express',
    status: 'aguardando_triagem',
    contratado_em: contratadoEm.toISOString(),
    prazo_conclusao_em: prazoConclusao,
    updated_at: new Date().toISOString()
  };
  const { error } = await admin.from('atendimentos_express').upsert(payload, { onConflict: 'cobranca_id', ignoreDuplicates: true });
  if (error) {
    // Durante a publicação, a migração pode ser aplicada alguns minutos depois
    // do código. A cobrança já paga nunca pode ser desfeita por isso; o SQL de
    // migração faz o backfill e este erro continua visível nos logs.
    console.error('registro do Atendimento Express falhou:', error.message);
    return false;
  }
  const { data: atendimento } = await admin.from('atendimentos_express').select('id')
    .eq('cobranca_id', dados.cobrancaId).maybeSingle();
  if (atendimento) {
    const caseRef = `express:${atendimento.id}`;
    const { data: linha } = await admin.from('configuracoes').select('valor').eq('chave', 'tarefas').maybeSingle();
    const tarefas = Array.isArray(linha && linha.valor) ? linha.valor : [];
    if (!tarefas.some(tarefa => tarefa.caseRef === caseRef)) {
      tarefas.unshift({
        id: `task_express_${atendimento.id}`, texto: `Executar e entregar ${payload.assunto}`,
        feita: false, clientId: dados.clienteRef, caseRef, tipo: 'atendimento_express',
        dataInicial: contratadoEm.toISOString(), dataFinal: prazoConclusao, deadline: prazoConclusao
      });
      await admin.from('configuracoes').upsert({ chave: 'tarefas', valor: tarefas }, { onConflict: 'chave' });
    }
  }
  return true;
}

// Login mais simples possível pro cliente: em vez de mandar ele pra tela de
// login pra pedir um link, o link de acesso já chega pronto no e-mail assim
// que o pagamento confirma. Um único clique, sem senha, sem digitar nada.
async function enviarLinkDeAcesso(admin, email) {
  if (!email) return;
  try {
    const { error } = await admin.auth.signInWithOtp({
      email, options: { shouldCreateUser: false, emailRedirectTo: SITE_URL + '/login.html' }
    });
    if (error) console.error('envio do link de acesso falhou:', error.message);
  } catch (e) {
    console.error('envio do link de acesso falhou:', e.message);
  }
}

// Idempotente: se pago, cria o agendamento uma única vez.
async function confirmCobranca(admin, cob) {
  const modoCobranca = cob.modalidade === 'sem_agendamento' || (cob.dados_cliente && cob.dados_cliente.modalidade === 'sem_agendamento')
    ? 'sem_agendamento' : 'agendado';
  if (cob.status === 'paid' && modoCobranca === 'sem_agendamento') {
    // Reconciliador: se a cobrança foi marcada como paga mas a criação da fila
    // falhou numa tentativa anterior, toda nova consulta/webhook reconstrói o
    // Atendimento Express pelo identificador único da cobrança.
    const { data: servicoPago } = await admin.from('servicos').select('*').eq('id', cob.servico_id).maybeSingle();
    await registrarAtendimentoExpress(admin, {
      cobrancaId: cob.id, clienteRef: cob.cliente_ref, servicoId: cob.servico_id,
      assunto: (cob.dados_cliente && cob.dados_cliente.assunto) || (servicoPago && servicoPago.name),
      prazoDiasUteis: servicoPago && servicoPago.prazo_express_dias_uteis,
      contratadoEm: cob.paid_at || cob.created_at
    });
    return { status: 'paid', appointmentId: null };
  }
  if (cob.status === 'paid' && cob.appointment_id) {
    return { status: 'paid', appointmentId: cob.appointment_id };
  }
  const payment = await asaas.getPayment(cob.asaas_payment_id);
  if (!asaas.PAID_STATUSES.includes(payment.status)) return { status: 'pending' };

  let appointmentId = cob.appointment_id;
  if (!appointmentId) {
    const { data: servico } = await admin.from('servicos').select('*').eq('id', cob.servico_id).single();
    let { data: cliente } = await admin.from('clientes').select('*').eq('id', cob.cliente_ref).maybeSingle();

    // O cliente só nasce agora — pagamento confirmado — pra nunca sobrar
    // registro de quem gerou o Pix e desistiu. Os dados do formulário ficaram
    // guardados em cobrancas.dados_cliente desde o checkout até este momento.
    if (cob.dados_cliente) {
      const d = cob.dados_cliente;
      const modalidade = modoCobranca;
      const canalResultado = cob.canal_resultado === 'whatsapp' || d.canal_resultado === 'whatsapp'
        ? 'whatsapp' : 'email';
      // Colunas de endereço (scripts/nota-fiscal-colunas.sql) podem ainda não
      // existir no banco — sem este fallback, um erro de "coluna não existe"
      // derrubava o INSERT/UPDATE inteiro e o cliente deixava de ser criado.
      const enderecoCampos = { cep: d.cep || null, endereco: d.endereco || null, numero: d.numero || null, bairro: d.bairro || null };
      // Aciona a triagem obrigatória no primeiro login (ver cliente.js e
      // scripts/onboarding-pendente.sql). Só em clientes NOVOS — quem já tinha
      // conta e comprou de novo não volta a ficar preso nessa tela.
      const onboardingCampos = {
        onboarding_pendente: true,
        atendimento_modalidade: modalidade,
        canal_resultado: canalResultado,
        sem_agendamento_recebido_em: modalidade === 'sem_agendamento' ? new Date().toISOString() : null
      };
      const colunaFaltando = (msg) => /column|schema cache/i.test(msg || '');

      if (!cliente) {
        const basePayload = {
          id: cob.cliente_ref, name: d.name, cpf: cob.cliente_ref, email: d.email, phone: d.phone,
          sexo: d.sexo || null, cidade: d.cidade || null, estado: d.estado || null,
          tax_type: servico ? servico.name : null,
          honorarios: servico ? Math.round(servico.price_cents / 100) : null,
          status: 'pending'
        };
        let { data: novoCliente, error: erroCliente } = await admin.from('clientes')
          .insert({ ...basePayload, ...enderecoCampos, ...onboardingCampos }).select().single();
        if (erroCliente && colunaFaltando(erroCliente.message)) {
          ({ data: novoCliente, error: erroCliente } = await admin.from('clientes').insert(basePayload).select().single());
        }
        if (erroCliente) console.error('criação do cliente na confirmação falhou:', erroCliente.message);
        cliente = novoCliente || null;
      } else {
        // Já existia (comprou de novo). NUNCA sobrescreve contato já cadastrado
        // com o que veio agora no formulário: o checkout é público, sem login,
        // então nada garante que quem digitou este CPF/CNPJ é o dono dele —
        // sobrescrever e-mail/telefone aqui seria um jeito trivial de sequestrar
        // a conta de outra pessoa (bastaria saber o CPF dela e comprar de novo
        // com o próprio e-mail, herdando o link de acesso e o login automático).
        // Só completa o que ainda estiver vazio (ex.: cadastro feito pelo
        // contador sem e-mail). Atualização de contato de verdade só logado,
        // na área do cliente.
        const baseUpdate = {
          atendimento_modalidade: modalidade,
          canal_resultado: canalResultado,
          sem_agendamento_recebido_em: modalidade === 'sem_agendamento' ? new Date().toISOString() : null
        };
        // Uma nova compra sem agendamento sempre abre a triagem do caso, mesmo
        // para quem já era cliente. Não existe conversa ou reunião que possa
        // substituir essa coleta de contexto.
        if (modalidade === 'sem_agendamento') baseUpdate.onboarding_pendente = true;
        if (!cliente.email && d.email) baseUpdate.email = d.email;
        if (!cliente.phone && d.phone) baseUpdate.phone = d.phone;
        if (!cliente.sexo && d.sexo) baseUpdate.sexo = d.sexo;
        if (!cliente.cidade && d.cidade) baseUpdate.cidade = d.cidade;
        if (!cliente.estado && d.estado) baseUpdate.estado = d.estado;
        const enderecoSoVazio = {};
        if (!cliente.cep && enderecoCampos.cep) enderecoSoVazio.cep = enderecoCampos.cep;
        if (!cliente.endereco && enderecoCampos.endereco) enderecoSoVazio.endereco = enderecoCampos.endereco;
        if (!cliente.numero && enderecoCampos.numero) enderecoSoVazio.numero = enderecoCampos.numero;
        if (!cliente.bairro && enderecoCampos.bairro) enderecoSoVazio.bairro = enderecoCampos.bairro;
        if (Object.keys(baseUpdate).length || Object.keys(enderecoSoVazio).length) {
          const { error: erroUpdate } = await admin.from('clientes').update({ ...baseUpdate, ...enderecoSoVazio }).eq('id', cliente.id);
          if (erroUpdate && colunaFaltando(erroUpdate.message)) {
            await admin.from('clientes').update(baseUpdate).eq('id', cliente.id);
          }
          // Reflete no objeto em memória: o resto desta função (criação de
          // conta, link de acesso, login automático) tem que enxergar o e-mail
          // certo — o que ficou no banco, não o que foi só digitado agora.
          Object.assign(cliente, baseUpdate, enderecoSoVazio);
        }
      }
      if (cliente && (d.assunto || d.summary)) {
        // Status 'rascunho', não 'enviada': isto é só o resumo que a pessoa
        // escreveu na hora de agendar, pré-preenchendo o formulário da
        // triagem. Se nascesse como 'enviada', a tela mostraria direto o modo
        // resumo (ver triagem.js) e a pessoa nunca passaria pelo formulário —
        // era exatamente por isso que a triagem obrigatória pós-pagamento não
        // acontecia. Só um envio de verdade pelo cliente muda esse status.
        await admin.from('triagens').upsert({
          cobranca_id: cob.id,
          cliente_ref: cliente.id, assunto: d.assunto || (servico ? servico.name : ''),
          descricao: d.summary ? String(d.summary).slice(0, LIMITE_RESUMO) : null,
          status: 'rascunho'
        }, { onConflict: 'cobranca_id', ignoreDuplicates: true });
      }
    }

    // Recompra feita já dentro do portal não carrega dados_cliente, porque a
    // identidade vem da sessão. Ainda assim a modalidade e o canal pertencem
    // ao novo caso e precisam assumir o fluxo atual do cliente.
    if (cliente && !cob.dados_cliente) {
      const patchModalidade = {
        atendimento_modalidade: modoCobranca,
        canal_resultado: cob.canal_resultado === 'whatsapp' ? 'whatsapp' : 'email',
        sem_agendamento_recebido_em: modoCobranca === 'sem_agendamento' ? new Date().toISOString() : null
      };
      if (modoCobranca === 'sem_agendamento') patchModalidade.onboarding_pendente = true;
      await admin.from('clientes').update(patchModalidade).eq('id', cliente.id);
      Object.assign(cliente, patchModalidade);
    }

    if (modoCobranca !== 'sem_agendamento') {
      const { data: appt } = await admin.from('agendamentos').upsert({
        cobranca_id: cob.id,
        cliente_ref: cob.cliente_ref, client_name: cliente ? cliente.name : cob.cliente_ref,
        date: cob.appt_date || 'A definir', time: cob.appt_time || '',
        tax_type: servico ? servico.name : '', status: 'pending'
      }, { onConflict: 'cobranca_id', ignoreDuplicates: true }).select().maybeSingle();
      if (!appt) {
        const { data: existente } = await admin.from('agendamentos').select('id').eq('cobranca_id', cob.id).maybeSingle();
        appointmentId = existente ? existente.id : null;
      } else {
        appointmentId = appt.id;
      }
    }

    const confirmadoEm = new Date();
    await admin.from('cobrancas').update({ status: 'paid', paid_at: confirmadoEm.toISOString(), appointment_id: appointmentId }).eq('id', cob.id);
    await registrarEventoFunil(admin, 'pagamento_confirmado', {
      cobrancaId: cob.id, clienteRef: cob.cliente_ref, servicoId: cob.servico_id,
      origem: cob.origem || 'plataforma', metadata: { valorCents: cob.valor_cents, descontoCents: cob.desconto_cents || 0 }
    });
    if (modoCobranca === 'sem_agendamento') {
      await registrarAtendimentoExpress(admin, {
        cobrancaId: cob.id,
        clienteRef: cob.cliente_ref,
        servicoId: cob.servico_id,
        assunto: (cob.dados_cliente && cob.dados_cliente.assunto) || (servico && servico.name),
        prazoDiasUteis: servico && servico.prazo_express_dias_uteis,
        contratadoEm: confirmadoEm
      });
    }
    await admin.from('notificacoes').insert({
      text: modoCobranca === 'sem_agendamento'
        ? `Atendimento Express recebido: ${cliente ? cliente.name : cob.cliente_ref} contratou ${servico ? servico.name : ''}.`
        : `Pagamento confirmado: ${cliente ? cliente.name : cob.cliente_ref} agendou ${servico ? servico.name : ''}.`,
      time: nowTime(), unread: true, cliente_ref: cob.cliente_ref
    });

    // Só agora — pagamento confirmado — nasce a conta de acesso do cliente.
    // Erro aqui não derruba a confirmação: o agendamento já está garantido.
    if (cliente && cliente.email && !cliente.user_id) {
      try {
        const { data: novoUser, error: erroAuth } = await admin.auth.admin.createUser({ email: cliente.email, email_confirm: true });
        if (!erroAuth && novoUser && novoUser.user) {
          await admin.from('clientes').update({ user_id: novoUser.user.id }).eq('id', cliente.id);
        } else if (erroAuth) {
          console.error('criação de conta do cliente falhou:', erroAuth.message);
        }
      } catch (e) {
        console.error('criação de conta do cliente falhou:', e.message);
      }
    }
    if (cliente && cliente.email) await enviarLinkDeAcesso(admin, cliente.email);

    if (notify.anyConfigured() && cliente) {
      const quando = [cob.appt_date, cob.appt_time].filter(Boolean).join(' às ');
      if (modoCobranca === 'sem_agendamento') {
        notify.notifyCliente(cliente, 'Atendimento Express recebido',
          `Recebemos seu pagamento de <strong>${servico ? servico.name : 'atendimento'}</strong>. ` +
          'Entre na sua área para concluir a triagem e enviar os documentos. Não é necessário marcar horário ou conversar pelo chat.',
          { channel: cob.canal_resultado || 'email' });
      } else {
        notify.notifyCliente(cliente, 'Pagamento confirmado — atendimento agendado',
          `Recebemos seu pagamento de <strong>${servico ? servico.name : 'atendimento'}</strong>. ` +
          `Seu horário${quando ? ' (' + quando + ')' : ''} está confirmado.`);
      }
    }

    // Emissão automática de nota fiscal de serviço, se o contador ativou em
    // Configurações → Integrações → Nota Fiscal (chave 'nota_fiscal_config').
    // Pré-requisito FORA deste código: a conta Asaas precisa ter as
    // informações fiscais (fiscalInfo) já configuradas — sem isso o Asaas
    // recusa e o erro fica só no log, sem travar a confirmação do pagamento.
    try {
      const { data: cfgRow } = await admin.from('configuracoes').select('valor').eq('chave', 'nota_fiscal_config').maybeSingle();
      const nf = cfgRow && cfgRow.valor;
      if (nf && nf.ativo && nf.municipalServiceId) {
        const invoice = await asaas.createInvoice({
          payment: cob.asaas_payment_id,
          serviceDescription: nf.descricao || (servico ? servico.name : 'Atendimento contábil'),
          observations: nf.observacoes || '',
          municipalServiceId: nf.municipalServiceId,
          municipalServiceName: nf.municipalServiceName || (servico ? servico.name : undefined),
          value: (cob.valor_cents || 0) / 100
        });
        await admin.from('cobrancas').update({ nota_fiscal_id: invoice.id, nota_fiscal_status: invoice.status }).eq('id', cob.id);
      }
    } catch (e) {
      console.error('emissão automática de nota fiscal falhou:', e.message);
    }
  }
  return { status: 'paid', appointmentId };
}

// Espelha também eventos negativos do Asaas. A cobrança mantém o histórico e
// somente operações ainda abertas são canceladas; um relatório já entregue
// nunca é apagado por causa de estorno posterior.
async function sincronizarCobrancaAsaas(admin, cob) {
  const payment = await asaas.getPayment(cob.asaas_payment_id);
  if (asaas.PAID_STATUSES.includes(payment.status)) return confirmCobranca(admin, cob);

  const mapa = {
    REFUNDED: 'refunded', REFUND_REQUESTED: 'refund_requested', REFUND_IN_PROGRESS: 'refund_in_progress',
    PARTIALLY_REFUNDED: 'partially_refunded', DELETED: 'cancelled', OVERDUE: 'overdue',
    CHARGEBACK_REQUESTED: 'disputed', CHARGEBACK_DISPUTE: 'disputed',
    AWAITING_CHARGEBACK_REVERSAL: 'disputed', AWAITING_RISK_ANALYSIS: 'pending'
  };
  const status = mapa[payment.status] || 'pending';
  await admin.from('cobrancas').update({ status }).eq('id', cob.id);

  if (['refunded', 'cancelled', 'disputed'].includes(status)) {
    await admin.from('atendimentos_express').update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('cobranca_id', cob.id).not('status', 'in', '(concluido,cancelado)');
    if (cob.appointment_id) {
      await admin.from('agendamentos').update({ status: 'cancelled' })
        .eq('id', cob.appointment_id).neq('status', 'done');
    }
  }
  return { status, providerStatus: payment.status, appointmentId: cob.appointment_id || null };
}

// Login automático logo após o pagamento — sem esperar o cliente abrir o
// e-mail e clicar no link (esse link continua sendo enviado, como reserva
// pra quando a pessoa voltar depois). `generateLink` não manda nada: só gera
// um token válido que o navegador troca por sessão na hora, via
// sb.auth.verifyOtp({ token_hash, type: 'magiclink' }) — ver checkout.html.
// Chamar isto exige que quem pediu já provou ser o dono do pagamento (o
// poll_token da cobrança), nunca a partir de um id adivinhável.
async function gerarAutoLogin(admin, clienteRef) {
  try {
    const { data: cliente } = await admin.from('clientes').select('email, user_id').eq('id', clienteRef).maybeSingle();
    if (!cliente || !cliente.email) return null;
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: cliente.email });
    if (error || !data || !data.properties) {
      if (error) console.error('geração de login automático falhou:', error.message);
      return null;
    }
    // generateLink cria a conta de autenticação sozinho se, por algum motivo,
    // o createUser lá em cima (confirmCobranca) tiver falhado antes. Sem este
    // reforço, o cliente ficaria autenticado com um user_id que a tabela
    // `clientes` nunca chegou a registrar — e my_client_id() (RLS) não
    // resolveria mais para ninguém.
    if (data.user && data.user.id && data.user.id !== cliente.user_id) {
      await admin.from('clientes').update({ user_id: data.user.id }).eq('id', clienteRef);
    }
    return { email: cliente.email, tokenHash: data.properties.hashed_token };
  } catch (e) {
    console.error('geração de login automático falhou:', e.message);
    return null;
  }
}

module.exports = {
  confirmCobranca,
  nowTime,
  enviarLinkDeAcesso,
  gerarAutoLogin,
  prazoExpressEmDiasUteis,
  registrarAtendimentoExpress,
  sincronizarCobrancaAsaas
};
