import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase/admin";
import { HomePage } from "./home-page";

export const metadata: Metadata = {
  title: "Olá, Contador — Um contador de verdade, dedicado ao seu caso",
  description: "Conte o que está acontecendo, envie os documentos pelo celular, e um contador com registro CRC ativo cuida do seu caso do começo ao fim. Se não resolvermos, devolvemos seu dinheiro.",
  alternates: { canonical: "https://www.olacontador.com.br/" },
  openGraph: {
    type: "website",
    siteName: "Olá, Contador",
    title: "Olá, Contador — Um contador de verdade, dedicado ao seu caso",
    description: "Conte o que está acontecendo, envie os documentos pelo celular, e um contador com registro CRC ativo cuida do seu caso do começo ao fim. Se não resolvermos, devolvemos seu dinheiro.",
    url: "https://www.olacontador.com.br/",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Olá, Contador — Um contador de verdade, dedicado ao seu caso",
    description: "Conte o que está acontecendo, envie os documentos pelo celular, e um contador com registro CRC ativo cuida do seu caso do começo ao fim.",
  },
};

const JSON_LD_SERVICO = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Olá, Contador",
  url: "https://www.olacontador.com.br/",
  description: "Atendimento contábil sob demanda com contador de registro CRC ativo, dedicado ao seu caso. Envie o caso e os documentos pelo celular, com garantia de reembolso.",
  areaServed: "BR",
  priceRange: "R$ 199 - R$ 399",
};

const JSON_LD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Preciso agendar, ou consigo atendimento no mesmo dia?", acceptedAnswer: { "@type": "Answer", text: "O plano Express foi feito exatamente pra isso — você é atendido no mesmo dia, sem precisar marcar horário. Se preferir, também dá pra agendar um horário específico." } },
    { "@type": "Question", name: "Meu caso é urgente, tem prazo vencendo. E agora?", acceptedAnswer: { "@type": "Answer", text: "Avise isso logo no início do atendimento. Casos com prazo apertado são priorizados pelo contador responsável." } },
    { "@type": "Question", name: "Tenho mais de um CNPJ. Preciso pagar um atendimento pra cada?", acceptedAnswer: { "@type": "Answer", text: "Sim, cada CNPJ é tratado como um caso separado, porque a situação fiscal de cada empresa é diferente." } },
    { "@type": "Question", name: "Atendem fora do horário comercial?", acceptedAnswer: { "@type": "Answer", text: "Você pode enviar seu caso a qualquer hora — a análise do contador acontece dentro do prazo de resposta combinado." } },
  ],
};

async function precoDe(id: string, fallbackCents: number): Promise<number> {
  const admin = adminClient();
  if (!admin) return fallbackCents;
  const { data } = await admin.from("servicos").select("price_cents").eq("id", id).maybeSingle();
  return data?.price_cents ?? fallbackCents;
}

export const dynamic = "force-dynamic";

export default async function Page() {
  const [pf, pj, consulta] = await Promise.all([precoDe("pf", 19900), precoDe("pj-atendimento", 39900), precoDe("consulta", 19900)]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_SERVICO) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_FAQ) }} />
      <HomePage precos={{ pf, pj, consulta }} />
    </>
  );
}
