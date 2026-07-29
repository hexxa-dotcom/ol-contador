// Camada de integração com o SERPRO (Integra Contador)
// Implementa autenticação mTLS e OAuth2 com fallback para Mock
require('dotenv').config();
const https = require('https');
// Usa fetch nativo do Node (18+) — axios nunca foi instalado (não está no
// package.json) e o require dele aqui derrubava o módulo inteiro com
// MODULE_NOT_FOUND assim que qualquer coisa importasse este arquivo.

// O fetch nativo do Node (undici por baixo) NÃO aplica um https.Agent comum
// passado em `agent` — ele ignora o certificado do cliente (mTLS) e o Serpro
// responde "Não foi possível identificar um certificado digital válido.".
// https.request clássico funciona (é o que o curl faz por baixo), então as
// chamadas mTLS usam esse helper em vez de fetch.
function httpsRequestMtls(url, { method = 'POST', headers = {}, body, agent } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method, headers, agent
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const SERPRO_CONSUMER_KEY = process.env.SERPRO_CONSUMER_KEY || '';
const SERPRO_CONSUMER_SECRET = process.env.SERPRO_CONSUMER_SECRET || '';
// Certificado e chave em PEM puro (já descriptografados), não o .pfx original.
// O Node 24 usa OpenSSL 3, que não lê mais a criptografia legada (3DES/RC2)
// que certificados e-CNPJ mais antigos usam dentro do .pfx — só ferramentas
// com o "provider legado" ativado (ex. o curl do macOS) conseguem abrir esse
// formato. A saída é extrair certificado+chave em PEM uma única vez (fora do
// Node, com o openssl do sistema, que ainda lê o formato antigo) e usar isso
// direto — TLS com cert/key em PEM não depende da criptografia do PKCS12.
const SERPRO_CERT_PEM_BASE64 = process.env.SERPRO_CERT_PEM_BASE64 || '';
const SERPRO_KEY_PEM_BASE64 = process.env.SERPRO_KEY_PEM_BASE64 || '';
const SERPRO_TEMP_TOKEN = process.env.SERPRO_TEMP_TOKEN || ''; // Token temporário colado na Vercel

// CNPJ da HEXX (contratante do Integra Contador) — obrigatório em toda
// requisição, mesmo consultando o CPF/CNPJ de um cliente (contribuinte).
const SERPRO_CNPJ_CONTRATANTE = (process.env.SERPRO_CNPJ_CONTRATANTE || '62414421000116').replace(/\D/g, '');

let cachedAccessToken = null;
let cachedJwtToken = null;
let tokenExpiration = 0;

function isSerproConfigured() {
  return !!(SERPRO_TEMP_TOKEN || (SERPRO_CONSUMER_KEY && SERPRO_CERT_PEM_BASE64 && SERPRO_KEY_PEM_BASE64));
}

// Gera dados fictícios mas consistentes para a UI (Modo Fallback/Simulação)
function getMockRadarData(documento) {
  const cleanDoc = documento.replace(/\D/g, '');
  const lastDigit = parseInt(cleanDoc.slice(-1) || '0', 10);
  const isAlert = lastDigit % 3 === 0;
  
  return {
    documento,
    status: isAlert ? 'alert' : 'ok',
    simulacao: true,
    dataAtualizacao: new Date().toISOString(),
    cnd: {
      status: isAlert ? 'positiva_com_efeito_negativa' : 'negativa',
      dataEmissao: new Date().toISOString(),
      mensagem: isAlert ? 'Existem débitos com exigibilidade suspensa (parcelamento).' : 'Não existem pendências ativas nos sistemas da RFB/PGFN.'
    },
    caixaPostal: {
      naoLidas: lastDigit % 2 === 0 ? 0 : 2,
      mensagens: lastDigit % 2 === 0 ? [] : [
        { data: new Date().toISOString(), assunto: 'Aviso de Malha Fiscal da RFB' },
        { data: new Date().toISOString(), assunto: 'Notificação de Cobrança - Simples Nacional' }
      ]
    },
    parcelamentos: lastDigit % 4 === 0 ? [
      { id: '44598123', tipo: 'Simples Nacional / RFB', situacao: 'Ativo', proximaGuia: '2026-08-20', valor: '350.50' }
    ] : []
  };
}

// Cria o HttpsAgent com o certificado mTLS para requisições Serpro
function getHttpsAgent() {
  if (!SERPRO_CERT_PEM_BASE64 || !SERPRO_KEY_PEM_BASE64) return null;
  return new https.Agent({
    cert: Buffer.from(SERPRO_CERT_PEM_BASE64, 'base64').toString('utf8'),
    key: Buffer.from(SERPRO_KEY_PEM_BASE64, 'base64').toString('utf8'),
    rejectUnauthorized: false // Em alguns ambientes o Serpro exige chain, false facilita no início
  });
}

// Obtém o token (OAuth2) via mTLS
async function getSerproTokens() {
  if (SERPRO_TEMP_TOKEN) {
    return { accessToken: SERPRO_TEMP_TOKEN, jwtToken: SERPRO_TEMP_TOKEN };
  }

  if (Date.now() < tokenExpiration && cachedAccessToken) {
    return { accessToken: cachedAccessToken, jwtToken: cachedJwtToken };
  }

  const agent = getHttpsAgent();
  if (!agent) throw new Error("Certificado PFX Base64 ausente para mTLS.");

  const authHeader = Buffer.from(`${SERPRO_CONSUMER_KEY}:${SERPRO_CONSUMER_SECRET}`).toString('base64');

  // Endpoint certo é o de autenticação (não o /token genérico do gateway) —
  // só ele devolve o jwt_token junto com o access_token. O header
  // Role-Type é exigido pra quem consulta CPF/CNPJ de terceiros (contador
  // atendendo cliente), que é exatamente o nosso caso.
  const response = await httpsRequestMtls('https://autenticacao.sapi.serpro.gov.br/authenticate', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Role-Type': 'TERCEIROS',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength('grant_type=client_credentials')
    },
    body: 'grant_type=client_credentials',
    agent
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token Serpro: ${response.status} ${response.text}`);
  }

  const data = JSON.parse(response.text);
  cachedAccessToken = data.access_token;
  cachedJwtToken = data.jwt_token || data.access_token;
  tokenExpiration = Date.now() + ((data.expires_in - 60) * 1000); // margem de 60s

  return { accessToken: cachedAccessToken, jwtToken: cachedJwtToken };
}

// Faz uma chamada ao Integra Contador (POST /Consultar, /Declarar ou /Emitir
// conforme o serviço). Formato do corpo é o padrão documentado em
// https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/
async function chamarIntegraContador({ acao, idSistema, idServico, versaoSistema, dados, documento, tipoDocumento }) {
  const { accessToken, jwtToken } = await getSerproTokens();
  const agent = getHttpsAgent();

  const body = {
    contratante: { numero: SERPRO_CNPJ_CONTRATANTE, tipo: 2 },
    autorPedidoDados: { numero: SERPRO_CNPJ_CONTRATANTE, tipo: 2 },
    contribuinte: { numero: documento, tipo: tipoDocumento },
    pedidoDados: { idSistema, idServico, versaoSistema: versaoSistema || '1.0', dados: dados || '{}' }
  };

  const bodyStr = JSON.stringify(body);
  const response = await httpsRequestMtls(`https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/${acao}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'jwt_token': jwtToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    },
    body: bodyStr,
    agent
  });

  const text = response.text;
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) {
    const msg = (json && (json.mensagens || json.message)) ? JSON.stringify(json.mensagens || json.message) : text;
    throw new Error(`Integra Contador ${idSistema}/${idServico} falhou (${response.status}): ${msg}`);
  }
  return json;
}

