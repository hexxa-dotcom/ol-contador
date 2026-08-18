"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  CalendarCheck, 
  MessageSquareText, 
  Clock, 
  FileCheck, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import styles from "./precos.module.css";

const PASSOS = [
  { 
    n: "01", 
    t: "Agende seu horário", 
    icon: CalendarCheck,
  },
  { 
    n: "02", 
    t: "Conte o seu caso", 
    icon: MessageSquareText,
  },
  { 
    n: "03", 
    t: "Resolva no chat seguro", 
    icon: Clock,
  },
  { 
    n: "04", 
    t: "Receba o relatório", 
    icon: FileCheck,
  },
];

export function PassosComoFunciona() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section className={styles.passosSection}>
      <div className={styles.passosHeaderWrapper}>
        <div className={styles.passosEyebrow}>
          <Sparkles size={14} style={{ color: "#FF9C7E" }} />
          <span>Fluxo Transparente e Sem Burocracia</span>
        </div>
        <h2 className={styles.passosMainTitle}>
          Como funciona seu atendimento em <span style={{ color: "#FF9C7E" }}>4 passos simples</span>
        </h2>
      </div>

      <div className={styles.passosGridContainer}>
        {/* Linha conectora de progresso no desktop */}
        <div className={styles.passosTrackLine} />

        <div className={styles.passosGrid}>
          {PASSOS.map((p, index) => {
            const Icon = p.icon;
            const isActive = activeStep === index;

            return (
              <motion.div
                key={p.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.12 }}
                whileHover={{ y: -6, scale: 1.02 }}
                onMouseEnter={() => setActiveStep(index)}
                onMouseLeave={() => setActiveStep(null)}
                className={`${styles.passoCard} ${isActive ? styles.passoCardActive : ""}`}
              >
                <div className={styles.passoHeader}>
                  <div className={styles.passoNumBadge}>
                    <span className={styles.passoDot} />
                    <span>Passo {p.n}</span>
                  </div>

                  <div className={`${styles.passoIconWrap} ${isActive ? styles.passoIconActive : ""}`}>
                    <Icon size={22} />
                  </div>
                </div>

                <h3 className={styles.passoTitulo}>{p.t}</h3>

                {/* Seta conectora entre passos (exceto no ultimo) */}
                {index < PASSOS.length - 1 && (
                  <div className={styles.passoConnectorArrow}>
                    <ArrowRight size={16} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
