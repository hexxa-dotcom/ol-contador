import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { validarRelatorioPublico } from "@/lib/reportValidation";
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
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  const result = codigo ? await validarRelatorioPublico(codigo) : { valido: false as const, error: "codigo_ausente" };
  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <div className={styles.wrap}>
          {result.valido ? (
            <>
              <h1>Relatório autêntico</h1>
              <p>O código corresponde a um relatório entregue pelo Olá, Contador.</p>
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
              <p className={styles.atualizado}>
                Esta página confirma apenas a emissão, autoria, versão e integridade do registro. O conteúdo
                completo permanece disponível exclusivamente na Área do Cliente.
              </p>
            </>
          ) : (
            <>
              <h1>Relatório não localizado</h1>
              <p>O código é inválido, ainda não foi entregue ou não pertence a um relatório emitido pelo Olá, Contador.</p>
            </>
          )}
          <Link href="/">Voltar para Olá, Contador</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
