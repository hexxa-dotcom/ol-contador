import { adminClient } from "@/lib/supabase/admin";

// Mesmo formato do protocolo do legado (relatorio-pdf.js): OC-R{id}-V{versao}.
function protocoloRelatorio(report: { id: number; versao: number }): string {
  return `OC-R${String(report.id).padStart(6, "0")}-V${report.versao || 1}`;
}

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

export type ValidationQuery = string | { cpf: string; protocolo: string };

export async function validarRelatorioPublico(query: ValidationQuery): Promise<ReportValidationResult> {
  const admin = adminClient();
  if (!admin) return { valido: false, error: "service_unavailable" };

  let data;
  let error;

  if (typeof query === "string") {
    const codigo = query;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo))
      return { valido: false, error: "codigo_invalido" };
    
    ({ data, error } = await admin
      .from("relatorios")
      .select("id,titulo,cliente_nome,cliente_cpf,contador_nome,contador_crc,versao,entregue_em,status")
      .eq("codigo_validacao", codigo)
      .eq("status", "entregue")
      .maybeSingle());
      
  } else {
    const { cpf, protocolo } = query;
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length < 11) return { valido: false, error: "cpf_invalido" };

    const match = /^OC-R(\d+)-V(\d+)$/i.exec(protocolo.trim());
    if (!match) return { valido: false, error: "protocolo_invalido" };

    const id = parseInt(match[1], 10);
    const versao = parseInt(match[2], 10);

    ({ data, error } = await admin
      .from("relatorios")
      .select("id,titulo,cliente_nome,cliente_cpf,contador_nome,contador_crc,versao,entregue_em,status")
      .eq("id", id)
      .eq("versao", versao)
      .eq("status", "entregue")
      .maybeSingle());

    if (data) {
      const dbCpfDigits = String(data.cliente_cpf || "").replace(/\D/g, "");
      if (dbCpfDigits !== cpfDigits) {
        return { valido: false, error: "relatorio_nao_encontrado" };
      }
    }
  }

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
