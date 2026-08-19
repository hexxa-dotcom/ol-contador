import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as ia from "@/lib/ia";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase.from("staff").select("id").eq("id", userId).maybeSingle();
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  if (!(await ia.isConfigured(admin, "documentos"))) return NextResponse.json({ error: "ia_not_configured" }, { status: 503 });

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "invalid_document" }, { status: 400 });

  // RLS do próprio usuário decide o que pode ler — mesmo client usado pra
  // baixar do Storage abaixo, sem passar por admin.
  const { data: doc } = await supabase.from("documentos").select("*").eq("id", Number(id)).single();
  if (!doc) return NextResponse.json({ error: "doc_not_found" }, { status: 404 });

  try {
    const { data: file, error: downloadError } = await supabase.storage.from("documentos").download(doc.storage_path);
    if (downloadError) throw downloadError;
    const buffer = Buffer.from(await file.arrayBuffer());

    const extracted = await ia.analisarDocumento(admin, buffer, doc.mime);
    await supabase.from("documentos").update({ ai_extracted: extracted as never }).eq("id", doc.id);

    const { data: signed } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 3600);

    return NextResponse.json(
      { id: doc.id, fileName: doc.file_name, mime: doc.mime, url: signed?.signedUrl || null, ai: extracted },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (e) {
    const err = e as { code?: string; message: string };
    if (err.code === "ia_not_configured") return NextResponse.json({ error: "ia_not_configured" }, { status: 503 });
    await registrarErro(adminClient(), {
      origem: "documents_analyze_route",
      codigo: err.code || "ia_error",
      mensagem: err.message,
      rota: `/api/documents/${id}/analyze`,
      severidade: "erro",
      contexto: { documentId: doc.id },
    });
    return NextResponse.json({ error: "ia_error", detail: err.message }, { status: 502 });
  }
}
