// Layout A4 do relatório de atendimento — compartilhado entre o painel do
// contador (Relatórios) e a Área do Cliente (Documentos), pra manter o mesmo
// PDF em ambos os lados.
export type ReportPrintable = {
  id: number;
  versao: number;
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
  contador_logo: string | null;
  codigo_validacao: string;
};

function escapeHtml(value: string | null): string {
  return String(value || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] || char);
}

// Mesmo formato do protocolo do legado (relatorio-pdf.js): OC-R{id}-V{versao}.
export function protocoloRelatorio(report: Pick<ReportPrintable, "id" | "versao">): string {
  return `OC-R${String(report.id).padStart(6, "0")}-V${report.versao || 1}`;
}

export function printReportHtml(report: ReportPrintable, baseUrl?: string): string {
  const escape = escapeHtml;
  const protocolo = protocoloRelatorio(report);
  const validationUrl = baseUrl
    ? `${baseUrl}/validar-relatorio?codigo=${encodeURIComponent(report.codigo_validacao)}`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escape(report.titulo)}</title><style>body{font:15px Arial;color:#173f34;max-width:800px;margin:40px auto;line-height:1.55}header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #f97316;padding-bottom:18px}header .brand{display:flex;align-items:center;gap:12px}header img.logo{max-height:48px;max-width:160px;object-fit:contain}h1{font-size:25px;margin:0 0 4px}section{margin:22px 0}h2{font-size:15px;text-transform:uppercase;color:#64748b}footer{margin-top:40px;border-top:1px solid #ddd;padding-top:20px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px}footer .signature-block{display:flex;flex-direction:column;gap:2px}.signature{max-height:75px;max-width:240px}.validation-block{text-align:right;font-size:10px;color:#64748b}.validation-block a{color:#f97316;font-weight:700;text-decoration:none}.protocol{font-family:monospace;font-size:11px;color:#334155}@media print{body{margin:18mm}}</style></head><body><header><div class="brand">${report.contador_logo ? `<img class="logo" src="${escape(report.contador_logo)}" alt="Logo">` : ""}<div><h1>${escape(report.titulo || "Relatório de atendimento")}</h1><p>${escape(report.cliente_nome)} · ${escape(report.cliente_cpf)}</p></div></div><div class="protocol">Protocolo<br>${escape(protocolo)}</div></header><section><h2>Descrição do caso</h2><p>${escape(report.problema)}</p></section><section><h2>Resolução</h2><p>${escape(report.solucao)}</p></section><section><h2>Providências realizadas</h2><p>${escape(report.oque_feito)}</p></section>${report.como_feito ? `<section><h2>Como foi realizado</h2><p>${escape(report.como_feito)}</p></section>` : ""}${report.pendencias ? `<section><h2>Pendências</h2><p>${escape(report.pendencias)}</p></section>` : ""}<footer><div class="signature-block">${report.contador_assinatura ? `<img class="signature" src="${escape(report.contador_assinatura)}" alt="Assinatura">` : ""}<strong>${escape(report.contador_nome)}</strong><span>${escape(report.contador_crc)}</span></div><div class="validation-block">${validationUrl ? `<a href="${validationUrl}">Validar este relatório</a><br>` : ""}Código: ${escape(report.codigo_validacao)}<br>Este documento confirma emissão, autoria, versão e integridade do registro na data de emissão.</div></footer><script>window.onload=()=>window.print()<\/script></body></html>`;
}

export function abrirImpressaoRelatorio(report: ReportPrintable) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : undefined;
  const blob = new Blob([printReportHtml(report, baseUrl)], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
}
