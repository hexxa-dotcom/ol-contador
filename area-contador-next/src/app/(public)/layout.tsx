import type { Viewport } from "next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { adminClient } from "@/lib/supabase/admin";
import { getSystemSecret } from "@/lib/systemSecrets";

// Site público precisa permitir pinch-to-zoom (acessibilidade + o Google
// penaliza `user-scalable=no` em mobile) — só o app autenticado (chat,
// painel) mantém o viewport travado do layout raiz, pensado pra sensação de
// app nativo onde zoom acidental atrapalha.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Mesma fonte que as demais chaves em Configurações > Chaves de API — banco
  // primeiro, variável de ambiente da Vercel como fallback. Lido aqui no
  // servidor pra não depender de rebuild quando o contador troca o ID.
  const admin = adminClient();
  const gaMeasurementId = admin ? await getSystemSecret(admin, "NEXT_PUBLIC_GA_MEASUREMENT_ID") : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null;
  return (
    <div className="site-public font-sans">
      <GoogleAnalytics measurementId={gaMeasurementId} />
      {children}
    </div>
  );
}
