"use client";

import { useState, useEffect } from "react";
import styles from "./cases-showcase.module.css";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function CasesShowcase({ casos }: { casos: any[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveIdx((prev) => (prev + 1) % casos.length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeIdx, casos.length]);

  return (
    <div className={styles.wrap}>
      {/* Menu/Tabs */}
      <div className={styles.menu}>
        {casos.map((c, i) => (
          <button 
            key={i} 
            className={`${styles.tab} ${i === activeIdx ? styles.active : ""}`}
            onClick={() => setActiveIdx(i)}
          >
            <div className={styles.tabContent}>
              <span className={styles.tabNum}>0{i + 1}</span>
              <h3>{c.titulo}</h3>
            </div>
            {i === activeIdx && (
              <p className={styles.tabHint}>Ver detalhes da solução</p>
            )}
          </button>
        ))}
      </div>

      {/* Visor de Conteúdo */}
      <div className={styles.viewer}>
        <div className={styles.ticketCard}>
          <div className={styles.ticketHeader}>
            <div className={styles.ticketStatus}>
              <CheckCircle2 size={18} />
              <span>Caso Resolvido</span>
            </div>
            <div className={styles.ticketId}>Protocolo #{1024 + activeIdx * 7}</div>
          </div>

          <h2 className={styles.ticketTitle}>{casos[activeIdx].titulo}</h2>

          <div className={styles.ticketBody}>
            <div className={styles.ticketStep}>
              <div className={styles.stepIcon}>1</div>
              <div className={styles.stepInfo}>
                <span className={styles.stepLabel}>O que fizemos</span>
                <p>{casos[activeIdx].fizemos}</p>
              </div>
            </div>

            <div className={styles.ticketConnector} />

            <div className={styles.ticketStep}>
              <div className={styles.stepIconSuccess}><CheckCircle2 size={16} /></div>
              <div className={styles.stepInfo}>
                <span className={styles.stepLabel}>Resultado final</span>
                <p className={styles.stepHighlight}>{casos[activeIdx].depois}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
