import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  if (!supabase)
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!staff)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0)
    return NextResponse.json({ error: "invalid_document" }, { status: 400 });
  const { data: document } = await supabase
    .from("documentos")
    .select("id,storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!document)
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });

  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(document.storage_path, 60);
  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "signed_url_failed" }, { status: 502 });
  return NextResponse.redirect(data.signedUrl, 307);
}
