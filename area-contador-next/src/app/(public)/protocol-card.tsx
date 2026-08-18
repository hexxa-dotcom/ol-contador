"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

const PASSOS = ["Documentos recebidos", "Caso em análise pelo contador", "Retificação enviada", "Relatório final assinado"];

/** Mockup vivo do protocolo — os passos vão se completando sozinhos, em loop,
 * pra comunicar "acompanhamento real" sem precisar de mais texto no hero. */
export function ProtocolCard() {
  const [prontos, setProntos] = useState(2);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setProntos((p) => (p >= PASSOS.length ? 2 : p + 1));
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const concluido = prontos >= PASSOS.length;

  return (
    <div className={styles.protocolWrap}>
      <div className={styles.protocolCard}>
        <div className={styles.protocolHead}>
          <span className={styles.protocolId}>PROTOCOLO #OC-4471</span>
          <span className={`${styles.protocolStatus} ${concluido ? styles.concluido : ""}`}>{concluido ? "Concluído" : "Em andamento"}</span>
        </div>
        <div className={styles.protocolBody}>
          <h4>Malha fina — Imposto de Renda</h4>
          <p>Contador responsável: registro CRC ativo e verificado.</p>
          <div className={styles.protocolSteps}>
            {PASSOS.map((passo, i) => {
              const feito = i < prontos;
              return (
                <div key={passo} className={`${styles.pstep} ${feito ? "" : styles.pendingText}`}>
                  <div className={`${styles.pdot} ${feito ? "" : styles.pending}`}>{feito ? "✓" : ""}</div>
                  {passo}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
