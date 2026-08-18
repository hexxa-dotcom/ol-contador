"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/primitives";
import { SiteHeader, SiteFooter, useFunilSessao, registrarEventoFunil } from "@/components/site-shell";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { validarCpfCnpj } from "@/lib/documento";

const CHAVE = "oc_agendamento";
const CHAVE_CREDITO = "oc_credito_codigo";
const CHAVE_RASCUNHO = "oc_checkout_rascunho";
const DESCONTO_PIX = 0.05;

type Pedido = { servicoId: string; servicoNome: string; precoCents: number; assuntoId: string | null; assuntoTitulo: string; modalidade: "sem_agendamento" | "agendado"; dia: string | null; hora: string | null };

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function labelDia(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function mascaraDocumento(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}
function mascaraCep(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

const ERROS: Record<string, string> = {
  cpf_cnpj_invalido: "CPF/CNPJ inválido — confira os números digitados.",
  invalid_params: "Preencha nome, e-mail, WhatsApp e CPF/CNPJ para continuar.",
  asaas_not_configured: "Os pagamentos estão indisponíveis por instantes. Tente de novo em alguns minutos.",
  servico_not_found: "Esse atendimento ficou indisponível. Volte e escolha outro.",
  credito_not_found: "Código de crédito não encontrado.",
  credito_indisponivel: "Este crédito já foi usado ou cancelado.",
  credito_insuficiente: "O valor do crédito não cobre esse atendimento.",
  muitas_tentativas: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
};

export function CheckoutClient() {
  const router = useRouter();
  const sessaoRef = useFunilSessao();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [alerta, setAlerta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [metodo, setMetodo] = useState<"pix" | "cartao">("pix");
  const [aceite, setAceite] = useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState("");

  const [creditoAberto, setCreditoAberto] = useState(false);
  const [creditoCodigo, setCreditoCodigo] = useState("");
  const [creditoAplicado, setCreditoAplicado] = useState<{ codigo: string; valorCents: number } | null>(null);
  const [creditoFeedback, setCreditoFeedback] = useState("");

  const [pagamento, setPagamento] = useState<{ cobrancaId: number; pollToken: string; pixImage?: string; pixPayload?: string; invoiceUrl?: string; metodoPagamento: string; valor: number } | null>(null);
  const [pronto, setPronto] = useState<{ pago: boolean; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const buscaCepSeq = useRef(0);
  const buscaCnpjSeq = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let salvo: Pedido | null = null;
    try {
      salvo = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
    } catch {
      salvo = null;
    }
    if (!salvo || !salvo.servicoId || (salvo.modalidade !== "sem_agendamento" && (!salvo.dia || !salvo.hora))) {
      router.replace("/agendar");
      return;
    }
    setPedido(salvo);
    void registrarEventoFunil(sessaoRef, "checkout_iniciado", { origem: "checkout", servicoId: salvo.servicoId });

    try {
      const rascunho = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || "null");
      if (rascunho?.salvoEm && Date.now() - rascunho.salvoEm < 2 * 60 * 60 * 1000 && rascunho.dados) {
        const d = rascunho.dados;
        setNome(d.nome || "");
        setCpf(d.cpf || "");
        setEmail(d.email || "");
        setTelefone(d.telefone || "");
        setCep(d.cep || "");
        setEndereco(d.endereco || "");
        setNumero(d.numero || "");
        setBairro(d.bairro || "");
        setCidade(d.cidade || "");
        setUf(d.uf || "");
      } else {
        localStorage.removeItem(CHAVE_RASCUNHO);
      }
    } catch {
      /* ignore */
    }
    const cod = sessionStorage.getItem(CHAVE_CREDITO);
    if (cod) {
      setCreditoAberto(true);
      setCreditoCodigo(cod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function salvarRascunho(campos: Record<string, string>) {
    try {
      const atual = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || "null")?.dados || {};
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ salvoEm: Date.now(), dados: { ...atual, ...campos } }));
    } catch {
      /* ignore */
    }
  }

  async function buscarEnderecoPorCep(valor: string) {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length !== 8) {
      setCepStatus("");
      return;
    }
    const minhaVez = ++buscaCepSeq.current;
    setCepStatus("Buscando endereço…");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const data = await res.json();
      if (minhaVez !== buscaCepSeq.current) return;
      if (!res.ok || data.erro) {
        setCepStatus("CEP não encontrado — preencha manualmente.");
        return;
      }
      if (data.logradouro) setEndereco(data.logradouro);
      if (data.bairro) setBairro(data.bairro);
      if (data.localidade) setCidade(data.localidade);
      if (data.uf) setUf(data.uf);
      setCepStatus("");
    } catch {
      if (minhaVez === buscaCepSeq.current) setCepStatus("Não consegui buscar o CEP agora — preencha manualmente.");
    }
  }

  async function buscarDadosPorCnpj(valor: string) {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length !== 14) {
      setCnpjStatus("");
      return;
    }
    const minhaVez = ++buscaCnpjSeq.current;
    setCnpjStatus("Buscando dados do CNPJ…");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (minhaVez !== buscaCnpjSeq.current) return;
      if (!res.ok) {
        setCnpjStatus("CNPJ não encontrado — preencha manualmente.");
        return;
      }
      const data = await res.json();
      if (minhaVez !== buscaCnpjSeq.current) return;
      setNome((atual) => atual.trim() || data.razao_social || data.nome_fantasia || "");
      setEmail((atual) => atual.trim() || data.email || "");
      if (data.ddd_telefone_1) setTelefone((atual) => atual.trim() || mascaraTelefone(data.ddd_telefone_1));
      if (data.cep) setCep(mascaraCep(String(data.cep)));
      if (data.logradouro) {
        const tipo = data.descricao_tipo_de_logradouro ? `${data.descricao_tipo_de_logradouro} ` : "";
        setEndereco((tipo + data.logradouro).trim());
      }
      if (data.numero) setNumero(data.numero);
      if (data.bairro) setBairro(data.bairro);
      if (data.municipio) setCidade(data.municipio);
      if (data.uf) setUf(data.uf);
      setCnpjStatus(!data.logradouro || !data.numero ? "Encontrei parte do endereço — complete o que faltar." : "");
    } catch {
      if (minhaVez === buscaCnpjSeq.current) setCnpjStatus("Não consegui buscar o CNPJ agora — preencha manualmente.");
    }
  }

  function validarIdentidade(): boolean {
    if (nome.trim().length < 3 || !nome.includes(" ")) return false;
    if (!validarCpfCnpj(cpf).valido) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return false;
    if (telefone.replace(/\D/g, "").length < 10) return false;
    return true;
  }

  function validarTudo(): boolean {
    if (!validarIdentidade()) return false;
    if (cep.replace(/\D/g, "").length !== 8) return false;
    if (!endereco.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || uf.trim().length !== 2) return false;
    return true;
  }

  async function aplicarCredito() {
    const codigo = creditoCodigo.trim().toUpperCase();
    if (!codigo || !pedido) return;
    setCreditoFeedback("Verificando…");
    try {
      const res = await fetch(`/api/checkout/credit?codigo=${encodeURIComponent(codigo)}`);
      const data = await res.json();
      if (!res.ok || !data.valido) {
        setCreditoAplicado(null);
        setCreditoFeedback(data.error === "credito_indisponivel" ? "Este crédito já foi usado ou cancelado." : "Código inválido — confira e tente de novo.");
        return;
      }
      if (data.valorCents < pedido.precoCents) {
        setCreditoAplicado(null);
        setCreditoFeedback(`Este crédito é de ${money(data.valorCents)} e não cobre este atendimento (${money(pedido.precoCents)}).`);
        return;
      }
      setCreditoAplicado({ codigo, valorCents: data.valorCents });
      setCreditoFeedback(`Crédito de ${money(data.valorCents)} aplicado.`);
    } catch {
      setCreditoAplicado(null);
      setCreditoFeedback("Falha de conexão ao verificar o código.");
    }
  }

  // Tenta logar a pessoa direto, sem esperar ela abrir o e-mail: o servidor já
  // gerou um token válido assim que confirmou o pagamento. Se outra pessoa já
  // estiver logada neste navegador (computador compartilhado), não sobrescreve
  // a sessão dela — cai no link por e-mail.
  async function finalizarComLoginAutomatico(emailDoPedido: string, autoLogin: { tokenHash: string } | null, pago: boolean) {
    if (autoLogin?.tokenHash) {
      try {
        const supabase = createBrowserClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          const outraPessoaLogada = data.session?.user?.email && data.session.user.email !== emailDoPedido;
          if (!outraPessoaLogada) {
            const { error } = await supabase.auth.verifyOtp({ token_hash: autoLogin.tokenHash, type: "magiclink" });
            if (!error) {
              router.push("/portal");
              return;
            }
          }
        }
      } catch {
        /* cai no fallback abaixo */
      }
    }
    setPronto({ pago, email: emailDoPedido });
  }

  function iniciarPolling(cobrancaId: number, pollToken: string, emailDoPedido: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?cobrancaId=${cobrancaId}&pollToken=${encodeURIComponent(pollToken)}`);
        if (!res.ok) return;
        const st = await res.json();
        if (st.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPagamento(null);
          void finalizarComLoginAutomatico(emailDoPedido, st.autoLogin, true);
        }
      } catch {
        /* segue tentando */
      }
    }, 4000);
  }

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function enviar() {
    setAlerta("");
    if (!validarTudo()) {
      setAlerta("Confira os campos destacados antes de continuar.");
      return;
    }
    if (!aceite) {
      setAlerta("Para continuar, é preciso aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }
    if (!pedido) return;

    setEnviando(true);
    const payloadBase = {
      name: nome.trim(),
      cpfCnpj: cpf.trim(),
      email: email.trim(),
      phone: telefone.trim(),
      cep: cep.trim() || null,
      endereco: endereco.trim() || null,
      numero: numero.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      estado: uf.trim().toUpperCase() || null,
      servicoId: pedido.servicoId,
      assunto: pedido.assuntoId || null,
      summary: pedido.assuntoTitulo || null,
      date: pedido.dia,
      time: pedido.hora,
      modalidade: pedido.modalidade,
    };

    try {
      if (creditoAplicado) {
        const res = await fetch("/api/checkout/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, codigo: creditoAplicado.codigo }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAlerta(ERROS[data.error] || "Não consegui concluir agora. Tente novamente.");
          setEnviando(false);
          return;
        }
        localStorage.removeItem(CHAVE_RASCUNHO);
        sessionStorage.removeItem(CHAVE);
        sessionStorage.removeItem(CHAVE_CREDITO);
        void finalizarComLoginAutomatico(payloadBase.email, data.autoLogin, false);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, metodoPagamento: metodo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlerta(ERROS[data.error] || "Não consegui concluir agora. Tente novamente.");
        setEnviando(false);
        return;
      }
      localStorage.removeItem(CHAVE_RASCUNHO);
      sessionStorage.removeItem(CHAVE);
      sessionStorage.removeItem(CHAVE_CREDITO);
      setPagamento({ cobrancaId: data.cobrancaId, pollToken: data.pollToken, pixImage: data.pixImage, pixPayload: data.pixPayload, invoiceUrl: data.invoiceUrl, metodoPagamento: data.metodoPagamento, valor: data.valor });
      if (data.metodoPagamento === "cartao" && data.invoiceUrl) window.open(data.invoiceUrl, "_blank");
      iniciarPolling(data.cobrancaId, data.pollToken, payloadBase.email);
    } catch {
      setAlerta("Falha de conexão. Confira sua internet e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (!pedido) return null;

  const coberto = !!(creditoAplicado && creditoAplicado.valorCents >= pedido.precoCents);

  if (pronto) {
    return (
      <>
        <SiteHeader />
        <main className="public-shell">
          <div className="public-bloco public-pronto">
            <div className="public-ok-selo">✓</div>
            <h2>{pronto.pago ? "Pagamento confirmado!" : "Atendimento confirmado!"}</h2>
            <p>
              {pedido.modalidade === "sem_agendamento" ? (
                <>Seu Atendimento Express foi recebido. Entre na sua área agora para concluir a triagem e enviar os documentos.</>
              ) : (
                <>
                  Seu atendimento está marcado para <b>{labelDia(pedido.dia!)} às {pedido.hora}</b>. Mandamos um e-mail para <b>{pronto.email}</b> com o link de acesso.
                </>
              )}
            </p>
            <Button onClick={() => router.push("/login")}>Já recebi o e-mail, entrar</Button>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (pagamento) {
    return (
      <>
        <SiteHeader />
        <main className="public-shell">
          <div className="public-bloco public-pagamento">
            <h2>{pagamento.metodoPagamento === "cartao" ? "Pague com cartão para confirmar" : "Pague com Pix para confirmar"}</h2>
            <p className="public-ajuda">
              {money(Math.round(pagamento.valor * 100))} — {pedido.servicoNome}, {pedido.modalidade === "sem_agendamento" ? "Atendimento Express" : `${labelDia(pedido.dia!)} às ${pedido.hora}`}.
            </p>
            {pagamento.metodoPagamento === "cartao" ? (
              <>
                <a className="public-btn-full" href={pagamento.invoiceUrl} target="_blank" rel="noopener noreferrer">
                  Abrir pagamento seguro
                </a>
                <p className="public-ajuda">Abrimos a página segura do Asaas em outra aba pra você inserir os dados do cartão. Depois de pagar, volte pra esta aba.</p>
              </>
            ) : (
              <>
                {pagamento.pixImage && <img className="public-qr" src={`data:image/png;base64,${pagamento.pixImage}`} alt="QR code do Pix" />}
                <p className="public-ajuda">Ou copie o código e cole no app do seu banco:</p>
                <div className="public-pix-copia">
                  <Input readOnly value={pagamento.pixPayload || ""} aria-label="Código Pix copia e cola" />
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pagamento.pixPayload || "");
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copiado ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </>
            )}
            <p className="public-status-pag">Aguardando a confirmação do pagamento…</p>
            <p className="public-note">Pode deixar esta tela aberta — ela confirma sozinha assim que o pagamento cair.</p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <ol className="public-trilha" aria-label="Etapas da contratação">
          <li className="feita">
            <span>✓</span>Atendimento
          </li>
          <li className="tracinho" aria-hidden="true" />
          <li className="atual">
            <span>2</span>Seus dados e pagamento
          </li>
        </ol>
        <div className="public-etapa-topo">
          <h1>Falta só confirmar quem é você.</h1>
          <p>{pedido.modalidade === "sem_agendamento" ? "Com esses dados criamos seu acesso. Depois do pagamento você segue direto para a triagem e o envio dos documentos." : "Com esses dados criamos seu acesso e o contador já sabe com quem vai falar."}</p>
        </div>

        <div className="public-resumo">
          <div className="public-resumo-topo">
            <span>Seu atendimento</span>
            <a href={`/agendar?servico=${encodeURIComponent(pedido.servicoId)}`}>alterar</a>
          </div>
          <strong>{pedido.servicoNome}</strong>
          <div className="public-resumo-linha">
            <span>{pedido.modalidade === "sem_agendamento" ? "Atendimento Express" : `${labelDia(pedido.dia!)} às ${pedido.hora}`}</span>
            <span className={`public-resumo-preco ${coberto ? "coberto" : ""}`}>{coberto ? "Coberto pelo crédito" : money(pedido.precoCents)}</span>
          </div>
        </div>

        {alerta && <p className="public-alerta on">{alerta}</p>}

        {etapa === 1 ? (
          <section className="public-bloco">
            <span className="public-eyebrow">Leva menos de um minuto</span>
            <h2>Primeiro, quem é você?</h2>
            <p className="public-ajuda">Usamos o e-mail para criar seu acesso.</p>
            <div className="public-field">
              <label>Nome completo</label>
              <Input value={nome} onChange={(e) => { setNome(e.target.value); salvarRascunho({ nome: e.target.value }); }} placeholder="Ex.: Ana Silva" />
            </div>
            <div className="public-field">
              <label>CPF ou CNPJ</label>
              <Input
                value={cpf}
                onChange={(e) => {
                  const v = mascaraDocumento(e.target.value);
                  setCpf(v);
                  salvarRascunho({ cpf: v });
                  void buscarDadosPorCnpj(v);
                }}
                placeholder="000.000.000-00"
              />
              {cnpjStatus && <span className="public-busca-status">{cnpjStatus}</span>}
            </div>
            <div className="public-field">
              <label>E-mail</label>
              <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); salvarRascunho({ email: e.target.value }); }} placeholder="voce@email.com" />
            </div>
            <div className="public-field">
              <label>WhatsApp</label>
              <Input
                value={telefone}
                onChange={(e) => {
                  const v = mascaraTelefone(e.target.value);
                  setTelefone(v);
                  salvarRascunho({ telefone: v });
                }}
                placeholder="(51) 99999-9999"
              />
            </div>
            <Button
              className="public-btn-full"
              onClick={() => {
                if (!validarIdentidade()) {
                  setAlerta("Confira nome, CPF/CNPJ, e-mail e WhatsApp.");
                  return;
                }
                setAlerta("");
                setEtapa(2);
              }}
            >
              Continuar
            </Button>
            <p className="public-note">🔒 Conexão segura. Não pedimos senha do banco nem do gov.br nesta etapa.</p>
          </section>
        ) : (
          <>
            <section className="public-bloco">
              <button type="button" className="public-voltar-etapa" onClick={() => setEtapa(1)}>
                ← Voltar aos dados pessoais
              </button>
              <span className="public-eyebrow">Dados para sua nota fiscal</span>
              <h2>Agora, seu endereço</h2>
              <p className="public-ajuda">Digite o CEP e buscamos quase tudo automaticamente.</p>
              <div className="public-dupla">
                <div className="public-field" style={{ flex: 1 }}>
                  <label>CEP</label>
                  <Input
                    value={cep}
                    onChange={(e) => {
                      const v = mascaraCep(e.target.value);
                      setCep(v);
                      salvarRascunho({ cep: v });
                      void buscarEnderecoPorCep(v);
                    }}
                    placeholder="00000-000"
                  />
                  {cepStatus && <span className="public-busca-status">{cepStatus}</span>}
                </div>
                <div className="public-field" style={{ flex: 2 }}>
                  <label>Bairro</label>
                  <Input value={bairro} onChange={(e) => { setBairro(e.target.value); salvarRascunho({ bairro: e.target.value }); }} placeholder="Ex.: Centro" />
                </div>
              </div>
              <div className="public-dupla">
                <div className="public-field" style={{ flex: 3 }}>
                  <label>Endereço</label>
                  <Input value={endereco} onChange={(e) => { setEndereco(e.target.value); salvarRascunho({ endereco: e.target.value }); }} placeholder="Ex.: Rua das Flores" />
                </div>
                <div className="public-field" style={{ flex: 1 }}>
                  <label>Número</label>
                  <Input value={numero} onChange={(e) => { setNumero(e.target.value); salvarRascunho({ numero: e.target.value }); }} placeholder="123" />
                </div>
              </div>
              <div className="public-dupla">
                <div className="public-field" style={{ flex: 2 }}>
                  <label>Cidade</label>
                  <Input value={cidade} onChange={(e) => { setCidade(e.target.value); salvarRascunho({ cidade: e.target.value }); }} placeholder="Ex.: Porto Alegre" />
                </div>
                <div className="public-field" style={{ flex: 1 }}>
                  <label>UF</label>
                  <Input value={uf} maxLength={2} onChange={(e) => { setUf(e.target.value.toUpperCase()); salvarRascunho({ uf: e.target.value.toUpperCase() }); }} placeholder="RS" style={{ textTransform: "uppercase" }} />
                </div>
              </div>
            </section>

            {!coberto && (
              <section className="public-bloco">
                <h2>Pagamento</h2>
                <p className="public-ajuda">Escolha como prefere pagar. A confirmação é automática nos dois casos.</p>
                <div className="public-metodo-pagamento">
                  <label className={`public-metodo-opcao ${metodo === "pix" ? "selecionado" : ""}`}>
                    <input type="radio" name="metodo" checked={metodo === "pix"} onChange={() => setMetodo("pix")} />
                    <span>
                      <strong>Pix</strong>
                      <small>{money(Math.round(pedido.precoCents * (1 - DESCONTO_PIX)))}</small>
                    </span>
                  </label>
                  <label className={`public-metodo-opcao ${metodo === "cartao" ? "selecionado" : ""}`}>
                    <input type="radio" name="metodo" checked={metodo === "cartao"} onChange={() => setMetodo("cartao")} />
                    <span>
                      <strong>Cartão de crédito</strong>
                      <small>{money(pedido.precoCents)} — à vista ou em até 3x</small>
                    </span>
                  </label>
                </div>

                {!creditoAberto ? (
                  <button type="button" className="public-link-credito" onClick={() => setCreditoAberto(true)}>
                    Tenho um código de crédito de atendimento
                  </button>
                ) : (
                  <div className="public-field">
                    <label>Código do crédito</label>
                    <div className="public-pix-copia">
                      <Input value={creditoCodigo} onChange={(e) => setCreditoCodigo(e.target.value.toUpperCase())} placeholder="OC-XXXXXXXX" style={{ textTransform: "uppercase" }} />
                      <Button onClick={aplicarCredito}>Aplicar</Button>
                    </div>
                    {creditoFeedback && <span className="public-busca-status">{creditoFeedback}</span>}
                  </div>
                )}
              </section>
            )}

            <label className="public-aceite-legal">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                Li e concordo com os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e com a{" "}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                  Política de Privacidade
                </a>
                .
              </span>
            </label>

            <Button className="public-btn-full" disabled={enviando} onClick={enviar}>
              {enviando ? "Enviando…" : coberto ? "Confirmar atendimento" : "Ir para o pagamento"}
            </Button>
            <p className="public-note">O horário escolhido só fica reservado depois que o pagamento é confirmado.</p>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
