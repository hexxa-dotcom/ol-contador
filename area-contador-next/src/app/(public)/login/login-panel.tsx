"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./login.module.css";

type Papel = "cliente" | "contador" | null;

const FRASES: Record<"geral" | "cliente" | "contador", [string, string][]> = {
  geral: [
    ["Um contador de verdade, do outro lado da tela", "Registro ativo no CRC, sigilo profissional e resposta por escrito — sem sair de casa."],
    ["Sua situação com a Receita, sempre à vista", "Acompanhe atendimentos, documentos e prazos num só lugar, direto do celular."],
    ["Tudo termina com relatório assinado", "No fim do atendimento você baixa um PDF com o que aconteceu, o que foi feito e o que vem agora."],
    ["Radar Fiscal de olho por você", "A gente monitora sua situação na Receita e avisa antes do problema crescer."],
  ],
  cliente: [
    ["Sua situação com a Receita, sempre à vista", "Acompanhe atendimentos, documentos e prazos num só lugar, direto do celular."],
    ["Converse com quem cuida do seu caso", "Mensagens, documentos e histórico ficam guardados na plataforma — nada se perde no WhatsApp."],
    ["Tudo termina com relatório assinado", "Baixe um PDF com o que aconteceu, o que foi feito e o que vem agora. Seu, para sempre."],
    ["Radar Fiscal de olho por você", "A gente monitora sua situação na Receita e avisa antes do problema crescer."],
  ],
  contador: [
    ["Todo o escritório num painel só", "Atendimentos, clientes e financeiro organizados num só lugar."],
    ["Do primeiro contato ao relatório final", "Triagem, acompanhamento em Kanban e relatório assinado — o fluxo inteiro na mesma tela."],
    ["Documentos e histórico no lugar certo", "Cada caso guarda suas mensagens, arquivos e anotações. Sem caçar informação depois."],
    ["Cobrança e recebimento integrados", "Emissão, acompanhamento de pagamento e conciliação sem sair do painel."],
  ],
};

export function LoginPanel({ papel }: { papel: Papel }) {
  const lista = papel === "cliente" ? FRASES.cliente : papel === "contador" ? FRASES.contador : FRASES.geral;
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (lista.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => setAtual((i) => (i + 1) % lista.length), 5500);
    const aoVisibilidade = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
      } else if (!timer) {
        timer = setInterval(() => setAtual((i) => (i + 1) % lista.length), 5500);
      }
    };
    document.addEventListener("visibilitychange", aoVisibilidade);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVisibilidade);
    };
  }, [lista.length]);

  return (
    <div className={styles.ladoImagem}>
      <div className={styles.painel} data-papel={papel ?? undefined}>
        <div className={`${styles.luz} ${styles.luz1}`} aria-hidden="true" />
        <div className={`${styles.luz} ${styles.luz2}`} aria-hidden="true" />
        <div className={`${styles.luz} ${styles.luz3}`} aria-hidden="true" />
        <div className={styles.vinheta} aria-hidden="true" />
        <Link className={styles.painelMarca} href="/">
          <Image src="/logo.svg" alt="" width={34} height={35} style={{ filter: "brightness(0) invert(1)" }} />
          <span>Olá<i>,</i> Contador<i>.</i></span>
        </Link>
        <div className={styles.painelConteudo} aria-hidden="true">
          <div className={styles.slides}>
            {lista.map(([titulo, texto], i) => (
              <div key={titulo} className={`${styles.slide} ${i === atual ? styles.ativo : ""}`}>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </div>
            ))}
          </div>
          <div className={styles.slidesPontos}>
            {lista.map((item, i) => (
              <span key={item[0]} className={i === atual ? styles.ativo : undefined} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
