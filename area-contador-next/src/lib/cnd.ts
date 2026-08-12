// Certidão Negativa de Débitos — porte de api/_lib/cnd.js. Produto/credenciais
// contratados separadamente do Integra Contador; a URL completa vem de env e
// deve conter "{documento}" (o endpoint varia conforme o contrato).
const URL_MODELO = process.env.SERPRO_CND_URL || "";
const TOKEN_URL = process.env.SERPRO_CND_TOKEN_URL || "https://gateway.apiserpro.serpro.gov.br/token";
const KEY = process.env.SERPRO_CND_CONSUMER_KEY || "";
const SECRET = process.env.SERPRO_CND_CONSUMER_SECRET || "";
let tokenCache = "";
let expiraEm = 0;

export function isConfigured(): boolean {
  return !!(URL_MODELO.includes("{documento}") && KEY && SECRET);
}

class CndError extends Error {
  code?: string;
  status?: number;
}

async function obterToken(): Promise<string> {
  if (tokenCache && Date.now() < expiraEm) return tokenCache;
  if (!isConfigured()) {
    const e = new CndError("A API de CND ainda não está contratada/configurada.");
    e.code = "cnd_not_configured";
    throw e;
  }
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !dados.access_token) {
    const e = new CndError(`Falha ao autenticar na API de CND (${resposta.status}).`);
    e.code = "cnd_auth_error";
    throw e;
  }
  tokenCache = dados.access_token;
  expiraEm = Date.now() + Math.max(30, (Number(dados.expires_in) || 3600) - 60) * 1000;
  return tokenCache;
}

export async function emitir(documento: string): Promise<{ pdfBase64: string | null; protocolo?: string | null; situacao?: string | null }> {
  const url = URL_MODELO.replace("{documento}", encodeURIComponent(String(documento).replace(/\D/g, "")));
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${await obterToken()}`, Accept: "application/pdf, application/json" } });
  if (!resposta.ok) {
    const e = new CndError(`Emissão da CND falhou (${resposta.status}).`);
    e.code = "cnd_error";
    e.status = resposta.status;
    throw e;
  }
  const tipo = resposta.headers.get("content-type") || "";
  if (tipo.includes("application/pdf")) {
    return { pdfBase64: Buffer.from(await resposta.arrayBuffer()).toString("base64") };
  }
  const dados = await resposta.json().catch(() => ({}));
  return { pdfBase64: dados.pdfBase64 || dados.pdf || null, protocolo: dados.protocolo || null, situacao: dados.situacao || null };
}
