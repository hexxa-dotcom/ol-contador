// Confirmação de cobrança Asaas (compartilhado por checkout/status e webhook).
// Usa o cliente admin (service_role) porque cria agendamento/notificação cross-cliente.
const asaas = require('./asaas');
const notify = require('./notify');

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Idempotente: se pago, cria o agendamento uma única vez.
async function confirmCobranca(admin, cob) {
  if (cob.status === 'paid' && cob.appointment_id) {
    return { status: 'paid', appointmentId: cob.appointment_id };
  }
  const payment = await asaas.getPayment(cob.asaas_payment_id);
  if (!asaas.PAID_STATUSES.includes(payment.status)) return { status: 'pending' };

  let appointmentId = cob.appointment_id;
  if (!appointmentId) {
    const { data: cliente } = await admin.from('clientes').select('*').eq('id', cob.cliente_ref).single();
    const { data: servico } = await admin.from('servicos').select('*').eq('id', cob.servico_id).single();
    const { data: appt } = await admin.from('agendamentos').insert({
      cliente_ref: cob.cliente_ref, client_name: cliente ? cliente.name : cob.cliente_ref,
      date: cob.appt_date || 'A definir', time: cob.appt_time || '',
      tax_type: servico ? servico.name : '', status: 'pending'
    }).select().single();
    appointmentId = appt ? appt.id : null;

    await admin.from('cobrancas').update({ status: 'paid', paid_at: new Date().toISOString(), appointment_id: appointmentId }).eq('id', cob.id);
    await admin.from('notificacoes').insert({
      text: `Pagamento confirmado: ${cliente ? cliente.name : cob.cliente_ref} agendou ${servico ? servico.name : ''}.`,
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

    if (notify.anyConfigured() && cliente) {
      const quando = [cob.appt_date, cob.appt_time].filter(Boolean).join(' às ');
      notify.notifyCliente(cliente, 'Pagamento confirmado — atendimento agendado',
        `Recebemos seu pagamento de <strong>${servico ? servico.name : 'atendimento'}</strong>. ` +
        `Seu horário${quando ? ' (' + quando + ')' : ''} está confirmado.`);
    }
  }
  return { status: 'paid', appointmentId };
}

module.exports = { confirmCobranca, nowTime };
