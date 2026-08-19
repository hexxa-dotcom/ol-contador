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

export type ChaveEditavel = { chave: string; label: string; grupo: string; nota?: string };

// Só entram aqui as chaves que algum lib/*.ts já sabe ler do banco primeiro
// (ver getSystemSecret nos pontos de uso). Adicionar uma linha aqui sem
// mudar o lib correspondente só cadastra a chave — não muda o comportamento
// de nada até o código que consome ela ser adaptado.
export const CHAVES_EDITAVEIS: ChaveEditavel[] = [
  { chave: "GROQ_API_KEY", label: "Groq (IA principal do Copiloto)", grupo: "Inteligência Artificial" },
  { chave: "GROQ_MODEL", label: "Modelo Groq (texto)", grupo: "Inteligência Artificial" },
  { chave: "GROQ_VISION_MODEL", label: "Modelo Groq (visão/imagem)", grupo: "Inteligência Artificial" },
  { chave: "OPENROUTER_API_KEY", label: "OpenRouter (IA alternativa)", grupo: "Inteligência Artificial" },
  { chave: "OPENROUTER_MODEL", label: "Modelo OpenRouter", grupo: "Inteligência Artificial" },
  { chave: "OPENAI_API_KEY", label: "OpenAI (embeddings das skills)", grupo: "Inteligência Artificial" },
];

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
