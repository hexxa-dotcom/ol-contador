// Camada de integração com o SERPRO (Integra Contador)
// Autenticação mTLS + OAuth2 e uma função por serviço do catálogo.
//
// MODELO DE COBRANÇA: o Integra Contador cobra POR REQUISIÇÃO. Por isso aqui
// não existe mais nenhuma função que "puxa tudo" de um CPF/CNPJ — cada chamada
// é um serviço específico (idSistema + idServico), disparada de propósito por
// quem sabe que aquilo custa. Também não existe mais fallback para dados
// simulados: se o Serpro não responder, isso VIRA ERRO. A versão anterior
// inventava a situação fiscal do contribuinte a partir do último dígito do
// CPF e mostrava como se fosse real — nenhum dado é melhor que dado falso
// quando o assunto é dívida tributária.
require('dotenv').config();
const https = require('https');

// O fetch nativo do Node (undici por baixo) NÃO aplica um https.Agent comum
// passado em `agent` — ele ignora o certificado do cliente (mTLS) e o Serpro
// responde "Não foi possível identificar um certificado digital válido.".
// https.request clássico funciona (é o que o curl faz por baixo).
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
// que certificados e-CNPJ mais antigos usam dentro do .pfx.
const SERPRO_CERT_PEM_BASE64 = process.env.SERPRO_CERT_PEM_BASE64 || '';
const SERPRO_KEY_PEM_BASE64 = process.env.SERPRO_KEY_PEM_BASE64 || '';
// Tokens temporários só são aceitos quando os DOIS valores são informados.
// A autenticação do Integra Contador devolve access_token e jwt_token
// diferentes; reutilizar um único token nos dois headers causa 401. Mantemos
// SERPRO_TEMP_TOKEN apenas como legado, sem deixá-lo substituir credenciais
// mTLS completas configuradas na produção.
const SERPRO_TEMP_ACCESS_TOKEN = process.env.SERPRO_TEMP_ACCESS_TOKEN || '';
const SERPRO_TEMP_JWT_TOKEN = process.env.SERPRO_TEMP_JWT_TOKEN || '';

// CNPJ da HEXX (contratante do Integra Contador) — obrigatório em toda
// requisição, mesmo consultando o CPF/CNPJ de um cliente (contribuinte).
const SERPRO_CNPJ_CONTRATANTE = (process.env.SERPRO_CNPJ_CONTRATANTE || '62414421000116').replace(/\D/g, '');

let cachedAccessToken = null;
let cachedJwtToken = null;
let tokenExpiration = 0;

function isSerproConfigured() {
  const temporariosCompletos = SERPRO_TEMP_ACCESS_TOKEN && SERPRO_TEMP_JWT_TOKEN;
  const mtlsCompleto = SERPRO_CONSUMER_KEY && SERPRO_CONSUMER_SECRET &&
    SERPRO_CERT_PEM_BASE64 && SERPRO_KEY_PEM_BASE64;
  return !!(temporariosCompletos || mtlsCompleto);
}

function getHttpsAgent() {
  if (!SERPRO_CERT_PEM_BASE64 || !SERPRO_KEY_PEM_BASE64) return null;
  return new https.Agent({
    cert: Buffer.from(SERPRO_CERT_PEM_BASE64, 'base64').toString('utf8'),
    key: Buffer.from(SERPRO_KEY_PEM_BASE64, 'base64').toString('utf8')
  });
}

async function getSerproTokens() {
  if (SERPRO_TEMP_ACCESS_TOKEN && SERPRO_TEMP_JWT_TOKEN) {
    return { accessToken: SERPRO_TEMP_ACCESS_TOKEN, jwtToken: SERPRO_TEMP_JWT_TOKEN };
  }
  if (Date.now() < tokenExpiration && cachedAccessToken) {
    return { accessToken: cachedAccessToken, jwtToken: cachedJwtToken };
  }

  const agent = getHttpsAgent();
  if (!agent) throw new Error('Certificado PEM ausente para mTLS.');

  const authHeader = Buffer.from(`${SERPRO_CONSUMER_KEY}:${SERPRO_CONSUMER_SECRET}`).toString('base64');

  // Endpoint certo é o de autenticação (não o /token genérico do gateway) —
  // só ele devolve o jwt_token junto com o access_token. Role-Type TERCEIROS
  // é exigido pra quem consulta CPF/CNPJ de terceiros (contador atendendo).
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
  cachedJwtToken = data.jwt_token;
  if (!cachedAccessToken || !cachedJwtToken) {
    throw new Error('Autenticação Serpro não devolveu access_token e jwt_token.');
  }
  const expiresIn = Number(data.expires_in) || 300;
  tokenExpiration = Date.now() + (Math.max(expiresIn - 60, 30) * 1000);

  return { accessToken: cachedAccessToken, jwtToken: cachedJwtToken };
}

// Diagnóstico gratuito: valida certificado e OAuth sem consumir nenhum
// serviço tributário pago. Não devolve nem registra os tokens.
async function testarAutenticacao() {
  const tokens = await getSerproTokens();
  return !!(tokens.accessToken && tokens.jwtToken);
}

