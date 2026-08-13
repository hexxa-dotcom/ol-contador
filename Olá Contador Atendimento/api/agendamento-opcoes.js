// GET /api/agendamento-opcoes — dados públicos da tela de agendamento (sem login).
// Existe porque o RLS bloqueia leitura anônima de `servicos`/`agendamentos` e a
// página de agendamento é pública. Devolve num request só tudo que a tela precisa:
// catálogo, horários do dia e quais já estão ocupados.
//
// Antes desta rota o preço ficava fixo no HTML (podia divergir do que era
// cobrado de fato) e os horários ocupados vinham do localStorage — que é sempre
// vazio para quem chega de fora, então dois clientes conseguiam marcar o mesmo
// horário.
const { adminClient } = require('./_lib/auth');

const HORARIOS_PADRAO = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:30'];

// `itens` (o que cada plano abarca) chegou depois. Enquanto a migração não roda,
// pedir a coluna derruba a consulta inteira e a tela fica sem nada — então cai
// para a consulta antiga em vez de quebrar. Some quando a coluna existir.
async function buscarServicos(admin) {
  const buscar = colunas => admin.from('servicos').select(colunas)
    .eq('active', true).eq('recurrence', 'avulso').order('price_cents');
  const comItens = await buscar('id,name,description,price_cents,price_agendado_cents,itens');
  if (!comItens.error || !/itens|price_agendado_cents/.test(comItens.error.message || '')) return comItens;
  return buscar('id,name,description,price_cents');
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const hoje = new Date().toISOString().slice(0, 10);

  const [servicosRes, configRes, apptRes, assuntosRes, diasBloqueadosRes] = await Promise.all([
    // Só avulso: a assessoria MEI é mensal e passa pelo fluxo de recorrência,
    // não por este Pix único. `itens` é a lista de serviços que aquele plano
    // abarca — é ela que monta o "O que está acontecendo?", e por isso cada
    // plano mostra opções diferentes (PF nunca vê pendência de MEI).
    buscarServicos(admin),
    admin.from('configuracoes').select('valor').eq('chave', 'agenda_disponibilidade').maybeSingle(),
    // Só o pagamento confirmado vira linha em `agendamentos`, então é ela que
    // bloqueia horário — cobrança pendente continua liberando o slot.
    admin.from('agendamentos').select('date,time').neq('status', 'done').gte('date', hoje),
    // Lista genérica — usada quando o plano ainda não tem `itens` cadastrados
    // (antes da migração rodar, ou enquanto o contador não configurou aquele
    // plano específico). Sem ela a seção ficaria em branco.
    admin.from('configuracoes').select('valor').eq('chave', 'triagem_assuntos').maybeSingle(),
    // Feriados/folgas marcados pelo contador — a tela pública pula esses dias
    // em vez de sempre oferecer os próximos 5 dias úteis fixos.
    admin.from('configuracoes').select('valor').eq('chave', 'agenda_dias_bloqueados').maybeSingle()
  ]);

  if (servicosRes.error) {
    console.error('agendamento-opcoes erro:', servicosRes.error.message);
    return res.status(502).json({ error: 'db_error' });
  }

  const cfg = configRes.data && configRes.data.valor;
  const horarios = Array.isArray(cfg) && cfg.length ? cfg : HORARIOS_PADRAO;

  const ocupados = {};
  (apptRes.data || []).forEach(a => {
    if (!a.date || !a.time) return;
    (ocupados[a.date] = ocupados[a.date] || []).push(a.time);
  });

  const assuntosCfg = assuntosRes.data && assuntosRes.data.valor;
  const assuntosPadrao = (Array.isArray(assuntosCfg) ? assuntosCfg : [])
    .map(a => ({ id: a.id, titulo: a.titulo, resumo: a.resumo || '' }));

  const servicos = (servicosRes.data || []).map(s => ({
    ...s, itens: Array.isArray(s.itens) && s.itens.length ? s.itens : assuntosPadrao
  }));

  const diasBloqueadosCfg = diasBloqueadosRes.data && diasBloqueadosRes.data.valor;
  const diasBloqueados = Array.isArray(diasBloqueadosCfg) ? diasBloqueadosCfg : [];

  res.setHeader('Cache-Control', 'no-store');
  res.json({ servicos, horarios, ocupados, diasBloqueados });
};
