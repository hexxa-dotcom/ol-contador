import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("button", className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("badge", className)}>{children}</span>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

type StatusTone = "empty" | "loading" | "success" | "error";

export function StatusState({ children, tone = "empty" }: { children: ReactNode; tone?: StatusTone }) {
  return <div className={cn("status-state", `status-${tone}`, tone === "empty" && "empty-state")} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}><span className="status-state-mark" aria-hidden="true"><i /></span><span>{children}</span></div>;
}

export function EmptyState({ children = "Nenhum registro encontrado." }: { children?: ReactNode }) {
  return <StatusState tone="empty">{children}</StatusState>;
}
