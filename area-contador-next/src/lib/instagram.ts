// Cliente da API oficial de Mensagens/Comentários do Instagram (Meta,
// produto "Instagram Login") — canal oficial, sem libs não-oficiais, mesmo
// espírito do src/lib/whatsapp.ts. Diferente do WhatsApp (token de System
// User permanente), o token de acesso do Instagram Login expira (~60 dias) e
// fica guardado criptografado na tabela `configuracoes` (chave
// "instagram_conta"), não em env var — por isso as funções daqui recebem o
// admin client do Supabase, não leem token direto do process.env.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

const GRAPH_VERSION = "v26.0";
const APP_ID = process.env.INSTAGRAM_APP_ID || "";
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";
// Mesmo app da Meta usado pro WhatsApp ("Ola-contador") — o app secret é um
// só por app, não por produto. Se FACEBOOK_APP_SECRET não estiver setada
// separadamente, reaproveita WHATSAPP_APP_SECRET (já configurada na Vercel)
// em vez de pedir pra cadastrar o mesmo valor duas vezes.
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || process.env.WHATSAPP_APP_SECRET || "";

type Admin = SupabaseClient<Database>;

type ContaInstagram = {
  userId: string;
  username: string | null;
  accessToken: string;
  expiraEm: string;
};

// Mesmo esquema AES-256-GCM já usado em src/lib/govbrVault.ts, chave própria
// (INSTAGRAM_TOKEN_ENCRYPTION_KEY) — nunca reaproveitar a chave do cofre
// gov.br nem a service role key pra cifrar isso.
function chaveDoToken(): Buffer {
  const segredo = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!segredo) throw new Error("instagram_token_encryption_key_not_configured");
  return createHash("sha256").update(`ola-contador:instagram-token:v1:${segredo}`).digest();
}

function cifrarToken(texto: string): { ciphertext: string; iv: string; auth_tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chaveDoToken(), iv);
  const ciphertext = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), auth_tag: cipher.getAuthTag().toString("base64") };
}

function decifrarToken(row: { ciphertext: string; iv: string; auth_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", chaveDoToken(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

// Meta assina o corpo do webhook com HMAC-SHA256 (X-Hub-Signature-256). Testa
// contra os dois secrets possíveis (app e produto Instagram), igual o
// OpenReply documenta fazer — não dá pra saber de antemão qual dos dois a
// Meta usou pra assinar.
export function verifyInstagramWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const b = Buffer.from(signatureHeader);
  for (const secret of [FACEBOOK_APP_SECRET, APP_SECRET]) {
    if (!secret) continue;
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function salvarContaInstagram(admin: Admin, dados: { userId: string; username: string | null; accessToken: string; expiraEm: string }) {
  await admin.from("configuracoes").upsert({
    chave: "instagram_conta",
    valor: {
      userId: dados.userId,
      username: dados.username,
      token: cifrarToken(dados.accessToken),
      expiraEm: dados.expiraEm,
    },
    visivel_cliente: false,
  });
}

export async function obterContaInstagram(admin: Admin): Promise<ContaInstagram | null> {
  const { data } = await admin.from("configuracoes").select("valor").eq("chave", "instagram_conta").maybeSingle();
  const valor = data?.valor as { userId?: string; username?: string | null; token?: { ciphertext: string; iv: string; auth_tag: string }; expiraEm?: string } | null;
  if (!valor?.userId || !valor.token) return null;
  try {
    return { userId: valor.userId, username: valor.username ?? null, accessToken: decifrarToken(valor.token), expiraEm: valor.expiraEm || "" };
  } catch {
    return null;
  }
}

async function graphFetch(path: string, accessToken: string, body: unknown) {
  const res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[instagram] erro:", JSON.stringify(data));
    return { ok: false as const, error: data };
  }
  return { ok: true as const, data };
}

// Busca o @usuário de quem mandou uma DM (o evento de mensagem só traz o
// ID numérico, `sender.id`, diferente do evento de comentário que já vem
// com o username) — evita mostrar o ID gigante como "nome" na lista de
// conversas. `instagram_business_basic` (já solicitada) cobre essa consulta.
export async function buscarUsernameInstagram(admin: Admin, igsid: string): Promise<string | null> {
  const conta = await obterContaInstagram(admin);
  if (!conta) return null;
  const res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${igsid}?fields=username&access_token=${conta.accessToken}`);
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { username?: string };
  return data.username || null;
}

// Mensagem livre — só funciona dentro da janela de 24h desde a última
// mensagem da pessoa (não existe fallback de template no Instagram, diferente
// do WhatsApp: fora da janela, a Meta simplesmente rejeita o envio).
export async function sendInstagramText(admin: Admin, recipientIgUserId: string, texto: string) {
  const conta = await obterContaInstagram(admin);
  if (!conta) return { skipped: true as const, motivo: "conta_nao_conectada" as const };
  return graphFetch(`${conta.userId}/messages`, conta.accessToken, {
    recipient: { id: recipientIgUserId },
    message: { text: texto },
  });
}

// Limite documentado da Meta: 750 respostas privadas por hora por conta.
// Conta quantas mensagens o contador mandou na última hora (todas as
// conversas) — não precisa de Redis/fila externa pro volume de uma conta só.
export async function dentroDoLimiteDeEnvio(admin: Admin): Promise<boolean> {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("instagram_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("sender", "contador")
    .gte("created_at", umaHoraAtras);
  return (count ?? 0) < 750;
}

// Troca do código do OAuth (Instagram Login) pelo token de curta duração, e
// esse pelo de longa duração (~60 dias) — usado só uma vez, no callback,
// quando o contador conecta a conta @olacontador.
export async function trocarCodePorTokenDeLongaDuracao(code: string, redirectUri: string): Promise<{ userId: string; accessToken: string; expiraEm: string } | null> {
  if (!APP_ID || !APP_SECRET) return null;

  const curtaForm = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const curtaRes = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: curtaForm });
  const curta = (await curtaRes.json().catch(() => ({}))) as { access_token?: string; user_id?: string };
  if (!curtaRes.ok || !curta.access_token || !curta.user_id) return null;

  const longaUrl = new URL("https://graph.instagram.com/access_token");
  longaUrl.searchParams.set("grant_type", "ig_exchange_token");
  longaUrl.searchParams.set("client_secret", APP_SECRET);
  longaUrl.searchParams.set("access_token", curta.access_token);
  const longaRes = await fetch(longaUrl);
  const longa = (await longaRes.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!longaRes.ok || !longa.access_token) return null;

  const expiraEm = new Date(Date.now() + (longa.expires_in || 60 * 24 * 60 * 60) * 1000).toISOString();
  // A pegadinha do ID documentada pelo OpenReply: /me devolve `id` (com
  // escopo do app) e `user_id` (o ID real da conta profissional). O token de
  // curta duração já devolve `user_id` direto — é esse que guardamos, nunca
  // o `id` de outra chamada.
  return { userId: curta.user_id, accessToken: longa.access_token, expiraEm };
}

// Renovação do token de longa duração — precisa rodar antes de vencer
// (chamado pelo cron diário). A Meta exige que o token ainda tenha pelo menos
// 24h de vida pra aceitar renovar.
export async function renovarTokenDeLongaDuracao(accessTokenAtual: string): Promise<{ accessToken: string; expiraEm: string } | null> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessTokenAtual);
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) return null;
  return { accessToken: data.access_token, expiraEm: new Date(Date.now() + (data.expires_in || 60 * 24 * 60 * 60) * 1000).toISOString() };
}
