import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { validarCpfCnpj } from "@/lib/documento";
import { checarRateLimit } from "@/lib/rateLimit";
import { registrarEventoFunil } from "@/lib/metricas";
import { enviarLinkDeAcesso, gerarAutoLogin, registrarAtendimentoExpress } from "@/lib/pagamento";
import * as notify from "@/lib/notify";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

const LIMITE_RESUMO = 150;

function nowTime(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// POST /api/checkout/redeem — resgate público (sem login) de um crédito de
// atendimento gerado pelo contador. Mesmo formulário do /api/checkout, mas
// sem Asaas: o crédito já cobre o valor, então o cliente cai direto
// confirmado no sistema, sem passar pelo pagamento.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    codigo?: string;
    name?: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
    sexo?: string;
    cidade?: string;
    estado?: string;
    servicoId?: string;
    date?: string;
    time?: string;
    summary?: string;
    assunto?: string;
    modalidade?: string;
  } | null;
  if (!body?.codigo || !body.name || !body.email || !body.phone || !body.servicoId) return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  const { valido, digitos } = validarCpfCnpj(body.cpfCnpj);
  if (!valido) return NextResponse.json({ error: "cpf_cnpj_invalido" }, { status: 400 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  // Limite mais apertado aqui: esse endpoint testa um código contra o banco,
  // então é o alvo natural de uma tentativa de força bruta.
  if (!(await checarRateLimit(admin, request, "resgatar-credito", 10, 15))) {
    return NextResponse.json({ error: "muitas_tentativas", detail: "Tente de novo em alguns minutos." }, { status: 429 });
  }

  const { data: credito } = await admin.from("creditos").select("*").eq("codigo", body.codigo.trim().toUpperCase()).maybeSingle();
  if (!credito) return NextResponse.json({ error: "credito_not_found" }, { status: 404 });
  if (credito.status !== "ativo") return NextResponse.json({ error: "credito_indisponivel" }, { status: 410 });
  if (credito.expira_em && new Date(credito.expira_em) <= new Date()) return NextResponse.json({ error: "credito_expirado" }, { status: 410 });

  const { data: servico } = await admin.from("servicos").select("*").eq("id", body.servicoId).single();
  if (!servico) return NextResponse.json({ error: "servico_not_found" }, { status: 404 });
  if (servico.price_cents > credito.valor_cents) return NextResponse.json({ error: "credito_insuficiente" }, { status: 400 });
  const modo = body.modalidade === "sem_agendamento" ? "sem_agendamento" : "agendado";
  const canal = "email";
  if (modo === "agendado" && (!body.date || !body.time)) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  try {
    const clientId = digitos;
    const { data: existente } = await admin.from("clientes").select("*").eq("id", clientId).maybeSingle();
    if (!existente) {
      // onboarding_pendente aciona a triagem obrigatória no primeiro login —
      // só em clientes novos, mesmo critério do /api/checkout.
      const { error: erroInsert } = await admin.from("clientes").insert({
        id: clientId,
        name: body.name,
        cpf: digitos,
        email: body.email,
        phone: body.phone,
        sexo: body.sexo || null,
        cidade: body.cidade || null,
        estado: body.estado || null,
        tax_type: servico.name,
        honorarios: Math.round(servico.price_cents / 100),
        status: "pending",
        onboarding_pendente: true,
        atendimento_modalidade: modo,
        canal_resultado: canal,
        sem_agendamento_recebido_em: modo === "sem_agendamento" ? new Date().toISOString() : null,
      });
      if (erroInsert) throw erroInsert;
    } else {
      // Cliente já existia. NUNCA sobrescreve contato já cadastrado a partir
      // do que foi digitado agora: um código de crédito não prova que quem
      // está resgatando é o dono do CPF — sobrescrever e-mail/telefone aqui
      // seria um jeito trivial de herdar o login automático de outra pessoa.
      // Só completa o que ainda estiver vazio.
      const baseUpdate: Record<string, unknown> = {
        atendimento_modalidade: modo,
        canal_resultado: canal,
        sem_agendamento_recebido_em: modo === "sem_agendamento" ? new Date().toISOString() : null,
      };
      if (modo === "sem_agendamento") baseUpdate.onboarding_pendente = true;
      if (!existente.email && body.email) baseUpdate.email = body.email;
      if (!existente.phone && body.phone) baseUpdate.phone = body.phone;
      if (!existente.sexo && body.sexo) baseUpdate.sexo = body.sexo;
      if (!existente.cidade && body.cidade) baseUpdate.cidade = body.cidade;
      if (!existente.estado && body.estado) baseUpdate.estado = body.estado;
      await admin
        .from("clientes")
        .update(baseUpdate as never)
        .eq("id", clientId);
    }
    // A conta de acesso e o login automático sempre usam o e-mail que ficou
    // no banco (o já cadastrado, se havia um) — nunca o que veio agora no
    // formulário, pelo mesmo motivo acima.
    const emailParaAcesso = existente?.email || body.email;
    // O assunto sozinho já diz do que se trata, então a triagem é criada
    // mesmo sem descrição. Status 'rascunho': é só um pré-preenchimento, o
    // cliente ainda precisa passar pela triagem de verdade.
    if (body.assunto || body.summary) {
      await admin.from("triagens").insert({
        cliente_ref: clientId,
        assunto: body.assunto || servico.name,
        descricao: body.summary ? String(body.summary).slice(0, LIMITE_RESUMO) : null,
        status: "rascunho",
      });
    }

    let appt: { id: number } | null = null;
    if (modo === "agendado") {
      const { data } = await admin
        .from("agendamentos")
        .insert({ cliente_ref: clientId, client_name: body.name, date: body.date!, time: body.time!, tax_type: servico.name, status: "pending" })
        .select()
        .single();
      appt = data || null;
    }

    const { data: cob, error: erroCob } = await admin
      .from("cobrancas")
      .insert({
        cliente_ref: clientId,
        servico_id: body.servicoId,
        valor_cents: servico.price_cents,
        valor_original_cents: servico.price_cents,
        desconto_cents: 0,
        desconto_tipo: "credito_atendimento",
        origem: "credito",
        status: "paid",
        billing_type: "CREDITO",
        paid_at: new Date().toISOString(),
        appt_date: modo === "agendado" ? body.date : null,
        appt_time: modo === "agendado" ? body.time : null,
        appointment_id: appt ? appt.id : null,
        modalidade: modo,
        canal_resultado: canal,
      })
      .select()
      .single();
    if (erroCob) throw erroCob;

    if (modo === "sem_agendamento") {
      await registrarAtendimentoExpress(admin, {
        cobrancaId: cob.id,
        clienteRef: clientId,
        servicoId: body.servicoId,
        assunto: body.assunto || servico.name,
        prazoDiasUteis: servico.prazo_express_dias_uteis,
        contratadoEm: cob.paid_at || new Date(),
      });
    }

    const { data: creditoConsumido, error: erroConsumo } = await admin
      .from("creditos")
      .update({ status: "usado", usado_em: new Date().toISOString(), cliente_ref: clientId, cobranca_id: cob.id })
      .eq("id", credito.id)
      .eq("status", "ativo")
      .select("id")
      .maybeSingle();
    if (erroConsumo || !creditoConsumido) {
      await admin.from("cobrancas").delete().eq("id", cob.id);
      if (appt) await admin.from("agendamentos").delete().eq("id", appt.id);
      throw new Error("credito_ja_utilizado");
    }
    await registrarEventoFunil(admin, "credito_resgatado", { cobrancaId: cob.id, clienteRef: clientId, servicoId: body.servicoId, origem: "credito", metadata: { codigo: credito.codigo } });
    await registrarEventoFunil(admin, "pagamento_confirmado", { cobrancaId: cob.id, clienteRef: clientId, servicoId: body.servicoId, origem: "credito", metadata: { valorCents: servico.price_cents } });

    await admin.from("notificacoes").insert({
      text:
        modo === "sem_agendamento"
          ? `Crédito resgatado: ${body.name} iniciou Atendimento Express de ${servico.name}.`
          : `Crédito resgatado: ${body.name} agendou ${servico.name} com o código ${credito.codigo}.`,
      time: nowTime(),
      unread: true,
      cliente_ref: clientId,
    });

    if (emailParaAcesso) {
      try {
        const { data: clienteAtual } = await admin.from("clientes").select("user_id").eq("id", clientId).single();
        if (clienteAtual && !clienteAtual.user_id) {
          const { data: novoUser, error: erroAuth } = await admin.auth.admin.createUser({ email: emailParaAcesso, email_confirm: true });
          if (!erroAuth && novoUser?.user) {
            await admin.from("clientes").update({ user_id: novoUser.user.id }).eq("id", clientId);
          } else if (erroAuth) {
            console.error("criação de conta via crédito falhou:", erroAuth.message);
          }
        }
      } catch (e) {
        console.error("criação de conta via crédito falhou:", (e as Error).message);
      }
    }
    if (emailParaAcesso) await enviarLinkDeAcesso(admin, emailParaAcesso);

    // Confirmação é síncrona aqui (sem Asaas no meio), então o login
    // automático já pode voltar nesta mesma resposta — sem precisar de
    // polling como no checkout com Pix/cartão.
    const autoLogin = emailParaAcesso ? await gerarAutoLogin(admin, clientId) : null;

    const { data: clienteParaAviso } = await admin.from("clientes").select("*").eq("id", clientId).single();
    if (clienteParaAviso) {
      void notify.notifyCliente(
        clienteParaAviso,
        modo === "sem_agendamento" ? "Atendimento Express recebido" : "Atendimento confirmado",
        modo === "sem_agendamento"
          ? `Seu atendimento de <strong>${servico.name}</strong> foi recebido. Entre na sua área para concluir a triagem e enviar os documentos.`
          : `Seu atendimento de <strong>${servico.name}</strong> está confirmado para ${body.date} às ${body.time}.`,
        modo === "sem_agendamento" ? { channel: canal } : {}
      );
    }

    return NextResponse.json({
      clientId,
      appointmentId: appt ? appt.id : null,
      servico: { id: servico.id, name: servico.name },
      valor: servico.price_cents / 100,
      status: "confirmado",
      autoLogin,
    });
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, {
      origem: "api/checkout/redeem",
      codigo: "resgate_failed",
      mensagem: err.message,
      rota: "/api/checkout/redeem",
      severidade: "critico",
      contexto: { codigo: body.codigo, servicoId: body.servicoId },
    });
    return NextResponse.json({ error: "resgate_failed", detail: err.message }, { status: 500 });
  }
}
