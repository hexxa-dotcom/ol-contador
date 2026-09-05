import type { Metadata } from "next";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { BlogClient } from "./blog-client";

export const metadata: Metadata = {
  title: "Blog & Guias Fiscais — Contabilidade Prática e Sem Mensalidade | Olá, Contador",
  description:
    "Artigos e guias especializados sobre Imposto de Renda, Malha Fina, Simples Nacional, MEI, Radar Fiscal e regularização de dívida ativa com parecer técnico de contadores com CRC.",
  alternates: {
    canonical: "https://olacontador.com.br/blog",
  },
  openGraph: {
    title: "Blog & Guias Fiscais — Olá, Contador",
    description:
      "Aprenda a regularizar seu CPF e CNPJ, economizar impostos e resolver pendências fiscais sem pagar mensalidade contábil.",
    url: "https://olacontador.com.br/blog",
    siteName: "Olá, Contador",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog & Guias Fiscais — Olá, Contador",
    description:
      "Artigos e guias práticos sobre tributos, e-CAC, malha fina e contabilidade sob demanda com contadores de verdade.",
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  // JSON-LD para Google e motores generativos (GEO)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog & Guias Fiscais — Olá, Contador",
    description:
      "Guias práticos e artigos de contabilidade sob demanda com fundamentação legal e pareceres de contadores com CRC.",
    url: "https://olacontador.com.br/blog",
    publisher: {
      "@type": "Organization",
      name: "Olá, Contador",
      url: "https://olacontador.com.br",
      logo: {
        "@type": "ImageObject",
        url: "https://olacontador.com.br/logo.svg",
      },
    },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      url: `https://olacontador.com.br/blog/${post.slug}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: {
        "@type": "Person",
        name: post.author.name,
        jobTitle: post.author.role,
      },
    })),
  };

  return (
    <div className="site-public" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader active={"blog" as any} transparentOnTop={false} />
      <main style={{ flex: "1 0 auto", paddingTop: "80px", paddingBottom: "80px", background: "#FAF7F2" }}>
        <BlogClient initialPosts={posts} categories={categories} />
      </main>
      <SiteFooter />
    </div>
  );
}
