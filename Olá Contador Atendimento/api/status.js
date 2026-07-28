// GET /api/status — polling público (sem login) da tela de checkout.
// Unifica endpoints que eram funções serverless separadas (signup-status,
// credito-status e nota-fiscal) porque o plano Hobby da Vercel tem teto de 12
// funções por deploy e cada arquivo em api/ conta uma. O parâmetro decide o
// que responder:
//   ?cobrancaId=123          -> status do pagamento Pix
//   ?codigo=OC-XXXXXXXX      -> validação de crédito de atendimento
//   ?acao=servicos-municipais -> serviços municipais cadastrados no Asaas
const asaas = require('./_lib/asaas');
const { adminClient } = require('./_lib/auth');
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

module.exports = async (req, res) => {
  if (req.query.acao === 'servicos-municipais') return statusServicosMunicipais(req, res);

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  if (req.query.cobrancaId) return statusCobranca(req, res, admin);
  if (req.query.codigo) return statusCredito(req, res, admin);
  res.status(400).json({ error: 'invalid_params' });
};
