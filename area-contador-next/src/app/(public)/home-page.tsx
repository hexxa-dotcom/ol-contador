"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { Reveal, Carrossel } from "./carrossel";
import { CasesShowcase } from "./cases-showcase";
import { TimelineSteps } from "./timeline-steps";
import { CountUp } from "./count-up";
import { ProtocolCard } from "./protocol-card";

import { FaqAccordion, Asterisco } from "./faq-accordion";
import { GlowCard } from "@/components/ui/glow-card";
import { MessageCircle, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import styles from "./home.module.css";

const PASSOS = [
  { n: "01", t: "Escolha o tipo de atendimento", d: "Express, agendado, ou uma análise sob demanda para casos maiores." },
  { n: "02", t: "Conte o que aconteceu e envie os documentos", d: "Direto pelo celular, sem burocracia de formulário." },
  { n: "03", t: "Acompanhe até o caso ser resolvido", d: "Cada mensagem fica registrada no seu protocolo — nada se perde, nada fica solto num chat de celular." },
];

const ASSUNTOS = [
  "Malha fina do Imposto de Renda",
  "CPF cancelado ou irregular",
  "CNPJ inapto",
  "Ganho de capital na venda de bens",
  "Abertura de MEI ou empresa",
  "Declaração de Imposto de Renda",
  "Regularização fiscal",
  "Dúvidas sobre parcelamento",
];

const CASOS = [
  { titulo: "Caiu na malha fina e não sabia o motivo", fizemos: "Identificamos o erro na declaração e enviamos a retificadora.", depois: "Situação regularizada, sem multa." },
  { titulo: "CPF cancelado, não conseguia nem abrir conta", fizemos: "Levantamos o motivo da pendência e regularizamos junto à Receita.", depois: "CPF regularizado, vida financeira normalizada." },
  { titulo: "CNPJ inapto, empresa parou de faturar", fizemos: "Levantamos as pendências e entregamos as declarações em atraso.", depois: "CNPJ reativado, empresa emitindo nota normalmente." },
  { titulo: "Vendeu um imóvel e não sabia se devia imposto", fizemos: "Calculamos o imposto devido e orientamos a declaração correta.", depois: "Declaração feita sem erro, sem risco de malha fina depois." },
];

const FAQ = [
  { p: "Preciso agendar, ou consigo atendimento no mesmo dia?", r: "O plano Express foi feito exatamente pra isso — você é atendido no mesmo dia, sem precisar marcar horário. Se preferir, também dá pra agendar um horário específico." },
  { p: "Meu caso é urgente, tem prazo vencendo. E agora?", r: "Avise isso logo no início do atendimento. Casos com prazo apertado são priorizados pelo contador responsável." },
  { p: "Tenho mais de um CNPJ. Preciso pagar um atendimento pra cada?", r: "Sim, cada CNPJ é tratado como um caso separado, porque a situação fiscal de cada empresa é diferente." },
  { p: "Atendem fora do horário comercial?", r: "Você pode enviar seu caso a qualquer hora — a análise do contador acontece dentro do prazo de resposta combinado." },
];

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cents / 100);

/** Asterisco decorativo — mesmo tipo de "ruído gráfico" pontual usado em
 * layouts editoriais bold (referência: landing da Rebank), só com a cor da
 * marca. Puramente decorativo. */
/** Selo estrelado (recorte em CSS, sem SVG) pra destacar uma ação — o mesmo
 * papel do badge "Get started" spiky da referência. */
function SeloEstrela({ children }: { children: ReactNode }) {
  return <div className={styles.seloEstrela}><span>{children}</span></div>;
}

