"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { transcreverAudio } from "@/lib/ia";
import { sendWhatsAppText, sendWhatsAppAudio } from "@/lib/whatsapp";

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

export type ProfessionalProfileInput = { name: string; crc: string; tags: string; bio: string; education: string; logoDataUrl: string; assinaturaDataUrl: string };

export async function updateProfile(input: ProfessionalProfileInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const profile = {
    name,
    crc: input.crc.trim().slice(0, 80),
    tags: input.tags.split(",").map(item => item.trim()).filter(Boolean).slice(0, 20).join(", "),
    bio: input.bio.trim().slice(0, 3000),
    education: input.education.trim().slice(0, 3000),
    logoDataUrl: input.logoDataUrl || "",
    assinaturaDataUrl: input.assinaturaDataUrl || "",
  };
  if (name.length < 3 || name.length > 80 || profile.crc.length < 4) {
    return { ok: false as const, message: "Informe o nome completo e um registro CRC válido." };
  }
  const validImage = (value: string) => !value || (/^data:image\/(png|jpeg);base64,/.test(value) && value.length <= 1_450_000);
  if (!validImage(profile.logoDataUrl) || !validImage(profile.assinaturaDataUrl)) {
    return { ok: false as const, message: "Logo e assinatura devem ser PNG/JPEG com até 1 MB." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return { ok: false as const, message: "Sessão expirada. Entre novamente." };

  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };
  const { error: configError } = await supabase.from("configuracoes").upsert({ chave: "perfil_contador", valor: profile, visivel_cliente: true, updated_at: new Date().toISOString() }, { onConflict: "chave" });
  if (configError) return { ok: false as const, message: "Não foi possível salvar o perfil agora." };

  revalidatePath("/");
  return { ok: true as const, name, profile, message: "Perfil profissional atualizado com sucesso." };
}

export async function updateClient(input: { id: string; name: string; email: string; phone: string; status: string; notas: string }) {
  const payload = {
    name: input.name.trim().replace(/\s+/g, " "),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    status: input.status.trim() || "waiting",
    notas: input.notas.trim() || null,
  };
  if (!input.id || payload.name.length < 2 || payload.name.length > 120) {
    return { ok: false as const, message: "Revise o nome e os dados do cliente." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };

  const { data, error } = await supabase.from("clientes").update(payload).eq("id", input.id).select("id,name,email,phone,status,notas").single();
  if (error || !data) return { ok: false as const, message: "Não foi possível atualizar o cliente." };
  revalidatePath("/");
  return { ok: true as const, data, message: "Cliente atualizado com sucesso." };
}

export async function sendMessage(input: { clientId: string; text: string }) {
  const text = input.text.trim();
  if (!input.clientId || !text || text.length > 5000) return { ok: false as const, message: "Mensagem inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };
  const now = new Date();
  const { data, error } = await supabase.from("mensagens").insert({
    id: crypto.randomUUID(), cliente_id: input.clientId, sender: "agent", text,
    time: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now),
    created_at: now.toISOString(), type: "text",
  }).select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").single();
  if (error || !data) return { ok: false as const, message: "Não foi possível enviar a mensagem." };
  revalidatePath("/");
  return { ok: true as const, data, message: "Mensagem enviada." };
}

export async function sendWhatsAppMessage(input: { clientId: string; text: string }) {
  const text = input.text.trim();
  if (!input.clientId || !text || text.length > 4000) return { ok: false as const, message: "Mensagem inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const [{ data: staff }, { data: client }] = await Promise.all([
    supabase.from("staff").select("id").eq("id", userId).maybeSingle(),
    supabase.from("clientes").select("id,phone").eq("id", input.clientId).maybeSingle(),
  ]);
  if (!staff || !client) return { ok: false as const, message: "Ação não autorizada." };
  if (!client.phone) return { ok: false as const, message: "Este cliente não tem telefone cadastrado." };

  const envio = await sendWhatsAppText(client.phone, text);
  if ("skipped" in envio) return { ok: false as const, message: "WhatsApp não está configurado." };
  if (!envio.ok) return { ok: false as const, message: "Não foi possível enviar pelo WhatsApp — o cliente pode estar fora da janela de 24h de conversa." };

  const now = new Date();
  const { data, error } = await supabase.from("mensagens").insert({
    id: crypto.randomUUID(), cliente_id: input.clientId, sender: "agent", text, canal: "whatsapp", wa_message_id: envio.messageId || null,
    time: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now),
    created_at: now.toISOString(), type: "text",
  }).select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").single();
  if (error || !data) return { ok: false as const, message: "Mensagem enviada pelo WhatsApp, mas não foi possível registrar no histórico." };
  revalidatePath("/");
  return { ok: true as const, data, message: "Mensagem enviada pelo WhatsApp." };
}

export async function sendChatShortcut(input:{clientId:string;kind:"document";value?:string}){if(!input.clientId)return {ok:false as const,message:"Selecione um atendimento."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:client}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id").eq("id",input.clientId).maybeSingle()]);if(!staff||!client)return {ok:false as const,message:"Ação não autorizada."};const now=new Date();const requested=String(input.value||"Documento").trim().slice(0,160);const {data,error}=await supabase.from("mensagens").insert({id:crypto.randomUUID(),cliente_id:input.clientId,sender:"agent",text:`Solicitação de Documento: ${requested}`,type:"document-request",created_at:now.toISOString(),time:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}).format(now)}).select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").single();if(error||!data)return {ok:false as const,message:"Não foi possível enviar o atalho."};revalidatePath("/");return {ok:true as const,data,message:"Documento solicitado ao cliente."};}

