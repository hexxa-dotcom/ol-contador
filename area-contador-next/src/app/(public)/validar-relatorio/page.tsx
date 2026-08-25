import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { validarRelatorioPublico, ReportValidationResult } from "@/lib/reportValidation";
import styles from "../legal.module.css";

export const metadata = {
  title: "Validar relatório — Olá, Contador",
  robots: { index: false, follow: false },
};

function dataBR(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function ValidarRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string; cpf?: string; protocolo?: string }>;
}) {
  const { codigo, cpf, protocolo } = await searchParams;
  let result: ReportValidationResult = { valido: false as const, error: "codigo_ausente" };

  if (codigo) {
    result = await validarRelatorioPublico(codigo);
  } else if (cpf && protocolo) {
    result = await validarRelatorioPublico({ cpf, protocolo });
  }

  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <div className={styles.wrap}>
          <div style={{ marginBottom: "32px" }}>
            <Link href="/" style={{ fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Voltar para a página inicial
            </Link>
          </div>

          {result.valido ? (
            <div style={{ marginTop: "16px" }}>
              <h1>Relatório autêntico</h1>
              <p>Os dados correspondem a um relatório entregue pelo Olá, Contador.</p>
              <div className={styles.box}>
                <p><strong>Relatório:</strong> {result.titulo}</p>
                <p><strong>Protocolo:</strong> {result.protocolo}</p>
                <p><strong>Versão:</strong> v{result.versao}</p>
                <p><strong>Cliente:</strong> {result.cliente}</p>
                <p><strong>Documento:</strong> {result.documento}</p>
                <p>
                  <strong>Contador responsável:</strong> {result.contador}
                  {result.crc ? ` · CRC ${result.crc}` : ""}
                </p>
                <p><strong>Entregue em:</strong> {dataBR(result.entregueEm)}</p>
              </div>
              <p className={styles.atualizado} style={{ marginBottom: "24px" }}>
                Esta página confirma apenas a emissão, autoria, versão e integridade do registro. O conteúdo
                completo permanece disponível exclusivamente na Área do Cliente.
              </p>
              <Link href="/validar-relatorio" style={{ fontWeight: 600, display: "inline-block", marginTop: "8px" }}>Fazer nova consulta</Link>
            </div>
          ) : (
            <div style={{ marginTop: "16px" }}>
              {result.error === "codigo_ausente" ? (
                <>
                  <h1>Validar Relatório</h1>
                  <p>Consulte a autenticidade de um relatório de atendimento emitido pelo Olá, Contador preenchendo os dados abaixo.</p>
                </>
              ) : (
                <>
                  <h1 style={{ color: "#EE5F3A" }}>Relatório não localizado</h1>
                  <p>Os dados fornecidos não conferem, o relatório ainda não foi entregue, ou não pertence a um documento emitido pelo Olá, Contador.</p>
                </>
              )}
              
              <form method="GET" action="/validar-relatorio" style={{ marginTop: "32px", marginBottom: "32px", display: "flex", gap: "20px", flexDirection: "column" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label htmlFor="cpf" style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>CPF ou CNPJ do Cliente</label>
                  <input 
                    type="text" 
                    name="cpf" 
                    id="cpf"
                    defaultValue={cpf || ""}
                    placeholder="Somente números"
                    required
                    style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "16px", outline: "none", background: "#fff", color: "var(--foreground)" }}
                  />
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label htmlFor="protocolo" style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Número do Protocolo</label>
                  <input 
                    type="text" 
                    name="protocolo" 
                    id="protocolo"
                    defaultValue={protocolo || ""}
                    placeholder="Ex: OC-R000123-V1"
                    required
                    style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "16px", outline: "none", background: "#fff", color: "var(--foreground)", textTransform: "uppercase" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>O protocolo padrão localiza-se no canto superior direito ou no rodapé de segurança do PDF.</span>
                </div>
                
                <button 
                  type="submit" 
                  style={{
                    padding: "14px 24px",
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "15px",
                    cursor: "pointer",
                    marginTop: "12px"
                  }}
                >
                  Consultar Autenticidade
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
