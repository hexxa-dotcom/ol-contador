import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Área do Contador | Olá, Contador",
  description: "Prévia da nova Área do Contador",
  icons: { icon: "/logo.svg", shortcut: "/logo.svg", apple: "/logo.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
