"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./login.module.css";

type Papel = "cliente" | "contador" | null;

const FRASES: Record<"geral" | "cliente" | "contador", [string, string][]> = {
  geral: [
    ["Um contador de verdade, do outro lado da tela", "Atendimento humano, sigilo profissional e resposta por escrito — sem sair de casa."],
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
  const isContador = papel === "contador";
  const lista = isContador ? FRASES.contador : papel === "cliente" ? FRASES.cliente : FRASES.geral;
  const [atual, setAtual] = useState(0);

  const imagemSrc = isContador
    ? "/illustrations/empresas-sob-demanda.jpg"
    : "/illustrations/mei-empreendedora.jpg";

  const imagemAlt = isContador
    ? "Painel do Escritório — Olá, Contador"
    : "Área do Cliente — Olá, Contador";

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
        {/* Ilustração Inteiriça Oficial */}
        <div className={styles.painelImagemInteira}>
          <Image
            src={imagemSrc}
            alt={imagemAlt}
            fill
            priority
            sizes="(max-width: 960px) 0vw, 45vw"
            className={styles.painelFotoBg}
          />
          <div className={styles.painelOverlayGradiente} />
        </div>

        {/* Marca no topo */}
        <Link className={styles.painelMarcaTopo} href="/" aria-label="Voltar para a página inicial">
          <Image src="/logo-light.svg" alt="" width={32} height={33} />
          <span>Olá<i>,</i> Contador<i>.</i></span>
        </Link>

        {/* Frases em slide no topo, entre a logo e a ilustração (sem card) */}
        <div className={styles.painelTextosTopo}>
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
