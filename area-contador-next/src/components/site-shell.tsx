"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

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

export function SiteHeader({ active }: { active?: "home" | "precos" | "radar" }) {
  return (
    <header className="public-nav-wrap">
      <div className="public-nav-container">
        <Link className="public-brand" href="/" aria-label="Voltar para a página inicial">
          <Image src="/logo.svg" alt="" width={32} height={33} />
          <span>
            Olá<i>,</i> Contador<i>.</i>
          </span>
        </Link>
        <nav className="public-nav-links" aria-label="Navegação principal">
          <Link className="public-lk" href="/precos" aria-current={active === "precos" ? "page" : undefined}>
            Preços
          </Link>
          <Link className="public-lk" href="/radar" aria-current={active === "radar" ? "page" : undefined}>
            Radar Fiscal
          </Link>
          <EntrarMenu />
        </nav>
      </div>
    </header>
  );
}

function EntrarMenu() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    document.addEventListener("click", fechar);
    return () => document.removeEventListener("click", fechar);
  }, [aberto]);

  return (
    <div style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="public-lk"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", font: "inherit", padding: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Entrar
      </button>
      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            minWidth: "180px",
            background: "var(--background)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
            padding: "6px",
            zIndex: 50,
          }}
        >
          <Link
            role="menuitem"
            href="/login?role=cliente"
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", color: "var(--foreground)", textDecoration: "none", fontSize: "14.5px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="3.4" />
              <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
            </svg>
            Sou cliente
          </Link>
          <Link
            role="menuitem"
            href="/login?role=contador"
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", color: "var(--foreground)", textDecoration: "none", fontSize: "14.5px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="2.5" />
              <path d="M8.6 7.6h6.8M8.6 12h.01M12 12h.01M15.4 12h.01M8.6 16h.01M12 16h.01M15.4 16h.01" />
            </svg>
            Sou contador
          </Link>
        </div>
      )}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-footer-dark" style={{ background: "var(--pub-ink)", color: "rgba(255,255,255,0.7)" }}>
      <div className="public-rodape-grid">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "16px" }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "19px", color: "#fff" }}>
              Olá<span style={{ color: "var(--pub-coral)" }}>,</span> Contador<span style={{ color: "var(--pub-coral)" }}>.</span>
            </span>
          </div>
          <p style={{ fontSize: "15px", lineHeight: 1.55, maxWidth: "280px", margin: 0 }}>
            Um contador a um clique, pra você resolver a vida com a Receita sem sair de casa.
          </p>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px", marginBottom: "14px" }}>Serviços</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "15px" }}>
            <Link href="/#como-funciona" className="lk">Como funciona</Link>
            <Link href="/#pra-que-serve" className="lk">Pra que serve</Link>
            <Link href="/precos" className="lk">Preços</Link>
          </div>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px", marginBottom: "14px" }}>Empresa</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "15px" }}>
            <a href="mailto:ola@olacontador.com.br?subject=Quero%20atender%20na%20plataforma%20(sou%20contador)" className="lk">É contador? Atenda com a gente</a>
            <Link href="/login?role=contador" className="lk">Área do contador</Link>
          </div>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px", marginBottom: "14px" }}>Contato</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "15px" }}>
            <a href="mailto:ola@olacontador.com.br" className="lk">ola@olacontador.com.br</a>
            <Link href="/#duvidas" className="lk">Dúvidas frequentes</Link>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", marginTop: "40px" }}>
        <div className="public-rodape-base">
          <span>© {new Date().getFullYear()} Olá, Contador · HEXX SERVIÇOS DIGITAIS LTDA · CNPJ 62.414.421/0001-16</span>
          <span>Feito com carinho no Brasil 🇧🇷</span>
        </div>
      </div>
    </footer>
  );
}
