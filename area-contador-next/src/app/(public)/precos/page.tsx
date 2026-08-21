import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { FaqAccordion } from "../faq-accordion";
import { PricingGrid } from "./pricing-grid";
import { PassosComoFunciona } from "./passos-como-funciona";
import { 
  ShieldCheck, 
  ArrowRight, 
  Clock, 
  MessageSquareText, 
  FileCheck,
  CalendarCheck
} from "lucide-react";
import styles from "./precos.module.css";

export const revalidate = 600; // Cache ISR com revalidação em segundo plano a cada 10 minutos

const PASSOS = [
  { n: "1", t: "Agende seu horário", d: "Escolha o dia e o horário que funcionam para você. Leva menos de um minuto.", icon: CalendarCheck },
  { n: "2", t: "Conte o seu caso", d: "Com o horário garantido, escreva o que aconteceu com suas palavras e anexa o que tiver.", icon: MessageSquareText },
  { n: "3", t: "Resolva no chat seguro", d: "No horário marcado, fale direto com o contador no chat seguro. Documentos entram e saem por ali.", icon: Clock },
  { n: "4", t: "Receba o relatório", d: "No fim, um PDF assinado com CRC: o que aconteceu, o que foi feito e os próximos passos.", icon: FileCheck },
];

function formatReais(cents: number): string {
  return `R$ ${Math.round(cents / 100)}`;
}

function faqList(consultaCents: number) {
  return [
    { p: "Preciso entender de imposto para ser atendido?", r: 'Não. Você conta o que aconteceu com as suas palavras — "recebi uma carta assustadora", "vendi meu carro", "não declarei ano passado" — e anexa o que tiver. Traduzir a burocracia é o nosso trabalho, não o seu.' },
    { p: "O que é o relatório do atendimento?", r: "É um PDF assinado por contador com registro CRC dizendo o que aconteceu, o que foi feito e o que vem agora — como uma receita médica, só que do seu imposto. Fica guardado na sua área do cliente para baixar quando quiser." },
    { p: "Como funciona o pagamento?", r: "Preço fixo, combinado antes, pago na hora de agendar — no Pix (com 5% de desconto) ou no cartão, em até 3x. Sem mensalidade e sem fidelidade: você paga pelo atendimento que usar. No plano sob demanda, o valor é fechado por escrito antes de qualquer cobrança." },
    { p: "O diagnóstico do plano sob demanda é cobrado?", r: `Sim: ${formatReais(consultaCents)}, o mesmo valor de um atendimento avulso — porque é trabalho de contador de verdade. Ele analisa o seu caso e devolve um plano por escrito, com escopo, prazo e valor fechados. Se você aprovar o orçamento, esse valor é abatido do total: na prática, o diagnóstico sai de graça para quem segue. Se preferir não seguir, o diagnóstico é seu.` },
    { p: "Em quanto tempo meu caso é resolvido?", r: "Para pessoa física, em até 24 horas — muitos casos se resolvem no mesmo dia. Para empresas, em até 48 horas. E você não fica no escuro: pela área do cliente acompanha cada etapa, do pré-atendimento ao relatório entregue." },
    { p: "E se eu ficar com dúvida depois?", r: "Você tem retorno grátis em até 7 dias após o atendimento. E como os próximos passos ficam por escrito no relatório, você não depende da memória — nem da nossa, nem da sua." },
  ];
}

async function precoDe(id: string, fallbackCents: number): Promise<number> {
  const admin = adminClient();
  if (!admin) return fallbackCents;
  const { data } = await admin.from("servicos").select("price_cents").eq("id", id).maybeSingle();
  return data?.price_cents ?? fallbackCents;
}

async function precos() {
  const [pf, pj, consulta] = await Promise.all([
    precoDe("pf", 19900),
    precoDe("pj-atendimento", 39900),
    precoDe("consulta", 19900)
  ]);
  return { pf, pj, consulta };
}

export async function generateMetadata() {
  const { pf, pj } = await precos();
  return {
    title: "Planos e preços — Olá, Contador",
    description: `Preço fixo por atendimento, combinado antes. Chat seguro com contador, relatório assinado com CRC e área do cliente para acompanhar tudo. PF ${formatReais(pf)}, PJ ${formatReais(pj)}.`,
  };
}

export default async function PrecosPage() {
  const { pf, pj, consulta } = await precos();
  const FAQ = faqList(consulta);
  const JSON_LD_FAQ = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.p,
      acceptedAnswer: { "@type": "Answer", text: item.r },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_FAQ) }} />
      <SiteHeader active="precos" />
      <main className={styles.mainWrapper}>
        <div className={styles.container}>
          {/* PASSOS COMO FUNCIONA INTERATIVO */}
          <PassosComoFunciona />

          {/* GRID INTERATIVO DE PLANOS 3D */}
          <PricingGrid pfCents={pf} pjCents={pj} consultaCents={consulta} />

          {/* GARANTIA */}
          <div className={styles.garantiaBox}>
            <div className={styles.garantiaIconWrap}>
              <ShieldCheck size={28} />
            </div>
            <div className={styles.garantiaText}>
              <b>Garantia Incondicional de Reembolso</b>
              <span>Você paga na hora de agendar. Se o contador avaliar seu caso e concluir que não temos como ajudar, devolvemos 100% do valor integralmente. Sem burocracia ou letras miúdas.</span>
            </div>
          </div>

          {/* FAQ */}
          <section className={styles.faqSection}>
            <div className={styles.faqHeader}>
              <h2 className={styles.faqTitle}>Perguntas de quem chegou até aqui</h2>
              <p className={styles.faqSub}>Tire suas dúvidas antes de agendar seu atendimento</p>
            </div>
            <FaqAccordion faqList={FAQ} />
          </section>

          {/* CTA FINAL */}
          <section className={styles.ctaFinal}>
            <h2 className={styles.ctaTitle}>Quanto custa continuar adiando isso?</h2>
            <p className={styles.ctaDesc}>
              Multa e juros da Receita não esperam. Um atendimento com preço fixo resolve — e você sai com o caminho por escrito.
            </p>
            <div className={styles.ctaActions}>
              <a className={styles.btnCtaMain} href="#planos">
                <span>Agendar meu atendimento</span>
                <ArrowRight size={20} />
              </a>
              <div className={styles.ctaSubLink}>
                ou <a href="mailto:ola@olacontador.com.br?subject=Pedido%20de%20or%C3%A7amento">peça um orçamento sob demanda</a>
              </div>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
