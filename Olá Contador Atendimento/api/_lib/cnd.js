// Adaptador da API contratada de Certidão Negativa de Débitos. O endpoint do
// produto varia conforme o contrato; por isso a URL completa vem da Vercel e
// deve conter {documento}. Nenhuma rota é presumida ou simulada.
const URL_MODELO = process.env.SERPRO_CND_URL || '';
const TOKEN_URL = process.env.SERPRO_CND_TOKEN_URL || 'https://gateway.apiserpro.serpro.gov.br/token';
const KEY = process.env.SERPRO_CND_CONSUMER_KEY || '';
const SECRET = process.env.SERPRO_CND_CONSUMER_SECRET || '';
let tokenCache = '', expiraEm = 0;

function isConfigured() { return !!(URL_MODELO.includes('{documento}') && KEY && SECRET); }

async function obterToken() {
  if (tokenCache && Date.now() < expiraEm) return tokenCache;
  if (!isConfigured()) { const e = new Error('A API de CND ainda não está contratada/configurada.'); e.code = 'cnd_not_configured'; throw e; }
  const resposta = await fetch(TOKEN_URL, { method:'POST', headers:{
    Authorization:`Basic ${Buffer.from(`${KEY}:${SECRET}`).toString('base64')}`,
    'Content-Type':'application/x-www-form-urlencoded'
  }, body:'grant_type=client_credentials' });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !dados.access_token) { const e = new Error(`Falha ao autenticar na API de CND (${resposta.status}).`); e.code='cnd_auth_error'; throw e; }
  tokenCache = dados.access_token; expiraEm = Date.now() + Math.max(30, (Number(dados.expires_in) || 3600) - 60) * 1000;
  return tokenCache;
}

async function emitir(documento) {
  const url = URL_MODELO.replace('{documento}', encodeURIComponent(String(documento).replace(/\D/g,'')));
  const resposta = await fetch(url, { headers:{ Authorization:`Bearer ${await obterToken()}`, Accept:'application/pdf, application/json' } });
  if (!resposta.ok) { const e = new Error(`Emissão da CND falhou (${resposta.status}).`); e.code='cnd_error'; e.status=resposta.status; throw e; }
  const tipo = resposta.headers.get('content-type') || '';
  if (tipo.includes('application/pdf')) return { pdfBase64: Buffer.from(await resposta.arrayBuffer()).toString('base64') };
  const dados = await resposta.json().catch(() => ({}));
  return { pdfBase64: dados.pdfBase64 || dados.pdf || null, protocolo: dados.protocolo || null, situacao: dados.situacao || null };
}

module.exports = { isConfigured, emitir };
