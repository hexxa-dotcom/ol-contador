import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  getAllPosts, 
  getPostBySlug, 
  getRelatedPosts 
} from "@/lib/blog";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { 
  Clock, 
  Calendar, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  ChevronRight, 
  ArrowUpRight,
  HelpCircle,
  AlertTriangle,
  Info,
  CheckCircle2
} from "lucide-react";
import { ArticleFaqAccordion } from "./article-faq";
import styles from "../blog.module.css";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Artigo não encontrado | Olá, Contador",
    };
  }

  const url = `https://olacontador.com.br/blog/${post.slug}`;

  return {
    title: `${post.title} | Olá, Contador`,
    description: post.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: "Olá, Contador",
      locale: "pt_BR",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(post.slug, 3);
  const pageUrl = `https://olacontador.com.br/blog/${post.slug}`;

  // JSON-LD robusto para SEO tradicional e GEO (ChatGPT, Perplexity, Gemini)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${pageUrl}#article`,
        isPartOf: {
          "@type": "Blog",
          "@id": "https://olacontador.com.br/blog",
          name: "Blog Olá, Contador",
        },
        headline: post.title,
        description: post.description,
        url: pageUrl,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        mainEntityOfPage: pageUrl,
        articleSection: post.category,
        keywords: post.tags.join(", "),
        author: {
          "@type": "Person",
          name: post.author.name,
          jobTitle: post.author.role,
          description: post.author.bio,
          knowsAbout: ["Contabilidade", "Tributação Brasileira", "Receita Federal", "Simples Nacional", "IRPF"],
        },
        publisher: {
          "@type": "Organization",
          name: "Olá, Contador",
          url: "https://olacontador.com.br",
          logo: {
            "@type": "ImageObject",
            url: "https://olacontador.com.br/logo.svg",
          },
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: post.faqs.map((faq) => ({
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
            item: "https://olacontador.com.br",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: "https://olacontador.com.br/blog",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <div className="site-public" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader active={"blog" as any} transparentOnTop={false} />

      <main style={{ flex: "1 0 auto", paddingTop: "80px", paddingBottom: "90px", background: "#FAF7F2" }}>
        <article className={styles.articleContainer}>
          {/* BREADCRUMBS */}
          <nav className={styles.breadcrumbs} aria-label="Navegação estrutural">
            <Link href="/">Início</Link>
            <ChevronRight size={13} />
            <Link href="/blog">Blog</Link>
            <ChevronRight size={13} />
            <span className={styles.breadcrumbsCurrent}>{post.category}</span>
          </nav>

          {/* HEADER DO ARTIGO */}
          <header className={styles.articleHeader}>
            <span className={styles.articleCategoryBadge}>{post.category}</span>
            <h1 className={styles.articleTitle}>{post.title}</h1>
            <p className={styles.articleSubtitle}>{post.subtitle}</p>

            <div className={styles.articleMetaBar}>
              <div className={styles.authorBox}>
                <div className={styles.authorAvatar}>OC</div>
                <div className={styles.authorText}>
                  <span className={styles.authorName}>{post.author.name}</span>
                  <span className={styles.authorCrc}>
                    <ShieldCheck size={13} color="#16A34A" />
                    {post.author.crc} · {post.author.role}
                  </span>
                </div>
              </div>

              <div className={styles.articleMetaRight}>
                <span className={styles.metaItem}>
                  <Clock size={13} />
                  {post.readTime}
                </span>
                <span>·</span>
                <span className={styles.metaItem}>
                  <Calendar size={13} />
                  Atualizado em{" "}
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                    new Date(post.updatedAt)
                  )}
                </span>
              </div>
            </div>
          </header>

          {/* GEO KEY TAKEAWAYS (LLM / SNIPPET) */}
          <div className={styles.keyTakeawaysBox}>
            <div className={styles.keyTakeawaysHeader}>
              <div className={styles.keyTakeawaysIcon}>
                <Sparkles size={16} />
              </div>
              <h2 className={styles.keyTakeawaysTitle}>Principais conclusões deste guia</h2>
            </div>
            <ul className={styles.keyTakeawaysList}>
              {post.keyTakeaways.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>

          {/* ÍNDICE DE NAVEGAÇÃO INTERNA */}
          <div className={styles.tocBox}>
            <div className={styles.tocTitle}>Neste artigo você vai ver:</div>
            <ul className={styles.tocList}>
              {post.content.map((sec) => (
                <li key={sec.id}>
                  <a href={`#${sec.id}`} className={styles.tocLink}>
                    <ArrowRight size={13} color="#EE5F3A" />
                    <span>{sec.heading}</span>
                  </a>
                </li>
              ))}
              {post.faqs.length > 0 && (
                <li>
                  <a href="#perguntas-frequentes" className={styles.tocLink}>
                    <HelpCircle size={13} color="#EE5F3A" />
                    <span>Perguntas frequentes sobre o tema</span>
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* CORPO DO ARTIGO */}
          <div className={styles.articleBody}>
            {post.content.map((section) => (
              <section key={section.id} id={section.id} className={styles.articleSection}>
                <h2 className={styles.sectionHeading}>{section.heading}</h2>

                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className={styles.articleParagraph}>
                    {p}
                  </p>
                ))}

                {section.bullets && section.bullets.length > 0 && (
                  <ul className={styles.articleBullets}>
                    {section.bullets.map((bullet, bIdx) => (
                      <li key={bIdx}>{bullet}</li>
                    ))}
                  </ul>
                )}

                {section.callout && (
                  <div
                    className={`${styles.callout} ${
                      section.callout.type === "tip"
                        ? styles.calloutTip
                        : section.callout.type === "warning"
                        ? styles.calloutWarning
                        : styles.calloutInfo
                    }`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      {section.callout.type === "tip" && <CheckCircle2 size={16} />}
                      {section.callout.type === "warning" && <AlertTriangle size={16} />}
                      {section.callout.type === "info" && <Info size={16} />}
                      <span className={styles.calloutTitle}>
                        {section.callout.title || "Nota Importante"}
                      </span>
                    </div>
                    <p className={styles.calloutText}>{section.callout.text}</p>
                  </div>
                )}

                {section.table && (
                  <div className={styles.tableWrap}>
                    <table className={styles.articleTable}>
                      <thead>
                        <tr>
                          {section.table.headers.map((h, hIdx) => (
                            <th key={hIdx}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}

            {/* SEÇÃO DE FAQS (GEO / SCHEMA.ORG) */}
            {post.faqs.length > 0 && (
              <div id="perguntas-frequentes">
                <ArticleFaqAccordion faqs={post.faqs} />
              </div>
            )}
          </div>

          {/* CTA BANNER DE CONVERSÃO */}
          <div className={styles.articleCtaBanner}>
            <span className={styles.ctaBadge}>{post.cta.badge}</span>
            <h3 className={styles.ctaTitle}>{post.cta.title}</h3>
            <p className={styles.ctaDescription}>{post.cta.description}</p>
            <Link href={post.cta.buttonHref} className={styles.ctaButton}>
              <span>{post.cta.buttonText}</span>
              <ArrowUpRight size={17} />
            </Link>
          </div>

          {/* ARTIGOS RELACIONADOS */}
          {relatedPosts.length > 0 && (
            <div className={styles.relatedSection}>
              <h3 className={styles.relatedTitle}>Leia também sobre outros temas</h3>
              <div className={styles.postsGrid}>
                {relatedPosts.map((rel) => (
                  <Link key={rel.slug} href={`/blog/${rel.slug}`} className={styles.postCard}>
                    <div className={styles.featuredMeta}>
                      <span className={styles.categoryBadge}>{rel.category}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        {rel.readTime}
                      </span>
                    </div>
                    <h4 className={styles.postCardTitle} style={{ fontSize: "17px" }}>
                      {rel.title}
                    </h4>
                    <p className={styles.postCardExcerpt} style={{ fontSize: "13px" }}>
                      {rel.excerpt}
                    </p>
                    <span className={styles.readMoreBtn} style={{ fontSize: "12.5px" }}>
                      Acessar artigo <ArrowRight size={13} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