export async function sendAudioMessage(input: { clientId: string; fileName: string; duration: string; canal?: "web" | "whatsapp" }) {
  if (!input.clientId || !input.fileName) return { ok: false as const, message: "Áudio inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const [{ data: staff }, { data: document }, { data: client }] = await Promise.all([
    supabase.from("staff").select("id").eq("id", userId).maybeSingle(),
    supabase.from("documentos").select("id,cliente_ref,file_name,storage_path,mime").eq("cliente_ref", input.clientId).eq("file_name", input.fileName).maybeSingle(),
    supabase.from("clientes").select("id,phone").eq("id", input.clientId).maybeSingle(),
  ]);
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };
  if (!document) return { ok: false as const, message: "O áudio foi salvo, mas não foi possível anunciá-lo no chat." };
  const transcricao = await transcreverAudioDocumento(document);
  const now = new Date();

  let waMessageId: string | null = null;
  const isWhatsApp = input.canal === "whatsapp";
  if (isWhatsApp && client?.phone) {
    const admin = adminClient();
    if (admin) {
      const { data: signed } = await admin.storage.from("documentos").createSignedUrl(document.storage_path, 60 * 60);
      if (signed?.signedUrl) {
        const envioWa = await sendWhatsAppAudio(client.phone, signed.signedUrl);
        if (!("skipped" in envioWa) && envioWa.ok) {
          waMessageId = envioWa.messageId || null;
        }
      }
    }
  }

  const { data, error } = await supabase.from("mensagens").insert({
    id: crypto.randomUUID(),
    cliente_id: input.clientId,
    sender: "agent",
    text: `Mensagem de Áudio (${input.duration})`,
    type: "audio",
    doc_name: document.file_name,
    duration: input.duration,
    transcricao,
    canal: isWhatsApp ? "whatsapp" : "web",
    wa_message_id: waMessageId,
    created_at: now.toISOString(),
    time: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now)
  }).select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").single();
  if (error || !data) return { ok: false as const, message: "O áudio foi salvo, mas não foi possível anunciá-lo no chat." };
  revalidatePath("/");
  return { ok: true as const, data, message: isWhatsApp ? "Áudio enviado no WhatsApp." : "Áudio enviado." };
}

// Baixa o áudio recém-salvo (via service_role, funciona independente de RLS
// de quem gravou) e transcreve pelo Whisper da Groq. Nunca derruba o envio da
// mensagem — se falhar (chave ausente, Storage fora do ar, etc.), a
// mensagem de áudio segue normal, só sem o texto pesquisável.
async function transcreverAudioDocumento(document: { storage_path: string; file_name: string; mime: string | null }): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data: blob } = await admin.storage.from("documentos").download(document.storage_path);
  if (!blob) return null;
  const buffer = Buffer.from(await blob.arrayBuffer());
  return transcreverAudio(admin, buffer, document.mime || "audio/webm", document.file_name);
}

export async function announceChatDocument(input:{clientId:string;documentId:number}){if(!input.clientId||!Number.isInteger(input.documentId))return {ok:false as const,message:"Documento inválido."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:document}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("documentos").select("id,cliente_ref,file_name").eq("id",input.documentId).maybeSingle()]);if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(!document||document.cliente_ref!==input.clientId)return {ok:false as const,message:"Documento não pertence a este cliente."};const now=new Date();const {data,error}=await supabase.from("mensagens").insert({id:crypto.randomUUID(),cliente_id:input.clientId,sender:"agent",text:`Documento enviado: ${document.file_name}`,type:"document",doc_name:document.file_name,created_at:now.toISOString(),time:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}).format(now)}).select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").single();if(error||!data)return {ok:false as const,message:"O arquivo foi salvo, mas não foi possível anunciá-lo no chat."};revalidatePath("/");return {ok:true as const,data,message:"Documento anexado e enviado na conversa."};}

export async function markClientMessagesRead(clientId: string) {
  if (!clientId) return { ok: false as const };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const };
  const { error } = await supabase.rpc("marcar_lidas", { p_cliente_id: clientId });
  revalidatePath("/");
  return { ok: !error as boolean };
}

export async function markNotificationsRead(notificationId?: number) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };

  let query = supabase.from("notificacoes").update({ unread: false }).eq("unread", true);
  if (typeof notificationId === "number") query = query.eq("id", notificationId);
  const { error } = await query;
  if (error) return { ok: false as const, message: "Não foi possível atualizar as notificações." };
  revalidatePath("/");
  return { ok: true as const, message: notificationId ? "Notificação lida." : "Todas as notificações foram marcadas como lidas." };
}

export async function deleteNotification(notificationId: number) {
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return { ok: false as const, message: "Notificação inválida." };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };
  const { error } = await supabase.from("notificacoes").delete().eq("id", notificationId);
  if (error) return { ok: false as const, message: "Não foi possível excluir a notificação." };
  revalidatePath("/");
  return { ok: true as const, message: "Notificação excluída." };
}

export async function clearNotifications() {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };
  const { error } = await supabase.from("notificacoes").delete().gte("id", 1);
  if (error) return { ok: false as const, message: "Não foi possível limpar o histórico." };
  revalidatePath("/");
  return { ok: true as const, message: "Histórico de notificações limpo." };
}

export async function saveDashboardPreferences(input: Record<string, boolean>) {
  const entries = Object.entries(input);
  if (!entries.length || entries.length > 30 || entries.some(([key, value]) => key.length > 80 || typeof value !== "boolean")) {
    return { ok: false as const, message: "Preferências inválidas." };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };

  const { error } = await supabase.from("configuracoes").upsert({
    chave: "painel_preferencias",
    valor: input,
    visivel_cliente: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "chave" });
  if (error) return { ok: false as const, message: "Não foi possível salvar as preferências." };
  revalidatePath("/");
  return { ok: true as const, message: "Configurações salvas no sistema." };
}