// ---------------------------------------------------------------------------
// Chamada genérica ao Integra Contador.
// TODA requisição paga passa por aqui — é o ponto único onde dá pra contar
// e auditar consumo. `acao` é o verbo do catálogo: Consultar, Emitir,
// Declarar, Apoiar ou Monitorar.
// ---------------------------------------------------------------------------
async function chamarIntegraContador({ acao, idSistema, idServico, versaoSistema, dados, documento, tipoDocumento }) {
  if (!isSerproConfigured()) {
    const err = new Error('Integra Contador não configurado neste ambiente.');
    err.code = 'serpro_not_configured';
    throw err;
  }

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
    const err = new Error(`Integra Contador ${idSistema}/${idServico} falhou (${response.status}): ${msg}`);
    err.code = 'serpro_error';
    err.status = response.status;
    // A recusa por falta de procuração é o erro mais comum na prática e tem
    // tratamento próprio na interface: não é falha nossa, é uma etapa que o
    // contribuinte precisa cumprir no e-CAC.
    if (/procura[cç]/i.test(msg)) err.code = 'sem_procuracao';
    throw err;
  }
  return json;
}

// O campo `dados` volta como STRING JSON dentro do envelope — não como objeto.
function parseDados(resp) {
  if (!resp) return null;
  if (typeof resp.dados === 'string') {
    try { return JSON.parse(resp.dados); } catch { return resp.dados; }
  }
  return resp.dados || null;
}

function tipoDoDocumento(digitos) {
  return digitos.length > 11 ? 2 : 1; // 1 = CPF, 2 = CNPJ
}

// ===========================================================================
// CAIXA POSTAL
// ===========================================================================

// Indicador de novas mensagens — serviço do tipo "Monitorar", o mais barato
// do conjunto. É ele que a varredura semanal usa: só quando ele acusa
// novidade é que vale gastar uma requisição buscando a lista de verdade.
async function indicadorNovasMensagens(documento) {
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Monitorar', idSistema: 'CAIXAPOSTAL', idServico: 'INNOVAMSG63',
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp) || {};
  const flag = d.indicadorMensagensNovas ?? d.indicadorNovasMensagens ?? d.temMensagemNova;
  return {
    temNovas: flag === true || flag === 1 || flag === '1' || flag === 'S',
    bruto: d
  };
}

async function consultarCaixaPostal(documento) {
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Consultar', idSistema: 'CAIXAPOSTAL', idServico: 'MSGCONTRIBUINTE61',
    // indicadorPagina "1" = primeira página; statusLeitura "0" = todas.
    dados: JSON.stringify({ indicadorPagina: '1', statusLeitura: '0' }),
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp);
  const lista = Array.isArray(d) ? d : ((d && (d.listaMensagens || d.mensagens)) || []);
  return {
    naoLidas: lista.filter(m => !m.lida && !m.indicadorLeitura).length,
    mensagens: lista.slice(0, 20).map(m => ({
      isn: m.isn || m.isnMensagem || null,
      data: m.dataRecepcao || m.data || null,
      assunto: m.assunto || m.titulo || 'Mensagem da Receita Federal',
      lida: !!(m.lida || m.indicadorLeitura)
    }))
  };
}

async function detalharMensagem(documento, isn) {
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Consultar', idSistema: 'CAIXAPOSTAL', idServico: 'MSGDETALHAMENTO62',
    dados: JSON.stringify({ isn: String(isn) }),
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  return parseDados(resp);
}

// ===========================================================================
// SITFIS — Situação Fiscal
// Fluxo de DUAS etapas: pede um protocolo (Apoiar) e só depois emite o
// relatório (Emitir). O relatório volta em PDF base64 — não é um JSON com
// "está regular: sim/não". Guardamos o PDF e mostramos como documento; não
// tentamos interpretar o conteúdo, justamente pra não afirmar situação
// fiscal errada.
// ===========================================================================

// A versão 1.0 passou a ser recusada pelo serviço com
// EntradaIncorreta-Sitfis-EI03 ("Versão Descontinuada") em agosto/2026.
// A versão é explícita só no SITFIS para não alterar os demais sistemas do
// Integra Contador, que continuam com contratos de versão independentes.
const SITFIS_VERSAO = '2.0';

async function solicitarProtocoloSitfis(documento) {
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Apoiar', idSistema: 'SITFIS', idServico: 'SOLICITARPROTOCOLO91',
    versaoSistema: SITFIS_VERSAO,
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp) || {};
  return {
    protocolo: d.protocoloRelatorio || d.protocolo || null,
    // Quando o relatório ainda está sendo montado, a API devolve quanto tempo
    // esperar antes de tentar emitir.
    tempoEsperaMs: Number(d.tempoEspera || 0) || 0
  };
}

async function emitirRelatorioSitfis(documento, protocolo) {
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Emitir', idSistema: 'SITFIS', idServico: 'RELATORIOSITFIS92',
    versaoSistema: SITFIS_VERSAO,
    dados: JSON.stringify({ protocoloRelatorio: protocolo }),
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp) || {};
  return {
    pdfBase64: d.pdf || d.relatorioPdf || null,
    // Se ainda não ficou pronto, a API pede pra tentar de novo mais tarde.
    tempoEsperaMs: Number(d.tempoEspera || 0) || 0
  };
}

