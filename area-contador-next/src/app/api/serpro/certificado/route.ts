import { NextResponse } from "next/server";
import forge from "node-forge";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  getSerproCertificadoMeta,
  getSystemSecret,
  setSerproCertificadoMeta,
  setSystemSecret,
  type SerproCertificadoMeta,
} from "@/lib/systemSecrets";
import { invalidarCacheCredenciaisSerpro } from "@/lib/serpro";
import { registrarErro } from "@/lib/observability";

export const runtime = "nodejs";

const TAMANHO_MAXIMO_BYTES = 200 * 1024;

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "service_unavailable" }, { status: 503 }) };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: staff } = await supabase.from("staff").select("id,role").eq("id", userId).maybeSingle();
  if (!staff || staff.role !== "admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const admin = adminClient();
  if (!admin) return { error: NextResponse.json({ error: "service_role_not_configured" }, { status: 503 }) };
  return { admin, userId };
}

function diasRestantes(validoAte: string): number {
  return Math.ceil((new Date(validoAte).getTime() - Date.now()) / (24 * 3600 * 1000));
}

// GET — nunca devolve o certificado nem a chave, só a validade (pra avisar
// de vencimento). Se nunca foi feito upload por aqui mas há um certificado
// configurado só por variável de ambiente (migração antiga), tenta extrair a
// validade lendo o PEM público — não precisa da senha pra isso, só o .pfx
// original exige senha.
export async function GET() {
  const ctx = await exigirAdmin();
  if (ctx.error) return ctx.error;

  const meta = await getSerproCertificadoMeta(ctx.admin);
  if (meta) return NextResponse.json({ meta, diasRestantes: diasRestantes(meta.validoAte), origem: "banco" });

  const certB64 = await getSystemSecret(ctx.admin, "SERPRO_CERT_PEM_BASE64");
  if (!certB64) return NextResponse.json({ meta: null, origem: "nenhuma" });

  try {
    const certPem = Buffer.from(certB64, "base64").toString("utf8");
    const cert = forge.pki.certificateFromPem(certPem);
    const validoAte = cert.validity.notAfter.toISOString();
    return NextResponse.json({
      meta: {
        validoDesde: cert.validity.notBefore.toISOString(),
        validoAte,
        titular: cert.subject.getField("CN")?.value || "",
      },
      diasRestantes: diasRestantes(validoAte),
      origem: "ambiente",
    });
  } catch {
    return NextResponse.json({ meta: null, origem: "ambiente_ilegivel" });
  }
}

export async function POST(request: Request) {
  const ctx = await exigirAdmin();
  if (ctx.error) return ctx.error;

  const body = (await request.json().catch(() => null)) as { base64?: string; senha?: string } | null;
  const senha = body?.senha || "";
  let base64 = (body?.base64 || "").trim();
  if (!base64 || !senha) return NextResponse.json({ error: "arquivo_ou_senha_ausente" }, { status: 400 });

  const virgula = base64.indexOf(",");
  if (base64.startsWith("data:")) base64 = base64.slice(virgula + 1);

  if (Buffer.byteLength(base64, "base64") > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ error: "arquivo_grande_demais", detail: "O certificado (.pfx/.p12) deve ter no máximo 200 KB." }, { status: 400 });
  }

  try {
    const der = forge.util.decode64(base64);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

    const keyBagsPorTipo = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = (keyBagsPorTipo[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
    if (!keyBag?.key) throw new Error("chave_privada_nao_encontrada");

    const certBagsPorTipo = p12.getBags({ bagType: forge.pki.oids.certBag });
    const todosCerts = certBagsPorTipo[forge.pki.oids.certBag] || [];
    if (!todosCerts.length) throw new Error("certificado_nao_encontrado");

    // Certificado-folha: o que casa com a chave privada pelo localKeyId (como
    // `openssl pkcs12 -clcerts` faz) — sem isso, arriscaríamos salvar a
    // cadeia intermediária/raiz em vez do certificado do titular.
    const keyLocalId = keyBag.attributes?.localKeyId?.[0];
    const certBag =
      todosCerts.find((bag) => keyLocalId && bag.attributes?.localKeyId?.[0] === keyLocalId) ||
      todosCerts.find((bag) => !(bag.cert?.getExtension?.("basicConstraints") as { cA?: boolean } | undefined)?.cA) ||
      todosCerts[0];
    const cert = certBag?.cert;
    if (!cert) throw new Error("certificado_invalido");

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keyBag.key);
    const titular = cert.subject.getField("CN")?.value || cert.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(", ");
    const validoDesde = cert.validity.notBefore.toISOString();
    const validoAte = cert.validity.notAfter.toISOString();

    if (cert.validity.notAfter.getTime() < Date.now()) {
      return NextResponse.json({ error: "certificado_vencido", detail: `Esse certificado venceu em ${cert.validity.notAfter.toLocaleDateString("pt-BR")}.` }, { status: 400 });
    }

    await Promise.all([
      setSystemSecret(ctx.admin, "SERPRO_CERT_PEM_BASE64", Buffer.from(certPem, "utf8").toString("base64"), ctx.userId),
      setSystemSecret(ctx.admin, "SERPRO_KEY_PEM_BASE64", Buffer.from(keyPem, "utf8").toString("base64"), ctx.userId),
    ]);
    const meta: SerproCertificadoMeta = { validoDesde, validoAte, titular, atualizadoEm: new Date().toISOString(), atualizadoPor: ctx.userId };
    await setSerproCertificadoMeta(ctx.admin, meta);
    invalidarCacheCredenciaisSerpro();

    return NextResponse.json({ ok: true, meta, diasRestantes: diasRestantes(validoAte) });
  } catch (e) {
    const err = e as Error;
    const senhaErrada = /pbe|password|mac|decrypt/i.test(err.message || "");
    await registrarErro(ctx.admin, {
      origem: "serpro_certificado_route",
      codigo: senhaErrada ? "certificado_senha_invalida" : "certificado_upload_falhou",
      mensagem: err.message,
      rota: "/api/serpro/certificado",
      severidade: "erro",
    });
    return NextResponse.json(
      {
        error: senhaErrada ? "senha_invalida" : "certificado_invalido",
        detail: senhaErrada
          ? "Senha do certificado incorreta."
          : "Não foi possível ler esse arquivo — confira se é um certificado .pfx/.p12 válido.",
      },
      { status: 400 },
    );
  }
}
