import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
  description: "Preço fixo por atendimento com contador de CRC ativo. Sem mensalidade, sem surpresas. Acompanhamento pelo chat seguro e relatório assinado.",
  keywords: ["contador online", "contabilidade sob demanda", "preço fixo contador", "radar fiscal", "regularizar mei", "imposto de renda", "abrir empresa"],
  authors: [{ name: "Olá, Contador" }],
  icons: { icon: "/logo.svg", shortcut: "/logo.svg", apple: "/logo.svg" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://olacontador.com.br",
    siteName: "Olá, Contador",
    title: "Olá, Contador — Atendimento contábil sob demanda com preço fixo",
    description: "Fale direto com um contador de registro CRC ativo no chat seguro. Sem mensalidade, com relatório assinado.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Olá, Contador — Atendimento contábil sob demanda",
    description: "Preço fixo por atendimento, combinado antes. Chat seguro com contador e relatório assinado com CRC.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${hanken.variable} ${plusJakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
