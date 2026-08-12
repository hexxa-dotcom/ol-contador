import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { uploadSkillPDF } from "@/lib/ia";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { skillName?: string; base64?: string } | null;
  const skillName = body?.skillName?.trim().slice(0, 120);
  const base64 = body?.base64 || "";
  if (!skillName || !/^data:application\/pdf;base64,/.test(base64) || base64.length > 14_000_000) {
    return NextResponse.json({ error: "invalid_pdf" }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  try {
    const result = await uploadSkillPDF(admin, skillName, base64);
    return NextResponse.json(result);
  } catch (e) {
    const err = e as { code?: string; message: string };
    if (err.code === "ia_not_configured") return NextResponse.json({ error: "ia_not_configured" }, { status: 503 });
    await registrarErro(admin, {
      origem: "skills_upload_route",
      codigo: err.code || "skill_upload_failed",
      mensagem: err.message,
      rota: "/api/skills/upload",
      severidade: "erro",
      contexto: { skillName },
    });
    return NextResponse.json({ error: "skill_upload_failed", detail: err.message }, { status: 502 });
  }
}
