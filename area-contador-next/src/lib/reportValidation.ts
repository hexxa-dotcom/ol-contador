import { adminClient } from "@/lib/supabase/admin";
import { protocoloRelatorio } from "@/lib/reportPrint";

// Porte 1:1 de validarRelatorioPublico (api/status.js do legado) — só
// confirma autenticidade; nunca devolve o conteúdo do relatório.
export type ReportValidationResult =
  | { valido: true; protocolo: string; titulo: string; cliente: string; documento: string; contador: string; crc: string | null; versao: number; entregueEm: string | null }
  | { valido: false; error: string };

function nomeProtegido(nome: string | null): string {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "Cliente não informado";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes.slice(1).map((parte) => parte[0] + ".").join(" ")}`;
}

function documentoProtegido(valor: string | null): string {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length === 11) return `CPF ***.***.***-${digitos.slice(-2)}`;
  if (digitos.length === 14) return `CNPJ **.***.***/****-${digitos.slice(-2)}`;
  return "Documento protegido";
}

export async function validarRelatorioPublico(codigo: string): Promise<ReportValidationResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo))
    return { valido: false, error: "codigo_invalido" };
  const admin = adminClient();
  if (!admin) return { valido: false, error: "service_unavailable" };
  const { data, error } = await admin
    .from("relatorios")
    .select("id,titulo,cliente_nome,cliente_cpf,contador_nome,contador_crc,versao,entregue_em,status")
    .eq("codigo_validacao", codigo)
    .eq("status", "entregue")
    .maybeSingle();
  if (error || !data) return { valido: false, error: "relatorio_nao_encontrado" };
  return {
    valido: true,
    protocolo: protocoloRelatorio({ id: data.id, versao: data.versao || 1 }),
    titulo: data.titulo || "Relatório de atendimento",
    cliente: nomeProtegido(data.cliente_nome),
    documento: documentoProtegido(data.cliente_cpf),
    contador: data.contador_nome || "Contador responsável",
    crc: data.contador_crc || null,
    versao: data.versao || 1,
    entregueEm: data.entregue_em,
  };
}
