import Link from "next/link";
import { Radar as RadarIcon, ShieldCheck, Inbox, FileText, HeartPulse, BellRing, CheckCircle2 } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { Reveal } from "../carrossel";
import { TimelineSteps } from "../timeline-steps";
import { FaqAccordion } from "../faq-accordion";
import homeStyles from "../home.module.css";
import styles from "./radar.module.css";

export const metadata = {
  title: "Radar Fiscal — monitoramento contínuo | Olá, Contador",
  description: "O Radar Fiscal verifica toda semana a sua situação com a Receita Federal e avisa antes que uma pendência vire multa.",
};

const AVISE_ME = "mailto:ola@olacontador.com.br?subject=Quero%20ser%20avisado%20quando%20o%20Radar%20Fiscal%20abrir";

const PASSOS = [
  { n: "01", t: "Assine o plano", d: "Mensal ou anual, no Pix ou no cartão." },
  { n: "02", t: "Outorgue a procuração", d: "Autorização de consulta no e-CAC, com passo a passo." },
  { n: "03", t: "A gente verifica toda semana", d: "Caixa postal e certidões, sem você precisar lembrar." },
  { n: "04", t: "Você é avisado e o contador age", d: "Assim que aparece algo novo, ninguém fica sabendo por último." },
];

const MONITORA = [
  { Icon: ShieldCheck, label: "Certidão e situação fiscal" },
  { Icon: Inbox, label: "Caixa postal do e-CAC" },
  { Icon: FileText, label: "Guia do parcelamento" },
  { Icon: HeartPulse, label: "Relatório mensal de saúde fiscal" },
  { Icon: BellRing, label: "Aviso antecipado por e-mail" },
];

const FAQ = [
  { p: "O que é o Radar Fiscal?", r: 'É um serviço de monitoramento contínuo do seu CPF ou CNPJ — algo como um "Serasa da Receita Federal". Ele acompanha certidões e situação fiscal, verifica a caixa postal do e-CAC e emite as guias dos seus parcelamentos, avisando quando aparece uma pendência.' },
  { p: "Como o Radar Fiscal descobre uma pendência?", r: "Você outorga uma procuração eletrônica no e-CAC para o CNPJ do escritório. A partir daí verificamos sua caixa postal toda semana e consultamos suas certidões, avisando assim que aparece algo novo." },
  { p: "A procuração eletrônica é segura?", r: "É uma autorização emitida no próprio e-CAC que dá acesso só de consulta — não permite movimentar nada em seu nome. Pode ser revogada a qualquer momento por lá." },
  { p: "Tenho parcelamento com a Receita. O Radar ajuda com isso?", r: "Sim — a guia do mês (Simples Nacional, MEI ou PGFN) é gerada e enviada automaticamente pro seu e-mail. Se uma parcela ficar em aberto, você é avisado antes que vire pendência." },
  { p: "O que vem no relatório mensal de saúde fiscal?", r: "Um PDF com o timbrado do escritório dizendo, em linguagem simples, se há débito em aberto na Receita e quanto já foi pago — o mesmo acompanhamento de um contador tradicional, só que automático." },
  { p: "Qual a diferença entre mensal e anual?", r: "Mensal: sem fidelidade, R$ 49,90/mês. Anual: cobrança única de R$ 358,80 (R$ 29,90/mês equivalente), com 1 atendimento incluso no ano e desconto nos demais serviços." },
  { p: "Quando o Radar Fiscal fica disponível?", r: "Estamos validando a integração com a Receita Federal antes de abrir pra todo mundo. Quem deixar o e-mail é avisado assim que a assinatura abrir de verdade." },
];

