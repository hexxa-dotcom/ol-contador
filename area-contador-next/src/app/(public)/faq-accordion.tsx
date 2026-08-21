"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./home.module.css";

export function FaqAccordion({ faqList }: { faqList: { p: string; r: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className={styles.faqWrap}>
      {faqList.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={`${styles.faqItem} ${isOpen ? styles.faqOpen : ""}`}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className={styles.faqButton}
            >
              <span className={styles.faqTitle}>{item.p}</span>
              <span className={styles.faqIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={styles.faqContent}
                >
                  <p>{item.r}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
