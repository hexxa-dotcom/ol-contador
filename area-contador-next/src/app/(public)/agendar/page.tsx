import { Suspense } from "react";
import { AgendarClient } from "./agendar-client";

export const metadata = { title: "Agendar atendimento — Olá, Contador", robots: "noindex" };

export default function AgendarPage() {
  return (
    <Suspense fallback={null}>
      <AgendarClient />
    </Suspense>
  );
}
