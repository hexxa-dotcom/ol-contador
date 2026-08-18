"use client";

import styles from "./timeline-steps.module.css";

import { useRef } from "react";
import { useInView } from "framer-motion";

function StepRow({ step }: { step: { n: string; t: string; d: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { margin: "-40% 0px -40% 0px" });

  return (
    <div ref={ref} className={`${styles.stepRow} ${isInView ? styles.stepActive : ""}`}>
      <div className={styles.stepMarker}>
        {step.n.replace(/^0/, "")}
      </div>
      <div className={styles.stepContent}>
        <h3>{step.t}</h3>
        <p>{step.d}</p>
      </div>
    </div>
  );
}

export function TimelineSteps({ steps }: { steps: { n: string; t: string; d: string }[] }) {
  return (
    <div className={styles.timelineWrap}>
      {steps.map((step) => (
        <StepRow key={step.n} step={step} />
      ))}
    </div>
  );
}
