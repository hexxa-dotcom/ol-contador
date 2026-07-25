// /api/agenda-fiscal/run-reminders — motor de lembretes fiscais (idempotente).
// Chamado pelo Vercel Cron (agendado em vercel.json) e pelo botão do contador.
// (Dormant até configurar SUPABASE_SERVICE_ROLE_KEY; avisos externos dependem de Resend/Twilio.)
const agenda = require('../_lib/agenda');
const notify = require('../_lib/notify');
const { adminClient, requireUser } = require('../_lib/auth');
const { nowTime } = require('../_lib/pagamento');

async function rodarLembretes(admin) {
  const { data: obrigacoes } = await admin.from('obrigacoes').select('*').eq('active', true);
  const { data: clientes } = await admin.from('clientes').select('*');
  if (!obrigacoes || !clientes) return { enviados: 0 };

  let enviados = 0;
  for (const cli of clientes) {
    const venc = agenda.proximosVencimentos(obrigacoes, cli.tax_type);
    for (const v of venc) {
      const ob = obrigacoes.find(o => o.id === v.id);
      if (v.daysUntil > (ob.reminder_days || 3)) continue;

      const { data: existe } = await admin.from('lembretes_enviados')
        .select('id').eq('obrigacao_id', v.id).eq('cliente_ref', cli.id).eq('due_date', v.dueDate).maybeSingle();
      if (existe) continue;

      const ins = await admin.from('lembretes_enviados').insert({ obrigacao_id: v.id, cliente_ref: cli.id, due_date: v.dueDate });
      if (ins.error) continue;

      await admin.from('notificacoes').insert({
        text: `Lembrete: ${v.title} vence em ${v.dueDate} (${cli.name}).`,
        time: nowTime(), unread: true, cliente_ref: cli.id
      });
      await notify.notifyCliente(cli, `Lembrete: ${v.title}`,
        `Sua obrigação <strong>${v.title}</strong> vence em <strong>${v.dueDate}</strong>. ${v.description || ''}`);
      enviados++;
    }
  }
  return { enviados };
}

module.exports = async (req, res) => {
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  // Autoriza: cron da Vercel (header) OU contador logado.
  const isCron = !!req.headers['x-vercel-cron'] ||
    (process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`);
  if (!isCron) {
    const auth = await requireUser(req, res);
    if (!auth) return;
  }

  try {
    const r = await rodarLembretes(admin);
    res.json(r);
  } catch (e) {
    console.error('lembretes error:', e.message);
    res.status(500).json({ error: 'reminders_failed', detail: e.message });
  }
};
