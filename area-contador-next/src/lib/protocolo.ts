// Protocolo do ATENDIMENTO (não confundir com o protocolo do RELATÓRIO final,
// `OC-R{id}-V{versao}` em src/lib/reportValidation.ts) — mesmo espírito
// (computado a partir do id já existente, sem coluna nova no banco), só que
// pro caso em si: "OC-E{id}" pra Atendimento Express, "OC-AG{id}" pra
// consulta agendada.
export function protocoloAtendimento(tipo: "express" | "agendado", id: number): string {
  const prefixo = tipo === "express" ? "OC-E" : "OC-AG";
  return `${prefixo}${String(id).padStart(6, "0")}`;
}