// ===========================================================================
// REGIME — descobrir se o CNPJ é MEI (define qual sistema de parcelamento usar)
// Uma requisição por cliente, guardada pra sempre. Sem isso teríamos que
// chamar PARCSN e PARCMEI toda vez, dobrando o custo de cada consulta.
// ===========================================================================

async function consultarSituacaoMei(documento) {
  const digitos = String(documento).replace(/\D/g, '');
  if (digitos.length <= 11) return { mei: false, motivo: 'cpf_nao_tem_mei' };

  try {
    const resp = await chamarIntegraContador({
      acao: 'Consultar', idSistema: 'CCMEI', idServico: 'CCMEISITCADASTRAL123',
      documento: digitos, tipoDocumento: 2
    });
    const d = parseDados(resp) || {};
    const situacao = String(d.situacaoCadastralCnpj || d.situacao || '').toUpperCase();
    return { mei: true, situacao, bruto: d };
  } catch (e) {
    // CNPJ que não é MEI simplesmente não é encontrado nesse cadastro — isso
    // é resposta válida, não falha.
    if (e.code === 'serpro_error') return { mei: false, motivo: 'nao_encontrado_no_ccmei' };
    throw e;
  }
}

// ===========================================================================
// PARCELAMENTOS
// Quatro sistemas distintos, escolhidos pelo regime do contribuinte:
//   MEI      → PARCMEI (convencional) e PARCMEI-ESP (especial)
//   Simples  → PARCSN  (ordinário)   e PARCSN-ESP  (especial)
// Os idServico mudam junto com o sistema, então ficam num mapa só.
// ===========================================================================

const PARCELAMENTO = {
  'PARCSN':      { pedidos: 'PEDIDOSPARC163', parcelas: 'PARCELASPARAGERAR162', gerarDas: 'GERARDAS161', detalhe: 'OBTERPARC164' },
  'PARCSN-ESP':  { pedidos: 'PEDIDOSPARC173', parcelas: 'PARCELASPARAGERAR172', gerarDas: 'GERARDAS171', detalhe: 'OBTERPARC174' },
  'PARCMEI':     { pedidos: 'PEDIDOSPARC203', parcelas: 'PARCELASPARAGERAR202', gerarDas: 'GERARDAS201', detalhe: 'OBTERPARC204' },
  'PARCMEI-ESP': { pedidos: 'PEDIDOSPARC213', parcelas: 'PARCELASPARAGERAR212', gerarDas: 'GERARDAS211', detalhe: 'OBTERPARC214' }
};

function sistemasParcelamentoPara(regime) {
  if (regime === 'mei') return ['PARCMEI', 'PARCMEI-ESP'];
  return ['PARCSN', 'PARCSN-ESP'];
}

async function consultarPedidosParcelamento(documento, sistema) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Consultar', idSistema: sistema, idServico: cfg.pedidos,
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp);
  const lista = Array.isArray(d) ? d : ((d && (d.parcelamentos || d.pedidos)) || []);
  return lista.map(p => ({
    numero: p.numero || p.numeroParcelamento || null,
    situacao: p.situacao || null,
    dataPedido: p.dataDoPedido || p.dataPedido || null,
    sistema
  }));
}

// "Constatar todas as guias que tem" — é este serviço: lista as parcelas
// disponíveis para impressão. Só depois de escolher uma é que se gasta a
// requisição de emissão do DAS.
async function consultarParcelasParaGerar(documento, sistema) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Consultar', idSistema: sistema, idServico: cfg.parcelas,
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp);
  const lista = Array.isArray(d) ? d : ((d && (d.listaParcelas || d.parcelas)) || []);
  return lista.map(p => ({
    parcela: p.parcela || p.parcelaParaEmitir || null,
    vencimento: p.dataVencimento || p.vencimento || null,
    valor: p.valor || null,
    sistema
  }));
}

async function emitirDasParcelamento(documento, sistema, parcela) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, '');
  const resp = await chamarIntegraContador({
    acao: 'Emitir', idSistema: sistema, idServico: cfg.gerarDas,
    dados: JSON.stringify({ parcelaParaEmitir: String(parcela) }),
    documento: digitos, tipoDocumento: tipoDoDocumento(digitos)
  });
  const d = parseDados(resp) || {};
  return { pdfBase64: d.docArrecadacaoPdfB64 || d.pdf || null, bruto: d };
}

module.exports = {
  isSerproConfigured,
  testarAutenticacao,
  chamarIntegraContador,
  // Caixa Postal
  indicadorNovasMensagens,
  consultarCaixaPostal,
  detalharMensagem,
  // SITFIS
  solicitarProtocoloSitfis,
  emitirRelatorioSitfis,
  // Regime / parcelamento
  consultarSituacaoMei,
  sistemasParcelamentoPara,
  consultarPedidosParcelamento,
  consultarParcelasParaGerar,
  emitirDasParcelamento
};
