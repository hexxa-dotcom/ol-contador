import Link from "next/link";
import { Radar as RadarIcon, ShieldCheck, Inbox, FileText, HeartPulse, BellRing, CheckCircle2, ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { Reveal } from "../carrossel";
import { TimelineSteps } from "../timeline-steps";
import { FaqAccordion } from "../faq-accordion";
import styles from "./radar.module.css";

export const metadata = {
  title: "Radar Fiscal — monitoramento contínuo | Olá, Contador",
  description: "O Radar Fiscal verifica toda semana a sua situação com a Receita Federal e avisa antes que uma pendência vire multa.",
};

const AVISE_ME = "mailto:ola@olacontador.com.br?subject=Quero%20ser%20avisado%20quando%20o%20Radar%20Fiscal%20abrir";

const PASSOS = [
  { n: "01", t: "Assine o plano", d: "Mensal ou anual, no Pix ou no cartão." },
  { n: "02", t: "Outorgue a procuração", d: "Autorização de consulta no e-CAC, com passo a passo seguro." },
  { n: "03", t: "A gente verifica toda semana", d: "Caixa postal e certidões ativas, sem você precisar lembrar." },
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

      <main className={styles.mainWrapper}>
        {/* HERO PETRÓLEO */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <RadarIcon size={16} />
              <span>Assinatura em validação — abre em breve</span>
            </div>

            <h1 className={styles.title}>
              Descubra o problema com a Receita<br />
              <span className={styles.accent}>antes que ele vire multa</span>
            </h1>

            <p className={styles.sub}>
              A Receita avisa pela caixa postal do e-CAC — e quase ninguém entra lá pra conferir. O Radar Fiscal verifica toda semana e te avisa antes que o CPF trave no banco ou a empresa fique impedida de emitir nota.
            </p>

            <div className={styles.heroActions}>
              <a className={styles.btnHeroCoral} href="#planos">
                <span>Ver planos e preços</span>
                <ArrowRight size={18} />
              </a>
              <a className={styles.btnHeroGlass} href={AVISE_ME}>
                <span>Avise-me quando abrir</span>
              </a>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
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

        {/* O QUE MONITORA */}
        <section className={styles.section} style={{ paddingTop: 0 }}>
          <div className={styles.container}>
            <Reveal>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Cobertura Total</span>
                <h2 className={styles.sectionTitle}>O que o Radar Fiscal monitora para você</h2>
              </div>
            </Reveal>
            <Reveal>
              <div className={styles.monitoraGrid}>
                {MONITORA.map(({ Icon, label }) => (
                  <div className={styles.monitoraItem} key={label}>
                    <Icon size={18} strokeWidth={2} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* PLANOS E PREÇOS 3D */}
        <section className={styles.section} style={{ paddingTop: 0 }} id="planos">
          <div className={styles.container}>
            <Reveal>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Planos e Preços</span>
                <h2 className={styles.sectionTitle}>Escolha mensal ou anual</h2>
              </div>
            </Reveal>

            <Reveal>
              <div className={styles.planos}>
                
                {/* PLANO MENSAL */}
                <div className={styles.plano}>
                  <div className={styles.planoTopo}>
                    <span className={styles.planoNome}>Mensal</span>
                    <span className={styles.badge}>Sem Fidelidade</span>
                  </div>
                  <div className={styles.preco}>R$ 49,90<span style={{ fontSize: "1rem", fontWeight: 600 }}>/mês</span></div>
                  <div className={styles.precoNota}>cancele quando quiser</div>
                  <ul className={styles.lista}>
                    <li><CheckCircle2 size={16} /> Monitoramento semanal da caixa postal e certidões</li>
                    <li><CheckCircle2 size={16} /> Guia do parcelamento enviada todo mês</li>
                    <li><CheckCircle2 size={16} /> Relatório mensal de saúde fiscal em PDF</li>
                  </ul>
                  <a className={styles.planoCta} href={`${AVISE_ME}%20(mensal)`}>
                    <span>Avise-me quando abrir</span>
                  </a>
                </div>

                {/* PLANO ANUAL (DESTAQUE DARK EMBOSSED) */}
                <div className={`${styles.plano} ${styles.planoDestaque}`}>
                  <div className={styles.planoTopo}>
                    <span className={styles.planoNome}>Anual</span>
                    <span className={styles.badge}>Mais Vantajoso</span>
                  </div>
                  <div className={styles.preco}>R$ 29,90<span style={{ fontSize: "1rem", fontWeight: 600 }}>/mês</span></div>
                  <div className={styles.precoNota}>cobrança única de R$ 358,80 (economize R$ 240/ano)</div>
                  <ul className={styles.lista}>
                    <li><CheckCircle2 size={16} /> Tudo do plano mensal</li>
                    <li><CheckCircle2 size={16} /> 1 atendimento agendado incluso no ano</li>
                    <li><CheckCircle2 size={16} /> Desconto exclusivo nos demais serviços</li>
                  </ul>
                  <a className={styles.planoCta} href={`${AVISE_ME}%20(anual)`}>
                    <span>Avise-me quando abrir</span>
                  </a>
                </div>

              </div>
            </Reveal>

            <p className={styles.avisoValidacao}>
              Estamos validando a integração com a Receita Federal. Nenhuma cobrança é feita antes da assinatura abrir de verdade.
            </p>
            <p className={styles.confiancaLinha}>
              Sem fidelidade no mensal · procuração revogável a qualquer momento · sigilo profissional garantido
            </p>
          </div>
        </section>

        {/* FAQ ACCORDION */}
        <section className={styles.section} style={{ paddingTop: 0 }}>
          <div className={styles.container}>
            <Reveal>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Tire suas dúvidas</span>
                <h2 className={styles.sectionTitle}>Perguntas frequentes sobre o Radar Fiscal</h2>
              </div>
            </Reveal>
            <Reveal>
              <FaqAccordion faqList={FAQ} />
            </Reveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className={styles.section} style={{ paddingTop: 0, paddingBottom: 80 }}>
          <div className={styles.container}>
            <Reveal>
              <div className={styles.ctaFinal}>
                <h2>Não espere a Receita te avisar tarde demais</h2>
                <p>Deixe seu e-mail e a gente avisa assim que o Radar Fiscal abrir para assinatura.</p>
                <div style={{ marginTop: 28 }}>
                  <a className={styles.btnHeroCoral} href={AVISE_ME}>
                    <span>Avise-me quando abrir</span>
                    <ArrowRight size={18} />
                  </a>
                </div>
                <div style={{ marginTop: 20, fontSize: "0.95rem", color: "#DCEDE7" }}>
                  ou <Link href="/precos" style={{ color: "#FF9C7E", fontWeight: 700, textDecoration: "underline" }}>veja os atendimentos de preço fixo disponíveis agora</Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

      </main>

      <SiteFooter />
    </>
  );
}
