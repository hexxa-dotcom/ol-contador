// Integração com o SERPRO (Integra Contador) — porte 1:1 de api/_lib/serpro.js.
// Autenticação mTLS + OAuth2. Uma requisição por serviço do catálogo; sem
// fallback simulado — se o SERPRO não responder, vira erro.
import https from "node:https";

// O fetch nativo do Node (undici por baixo) NÃO aplica um https.Agent comum
// passado em `agent` — ignora o certificado do cliente (mTLS). https.request
// clássico funciona (é o que o curl faz por baixo). Por isso as rotas que
// usam este módulo precisam de `export const runtime = "nodejs"`.
function httpsRequestMtls(
  url: string,
  { method = "POST", headers = {}, body, agent }: { method?: string; headers?: Record<string, string | number>; body?: string; agent?: https.Agent | null } = {}
): Promise<{ status: number; ok: boolean; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers, agent: agent || undefined },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode || 0, ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, text: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const SERPRO_CONSUMER_KEY = process.env.SERPRO_CONSUMER_KEY || "";
const SERPRO_CONSUMER_SECRET = process.env.SERPRO_CONSUMER_SECRET || "";
const SERPRO_CERT_PEM_BASE64 = process.env.SERPRO_CERT_PEM_BASE64 || "";
const SERPRO_KEY_PEM_BASE64 = process.env.SERPRO_KEY_PEM_BASE64 || "";
const SERPRO_TEMP_ACCESS_TOKEN = process.env.SERPRO_TEMP_ACCESS_TOKEN || "";
const SERPRO_TEMP_JWT_TOKEN = process.env.SERPRO_TEMP_JWT_TOKEN || "";
const SERPRO_CNPJ_CONTRATANTE = (process.env.SERPRO_CNPJ_CONTRATANTE || "62414421000116").replace(/\D/g, "");

let cachedAccessToken: string | null = null;
let cachedJwtToken: string | null = null;
let tokenExpiration = 0;

export function isSerproConfigured(): boolean {
  const temporariosCompletos = !!(SERPRO_TEMP_ACCESS_TOKEN && SERPRO_TEMP_JWT_TOKEN);
  const mtlsCompleto = !!(SERPRO_CONSUMER_KEY && SERPRO_CONSUMER_SECRET && SERPRO_CERT_PEM_BASE64 && SERPRO_KEY_PEM_BASE64);
  return temporariosCompletos || mtlsCompleto;
}

function getHttpsAgent(): https.Agent | null {
  if (!SERPRO_CERT_PEM_BASE64 || !SERPRO_KEY_PEM_BASE64) return null;
  return new https.Agent({
    cert: Buffer.from(SERPRO_CERT_PEM_BASE64, "base64").toString("utf8"),
    key: Buffer.from(SERPRO_KEY_PEM_BASE64, "base64").toString("utf8"),
  });
}

async function getSerproTokens(): Promise<{ accessToken: string; jwtToken: string }> {
  if (SERPRO_TEMP_ACCESS_TOKEN && SERPRO_TEMP_JWT_TOKEN) {
    return { accessToken: SERPRO_TEMP_ACCESS_TOKEN, jwtToken: SERPRO_TEMP_JWT_TOKEN };
  }
  if (Date.now() < tokenExpiration && cachedAccessToken && cachedJwtToken) {
    return { accessToken: cachedAccessToken, jwtToken: cachedJwtToken };
  }

  const agent = getHttpsAgent();
  if (!agent) throw new Error("Certificado PEM ausente para mTLS.");

  const authHeader = Buffer.from(`${SERPRO_CONSUMER_KEY}:${SERPRO_CONSUMER_SECRET}`).toString("base64");
  const response = await httpsRequestMtls("https://autenticacao.sapi.serpro.gov.br/authenticate", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Role-Type": "TERCEIROS",
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength("grant_type=client_credentials"),
    },
    body: "grant_type=client_credentials",
    agent,
  });

  if (!response.ok) throw new Error(`Falha ao obter token Serpro: ${response.status} ${response.text}`);

  const data = JSON.parse(response.text);
  cachedAccessToken = data.access_token;
  cachedJwtToken = data.jwt_token;
  if (!cachedAccessToken || !cachedJwtToken) throw new Error("Autenticação Serpro não devolveu access_token e jwt_token.");
  const expiresIn = Number(data.expires_in) || 300;
  tokenExpiration = Date.now() + Math.max(expiresIn - 60, 30) * 1000;

  return { accessToken: cachedAccessToken, jwtToken: cachedJwtToken };
}

export async function testarAutenticacao(): Promise<boolean> {
  const tokens = await getSerproTokens();
  return !!(tokens.accessToken && tokens.jwtToken);
}

