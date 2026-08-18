import { redirect } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  if (supabase && params.recovery !== "1") {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/");
  }

  return <main className="login-shell">
    <section className="login-card">
      <div className="login-brand"><Image src="/logo.svg" alt="Símbolo Olá, Contador" width={38} height={40} priority/></div>
      <div className="login-copy"><span>ACESSO SEGURO</span><h1>Olá, Contador</h1><p>Acesse com sua conta para continuar.</p></div>
      <LoginForm/>
      <small className="login-security">Sessão protegida por Supabase Auth e políticas RLS.</small>
    </section>
  </main>;
}
