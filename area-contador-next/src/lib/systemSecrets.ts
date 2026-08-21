import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

// AES-256-GCM com domínio separado do Cofre gov.br (mesma chave raiz
// GOVBR_VAULT_KEY, mas hash com prefixo diferente — comprometer um domínio
// não expõe o outro). Guarda chaves de API editáveis pela UI, com fallback
// pra variável de ambiente quando não houver nada no banco: isso permite
// migrar aos poucos sem quebrar o que já está configurado na Vercel.
function chaveMestra(): Buffer {
  const segredo = process.env.GOVBR_VAULT_KEY;
  if (!segredo) throw new Error("vault_key_not_configured");
  return createHash("sha256").update(`ola-contador:system-secrets:v1:${segredo}`).digest();
}

function cifrar(texto: string): { ciphertext: string; iv: string; auth_tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chaveMestra(), iv);
  const ciphertext = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), auth_tag: cipher.getAuthTag().toString("base64") };
}

function decifrar(row: { ciphertext: string; iv: string; auth_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", chaveMestra(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export type ChaveEditavel = {
  chave: string;
  label: string;
  grupo: string;
  nota?: string;
  usosDisponiveis?: IaUso[];
  testavel?: boolean;
};

// Usos possíveis pra uma chave-provedor de IA: "chat" cobre as funções de
// texto do Copiloto (resumo, rascunho, pergunta, diagnóstico, relatório),
// "documentos" cobre a leitura de anexos (imagem via visão, PDF via texto
// extraído) e "embeddings" cobre a indexação/busca das skills em PDF (RAG).
// Ver resolveProvider em lib/ia.ts.
export type IaUso = "chat" | "documentos" | "embeddings";
export const USOS_IA: { id: IaUso; label: string }[] = [
  { id: "chat", label: "Chat/Copiloto" },
  { id: "documentos", label: "Análise de documentos" },
  { id: "embeddings", label: "Embeddings de skills (RAG)" },
];

// Só entram aqui as chaves que algum lib/*.ts já sabe ler do banco primeiro
// (ver getSystemSecret nos pontos de uso). Adicionar uma linha aqui sem
// mudar o lib correspondente só cadastra a chave — não muda o comportamento
// de nada até o código que consome ela ser adaptado. `testavel` liga o botão
// "Testar chave" (chama a API do provedor de verdade); só faz sentido pra
// chaves de acesso, não pra nomes de modelo.
export const CHAVES_EDITAVEIS: ChaveEditavel[] = [
  { chave: "GROQ_API_KEY", label: "Groq (IA principal do Copiloto)", grupo: "Inteligência Artificial", usosDisponiveis: ["chat", "documentos"], testavel: true },
  { chave: "GROQ_MODEL", label: "Modelo Groq (texto)", grupo: "Inteligência Artificial", nota: "Nome do modelo, não é uma chave de acesso — segue o uso da Groq acima." },
  { chave: "GROQ_VISION_MODEL", label: "Modelo Groq (visão/imagem)", grupo: "Inteligência Artificial", nota: "Nome do modelo, não é uma chave de acesso — segue o uso da Groq acima." },
  { chave: "OPENROUTER_API_KEY", label: "OpenRouter (IA alternativa)", grupo: "Inteligência Artificial", usosDisponiveis: ["chat", "documentos"], testavel: true },
  { chave: "OPENROUTER_MODEL", label: "Modelo OpenRouter", grupo: "Inteligência Artificial", nota: "Nome do modelo, não é uma chave de acesso — segue o uso do OpenRouter acima." },
  { chave: "OPENAI_API_KEY", label: "OpenAI (embeddings das skills)", grupo: "Inteligência Artificial", usosDisponiveis: ["embeddings"], testavel: true },
  {
    chave: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    label: "Google Analytics 4 (Measurement ID)",
    grupo: "Marketing & Analytics",
    nota: "Formato G-XXXXXXXXXX. Não é segredo — aparece no código-fonte público do site — mas fica aqui pra trocar sem precisar mexer nas variáveis de ambiente da Vercel.",
  },
];

const CONFIG_USOS_CHAVE = "ia_chave_usos";
type UsosConfig = Record<string, Partial<Record<IaUso, boolean>>>;

// Sem linha no config = habilitada em todos os usos disponíveis (mantém o
// comportamento anterior, onde qualquer chave presente valia pra tudo).
export async function getChaveUsosConfig(admin: Admin): Promise<UsosConfig> {
  const { data } = await admin.from("configuracoes").select("valor").eq("chave", CONFIG_USOS_CHAVE).maybeSingle();
  return (data?.valor as UsosConfig) || {};
}

export async function setChaveUso(admin: Admin, chave: string, uso: IaUso, ativo: boolean): Promise<void> {
  const atual = await getChaveUsosConfig(admin);
  const doChave = { ...(atual[chave] || {}), [uso]: ativo };
  const proximo = { ...atual, [chave]: doChave };
  const { error } = await admin
    .from("configuracoes")
    .upsert({ chave: CONFIG_USOS_CHAVE, valor: proximo as never, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function isUsoHabilitado(admin: Admin, chave: string, uso: IaUso): Promise<boolean> {
  const usos = (await getChaveUsosConfig(admin))[chave];
  return !usos || usos[uso] !== false;
}

export async function getSystemSecret(admin: Admin, chave: string): Promise<string | null> {
  const { data } = await admin.from("chaves_sistema").select("ciphertext,iv,auth_tag").eq("chave", chave).maybeSingle();
  if (data?.ciphertext && data.iv && data.auth_tag) {
    try {
      return decifrar(data as { ciphertext: string; iv: string; auth_tag: string });
    } catch {
      /* chave raiz mudou ou dado corrompido — cai pro env abaixo */
    }
  }
  return process.env[chave] || null;
}

export async function setSystemSecret(admin: Admin, chave: string, valor: string, atorId: string): Promise<void> {
  const enc = cifrar(valor);
  const { error } = await admin
    .from("chaves_sistema")
    .upsert({ chave, ...enc, atualizado_em: new Date().toISOString(), atualizado_por: atorId });
  if (error) throw error;
}

export async function clearSystemSecret(admin: Admin, chave: string): Promise<void> {
  const { error } = await admin.from("chaves_sistema").delete().eq("chave", chave);
  if (error) throw error;
}

// Chama a API do provedor de verdade com a chave informada, pra confirmar que
// ela autentica antes (ou depois) de salvar — colar uma chave errada só se
// revelaria no próximo atendimento sem isso.
export async function testarChave(chave: string, valor: string): Promise<{ ok: boolean; detail?: string }> {
  const endpoints: Record<string, { url: string; headers: (v: string) => Record<string, string> }> = {
    GROQ_API_KEY: { url: "https://api.groq.com/openai/v1/models", headers: (v) => ({ Authorization: `Bearer ${v}` }) },
    // /models do OpenRouter é público e responde 200 mesmo com chave inválida
    // (chega a ignorar o header) — /key exige autenticação de verdade.
    OPENROUTER_API_KEY: { url: "https://openrouter.ai/api/v1/key", headers: (v) => ({ Authorization: `Bearer ${v}` }) },
    OPENAI_API_KEY: { url: "https://api.openai.com/v1/models", headers: (v) => ({ Authorization: `Bearer ${v}` }) },
  };
  const endpoint = endpoints[chave];
  if (!endpoint) return { ok: false, detail: "Essa chave não tem um teste automático — verifique manualmente." };
  try {
    const res = await fetch(endpoint.url, { headers: endpoint.headers(valor), signal: AbortSignal.timeout(10000) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, detail: data?.error?.message || `${res.status} ${res.statusText}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Falha de rede ao testar." };
  }
}

// Metadados do certificado digital do SERPRO (não é segredo — só a data de
// validade e o titular, pra mostrar aviso de vencimento na tela sem precisar
// descriptografar o certificado toda vez). PEM/chave em si ficam em
// `chaves_sistema` via set/getSystemSecret, como qualquer outra chave.
export type SerproCertificadoMeta = {
  validoDesde: string;
  validoAte: string;
  titular: string;
  atualizadoEm: string;
  atualizadoPor: string;
};

const CONFIG_SERPRO_CERT_META = "serpro_certificado_meta";

export async function getSerproCertificadoMeta(admin: Admin): Promise<SerproCertificadoMeta | null> {
  const { data } = await admin.from("configuracoes").select("valor").eq("chave", CONFIG_SERPRO_CERT_META).maybeSingle();
  return (data?.valor as SerproCertificadoMeta) || null;
}

export async function setSerproCertificadoMeta(admin: Admin, meta: SerproCertificadoMeta): Promise<void> {
  const { error } = await admin
    .from("configuracoes")
    .upsert({ chave: CONFIG_SERPRO_CERT_META, valor: meta as never, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function listSystemSecretsStatus(admin: Admin): Promise<Record<string, { origem: "banco" | "ambiente" | "nenhuma"; atualizadoEm: string | null }>> {
  const { data } = await admin.from("chaves_sistema").select("chave,atualizado_em");
  const noBanco = new Map((data || []).map((row) => [row.chave, row.atualizado_em]));
  const status: Record<string, { origem: "banco" | "ambiente" | "nenhuma"; atualizadoEm: string | null }> = {};
  for (const item of CHAVES_EDITAVEIS) {
    if (noBanco.has(item.chave)) status[item.chave] = { origem: "banco", atualizadoEm: noBanco.get(item.chave) || null };
    else if (process.env[item.chave]) status[item.chave] = { origem: "ambiente", atualizadoEm: null };
    else status[item.chave] = { origem: "nenhuma", atualizadoEm: null };
  }
  return status;
}