export async function createReport(input: { clientId: string; title: string; type: "atendimento"|"pendencias"; format: "essencial"|"completo"; problem: string; solution: string; workDone: string }) {
  const payload = { clientId: input.clientId.trim(), title: input.title.trim().slice(0,180), type: input.type === "pendencias" ? "pendencias" as const : "atendimento" as const, format: input.format === "essencial" ? "essencial" as const : "completo" as const, problem: input.problem.trim().slice(0,5000), solution: input.solution.trim().slice(0,5000), workDone: input.workDone.trim().slice(0,5000) };
  if (!payload.clientId || payload.title.length < 3 || payload.problem.length < 5) return { ok: false as const, message: "Selecione o cliente e descreva o caso antes de salvar." };
  const supabase = await createClient(); if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims(); const userId=claims?.claims?.sub; if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const [{ data: staff }, { data: client }, { data: config }] = await Promise.all([supabase.from("staff").select("id,name,nome").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id,name,cpf").eq("id",payload.clientId).maybeSingle(),supabase.from("configuracoes").select("valor").eq("chave","perfil_contador").maybeSingle()]);
  if (!staff) return { ok: false as const, message: "Ação não autorizada." }; if (!client) return { ok: false as const, message: "Cliente não encontrado." };
  const professional=config?.valor&&typeof config.valor==="object"&&!Array.isArray(config.valor)?config.valor as Record<string,unknown>:{};
  const { data: report, error } = await supabase.from("relatorios").insert({ cliente_ref: client.id, cliente_nome: client.name, cliente_cpf: client.cpf, titulo: payload.title, tipo_relatorio: payload.type, formato: payload.format, problema: payload.problem, solucao: payload.solution||null, oque_feito: payload.workDone||null, contador_nome: typeof professional.name==="string"?professional.name:(staff.nome||staff.name), contador_crc: typeof professional.crc==="string"?professional.crc:null, contador_logo: typeof professional.logoDataUrl==="string"?professional.logoDataUrl:null, contador_assinatura: typeof professional.assinaturaDataUrl==="string"?professional.assinaturaDataUrl:null, status: "rascunho", updated_at: new Date().toISOString() }).select("id").single();
  if (error||!report) return { ok: false as const, message: "Não foi possível criar o relatório." }; revalidatePath("/"); return { ok: true as const, id: report.id, message: "Relatório salvo como rascunho com a identidade profissional." };
}

export async function changeChatStage(input: { clientId:string; action:"followup"|"finish"; elapsedSeconds?:number }) {
  if (!input.clientId) return { ok:false as const, message:"Selecione um atendimento." };
  const supabase=await createClient(); if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims(); const userId=claims?.claims?.sub; if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const [{data:staff},{data:client}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id,name,tax_type,honorarios,created_at,notas").eq("id",input.clientId).maybeSingle()]);
  if(!staff)return {ok:false as const,message:"Ação não autorizada."}; if(!client)return {ok:false as const,message:"Cliente não encontrado."};
  const now=new Date(); const finish=input.action==="finish";
  if(finish){const {data:first}=await supabase.from("mensagens").select("created_at").eq("cliente_id",client.id).eq("sender","client").order("created_at",{ascending:true}).limit(1).maybeSingle(); const started=new Date(first?.created_at||client.created_at||now.toISOString()); const duration=Math.max(Number(input.elapsedSeconds)||0,Math.round((now.getTime()-started.getTime())/1000)); const {error:historyError}=await supabase.from("atendimentos_historico").insert({cliente_id:client.id,cliente_nome:client.name,tax_type:client.tax_type,honorarios:client.honorarios||0,iniciado_em:started.toISOString(),duracao_segundos:duration,notas:client.notas||null,modalidade:"atendimento"}); if(historyError)return {ok:false as const,message:"Não foi possível registrar o histórico; o chat permaneceu aberto."};}
  const status=finish?"locked":"pending"; const {error}=await supabase.from("clientes").update(finish?{status,ultimo_atendimento_finalizado_em:now.toISOString(),notas:null}:{status}).eq("id",client.id); if(error)return {ok:false as const,message:"Não foi possível atualizar a etapa do atendimento."};
  const text=finish?"Conversa encerrada. O resultado e o relatório estão sendo preparados.":"Caso encaminhado para acompanhamento."; await supabase.from("mensagens").insert({id:crypto.randomUUID(),cliente_id:client.id,sender:"system",text,type:"system",created_at:now.toISOString(),time:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}).format(now)});
  revalidatePath("/"); return {ok:true as const,locked:finish,message:finish?"Conversa encerrada e registrada no histórico.":"Cliente encaminhado para acompanhamento."};
}

export type ServicePlanInput = { id?:string; name:string; description:string; priceCents:number; recurrence:"avulso"|"monthly"; active:boolean; prazoExpressDiasUteis:number; itens:Array<{titulo:string;resumo:string}> };

function serviceSlug(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"servico";}

export async function saveServicePlan(input:ServicePlanInput){
  const supabase=await createClient(); if(!supabase)return {ok:false as const,message:"Conexão indisponível."}; const {data:claims}=await supabase.auth.getClaims(); const userId=claims?.claims?.sub; if(!userId)return {ok:false as const,message:"Sessão expirada."}; const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle(); if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const name=input.name.trim().slice(0,120); const price=Math.round(Number(input.priceCents)||0); if(name.length<3||price<100)return {ok:false as const,message:"Informe nome e valor mínimo de R$ 1,00."}; const itens=input.itens.map((item,index)=>({id:serviceSlug(item.titulo)||`item-${index+1}`,titulo:item.titulo.trim().slice(0,180),resumo:item.resumo.trim().slice(0,400)})).filter(item=>item.titulo).slice(0,30); const payload={name,description:input.description.trim().slice(0,500)||null,price_cents:price,recurrence:input.recurrence==="monthly"?"monthly":"avulso",active:Boolean(input.active),prazo_express_dias_uteis:Math.min(10,Math.max(1,Math.round(Number(input.prazoExpressDiasUteis)||2))),itens};
  let id=input.id?.trim(); if(!id){const base=serviceSlug(name);id=base;let suffix=1;while((await supabase.from("servicos").select("id").eq("id",id).maybeSingle()).data){suffix+=1;id=`${base}-${suffix}`;}}
  const query=input.id?supabase.from("servicos").update(payload).eq("id",id):supabase.from("servicos").insert({...payload,id}); const {data,error}=await query.select("*").single(); if(error||!data)return {ok:false as const,message:"Não foi possível salvar o plano."}; revalidatePath("/"); return {ok:true as const,data,message:"Plano salvo e checkout atualizado."};
}

export async function deleteServicePlan(id:string){const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {count}=await supabase.from("cobrancas").select("id",{count:"exact",head:true}).eq("servico_id",id);if(count)return {ok:false as const,message:`Este plano possui ${count} cobrança(s). Pause o plano em vez de excluir.`};const {error}=await supabase.from("servicos").delete().eq("id",id);if(error)return {ok:false as const,message:"Não foi possível excluir o plano."};revalidatePath("/");return {ok:true as const,message:"Plano excluído."};}

function creditCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const bytes=crypto.getRandomValues(new Uint8Array(10));return `OC-${Array.from(bytes,value=>chars[value%chars.length]).join("")}`;}
export async function createServiceCredit(input:{valueCents:number;note:string;expiresAt?:string}){const value=Math.round(Number(input.valueCents)||0);if(value<100)return {ok:false as const,message:"O crédito mínimo é R$ 1,00."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id,email").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};let code=creditCode();for(let attempt=0;attempt<4;attempt++){if(!(await supabase.from("creditos").select("id").eq("codigo",code).maybeSingle()).data)break;code=creditCode();}const expires=input.expiresAt?new Date(`${input.expiresAt}T23:59:59-03:00`).toISOString():new Date(Date.now()+90*86400000).toISOString();const {data,error}=await supabase.from("creditos").insert({codigo:code,valor_cents:value,observacao:input.note.trim().slice(0,500)||null,criado_por:staff.email,expira_em:expires}).select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível gerar o crédito."};revalidatePath("/");return {ok:true as const,data,message:`Crédito ${code} gerado.`};}
export async function cancelServiceCredit(id:number){const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id,email").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {error}=await supabase.from("creditos").update({status:"cancelado",cancelado_em:new Date().toISOString(),cancelado_por:staff.email}).eq("id",id).eq("status","ativo");if(error)return {ok:false as const,message:"Não foi possível cancelar o crédito."};revalidatePath("/");return {ok:true as const,message:"Crédito cancelado."};}

export async function saveAgendaAvailability(input:{times:string[];blockedDays:string[]}){const times=Array.from(new Set(input.times.filter(value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))).sort().slice(0,30);const blocked=Array.from(new Set(input.blockedDays.filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)))).sort().slice(0,365);if(!times.length)return {ok:false as const,message:"Mantenha ao menos um horário disponível."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const now=new Date().toISOString();const {error}=await supabase.from("configuracoes").upsert([{chave:"agenda_disponibilidade",valor:times,visivel_cliente:true,updated_at:now},{chave:"agenda_dias_bloqueados",valor:blocked,visivel_cliente:true,updated_at:now}],{onConflict:"chave"});if(error)return {ok:false as const,message:"Não foi possível salvar a disponibilidade."};revalidatePath("/");return {ok:true as const,message:"Disponibilidade atualizada no agendamento público."};}

