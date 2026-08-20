"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "request" | "recovery" | "otp-request" | "otp-verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [success, setSuccess] = useState("");
  const [otpCode, setOtpCode] = useState("");

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

    if (mode === "otp-request") {
      // shouldCreateUser:false é a trava de segurança — sem isso, qualquer
      // e-mail digitado criaria conta nova. Só quem já tem conta recebe
      // código; e-mail inexistente também mostra a mesma mensagem genérica
      // (não confirma nem nega se a conta existe).
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      setLoading(false);
      if (otpError && !/rate limit/i.test(otpError.message)) {
        setError("Não foi possível enviar o código agora.");
        return;
      }
      setSuccess("Se o e-mail estiver cadastrado, você recebeu um código de acesso.");
      setMode("otp-verify");
      return;
    }
    if (mode === "otp-verify") {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: "email",
      });
      setLoading(false);
      if (verifyError) {
        setError("Código inválido ou expirado. Solicite um novo.");
        return;
      }
      router.replace("/painel");
      router.refresh();
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

    router.replace("/painel");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {mode !== "recovery" && mode !== "otp-verify" && (
        <div>
          <label htmlFor="login-email">E-mail</label>
          <div className={styles.field}>
            <Mail size={16} />
            <input id="login-email" className={styles.input} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" required />
          </div>
        </div>
      )}
      {mode === "otp-verify" && (
        <div>
          <label htmlFor="login-otp">Código de acesso</label>
          <div className={styles.field}>
            <KeyRound size={16} />
            <input id="login-otp" className={styles.input} name="otp" inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="Digite o código recebido por e-mail" required />
          </div>
        </div>
      )}
      {mode !== "request" && mode !== "otp-request" && mode !== "otp-verify" && (
        <div>
          <label htmlFor="login-password">{mode === "recovery" ? "Nova senha" : "Senha"}</label>
          <div className={styles.field}>
            <LockKeyhole size={16} />
            <input id="login-password" className={styles.input} name="password" type="password" autoComplete={mode === "recovery" ? "new-password" : "current-password"} minLength={mode === "recovery" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "recovery" ? "Mínimo de 8 caracteres" : "Digite sua senha"} required />
          </div>
        </div>
      )}
      {mode === "recovery" && (
        <div>
          <label htmlFor="login-confirm">Confirmar nova senha</label>
          <div className={styles.field}>
            <LockKeyhole size={16} />
            <input id="login-confirm" className={styles.input} type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repita a nova senha" required />
          </div>
        </div>
      )}
      {error && <div className={`${styles.msg} ${styles.msgErr}`} role="alert">{error}</div>}
      {success && <div className={`${styles.msg} ${styles.msgOk}`} role="status">{success}</div>}
      <button className={styles.button} type="submit" disabled={loading}>
        {loading
          ? "Processando…"
          : mode === "request"
            ? "Enviar link seguro"
            : mode === "recovery"
              ? "Salvar nova senha"
              : mode === "otp-request"
                ? "Enviar código"
                : mode === "otp-verify"
                  ? "Confirmar código"
                  : "Entrar"}
      </button>
      {mode === "login" && (
        <>
          <button className={styles.link} type="button" onClick={() => { setError(""); setSuccess(""); setMode("request"); }}>Esqueci minha senha</button>
          <button className={styles.link} type="button" onClick={() => { setError(""); setSuccess(""); setOtpCode(""); setMode("otp-request"); }}>Entrar sem senha (código por e-mail)</button>
        </>
      )}
      {mode !== "login" && (
        <button className={styles.link} type="button" onClick={() => { setError(""); setSuccess(""); setOtpCode(""); setMode("login"); }}>Voltar para o login</button>
      )}
      {mode === "otp-verify" && (
        <button className={styles.link} type="button" onClick={() => { setError(""); setSuccess(""); setMode("otp-request"); }}>Reenviar código</button>
      )}
    </form>
  );
}
