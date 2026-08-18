import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { FaqAccordion } from "../faq-accordion";
import { GlowCard } from "@/components/ui/glow-card";
import { 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  User, 
  Building2, 
  FileText, 
  Sparkles,
  Zap,
  Clock,
  MessageSquareText,
  FileCheck
} from "lucide-react";
import styles from "./precos.module.css";

export const metadata = {
  title: "Planos e preços — Olá, Contador",
  description: "Preço fixo e duas formas de resolver: Atendimento Express, mais ágil e sem reunião, ou atendimento com horário. Relatório assinado com CRC.",
};
export const dynamic = "force-dynamic";

const PASSOS = [
  { n: "01", t: "Escolha o serviço", d: "Selecione Pessoa Física, Pessoa Jurídica ou um caso sob demanda.", icon: FileText },
  { n: "02", t: "Escolha o atendimento", d: "Na próxima tela, escolha entre um horário para conversar ou Atendimento Express.", icon: Clock },
  { n: "03", t: "Faça a triagem", d: "Depois da confirmação, explique o caso com suas palavras e envie os documentos pelo celular.", icon: MessageSquareText },
  { n: "04", t: "Receba o relatório", d: "No fim, um PDF assinado com CRC registra o caso, as providências e a resolução.", icon: FileCheck },
];

const FAQ = [
  { p: "Preciso entender de imposto para ser atendido?", r: 'Não. Você conta o que aconteceu com as suas palavras — "recebi uma carta assustadora", "vendi meu carro", "não declarei ano passado" — e anexa o que tiver. Traduzir a burocracia é o nosso trabalho, não o seu.' },
  { p: "O que é o relatório do atendimento?", r: "É um PDF assinado por contador com registro CRC dizendo o que aconteceu, o que foi feito e o que vem agora — como uma receita médica, só que do seu imposto. Fica guardado na sua área do cliente para baixar quando quiser." },
  { p: "Como funciona o pagamento?", r: "Preço fixo, combinado antes, pago na contratação — no Pix ou no cartão, em até 3x. Você escolhe Atendimento Express ou atendimento com horário. Sem mensalidade e sem fidelidade: paga apenas pelo serviço que usar." },
  { p: "O que está incluído no atendimento sob demanda?", r: "O valor exibido cobre a análise inicial, o diagnóstico e um plano de ação por escrito. Se o caso exigir execução adicional, você recebe escopo, prazo e preço antes de decidir contratar." },
  { p: "E se vocês não conseguirem resolver meu caso?", r: "Você recebe 100% de volta. Se o contador avaliar o seu caso e concluir que não temos como ajudar, devolvemos o valor integral — não cobramos por um problema que não resolvemos." },
  { p: "Em quanto tempo meu caso é resolvido?", r: "No Atendimento Express, o prazo padrão é de até 1 dia útil para pessoa física, 2 dias úteis para empresas e 5 dias úteis para casos mais complexos, contado da confirmação do pagamento." },
  { p: "E se eu ficar com dúvida depois?", r: "O caso, as providências realizadas e a resolução ficam por escrito no relatório. Se precisar falar de novo com o contador sobre o mesmo caso, é só chamar no chat." },
];

async function precoDe(id: string, fallbackCents: number): Promise<number> {
  const admin = adminClient();
  if (!admin) return fallbackCents;
  const { data } = await admin.from("servicos").select("price_cents").eq("id", id).maybeSingle();
  return data?.price_cents ?? fallbackCents;
}

