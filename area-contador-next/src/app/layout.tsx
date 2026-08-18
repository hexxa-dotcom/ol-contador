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
  title: "Área do Contador | Olá, Contador",
  description: "Atendimento contábil sob demanda com preço fixo e contador com CRC ativo.",
  icons: { icon: "/logo.svg", shortcut: "/logo.svg", apple: "/logo.svg" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${hanken.variable} ${plusJakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
