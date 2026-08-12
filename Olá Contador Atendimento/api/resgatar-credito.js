// POST /api/resgatar-credito — resgate público (sem login) de um crédito de
// atendimento gerado pelo contador. Mesmo formulário do /api/signup-checkout,
// mas sem Asaas: o crédito já cobre o valor, então o cliente cai direto
// confirmado no sistema, sem passar pelo checkout/pagamento.
// body: { codigo, name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary }
const { adminClient } = require('./_lib/auth');
const { validarCpfCnpj } = require('../documento');
const { enviarLinkDeAcesso, gerarAutoLogin, registrarAtendimentoExpress } = require('./_lib/pagamento');
const { checarRateLimit } = require('./_lib/rateLimit');
const notify = require('./_lib/notify');
const { registrarEventoFunil } = require('./_lib/metricas');

// Mesmo teto do campo no site — ver comentário em signup-checkout.js.
const LIMITE_RESUMO = 150;

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { codigo, name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary, assunto, modalidade } = req.body || {};
  if (!codigo || !name || !email || !phone || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  const { valido, digitos } = validarCpfCnpj(cpfCnpj);
  if (!valido) return res.status(400).json({ error: 'cpf_cnpj_invalido' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });
  // Limite um pouco mais apertado aqui: esse endpoint testa um código contra
  // o banco, então é o alvo natural de uma tentativa de força bruta.
  if (!(await checarRateLimit(admin, req, 'resgatar-credito', 10, 15))) {
    return res.status(429).json({ error: 'muitas_tentativas', detail: 'Tente de novo em alguns minutos.' });
  }

  const { data: credito } = await admin.from('creditos').select('*').eq('codigo', String(codigo).trim().toUpperCase()).maybeSingle();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(410).json({ error: 'credito_indisponivel' });
  if (credito.expira_em && new Date(credito.expira_em) <= new Date()) return res.status(410).json({ error: 'credito_expirado' });

  const { data: servico } = await admin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });
  if (servico.price_cents > credito.valor_cents) return res.status(400).json({ error: 'credito_insuficiente' });
  const modo = modalidade === 'sem_agendamento' ? 'sem_agendamento' : 'agendado';
  const canal = 'email';
  if (modo === 'agendado' && (!date || !time)) return res.status(400).json({ error: 'invalid_params' });

  try {
    const clientId = digitos;
    const { data: existente } = await admin.from('clientes').select('*').eq('id', clientId).maybeSingle();
    if (!existente) {
      // onboarding_pendente aciona a triagem obrigatória no primeiro login (ver
      // cliente.js) — só em clientes novos, mesmo critério de signup-checkout.js.
      const { error: erroInsert } = await admin.from('clientes').insert({
        id: clientId, name, cpf: digitos, email, phone,
        sexo: sexo || null, cidade: cidade || null, estado: estado || null,
        tax_type: servico.name, honorarios: Math.round(servico.price_cents / 100),
        status: 'pending', onboarding_pendente: true,
        atendimento_modalidade: modo, canal_resultado: canal,
        sem_agendamento_recebido_em: modo === 'sem_agendamento' ? new Date().toISOString() : null
      });
      if (erroInsert) throw erroInsert;
    } else {
      // Cliente já existia. NUNCA sobrescreve contato já cadastrado a partir do
      // que foi digitado agora: um código de crédito não prova que quem está
      // resgatando é o dono do CPF — sobrescrever e-mail/telefone aqui seria um
      // jeito trivial de herdar o login automático de outra pessoa (mesmo risco
      // corrigido em signup-checkout.js/pagamento.js). Só completa o que ainda
      // estiver vazio.
      const baseUpdate = {
        atendimento_modalidade: modo,
        canal_resultado: canal,
        sem_agendamento_recebido_em: modo === 'sem_agendamento' ? new Date().toISOString() : null
      };
      if (modo === 'sem_agendamento') baseUpdate.onboarding_pendente = true;
      if (!existente.email && email) baseUpdate.email = email;
      if (!existente.phone && phone) baseUpdate.phone = phone;
      if (!existente.sexo && sexo) baseUpdate.sexo = sexo;
      if (!existente.cidade && cidade) baseUpdate.cidade = cidade;
      if (!existente.estado && estado) baseUpdate.estado = estado;
      if (Object.keys(baseUpdate).length) await admin.from('clientes').update(baseUpdate).eq('id', clientId);
    }
    // A conta de acesso e o login automático sempre usam o e-mail que ficou no
    // banco (o já cadastrado, se havia um) — nunca o que veio agora no
    // formulário, pelo mesmo motivo acima.
    const emailParaAcesso = (existente && existente.email) || email;
    // O assunto sozinho já diz do que se trata, então a triagem é criada mesmo
    // sem descrição — antes, quem não escrevia nada não gerava triagem nenhuma e
    // o caso chegava no painel sem contexto. Status 'rascunho', não 'enviada':
    // é só um pré-preenchimento, o cliente ainda precisa passar pela triagem de
    // verdade (mesmo motivo do signup-checkout — ver pagamento.js).
    if (assunto || summary) {
      await admin.from('triagens').insert({
        cliente_ref: clientId, assunto: assunto || servico.name,
        descricao: summary ? String(summary).slice(0, LIMITE_RESUMO) : null,
        status: 'rascunho'
      });
    }

    let appt = null;
    if (modo === 'agendado') {
      const { data } = await admin.from('agendamentos').insert({
        cliente_ref: clientId, client_name: name, date, time,
        tax_type: servico.name, status: 'pending'
      }).select().single();
      appt = data || null;
    }

    const { data: cob, error: erroCob } = await admin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, valor_cents: servico.price_cents,
      valor_original_cents: servico.price_cents, desconto_cents: 0,
      desconto_tipo: 'credito_atendimento', origem: 'credito',
      status: 'paid', billing_type: 'CREDITO', paid_at: new Date().toISOString(),
      appt_date: modo === 'agendado' ? date : null, appt_time: modo === 'agendado' ? time : null,
      appointment_id: appt ? appt.id : null, modalidade: modo, canal_resultado: canal
    }).select().single();
    if (erroCob) throw erroCob;

    if (modo === 'sem_agendamento') {
      await registrarAtendimentoExpress(admin, {
        cobrancaId: cob.id,
        clienteRef: clientId,
        servicoId,
        assunto: assunto || servico.name,
        prazoDiasUteis: servico.prazo_express_dias_uteis,
        contratadoEm: cob.paid_at || new Date()
      });
    }

    const { data: creditoConsumido, error: erroConsumo } = await admin.from('creditos').update({
      status: 'usado', usado_em: new Date().toISOString(), cliente_ref: clientId, cobranca_id: cob.id
    }).eq('id', credito.id).eq('status', 'ativo').select('id').maybeSingle();
    if (erroConsumo || !creditoConsumido) {
      await admin.from('cobrancas').delete().eq('id', cob.id);
      if (appt) await admin.from('agendamentos').delete().eq('id', appt.id);
      throw new Error('credito_ja_utilizado');
    }
    await registrarEventoFunil(admin, 'credito_resgatado', {
      cobrancaId: cob.id, clienteRef: clientId, servicoId, origem: 'credito', metadata: { codigo: credito.codigo }
    });
    await registrarEventoFunil(admin, 'pagamento_confirmado', {
      cobrancaId: cob.id, clienteRef: clientId, servicoId, origem: 'credito', metadata: { valorCents: servico.price_cents }
    });

    await admin.from('notificacoes').insert({
      text: modo === 'sem_agendamento'
        ? `Crédito resgatado: ${name} iniciou Atendimento Express de ${servico.name}.`
        : `Crédito resgatado: ${name} agendou ${servico.name} com o código ${credito.codigo}.`,
      time: nowTime(), unread: true, cliente_ref: clientId
    });

    if (emailParaAcesso) {
      try {
        const { data: clienteAtual } = await admin.from('clientes').select('user_id').eq('id', clientId).single();
        if (clienteAtual && !clienteAtual.user_id) {
          const { data: novoUser, error: erroAuth } = await admin.auth.admin.createUser({ email: emailParaAcesso, email_confirm: true });
          if (!erroAuth && novoUser && novoUser.user) {
            await admin.from('clientes').update({ user_id: novoUser.user.id }).eq('id', clientId);
          } else if (erroAuth) {
            console.error('criação de conta via crédito falhou:', erroAuth.message);
          }
        }
      } catch (e) {
        console.error('criação de conta via crédito falhou:', e.message);
      }
    }
    if (emailParaAcesso) await enviarLinkDeAcesso(admin, emailParaAcesso);

    // Confirmação é síncrona aqui (sem Asaas no meio), então o login automático
    // já pode voltar nesta mesma resposta — sem precisar de polling como no
    // checkout com Pix/cartão (ver checkout.html).
    const autoLogin = emailParaAcesso ? await gerarAutoLogin(admin, clientId) : null;

    const { data: clienteParaAviso } = await admin.from('clientes').select('*').eq('id', clientId).single();
    if (clienteParaAviso) {
      notify.notifyCliente(clienteParaAviso,
        modo === 'sem_agendamento' ? 'Atendimento Express recebido' : 'Atendimento confirmado',
        modo === 'sem_agendamento'
          ? `Seu atendimento de <strong>${servico.name}</strong> foi recebido. Entre na sua área para concluir a triagem e enviar os documentos.`
          : `Seu atendimento de <strong>${servico.name}</strong> está confirmado para ${date} às ${time}.`,
        modo === 'sem_agendamento' ? { channel: canal } : {});
    }

    res.json({
      clientId, appointmentId: appt ? appt.id : null,
      servico: { id: servico.id, name: servico.name },
      valor: servico.price_cents / 100, status: 'confirmado', autoLogin
    });
  } catch (e) {
    console.error('resgatar-credito error:', e.message);
    res.status(500).json({ error: 'resgate_failed', detail: e.message });
  }
};