// Caixa Postal (DTE) — mensagens do contribuinte. idServico documentado:
// MSGCONTRIBUINTE61 (lista de mensagens do domicílio tributário eletrônico).
async function consultarCaixaPostal(documento, tipoDocumento) {
  const resp = await chamarIntegraContador({
    acao: 'Consultar', idSistema: 'CAIXAPOSTAL', idServico: 'MSGCONTRIBUINTE61',
    // indicadorPagina: "1" = primeira página. statusLeitura: "0" = todas
    // (lidas e não lidas) — únicos dois campos que a API exige aqui.
    dados: JSON.stringify({ indicadorPagina: '1', statusLeitura: '0' }),
    documento, tipoDocumento
  });
  const mensagens = (resp && resp.dados && JSON.parse(resp.dados)) || resp.mensagens || [];
  const lista = Array.isArray(mensagens) ? mensagens : (mensagens.mensagens || []);
  return {
    naoLidas: lista.filter(m => !m.lida && !m.indicadorLeitura).length,
    mensagens: lista.slice(0, 10).map(m => ({
      data: m.dataRecepcao || m.data || null,
      assunto: m.assunto || m.titulo || 'Mensagem da Receita Federal'
    }))
  };
}

// Função principal exposta
async function consultarRadarFiscal(documento) {
  if (!documento) throw new Error("Documento (CPF/CNPJ) obrigatório para o Radar Fiscal.");
  const digitos = documento.replace(/\D/g, '');
  const tipoDocumento = digitos.length > 11 ? 2 : 1; // 1 = CPF, 2 = CNPJ

  if (!isSerproConfigured()) {
    console.log(`[Serpro MOCK] Consultando Radar Fiscal para ${documento}...`);
    return getMockRadarData(documento);
  }

  // Base de partida real (mantém a mesma estrutura da UI); cada bloco abaixo
  // tenta a consulta de verdade e cai pro mock SÓ NAQUELE bloco em caso de
  // erro — assim um serviço específico falhando (ex. sem procuração pra
  // Caixa Postal) não derruba os outros.
  const dados = getMockRadarData(documento);
  dados.simulacao = false;

  try {
    console.log(`[Serpro REAL] Consultando Caixa Postal para ${documento}`);
    dados.caixaPostal = await consultarCaixaPostal(digitos, tipoDocumento);
  } catch (error) {
    console.error('[Serpro Erro — Caixa Postal]', error.message);
    dados.caixaPostal.erro = 'Não foi possível consultar a Caixa Postal agora.';
  }

  // Situação Fiscal (SITFIS) é assíncrona no Integra Contador (pede um
  // protocolo, depois consulta o relatório em PDF) e a leitura do PDF exige
  // um parser que ainda não foi validado contra uma consulta real — por
  // isso, por enquanto, esse bloco específico continua no simulado, para não
  // arriscar mostrar uma situação fiscal errada pro cliente.
  dados.cnd.mensagem = '[Serpro real conectado] Situação fiscal (SITFIS) ainda em modo simulado — falta implementar a leitura do relatório em PDF. Caixa Postal já é consulta real.';

  return dados;
}

module.exports = {
  isSerproConfigured,
  consultarRadarFiscal
};
