"use client";
// Geração real de PDF do relatório — porte 1:1 de relatorio-pdf.js (legado):
// html2canvas renderiza o card em uma imagem, jsPDF encaixa essa imagem numa
// única página A4 (encolhendo se necessário) e depois desenha o rodapé de
// validação (QR real + protocolo + "Página X de Y") em cada página do PDF
// final, com as mesmas primitivas de desenho do jsPDF que o legado usava.
import qrcode from "qrcode-generator";
import html2pdf from "html2pdf.js";

export type ReportForPdf = {
  id: number;
  versao: number;
  tipoRelatorio: string;
  titulo: string | null;
  clienteNome: string | null;
  clienteCpf: string | null;
  problema: string | null;
  solucao: string | null;
  oqueFeito: string | null;
  comoFeito: string | null;
  pendencias: string | null;
  contadorAssinatura: string | null;
  contadorNome: string | null;
  contadorCrc: string | null;
  codigoValidacao: string;
  entregueEm: string | null;
  createdAt: string;
};

const CORAL = "#FF6A45";
const PINE = "#0A3121";
const PAPER = "#FFFFFF";
const TINTA = "#1C2B25";
const SUAVE = "#F5F3ED";

function temaDo(rel: ReportForPdf): string {
  return rel.tipoRelatorio === "pendencias" ? "#111315" : PINE;
}
function temaRgb(rel: ReportForPdf): [number, number, number] {
  return rel.tipoRelatorio === "pendencias" ? [17, 19, 21] : [10, 49, 33];
}
function esc(value: unknown): string {
  return String(value == null ? "" : value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char,
  );
}
function linhas(texto: string | null): string[] {
  return String(texto || "")
    .split("\n")
    .map((linha) => linha.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}
function itens(texto: string | null, compacto: boolean): string {
  const lista = linhas(texto);
  if (!lista.length) return '<p style="margin:0;color:#66736D;">—</p>';
  return (
    '<ul style="margin:0;padding-left:18px;">' +
    lista
      .map(
        (linha) =>
          `<li style="margin:0 0 ${compacto ? "4" : "6"}px;line-height:1.45;">${esc(linha)}</li>`,
      )
      .join("") +
    "</ul>"
  );
}
function textoEmParagrafos(texto: string | null): string {
  const partes = String(texto || "")
    .split(/\n+/)
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (!partes.length) return '<p style="margin:0;color:#66736D;">—</p>';
  return partes.map((parte) => `<p style="margin:0 0 6px;line-height:1.5;">${esc(parte)}</p>`).join("");
}
function dataBR(valor: string | null, comHora?: boolean): string {
  let data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) data = new Date();
  return data.toLocaleString(
    "pt-BR",
    comHora
      ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  );
}
function formatarDocumento(valor: string | null): string {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length === 11) return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digitos.length === 14) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(valor || "").trim();
}
function protocoloDo(rel: ReportForPdf): string {
  const id = /^\d+$/.test(String(rel.id || "")) ? String(rel.id).padStart(6, "0") : "PREVIA";
  return `OC-R${id}-V${rel.versao || 1}`;
}
function urlValidacao(rel: ReportForPdf): string {
  if (!rel.codigoValidacao || typeof window === "undefined") return "";
  const url = new URL("/validar-relatorio", window.location.origin);
  url.searchParams.set("codigo", rel.codigoValidacao);
  return url.toString();
}
function qrCodeDataURL(rel: ReportForPdf): string {
  const url = urlValidacao(rel);
  if (!url || typeof document === "undefined") return "";
  try {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const modulos = qr.getModuleCount();
    const margem = 3;
    const escala = 4;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = (modulos + margem * 2) * escala;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (let linha = 0; linha < modulos; linha++) {
      for (let coluna = 0; coluna < modulos; coluna++) {
        if (qr.isDark(linha, coluna)) {
          ctx.fillRect((coluna + margem) * escala, (linha + margem) * escala, escala, escala);
        }
      }
    }
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
function qrCodeHTML(rel: ReportForPdf): string {
  const imagem = qrCodeDataURL(rel);
  if (imagem)
    return `<img alt="QR Code de validação" src="${esc(imagem)}" style="width:62px;height:62px;display:block;image-rendering:pixelated;" />`;
  return (
    '<div style="width:62px;height:62px;border:1px solid #CBD2CE;display:flex;align-items:center;' +
    'justify-content:center;text-align:center;font-size:7px;line-height:1.25;color:#66736D;background:#fff;">' +
    (rel.codigoValidacao ? "CÓDIGO<br>DE VALIDAÇÃO" : "DISPONÍVEL<br>APÓS EMISSÃO") +
    "</div>"
  );
}
function secao(titulo: string, corpo: string, compacto: boolean, destaque: boolean, tema: string): string {
  return (
    `<section style="break-inside:avoid;margin-bottom:${compacto ? "12" : "18"}px;` +
    (destaque
      ? `background:${tema === "#111315" ? "#F2F2F2" : "#F2F7F4"};border-left:3px solid ${tema};padding:12px 14px;border-radius:0 9px 9px 0;`
      : "") +
    `"><div style="font-size:10px;font-weight:800;letter-spacing:.65px;text-transform:uppercase;color:${tema};margin-bottom:6px;">${esc(titulo)}</div>` +
    `<div style="font-size:${compacto ? "12.5" : "13"}px;color:${TINTA};line-height:1.5;">${corpo}</div></section>`
  );
}
function corpoAtendimento(rel: ReportForPdf): string {
  const tema = temaDo(rel);
  return (
    secao("Descrição do caso", textoEmParagrafos(rel.problema), true, false, tema) +
    secao("Providências realizadas", itens(rel.oqueFeito, true), true, false, tema) +
    secao("Resolução do caso", textoEmParagrafos(rel.solucao), true, true, tema)
  );
}
function corpoPendencias(rel: ReportForPdf): string {
  const tema = temaDo(rel);
  const origem =
    '<p style="margin:0;line-height:1.5;">Este relatório foi elaborado com base no Relatório de Pendências da Receita Federal e nas demais evidências levantadas durante o atendimento.</p>';
  return (
    secao("Origem e escopo da análise", origem + textoEmParagrafos(rel.problema), true, true, tema) +
    secao("Pendências identificadas", itens(rel.pendencias, true), true, false, tema) +
    secao("Evidências analisadas", itens(rel.oqueFeito, true), true, false, tema) +
    secao("Conclusão técnica", textoEmParagrafos(rel.solucao), true, false, tema) +
    secao("Orientações para regularização", itens(rel.comoFeito, true), true, false, tema)
  );
}
function montarNo(rel: ReportForPdf): HTMLDivElement {
  const tipoRelatorio = rel.tipoRelatorio === "pendencias" ? "pendencias" : "atendimento";
  const nome = String(rel.clienteNome || "Cliente").trim().replace(/\s+/g, " ");
  const documento = formatarDocumento(rel.clienteCpf);
  const documentoLabel = String(documento).replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF";
  const contador = String(rel.contadorNome || "Contador responsável").trim();
  const crc = String(rel.contadorCrc || "").replace(/^\s*crc\s*/i, "").trim();
  const protocolo = protocoloDo(rel);
  const assinatura = rel.contadorAssinatura || "";
  // A marca do relatório é institucional e não muda conforme o perfil do
  // contador — mesma decisão do legado (relatorio-pdf.js).
  const logo = "/logo.svg";
  const tema = temaDo(rel);

  const el = document.createElement("div");
  el.style.cssText = `width:720px;background:${PAPER};color:${TINTA};font-family:'Outfit',Arial,sans-serif;box-sizing:border-box;`;
  el.innerHTML =
    `<header style="background:${tema};color:#fff;padding:22px 34px 42px;position:relative;overflow:hidden;` +
    'display:flex;justify-content:space-between;align-items:center;">' +
    '<svg viewBox="0 0 720 130" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;opacity:.09;">' +
    '<circle cx="620" cy="15" r="105" fill="#FFFFFF"/><circle cx="535" cy="112" r="58" fill="none" stroke="#FFFFFF" stroke-width="2"/></svg>' +
    '<div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1;">' +
    `<img src="${esc(logo)}" alt="Símbolo Olá, Contador" style="width:32px;height:34px;object-fit:contain;` +
    'filter:brightness(0) saturate(100%) invert(94%) sepia(13%) saturate(352%) hue-rotate(335deg) brightness(105%) contrast(94%);" />' +
    `<div><div style="font-weight:750;font-size:19px;line-height:1;">Olá<span style="color:${CORAL};">,</span> Contador<span style="color:${CORAL};">.</span></div>` +
    '<div style="font-size:9px;opacity:.82;margin-top:4px;letter-spacing:.35px;">Seu contador pessoal.</div></div></div>' +
    '<div style="text-align:right;font-size:9.5px;line-height:1.5;position:relative;z-index:1;">' +
    `<div style="font-weight:800;letter-spacing:.8px;">${tipoRelatorio === "pendencias" ? "RELATÓRIO DE PENDÊNCIAS" : "RELATÓRIO DE ATENDIMENTO"}</div>` +
    `<div>Emitido em ${dataBR(rel.entregueEm || rel.createdAt, true)}</div>` +
    `<div>${esc(protocolo)}</div></div>` +
    '<svg viewBox="0 0 720 44" preserveAspectRatio="none" style="position:absolute;left:0;bottom:-1px;width:100%;height:44px;z-index:2;">' +
    '<path d="M0,20 C150,42 415,4 720,22 L720,44 L0,44 Z" fill="#FFFFFF"/></svg></header>' +
    '<main style="padding:14px 34px 16px;">' +
    `<div style="display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:16px;background:${SUAVE};border-radius:8px;padding:12px 15px;margin-bottom:16px;break-inside:avoid;">` +
    '<div style="min-width:0;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#748079;">Cliente</div>' +
    `<div style="font-size:15px;font-weight:750;line-height:1.3;overflow-wrap:anywhere;">${esc(nome)}</div></div>` +
    (documento
      ? `<div style="text-align:right;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#748079;">${documentoLabel}</div>` +
        `<div style="font-size:14px;font-weight:750;white-space:nowrap;">${esc(documento)}</div></div>`
      : "") +
    "</div>" +
    `<h1 style="font-size:18px;color:${tema};margin:0 0 15px;line-height:1.25;">${esc(rel.titulo || "Relatório de atendimento")}</h1>` +
    (tipoRelatorio === "pendencias" ? corpoPendencias(rel) : corpoAtendimento(rel)) +
    '<section style="break-inside:avoid;margin-top:20px;text-align:center;">' +
    '<div style="width:270px;margin:0 auto;">' +
    (assinatura
      ? `<img src="${esc(assinatura)}" alt="Assinatura" style="height:48px;max-width:240px;object-fit:contain;display:block;margin:0 auto -2px;" />`
      : '<div style="height:38px;"></div>') +
    '<div style="border-top:1px solid #66736D;padding-top:6px;">' +
    `<div style="font-weight:750;font-size:12.5px;">${esc(contador)}</div>` +
    `<div style="font-size:10.5px;color:#66736D;">Contador responsável${crc ? " · CRC " + esc(crc) : ""}</div>` +
    '<div style="font-size:9px;color:#8A9490;margin-top:2px;">Assinado eletronicamente no sistema Olá, Contador</div>' +
    "</div></div></section></main>" +
    `<footer class="oc-report-validation" style="break-inside:avoid;background:#F3F1EA;border-top:2px solid ${tema};padding:11px 34px;` +
    'display:flex;align-items:center;gap:12px;color:#596660;">' +
    qrCodeHTML(rel) +
    '<div style="flex:1;min-width:0;">' +
    `<div style="font-size:10px;font-weight:800;color:${tema};letter-spacing:.35px;">VALIDAÇÃO DO DOCUMENTO</div>` +
    '<div style="font-size:8.4px;line-height:1.35;margin-top:2px;">O QR Code confirma emissão, autoria, versão e integridade deste registro. As informações refletem o atendimento na data de emissão; comprovantes oficiais permanecem a fonte para atos de órgãos públicos ou terceiros.</div>' +
    `<div style="font-size:8.5px;margin-top:4px;overflow-wrap:anywhere;">Código: <strong>${esc(rel.codigoValidacao || "gerado na emissão")}</strong></div></div>` +
    '<div style="text-align:right;font-size:8.8px;line-height:1.45;white-space:nowrap;">' +
    `<strong style="color:${tema};">${esc(protocolo)}</strong><br>Versão ${esc(rel.versao || 1)}<br>${dataBR(rel.entregueEm || rel.createdAt)}</div></footer>`;
  return el;
}

type MinimalPdf = {
  internal: { getNumberOfPages(): number };
  setPage(page: number): void;
  setFillColor(r: number, g: number, b: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(width: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number, alias?: unknown, compression?: string): void;
  setTextColor(r: number, g: number, b: number): void;
  setFont(family: string, style: string): void;
  setFontSize(size: number): void;
  text(text: string | string[], x: number, y: number, options?: Record<string, unknown>): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  save(filename: string): void;
};

function adicionarRodapePdf(pdf: MinimalPdf, rel: ReportForPdf) {
  const total = pdf.internal.getNumberOfPages();
  const qrImagem = qrCodeDataURL(rel);
  const protocolo = protocoloDo(rel);
  const codigo = rel.codigoValidacao || "gerado na emissão";
  const rgbTema = temaRgb(rel);
  for (let pagina = 1; pagina <= total; pagina++) {
    pdf.setPage(pagina);
    pdf.setFillColor(243, 241, 234);
    pdf.rect(8, 268, 194, 21, "F");
    pdf.setDrawColor(rgbTema[0], rgbTema[1], rgbTema[2]);
    pdf.setLineWidth(0.7);
    pdf.line(8, 268, 202, 268);
    if (qrImagem) {
      pdf.addImage(qrImagem, "PNG", 11, 270, 16, 16);
    } else {
      pdf.setDrawColor(203, 210, 206);
      pdf.setLineWidth(0.2);
      pdf.rect(11, 270, 16, 16);
      pdf.setTextColor(102, 115, 109);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(4.7);
      pdf.text(["QR DISPONÍVEL", "APÓS EMISSÃO"], 19, 277.2, { align: "center", lineHeightFactor: 1.15 });
    }
    pdf.setTextColor(rgbTema[0], rgbTema[1], rgbTema[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.3);
    pdf.text("VALIDAÇÃO DO DOCUMENTO", 30, 273);
    pdf.setTextColor(89, 102, 96);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.8);
    const aviso =
      "O QR Code confirma emissão, autoria, versão e integridade deste registro. As informações refletem o atendimento na data de emissão; comprovantes oficiais permanecem a fonte para atos de órgãos públicos ou terceiros.";
    pdf.text(pdf.splitTextToSize(aviso, 119), 30, 276.1, { lineHeightFactor: 1.15 });
    pdf.setFontSize(5.5);
    pdf.text(`Código: ${codigo}`, 30, 285.4);
    pdf.setTextColor(rgbTema[0], rgbTema[1], rgbTema[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.1);
    pdf.text(protocolo, 198, 273, { align: "right" });
    pdf.setTextColor(89, 102, 96);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.7);
    pdf.text(`Versão ${rel.versao || 1}`, 198, 276.3, { align: "right" });
    pdf.text(dataBR(rel.entregueEm || rel.createdAt), 198, 279.6, { align: "right" });
    pdf.text(`Página ${pagina} de ${total}`, 198, 285.4, { align: "right" });
  }
}

export async function baixarRelatorioPdf(rel: ReportForPdf): Promise<boolean> {
  const no = montarNo(rel);
  const rodapeHtml = no.querySelector<HTMLElement>(".oc-report-validation");
  const berco = document.createElement("div");
  berco.style.cssText = "position:fixed;left:-9999px;top:0;";
  berco.appendChild(no);
  document.body.appendChild(berco);

  const nomeArq = `Relatorio-OlaContador-${String(rel.clienteNome || "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;

  const imagens = Array.from(no.querySelectorAll("img"));
  await Promise.all(
    imagens.map((img) => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => {});
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }),
  );

  try {
    if (rodapeHtml) rodapeHtml.style.display = "none";
    const worker = html2pdf()
      .set({
        margin: 0,
        filename: nomeArq,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(no)
      .toCanvas()
      .toPdf();
    const canvas = (await worker.get("canvas")) as HTMLCanvasElement;
    const pdfBase = await worker.get("pdf");
    const PdfCtor = pdfBase.constructor as new (options: {
      unit: string;
      format: string;
      orientation: string;
    }) => MinimalPdf;
    const pdf = new PdfCtor({ unit: "mm", format: "a4", orientation: "portrait" });
    const larguraMaxima = 194;
    const alturaMaxima = 256;
    let largura = larguraMaxima;
    let altura = (canvas.height * largura) / canvas.width;
    if (altura > alturaMaxima) {
      altura = alturaMaxima;
      largura = (canvas.width * altura) / canvas.height;
    }
    const x = (210 - largura) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", x, 8, largura, altura, undefined, "FAST");
    adicionarRodapePdf(pdf, rel);
    pdf.save(nomeArq);
    document.body.removeChild(berco);
    return true;
  } catch (error) {
    document.body.removeChild(berco);
    console.error("Falha ao gerar PDF:", error);
    return false;
  }
}
