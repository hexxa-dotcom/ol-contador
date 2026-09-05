import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import styles from "../legal.module.css";

export const metadata = {
  title: "Exclusão de Dados — Olá, Contador",
  description: "Como solicitar a exclusão dos seus dados pessoais na plataforma Olá, Contador, incluindo dados vinculados a integrações como o Instagram.",
};

export default function DataDeletionPage() {
  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <div className={styles.wrap}>
          <h1>Exclusão de Dados</h1>
          <p className={styles.atualizado}>Última atualização: 5 de setembro de 2026</p>

          <p>
            Você pode solicitar a exclusão dos seus dados pessoais tratados pela{" "}
            <strong>Olá, Contador</strong> (operada pela HEXX SERVIÇOS DIGITAIS LTDA, CNPJ nº
            62.414.421/0001-16) a qualquer momento, conforme previsto na nossa{" "}
            <Link href="/privacidade">Política de Privacidade</Link> e na Lei Geral de Proteção de
            Dados (LGPD).
          </p>

          <h2>Como solicitar</h2>
          <div className={styles.box}>
            <p>
              Envie um e-mail para{" "}
              <a href="mailto:ola@olacontador.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados">
                ola@olacontador.com.br
              </a>{" "}
              a partir do endereço cadastrado na sua conta, com o assunto{" "}
              <strong>&quot;Solicitação de exclusão de dados&quot;</strong>, informando seu nome
              completo e CPF/CNPJ. Respondemos e processamos o pedido em até 15 dias úteis.
            </p>
          </div>

          <h2>O que é excluído</h2>
          <ul>
            <li>Dados de cadastro (nome, e-mail, telefone, endereço).</li>
            <li>Documentos enviados pra atendimento e relatórios gerados.</li>
            <li>Histórico de mensagens no chat interno, WhatsApp e Instagram vinculado à sua conta.</li>
          </ul>

          <h2>O que pode ser mantido</h2>
          <p>
            Alguns registros precisam ser preservados por prazo legal, mesmo após a solicitação —
            por exemplo, documentos fiscais e comprovantes de pagamento, que a legislação tributária
            e contábil exige guardar por período determinado. Nesses casos, os dados ficam retidos
            apenas pelo tempo exigido em lei, sem uso para qualquer outra finalidade.
          </p>

          <h2>Dados vinculados a integrações (Instagram, WhatsApp)</h2>
          <p>
            Se você entrou em contato conosco pelo Instagram ou WhatsApp, as mensagens trocadas
            ficam associadas à conversa até a exclusão ser solicitada por esse mesmo canal. Pedir a
            exclusão da sua conta na Olá, Contador remove também essas mensagens do nosso sistema —
            isso não afeta o histórico dentro do próprio Instagram ou WhatsApp, que é gerenciado
            pela Meta e segue as políticas dela.
          </p>

          <div className={styles.rodape}>
            <p>
              <Link href="/">Início</Link> · <Link href="/termos">Termos de Uso</Link> ·{" "}
              <Link href="/privacidade">Política de Privacidade</Link>
              <br />
              © 2026 Olá, Contador · HEXX SERVIÇOS DIGITAIS LTDA · CNPJ 62.414.421/0001-16
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
