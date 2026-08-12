// Layout A4 do relatório de atendimento — compartilhado entre o painel do
// contador (Relatórios) e a Área do Cliente (Documentos), pra manter o mesmo
// PDF em ambos os lados.
export type ReportPrintable = {
  titulo: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  problema: string | null;
  solucao: string | null;
  oque_feito: string | null;
  como_feito: string | null;
  pendencias: string | null;
  contador_assinatura: string | null;
  contador_nome: string | null;
  contador_crc: string | null;
  codigo_validacao: string;
};

function escapeHtml(value: string | null): string {
  return String(value || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] || char);
}

export function printReportHtml(report: ReportPrintable): string {
  const escape = escapeHtml;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escape(report.titulo)}</title><style>body{font:15px Arial;color:#173f34;max-width:800px;margin:40px auto;line-height:1.55}header{border-bottom:3px solid #f97316;padding-bottom:18px}h1{font-size:25px}section{margin:22px 0}h2{font-size:15px;text-transform:uppercase;color:#64748b}footer{margin-top:40px;border-top:1px solid #ddd;padding-top:20px}.signature{max-height:75px;max-width:240px}@media print{body{margin:18mm}}</style></head><body><header><h1>${escape(report.titulo || "Relatório de atendimento")}</h1><p>${escape(report.cliente_nome)} · ${escape(report.cliente_cpf)}</p></header><section><h2>Descrição do caso</h2><p>${escape(report.problema)}</p></section><section><h2>Resolução</h2><p>${escape(report.solucao)}</p></section><section><h2>Providências realizadas</h2><p>${escape(report.oque_feito)}</p></section>${report.como_feito ? `<section><h2>Como foi realizado</h2><p>${escape(report.como_feito)}</p></section>` : ""}${report.pendencias ? `<section><h2>Pendências</h2><p>${escape(report.pendencias)}</p></section>` : ""}<footer>${report.contador_assinatura ? `<img class="signature" src="${report.contador_assinatura}" alt="Assinatura">` : ""}<strong>${escape(report.contador_nome)}</strong><p>${escape(report.contador_crc)}</p><small>Código de validação: ${escape(report.codigo_validacao)}</small></footer><script>window.onload=()=>window.print()<\/script></body></html>`;
}

export function abrirImpressaoRelatorio(report: ReportPrintable) {
  const blob = new Blob([printReportHtml(report)], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
}
