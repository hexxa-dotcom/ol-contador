import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://olacontador.com.br"),
  title: {
    default: "Olá, Contador — Atendimento contábil sob demanda",
    template: "%s | Olá, Contador",
  },
  description: "Preço fixo por atendimento com contadores dedicados. Sem mensalidade, sem surpresas. Acompanhamento pelo chat seguro e relatório com parecer técnico.",
  keywords: [
    "contador online",
    "contabilidade sob demanda",
    "preço fixo contador",
    "radar fiscal",
    "regularizar mei",
    "imposto de renda",
    "abrir empresa",
    "apoio contabil advogados",
    "registro associacao receita federal",
    "processos ecac",
    "decore contador"
  ],
  authors: [{ name: "Olá, Contador" }],
  icons: { icon: "/logo.svg", shortcut: "/logo.svg", apple: "/logo.svg" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://olacontador.com.br",
    siteName: "Olá, Contador",
    title: "Olá, Contador — Atendimento contábil sob demanda com preço fixo",
    description: "Fale direto com a nossa equipe de contadores no chat seguro. Sem mensalidade, com relatório assinado.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Olá, Contador — Atendimento contábil sob demanda",
    description: "Preço fixo por atendimento, combinado antes. Chat seguro com nossos contadores e parecer formal.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${bricolage.variable} ${hanken.variable} ${plusJakarta.variable}`}>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
