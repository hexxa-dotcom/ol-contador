"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BlogFaq } from "@/lib/blog";
import styles from "../blog.module.css";

export function ArticleFaqAccordion({ faqs }: { faqs: BlogFaq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex((cur) => (cur === idx ? null : idx));
  };

  return (
    <div className={styles.faqSection} aria-label="Perguntas Frequentes sobre este tema">
      <h3 className={styles.faqHeading}>Perguntas frequentes sobre o tema</h3>
      <div>
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          const id = `faq-ans-${idx}`;

          return (
            <div key={faq.question} className={styles.faqItem}>
              <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                aria-controls={id}
              >
                <span>{faq.question}</span>
                <ChevronDown
                  size={18}
                  className={`${styles.faqIcon} ${isOpen ? styles.faqIconRotated : ""}`}
                />
              </button>
              {isOpen && (
                <div id={id} className={styles.faqAnswer} role="region">
                  <p style={{ margin: 0 }}>{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
