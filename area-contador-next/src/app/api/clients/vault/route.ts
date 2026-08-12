import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { cifrar, decifrar } from "@/lib/govbrVault";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type VaultRow = Database["public"]["Tables"]["govbr_credenciais_cofre"]["Row"];
type VaultAction = "store" | "status" | "delete" | "reveal";

function noStoreHeaders() {
  return { "Cache-Control": "no-store, private, max-age=0", Pragma: "no-cache" };
}

function statusPublico(row: VaultRow | null) {
  if (!row) return { status: "empty" };
  return {
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewedAt: row.viewed_at || null,
    deletedAt: row.deleted_at || null,
  };
}

async function contextoDeAcesso(supabase: SupabaseClient<Database>, clientId: string) {
  const [{ data: isStaff }, { data: myClientId }] = await Promise.all([
    supabase.rpc("is_staff"),
    supabase.rpc("my_client_id"),
  ]);
  return { isStaff: !!isStaff, isOwner: String(myClientId || "") === String(clientId || "") };
}

async function auditar(
  admin: SupabaseClient<Database>,
  clienteId: string,
  atorId: string,
  evento: "stored" | "revealed_once" | "deleted" | "expired",
  detalhes?: Record<string, unknown>
) {
  await admin.from("govbr_credenciais_auditoria").insert({
    cliente_id: clienteId,
    ator_id: atorId,
    evento,
    detalhes: (detalhes || {}) as never,
  });
}

export async function POST(request: Request) {
  const headers = noStoreHeaders();
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503, headers });

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "vault_unavailable" }, { status: 503, headers });

  const body = (await request.json().catch(() => null)) as {
    action?: VaultAction;
    clientId?: string;
    password?: string;
    ttlHours?: number;
    authorized?: boolean;
  } | null;
  const action: VaultAction = body?.action || "status";
  const clientId = String(body?.clientId || "").trim();
  if (!clientId) return NextResponse.json({ error: "invalid_params" }, { status: 400, headers });

  const acesso = await contextoDeAcesso(supabase, clientId);
  if (!acesso.isOwner && !acesso.isStaff) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });

  try {
    if (action === "store") {
      if (!acesso.isOwner) return NextResponse.json({ error: "only_client_can_store" }, { status: 403, headers });
      const password = String(body?.password || "");
      const ttlHours = [24, 48, 72].includes(Number(body?.ttlHours)) ? Number(body?.ttlHours) : 48;
      if (password.length < 8 || password.length > 256) {
        return NextResponse.json({ error: "invalid_password_length" }, { status: 400, headers });
      }
      if (body?.authorized !== true) {
        return NextResponse.json({ error: "authorization_required" }, { status: 400, headers });
      }

      const encrypted = cifrar(password);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("govbr_credenciais_cofre")
        .upsert(
          {
            cliente_id: clientId,
            ...encrypted,
            status: "pending",
            created_at: now.toISOString(),
            expires_at: expiresAt,
            viewed_at: null,
            viewed_by: null,
            deleted_at: null,
          },
          { onConflict: "cliente_id" }
        )
        .select("*")
        .single();
      if (error) throw error;
      await auditar(admin, clientId, userId, "stored", { ttlHours });
      return NextResponse.json(statusPublico(data), { headers });
    }

    const { data: rowData, error: rowError } = await admin
      .from("govbr_credenciais_cofre")
      .select("*")
      .eq("cliente_id", clientId)
      .maybeSingle();
    if (rowError) throw rowError;
    let row = rowData;

    if (row && row.status === "pending" && new Date(row.expires_at) <= new Date()) {
      await admin
        .from("govbr_credenciais_cofre")
        .update({ status: "expired", ciphertext: null, iv: null, auth_tag: null, deleted_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending");
      await auditar(admin, clientId, userId, "expired");
      row = { ...row, status: "expired", ciphertext: null };
    }

    if (action === "status") return NextResponse.json(statusPublico(row), { headers });

    if (action === "delete") {
      if (!row) return NextResponse.json({ status: "empty" }, { headers });
      const deletedAt = new Date().toISOString();
      await admin
        .from("govbr_credenciais_cofre")
        .update({ status: "deleted", ciphertext: null, iv: null, auth_tag: null, deleted_at: deletedAt })
        .eq("id", row.id);
      await auditar(admin, clientId, userId, "deleted", { actorType: acesso.isStaff ? "staff" : "client" });
      return NextResponse.json({ status: "deleted", deletedAt }, { headers });
    }

    if (action === "reveal") {
      if (!acesso.isStaff) return NextResponse.json({ error: "only_staff_can_reveal" }, { status: 403, headers });
      if (!row || row.status !== "pending" || !row.ciphertext) {
        return NextResponse.json({ error: "credential_not_available", ...statusPublico(row) }, { status: 409, headers });
      }

      // Reivindica a visualização de forma condicional: se duas telas tentarem
      // abrir juntas, só a primeira consegue mudar pending -> viewed.
      const viewedAt = new Date().toISOString();
      const { data: claimed, error: claimError } = await admin
        .from("govbr_credenciais_cofre")
        .update({ status: "viewed", viewed_at: viewedAt, viewed_by: userId })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return NextResponse.json({ error: "credential_already_viewed" }, { status: 409, headers });

      let password: string;
      try {
        password = decifrar(row as { ciphertext: string; iv: string; auth_tag: string });
      } finally {
        await admin
          .from("govbr_credenciais_cofre")
          .update({ ciphertext: null, iv: null, auth_tag: null, deleted_at: viewedAt })
          .eq("id", row.id);
      }
      await auditar(admin, clientId, userId, "revealed_once");
      return NextResponse.json({ status: "viewed", password, viewedAt }, { headers });
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400, headers });
  } catch (e) {
    const err = e as Error;
    console.error("[govbr-vault]", err.message);
    return NextResponse.json(
      { error: err.message === "vault_key_not_configured" ? "vault_unavailable" : "vault_failed" },
      { status: 500, headers }
    );
  }
}
