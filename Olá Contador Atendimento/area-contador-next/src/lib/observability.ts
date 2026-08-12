import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

const CHAVES_SENSIVEIS =
  /token|senha|password|secret|authorization|cpf|cnpj|documento|email|telefone|phone|cookie|credencial/i;

type Json = unknown;

export function limpar(valor: Json, profundidade = 0): Json {
  if (profundidade > 3) return "[omitido]";
  if (Array.isArray(valor)) return valor.slice(0, 10).map((v) => limpar(v, profundidade + 1));
  if (valor && typeof valor === "object") {
    const saida: Record<string, Json> = {};
    Object.entries(valor as Record<string, Json>)
      .slice(0, 30)
      .forEach(([chave, conteudo]) => {
        saida[chave] = CHAVES_SENSIVEIS.test(chave) ? "[protegido]" : limpar(conteudo, profundidade + 1);
      });
    return saida;
  }
  return typeof valor === "string" ? valor.slice(0, 500) : valor;
}

export async function registrarErro(
  admin: SupabaseClient<Database> | null,
  dados: {
    origem?: string;
    codigo?: string;
    mensagem?: string;
    rota?: string;
    severidade?: "aviso" | "erro" | "critico";
    contexto?: Json;
  } = {}
): Promise<boolean> {
  if (!admin) return false;
  const origem = String(dados.origem || "servidor").slice(0, 80);
  const codigo = String(dados.codigo || "erro").slice(0, 120);
  const mensagem = String(dados.mensagem || "Erro sem mensagem")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
  const rota = String(dados.rota || "").split("?")[0].slice(0, 180) || null;
  const fingerprint = createHash("sha256")
    .update(`${origem}|${codigo}|${mensagem}|${rota || ""}`)
    .digest("hex");

  const existente = await admin
    .from("app_erros")
    .select("id,ocorrencias")
    .eq("fingerprint", fingerprint)
    .is("resolvido_em", null)
    .maybeSingle();

  if (existente.data) {
    await admin
      .from("app_erros")
      .update({
        ocorrencias: (existente.data.ocorrencias || 1) + 1,
        ultimo_em: new Date().toISOString(),
        contexto: limpar(dados.contexto || {}) as never,
      })
      .eq("id", existente.data.id);
    return true;
  }

  const { error } = await admin.from("app_erros").insert({
    origem,
    codigo,
    mensagem,
    rota,
    fingerprint,
    severidade: ["aviso", "erro", "critico"].includes(dados.severidade || "") ? dados.severidade! : "erro",
    contexto: limpar(dados.contexto || {}) as never,
  });
  return !error || error.code === "23505";
}
