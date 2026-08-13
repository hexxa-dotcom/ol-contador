// POST /api/recorrencia { clientId, ativar, tipo, diaVenc, valor }
// Liga/desliga o acompanhamento mensal de um cliente recorrente (parcelamento,
// obrigação mensal etc.) e cria/cancela a assinatura de cobrança no Asaas.
// Não passa pelo modo demonstrativo — envolve chave secreta e dinheiro de
// verdade, então só roda com login real (igual ao /api/checkout).
const asaas = require('./_lib/asaas');
const { requireUser, adminClient } = require('./_lib/auth');
const { registrarEventoFunil } = require('./_lib/metricas');
const { registrarErro } = require('./_lib/monitoramento');

// Preços de autoatendimento (o cliente ativa sozinho, ex. botão "Radar Fiscal"
// na área dele) — vêm SEMPRE daqui, nunca do valor que o navegador mandar.
// Só a equipe (is_staff()) pode informar um valor livre no corpo da
// requisição, pro caso de acompanhamento sob medida (ex. Assessoria MEI).
const PRECOS_AUTOATENDIMENTO_CENTS = {
  'Radar Fiscal': 4990
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const { clientId, ativar, tipo, diaVenc, valor } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'invalid_params' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  // valida que o solicitante pode ver este cliente (RLS via auth.sb)
  const { data: cliente } = await auth.sb.from('clientes').select('*').eq('id', clientId).single();
  if (!cliente) return res.status(403).json({ error: 'forbidden' });

  try {
    if (ativar === false) {
      if (cliente.asaas_subscription_id && asaas.isConfigured()) {
        await asaas.cancelSubscription(cliente.asaas_subscription_id);
      }
      await admin.from('clientes').update({ recorrente: false, asaas_subscription_id: null }).eq('id', clientId);
      await admin.from('assinaturas_historico').insert({
        cliente_ref: clientId, asaas_subscription_id: cliente.asaas_subscription_id || null,
        tipo: cliente.recorrente_tipo || null, valor_cents: Math.round((cliente.honorarios || 0) * 100),
        dia_vencimento: cliente.recorrente_dia_venc || null, status: 'cancelada', created_by: auth.user.id
      });
      await registrarEventoFunil(admin, 'assinatura_cancelada', { clienteRef: clientId, origem: 'area_cliente' });
      return res.json({ recorrente: false });
    }

    if (cliente.recorrente && cliente.asaas_subscription_id) {
      return res.json({ recorrente: true, subscriptionId: cliente.asaas_subscription_id, alreadyActive: true });
    }

    if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
    const dia = Math.min(28, Math.max(1, parseInt(diaVenc, 10) || 10));

    // O valor só é livre pra equipe (acompanhamento sob medida). Pra qualquer
    // outro chamador — o próprio cliente ativando um produto de autoatendimento
    // como o Radar Fiscal — o preço vem do catálogo fixo acima, nunca do corpo
    // da requisição (senão dava pra ativar por R$0,01 só trocando o valor).
    const { data: souStaff } = await admin.from('staff').select('id').eq('id', auth.user.id).maybeSingle();
    let valorNum;
    if (souStaff) {
      valorNum = Number(valor) || (cliente.honorarios || 0);
    } else {
      const precoCatalogo = PRECOS_AUTOATENDIMENTO_CENTS[tipo];
      if (!precoCatalogo) return res.status(403).json({ error: 'tipo_nao_permitido_para_cliente' });
      valorNum = precoCatalogo / 100;
    }
    if (!valorNum) return res.status(400).json({ error: 'valor_invalido' });

    const customerId = await asaas.createCustomer({ name: cliente.name, cpfCnpj: cliente.cpf });
    const hoje = new Date();
    let proximo = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (proximo <= hoje) proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
    const nextDueDate = proximo.toISOString().slice(0, 10);

    const sub = await asaas.createSubscription({
      customerId, value: valorNum,
      description: `${tipo || 'Acompanhamento mensal'} — ${cliente.name}`,
      nextDueDate
    });

    await admin.from('clientes').update({
      recorrente: true, recorrente_tipo: tipo || null, recorrente_dia_venc: dia,
      asaas_subscription_id: sub.id, honorarios: valorNum
    }).eq('id', clientId);
    await admin.from('assinaturas_historico').insert({
      cliente_ref: clientId, asaas_subscription_id: sub.id, tipo: tipo || null,
      valor_cents: Math.round(valorNum * 100), dia_vencimento: dia, status: 'ativa', created_by: auth.user.id
    });
    await registrarEventoFunil(admin, 'assinatura_ativada', { clienteRef: clientId, origem: souStaff ? 'painel_contador' : 'area_cliente', metadata: { tipo, valorCents: Math.round(valorNum * 100) } });

    res.json({ recorrente: true, subscriptionId: sub.id, nextDueDate });
  } catch (e) {
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    console.error('recorrencia error:', e.message);
    await registrarErro(admin, { origem: 'recorrencia', codigo: e.code || 'recorrencia_error', mensagem: e.message,
      rota: '/api/recorrencia', severidade: 'critico', contexto: { ativar: ativar !== false, tipo } });
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
