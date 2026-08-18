"use client";

import { useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";

export function GlowCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--pub-border)] bg-[#ffffff] shadow-sm transition-transform duration-300 hover:-translate-y-1 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-in-out"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(238, 95, 58, 0.08), transparent 40%)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
