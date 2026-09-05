import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  getAllServicos, 
  getServicoBySlug, 
  getRelatedServicos 
} from "@/lib/servicos";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { ServicoFaqAccordion } from "./servico-faq";
import { 
  ShieldCheck, 
  Clock, 
  FileCheck2, 
  CheckCircle2, 
  ArrowRight, 
  ChevronRight, 
  FileText, 
  Sparkles,
  Lock,
  RefreshCcw,
  CalendarCheck,
  User,
  Store,
  Building2,
  FolderOpen
} from "lucide-react";
import styles from "../servicos.module.css";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const servicos = getAllServicos();
  return servicos.map((s) => ({
    slug: s.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const servico = getServicoBySlug(slug);

  if (!servico) {
    return {
      title: "Serviço não encontrado | Olá, Contador",
    };
  }

  const url = `https://www.olacontador.com.br/servicos/${servico.slug}`;

  return {
    title: `${servico.title} — Preço Fixo | Olá, Contador`,
    description: servico.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${servico.title} — Olá, Contador`,
      description: servico.excerpt,
      url,
      siteName: "Olá, Contador",
      locale: "pt_BR",
      type: "website",
    },
    keywords: servico.tags,
  };
}

export default async function ServicoDetailPage({ params }: Props) {
  const { slug } = await params;
  const servico = getServicoBySlug(slug);

  if (!servico) {
    notFound();
  }

  const related = getRelatedServicos(servico.slug, 3);
  const pageUrl = `https://www.olacontador.com.br/servicos/${servico.slug}`;

  const money = (cents: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

  // Triple Schema.org Graph
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: servico.title,
        description: servico.description,
        serviceType: servico.shortTitle,
        category: servico.category,
        url: pageUrl,
        provider: {
          "@type": "Organization",
          name: "Olá, Contador",
          url: "https://www.olacontador.com.br",
          logo: {
            "@type": "ImageObject",
            url: "https://www.olacontador.com.br/logo.svg",
          },
        },
        areaServed: {
          "@type": "Country",
          name: "BR",
        },
        offers: {
          "@type": "Offer",
          price: (servico.priceCents / 100).toFixed(2),
          priceCurrency: "BRL",
          availability: "https://schema.org/InStock",
          url: pageUrl,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: servico.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: "https://www.olacontador.com.br",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Serviços",
            item: "https://www.olacontador.com.br/servicos",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: servico.shortTitle,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  const getCategoryClass = (catSlug: string) => {
    switch (catSlug) {
      case "pessoa-fisica": return styles.catPF;
      case "mei": return styles.catMEI;
      case "pequenas-empresas": return styles.catEmpresas;
      default: return "";
    }
  };

  const getCategoryIcon = (catSlug: string) => {
    switch (catSlug) {
      case "pessoa-fisica": return <User size={14} />;
      case "mei": return <Store size={14} />;
      case "pequenas-empresas": return <Building2 size={14} />;
      default: return null;
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader active="precos" />

      <main className={styles.mainWrapper}>
        <div className={styles.singleContainer}>
          {/* BREADCRUMBS */}
          <nav className={styles.singleBreadcrumbs} aria-label="Navegação">
            <Link href="/">Início</Link>
            <ChevronRight size={13} />
            <Link href="/servicos">Serviços</Link>
            <ChevronRight size={13} />
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{servico.shortTitle}</span>
          </nav>

          {/* LAYOUT PRINCIPAL (CONTEÚDO + SIDEBAR) */}
          <div className={styles.singleLayout}>
            
            {/* CONTEÚDO PRINCIPAL (ESQUERDA) */}
            <div className={styles.singleMainContent}>
              <header className={styles.singleHeader}>
                <div className={styles.singleBadgesRow}>
                  <span className={`${styles.categoryTag} ${getCategoryClass(servico.categorySlug)}`}>
                    {getCategoryIcon(servico.categorySlug)}
                    {servico.category}
                  </span>
                  <span className={styles.badgeTag}>{servico.badge}</span>
                </div>

                <h1 className={styles.singleTitle}>{servico.title}</h1>
                <p className={styles.singleSubtitle}>{servico.subtitle}</p>
              </header>

              {/* SEÇÃO 1: SOBRE O ATENDIMENTO */}
              <section className={styles.contentBlock}>
                <h2 className={styles.sectionHeading}>
                  <Sparkles size={20} style={{ color: "#EE5F3A" }} />
                  Sobre este Atendimento
                </h2>
                <p className={styles.sectionParagraph}>{servico.description}</p>
                <div style={{ background: "#F1F5F9", padding: "14px 18px", borderRadius: "12px", fontSize: "14px", color: "#334155" }}>
                  <strong>Indicado para:</strong> {servico.publicoAlvo}
                </div>
              </section>

              {/* SEÇÃO 2: O QUE ESTÁ INCLUSO */}
              <section className={styles.contentBlock}>
                <h2 className={styles.sectionHeading}>
                  <CheckCircle2 size={20} style={{ color: "#10B981" }} />
                  O que está incluso no serviço
                </h2>
                <div className={styles.inclusoBox}>
                  <ul className={styles.inclusoList}>
                    {servico.oQueEstaIncluso.map((item, index) => (
                      <li key={index} className={styles.inclusoItem}>
                        <CheckCircle2 size={18} className={styles.inclusoIcon} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* SEÇÃO 3: DOCUMENTOS NECESSÁRIOS */}
              <section className={styles.contentBlock}>
                <h2 className={styles.sectionHeading}>
                  <FolderOpen size={20} style={{ color: "#D97706" }} />
                  Documentos necessários
                </h2>
                <div className={styles.documentosBox}>
                  <ul className={styles.documentosList}>
                    {servico.documentosNecessarios.map((doc, index) => (
                      <li key={index} className={styles.documentoItem}>
                        <FileText size={18} className={styles.documentoIcon} />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* SEÇÃO 4: PASSO A PASSO */}
              <section className={styles.contentBlock}>
                <h2 className={styles.sectionHeading}>
                  <Clock size={20} style={{ color: "#EE5F3A" }} />
                  Como funciona o atendimento
                </h2>
                <div className={styles.timelineWrapper}>
                  {servico.passoAPasso.map((p, index) => (
                    <div key={index} className={styles.timelineStep}>
                      <div className={styles.stepNumber}>{p.passo}</div>
                      <div className={styles.stepContent}>
                        <div className={styles.stepTitle}>{p.titulo}</div>
                        <div className={styles.stepDesc}>{p.descricao}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* SEÇÃO 5: FAQ */}
              <ServicoFaqAccordion faqs={servico.faqs} />

              {/* SEÇÃO 6: SERVIÇOS RELACIONADOS */}
              {related.length > 0 && (
                <section style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #E2E8F0" }}>
                  <h3 className={styles.sectionHeading}>Outros Serviços Relacionados</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginTop: "16px" }}>
                    {related.map((rel) => (
                      <Link 
                        key={rel.slug} 
                        href={`/servicos/${rel.slug}`}
                        style={{
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "14px",
                          padding: "16px",
                          textDecoration: "none",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                          {rel.shortTitle}
                        </span>
                        <span style={{ fontSize: "12px", color: "#EE5F3A", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          Ver detalhes <ChevronRight size={13} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* SIDEBAR FLUTUANTE (DIREITA) */}
            <aside className={styles.stickySidebar}>
              <div className={styles.sidebarCard}>
                <div className={styles.sidebarBadge}>
                  <ShieldCheck size={14} />
                  Garantia Total ou Reembolso
                </div>

                <div className={styles.sidebarPrice}>
                  {money(servico.priceCents)}
                </div>
                <div className={styles.sidebarPriceSub}>
                  Preço fixo combinado antes · Sem mensalidade
                </div>

                <ul className={styles.sidebarBenefits}>
                  <li className={styles.sidebarBenefitItem}>
                    <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                    <span>Prazo: {servico.prazo}</span>
                  </li>
                  <li className={styles.sidebarBenefitItem}>
                    <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                    <span>Contador com CRC dedicado</span>
                  </li>
                  <li className={styles.sidebarBenefitItem}>
                    <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                    <span>Parecer formal em PDF assinado</span>
                  </li>
                  <li className={styles.sidebarBenefitItem}>
                    <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                    <span>Retorno grátis em até 7 dias</span>
                  </li>
                </ul>

                <Link 
                  href={`/agendar?servico=${servico.serviceParam}`} 
                  className={styles.sidebarCtaBtn}
                >
                  Contratar este Serviço
                  <ArrowRight size={18} />
                </Link>

                <Link 
                  href={`/agendar?servico=${servico.serviceParam}`} 
                  className={styles.sidebarSecondaryBtn}
                >
                  <CalendarCheck size={16} />
                  Agendar com horário marcado
                </Link>
              </div>

              {/* BOX DE SEGURANÇA */}
              <div className={styles.sidebarTrustBox}>
                <div className={styles.trustMiniItem}>
                  <Lock size={16} style={{ color: "#0F172A" }} />
                  <span>Sigilo fiscal e proteção de dados LGPD</span>
                </div>
                <div className={styles.trustMiniItem}>
                  <ShieldCheck size={16} style={{ color: "#0F172A" }} />
                  <span>Profissionais com registro ativo no CRC</span>
                </div>
                <div className={styles.trustMiniItem}>
                  <RefreshCcw size={16} style={{ color: "#0F172A" }} />
                  <span>100% de devolução se não pudermos ajudar</span>
                </div>
              </div>
            </aside>

          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
