"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requirePortalClient() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data: client } = await supabase.from("clientes").select("id").eq("user_id", userId).maybeSingle();
  if (!client) return null;
  return { supabase, clientId: client.id };
}

export async function getDocumentDownloadUrl(documentId: number) {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const, message: "Sessão expirada." };
  const { data: document } = await ctx.supabase.from("documentos").select("id,cliente_ref,storage_path").eq("id", documentId).maybeSingle();
  if (!document || document.cliente_ref !== ctx.clientId) return { ok: false as const, message: "Documento não encontrado." };
  const { data: signed, error } = await ctx.supabase.storage.from("documentos").createSignedUrl(document.storage_path, 3600);
  if (error || !signed) return { ok: false as const, message: "Não foi possível gerar o link de download." };
  return { ok: true as const, url: signed.signedUrl };
}

export async function sendPortalMessage(text: string) {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const, message: "Sessão expirada." };
  const trimmed = text.trim().slice(0, 4000);
  if (!trimmed) return { ok: false as const, message: "Escreva uma mensagem." };
  const now = new Date();
  const { data, error } = await ctx.supabase
    .from("mensagens")
    .insert({
      id: crypto.randomUUID(),
      cliente_id: ctx.clientId,
      sender: "client",
      text: trimmed,
      type: "text",
      created_at: now.toISOString(),
      time: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now),
    })
    .select("id,cliente_id,sender,text,type,doc_name,duration,time,created_at,read_at,seq")
    .single();
  if (error || !data) return { ok: false as const, message: "Não foi possível enviar a mensagem." };
  revalidatePath("/portal");
  return {
    ok: true as const,
    data: {
      id: data.id,
      sender: data.sender,
      text: data.text,
      type: data.type,
      docName: data.doc_name,
      duration: data.duration,
      time: data.time,
      createdAt: data.created_at,
      readAt: data.read_at,
      seq: data.seq,
    },
  };
}

export async function sendPortalMailMessage(input: { assunto: string; mensagem: string }) {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const, message: "Sessão expirada." };
  const assunto = input.assunto.trim().slice(0, 160) || "Outro assunto";
  const mensagem = input.mensagem.trim().slice(0, 4000);
  if (!mensagem) return { ok: false as const, message: "Escreva uma mensagem." };
  const { data, error } = await ctx.supabase
    .from("caixa_postal")
    .insert({ cliente_ref: ctx.clientId, remetente: "cliente", mensagem, assunto })
    .select("id,assunto,mensagem,remetente,lida,created_at")
    .single();
  if (error || !data) return { ok: false as const, message: "Não foi possível enviar sua mensagem agora." };
  revalidatePath("/portal");
  return { ok: true as const, data: { id: data.id, assunto: data.assunto, mensagem: data.mensagem, remetente: data.remetente, lida: data.lida, createdAt: data.created_at } };
}

export async function markPortalMessagesRead() {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const };
  const { error } = await ctx.supabase.rpc("marcar_lidas", { p_cliente_id: ctx.clientId });
  return { ok: !error };
}

// Marca como lida tudo que veio do contador na Caixa Postal — quem abre a
// thread é quem "lê", nunca as próprias mensagens. Mesmo contrato do
// /api/caixa-postal/marcar-lida do legado.
export async function markMailRead() {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const };
  const { error } = await ctx.supabase.from("caixa_postal").update({ lida: true }).eq("cliente_ref", ctx.clientId).eq("remetente", "contador").eq("lida", false);
  if (error) return { ok: false as const };
  revalidatePath("/portal");
  return { ok: true as const };
}

// Mesma linha do começo ao fim: salvar rascunho e enviar não criam registros
// diferentes, só mudam o status da triagem ativa (não arquivada) do cliente —
// mesmo contrato do POST /api/triagem do legado.
export async function saveTriagem(input: { assunto: string | null; descricao: string; respostas: Record<string, string>; enviar: boolean }) {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const, message: "Sessão expirada." };

  const { data: triagemRows } = await ctx.supabase
    .from("triagens")
    .select("id,status,enviada_at")
    .eq("cliente_ref", ctx.clientId)
    .neq("status", "arquivada")
    .order("created_at", { ascending: false })
    .limit(1);
  const aberta = triagemRows && triagemRows.length ? triagemRows[0] : null;

  const status = input.enviar ? "enviada" : undefined;
  // enviada_at marca a primeira entrega — complementar depois não reescreve.
  const enviadaAt = input.enviar && (!aberta || !aberta.enviada_at) ? new Date().toISOString() : undefined;

  const query = aberta
    ? ctx.supabase
        .from("triagens")
        .update({ assunto: input.assunto, descricao: input.descricao.slice(0, 4000), respostas: input.respostas as never, ...(status ? { status } : {}), ...(enviadaAt ? { enviada_at: enviadaAt } : {}) })
        .eq("id", aberta.id)
        .select("id,assunto,descricao,status,respostas,enviada_at")
        .single()
    : ctx.supabase
        .from("triagens")
        .insert({ cliente_ref: ctx.clientId, assunto: input.assunto, descricao: input.descricao.slice(0, 4000), respostas: input.respostas as never, ...(status ? { status } : {}), ...(enviadaAt ? { enviada_at: enviadaAt } : {}) })
        .select("id,assunto,descricao,status,respostas,enviada_at")
        .single();
  const { data, error } = await query;
  if (error || !data) return { ok: false as const, message: "Não foi possível salvar." };

  if (input.enviar) {
    await ctx.supabase.rpc("concluir_onboarding_cliente");
    await ctx.supabase.rpc("confirmar_triagem_atendimento_express");
  }

  revalidatePath("/portal");
  return {
    ok: true as const,
    data: { id: data.id, assunto: data.assunto, descricao: data.descricao, status: data.status, respostas: data.respostas, enviadaEm: data.enviada_at },
  };
}

// Avaliação pós-atendimento — mesmo contrato do POST /api/avaliacoes do
// legado: só aceita relatório já entregue e do próprio cliente, e evita nota
// duplicada pelo caso_ref.
export async function submitAvaliacao(input: { relatorioId: number; nota: number; comentario: string | null }) {
  const ctx = await requirePortalClient();
  if (!ctx) return { ok: false as const, message: "Sessão expirada." };
  const nota = Math.min(5, Math.max(1, Math.round(input.nota)));

  const { data: relatorio } = await ctx.supabase.from("relatorios").select("id,cliente_ref,caso_ref,status").eq("id", input.relatorioId).maybeSingle();
  if (!relatorio || relatorio.cliente_ref !== ctx.clientId || relatorio.status !== "entregue") {
    return { ok: false as const, message: "Relatório inválido para avaliação." };
  }

  const casoRef = relatorio.caso_ref;
  if (casoRef) {
    const { data: existente } = await ctx.supabase.from("avaliacoes").select("id,nota").eq("caso_ref", casoRef).maybeSingle();
    if (existente) return { ok: true as const, nota: existente.nota };
  }

  const { data, error } = await ctx.supabase
    .from("avaliacoes")
    .insert({ cliente_ref: ctx.clientId, relatorio_id: input.relatorioId, caso_ref: casoRef, nota, comentario: input.comentario?.trim().slice(0, 2000) || null })
    .select("id,nota")
    .single();
  if (error || !data) return { ok: false as const, message: "Não consegui enviar sua avaliação agora. Tente de novo em instantes." };

  revalidatePath("/portal");
  return { ok: true as const, nota: data.nota };
}
