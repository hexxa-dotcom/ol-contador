"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

// Formulário de contato pra categoria "Empresas 2" — avaliação
// gratuita, sem checkout pago. Usado tanto no card de /precos quanto na
// sidebar de cada página de serviço em /servicos/[slug]. Fica compacto (só
// o botão) até o visitante clicar, então expande os campos.
export function LeadForm({
  servicoSlug,
  ctaLabel = "Pedir Avaliação Gratuita",
  dark = false,
  accentColor,
}: {
  servicoSlug?: string;
  ctaLabel?: string;
  dark?: boolean;
  accentColor?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", empresa: "", mensagem: "" });

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setErro("");
    if (form.nome.trim().length < 2) {
      setErro("Informe seu nome.");
      return;
    }
    if (!form.email.includes("@") && form.telefone.trim().length < 8) {
      setErro("Informe e-mail ou telefone pra gente te responder.");
      return;
    }
    if (form.mensagem.trim().length < 5) {
      setErro("Conte rapidamente o que sua empresa precisa.");
      return;
    }
    setEnviando(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, servicoSlug }),
      });
      if (!response.ok) throw new Error();
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  const corTexto = dark ? "#F7F1E6" : "#22312F";
  const corSub = dark ? "rgba(247,241,230,0.72)" : "#5A6B69";
  const corBorda = dark ? "rgba(255,255,255,0.2)" : "rgba(34,49,47,0.18)";
  const corFundoInput = dark ? "rgba(255,255,255,0.06)" : "#FFFFFF";
  const corBotao = accentColor || (dark ? "#FF6A45" : "#0C5446");

  if (enviado) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderRadius: 12, border: `1px solid ${corBorda}`, color: corTexto }}>
        <CheckCircle2 size={18} color="#34D399" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Recebemos seu pedido! Vamos entrar em contato em breve.</span>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "13px 20px",
          borderRadius: 12,
          border: "none",
          background: corBotao,
          color: "#FFFFFF",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        <span>{ctaLabel}</span>
        <ArrowRight size={18} />
      </button>
    );
  }

  return (
    <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 2px", fontSize: 12, color: corSub }}>
        Conte rapidamente o seu caso — sem custo, sem compromisso. A gente responde por e-mail ou WhatsApp.
      </p>
      <input
        placeholder="Seu nome"
        value={form.nome}
        onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${corBorda}`, background: corFundoInput, color: corTexto, fontSize: 13 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="E-mail"
          type="email"
          value={form.email}
          onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: `1px solid ${corBorda}`, background: corFundoInput, color: corTexto, fontSize: 13 }}
        />
        <input
          placeholder="Telefone/WhatsApp"
          value={form.telefone}
          onChange={(e) => setForm((v) => ({ ...v, telefone: e.target.value }))}
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: `1px solid ${corBorda}`, background: corFundoInput, color: corTexto, fontSize: 13 }}
        />
      </div>
      <input
        placeholder="Empresa (opcional)"
        value={form.empresa}
        onChange={(e) => setForm((v) => ({ ...v, empresa: e.target.value }))}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${corBorda}`, background: corFundoInput, color: corTexto, fontSize: 13 }}
      />
      <textarea
        placeholder="O que sua empresa precisa?"
        rows={3}
        value={form.mensagem}
        onChange={(e) => setForm((v) => ({ ...v, mensagem: e.target.value }))}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${corBorda}`, background: corFundoInput, color: corTexto, fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
      />
      {erro && <small style={{ color: "#EF4444", fontWeight: 600 }}>{erro}</small>}
      <button
        type="submit"
        disabled={enviando}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "12px 20px",
          borderRadius: 12,
          border: "none",
          background: corBotao,
          color: "#FFFFFF",
          fontWeight: 700,
          fontSize: 14,
          cursor: enviando ? "default" : "pointer",
          opacity: enviando ? 0.7 : 1,
        }}
      >
        <span>{enviando ? "Enviando…" : "Enviar pedido"}</span>
        {!enviando && <ArrowRight size={18} />}
      </button>
    </form>
  );
}
