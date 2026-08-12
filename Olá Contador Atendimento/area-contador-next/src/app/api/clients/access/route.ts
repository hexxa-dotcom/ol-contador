import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { validarCpfCnpj } from "@/lib/documento";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

type AccessAction = "criar" | "resetar_senha";
type AccessPayload = {
  name?: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  senha?: string;
  clientId?: string;
  novaSenha?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Apenas a equipe pode gerenciar clientes." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    action?: AccessAction;
    payload?: AccessPayload;
  } | null;
  if (!body?.action || !["criar", "resetar_senha"].includes(body.action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  try {
    if (body.action === "criar") {
      const { name, cpfCnpj, email, phone, senha } = body.payload || {};
      if (!String(name || "").trim() || !String(email || "").includes("@")) {
        return NextResponse.json({ error: "Informe nome e e-mail válidos." }, { status: 400 });
      }
      if (senha && senha.length < 6) {
        return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
      }
      const { valido, digitos } = validarCpfCnpj(cpfCnpj);
      if (!valido) return NextResponse.json({ error: "cpf_cnpj_invalido" }, { status: 400 });

      const { data: existente } = await admin.from("clientes").select("id").eq("id", digitos).maybeSingle();
      if (existente) return NextResponse.json({ error: "Já existe um cliente com esse CPF/CNPJ." }, { status: 400 });

      const { data: novoUser, error: authError } = await admin.auth.admin.createUser({
        email: email!,
        password: senha || undefined,
        email_confirm: true,
      });
      if (authError) {
        if (/already.*registered|already exists/i.test(authError.message)) {
          return NextResponse.json({ error: "Este e-mail já possui uma conta." }, { status: 400 });
        }
        throw authError;
      }

      const { error: insertError } = await admin.from("clientes").insert({
        id: digitos,
        name: name!,
        cpf: digitos,
        email: email!,
        phone: phone || null,
        status: "pending",
        user_id: novoUser.user.id,
      });
      if (insertError) {
        // Rollback manual: não há transação cross-serviço entre Auth e a tabela.
        await admin.auth.admin.deleteUser(novoUser.user.id);
        throw insertError;
      }

      return NextResponse.json({ ok: true, clientId: digitos });
    }

    // resetar_senha
    const { clientId, novaSenha } = body.payload || {};
    if (!clientId || String(novaSenha || "").length < 6) {
      return NextResponse.json({ error: "Informe uma senha com pelo menos 6 caracteres." }, { status: 400 });
    }
    const { data: cliente } = await admin.from("clientes").select("id,email,user_id").eq("id", clientId).single();
    if (!cliente) return NextResponse.json({ error: "cliente_not_found" }, { status: 404 });

    if (!cliente.user_id) {
      if (!cliente.email) return NextResponse.json({ error: "cliente_sem_email" }, { status: 400 });
      const { data: novoUser, error: authError } = await admin.auth.admin.createUser({
        email: cliente.email,
        password: novaSenha,
        email_confirm: true,
      });
      if (authError) throw authError;
      await admin.from("clientes").update({ user_id: novoUser.user.id }).eq("id", clientId);
    } else {
      const { error: updateError } = await admin.auth.admin.updateUserById(cliente.user_id, {
        password: novaSenha,
      });
      if (updateError) throw updateError;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, {
      origem: "clients_access_route",
      codigo: "client_access_failed",
      mensagem: err.message,
      rota: "/api/clients/access",
      severidade: "erro",
      contexto: { action: body.action },
    });
    return NextResponse.json({ error: "client_access_failed", detail: err.message }, { status: 502 });
  }
}
