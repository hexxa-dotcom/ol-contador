// POST /api/recorrencia { clientId, ativar, tipo, diaVenc, valor }
// Liga/desliga o acompanhamento mensal de um cliente recorrente (parcelamento,
// obrigação mensal etc.) e cria/cancela a assinatura de cobrança no Asaas.
// Não passa pelo modo demonstrativo — envolve chave secreta e dinheiro de
// verdade, então só roda com login real (igual ao /api/checkout).
const asaas = require('./_lib/asaas');
const { requireUser, adminClient } = require('./_lib/auth');

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
        await asaas.cancelSubscription(cliente.asaas_subscription_id).catch(() => {});
      }
      await admin.from('clientes').update({ recorrente: false, asaas_subscription_id: null }).eq('id', clientId);
      return res.json({ recorrente: false });
    }

    if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
    const dia = Math.min(28, Math.max(1, parseInt(diaVenc, 10) || 10));
    const valorNum = Number(valor) || (cliente.honorarios || 0);
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

    res.json({ recorrente: true, subscriptionId: sub.id, nextDueDate });
  } catch (e) {
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    console.error('recorrencia error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
};
