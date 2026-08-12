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

export function SiteHeader({ active }: { active?: "precos" }) {
  return (
    <header className="public-nav-wrap">
      <div className="public-nav-container">
        <Link className="public-brand" href="/precos" aria-label="Voltar para a página inicial">
          <Image src="/logo.svg" alt="" width={32} height={33} />
          <span>
            Olá<i>,</i> Contador<i>.</i>
          </span>
        </Link>
        <nav className="public-nav-links" aria-label="Navegação principal">
          <Link className="public-lk" href="/precos" aria-current={active === "precos" ? "page" : undefined}>
            Preços
          </Link>
          <Link className="public-lk" href="/login">
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-footer">
      © {new Date().getFullYear()} Olá, Contador · Contadores com registro CRC ·{" "}
      <a href="mailto:ola@olacontador.com.br">ola@olacontador.com.br</a>
    </footer>
  );
}