export default function RadarPage() {
  return (
    <>
      <SiteHeader active="radar" />

      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <RadarIcon size={15} strokeWidth={2} />
          Assinatura em validação — abre em breve
        </div>
        <h1 className={styles.title}>Descubra o problema com a Receita antes que ele vire multa</h1>
        <p className={styles.sub}>
          A Receita avisa pela caixa postal do e-CAC — e quase ninguém entra lá pra conferir. O Radar Fiscal verifica
          toda semana e te avisa antes que o CPF trave num banco ou a empresa não consiga emitir nota.
        </p>
        <div className={styles.heroActions}>
          <a className={homeStyles.btnPrimary} href="#planos">Ver planos e preços</a>
          <a className={homeStyles.btnGhost} style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} href={AVISE_ME}>Avise-me quando abrir</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Como funciona</span>
              <h2 className={styles.sectionTitle}>Você assina, a gente vigia</h2>
            </div>
          </Reveal>
          <Reveal>
            <TimelineSteps steps={PASSOS} />
          </Reveal>
        </div>
      </section>

      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Cobertura</span>
              <h2 className={styles.sectionTitle}>O que o Radar Fiscal monitora</h2>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.monitoraGrid}>
              {MONITORA.map(({ Icon, label }) => (
                <div className={styles.monitoraItem} key={label}>
                  <Icon size={16} strokeWidth={2} />
                  {label}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.section} style={{ paddingTop: 0 }} id="planos">
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Planos e preços</span>
              <h2 className={styles.sectionTitle}>Escolha mensal ou anual</h2>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.planos}>
              <div className={styles.plano}>
                <div className={styles.planoTopo}>
                  <span className={styles.planoNome}>Mensal</span>
                  <span className={styles.badge}>Sem fidelidade</span>
                </div>
                <div className={styles.preco}>R$ 49,90</div>
                <div className={styles.precoNota}>por mês, cancele quando quiser</div>
                <ul className={styles.lista}>
                  <li><CheckCircle2 size={15} strokeWidth={2} /> Monitoramento semanal da caixa postal e certidões</li>
                  <li><CheckCircle2 size={15} strokeWidth={2} /> Guia do parcelamento enviada todo mês</li>
                  <li><CheckCircle2 size={15} strokeWidth={2} /> Relatório mensal de saúde fiscal em PDF</li>
                </ul>
                <a className={styles.planoCta} href={`${AVISE_ME}%20(mensal)`}>Avise-me quando abrir</a>
              </div>
              <div className={`${styles.plano} ${styles.planoDestaque}`}>
                <div className={styles.planoTopo}>
                  <span className={styles.planoNome}>Anual</span>
                  <span className={styles.badge}>Mais vantajoso</span>
                </div>
                <div className={styles.preco}>R$ 29,90<span style={{ fontSize: "0.9rem", fontWeight: 600 }}>/mês</span></div>
                <div className={styles.precoNota}>cobrança única de R$ 358,80</div>
                <ul className={styles.lista}>
                  <li><CheckCircle2 size={15} strokeWidth={2} /> Tudo do plano mensal</li>
                  <li><CheckCircle2 size={15} strokeWidth={2} /> 1 atendimento agendado incluso no ano</li>
                  <li><CheckCircle2 size={15} strokeWidth={2} /> Desconto nos demais serviços</li>
                </ul>
                <a className={styles.planoCta} href={`${AVISE_ME}%20(anual)`}>Avise-me quando abrir</a>
              </div>
            </div>
          </Reveal>
          <p className={styles.avisoValidacao}>Estamos validando a integração com a Receita Federal. Nenhuma cobrança é feita antes da assinatura abrir de verdade.</p>
          <p className={styles.confiancaLinha}>Sem fidelidade no mensal · procuração revogável a qualquer momento · sigilo profissional</p>
        </div>
      </section>

      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Perguntas sobre o Radar Fiscal</h2>
            </div>
          </Reveal>
          <Reveal>
            <FaqAccordion faqList={FAQ} />
          </Reveal>
        </div>
      </section>

      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.ctaFinal}>
              <h2>Não espere a Receita te avisar tarde demais</h2>
              <p>Deixe seu e-mail e a gente avisa assim que o Radar Fiscal abrir pra assinatura.</p>
              <a className={homeStyles.btnPrimary} href={AVISE_ME} style={{ marginTop: 20, display: "inline-block" }}>Avise-me quando abrir</a>
              <div style={{ marginTop: 14, fontSize: 13.5, color: "rgba(255,255,255,.75)" }}>
                ou <Link href="/precos" style={{ color: "var(--pub-coral-light)", fontWeight: 600, textDecoration: "underline" }}>veja os atendimentos disponíveis agora</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