export async function createManualAppointment(input:{clientId?:string;clientName:string;taxType:string;date:string;time:string}){if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!/^\d{2}:\d{2}$/.test(input.time)||input.clientName.trim().length<2)return {ok:false as const,message:"Preencha contribuinte, data e horário."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {data:conflict}=await supabase.from("agendamentos").select("id").eq("date",input.date).eq("time",input.time).neq("status","done").limit(1).maybeSingle();if(conflict)return {ok:false as const,message:"Este horário já está ocupado."};const {data,error}=await supabase.from("agendamentos").insert({cliente_ref:input.clientId||null,client_name:input.clientName.trim().slice(0,120),tax_type:input.taxType.trim().slice(0,120)||null,date:input.date,time:input.time,status:"pending"}).select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível criar o agendamento."};revalidatePath("/");return {ok:true as const,data,message:"Consulta adicionada à agenda."};}

export async function updateAppointmentStatus(id:number,status:"pending"|"confirmed"|"done"|"cancelled"){const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {error}=await supabase.from("agendamentos").update({status}).eq("id",id);if(error)return {ok:false as const,message:"Não foi possível atualizar a consulta."};revalidatePath("/");return {ok:true as const,message:"Status da consulta atualizado."};}

export async function deleteAppointment(id:number){if(!Number.isInteger(id)||id<=0)return {ok:false as const,message:"Agendamento inválido."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {error}=await supabase.from("agendamentos").delete().eq("id",id);if(error)return {ok:false as const,message:"Não foi possível excluir a consulta."};revalidatePath("/");return {ok:true as const,message:"Agendamento excluído."};}

export type CompleteReportInput={reportId?:number;clientId:string;title:string;type:"atendimento"|"pendencias";format:"essencial"|"completo";problem:string;solution:string;workDone:string;howDone:string;pendingIssues:string;deliverables:string;status:"rascunho"|"entrega_pendente"|"arquivado_interno"};
export async function saveCompleteReport(input:CompleteReportInput){const required=[input.clientId,input.title,input.problem,input.solution,input.workDone];if(required.some(value=>String(value||"").trim().length<3))return {ok:false as const,message:"Complete cliente, título, problema, solução e providências."};if(input.type==="pendencias"&&input.pendingIssues.trim().length<3)return {ok:false as const,message:"Descreva as pendências levantadas."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:client},{data:config}]=await Promise.all([supabase.from("staff").select("id,name,nome").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id,name,cpf").eq("id",input.clientId).maybeSingle(),supabase.from("configuracoes").select("valor").eq("chave","perfil_contador").maybeSingle()]);if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(!client)return {ok:false as const,message:"Cliente não encontrado."};const professional=config?.valor&&typeof config.valor==="object"&&!Array.isArray(config.valor)?config.valor as Record<string,unknown>:{};if(input.status==="entrega_pendente"&&(!professional.crc||!professional.assinaturaDataUrl))return {ok:false as const,message:"Complete CRC e assinatura no perfil antes de validar a entrega."};const patch={cliente_ref:client.id,cliente_nome:client.name,cliente_cpf:client.cpf,titulo:input.title.trim().slice(0,180),tipo_relatorio:input.type,formato:input.format,problema:input.problem.trim().slice(0,5000),solucao:input.solution.trim().slice(0,5000),oque_feito:input.workDone.trim().slice(0,5000),como_feito:input.howDone.trim().slice(0,5000)||null,pendencias:input.pendingIssues.trim().slice(0,5000)||null,entregas:input.deliverables.trim().slice(0,3000)||null,contador_nome:typeof professional.name==="string"?professional.name:(staff.nome||staff.name),contador_crc:typeof professional.crc==="string"?professional.crc:null,contador_logo:typeof professional.logoDataUrl==="string"?professional.logoDataUrl:null,contador_assinatura:typeof professional.assinaturaDataUrl==="string"?professional.assinaturaDataUrl:null,status:input.status,updated_at:new Date().toISOString()};const query=input.reportId?supabase.from("relatorios").update(patch).eq("id",input.reportId).neq("status","entregue"):supabase.from("relatorios").insert(patch);const {data,error}=await query.select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível salvar o relatório."};revalidatePath("/");return {ok:true as const,data,message:input.status==="arquivado_interno"?"Relatório arquivado sem encerrar o caso.":input.status==="entrega_pendente"?"Relatório validado e pronto para entrega.":"Rascunho salvo."};}

export type ManualAttachmentType="link"|"guia"|"protocolo"|"comprovante"|"outro";
export async function addManualReportAttachment(input:{reportId:number;titulo:string;url:string;tipo:ManualAttachmentType;visibleToClient:boolean}){
  const titulo=input.titulo.trim().slice(0,180);const url=input.url.trim().slice(0,500);
  if(!titulo||!url)return {ok:false as const,message:"Informe título e link do anexo."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const {data:report}=await supabase.from("relatorios").select("id,cliente_ref,status,caso_ref").eq("id",input.reportId).maybeSingle();
  if(!report)return {ok:false as const,message:"Relatório não encontrado."};
  if(report.status==="entregue")return {ok:false as const,message:"Crie uma revisão para alterar anexos de um relatório entregue."};
  const patch={relatorio_id:report.id,cliente_ref:report.cliente_ref,caso_ref:report.caso_ref,documento_id:null,titulo,tipo:input.tipo,url,visivel_cliente:Boolean(input.visibleToClient),created_by:userId};
  const {data,error}=await supabase.from("relatorio_anexos").insert(patch).select("*").single();
  if(error||!data)return {ok:false as const,message:"Não foi possível adicionar o anexo."};
  revalidatePath("/");return {ok:true as const,data,message:"Anexo adicionado ao relatório."};
}

export async function removeManualReportAttachment(attachmentId:number){
  if(!Number.isInteger(attachmentId)||attachmentId<=0)return {ok:false as const,message:"Anexo inválido."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const {error}=await supabase.from("relatorio_anexos").delete().eq("id",attachmentId).is("documento_id",null);
  if(error)return {ok:false as const,message:"Não foi possível remover o anexo."};
  revalidatePath("/");return {ok:true as const,message:"Anexo removido."};
}

export async function createReportRevision(reportId:number){if(!Number.isInteger(reportId)||reportId<=0)return {ok:false as const,message:"Relatório inválido."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:source}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("relatorios").select("*").eq("id",reportId).maybeSingle()]);if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(!source)return {ok:false as const,message:"Relatório não encontrado."};const rootId=source.revisao_de||source.id;const {data:latest}=await supabase.from("relatorios").select("versao").or(`id.eq.${rootId},revisao_de.eq.${rootId}`).order("versao",{ascending:false}).limit(1).maybeSingle();const nextVersion=Math.max(1,Number(latest?.versao)||Number(source.versao)||1)+1;const {data,error}=await supabase.from("relatorios").insert({cliente_ref:source.cliente_ref,cliente_nome:source.cliente_nome,cliente_cpf:source.cliente_cpf,titulo:source.titulo,tipo_relatorio:source.tipo_relatorio,formato:source.formato,problema:source.problema,solucao:source.solucao,oque_feito:source.oque_feito,como_feito:source.como_feito,pendencias:source.pendencias,entregas:source.entregas,proximos_passos:source.proximos_passos,responsavel_proximo_passo:source.responsavel_proximo_passo,prazo_proximo_passo:source.prazo_proximo_passo,contador_nome:source.contador_nome,contador_crc:source.contador_crc,contador_logo:source.contador_logo,contador_assinatura:source.contador_assinatura,caso_ref:source.caso_ref,agendamento_id:source.agendamento_id,atendimento_express_id:source.atendimento_express_id,revisao_de:rootId,versao:nextVersion,status:"rascunho",updated_at:new Date().toISOString()}).select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível criar a revisão."};revalidatePath("/");return {ok:true as const,data,message:`Revisão ${data.versao} criada sem alterar o documento entregue.`};}

export type ClientDossierInput={id:string;name:string;cpf:string;email:string;phone:string;status:string;taxType:string;regimeTributario:string;sexo:string;cep:string;endereco:string;numero:string;bairro:string;cidade:string;estado:string;canalResultado:string;diagnosis:string;treatment:string;honorarios:number;notas:string;checklist:Record<string,boolean>;evidences:Array<{id:string;text:string;selected:boolean}>};
export async function saveClientDossier(input:ClientDossierInput){
  if(!input.id||input.name.trim().length<2)return {ok:false as const,message:"Revise o nome e o cadastro do cliente."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const checklist=Object.fromEntries(Object.entries(input.checklist).filter(([key,value])=>key.trim()&&key.length<=120&&typeof value==="boolean").slice(0,60));const evidences=input.evidences.filter(item=>item.text.trim()).slice(0,60).map(item=>({id:item.id.slice(0,40)||crypto.randomUUID(),text:item.text.trim().slice(0,300),selected:Boolean(item.selected)}));
  const payload={name:input.name.trim().replace(/\s+/g," ").slice(0,120),cpf:input.cpf.replace(/[^\d]/g,"").slice(0,14)||null,email:input.email.trim().slice(0,180)||null,phone:input.phone.trim().slice(0,40)||null,status:input.status.trim().slice(0,40)||"waiting",tax_type:input.taxType.trim().slice(0,120)||null,regime_tributario:input.regimeTributario.trim().slice(0,120)||null,sexo:input.sexo.trim().slice(0,40)||null,cep:input.cep.trim().slice(0,12)||null,endereco:input.endereco.trim().slice(0,180)||null,numero:input.numero.trim().slice(0,30)||null,bairro:input.bairro.trim().slice(0,120)||null,cidade:input.cidade.trim().slice(0,120)||null,estado:input.estado.trim().toUpperCase().slice(0,2)||null,canal_resultado:input.canalResultado.trim().slice(0,40)||"area_cliente",diagnosis:input.diagnosis.trim().slice(0,500)||null,treatment:input.treatment.trim().slice(0,8000)||null,honorarios:Math.max(0,Number(input.honorarios)||0),notas:input.notas.trim().slice(0,12000)||null,checklist,evidences};
  const {data,error}=await supabase.from("clientes").update(payload).eq("id",input.id).select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível salvar o prontuário completo."};revalidatePath("/");return {ok:true as const,data,message:"Cadastro e prontuário salvos."};
}

export async function persistClientChecklist(input:{clientId:string;checklist:Record<string,boolean>}){
  if(!input.clientId)return {ok:false as const,message:"Cliente inválido."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const checklist=Object.fromEntries(Object.entries(input.checklist).filter(([key,value])=>key.trim()&&key.length<=120&&typeof value==="boolean").slice(0,60));
  const {error}=await supabase.from("clientes").update({checklist}).eq("id",input.clientId);
  if(error)return {ok:false as const,message:"Não foi possível salvar o checklist."};
  revalidatePath("/");
  return {ok:true as const,message:"Checklist salvo."};
}

export async function assignClientResponsavel(input:{clientId:string;responsavelId:string|null}){
  if(!input.clientId)return {ok:false as const,message:"Cliente inválido."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const {error}=await supabase.from("clientes").update({responsavel_id:input.responsavelId}).eq("id",input.clientId);
  if(error)return {ok:false as const,message:"Não foi possível atribuir o responsável."};
  revalidatePath("/");
  return {ok:true as const,message:input.responsavelId?"Cliente atribuído.":"Responsável removido."};
}

export async function reactivateClient(input:{clientId:string}){
  if(!input.clientId)return {ok:false as const,message:"Cliente inválido."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const {error}=await supabase.from("clientes").update({arquivado_em:null}).eq("id",input.clientId);
  if(error)return {ok:false as const,message:"Não foi possível reativar o cliente."};
  revalidatePath("/");
  return {ok:true as const,message:"Cliente reativado."};
}

export async function persistClientNotes(input:{clientId:string;notas:string}){
  if(!input.clientId)return {ok:false as const,message:"Cliente inválido."};
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};
  const {error}=await supabase.from("clientes").update({notas:input.notas.slice(0,12000)||null}).eq("id",input.clientId);
  if(error)return {ok:false as const,message:"Falha ao salvar — tente novamente."};
  return {ok:true as const,message:"Anotações salvas."};
}

export async function createClientRecord(input:{name:string;cpf:string;email:string;phone:string}){const name=input.name.trim().replace(/\s+/g," ").slice(0,120);const cpf=input.cpf.replace(/[^\d]/g,"").slice(0,14);if(name.length<2)return {ok:false as const,message:"Informe o nome do cliente."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(cpf){const {data:duplicate}=await supabase.from("clientes").select("id").eq("cpf",cpf).maybeSingle();if(duplicate)return {ok:false as const,message:"Já existe um cliente com este CPF/CNPJ."};}const id=crypto.randomUUID();const {data,error}=await supabase.from("clientes").insert({id,name,cpf:cpf||null,email:input.email.trim().slice(0,180)||null,phone:input.phone.trim().slice(0,40)||null,status:"waiting",checklist:{},evidences:[],perfil_operacional:{}}).select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível cadastrar o cliente."};revalidatePath("/");return {ok:true as const,data,message:"Cliente cadastrado."};}

export async function setChatLocked(input:{clientId:string;locked:boolean}){if(!input.clientId)return {ok:false as const,message:"Selecione um atendimento."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const status=input.locked?"locked":"active";const {error}=await supabase.from("clientes").update({status}).eq("id",input.clientId);if(error)return {ok:false as const,message:"Não foi possível alterar o bloqueio."};await supabase.from("mensagens").insert({id:crypto.randomUUID(),cliente_id:input.clientId,sender:"system",text:input.locked?"Chat bloqueado temporariamente pela equipe.":"Chat reaberto pela equipe.",type:"system",created_at:new Date().toISOString()});revalidatePath("/");return {ok:true as const,locked:input.locked,message:input.locked?"Chat bloqueado.":"Chat reaberto."};}

export async function saveChatTimer(input:{clientId:string;elapsedSeconds:number;running:boolean}){
  if(!input.clientId)return {ok:false as const,message:"Selecione um atendimento."};
  const elapsed=Math.max(0,Math.min(7*24*60*60,Math.round(Number(input.elapsedSeconds)||0)));
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};
  const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};
  const [{data:staff},{data:client}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id,perfil_operacional").eq("id",input.clientId).maybeSingle()]);
  if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(!client)return {ok:false as const,message:"Cliente não encontrado."};
  const current=client.perfil_operacional&&typeof client.perfil_operacional==="object"&&!Array.isArray(client.perfil_operacional)?client.perfil_operacional as Record<string,unknown>:{};
  const timer={elapsedSeconds:elapsed,running:Boolean(input.running),updatedAt:new Date().toISOString(),updatedBy:userId};
  const {error}=await supabase.from("clientes").update({perfil_operacional:{...current,chatTimer:timer}}).eq("id",input.clientId);
  if(error)return {ok:false as const,message:"Não foi possível persistir o cronômetro."};
  return {ok:true as const,timer};
}

export async function sendChatTimerWarning(input:{clientId:string;durationMinutes:number;warningMinutes:number}){
  const duration=Math.max(1,Math.min(240,Math.round(Number(input.durationMinutes)||40)));const warning=Math.max(1,Math.min(duration,Math.round(Number(input.warningMinutes)||5)));
  const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:client}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id").eq("id",input.clientId).maybeSingle()]);if(!staff||!client)return {ok:false as const,message:"Ação não autorizada."};
  const text=`Aviso Automático do Sistema: Faltam ${warning} minuto${warning===1?"":"s"} para encerrar o limite padrão deste atendimento (${duration}min).`;
  const since=new Date(Date.now()-12*60*60*1000).toISOString();const {data:existing}=await supabase.from("mensagens").select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").eq("cliente_id",input.clientId).eq("sender","system").eq("text",text).gte("created_at",since).order("created_at",{ascending:false}).limit(1).maybeSingle();if(existing)return {ok:true as const,data:existing,message:"Aviso automático já enviado neste atendimento."};
  const now=new Date();const {data,error}=await supabase.from("mensagens").insert({id:crypto.randomUUID(),cliente_id:input.clientId,sender:"system",text,type:"system",created_at:now.toISOString(),time:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}).format(now)}).select("id,cliente_id,sender,text,type,read_at,created_at,time,seq,doc_name,duration,transcricao,canal,wa_status").single();if(error||!data)return {ok:false as const,message:"Não foi possível enviar o aviso automático."};revalidatePath("/");return {ok:true as const,data,message:"Aviso automático enviado."};
}

const configurableKeys=new Set(["timer_config","radar_fiscal_config","radar_fiscal_clientes","triagem_config","triagem_regras","triagem_assuntos","nfse_config","nota_fiscal_config","ia_skills","chat_appearance","chat_shortcuts","copilot_shortcuts","area_cliente_config","painel_preferencias","tarefas"]);
export async function saveSystemSetting(input:{key:string;value:unknown;visibleToClient?:boolean}){if(!configurableKeys.has(input.key))return {ok:false as const,message:"Configuração não permitida."};let encoded="";try{encoded=JSON.stringify(input.value);}catch{return {ok:false as const,message:"Conteúdo inválido."};}if(encoded.length>100_000)return {ok:false as const,message:"A configuração excede o limite permitido."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {error}=await supabase.from("configuracoes").upsert({chave:input.key,valor:input.value as never,visivel_cliente:Boolean(input.visibleToClient),updated_at:new Date().toISOString()},{onConflict:"chave"});if(error)return {ok:false as const,message:"Não foi possível salvar a configuração."};revalidatePath("/");return {ok:true as const,message:"Configuração salva e sincronizada."};}

export async function markMailThreadRead(clientId:string){if(!clientId)return {ok:false as const,message:"Cliente inválido."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const {data:staff}=await supabase.from("staff").select("id").eq("id",userId).maybeSingle();if(!staff)return {ok:false as const,message:"Ação não autorizada."};const {error}=await supabase.from("caixa_postal").update({lida:true}).eq("cliente_ref",clientId).eq("remetente","cliente").eq("lida",false);if(error)return {ok:false as const,message:"Não foi possível marcar a conversa."};revalidatePath("/");return {ok:true as const,message:"Conversa marcada como lida."};}

export async function sendMailMessage(input:{clientId:string;subject:string;message:string}){const message=input.message.trim().slice(0,5000);if(!input.clientId||!message)return {ok:false as const,message:"Escolha o cliente e escreva a mensagem."};const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:client}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("clientes").select("id").eq("id",input.clientId).maybeSingle()]);if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(!client)return {ok:false as const,message:"Cliente não encontrado."};const {data,error}=await supabase.from("caixa_postal").insert({cliente_ref:input.clientId,assunto:input.subject.trim().slice(0,180)||null,mensagem:message,remetente:"contador",lida:false}).select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível enviar o aviso."};revalidatePath("/");return {ok:true as const,data,message:"Mensagem enviada para a área do cliente."};}

// Assunto não tem coluna própria — é agrupado pelo texto igual ao resto da
// Caixa Postal (client-views.tsx), então "encerrar" atualiza todas as linhas
// daquele cliente com aquele mesmo assunto (null/"" caem no fallback usado
// pelo cliente, "Outro assunto"). Mandar mensagem nova sempre volta a
// "aberto" (default da coluna), então o cliente reabre um assunto encerrado
// só de escrever de novo — sem essa action.
export async function setCaixaPostalThreadStatus(input: { clientId: string; assunto: string; status: "aberto" | "encerrado" }) {
  if (!input.clientId) return { ok: false as const, message: "Cliente inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { ok: false as const, message: "Ação não autorizada." };
  const semAssunto = !input.assunto || input.assunto === "Outro assunto";
  let query = supabase
    .from("caixa_postal")
    .update({ status: input.status, encerrado_em: input.status === "encerrado" ? new Date().toISOString() : null })
    .eq("cliente_ref", input.clientId);
  query = semAssunto ? query.or("assunto.is.null,assunto.eq.Outro assunto") : query.eq("assunto", input.assunto);
  const { error } = await query;
  if (error) return { ok: false as const, message: "Não foi possível atualizar o assunto." };
  revalidatePath("/");
  return { ok: true as const, message: input.status === "encerrado" ? "Assunto marcado como encerrado." : "Assunto reaberto." };
}

export async function setReportDocument(input:{reportId:number;documentId:number;attached:boolean;visibleToClient:boolean}){const supabase=await createClient();if(!supabase)return {ok:false as const,message:"Conexão indisponível."};const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)return {ok:false as const,message:"Sessão expirada."};const [{data:staff},{data:report},{data:document}]=await Promise.all([supabase.from("staff").select("id").eq("id",userId).maybeSingle(),supabase.from("relatorios").select("id,cliente_ref,status,caso_ref").eq("id",input.reportId).maybeSingle(),supabase.from("documentos").select("id,cliente_ref,file_name,public_url,storage_path").eq("id",input.documentId).maybeSingle()]);if(!staff)return {ok:false as const,message:"Ação não autorizada."};if(!report||!document||report.cliente_ref!==document.cliente_ref)return {ok:false as const,message:"Documento ou relatório inválido."};if(report.status==="entregue")return {ok:false as const,message:"Crie uma revisão para alterar anexos de um relatório entregue."};if(!input.attached){const {error}=await supabase.from("relatorio_anexos").delete().eq("relatorio_id",report.id).eq("documento_id",document.id);if(error)return {ok:false as const,message:"Não foi possível remover o anexo."};revalidatePath("/");return {ok:true as const,message:"Anexo removido."};}const patch={relatorio_id:report.id,cliente_ref:report.cliente_ref,caso_ref:report.caso_ref,documento_id:document.id,titulo:document.file_name,tipo:"arquivo",url:document.public_url,referencia:document.storage_path,visivel_cliente:Boolean(input.visibleToClient),created_by:userId};const {data:existing}=await supabase.from("relatorio_anexos").select("id").eq("relatorio_id",report.id).eq("documento_id",document.id).maybeSingle();const query=existing?supabase.from("relatorio_anexos").update(patch).eq("id",existing.id):supabase.from("relatorio_anexos").insert(patch);const {data,error}=await query.select("*").single();if(error||!data)return {ok:false as const,message:"Não foi possível vincular o anexo."};revalidatePath("/");return {ok:true as const,data,message:"Documento vinculado ao relatório."};}

export async function markMonthlyGuideGenerated(id: number) {
  if (!Number.isInteger(id) || id <= 0)
    return { ok: false as const, message: "Guia inválida." };
  const supabase = await createClient();
  if (!supabase)
    return { ok: false as const, message: "Conexão indisponível." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId)
    return { ok: false as const, message: "Sessão expirada." };
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!staff)
    return { ok: false as const, message: "Ação não autorizada." };
  const { data, error } = await supabase
    .from("guias_mensais")
    .update({ status: "gerada", gerada_em: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "gerada")
    .select("id")
    .maybeSingle();
  if (error)
    return { ok: false as const, message: "Não foi possível marcar a guia." };
  revalidatePath("/");
  return {
    ok: true as const,
    data,
    message: data ? "Guia marcada como gerada." : "A guia já estava concluída.",
  };
}

async function staffContext() {
  const supabase = await createClient();
  if (!supabase) return { error: { ok: false as const, message: "Conexão indisponível." } };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: { ok: false as const, message: "Sessão expirada." } };
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return { error: { ok: false as const, message: "Ação não autorizada." } };
  return { supabase, userId };
}

export async function createTask(input: { texto: string; dataInicial: string; dataFinal: string }) {
  const texto = input.texto.trim().slice(0, 240);
  if (!texto || !input.dataInicial || !input.dataFinal)
    return { ok: false as const, message: "Preencha o texto e as datas da tarefa." };
  const ctx = await staffContext();
  if (ctx.error) return ctx.error;
  const { data, error } = await ctx.supabase
    .from("tarefas")
    .insert({ texto, data_inicial: input.dataInicial, data_final: input.dataFinal, criado_por: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, message: "Não foi possível criar a tarefa." };
  await ctx.supabase.from("tarefas_historico").insert({ tarefa_id: data.id, ator_id: ctx.userId, evento: "criada" });
  revalidatePath("/");
  return { ok: true as const, message: "Tarefa criada." };
}

export async function toggleTask(id: string, feita: boolean) {
  if (!id) return { ok: false as const, message: "Tarefa inválida." };
  const ctx = await staffContext();
  if (ctx.error) return ctx.error;
  const { error } = await ctx.supabase.from("tarefas").update({ feita, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, message: "Não foi possível atualizar a tarefa." };
  await ctx.supabase.from("tarefas_historico").insert({ tarefa_id: id, ator_id: ctx.userId, evento: feita ? "concluida" : "reaberta" });
  revalidatePath("/");
  return { ok: true as const, message: feita ? "Tarefa concluída." : "Tarefa reaberta." };
}

export async function reassignTask(id: string, responsavelId: string | null) {
  if (!id) return { ok: false as const, message: "Tarefa inválida." };
  const ctx = await staffContext();
  if (ctx.error) return ctx.error;
  const { data: atual } = await ctx.supabase.from("tarefas").select("responsavel_id").eq("id", id).maybeSingle();
  const { error } = await ctx.supabase.from("tarefas").update({ responsavel_id: responsavelId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, message: "Não foi possível mover a tarefa." };
  await ctx.supabase.from("tarefas_historico").insert({
    tarefa_id: id,
    ator_id: ctx.userId,
    evento: "reatribuida",
    de_responsavel_id: atual?.responsavel_id ?? null,
    para_responsavel_id: responsavelId,
  });
  revalidatePath("/");
  return { ok: true as const, message: "Tarefa movida." };
}

// Soft-delete: a linha continua existindo (só marcada excluida=true), porque
// tarefas_historico referencia tarefa_id com ON DELETE CASCADE — apagar a
// tarefa de verdade apagaria o próprio registro de auditoria da exclusão.
export async function deleteTask(id: string) {
  if (!id) return { ok: false as const, message: "Tarefa inválida." };
  const ctx = await staffContext();
  if (ctx.error) return ctx.error;
  const { error } = await ctx.supabase.from("tarefas").update({ excluida: true, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, message: "Não foi possível excluir a tarefa." };
  await ctx.supabase.from("tarefas_historico").insert({ tarefa_id: id, ator_id: ctx.userId, evento: "excluida" });
  revalidatePath("/");
  return { ok: true as const, message: "Tarefa excluída." };
}