export function HomePage({ precos }: { precos: { pf: number; pj: number; consulta: number } }) {
  return (
    <>
      <SiteHeader active="home" />

      {/* HERO */}
      <section className={`${styles.hero} ${styles.superficieEscura}`}>
        <div className={styles.container}>
          <div className={styles.heroGrid} style={{ position: "relative" }}>
            
            <div className={styles.heroInner}>
              <Reveal>
                <div className={styles.eyebrow}>Atendimento contábil 100% focado no seu caso</div>
              </Reveal>
              <h1 className={styles.heroTitleBold}>
                Um contador de verdade,<br />
                <span className={styles.accent}>dedicado ao seu caso</span>
              </h1>
              <p className={styles.heroSub}>Conte o que está acontecendo, envie os documentos pelo celular, e um contador com registro ativo cuida do seu caso do começo ao fim — sem termo técnico, sem enrolação.</p>
              <div className={styles.heroActions}>
                <Link className={styles.btnPrimary} href="/precos">Resolver meu caso agora</Link>
                <Link className={styles.btnGhost} href="#como-funciona">Como funciona</Link>
              </div>
              <div className={styles.heroTags}><b>Resolvemos:</b> Malha fina, CPF cancelado, CNPJ inapto, ganho de capital, MEI e mais.</div>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroBlob}></div>
              <div className={styles.abstractGlassWrap}>
                <div className={`${styles.glassCard} ${styles.glassCard1}`}>
                  <div className={styles.glassIconWrap}><FileText size={22} /></div>
                  <div className={styles.glassText}>
                    <strong>Atendimento Express</strong>
                    <span>Análise dedicada do caso</span>
                  </div>
                  <div className={styles.glassCheck}><CheckCircle2 size={16} /></div>
                </div>
                
                <div className={`${styles.glassCard} ${styles.glassCard2}`}>
                  <div className={styles.glassIconWrap}><ShieldCheck size={22} /></div>
                  <div className={styles.glassText}>
                    <strong>Contador CRC Ativo</strong>
                    <span>Registro profissional validado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA — derruba a objeção "deve ser complicado" antes que o
          cliente pense nisso conscientemente. */}
      <section id="como-funciona" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Como funciona</span>
              <h2 className={styles.sectionTitle}>Três passos, do jeito mais simples possível</h2>
            </div>
          </Reveal>
          <Reveal>
            <TimelineSteps steps={PASSOS} />
          </Reveal>
        </div>
      </section>

      {/* PREÇOS — colar a garantia de reembolso perto do preço reduz o medo
          de "e se eu pagar e não for resolvido", no ponto de decisão mais
          próximo da compra. */}
      <section id="precos" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Preços</span>
              <h2 className={styles.sectionTitle}>Justo, e sem letra miúda</h2>
            </div>
          </Reveal>
          <Reveal>
            <Carrossel className={styles.pricingGrid}>
              <div className={`${styles.priceCard} ${styles.featured}`}>
                <span className={styles.featuredBadge}>Mais procurado</span>
                <h3>Pessoa Física</h3>
                <div className={styles.modalities}>Express ou agendamento</div>
                <div className={styles.priceValue}>R$ {money(precos.pf)}</div>
                <div className={styles.priceNote}>por atendimento</div>
                <Link className={styles.btnPrimary} href="/agendar?plano=pf">Resolver meu caso</Link>
              </div>
              <div className={styles.priceCard}>
                <h3>Pessoa Jurídica</h3>
                <div className={styles.modalities}>Express ou agendamento</div>
                <div className={styles.priceValue}>R$ {money(precos.pj)}</div>
                <div className={styles.priceNote}>por atendimento</div>
                <Link className={styles.btnPrimary} href="/agendar?plano=pj">Resolver meu caso</Link>
              </div>
              <div className={styles.priceCard}>
                <h3>Sob Demanda</h3>
                <div className={styles.modalities}>Para casos maiores</div>
                <div className={styles.priceValue}>R$ {money(precos.consulta)}</div>
                <div className={styles.priceNote}>taxa de diagnóstico — vira crédito integral no valor final do serviço</div>
                <Link className={styles.btnPrimary} href="/agendar?plano=sob-demanda">Solicitar análise</Link>
              </div>
            </Carrossel>
          </Reveal>
        </div>
      </section>

      {/* Banner bold — mesmo papel do bloco "stand out" de impacto entre
          seções: uma promessa só, grande, sem distração. */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.bannerBold}>
              <Asterisco className={styles.bannerAstTl} />
              <Asterisco className={styles.bannerAstBr} />
              <h2 className={styles.bannerTitle}>GARANTIA DE<br />REEMBOLSO <span className={styles.heroDash}>——</span></h2>
              <p className={styles.bannerSub}>Se o contador avaliar seu caso e concluir que não temos como ajudar, você recebe 100% de volta. Sem discussão.</p>
              <div className={styles.pricingFooter}>
                <div className={styles.pfItem}>⏱️ <span><b>Resposta em até 24h</b></span></div>
                <div className={styles.pfItem}>✓ <span>Contador com <b>CRC ativo</b> verificável</span></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRA QUE SERVE — momento de auto-identificação ("isso sou eu"). */}
      <section id="pra-que-serve" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Pra que serve</span>
              <h2 className={styles.sectionTitle}>O seu caso provavelmente é um destes</h2>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.bentoGrid}>
              {ASSUNTOS.map((a) => (
                <div className={styles.bentoCard} key={a}>{a}</div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CASOS ANTES/DEPOIS — identificação direta sem depoimento de terceiro. */}
      <section id="casos" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.casesCard}>
            <Reveal>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel} style={{ color: 'var(--pub-mint-glow)' }}>Casos que já resolvemos</span>
                <h2 className={styles.sectionTitle} style={{ color: '#fff' }}>Situações como a sua, resolvidas</h2>
                <p className={styles.sectionDesc} style={{ color: 'rgba(255,255,255,0.7)' }}>Sem nomes, sem identificação — só o que aconteceu, e como resolvemos.</p>
              </div>
            </Reveal>
            
            <Reveal>
              <CasesShowcase casos={CASOS} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* CONFIANÇA — resolve a objeção mais profunda e menos falada: "será
          que isso é golpe, ou um estranho vai ver meus dados". */}
      <section id="confianca" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Contador de verdade</span>
              <h2 className={styles.sectionTitle}>O que garante a sua confiança aqui</h2>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.trustBlock}>
              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check}>✓</div>
                  <h3>Um contador de verdade, dedicado ao seu caso</h3>
                </div>
                <p className={styles.body}>Você não fala com um robô nem com uma fila de atendimento genérico. Um contador com registro profissional ativo (CRC) cuida do seu caso do início ao fim, e você pode conferir quem ele é.</p>
              </GlowCard>
              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check}>✓</div>
                  <h3>Por que usamos um chat próprio, e não WhatsApp</h3>
                </div>
                <ul className={styles.trustList}>
                  <li>Seu caso não se perde: cada mensagem fica vinculada ao seu protocolo.</li>
                  <li>O que foi combinado no chat pode virar parte do seu relatório final.</li>
                  <li>Prazo visível: você vê o tempo de resposta.</li>
                  <li>Sigilo: o WhatsApp pessoal do contador nunca entra no atendimento.</li>
                </ul>
              </GlowCard>
              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check}>✓</div>
                  <h3>Sua senha nunca fica guardada</h3>
                </div>
                <p className={styles.body}>Se for preciso acessar o portal da Receita pra resolver seu caso, você informa o acesso direto no atendimento — usado só naquela sessão, por aquele contador, e nunca fica salvo depois.</p>
              </GlowCard>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PROVA — prova pelo número e pela concretude (ver o PDF de verdade),
          não pela cor. Ponto de descanso visual antes das dúvidas. */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.proofStats}>
            <Reveal>
              <div className={styles.stat}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true, margin: "0px 0px -50px 0px" }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  style={{ height: "3px", background: "var(--pub-coral)", position: "absolute", top: 0, left: 0, borderRadius: "2px" }}
                />
                <div className={styles.statNum}>+<CountUp to={1000} format={(n) => new Intl.NumberFormat("pt-BR").format(n)} /></div>
                <div className={styles.statLabel}>atendimentos realizados</div>
              </div>
            </Reveal>
            <Reveal>
              <div className={styles.stat}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true, margin: "0px 0px -50px 0px" }}
                  transition={{ duration: 2, ease: "easeOut", delay: 0.1 }}
                  style={{ height: "3px", background: "var(--pub-coral)", position: "absolute", top: 0, left: 0, borderRadius: "2px" }}
                />
                <div className={styles.statNum}><CountUp to={24} />h</div>
                <div className={styles.statLabel}>tempo de resposta</div>
              </div>
            </Reveal>
            <Reveal>
              <div className={styles.stat}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true, margin: "0px 0px -50px 0px" }}
                  transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
                  style={{ height: "3px", background: "var(--pub-coral)", position: "absolute", top: 0, left: 0, borderRadius: "2px" }}
                />
                <div className={styles.statNum}><CountUp to={100} />%</div>
                <div className={styles.statLabel}>contadores com CRC ativo</div>
              </div>
            </Reveal>
          </div>
          <Reveal>
            <div className={styles.reportPreview}>
              <div className={styles.reportDoc}>
                <div className={styles.rTitle}>Relatório final</div>
                <div className={styles.rLine} style={{ width: "80%" }} />
                <div className={styles.rLine} style={{ width: "90%" }} />
                <div className={styles.rLine} style={{ width: "60%" }} />
                <div className={styles.rLine} style={{ width: "85%" }} />
                <div className={styles.rSeal}>CRC<br />OK</div>
              </div>
              <div className={styles.reportText}>
                <h3>Todo caso termina com um relatório assinado</h3>
                <p>Documento formal, com a assinatura do contador responsável, explicando o que foi encontrado e o que foi feito — pra você guardar como prova de que seu caso foi resolvido.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* DÚVIDAS COMUNS — nome simples de propósito, não "FAQ". */}
      <section id="duvidas" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.faqHead}>
              <Asterisco className={styles.faqAsterisco} />
              <h2 className={styles.sectionTitle}>Dúvidas comuns</h2>
              <p className={styles.faqSub}>Não achou sua pergunta aqui? <a href="mailto:ola@olacontador.com.br">Fale com a gente</a>.</p>
            </div>
          </Reveal>
          <Reveal>
            <FaqAccordion faqList={FAQ} />
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL — fecha o ciclo repetindo o coral do hero, com o mesmo
          selo estrelado de destaque usado na referência. */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.finalCta}>
              <h2>Pronto para descomplicar o seu problema?</h2>
              <p>Um contador de verdade, dedicado a você e cuidando do seu caso do começo ao fim.</p>
              <Link className={styles.btnPrimary} href="/precos">Começar atendimento agora</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
