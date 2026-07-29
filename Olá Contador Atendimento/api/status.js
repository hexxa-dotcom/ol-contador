// GET /api/status — polling público (sem login) da tela de checkout.
// Unifica endpoints que eram funções serverless separadas (signup-status,
// credito-status e nota-fiscal) porque o plano Hobby da Vercel tem teto de 12
// funções por deploy e cada arquivo em api/ conta uma. O parâmetro decide o
// que responder:
//   ?cobrancaId=123          -> status do pagamento Pix
//   ?codigo=OC-XXXXXXXX      -> validação de crédito de atendimento
//   ?acao=servicos-municipais -> serviços municipais cadastrados no Asaas
const asaas = require('./_lib/asaas');
const { adminClient, requireUser } = require('./_lib/auth');
const { confirmCobranca } = require('./_lib/pagamento');

async function statusCobranca(req, res, admin) {
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  const id = parseInt(req.query.cobrancaId, 10);
  if (!id) return res.status(400).json({ error: 'invalid_params' });
  const { data: cob } = await admin.from('cobrancas').select('*').eq('id', id).single();
  if (!cob) return res.status(404).json({ error: 'cobranca_not_found' });

  try {
    res.json(await confirmCobranca(admin, cob));
  } catch (e) {
    console.error('status (cobranca) error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
}

async function statusCredito(req, res, admin) {
  const codigo = String(req.query.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: 'invalid_params' });

  const { data: credito } = await admin.from('creditos').select('*').eq('codigo', codigo).maybeSingle();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(410).json({ error: 'credito_indisponivel', status: credito.status });
  res.json({ valido: true, valorCents: credito.valor_cents, valor: credito.valor_cents / 100 });
}

// Serviços municipais cadastrados na prefeitura da conta Asaas — usado só pra
// popular o seletor em Configurações → Integrações → Nota Fiscal, pra o
// contador escolher o municipalServiceId certo em vez de digitar um código
// arbitrário. Depende da conta já ter fiscalInfo configurado no Asaas — sem
// isso o Asaas devolve erro explicando o que falta configurar lá.
async function statusServicosMunicipais(req, res) {
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  try {
    const data = await asaas.getMunicipalServices();
    res.json(data.data || data);
  } catch (e) {
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
}

// POST /api/status?acao=marcar-lidas { clientId }
// A função RPC antiga dependia do contexto do Postgres e, na prática, só
// confirmava a leitura do cliente. Aqui validamos a sessão antes de usar o
// cliente administrativo: cliente só pode marcar mensagens do contador na
// própria conversa; equipe pode marcar as mensagens do cliente na conversa
// que abriu. Assim os dois sentidos gravam read_at de forma consistente.
async function marcarMensagensLidas(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const clientId = String((req.body || {}).clientId || '').trim();
  if (!clientId) return res.status(400).json({ error: 'invalid_params' });

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const [{ data: isStaff, error: staffError }, { data: myClientId, error: clientError }] = await Promise.all([
    auth.sb.rpc('is_staff'),
    auth.sb.rpc('my_client_id')
  ]);
  if (staffError || clientError) return res.status(403).json({ error: 'forbidden' });

  // Quem abre a conversa confirma a leitura das mensagens do outro lado.
  let sender;
  if (isStaff) {
    sender = 'client';
  } else {
    if (String(myClientId || '') !== clientId) return res.status(403).json({ error: 'forbidden' });
    sender = 'agent';
  }

  const { data, error } = await admin.from('mensagens')
    .update({ read_at: new Date().toISOString() })
    .eq('cliente_id', clientId)
    .eq('sender', sender)
    .is('read_at', null)
    .select('id');
  if (error) {
    console.error('marcar-lidas error:', error.message);
    return res.status(500).json({ error: 'read_receipt_failed' });
  }
  res.json({ marked: (data || []).length });
}

async function exigirEquipe(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return null;
  const { data: isStaff, error } = await auth.sb.rpc('is_staff');
  if (error || !isStaff) { res.status(403).json({ error: 'forbidden' }); return null; }
  const admin = adminClient();
  if (!admin) { res.status(503).json({ error: 'service_role_not_configured' }); return null; }
  return admin;
}

// Escritas do painel passam por aqui porque o RLS do navegador pode variar
// conforme a sessão. A rota continua exigindo um membro da equipe autenticado.
async function atualizarStatusAtendimento(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  const { clientId, status } = req.body || {};
  if (!clientId || !['pending', 'active', 'docs', 'ready', 'locked', 'done'].includes(status)) {
    return res.status(400).json({ error: 'invalid_params' });
  }
  const patch = { status };
  if (status === 'locked' || status === 'done') patch.ultimo_atendimento_finalizado_em = new Date().toISOString();
  const { data, error } = await admin.from('clientes').update(patch).eq('id', clientId)
    .select('id,status,ultimo_atendimento_finalizado_em').single();
  if (error) return res.status(500).json({ error: 'status_update_failed' });
  res.json({ id: data.id, status: data.status, ultimoFinalizadoEm: data.ultimo_atendimento_finalizado_em || null });
}

async function salvarConfiguracoesPainel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const admin = await exigirEquipe(req, res);
  if (!admin) return;
  const valores = (req.body || {}).config || {};
  const linhas = Object.keys(valores).map(chave => ({ chave, valor: valores[chave] }));
  if (!linhas.length) return res.json({ ok: true });
  const { error } = await admin.from('configuracoes').upsert(linhas, { onConflict: 'chave' });
  if (error) return res.status(500).json({ error: 'config_update_failed' });
  res.json({ ok: true, salvas: linhas.map(l => l.chave) });
}

module.exports = async (req, res) => {
  if (req.query.acao === 'marcar-lidas') return marcarMensagensLidas(req, res);
  if (req.query.acao === 'atualizar-status') return atualizarStatusAtendimento(req, res);
  if (req.query.acao === 'salvar-config') return salvarConfiguracoesPainel(req, res);
  if (req.query.acao === 'servicos-municipais') return statusServicosMunicipais(req, res);

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  if (req.query.cobrancaId) return statusCobranca(req, res, admin);
  if (req.query.codigo) return statusCredito(req, res, admin);
  res.status(400).json({ error: 'invalid_params' });
};