class SerproError extends Error {
  code?: string;
  status?: number;
}

export async function chamarIntegraContador({
  acao,
  idSistema,
  idServico,
  versaoSistema,
  dados,
  documento,
  tipoDocumento,
}: {
  acao: string;
  idSistema: string;
  idServico: string;
  versaoSistema?: string;
  dados?: string;
  documento: string;
  tipoDocumento: number;
}): Promise<Record<string, unknown>> {
  if (!isSerproConfigured()) {
    const err = new SerproError("Integra Contador não configurado neste ambiente.");
    err.code = "serpro_not_configured";
    throw err;
  }

  const { accessToken, jwtToken } = await getSerproTokens();
  const agent = getHttpsAgent();

  const body = {
    contratante: { numero: SERPRO_CNPJ_CONTRATANTE, tipo: 2 },
    autorPedidoDados: { numero: SERPRO_CNPJ_CONTRATANTE, tipo: 2 },
    contribuinte: { numero: documento, tipo: tipoDocumento },
    pedidoDados: { idSistema, idServico, versaoSistema: versaoSistema || "1.0", dados: dados || "{}" },
  };
  const bodyStr = JSON.stringify(body);

  const response = await httpsRequestMtls(`https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/${acao}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      jwt_token: jwtToken,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyStr),
    },
    body: bodyStr,
    agent,
  });

  const text = response.text;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const msg = json && (json.mensagens || json.message) ? JSON.stringify(json.mensagens || json.message) : text;
    const err = new SerproError(`Integra Contador ${idSistema}/${idServico} falhou (${response.status}): ${msg}`);
    err.code = "serpro_error";
    err.status = response.status;
    if (/procura[cç]/i.test(String(msg))) err.code = "sem_procuracao";
    throw err;
  }
  return json;
}

function parseDados(resp: Record<string, unknown> | null): unknown {
  if (!resp) return null;
  if (typeof resp.dados === "string") {
    try {
      return JSON.parse(resp.dados);
    } catch {
      return resp.dados;
    }
  }
  return resp.dados || null;
}

function encontrarLista(valor: unknown, chaves: string[], profundidade = 0): Record<string, unknown>[] {
  if (Array.isArray(valor)) return valor;
  if (!valor || typeof valor !== "object" || profundidade > 5) return [];
  const obj = valor as Record<string, unknown>;
  for (const chave of chaves) {
    if (Array.isArray(obj[chave])) return obj[chave] as Record<string, unknown>[];
  }
  for (const filho of Object.values(obj)) {
    const achada = encontrarLista(filho, chaves, profundidade + 1);
    if (achada.length) return achada;
  }
  return [];
}

function flagVerdadeira(valor: unknown): boolean {
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor === 1;
  return ["1", "S", "SIM", "TRUE", "LIDA"].includes(String(valor || "").trim().toUpperCase());
}

function tipoDoDocumento(digitos: string): number {
  return digitos.length > 11 ? 2 : 1;
}

// =========================================================================
// Caixa Postal
// =========================================================================
export async function indicadorNovasMensagens(documento: string) {
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Monitorar", idSistema: "CAIXAPOSTAL", idServico: "INNOVAMSG63", documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = (parseDados(resp) as Record<string, unknown>) || {};
  const flag = d.indicadorMensagensNovas ?? d.indicadorNovasMensagens ?? d.temMensagemNova;
  return { temNovas: flag === true || flag === 1 || flag === "1" || flag === "S", bruto: d };
}

// Formata "20250408" + "092949" (formato do SERPRO) em ISO 8601.
function dataHoraSerpro(data: unknown, hora: unknown): string | null {
  const d = String(data || "");
  if (d.length !== 8) return null;
  const h = String(hora || "");
  const hh = h.length === 6 ? `${h.slice(0, 2)}:${h.slice(2, 4)}:${h.slice(4, 6)}` : "00:00:00";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${hh}`;
}

// Documentação oficial (obter_lista_de_mensagens_por_contribuintes): "dados"
// vem como { codigo, conteudo: [{ listaMensagens: [...], ponteiroProximaPagina,
// indicadorUltimaPagina, ... }] } — um array de UM bloco que contém a lista
// de verdade dentro, não a lista direto. Paginação é por ponteiro, não por
// número de página: indicadorPagina "0" pede a primeira página; "1" +
// ponteiroPagina (devolvido como ponteiroProximaPagina na chamada anterior)
// pedem as seguintes.
export async function consultarCaixaPostal(documento: string, ponteiroPagina?: string | null) {
  const digitos = String(documento).replace(/\D/g, "");
  const primeira = !ponteiroPagina;
  const resp = await chamarIntegraContador({
    acao: "Consultar",
    idSistema: "CAIXAPOSTAL",
    idServico: "MSGCONTRIBUINTE61",
    dados: JSON.stringify({
      statusLeitura: "0",
      indicadorPagina: primeira ? "0" : "1",
      ponteiroPagina: primeira ? "00000000000000" : String(ponteiroPagina),
    }),
    documento: digitos,
    tipoDocumento: tipoDoDocumento(digitos),
  });
  const d = parseDados(resp) as Record<string, unknown>;
  const conteudo = Array.isArray(d?.conteudo) ? (d.conteudo as Record<string, unknown>[]) : [];
  const bloco = conteudo[0] || {};
  const lista = Array.isArray(bloco.listaMensagens) ? (bloco.listaMensagens as Record<string, unknown>[]) : [];
  const ultimaPagina = String(bloco.indicadorUltimaPagina || "").toUpperCase() === "S";
  const proximoPonteiro = bloco.ponteiroProximaPagina ? String(bloco.ponteiroProximaPagina) : null;
  return {
    ponteiroProximaPagina: !ultimaPagina ? proximoPonteiro : null,
    temProxima: !ultimaPagina && !!proximoPonteiro,
    naoLidas: lista.filter((m) => !flagVerdadeira(m.indicadorLeitura)).length,
    mensagens: lista.map((m) => ({
      isn: m.isn || null,
      data: dataHoraSerpro(m.dataEnvio, m.horaEnvio),
      assunto: m.assuntoModelo || "Mensagem da Receita Federal",
      remetente: m.descricaoOrigem || null,
      lida: flagVerdadeira(m.indicadorLeitura),
    })),
  };
}

// Remove tags/atributos perigosos do HTML que a Receita manda no corpo da
// mensagem — o conteúdo vem de fonte confiável (SERPRO autenticado), mas
// não custa não confiar cegamente num HTML que vai direto pra tela.
function sanitizarHtmlMensagem(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

// Substitui ++VARIAVEL++ (assunto, valor único) e ++1++, ++2++... (corpo,
// na ordem de "variaveis") pelos valores reais — formato documentado em
// obter_detalhes_de_uma_mensagem_especifica.
function substituirVariaveis(texto: string, valorUnico: string | null, lista: string[]): string {
  let saida = texto.replace(/\+\+VARIAVEL\+\+/g, valorUnico || "");
  lista.forEach((valor, index) => {
    saida = saida.replaceAll(`++${index + 1}++`, valor);
  });
  return saida;
}

export type DetalheMensagem = {
  isn: string;
  assunto: string;
  remetente: string | null;
  dataEnvio: string | null;
  dataLeitura: string | null;
  corpoHtml: string;
};

export async function detalharMensagem(documento: string, isn: string): Promise<DetalheMensagem> {
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Consultar", idSistema: "CAIXAPOSTAL", idServico: "MSGDETALHAMENTO62", dados: JSON.stringify({ isn: String(isn) }), documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = parseDados(resp) as Record<string, unknown>;
  const conteudo = Array.isArray(d?.conteudo) ? (d.conteudo as Record<string, unknown>[]) : [];
  const m = conteudo[0] || {};
  const variaveis = Array.isArray(m.variaveis) ? (m.variaveis as unknown[]).map((v) => String(v ?? "")) : [];
  const valorParametroAssunto = m.valorParametroAssunto != null ? String(m.valorParametroAssunto) : null;
  const assunto = substituirVariaveis(String(m.assuntoModelo || "Mensagem da Receita Federal"), valorParametroAssunto, variaveis);
  const corpo = substituirVariaveis(String(m.corpoModelo || ""), valorParametroAssunto, variaveis);
  return {
    isn: String(isn),
    assunto,
    remetente: m.descricaoOrigem ? String(m.descricaoOrigem) : null,
    dataEnvio: dataHoraSerpro(m.dataEnvio, null),
    dataLeitura: dataHoraSerpro(m.dataLeitura, m.horaLeitura),
    corpoHtml: sanitizarHtmlMensagem(corpo),
  };
}

// =========================================================================
// SITFIS
// =========================================================================
const SITFIS_VERSAO = "2.0";

export async function solicitarProtocoloSitfis(documento: string) {
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Apoiar", idSistema: "SITFIS", idServico: "SOLICITARPROTOCOLO91", versaoSistema: SITFIS_VERSAO, documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = (parseDados(resp) as Record<string, unknown>) || {};
  return { protocolo: d.protocoloRelatorio || d.protocolo || null, tempoEsperaMs: Number(d.tempoEspera || 0) || 0 };
}

export async function emitirRelatorioSitfis(documento: string, protocolo: string) {
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Emitir", idSistema: "SITFIS", idServico: "RELATORIOSITFIS92", versaoSistema: SITFIS_VERSAO, dados: JSON.stringify({ protocoloRelatorio: protocolo }), documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = (parseDados(resp) as Record<string, unknown>) || {};
  return { pdfBase64: d.pdf || d.relatorioPdf || null, tempoEsperaMs: Number(d.tempoEspera || 0) || 0 };
}

// =========================================================================
// Regime (MEI)
// =========================================================================
export async function consultarSituacaoMei(documento: string) {
  const digitos = String(documento).replace(/\D/g, "");
  if (digitos.length <= 11) return { mei: false, motivo: "cpf_nao_tem_mei" };
  try {
    const resp = await chamarIntegraContador({ acao: "Consultar", idSistema: "CCMEI", idServico: "CCMEISITCADASTRAL123", documento: digitos, tipoDocumento: 2 });
    const d = (parseDados(resp) as Record<string, unknown>) || {};
    const situacao = String(d.situacaoCadastralCnpj || d.situacao || "").toUpperCase();
    return { mei: true, situacao, bruto: d };
  } catch (e) {
    if ((e as SerproError).code === "serpro_error") return { mei: false, motivo: "nao_encontrado_no_ccmei" };
    throw e;
  }
}

// =========================================================================
// Parcelamentos
// =========================================================================
const PARCELAMENTO: Record<string, { pedidos: string; parcelas: string; gerarDas: string; detalhe: string }> = {
  PARCSN: { pedidos: "PEDIDOSPARC163", parcelas: "PARCELASPARAGERAR162", gerarDas: "GERARDAS161", detalhe: "OBTERPARC164" },
  "PARCSN-ESP": { pedidos: "PEDIDOSPARC173", parcelas: "PARCELASPARAGERAR172", gerarDas: "GERARDAS171", detalhe: "OBTERPARC174" },
  PARCMEI: { pedidos: "PEDIDOSPARC203", parcelas: "PARCELASPARAGERAR202", gerarDas: "GERARDAS201", detalhe: "OBTERPARC204" },
  "PARCMEI-ESP": { pedidos: "PEDIDOSPARC213", parcelas: "PARCELASPARAGERAR212", gerarDas: "GERARDAS211", detalhe: "OBTERPARC214" },
};

export function sistemasParcelamentoPara(regime: string): string[] {
  if (regime === "mei") return ["PARCMEI", "PARCMEI-ESP"];
  return ["PARCSN", "PARCSN-ESP"];
}

export async function consultarPedidosParcelamento(documento: string, sistema: string) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Consultar", idSistema: sistema, idServico: cfg.pedidos, documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = parseDados(resp);
  const lista = encontrarLista(d, ["parcelamentos", "pedidos", "listaParcelamentos", "listaPedidos", "itens"]);
  return lista.map((p) => ({
    numero: p.numero || p.numeroParcelamento || p.numeroPedido || null,
    situacao: p.situacao || p.descricaoSituacao || p.situacaoParcelamento || null,
    dataPedido: p.dataDoPedido || p.dataPedido || null,
    quantidadeParcelas: p.quantidadeParcelas || p.numeroParcelas || null,
    valorConsolidado: p.valorConsolidado || p.valorTotal || null,
    sistema,
  }));
}

export async function consultarParcelasParaGerar(documento: string, sistema: string) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Consultar", idSistema: sistema, idServico: cfg.parcelas, documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = parseDados(resp);
  const lista = encontrarLista(d, ["listaParcelas", "parcelas", "parcelasParaGerar", "itens"]);
  return lista.map((p) => ({
    parcela: p.parcela || p.parcelaParaEmitir || p.numeroParcela || null,
    vencimento: p.dataVencimento || p.vencimento || null,
    valor: p.valor || p.valorParcela || p.valorAtualizado || null,
    sistema,
  }));
}

export async function obterDetalheParcelamento(documento: string, sistema: string, numeroParcelamento: string) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Consultar", idSistema: sistema, idServico: cfg.detalhe, dados: JSON.stringify({ numeroParcelamento: String(numeroParcelamento) }), documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  return parseDados(resp) || {};
}

export async function emitirDasParcelamento(documento: string, sistema: string, parcela: string) {
  const cfg = PARCELAMENTO[sistema];
  if (!cfg) throw new Error(`Sistema de parcelamento desconhecido: ${sistema}`);
  const digitos = String(documento).replace(/\D/g, "");
  const resp = await chamarIntegraContador({ acao: "Emitir", idSistema: sistema, idServico: cfg.gerarDas, dados: JSON.stringify({ parcelaParaEmitir: String(parcela) }), documento: digitos, tipoDocumento: tipoDoDocumento(digitos) });
  const d = (parseDados(resp) as Record<string, unknown>) || {};
  return { pdfBase64: d.docArrecadacaoPdfB64 || d.pdf || null, bruto: d };
}
