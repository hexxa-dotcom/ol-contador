// Consulta Dívida Ativa da União (PGFN/SIDA) — porte de api/_lib/divida-ativa.js.
// Contrato e credenciais próprios no API Center do SERPRO; não reutiliza as
// chaves do Integra Contador.
const CONSUMER_KEY = process.env.SERPRO_DIVIDA_ATIVA_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.SERPRO_DIVIDA_ATIVA_CONSUMER_SECRET || "";
const BASE_URL = String(process.env.SERPRO_DIVIDA_ATIVA_BASE_URL || "https://gateway.apiserpro.serpro.gov.br/consulta-divida-ativa-df/api/v1").replace(/\/$/, "");
const TOKEN_URL = process.env.SERPRO_DIVIDA_ATIVA_TOKEN_URL || "https://gateway.apiserpro.serpro.gov.br/token";

let tokenCache = "";
let tokenExpiraEm = 0;

export function isConfigured(): boolean {
  return !!(CONSUMER_KEY && CONSUMER_SECRET);
}

class DividaAtivaError extends Error {
  code?: string;
  status?: number;
}

async function token(): Promise<string> {
  if (!isConfigured()) {
    const erro = new DividaAtivaError("A API Consulta Dívida Ativa ainda não está contratada/configurada.");
    erro.code = "divida_ativa_not_configured";
    throw erro;
  }
  if (tokenCache && Date.now() < tokenExpiraEm) return tokenCache;

  const credencial = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${credencial}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const texto = await resposta.text();
  let dados: { access_token?: string; expires_in?: number } = {};
  try {
    dados = JSON.parse(texto);
  } catch {
    // resposta não-JSON tratada abaixo pela ausência de access_token
  }
  if (!resposta.ok || !dados.access_token) {
    const erro = new DividaAtivaError(`Falha ao autenticar na Consulta Dívida Ativa (${resposta.status}).`);
    erro.code = resposta.status === 401 || resposta.status === 403 ? "divida_ativa_not_contracted" : "divida_ativa_error";
    erro.status = resposta.status;
    throw erro;
  }
  tokenCache = dados.access_token;
  tokenExpiraEm = Date.now() + Math.max(30, (Number(dados.expires_in) || 3600) - 60) * 1000;
  return tokenCache;
}

async function consultar(caminho: string): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
  const resposta = await fetch(`${BASE_URL}${caminho}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" } });
  const texto = await resposta.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    // resposta não-JSON tratada abaixo
  }
  if (resposta.status === 404) return null;
  if (!resposta.ok) {
    const erro = new DividaAtivaError(`Consulta Dívida Ativa falhou (${resposta.status}).`);
    erro.code = resposta.status === 401 || resposta.status === 403 ? "divida_ativa_not_contracted" : "divida_ativa_error";
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

type InscricaoNormalizada = {
  numeroInscricao: unknown;
  numeroProcesso: unknown;
  situacao: unknown;
  valorConsolidado: unknown;
  orgaoOrigem: unknown;
  unidade: unknown;
  receita: unknown;
  dataInscricao: unknown;
  dataVencimento: unknown;
  processoJudicial: unknown;
  suspensa: unknown;
};

function normalizarInscricao(item: Record<string, unknown> | null): InscricaoNormalizada | null {
  if (!item || typeof item !== "object") return null;
  return {
    numeroInscricao: item.numeroInscricao || item.inscricao || null,
    numeroProcesso: item.numeroProcesso || item.processo || null,
    situacao: item.situacaoDescricao || item.situacaoInscricao || item.situacao || null,
    valorConsolidado: item.valorTotalConsolidadoMoeda || item.valorTotalConsolidado || item.valorConsolidado || null,
    orgaoOrigem: item.orgaoOrigem || item.nomeOrgaoOrigem || null,
    unidade: item.nomeUnidade || item.unidade || null,
    receita: item.nomeReceita || item.receita || null,
    dataInscricao: item.dataInscricao || null,
    dataVencimento: item.dataVencimento || null,
    processoJudicial: item.numeroProcessoJudicial || null,
    suspensa: item.indicadorSuspensao || item.suspensa || false,
  };
}

export async function consultarDevedor(documento: string) {
  const digitos = String(documento || "").replace(/\D/g, "");
  const dados = await consultar(`/devedor/${encodeURIComponent(digitos)}`);
  const lista = Array.isArray(dados)
    ? dados
    : Array.isArray((dados as Record<string, unknown>)?.inscricoes)
      ? ((dados as Record<string, unknown>).inscricoes as Record<string, unknown>[])
      : dados
        ? [dados as Record<string, unknown>]
        : [];
  return { inscricoes: lista.map(normalizarInscricao).filter((x): x is InscricaoNormalizada => Boolean(x)) };
}

export async function consultarInscricao(numero: string) {
  const digitos = String(numero || "").replace(/\D/g, "");
  const dados = await consultar(`/inscricao/${encodeURIComponent(digitos)}`);
  return { inscricao: normalizarInscricao(dados as Record<string, unknown>), detalhe: dados || null };
}
