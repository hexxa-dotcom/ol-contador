import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Olá, Contador",
    short_name: "Olá Contador",
    description: "Seu contador pessoal a um clique de distância. Atendimento contábil sob demanda e monitoramento fiscal contínuo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#093726",
    theme_color: "#093726",
    lang: "pt-BR",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Área do Cliente",
        short_name: "Atendimento",
        description: "Acessar seus atendimentos e falar com o contador",
        url: "/portal",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Radar Fiscal",
        short_name: "Radar",
        description: "Consultar situação fiscal e pendências",
        url: "/radar",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Contratar Atendimento",
        short_name: "Planos",
        description: "Resolver pendência ou contratar atendimento",
        url: "/precos",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
