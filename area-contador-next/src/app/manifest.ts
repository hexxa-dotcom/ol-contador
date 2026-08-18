import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Olá, Contador",
    short_name: "Olá, Contador",
    description: "Atendimento contábil sob demanda com preço fixo e monitoramento fiscal contínuo",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#07322A",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
