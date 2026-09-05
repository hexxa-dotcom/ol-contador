"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { User, ChevronDown, UserCheck, Building2, Menu, X, Mail, ShieldCheck, ArrowUpRight } from "lucide-react";

const CHAVE_SESSAO = "oc_funil_sessao";

export function useFunilSessao(): string {
  const [sessao, setSessao] = useState("");
  useEffect(() => {
    const existente = localStorage.getItem(CHAVE_SESSAO) || crypto.randomUUID();
    localStorage.setItem(CHAVE_SESSAO, existente);
    setSessao(existente);
  }, []);
  return sessao;
}

// Telemetria pública best-effort do funil comercial — nunca lança, nunca
// bloqueia a navegação.
export async function registrarEventoFunil(sessaoRef: string, evento: string, extra: { servicoId?: string; origem?: string } = {}) {
  if (!sessaoRef) return;
  try {
    await fetch("/api/funnel-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ evento, sessaoRef, ...extra }),
    });
  } catch {
    /* telemetria não pode quebrar a navegação */
  }
}

export function SiteHeader({ 
  active, 
  transparentOnTop = active === "home" 
}: { 
  active?: "home" | "precos" | "radar" | "blog" | "servicos"; 
  transparentOnTop?: boolean; 
}) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Monitora a rolagem da página para transicionar o cabeçalho
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fecha o menu móvel ao redimensionar para desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) {
        setMenuMobileAberto(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Previne scroll no body quando o menu mobile está aberto
  useEffect(() => {
    if (menuMobileAberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuMobileAberto]);

  // Fecha o menu móvel com Esc
  useEffect(() => {
    if (!menuMobileAberto) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuMobileAberto(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuMobileAberto]);

  const isTransparent = transparentOnTop && !scrolled && !menuMobileAberto;

  return (
    <header 
      className={`public-nav-wrap ${isTransparent ? "is-transparent" : "is-solid"} ${transparentOnTop ? "is-overlay" : ""}`}
    >
      <div className="public-nav-container">
        <Link className="public-brand" href="/" aria-label="Voltar para a página inicial" onClick={() => setMenuMobileAberto(false)}>
          <Image src="/logo-light.svg" alt="Olá, Contador" width={34} height={35} priority />
          <span>
            Olá<i>,</i> Contador<i>.</i>
          </span>
        </Link>

          {/* NAVEGAÇÃO DESKTOP */}
          <nav className="public-nav-links" aria-label="Navegação principal">
            <Link className="public-lk" href="/" aria-current={active === "home" ? "page" : undefined}>
              Início
            </Link>
            <Link className="public-lk" href="/#como-funciona">
              Como funciona
            </Link>
            <Link className="public-lk" href="/servicos" aria-current={active === "servicos" ? "page" : undefined}>
              Serviços
            </Link>
            <Link className="public-lk" href="/radar" aria-current={active === "radar" ? "page" : undefined}>
              Radar Fiscal
            </Link>
            <Link className="public-lk" href="/blog" aria-current={active === "blog" ? "page" : undefined}>
              Blog
            </Link>
            <EntrarMenu />
            <Link className="public-lk-highlight" href="/precos" aria-current={active === "precos" ? "page" : undefined}>
              <span>Resolver meu caso</span>
              <ArrowUpRight size={14} />
            </Link>
          </nav>

          {/* BOTÃO TOGGLE MOBILE */}
          <button
            type="button"
            className={`public-mobile-toggle ${menuMobileAberto ? "is-active" : ""}`}
            aria-label={menuMobileAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuMobileAberto}
            onClick={() => setMenuMobileAberto((v) => !v)}
          >
            {menuMobileAberto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* MENU DRAWER MOBILE COM ANIMAÇÃO SUAVE E SÓLIDA */}
        <div 
          className={`public-mobile-menu-overlay ${menuMobileAberto ? "is-open" : ""}`} 
          onClick={() => setMenuMobileAberto(false)}
          aria-hidden={!menuMobileAberto}
        >
          <div className="public-mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="public-mobile-menu-links">
              <Link 
                className={`public-mobile-lk ${active === "home" ? "active" : ""}`} 
                href="/" 
                onClick={() => setMenuMobileAberto(false)}
              >
                <span>Início</span>
              </Link>
              <Link 
                className="public-mobile-lk" 
                href="/#como-funciona" 
                onClick={() => setMenuMobileAberto(false)}
              >
                <span>Como funciona</span>
              </Link>
              <Link 
                className={`public-mobile-lk ${active === "servicos" ? "active" : ""}`} 
                href="/servicos" 
                onClick={() => setMenuMobileAberto(false)}
              >
                <span>Serviços Especializados</span>
              </Link>
              <Link 
                className={`public-mobile-lk ${active === "radar" ? "active" : ""}`} 
                href="/radar" 
                onClick={() => setMenuMobileAberto(false)}
              >
                <span>Radar Fiscal</span>
              </Link>
              <Link 
                className={`public-mobile-lk ${active === "blog" ? "active" : ""}`} 
                href="/blog" 
                onClick={() => setMenuMobileAberto(false)}
              >
                <span>Blog & Guias</span>
              </Link>
              <Link 
                className="public-mobile-cta-btn" 
                href="/precos" 
                onClick={() => setMenuMobileAberto(false)}
              >
                <span>Resolver meu caso</span>
                <ArrowUpRight size={17} />
              </Link>
            </div>

            <div className="public-mobile-menu-divider" />

            <div className="public-mobile-auth-section">
              <span className="public-mobile-auth-title">Acesso ao Sistema</span>
              <div className="public-mobile-auth-grid">
                <Link 
                  className="public-mobile-auth-btn" 
                  href="/login?role=cliente" 
                  onClick={() => setMenuMobileAberto(false)}
                >
                  <UserCheck size={17} className="public-mobile-auth-icon client" />
                  <span>Sou cliente</span>
                </Link>
                <Link 
                  className="public-mobile-auth-btn" 
                  href="/login?role=contador" 
                  onClick={() => setMenuMobileAberto(false)}
                >
                  <Building2 size={17} className="public-mobile-auth-icon accountant" />
                  <span>Sou contador</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
  );
}

function EntrarMenu() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };
    document.addEventListener("click", fechar);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", fechar);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto]);

  return (
    <div className="public-entrar-menu-wrap" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="public-lk public-entrar-menu-btn"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <span>Entrar</span>
        <ChevronDown size={14} className={aberto ? "rotated" : ""} />
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            key="entrar-menu"
            role="menu"
            className="public-entrar-menu-popover"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link role="menuitem" href="/login?role=cliente" className="public-menu-item">
              <UserCheck size={18} className="public-menu-item-icon client" />
              <span>Sou cliente</span>
            </Link>
            <Link role="menuitem" href="/login?role=contador" className="public-menu-item">
              <Building2 size={18} className="public-menu-item-icon accountant" />
              <span>Sou contador</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-footer-dark">
      <div className="public-rodape-grid">
        {/* COLUNA 1: MARCA */}
        <div className="public-rodape-brand-col">
          <div className="public-brand" style={{ marginBottom: "12px" }}>
            <Image src="/logo-light.svg" alt="Olá, Contador" width={28} height={29} />
            <span style={{ color: "#FFFFFF", fontSize: "18px" }}>
              Olá<i>,</i> Contador<i>.</i>
            </span>
          </div>
          <p className="public-rodape-desc">
            Atendimento contábil sob demanda com contadores de verdade. Sem mensalidade, sem surpresa.
          </p>
          <span className="public-rodape-crc-text">
            Atendimento 100% online em todo o Brasil
          </span>
          <a
            href="https://instagram.com/olacontador"
            target="_blank"
            rel="noopener noreferrer"
            className="public-rodape-social-link"
            aria-label="Instagram da Olá, Contador"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "12px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span>@olacontador</span>
          </a>
        </div>

        {/* COLUNA 2: PESSOA FÍSICA (SEO & Links Diretos) */}
        <div className="public-rodape-col-servicos">
          <h4 className="public-rodape-heading">Para Você (PF)</h4>
          <ul className="public-rodape-links">
            <li><Link href="/servicos/decore-contador-declaracao-renda">Emissão de DECORE</Link></li>
            <li><Link href="/servicos/regularizar-cpf-suspenso-pendente">Regularizar CPF</Link></li>
            <li><Link href="/servicos/malha-fina-imposto-de-renda">Malha Fina IRPF</Link></li>
            <li><Link href="/servicos/ganho-de-capital-gcap-imoveis">Ganho de Capital (GCAP)</Link></li>
            <li><Link href="/servicos/carne-leao-autonomos-exterior">Carnê-Leão Mensal</Link></li>
            <li><Link href="/servicos" style={{ color: "#EE5F3A", fontWeight: 600 }}>Ver todos para PF →</Link></li>
          </ul>
        </div>

        {/* COLUNA 3: MEI & EMPRESAS (SEO & Links Diretos) */}
        <div className="public-rodape-col-servicos">
          <h4 className="public-rodape-heading">MEI & Empresas</h4>
          <ul className="public-rodape-links">
            <li><Link href="/servicos/regularizacao-mei-das-atrasado">Regularizar MEI & DAS</Link></li>
            <li><Link href="/servicos/baixa-cancelamento-cnpj-mei">Baixa de CNPJ MEI</Link></li>
            <li><Link href="/servicos/regularizacao-cnpj-inapto-omissao">CNPJ Inapto (Reativação)</Link></li>
            <li><Link href="/servicos/baixa-encerramento-cnpj-com-dividas">Baixa com Dívidas</Link></li>
            <li><Link href="/servicos/parcelamento-dividas-simples-nacional">Parcelamentos PGFN</Link></li>
            <li><Link href="/servicos" style={{ color: "#EE5F3A", fontWeight: 600 }}>Ver todos para Empresas →</Link></li>
          </ul>
        </div>

        {/* COLUNA 4: INSTITUCIONAL & CONTATO */}
        <div className="public-rodape-col-institucional">
          <h4 className="public-rodape-heading">Institucional</h4>
          <ul className="public-rodape-links">
            <li><Link href="/servicos">Catálogo de Serviços</Link></li>
            <li><Link href="/blog">Blog & Guias Fiscais</Link></li>
            <li><Link href="/radar">Radar Fiscal</Link></li>
            <li><Link href="/validar-relatorio">Validar Relatório</Link></li>
            <li><Link href="/termos">Termos de Uso</Link></li>
            <li><Link href="/login">Área do Cliente</Link></li>
            <li style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <a href="mailto:ola@olacontador.com.br" className="public-rodape-email-link">
                ola@olacontador.com.br
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* LINHA BASE */}
      <div className="public-rodape-base">
        <span>
          © {new Date().getFullYear()} Olá, Contador · HEXX SERVIÇOS DIGITAIS LTDA · CNPJ 62.414.421/0001-16
        </span>
        <span>Atendimento com garantia e preço fixo</span>
      </div>
    </footer>
  );
}
