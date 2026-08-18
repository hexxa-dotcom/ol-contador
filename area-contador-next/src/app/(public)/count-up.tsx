"use client";

import { useEffect, useState } from "react";
import { useInView, animate } from "framer-motion";
import { useRef } from "react";

export function CountUp({ to, durationMs = 2000, format }: { to: number; durationMs?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -50px 0px" });
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, to, {
        duration: durationMs / 1000,
        onUpdate: (val) => setValor(Math.round(val)),
        ease: "easeOut"
      });
      return () => controls.stop();
    }
  }, [isInView, to, durationMs]);

  return <span ref={ref}>{format ? format(valor) : valor}</span>;
}
