"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, ChevronDown, UserCheck, Building2 } from "lucide-react";

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
          <Image src="/logo.svg" alt="Olá, Contador" width={34} height={35} priority />
          <span>
            Olá<i>,</i> Contador<i>.</i>
          </span>
        </Link>
        <nav className="public-nav-links" aria-label="Navegação principal">
          <Link className="public-lk" href="/" aria-current={active === "home" ? "page" : undefined}>
            Início
          </Link>
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
        className="public-btn-entrar"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <span>Entrar</span>
      </button>

      {aberto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            minWidth: "200px",
            background: "#FFFFFF",
            border: "1px solid rgba(34, 49, 47, 0.12)",
            borderRadius: "16px",
            boxShadow: "0 16px 40px -10px rgba(7, 50, 42, 0.18)",
            padding: "8px",
            zIndex: 100,
          }}
        >
          <Link
            role="menuitem"
            href="/login?role=cliente"
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              padding: "12px 14px", 
              borderRadius: "10px", 
              color: "var(--pub-ink, #22312F)", 
              textDecoration: "none", 
              fontSize: "14px",
              fontWeight: "600",
              transition: "background 0.2s ease"
            }}
            className="public-menu-item"
          >
            <UserCheck size={18} style={{ color: "var(--pub-green, #0C5446)" }} />
            <span>Sou cliente</span>
          </Link>
          <Link
            role="menuitem"
            href="/login?role=contador"
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              padding: "12px 14px", 
              borderRadius: "10px", 
              color: "var(--pub-ink, #22312F)", 
              textDecoration: "none", 
              fontSize: "14px",
              fontWeight: "600",
              transition: "background 0.2s ease"
            }}
            className="public-menu-item"
          >
            <Building2 size={18} style={{ color: "#FF9C7E" }} />
            <span>Sou contador</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-footer-dark">
      <div className="public-rodape-grid">
        <div>
          <div className="public-brand" style={{ marginBottom: "16px" }}>
            <Image src="/logo.svg" alt="Olá, Contador" width={32} height={33} />
            <span style={{ color: "#FFFFFF" }}>
              Olá<i>,</i> Contador<i>.</i>
            </span>
          </div>
          <p style={{ fontSize: "14px", lineHeight: "1.6", color: "rgba(255,255,255,0.75)", maxWidth: "340px" }}>
            Atendimento contábil sob demanda com contador de registro CRC ativo. Sem mensalidade, sem surpresas.
          </p>
        </div>
        <div>
          <h4 style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: "700", marginBottom: "16px" }}>Serviços</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
            <li><Link href="/precos">Pessoa Física (R$ 199)</Link></li>
            <li><Link href="/precos">Pessoa Jurídica (R$ 399)</Link></li>
            <li><Link href="/radar">Radar Fiscal</Link></li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: "700", marginBottom: "16px" }}>Institucional</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
            <li><Link href="/termos">Termos de Uso</Link></li>
            <li><Link href="/privacidade">Política de Privacidade</Link></li>
            <li><Link href="/login">Área do Cliente</Link></li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: "700", marginBottom: "16px" }}>Contato</h4>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", margin: 0 }}>
            ola@olacontador.com.br<br />
            Atendimento 100% online em todo o Brasil
          </p>
        </div>
      </div>

      <div className="public-rodape-base">
        <span>© {new Date().getFullYear()} Olá, Contador. Todos os direitos reservados.</span>
        <span>CRC Ativo · Atendimento com garantia</span>
      </div>
    </footer>
  );
}
