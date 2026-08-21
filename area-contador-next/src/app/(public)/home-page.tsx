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

import { FaqAccordion } from "./faq-accordion";
import { GlowCard } from "@/components/ui/glow-card";
import {
  ShieldCheck,
  ArrowRight,
  Star,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  Smartphone,
  FileText,
  Lock,
} from "lucide-react";
import styles from "./home.module.css";

const PASSOS = [
  { n: "01", t: "Escolha o formato ideal", d: "Escolha o Atendimento Express para resolver hoje mesmo por mensagens, ou Agende um horário para conversar com calma por vídeo/chat." },
  { n: "02", t: "Envie seus dados direto pelo celular", d: "Tire foto dos documentos e conte o que houve direto no navegador — sem baixar nenhum aplicativo e sem formulários chatos." },
  { n: "03", t: "Receba a solução e o parecer oficial", d: "Acompanhe cada etapa com o contador responsável até a regularização (média de resolução entre 24h e 48h)." },
];

const ASSUNTOS = [
  "Malha fina do Imposto de Renda",
  "CPF cancelado ou pendente",
  "CNPJ inapto ou suspenso",
  "Ganho de capital na venda de bens",
  "Abertura e baixa de MEI",
  "Declaração de Imposto de Renda",
  "Regularização de pendências fiscais",
  "Parcelamento de débitos na Receita",
];

const CASOS = [
  { titulo: "Caiu na malha fina e não sabia o motivo", fizemos: "Identificamos o erro na declaração e transmitimos a retificadora.", depois: "Situação 100% regularizada, sem multas extras." },
  { titulo: "CPF cancelado ou com restrição", fizemos: "Levantamos as omissões fiscais e protocolamos a liberação na Receita.", depois: "CPF liberado para contas bancárias, crédito e trabalho." },
  { titulo: "CNPJ travado ou inapto", fizemos: "Entregamos as declarações em atraso e reativamos o cadastro.", depois: "CNPJ ativo e liberado para emitir notas normalmente." },
  { titulo: "Venda de imóvel ou ganho de capital", fizemos: "Calculamos as isenções legais (GCAP) e geramos o DARF correto.", depois: "Declaração transmitida sem erros e com comprovante oficial." },
];

const FAQ = [
  { p: "Preciso agendar, ou consigo atendimento no mesmo dia?", r: "O plano Express foi feito exatamente pra isso — você é atendido no mesmo dia, sem precisar marcar horário. Se preferir, também dá pra agendar um horário específico." },
  { p: "Minha situação é urgente, tem prazo vencendo. E agora?", r: "Avise isso logo no início do atendimento. Casos com prazo apertado são priorizados imediatamente pelo contador responsável." },
  { p: "Tenho mais de um CNPJ. Preciso pagar um atendimento pra cada?", r: "Sim, cada CNPJ é tratado separadamente, porque a situação cadastral e fiscal de cada empresa é única." },
  { p: "Vocês atendem fora do horário comercial?", r: "Você pode enviar sua mensagem a qualquer hora — a análise do contador acontece dentro do prazo de resposta combinado." },
];

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cents / 100);

/** Selo estrelado (recorte em CSS, sem SVG) pra destacar uma ação */
function SeloEstrela({ children }: { children: ReactNode }) {
  return <div className={styles.seloEstrela}><span>{children}</span></div>;
}

