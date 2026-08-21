"use client";

import Script from "next/script";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// gtag.js só dispara pageview automático no load inicial — navegação
// client-side do App Router não recarrega a página, então sem isso as
// trocas de rota (home -> preços -> radar) ficariam invisíveis pro GA4.
function PageviewTracker({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    const query = searchParams.toString();
    window.gtag("config", measurementId, { page_path: query ? `${pathname}?${query}` : pathname });
  }, [pathname, searchParams, measurementId]);
  return null;
}

// measurementId vem do layout público, que lê Configurações > Chaves de API
// (banco) com fallback pra NEXT_PUBLIC_GA_MEASUREMENT_ID (Vercel). Sem
// nenhuma das duas fontes configurada, não renderiza nada — zero requisição
// a terceiro, zero custo. Só entra no layout do site público: o app
// autenticado (chat, painel do contador, portal do cliente) não carrega
// isso, pra não mandar dado de cliente pro Google.
export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
      <Suspense fallback={null}>
        <PageviewTracker measurementId={measurementId} />
      </Suspense>
    </>
  );
}
