import type { Metadata } from "next";
import { getAllServicos } from "@/lib/servicos";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { ServicosClient } from "./servicos-client";
import { 
  ShieldCheck, 
  Clock, 
  FileCheck2, 
  Sparkles, 
  RefreshCcw,
  CheckCircle2
} from "lucide-react";
import styles from "./servicos.module.css";

export const metadata: Metadata = {
  title: "Serviços Contábeis Especializados (PF, MEI e Empresas) — Preço Fixo | Olá, Contador",
  description: "Catálogo completo de serviços de contabilidade sob demanda: emissão de DECORE, regularização de CPF, malha fina IRPF, regularização de MEI, baixa de CNPJ com dívidas, parcelamentos PGFN e CNDs.",
  alternates: {
    canonical: "https://www.olacontador.com.br/servicos",
  },
  openGraph: {
    title: "Serviços Contábeis Sob Demanda — Pessoa Física, MEI e Empresas",
    description: "Sem mensalidade fixa. Resolva sua pendência fiscal pontual com parecer técnico assinado por contadores habilitados no CRC e garantia de devolução.",
    url: "https://www.olacontador.com.br/servicos",
    siteName: "Olá, Contador",
    locale: "pt_BR",
    type: "website",
  },
  keywords: [
    "decore contador",
    "regularizar cpf suspenso",
    "sair da malha fina irpf",
    "regularizar mei atrasado",
    "dar baixa cnpj mei com divida",
    "parcelamento divida ativa pgfn",
    "reativar cnpj inapto",
    "certidao negativa cnd federal",
    "ganho de capital gcap imovel",
    "carne leao autonomos",
    "contador online avulso"
  ]
};

export default function ServicosIndexPage() {
  const servicos = getAllServicos();

  // JSON-LD estruturado de Catálogo de Ofertas para o Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Catálogo de Serviços Contábeis Sob Demanda — Olá, Contador",
    description: "Serviços de regularização fiscal, cadastral e declarações para pessoas físicas, MEIs e microempresas.",
    url: "https://www.olacontador.com.br/servicos",
    numberOfItems: servicos.length,
    itemListElement: servicos.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: item.title,
        description: item.excerpt,
        url: `https://www.olacontador.com.br/servicos/${item.slug}`,
        provider: {
          "@type": "Organization",
          name: "Olá, Contador",
          url: "https://www.olacontador.com.br",
        },
        offers: {
          "@type": "Offer",
          price: (item.priceCents / 100).toFixed(2),
          priceCurrency: "BRL",
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader active="precos" />

      <main className={styles.mainWrapper}>
        <div className={styles.container}>
          {/* HERO SECTION */}
          <section className={styles.heroSection}>
            <div className={styles.heroBadge}>
              <Sparkles size={14} />
              Catálogo Completo Sob Demanda
            </div>

            <h1 className={styles.heroTitle}>
              Serviços Contábeis Especializados com{" "}
              <span className={styles.heroTitleHighlight}>Preço Fixo</span>
            </h1>

            <p className={styles.heroSubtitle}>
              Resolva qualquer demanda eventual de Pessoa Física, MEI ou Pequena Empresa sem ficar preso a mensalidades contábeis. Parecer formal assinado com CRC e garantia de devolução.
            </p>

            {/* TRUST BAR */}
            <div className={styles.trustBar}>
              <div className={styles.trustItem}>
                <ShieldCheck size={18} className={styles.trustIcon} />
                <span>Contadores com CRC Ativo</span>
              </div>
              <div className={styles.trustItem}>
                <Clock size={18} className={styles.trustIcon} />
                <span>Atendimento Rápido em 24h</span>
              </div>
              <div className={styles.trustItem}>
                <FileCheck2 size={18} className={styles.trustIcon} />
                <span>Parecer Formal em PDF</span>
              </div>
              <div className={styles.trustItem}>
                <RefreshCcw size={18} className={styles.trustIcon} />
                <span>100% de Reembolso se não Resolver</span>
              </div>
            </div>
          </section>

          {/* GRID COM BUSCA E FILTROS */}
          <ServicosClient servicos={servicos} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
