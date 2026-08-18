import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://olacontador.com.br";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/precos", "/radar", "/termos", "/privacidade"],
        disallow: ["/painel", "/portal", "/api/", "/checkout", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
