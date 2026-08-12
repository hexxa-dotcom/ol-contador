"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "request" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovery") === "1") setMode("recovery");
    if (params.get("erro") === "link")
      setError("O link expirou ou já foi utilizado. Solicite um novo e-mail.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (!supabase) {
      setError("A conexão segura ainda não foi configurada neste ambiente.");
      setLoading(false);
      return;
    }

    if (mode === "request") {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?recovery=1")}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      setLoading(false);
      if (resetError) {
        setError("Não foi possível enviar o e-mail agora.");
        return;
      }
      setSuccess("Se o e-mail estiver cadastrado, você receberá um link seguro.");
      return;
    }
    if (mode === "recovery") {
      if (password.length < 8 || password !== confirmation) {
        setError("Use pelo menos 8 caracteres e repita a mesma senha.");
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (updateError) {
        setError("O link expirou. Solicite uma nova recuperação.");
        return;
      }
      await supabase.auth.signOut();
      setPassword("");
      setConfirmation("");
      setMode("login");
      setSuccess("Senha atualizada. Entre novamente com a nova senha.");
      window.history.replaceState(null, "", "/login");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return <form className="login-form" onSubmit={submit}>
    {mode !== "recovery" && <label><span>E-mail profissional</span><div className="login-field"><Mail size={16}/><Input name="email" type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="seuemail@empresa.com" required/></div></label>}
    {mode !== "request" && <label><span>{mode === "recovery" ? "Nova senha" : "Senha"}</span><div className="login-field"><LockKeyhole size={16}/><Input name="password" type="password" autoComplete={mode === "recovery" ? "new-password" : "current-password"} minLength={mode === "recovery" ? 8 : undefined} value={password} onChange={(event)=>setPassword(event.target.value)} placeholder={mode === "recovery" ? "Mínimo de 8 caracteres" : "Digite sua senha"} required/></div></label>}
    {mode === "recovery" && <label><span>Confirmar nova senha</span><div className="login-field"><LockKeyhole size={16}/><Input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} placeholder="Repita a nova senha" required/></div></label>}
    {error && <div className="login-error" role="alert">{error}</div>}
    {success && <div className="login-success" role="status">{success}</div>}
    <Button className="full" type="submit" disabled={loading}>{loading ? "Processando…" : mode === "request" ? "Enviar link seguro" : mode === "recovery" ? "Salvar nova senha" : "Entrar"}</Button>
    {mode === "login" ? <button className="login-link" type="button" onClick={()=>{setError("");setSuccess("");setMode("request");}}>Esqueci minha senha</button> : <button className="login-link" type="button" onClick={()=>{setError("");setSuccess("");setMode("login");}}>Voltar para o login</button>}
  </form>;
}