export default async function PrecosPage() {
  const [pf, pj, consulta] = await Promise.all([
    precoDe("pf", 19900), 
    precoDe("pj-atendimento", 39900), 
    precoDe("consulta", 19900)
  ]);
  
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cents / 100);

  return (
    <>
      <SiteHeader active="precos" />
      <main style={{ background: "var(--pub-bg)", minHeight: "100vh", paddingBottom: "64px" }}>
        
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span>Preço Fixo e Sem Surpresas</span>
            </div>
            <h1 className={styles.heroTitle}>
              Problema com a Receita tem solução.<br />
              <span className={styles.accent}>E a solução tem preço fixo.</span>
            </h1>
            <p className={styles.heroSub}>
              Você sabe quanto custa antes de começar. Escolha o serviço agora e, na etapa seguinte, decida como prefere ser atendido. No fim, recebe tudo por escrito e assinado por contador com CRC.
            </p>
          </div>
        </section>

        <div className={styles.container}>
          {/* PASSOS */}
          <section className={styles.passosSection}>
            <div className={styles.passosGrid}>
              {PASSOS.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.n} className={styles.passoCard}>
                    <div className={styles.passoHeader}>
                      <span className={styles.passoNum}>{p.n}</span>
                      <Icon size={20} className={styles.passoIcon} />
                    </div>
                    <h3 className={styles.passoTitulo}>{p.t}</h3>
                    <p className={styles.passoDesc}>{p.d}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* GRID DE PLANOS */}
          <section className={styles.planosSection} id="planos">
            <div className={styles.planosGrid}>
              
              {/* PESSOA FÍSICA */}
              <div className={styles.planoCard}>
                <div className={styles.planoHeader}>
                  <div className={styles.planoNome}>
                    <span>Pessoa Física</span>
                    <div className={styles.planoIcon}>
                      <User size={22} />
                    </div>
                  </div>
                  <p className={styles.planoDesc}>
                    Para quem recebeu uma carta da Receita, travou no IR ou vendeu um bem e não sabe o que fazer agora.
                  </p>
                </div>

                <div className={styles.planoPrecoBox}>
                  <div className={styles.precoFlex}>
                    <span className={styles.moeda}>R$</span>
                    <span className={styles.valor}>{money(pf)}</span>
                  </div>
                  <div className={styles.planoPor}>por atendimento · Pix ou até 3x no cartão</div>
                </div>

                <div className={styles.resolveBox}>
                  <div className={styles.resolveRotulo}>Resolve, por exemplo:</div>
                  <div className={styles.chipsList}>
                    {[
                      "Malha fina e cartas da Receita",
                      "Declarar ou corrigir o IR",
                      "Vendi imóvel, carro ou outro bem",
                      "Recebo como autônomo (carnê-leão)",
                      "Outros assuntos de Pessoa Física"
                    ].map((item) => (
                      <div key={item} className={styles.chipItem}>
                        <CheckCircle2 size={16} className={styles.chipCheck} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link className={styles.btnPlano} href="/agendar?plano=pf">
                  <span>Escolher Pessoa Física</span>
                  <ArrowRight size={18} />
                </Link>
              </div>

              {/* PESSOA JURÍDICA (DESTAQUE / RECOMENDADO) */}
              <div className={`${styles.planoCard} ${styles.planoDestaque}`}>
                <div className={styles.badgePopular}>
                  <Sparkles size={14} />
                  <span>Mais Recomendado</span>
                </div>

                <div className={styles.planoHeader}>
                  <div className={styles.planoNome}>
                    <span>Pessoa Jurídica</span>
                    <div className={styles.planoIcon}>
                      <Building2 size={22} />
                    </div>
                  </div>
                  <p className={styles.planoDesc}>
                    Para MEI, Simples Nacional ou Ltda — qualquer porte de empresa que precise cuidar de guias e pendências.
                  </p>
                </div>

                <div className={styles.planoPrecoBox}>
                  <div className={styles.precoFlex}>
                    <span className={styles.moeda}>R$</span>
                    <span className={styles.valor}>{money(pj)}</span>
                  </div>
                  <div className={styles.planoPor}>por atendimento · Pix ou até 3x no cartão</div>
                </div>

                <div className={styles.resolveBox}>
                  <div className={styles.resolveRotulo}>Resolve, por exemplo:</div>
                  <div className={styles.chipsList}>
                    {[
                      "Guias e impostos atrasados",
                      "Declaração anual (DASN/DEFIS)",
                      "Parcelamento de débitos em geral",
                      "Dúvidas do Simples Nacional",
                      "Outros assuntos da empresa"
                    ].map((item) => (
                      <div key={item} className={styles.chipItem}>
                        <CheckCircle2 size={16} className={styles.chipCheck} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link href="/agendar?plano=pj" className={`${styles.btnPlano} ${styles.btnPlanoDestaque}`}>
                  <span>Resolver Meu Caso Agora</span>
                  <ArrowRight size={18} />
                </Link>
              </div>

              {/* SOB DEMANDA */}
              <div className={styles.planoCard}>
                <div className={styles.planoHeader}>
                  <div className={styles.planoNome}>
                    <span>Sob Demanda</span>
                    <div className={styles.planoIcon}>
                      <Zap size={22} />
                    </div>
                  </div>
                  <p className={styles.planoDesc}>
                    Para casos complexos: baixa de empresa, CNPJ inapto ou vários anos de declarações em atraso.
                  </p>
                </div>

                <div className={styles.planoPrecoBox}>
                  <span className={styles.planoEyebrow}>Análise Inicial</span>
                  <div className={styles.precoFlex}>
                    <span className={styles.moeda}>R$</span>
                    <span className={styles.valor}>{money(consulta)}</span>
                  </div>
                  <div className={styles.planoPor}>diagnóstico e plano de ação por escrito</div>
                </div>

                <div className={styles.resolveBox}>
                  <div className={styles.resolveRotulo}>Resolve, por exemplo:</div>
                  <div className={styles.chipsList}>
                    {[
                      "Baixa de empresa",
                      "Regularização de CNPJ inapto",
                      "Desenquadramento e mudança de regime",
                      "Vários anos de IR atrasados",
                      "Outros casos específicos sob medida"
                    ].map((item) => (
                      <div key={item} className={styles.chipItem}>
                        <CheckCircle2 size={16} className={styles.chipCheck} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link className={`${styles.btnPlano} ${styles.btnPlanoOutline}`} href="/agendar?plano=sob-demanda">
                  <span>Contratar Análise Inicial</span>
                  <ArrowRight size={18} />
                </Link>
              </div>

            </div>
          </section>

          {/* GARANTIA */}
          <div className={styles.garantiaBox}>
            <div className={styles.garantiaIconWrap}>
              <ShieldCheck size={28} />
            </div>
            <div className={styles.garantiaText}>
              <b>Garantia Incondicional de Reembolso</b>
              <span>Você paga na contratação. Se o contador avaliar seu caso e concluir que não temos como ajudar, devolvemos 100% do valor integralmente. Sem burocracia ou letras miúdas.</span>
            </div>
          </div>

          {/* FAQ */}
          <section className={styles.faqSection}>
            <div className={styles.faqHeader}>
              <h2 className={styles.faqTitle}>Perguntas de quem chegou até aqui</h2>
              <p className={styles.faqSub}>Tire suas dúvidas antes de escolher o atendimento</p>
            </div>
            <FaqAccordion faqList={FAQ} />
          </section>

          {/* CTA FINAL */}
          <section className={styles.ctaFinal}>
            <h2 className={styles.ctaTitle}>Quanto custa continuar adiando isso?</h2>
            <p className={styles.ctaDesc}>
              Multas e juros da Receita Federal aumentam a cada mês. Escolha o serviço ideal e resolva a situação com a orientação de um contador especialista com CRC.
            </p>
            <div className={styles.ctaActions}>
              <a className={styles.btnCtaMain} href="#planos">
                <span>Escolher Meu Plano</span>
                <ArrowRight size={20} />
              </a>
              <div className={styles.ctaSubLink}>
                ou <a href="mailto:ola@olacontador.com.br?subject=Pedido%20de%20or%C3%A7amento">solicite um orçamento personalizado por e-mail</a>
              </div>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
