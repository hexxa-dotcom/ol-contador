"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Clock, ArrowRight, ShieldCheck, Sparkles, BookOpen } from "lucide-react";
import type { BlogPost } from "@/lib/blog";
import styles from "./blog.module.css";

export function BlogClient({
  initialPosts,
  categories,
}: {
  initialPosts: BlogPost[];
  categories: { name: string; slug: string; count: number }[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredPosts = useMemo(() => {
    return initialPosts.filter((post) => {
      const matchCategory =
        selectedCategory === "todos" || post.categorySlug === selectedCategory;

      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.tags.some((tag) => tag.toLowerCase().includes(query));

      return matchCategory && matchSearch;
    });
  }, [initialPosts, selectedCategory, searchQuery]);

  const featuredPost = filteredPosts[0];
  const otherPosts = filteredPosts.slice(1);

  return (
    <div className={styles.container}>
      {/* HERO SECTION */}
      <section className={styles.heroSection}>
        <span className={styles.heroBadge}>
          <Sparkles size={14} />
          <span>Guias Fiscais & Conteúdo Técnico</span>
        </span>
        <h1 className={styles.heroTitle}>
          Tudo o que você precisa saber sobre impostos,{" "}
          <span className={styles.heroTitleHighlight}>sem enrolação.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Artigos práticos, memórias de cálculo e orientações escritas por contadores credenciados no CRC para tirar pendências da cabeça e economizar nos tributos.
        </p>

        {/* SEARCH & FILTERS */}
        <div className={styles.filterBar}>
          <div className={styles.searchWrap}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por assunto, malha fina, MEI, dívida ativa, etc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Buscar artigos no blog"
            />
          </div>

          <div className={styles.categoryPills} role="tablist" aria-label="Filtrar por categoria">
            <button
              type="button"
              className={`${styles.categoryPill} ${selectedCategory === "todos" ? styles.categoryPillActive : ""}`}
              onClick={() => setSelectedCategory("todos")}
            >
              <span>Todos os artigos</span>
              <span className={styles.categoryPillCount}>{initialPosts.length}</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                className={`${styles.categoryPill} ${selectedCategory === cat.slug ? styles.categoryPillActive : ""}`}
                onClick={() => setSelectedCategory(cat.slug)}
              >
                <span>{cat.name}</span>
                <span className={styles.categoryPillCount}>{cat.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FEEDBACK CASO NÃO ENCONTRE NADA */}
      {filteredPosts.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <BookOpen size={48} style={{ color: "#94A3B8", margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A", marginBottom: "8px" }}>
            Nenhum artigo encontrado
          </h3>
          <p style={{ color: "#64748B", fontSize: "15px", maxWidth: "420px", margin: "0 auto 20px" }}>
            Não encontramos nenhum conteúdo com os termos pesquisados. Tente usar outras palavras-chave ou limpar o filtro.
          </p>
          <button
            type="button"
            className={styles.categoryPill}
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("todos");
            }}
          >
            Limpar filtros de busca
          </button>
        </div>
      )}

      {/* FEATURED POST */}
      {featuredPost && (
        <Link href={`/blog/${featuredPost.slug}`} className={styles.featuredCard}>
          <div>
            <div className={styles.featuredMeta}>
              <span className={styles.categoryBadge}>{featuredPost.category}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Clock size={13} />
                {featuredPost.readTime}
              </span>
              <span>·</span>
              <span>
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
                  new Date(featuredPost.publishedAt)
                )}
              </span>
            </div>
            <h2 className={styles.featuredTitle}>{featuredPost.title}</h2>
            <p className={styles.featuredExcerpt}>{featuredPost.excerpt}</p>
            <div className={styles.postFooter}>
              <div className={styles.authorBox}>
                <div className={styles.authorAvatar}>OC</div>
                <div className={styles.authorText}>
                  <span className={styles.authorName}>{featuredPost.author.name}</span>
                  <span className={styles.authorCrc}>
                    <ShieldCheck size={12} color="#16A34A" />
                    {featuredPost.author.crc}
                  </span>
                </div>
              </div>
              <span className={styles.readMoreBtn}>
                Ler guia completo <ArrowRight size={16} />
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* GRID DE OUTROS POSTS */}
      {otherPosts.length > 0 && (
        <div className={styles.postsGrid}>
          {otherPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.postCard}>
              <div className={styles.featuredMeta}>
                <span className={styles.categoryBadge}>{post.category}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={13} />
                  {post.readTime}
                </span>
              </div>
              <h3 className={styles.postCardTitle}>{post.title}</h3>
              <p className={styles.postCardExcerpt}>{post.excerpt}</p>
              <div className={styles.postFooter}>
                <div className={styles.authorBox}>
                  <div className={styles.authorAvatar} style={{ width: "32px", height: "32px", fontSize: "11px" }}>
                    OC
                  </div>
                  <div className={styles.authorText}>
                    <span className={styles.authorName} style={{ fontSize: "12.5px" }}>
                      {post.author.name}
                    </span>
                    <span className={styles.authorCrc}>
                      <ShieldCheck size={11} color="#16A34A" />
                      {post.author.crc}
                    </span>
                  </div>
                </div>
                <span className={styles.readMoreBtn}>
                  Ler <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
