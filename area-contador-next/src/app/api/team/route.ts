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

type TeamAction = "listar" | "convidar" | "remover" | "atualizar";
type TeamPayload = {
  id?: string;
  nome?: string;
  email?: string;
  role?: string;
  filaRestrita?: boolean;
  acessoInsightsRadar?: boolean;
};

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
  if (!body?.action || !["listar", "convidar", "remover", "atualizar"].includes(body.action)) {
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

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  try {
    if (body.action === "listar") {
      const { data, error } = await admin.from("staff").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || [], { headers: { "Cache-Control": "private, no-store" } });
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
      const { id, filaRestrita, acessoInsightsRadar } = body.payload!;
      const patch: { fila_restrita?: boolean; acesso_insights_radar?: boolean } = {};
      if (typeof filaRestrita === "boolean") patch.fila_restrita = filaRestrita;
      if (typeof acessoInsightsRadar === "boolean") patch.acesso_insights_radar = acessoInsightsRadar;
      const { error: updateError } = await admin.from("staff").update(patch).eq("id", id!);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true });
    }

    // remover
    const { id } = body.payload!;
    await admin.from("staff").delete().eq("id", id!);
    await admin.auth.admin.deleteUser(id!);
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
