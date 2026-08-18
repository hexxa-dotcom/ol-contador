"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./home.module.css";

/**
 * Faixa de cards que vira slide com scroll-snap no celular, com bolinhas de
 * posição e avanço automático. Espelha o comportamento de carrossel.js do
 * site legado (index/precos/radar-fiscal), só que como componente React.
 */
export function Carrossel({ children, className }: { children: ReactNode[]; className?: string }) {
  const faixaRef = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(0);
  const total = children.length;

  useEffect(() => {
    const faixa = faixaRef.current;
    if (!faixa || total < 2) return;

    const consultaMobile = window.matchMedia("(max-width: 860px)");
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | null = null;
    let retomar: ReturnType<typeof setTimeout> | null = null;
    let visivel = false;
    let atualRef = 0;

    const irPara = (i: number) => {
      atualRef = (i + total) % total;
      const item = faixa.children[atualRef] as HTMLElement | undefined;
      if (item) faixa.scrollTo({ left: item.offsetLeft - faixa.offsetLeft, behavior: "smooth" });
      setAtivo(atualRef);
    };

    let agendado = false;
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => {
        agendado = false;
        const meio = faixa.scrollLeft + faixa.clientWidth / 2;
        let maisPerto = 0, menorDist = Infinity;
        Array.from(faixa.children).forEach((it, i) => {
          const el = it as HTMLElement;
          const centro = el.offsetLeft - faixa.offsetLeft + el.clientWidth / 2;
          const d = Math.abs(centro - meio);
          if (d < menorDist) { menorDist = d; maisPerto = i; }
        });
        atualRef = maisPerto;
        setAtivo(maisPerto);
      });
    };

    const rodar = () => {
      if (timer || !visivel || !consultaMobile.matches || semMovimento.matches) return;
      timer = setInterval(() => irPara(atualRef + 1), 5000);
    };
    const parar = () => { if (timer) clearInterval(timer); timer = null; };
    const pausar = () => { parar(); if (retomar) clearTimeout(retomar); retomar = setTimeout(rodar, 9000); };

    faixa.addEventListener("scroll", aoRolar, { passive: true });
    faixa.addEventListener("pointerdown", pausar);
    faixa.addEventListener("wheel", pausar, { passive: true });

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([e]) => {
        visivel = e.isIntersecting;
        visivel ? rodar() : parar();
      }, { threshold: 0.35 });
      observer.observe(faixa);
    } else {
      visivel = true;
      rodar();
    }

    const aoVisibilidade = () => (document.hidden ? parar() : rodar());
    document.addEventListener("visibilitychange", aoVisibilidade);
    const aoMudarMedia = () => (consultaMobile.matches ? rodar() : parar());
    consultaMobile.addEventListener("change", aoMudarMedia);

    return () => {
      parar();
      if (retomar) clearTimeout(retomar);
      faixa.removeEventListener("scroll", aoRolar);
      faixa.removeEventListener("pointerdown", pausar);
      faixa.removeEventListener("wheel", pausar);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", aoVisibilidade);
      consultaMobile.removeEventListener("change", aoMudarMedia);
    };
  }, [total]);

  return (
    <>
      <div ref={faixaRef} className={`${styles.carrossel} ${className ?? ""}`}>
        {children}
      </div>
      {total > 1 && (
        <div className={styles["carrossel-pontos"]}>
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para o card ${i + 1}`}
              className={i === ativo ? styles.ativo : undefined}
              onClick={() => {
                const faixa = faixaRef.current;
                const item = faixa?.children[i] as HTMLElement | undefined;
                if (faixa && item) faixa.scrollTo({ left: item.offsetLeft - faixa.offsetLeft, behavior: "smooth" });
                setAtivo(i);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

import { motion } from "framer-motion";

/** Fade + leve subida ao entrar na viewport, usando framer-motion. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className ?? ""}
    >
      {children}
    </motion.div>
  );
}
