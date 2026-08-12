import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// AES-256-GCM — porte de api/_lib/govbr-vault.js. Diferente do legado,
// GOVBR_VAULT_KEY é obrigatória aqui (sem fallback silencioso para
// SUPABASE_SERVICE_ROLE_KEY): reaproveitar a mesma chave pra cifrar segredos
// e autenticar como admin é um risco desnecessário numa reescrita do zero.
function chaveDoCofre(): Buffer {
  const segredo = process.env.GOVBR_VAULT_KEY;
  if (!segredo) throw new Error("vault_key_not_configured");
  return createHash("sha256").update(`ola-contador:govbr-vault:v1:${segredo}`).digest();
}

export function cifrar(texto: string): { ciphertext: string; iv: string; auth_tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chaveDoCofre(), iv);
  const ciphertext = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decifrar(row: { ciphertext: string; iv: string; auth_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", chaveDoCofre(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
