// POST /api/resgatar-credito — resgate público (sem login) de um crédito de
// atendimento gerado pelo contador. Mesmo formulário do /api/signup-checkout,
// mas sem Asaas: o crédito já cobre o valor, então o cliente cai direto
// confirmado no sistema, sem passar pelo checkout/pagamento.
// body: { codigo, name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary }
const { adminClient } = require('./_lib/auth');
const { validarCpfCnpj } = require('../documento');
const { enviarLinkDeAcesso, gerarAutoLogin } = require('./_lib/pagamento');
const { checarRateLimit } = require('./_lib/rateLimit');

// Mesmo teto do campo no site — ver comentário em signup-checkout.js.
const LIMITE_RESUMO = 150;

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { codigo, name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary, assunto } = req.body || {};
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

  const { data: servico } = await admin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });
  if (servico.price_cents > credito.valor_cents) return res.status(400).json({ error: 'credito_insuficiente' });

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
        status: 'pending', onboarding_pendente: true
      });
      if (erroInsert) throw erroInsert;
    } else {
      // Cliente já existia. NUNCA sobrescreve contato já cadastrado a partir do
      // que foi digitado agora: um código de crédito não prova que quem está
      // resgatando é o dono do CPF — sobrescrever e-mail/telefone aqui seria um
      // jeito trivial de herdar o login automático de outra pessoa (mesmo risco
      // corrigido em signup-checkout.js/pagamento.js). Só completa o que ainda
      // estiver vazio.
      const baseUpdate = {};
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

    const { data: appt } = await admin.from('agendamentos').insert({
      cliente_ref: clientId, client_name: name, date: date || 'A definir', time: time || '',
      tax_type: servico.name, status: 'pending'
    }).select().single();

    const { data: cob, error: erroCob } = await admin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, valor_cents: servico.price_cents,
      status: 'paid', billing_type: 'CREDITO', paid_at: new Date().toISOString(),
      appt_date: date || null, appt_time: time || null, appointment_id: appt ? appt.id : null
    }).select().single();
    if (erroCob) throw erroCob;

    await admin.from('creditos').update({
      status: 'usado', usado_em: new Date().toISOString(), cliente_ref: clientId, cobranca_id: cob.id
    }).eq('id', credito.id);

    await admin.from('notificacoes').insert({
      text: `Crédito resgatado: ${name} agendou ${servico.name} com o código ${credito.codigo}.`,
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
