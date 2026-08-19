import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: current } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!current) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await supabase
    .from("staff")
    .select("id,email,name,nome,role")
    .not("id", "is", null)
    .order("nome");
  if (error) return NextResponse.json({ error: "team_list_failed" }, { status: 400 });
  return NextResponse.json(data || [], { headers: { "Cache-Control": "private, no-store" } });
}

type TeamAction = "listar" | "convidar" | "remover" | "atualizar" | "resetar-senha";
type TeamPayload = {
  id?: string;
  nome?: string;
  email?: string;
  role?: string;
  filaRestrita?: boolean;
  acessoInsightsRadar?: boolean;
};

function gerarSenhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let senha = "";
  for (let i = 0; i < 12; i++) senha += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return senha;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: staff } = await supabase.from("staff").select("id,role").eq("id", userId).maybeSingle();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar a equipe." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: TeamAction;
    payload?: TeamPayload;
  } | null;
  if (!body?.action || !["listar", "convidar", "remover", "atualizar", "resetar-senha"].includes(body.action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  if (
    body.action === "convidar" &&
    (!body.payload?.nome?.trim() ||
      !/^\S+@\S+\.\S+$/.test(body.payload.email || "") ||
      !["admin", "parceiro"].includes(body.payload.role || ""))
  ) {
    return NextResponse.json({ error: "Revise nome, e-mail e permissão." }, { status: 400 });
  }
  if (body.action === "remover" && (!body.payload?.id || body.payload.id === userId)) {
    return NextResponse.json({ error: "Você não pode remover o próprio acesso." }, { status: 400 });
  }
  if (body.action === "atualizar" && !body.payload?.id) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  if (body.action === "atualizar" && body.payload?.role && !["admin", "parceiro"].includes(body.payload.role)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  if (body.action === "atualizar" && body.payload?.role === "parceiro" && body.payload.id === userId) {
    return NextResponse.json({ error: "Você não pode remover o próprio acesso de administrador." }, { status: 400 });
  }
  if (body.action === "resetar-senha" && !body.payload?.id) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  // Nunca deixa o time sem nenhum admin — nem removendo, nem rebaixando pra parceiro.
  const alvoDemovido = body.action === "remover" || (body.action === "atualizar" && body.payload?.role === "parceiro");
  if (alvoDemovido) {
    const { data: alvo } = await admin.from("staff").select("role").eq("id", body.payload!.id!).maybeSingle();
    if (alvo?.role === "admin") {
      const { count } = await admin.from("staff").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "Não é possível remover o último administrador do time." }, { status: 400 });
      }
    }
  }

  try {
    if (body.action === "listar") {
      const { data, error } = await admin.from("staff").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 200 });
      const lastSignIn = new Map((usersData?.users || []).map((u) => [u.id, u.last_sign_in_at]));
      const enriquecido = (data || []).map((member) => ({
        ...member,
        last_sign_in_at: member.id ? lastSignIn.get(member.id) || null : null,
      }));
      return NextResponse.json(enriquecido, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (body.action === "convidar") {
      const { nome, email, role, filaRestrita, acessoInsightsRadar } = body.payload!;
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email!, {
        data: { name: nome },
      });
      if (inviteError) {
        if (/already exists/i.test(inviteError.message)) {
          return NextResponse.json({ error: "Este e-mail já possui uma conta." }, { status: 400 });
        }
        throw inviteError;
      }
      const { error: insertError } = await admin.from("staff").insert({
        id: inviteData.user.id,
        email: email!,
        nome,
        role,
        fila_restrita: Boolean(filaRestrita),
        acesso_insights_radar: acessoInsightsRadar !== false,
      });
      if (insertError) throw insertError;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "atualizar") {
      const { id, filaRestrita, acessoInsightsRadar, role } = body.payload!;
      const patch: { fila_restrita?: boolean; acesso_insights_radar?: boolean; role?: string } = {};
      if (typeof filaRestrita === "boolean") patch.fila_restrita = filaRestrita;
      if (typeof acessoInsightsRadar === "boolean") patch.acesso_insights_radar = acessoInsightsRadar;
      if (role) patch.role = role;
      const { error: updateError } = await admin.from("staff").update(patch).eq("id", id!);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "resetar-senha") {
      const { id } = body.payload!;
      const senhaTemporaria = gerarSenhaTemporaria();
      const { error: pwError } = await admin.auth.admin.updateUserById(id!, { password: senhaTemporaria });
      if (pwError) throw pwError;
      return NextResponse.json({ ok: true, senhaTemporaria });
    }

    // remover
    const { id } = body.payload!;
    const { error: delStaffError } = await admin.from("staff").delete().eq("id", id!);
    if (delStaffError) throw delStaffError;
    const { error: delAuthError } = await admin.auth.admin.deleteUser(id!);
    if (delAuthError) throw delAuthError;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    await registrarErro(admin, {
      origem: "team_route",
      codigo: "team_action_failed",
      mensagem: err.message,
      rota: "/api/team",
      severidade: "erro",
      contexto: { action: body.action },
    });
    return NextResponse.json({ error: "team_action_failed", detail: err.message }, { status: 502 });
  }
}
