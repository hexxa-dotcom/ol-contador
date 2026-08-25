"use client";
// Geração real de PDF do relatório — porte 1:1 de relatorio-pdf.js (legado):
// html2canvas renderiza o card em uma imagem, jsPDF encaixa essa imagem numa
// única página A4 (encolhendo se necessário) e depois desenha o rodapé de
// validação (QR real + protocolo + "Página X de Y") em cada página do PDF
// final, com as mesmas primitivas de desenho do jsPDF que o legado usava.
import qrcode from "qrcode-generator";

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
  
  // Se estiver gerando o PDF em localhost (ambiente de teste), 
  // força a URL de produção para que o celular consiga ler o QR Code
  // (já que o celular não entende "localhost").
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const origin = isLocal ? "https://olacontador.com.br" : window.location.origin;
  
  const url = new URL("/validar-relatorio", origin);
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
  const logoSvgInline = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 616 640" style="width:100%;height:100%;display:block;"><path fill="#FFFFFF" d="M287 64.93C289.21 64.66 293.62 64.17 296.94 64.02C300.27 63.86 303.61 64 306.94 64C310.28 64 313.61 64 316.94 64C320.28 64 323.61 64 326.94 64C330.28 64 333.61 64 336.94 64C340.28 64 343.62 63.84 346.94 64.02C350.27 64.19 353.59 64.51 356.87 65.06C360.15 65.61 363.34 66.69 366.61 67.32C369.88 67.95 373.24 68.15 376.5 68.83C379.75 69.51 382.94 70.52 386.15 71.4C389.37 72.29 392.57 73.22 395.77 74.17C398.96 75.12 402.16 76.05 405.32 77.11C408.48 78.17 411.62 79.3 414.73 80.51C417.83 81.71 420.93 82.97 423.97 84.32C427.02 85.67 430.02 87.13 433 88.61C435.98 90.1 438.94 91.65 441.87 93.22C444.81 94.79 447.75 96.38 450.62 98.06C453.5 99.74 456.33 101.5 459.14 103.3C461.94 105.11 464.71 106.97 467.44 108.88C470.17 110.79 472.85 112.78 475.52 114.77C478.19 116.76 480.8 118.83 483.46 120.85C486.12 122.86 488.88 124.74 491.45 126.86C494.02 128.97 496.48 131.24 498.9 133.52C501.32 135.81 503.65 138.2 505.99 140.58C508.32 142.96 510.72 145.29 512.9 147.8C515.08 150.31 517.05 153.01 519.09 155.65C521.12 158.29 523.1 160.97 525.11 163.63C527.12 166.29 529.21 168.89 531.13 171.62C533.04 174.34 534.84 177.16 536.61 179.98C538.38 182.8 540.17 185.63 541.75 188.56C543.34 191.48 544.86 194.47 546.12 197.54C547.38 200.62 548.52 203.79 549.32 207.01C550.12 210.23 550.69 213.56 550.92 216.86C551.14 220.17 551.09 223.56 550.68 226.85C550.27 230.14 549.39 233.39 548.46 236.58C547.52 239.77 546.42 242.95 545.07 245.98C543.71 249.02 542.19 252.03 540.34 254.78C538.5 257.53 536.28 260.08 534 262.5C531.71 264.91 529.26 267.21 526.65 269.27C524.04 271.32 521.26 273.24 518.35 274.83C515.44 276.41 512.31 277.65 509.19 278.79C506.06 279.93 502.86 280.99 499.61 281.67C496.37 282.36 493.01 282.91 489.71 282.89C486.42 282.86 483.08 282.21 479.83 281.53C476.58 280.85 473.35 279.89 470.21 278.8C467.07 277.72 463.91 276.55 460.98 275C458.05 273.45 455.26 271.54 452.64 269.51C450.02 267.47 447.56 265.17 445.26 262.77C442.96 260.37 440.83 257.78 438.84 255.11C436.84 252.45 435.15 249.56 433.3 246.79C431.45 244.02 429.73 241.14 427.74 238.48C425.75 235.82 423.58 233.27 421.33 230.81C419.09 228.35 416.68 226.04 414.27 223.73C411.87 221.42 409.45 219.12 406.9 216.97C404.36 214.83 401.7 212.8 399 210.86C396.29 208.92 393.5 207.09 390.65 205.35C387.8 203.62 384.89 201.98 381.92 200.47C378.95 198.96 375.92 197.56 372.84 196.29C369.76 195.03 366.61 193.91 363.45 192.87C360.28 191.83 357.06 190.95 353.84 190.08C350.63 189.21 347.43 188.16 344.15 187.64C340.88 187.13 337.51 187.11 334.19 187C330.86 186.89 327.52 187 324.19 187C320.85 187 317.52 186.99 314.19 187C310.85 187.01 307.5 186.8 304.19 187.08C300.88 187.35 297.59 187.95 294.33 188.64C291.08 189.33 287.87 190.29 284.67 191.22C281.47 192.14 278.25 193.03 275.12 194.17C272 195.31 268.94 196.67 265.92 198.08C262.9 199.48 259.89 200.93 257.01 202.59C254.12 204.25 251.36 206.14 248.62 208.03C245.88 209.92 243.22 211.93 240.56 213.95C237.91 215.96 235.23 217.95 232.71 220.13C230.19 222.31 227.77 224.62 225.44 227C223.12 229.39 220.87 231.86 218.76 234.43C216.64 237 214.69 239.72 212.76 242.43C210.83 245.14 208.87 247.86 207.16 250.71C205.44 253.56 203.94 256.55 202.45 259.53C200.96 262.51 199.53 265.52 198.22 268.59C196.92 271.65 195.7 274.76 194.64 277.92C193.57 281.07 192.54 284.26 191.83 287.5C191.11 290.75 190.95 294.12 190.34 297.39C189.72 300.66 188.69 303.86 188.14 307.14C187.58 310.42 187.19 313.75 187.03 317.07C186.88 320.38 186.86 323.76 187.21 327.06C187.55 330.36 188.46 333.6 189.09 336.86C189.73 340.13 190.34 343.41 191.01 346.67C191.68 349.93 192.21 353.23 193.1 356.44C193.98 359.64 195.15 362.79 196.34 365.9C197.53 369.01 198.85 372.08 200.26 375.09C201.68 378.11 203.2 381.08 204.82 383.99C206.44 386.9 208.18 389.75 209.99 392.55C211.81 395.34 213.7 398.1 215.71 400.75C217.72 403.4 219.84 405.99 222.07 408.46C224.29 410.94 226.84 413.14 229.07 415.6C231.29 418.07 234.24 420.36 235.44 423.26C236.64 426.15 236.53 429.76 236.25 433C235.97 436.23 234.64 439.46 233.78 442.68C232.92 445.9 231.99 449.11 231.11 452.32C230.22 455.53 229.06 458.71 228.46 461.97C227.87 465.22 226.54 469.23 227.51 471.85C228.49 474.46 231.62 477.29 234.29 477.66C236.97 478.03 240.54 475.43 243.57 474.07C246.6 472.71 249.51 471.03 252.47 469.51C255.43 467.99 258.41 466.48 261.35 464.92C264.3 463.36 267.2 461.72 270.14 460.15C273.08 458.59 275.98 456.91 279.01 455.53C282.03 454.15 285.09 452.55 288.29 451.88C291.49 451.2 294.91 451.45 298.23 451.47C301.55 451.49 304.88 451.91 308.21 452C311.54 452.08 314.88 452 318.21 452C321.55 452 324.88 452.01 328.21 452C331.55 451.99 334.9 452.21 338.21 451.93C341.52 451.65 344.81 451.04 348.06 450.33C351.31 449.62 354.5 448.61 357.7 447.67C360.9 446.74 364.11 445.83 367.25 444.71C370.38 443.58 373.48 442.33 376.5 440.93C379.52 439.53 382.47 437.95 385.37 436.33C388.28 434.7 391.13 432.97 393.95 431.18C396.76 429.39 399.58 427.6 402.24 425.6C404.9 423.6 407.43 421.41 409.92 419.2C412.41 416.98 414.84 414.69 417.17 412.31C419.5 409.94 421.81 407.51 423.92 404.94C426.03 402.37 427.91 399.6 429.85 396.89C431.79 394.18 433.61 391.39 435.55 388.67C437.48 385.96 439.31 383.15 441.46 380.61C443.61 378.08 445.96 375.68 448.44 373.47C450.92 371.26 453.58 369.2 456.35 367.36C459.12 365.53 462.03 363.83 465.05 362.45C468.07 361.08 471.28 360.09 474.47 359.13C477.65 358.16 480.88 357.1 484.15 356.65C487.42 356.2 490.82 356.12 494.11 356.44C497.39 356.76 500.65 357.72 503.86 358.59C507.07 359.47 510.32 360.39 513.36 361.69C516.41 363 519.38 364.61 522.16 366.43C524.93 368.25 527.54 370.38 530.01 372.61C532.47 374.83 534.83 377.23 536.96 379.78C539.09 382.33 541.11 385.03 542.78 387.89C544.46 390.75 545.8 393.85 547 396.95C548.2 400.05 549.31 403.24 549.98 406.48C550.64 409.73 550.86 413.09 550.99 416.41C551.11 419.73 551.16 423.12 550.72 426.4C550.29 429.69 549.4 432.94 548.4 436.1C547.39 439.27 546.1 442.37 544.68 445.38C543.26 448.39 541.59 451.29 539.89 454.15C538.19 457.01 536.34 459.79 534.47 462.55C532.6 465.31 530.69 468.05 528.68 470.71C526.68 473.37 524.51 475.9 522.44 478.51C520.36 481.12 518.33 483.76 516.25 486.37C514.17 488.97 512.15 491.63 509.95 494.13C507.75 496.63 505.39 499 503.04 501.36C500.69 503.72 498.33 506.09 495.84 508.3C493.34 510.5 490.68 512.51 488.07 514.59C485.47 516.67 482.84 518.71 480.23 520.79C477.61 522.86 475.1 525.06 472.41 527.02C469.72 528.99 466.9 530.77 464.11 532.59C461.31 534.4 458.48 536.17 455.64 537.91C452.79 539.64 449.93 541.35 447.02 542.98C444.11 544.61 441.16 546.15 438.2 547.68C435.24 549.22 432.29 550.78 429.28 552.19C426.26 553.6 423.18 554.88 420.1 556.14C417.01 557.41 413.91 558.62 410.78 559.77C407.65 560.92 404.5 562.01 401.33 563.05C398.17 564.09 394.98 565.06 391.78 566.02C388.59 566.97 385.41 568 382.18 568.81C378.95 569.61 375.68 570.24 372.41 570.85C369.13 571.46 365.82 571.85 362.55 572.47C359.28 573.1 356.08 574.19 352.79 574.61C349.5 575.03 346.13 574.94 342.8 575C339.47 575.06 336.13 575 332.8 575C329.47 575 326.13 575 322.8 575C319.47 575 316.13 575 312.8 575C309.47 575 306.13 575.02 302.8 575C299.47 574.98 296.11 575.15 292.8 574.86C289.5 574.56 286.23 573.82 282.96 573.22C279.68 572.62 276.43 571.88 273.16 571.25C269.89 570.62 266.58 570.17 263.33 569.43C260.09 568.7 256.89 567.73 253.67 566.85C250.46 565.98 247.22 565.17 244.04 564.17C240.86 563.18 237.74 562 234.6 560.87C231.47 559.74 228.33 558.62 225.23 557.38C222.14 556.15 219.06 554.85 216.03 553.47C213 552.08 210.03 550.58 207.05 549.07C204.08 547.56 201.13 546.02 198.2 544.42C195.28 542.82 192.36 541.2 189.5 539.48C186.65 537.77 183.84 535.97 181.05 534.15C178.26 532.32 175.49 530.46 172.78 528.53C170.06 526.59 167.42 524.56 164.77 522.55C162.11 520.53 159.47 518.49 156.86 516.42C154.25 514.35 151.59 512.34 149.08 510.14C146.58 507.94 144.21 505.59 141.84 503.24C139.48 500.9 137.11 498.54 134.88 496.07C132.64 493.6 130.56 491 128.46 488.41C126.36 485.82 124.36 483.15 122.28 480.55C120.19 477.95 117.98 475.45 115.94 472.81C113.9 470.18 111.94 467.48 110.03 464.75C108.12 462.02 106.27 459.24 104.48 456.43C102.69 453.62 100.96 450.77 99.28 447.89C97.6 445.01 95.94 442.12 94.4 439.16C92.85 436.21 91.44 433.19 90.03 430.17C88.61 427.15 87.23 424.12 85.91 421.06C84.6 418 83.37 414.9 82.14 411.8C80.92 408.7 79.67 405.6 78.56 402.46C77.46 399.32 76.47 396.13 75.52 392.94C74.57 389.74 73.61 386.55 72.84 383.31C72.07 380.07 71.61 376.75 70.9 373.5C70.19 370.24 69.11 367.05 68.58 363.77C68.05 360.49 68.13 357.12 67.72 353.82C67.31 350.51 66.64 347.24 66.12 343.95C65.6 340.66 64.95 337.38 64.61 334.07C64.26 330.76 64.14 327.42 64.04 324.09C63.94 320.76 63.93 317.42 64.01 314.09C64.08 310.76 64.11 307.41 64.5 304.11C64.89 300.81 65.8 297.57 66.36 294.29C66.91 291 67.47 287.71 67.83 284.41C68.19 281.1 68.04 277.72 68.53 274.44C69.02 271.15 70.04 267.95 70.78 264.7C71.53 261.45 72.16 258.17 73.01 254.95C73.86 251.73 74.89 248.56 75.88 245.37C76.87 242.19 77.9 239.02 78.98 235.87C80.06 232.71 81.16 229.57 82.37 226.46C83.58 223.36 84.9 220.3 86.23 217.24C87.55 214.18 88.86 211.11 90.29 208.1C91.72 205.09 93.25 202.13 94.83 199.19C96.41 196.26 98.04 193.35 99.75 190.49C101.47 187.64 103.32 184.86 105.12 182.06C106.93 179.25 108.71 176.43 110.57 173.67C112.44 170.91 114.36 168.18 116.32 165.49C118.29 162.8 120.33 160.16 122.36 157.52C124.4 154.88 126.37 152.19 128.53 149.65C130.69 147.11 133 144.71 135.31 142.31C137.62 139.9 139.99 137.55 142.38 135.23C144.77 132.91 147.15 130.56 149.67 128.39C152.18 126.21 154.87 124.22 157.49 122.16C160.11 120.1 162.73 118.04 165.39 116.04C168.06 114.03 170.75 112.07 173.47 110.14C176.18 108.21 178.92 106.31 181.7 104.46C184.48 102.62 187.27 100.79 190.13 99.09C192.99 97.38 195.95 95.83 198.88 94.25C201.82 92.67 204.75 91.09 207.74 89.61C210.72 88.13 213.75 86.73 216.79 85.37C219.83 84.01 222.91 82.72 226 81.47C229.09 80.22 232.21 79.04 235.32 77.86C238.44 76.69 241.53 75.41 244.71 74.41C247.89 73.42 251.15 72.72 254.38 71.89C257.61 71.06 260.82 70.15 264.08 69.45C267.33 68.74 270.64 68.3 273.91 67.66C277.18 67.03 281.52 66.11 283.7 65.66C285.88 65.2 284.79 65.2 287 64.93Z"></path><circle fill="#FF9C7E" cx="259.5" cy="307.5" r="27.5"></circle><circle fill="#FF9C7E" cx="331.5" cy="307.5" r="27.5"></circle><circle fill="#FF9C7E" cx="403.5" cy="307.5" r="27.5"></circle></svg>`;
  const tema = temaDo(rel);

  const el = document.createElement("div");
  el.style.cssText = `width:720px;background:${PAPER};color:${TINTA};font-family:'Outfit',Arial,sans-serif;box-sizing:border-box;`;
  el.innerHTML =
    `<header style="background:${tema};color:#fff;padding:24px 34px 44px;position:relative;overflow:hidden;` +
    'display:flex;justify-content:space-between;align-items:flex-start;">' +
    '<svg viewBox="0 0 720 130" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;opacity:.09;">' +
    '<circle cx="620" cy="15" r="105" fill="#FFFFFF"/><circle cx="535" cy="112" r="58" fill="none" stroke="#FFFFFF" stroke-width="2"/></svg>' +
    '<div style="position:relative;z-index:1;">' +
    '<div style="display:flex;align-items:center;gap:11px;">' +
    `<div style="width:33px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;">${logoSvgInline}</div>` +
    `<div style="font-weight:800;font-size:21px;line-height:1;letter-spacing:-0.035em;color:#FFFFFF;white-space:nowrap;">Olá<span style="color:#FF9C7E;">,</span> Contador<span style="color:#FF9C7E;">.</span></div></div>` +
    '<div style="font-size:9px;color:rgba(255,255,255,0.85);margin-top:5px;margin-left:44px;letter-spacing:0.25px;">Seu contador pessoal a um clique de distância.</div></div>' +
    '<div style="text-align:right;font-size:9.5px;line-height:1.5;position:relative;z-index:1;padding-top:2px;">' +
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
    "</div></div></section>" +
    '</main>' +
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
    
    // Faixa informativa da plataforma logo acima da barra de validação
    pdf.setTextColor(110, 120, 115);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.8);
    pdf.text(
      "Este relatório foi emitido pelo Olá, Contador após a conclusão do seu atendimento.",
      8,
      265
    );
    pdf.setTextColor(rgbTema[0], rgbTema[1], rgbTema[2]);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.0);
    pdf.text("Acesse nossa plataforma: www.olacontador.com.br", 202, 265, { align: "right" });

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
    
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(no, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: "#FFFFFF" 
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }) as unknown as MinimalPdf;

    const larguraMaxima = 194;
    const alturaMaxima = 254;
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