export function HomePage({ precos }: { precos: { pf: number; pj: number; consulta: number } }) {
  return (
    <>
      <SiteHeader active="home" />

      {/* =========================================================================
          HERO SECTION (FINTECH PREMIUM & PROVA SOCIAL)
      ========================================================================= */}
      <section className={`${styles.hero} ${styles.superficieEscura}`}>
        <div className={styles.container}>
          <div className={styles.heroGrid} style={{ position: "relative" }}>
            <div className={styles.heroInner}>
              <Reveal>
                <div className={styles.eyebrowSocial}>
                  <div className={styles.starsGroup}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14} fill="#F59E0B" color="#F59E0B" />
                    ))}
                  </div>
                  <strong>4.9/5</strong>
                  <span>em mais de 1.400 casos resolvidos</span>
                </div>
              </Reveal>

              <h1 className={styles.heroTitleBold}>
                A forma mais simples de resolver seus<br />
                <span className={styles.heroGradientCoral}>problemas com a Receita</span>
              </h1>

              <p className={styles.heroSub}>
                Sem jargões, sem agendamentos demorados. Conectamos você diretamente a um contador especialista para destravar seu CPF, CNPJ ou IRPF em tempo recorde.
              </p>

              <div className={styles.heroActions}>
                <Link className={styles.btnCoralGlow} href="/precos">
                  <span>Resolver meu caso agora</span>
                  <ArrowRight size={18} />
                </Link>
                <Link className={styles.btnGhostGlass} href="#como-funciona">
                  Como funciona
                </Link>
              </div>

              {/* Micro Badges de Confiança */}
              <div className={styles.heroTrustBadges}>
                <span><CheckCircle2 size={15} style={{ color: "#34D399" }} /> Sem baixar nada</span>
                <span><CheckCircle2 size={15} style={{ color: "#34D399" }} /> Atendimento no mesmo dia</span>
                <span><CheckCircle2 size={15} style={{ color: "#34D399" }} /> Contador com CRC</span>
              </div>

              {/* Prova Social com Avatares */}
              <div className={styles.socialProofStrip}>
                <div className={styles.avatarStack}>
                  <div className={styles.stackAvatar} style={{ background: "#E25B38" }}>MC</div>
                  <div className={styles.stackAvatar} style={{ background: "#059669" }}>FA</div>
                  <div className={styles.stackAvatar} style={{ background: "#2563EB" }}>PL</div>
                  <div className={styles.stackAvatar} style={{ background: "#7C3AED" }}>RM</div>
                </div>
                <div className={styles.socialProofText}>
                  <strong>+1.420 contribuintes e empresas</strong>
                  <span>regularizados com sucesso neste ano</span>
                </div>
              </div>
            </div>

            {/* Lado Direito: Três Floating Cards Fintech */}
            <div className={styles.heroVisual}>
              <div className={styles.heroGlowBlob} />
              <div className={styles.fintechStackWrap}>
                
                <div className={`${styles.fintechCard} ${styles.fintechCard1}`}>
                  <div className={styles.fintechIconWrap} style={{ background: "rgba(226, 91, 56, 0.15)", color: "#FF9C7E" }}>
                    <Zap size={22} />
                  </div>
                  <div className={styles.fintechCardText}>
                    <strong>Atendimento Express</strong>
                    <span>Casos resolvidos em até 24h sem burocracia de agendamento</span>
                  </div>
                  <span className={styles.fintechBadgeFast}>Hoje</span>
                </div>

                <div className={`${styles.fintechCard} ${styles.fintechCard2}`}>
                  <div className={styles.fintechIconWrap} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}>
                    <TrendingUp size={22} />
                  </div>
                  <div className={styles.fintechCardText}>
                    <strong>99.4% Taxa de Regularização</strong>
                    <span>Resolução de malha fina, CPF e CNPJ sem multas adicionais</span>
                  </div>
                  <span className={styles.fintechBadgeSuccess}>Aprovado</span>
                </div>

                <div className={`${styles.fintechCard} ${styles.fintechCard3}`}>
                  <div className={styles.fintechIconWrap} style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60A5FA" }}>
                    <ShieldCheck size={22} />
                  </div>
                  <div className={styles.fintechCardText}>
                    <strong>Garantia Total ou Reembolso</strong>
                    <span>Se não pudermos ajudar você, devolvemos 100% do valor pago</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
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

      {/* PREÇOS */}
      <section id="precos" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Preços transparentes</span>
              <h2 className={styles.sectionTitle}>Sem mensalidade, sem surpresas</h2>
            </div>
          </Reveal>
          <Reveal>
            <Carrossel className={styles.pricingGrid}>
              <div className={`${styles.priceCard} ${styles.featured}`}>
                <span className={styles.featuredBadge}>Mais procurado</span>
                <h3>Pessoa Física</h3>
                <div className={styles.modalities}>Atendimento Express</div>
                <div className={styles.priceValue}>R$ {money(precos.pf)}</div>
                <div className={styles.priceNote}>por atendimento completo — agendar um horário com o contador sai por um valor à parte</div>
                <Link className={styles.btnPrimary} href="/agendar?plano=pf">Resolver meu caso</Link>
              </div>
              <div className={styles.priceCard}>
                <h3>Pessoa Jurídica</h3>
                <div className={styles.modalities}>Atendimento Express</div>
                <div className={styles.priceValue}>R$ {money(precos.pj)}</div>
                <div className={styles.priceNote}>por atendimento completo — agendar um horário com o contador sai por um valor à parte</div>
                <Link className={styles.btnPrimary} href="/agendar?plano=pj">Resolver meu caso</Link>
              </div>
              <div className={styles.priceCard}>
                <h3>Sob Demanda</h3>
                <div className={styles.modalities}>Para situações mais complexas</div>
                <div className={styles.priceValue}>R$ {money(precos.consulta)}</div>
                <div className={styles.priceNote}>diagnóstico inicial — vira crédito integral no valor final do serviço</div>
                <Link className={styles.btnPrimary} href="/agendar?plano=sob-demanda">Solicitar análise</Link>
              </div>
            </Carrossel>
          </Reveal>
        </div>
      </section>

      {/* Banner bold — GARANTIA TOTAL DE DEVOLUÇÃO */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.bannerBold}>
              <h2 className={styles.bannerTitle}>GARANTIA TOTAL DE<br />DEVOLUÇÃO</h2>
              <p className={styles.bannerSub}>Se o contador analisar seus dados e identificar que não há como ajudar na sua situação, você recebe 100% do valor de volta na hora. Sem burocracia, sem letras miúdas.</p>
              <div className={styles.pricingFooter}>
                <div className={styles.pfItem}>
                  <Clock size={18} style={{ color: "#FF9C7E", flexShrink: 0 }} />
                  <span><b>Resposta em até 24h</b></span>
                </div>
                <div className={styles.pfItem}>
                  <CheckCircle2 size={18} style={{ color: "#34D399", flexShrink: 0 }} />
                  <span>Contador com <b>CRC ativo</b> verificável</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ÁREAS DE ATUAÇÃO */}
      <section id="pra-que-serve" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Áreas de atuação</span>
              <h2 className={styles.sectionTitle}>Veja onde podemos te ajudar</h2>
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

      {/* CASOS ANTES/DEPOIS — Histórias reais */}
      <section id="casos" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.casesCard}>
            <Reveal>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel} style={{ color: 'var(--pub-mint-glow)' }}>Histórias reais</span>
                <h2 className={styles.sectionTitle} style={{ color: '#fff' }}>Problemas parecidos com o seu, resolvidos</h2>
                <p className={styles.sectionDesc} style={{ color: 'rgba(255,255,255,0.7)' }}>Sem nomes, com total sigilo — apenas o que estava travado e como o contador resolveu.</p>
              </div>
            </Reveal>
            
            <Reveal>
              <CasesShowcase casos={CASOS} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* CONFIANÇA */}
      <section id="confianca" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Segurança & Agilidade</span>
              <h2 className={styles.sectionTitle}>O que garante a sua tranquilidade</h2>
              <p className={styles.sectionDesc}>Sem pegadinhas, sem burocracia. Entenda como cuidamos da sua situação do início ao fim.</p>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.trustBlock}>
              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check} style={{ background: "rgba(226, 91, 56, 0.12)", color: "#E25B38" }}>
                    <Zap size={18} />
                  </div>
                  <h3>Atendimento Express no mesmo dia</h3>
                </div>
                <p className={styles.body}>Comece a resolver hoje mesmo. O contador analisa sua documentação e inicia os procedimentos nas primeiras horas.</p>
              </GlowCard>

              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check} style={{ background: "rgba(37, 99, 235, 0.12)", color: "#2563EB" }}>
                    <Smartphone size={18} />
                  </div>
                  <h3>100% no navegador, sem baixar nada</h3>
                </div>
                <p className={styles.body}>Zero aplicativos ocupando espaço. Acesse sua área protegida por um link simples no celular ou PC com 1 toque.</p>
              </GlowCard>

              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check} style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10B981" }}>
                    <Lock size={18} />
                  </div>
                  <h3>Contador com CRC Ativo &amp; Senhas temporárias</h3>
                </div>
                <p className={styles.body}>Profissional habilitado pelo Conselho Regional de Contabilidade. Seus acessos fiscais nunca ficam salvos.</p>
              </GlowCard>

              <GlowCard className={styles.trustCard}>
                <div className={styles.trustCardHead}>
                  <div className={styles.check} style={{ background: "rgba(245, 158, 11, 0.12)", color: "#D97706" }}>
                    <FileText size={18} />
                  </div>
                  <h3>Parecer Técnico Documentado</h3>
                </div>
                <p className={styles.body}>Tudo o que é feito vira um relatório formal assinado, com validade jurídica e garantia total de devolução.</p>
              </GlowCard>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PROVA & RELATÓRIO FINAL */}
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
                <div className={styles.rTitle}>Parecer Técnico</div>
                <div className={styles.rLine} style={{ width: "80%" }} />
                <div className={styles.rLine} style={{ width: "90%" }} />
                <div className={styles.rLine} style={{ width: "60%" }} />
                <div className={styles.rLine} style={{ width: "85%" }} />
                <div className={styles.rSeal}>CRC<br />OK</div>
              </div>
              <div className={styles.reportText}>
                <h3>Tudo o que fazemos é comprovado e documentado</h3>
                <p>Ao final do atendimento, você recebe um parecer formal assinado pelo contador responsável com registro no CRC — sua garantia oficial de que tudo está em dia.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* DÚVIDAS COMUNS */}
      <section id="duvidas" className={styles.section}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.faqHead}>
              <h2 className={styles.sectionTitle}>Dúvidas comuns</h2>
              <p className={styles.faqSub}>Não achou sua pergunta aqui? <a href="mailto:ola@olacontador.com.br">Fale com a gente</a>.</p>
            </div>
          </Reveal>
          <Reveal>
            <FaqAccordion faqList={FAQ} />
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.container}>
          <Reveal>
            <div className={styles.finalCta}>
              <h2>Pronto para tirar essa pendência da cabeça?</h2>
              <p>Fale agora com um contador com CRC ativo e resolva sua situação ainda hoje.</p>
              <Link className={styles.btnCoralGlow} href="/precos">
                <span>Resolver meu caso agora</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
