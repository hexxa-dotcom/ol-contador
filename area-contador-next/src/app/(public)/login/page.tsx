import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { LoginPanel } from "./login-panel";
import styles from "./login.module.css";

export const metadata = { title: "Entrar — Olá, Contador", robots: "noindex" };
export const dynamic = "force-dynamic";

const TEXTOS = {
  cliente: { titulo: "Entrar como cliente", sub: "Acesse sua área para acompanhar atendimentos, documentos e o Radar Fiscal." },
  contador: { titulo: "Painel do escritório", sub: "Entre com a conta cadastrada pelo escritório." },
  geral: { titulo: "Entrar", sub: "Use o e-mail da sua conta. Levamos você direto para a sua área." },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string; role?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  if (supabase && params.recovery !== "1") {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/painel");
  }

  const papel = params.role === "cliente" || params.role === "contador" ? params.role : null;
  const textos = TEXTOS[papel ?? "geral"];

  return (
    <div className={styles.shell}>
      <div className={styles.ladoForm}>
        <Link className={styles.voltar} href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Voltar para a home
        </Link>
        <div className={styles.formCard}>
          <Link className={styles.brand} href="/">
            <h1>Olá<i>,</i> Contador<i>.</i></h1>
          </Link>
          <h2>{textos.titulo}</h2>
          <p className={styles.sub}>{textos.sub}</p>

          <LoginForm />

          <div className={styles.foot}>
            Ainda não é cliente? <Link href="/precos">Ver preços e agendar</Link>
          </div>
        </div>
      </div>

      <LoginPanel papel={papel} />
    </div>
  );
}
