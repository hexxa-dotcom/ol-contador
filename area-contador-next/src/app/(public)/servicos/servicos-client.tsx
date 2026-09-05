"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  FileText,
  User,
  Store,
  Building2,
  Sparkles,
  ChevronRight
} from "lucide-react";
import type { ServicoItem, CategoriaServico } from "@/lib/servicos";
import styles from "./servicos.module.css";

interface ServicosClientProps {
  servicos: ServicoItem[];
}

export function ServicosClient({ servicos }: ServicosClientProps) {
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("todos");

  // Contadores por categoria
  const contagens = useMemo(() => {
    return {
      todos: servicos.length,
      "pessoa-fisica": servicos.filter((s) => s.categorySlug === "pessoa-fisica").length,
      mei: servicos.filter((s) => s.categorySlug === "mei").length,
      "pequenas-empresas": servicos.filter((s) => s.categorySlug === "pequenas-empresas").length,
    };
  }, [servicos]);

  // Filtro dinâmico
  const servicosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return servicos.filter((s) => {
      const matchCategoria = categoriaAtiva === "todos" || s.categorySlug === categoriaAtiva;
      if (!matchCategoria) return false;

      if (!termo) return true;

      const matchTexto = 
        s.title.toLowerCase().includes(termo) ||
        s.subtitle.toLowerCase().includes(termo) ||
        s.description.toLowerCase().includes(termo) ||
        s.excerpt.toLowerCase().includes(termo) ||
        s.tags.some((t) => t.toLowerCase().includes(termo)) ||
        s.oQueEstaIncluso.some((inc) => inc.toLowerCase().includes(termo));

      return matchTexto;
    });
  }, [servicos, busca, categoriaAtiva]);

  const money = (cents: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

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
      case "pessoa-fisica": return <User size={13} />;
      case "mei": return <Store size={13} />;
      case "pequenas-empresas": return <Building2 size={13} />;
      default: return null;
    }
  };

  return (
    <div>
      {/* BARRA DE BUSCA & TABS */}
      <div className={styles.controlsWrapper}>
        <div className={styles.searchBarWrapper}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Qual serviço você precisa? Ex: decore, regularizar cpf, mei, baixa cnpj, cnd..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className={styles.filterTabs}>
          <button
            type="button"
            className={`${styles.filterBtn} ${categoriaAtiva === "todos" ? styles.filterBtnActive : ""}`}
            onClick={() => setCategoriaAtiva("todos")}
          >
            Todos os Serviços
            <span className={styles.filterCount}>{contagens.todos}</span>
          </button>

          <button
            type="button"
            className={`${styles.filterBtn} ${categoriaAtiva === "pessoa-fisica" ? styles.filterBtnActive : ""}`}
            onClick={() => setCategoriaAtiva("pessoa-fisica")}
          >
            <User size={15} />
            Pessoa Física
            <span className={styles.filterCount}>{contagens["pessoa-fisica"]}</span>
          </button>

          <button
            type="button"
            className={`${styles.filterBtn} ${categoriaAtiva === "mei" ? styles.filterBtnActive : ""}`}
            onClick={() => setCategoriaAtiva("mei")}
          >
            <Store size={15} />
            MEI
            <span className={styles.filterCount}>{contagens.mei}</span>
          </button>

          <button
            type="button"
            className={`${styles.filterBtn} ${categoriaAtiva === "pequenas-empresas" ? styles.filterBtnActive : ""}`}
            onClick={() => setCategoriaAtiva("pequenas-empresas")}
          >
            <Building2 size={15} />
            Pequenas Empresas (Sob Demanda)
            <span className={styles.filterCount}>{contagens["pequenas-empresas"]}</span>
          </button>
        </div>
      </div>

      {/* GRID DE SERVIÇOS */}
      <div className={styles.servicesGrid}>
        {servicosFiltrados.length > 0 ? (
          servicosFiltrados.map((item) => {
            const isSobDemanda = item.categorySlug === "pequenas-empresas";
            const targetPlano = item.serviceParam || (isSobDemanda ? "sob-demanda" : item.categorySlug === "mei" ? "pj" : "pf");

            return (
              <article key={item.slug} className={styles.serviceCard}>
                <div className={styles.cardHeader}>
                  <span className={`${styles.categoryTag} ${getCategoryClass(item.categorySlug)}`}>
                    {getCategoryIcon(item.categorySlug)}
                    {item.category}
                  </span>
                  <span className={styles.badgeTag}>{item.badge}</span>
                </div>

                <h2 className={styles.cardTitle}>{item.title}</h2>
                <p className={styles.cardExcerpt}>{item.excerpt}</p>

                {/* ENTREGÁVEIS PRINCIPAIS */}
                <div className={styles.cardDeliverables}>
                  <div className={styles.cardDeliverablesTitle}>
                    {isSobDemanda ? "Etapas & O que está incluso:" : "O que está incluso:"}
                  </div>
                  <ul className={styles.deliverablesList}>
                    {item.oQueEstaIncluso.slice(0, 3).map((inc, i) => (
                      <li key={i} className={styles.deliverableItem}>
                        <CheckCircle2 size={15} className={styles.deliverableCheck} />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* RODAPÉ DO CARD */}
                <div className={styles.cardFooter}>
                  <div className={styles.priceWrapper}>
                    <span className={styles.priceLabel}>
                      {isSobDemanda ? "Diagnóstico Inicial" : "Preço Fixo"}
                    </span>
                    <div className={styles.priceValue}>
                      {money(item.priceCents)}
                      <small>
                        {isSobDemanda ? "· 100% abatido do serviço" : `· ${item.prazo}`}
                      </small>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <Link href={`/servicos/${item.slug}`} className={styles.btnDetails}>
                      Ver detalhes
                      <ChevronRight size={14} />
                    </Link>
                    <Link href={`/agendar?plano=${targetPlano}`} className={styles.btnHire}>
                      {isSobDemanda ? "Pedir Diagnóstico" : "Contratar"}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyStateTitle}>Nenhum serviço encontrado</h3>
            <p className={styles.emptyStateText}>
              Não encontramos nenhum serviço com o termo &quot;{busca}&quot;. Mas a nossa equipe atende qualquer caso contábil!
            </p>
            <Link href="/precos" className={styles.btnHire} style={{ display: "inline-flex" }}>
              Ver planos gerais de atendimento
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
