"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { SiteHeader, SiteFooter, useFunilSessao, registrarEventoFunil } from "@/components/site-shell";

type ServicoOpcao = { id: string; name: string; description: string | null; price_cents: number; itens: { id: string; titulo: string; resumo: string }[] };
type Opcoes = { servicos: ServicoOpcao[]; horarios: string[]; ocupados: Record<string, string[]>; diasBloqueados: string[] };

const APELIDOS: Record<string, string[]> = {
  pf: ["pf", "malha-fina"],
  "pessoa-fisica": ["pf", "malha-fina"],
  pessoa_fisica: ["pf", "malha-fina"],
  "malha-fina": ["pf", "malha-fina"],
  "ganho-de-capital": ["pf", "gcap"],
  gcap: ["pf", "gcap"],
  pj: ["pj-atendimento"],
  "pessoa-juridica": ["pj-atendimento"],
  pessoa_juridica: ["pj-atendimento"],
  empresa: ["pj-atendimento"],
  sob: ["consulta"],
  "sob-demanda": ["consulta"],
  sob_demanda: ["consulta"],
};

const CHAVE = "oc_agendamento";
const CHAVE_CREDITO = "oc_credito_codigo";

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function diasUteis(qtd: number, diasBloqueados: string[]): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  let tentativas = 0;
  while (out.length < qtd && tentativas < 60) {
    const isoDia = iso(d);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !diasBloqueados.includes(isoDia)) out.push(isoDia);
    d.setDate(d.getDate() + 1);
    tentativas++;
  }
  return out;
}

function labelDia(isoDate: string): { semana: string; data: string } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const texto = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(/\./g, "");
  const [semana, data] = texto.split(", ");
  return { semana: semana || "", data: data || texto };
}

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function AgendarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoRef = useFunilSessao();

  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [erroCarregar, setErroCarregar] = useState("");
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [semPlano, setSemPlano] = useState<"nenhum" | "indisponivel" | null>(null);
  const [modalidade, setModalidade] = useState<"sem_agendamento" | "agendado">("sem_agendamento");
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [alerta, setAlerta] = useState("");

  useEffect(() => {
    void registrarEventoFunil(sessaoRef, "agendamento_iniciado", { origem: "agendamento" });
    const cod = searchParams.get("credito");
    if (cod) sessionStorage.setItem(CHAVE_CREDITO, cod.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/agendamento-opcoes")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Opcoes) => setOpcoes(data))
      .catch(() => setErroCarregar("Não consegui carregar as opções agora. Recarregue a página em instantes."));
  }, []);

  useEffect(() => {
    if (!opcoes) return;
    const bruto = (searchParams.get("plano") || searchParams.get("servico") || "").toLowerCase();
    let alvo: string | null = null;
    let motivo: "nenhum" | "indisponivel" | null = null;
    if (bruto) {
      const candidatos = APELIDOS[bruto] || [bruto];
      alvo = candidatos.find((id) => opcoes.servicos.some((s) => s.id === id)) || null;
      if (!alvo) motivo = "indisponivel";
    } else {
      try {
        const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
        if (salvo && opcoes.servicos.some((s) => s.id === salvo.servicoId)) alvo = salvo.servicoId;
        else motivo = "nenhum";
      } catch {
        motivo = "nenhum";
      }
    }
    if (!alvo) {
      setSemPlano(motivo || "nenhum");
      return;
    }
    setServicoId(alvo);
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
      if (salvo && salvo.servicoId === alvo) {
        setDia(salvo.dia || null);
        setHora(salvo.hora || null);
        setModalidade(salvo.modalidade === "agendado" ? "agendado" : "sem_agendamento");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoes]);

  const servico = useMemo(() => opcoes?.servicos.find((s) => s.id === servicoId) || null, [opcoes, servicoId]);
  const dias = useMemo(() => diasUteis(5, opcoes?.diasBloqueados || []), [opcoes]);
  const diaAtual = dia && dias.includes(dia) ? dia : dias[0] || null;
  const ocupadosNoDia = new Set((diaAtual && opcoes?.ocupados[diaAtual]) || []);
  const horarios = opcoes?.horarios || [];

  function continuar() {
    setAlerta("");
    if (!servico) return;
    if (modalidade === "agendado" && (!diaAtual || !hora)) {
      setAlerta("Escolha um dia e um horário para continuar.");
      return;
    }
    sessionStorage.setItem(
      CHAVE,
      JSON.stringify({
        servicoId: servico.id,
        servicoNome: servico.name,
        precoCents: servico.price_cents,
        assuntoId: null,
        assuntoTitulo: "",
        modalidade,
        dia: modalidade === "agendado" ? diaAtual : null,
        hora: modalidade === "agendado" ? hora : null,
      })
    );
    router.push("/checkout");
  }

  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <ol className="public-trilha" aria-label="Etapas da contratação">
          <li className="atual">
            <span>1</span>Atendimento
          </li>
          <li className="tracinho" aria-hidden="true" />
          <li>
            <span>2</span>Seus dados e pagamento
          </li>
        </ol>

        {erroCarregar ? (
          <p className="public-alerta on">{erroCarregar}</p>
        ) : semPlano ? (
          <section className="public-bloco">
            <h2>{semPlano === "indisponivel" ? "Esse plano ainda não pode ser contratado por aqui" : "Escolha um plano para continuar"}</h2>
            <p className="public-ajuda">{semPlano === "indisponivel" ? "Veja os outros planos disponíveis ou fale com a gente em ola@olacontador.com.br." : "Veja os planos e valores e escolha o que combina com o seu caso."}</p>
            <Button onClick={() => router.push("/precos#planos")}>Ver planos e preços</Button>
          </section>
        ) : !servico ? (
          <p className="public-ajuda">Carregando…</p>
        ) : (
          <>
            <div className="public-etapa-topo">
              <h1>{modalidade === "sem_agendamento" ? "Atendimento Express." : "Escolha o melhor horário."}</h1>
              <p>
                {modalidade === "sem_agendamento"
                  ? "Ideal para quem quer resolver com agilidade e praticidade. Você envia as informações depois do pagamento e acompanha tudo pela área do cliente."
                  : "Na próxima etapa você preenche seus dados e paga. O horário só fica reservado depois do pagamento confirmado."}
              </p>
            </div>

            {alerta && <p className="public-alerta on">{alerta}</p>}

            <div className="public-resumo">
              <div className="public-resumo-topo">
                <span>Plano escolhido</span>
                <a href="/precos#planos">alterar</a>
              </div>
              <div className="public-resumo-linha">
                <strong>{servico.name}</strong>
                <span className="public-resumo-preco">{money(servico.price_cents)}</span>
              </div>
            </div>

            <section className="public-bloco">
              <h2>Formato do atendimento</h2>
              <p className="public-ajuda">O valor do serviço é o mesmo. Muda apenas a forma de acompanhamento.</p>
              <div className="public-metodo-pagamento">
                <label className={`public-metodo-opcao ${modalidade === "sem_agendamento" ? "selecionado" : ""}`}>
                  <input type="radio" name="modalidade" checked={modalidade === "sem_agendamento"} onChange={() => setModalidade("sem_agendamento")} />
                  <span>
                    <strong>Atendimento Express</strong>
                    <small>Envie tudo e acompanhe, sem marcar conversa.</small>
                  </span>
                </label>
                <label className={`public-metodo-opcao ${modalidade === "agendado" ? "selecionado" : ""}`}>
                  <input type="radio" name="modalidade" checked={modalidade === "agendado"} onChange={() => setModalidade("agendado")} />
                  <span>
                    <strong>Atendimento com horário</strong>
                    <small>Escolha um dia e um horário para falar com o contador.</small>
                  </span>
                </label>
              </div>
              {modalidade === "sem_agendamento" && (
                <div className="public-vantagens">
                  <div className="public-vantagens-eyebrow">Atendimento Express</div>
                  <strong>Prefere deixar o caso com a gente?</strong>
                  <p>Depois do pagamento, responda a triagem e fotografe os documentos pelo celular. O caso entra na fila sem depender de uma reunião.</p>
                  <ul>
                    <li>Não precisa esperar uma vaga na agenda para a análise começar.</li>
                    <li>Envie tudo a qualquer hora, inclusive à noite ou no fim de semana.</li>
                    <li>Sem reunião, chamada ou conversa: acompanhe o andamento pelo portal.</li>
                    <li>Acompanhe pela área do cliente e receba o aviso do resultado por e-mail.</li>
                  </ul>
                </div>
              )}
            </section>

            {modalidade === "agendado" && (
              <section className="public-bloco">
                <h2>Quando fica bom pra você?</h2>
                <p className="public-ajuda">Horários de dias úteis. Os que já estão ocupados aparecem desabilitados.</p>
                <div className="public-field">
                  <label>Dia</label>
                  <div className="public-day-strip">
                    {dias.map((d) => {
                      const { semana, data } = labelDia(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          className={`public-day-btn ${d === diaAtual ? "active" : ""}`}
                          onClick={() => {
                            setDia(d);
                            setHora(null);
                          }}
                        >
                          <small>{semana}</small>
                          {data}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="public-field">
                  <label>Horário</label>
                  <div className="public-slot-grid">
                    {horarios.length === 0 ? (
                      <p className="public-slot-vazio">Nenhum horário configurado.</p>
                    ) : (
                      horarios.map((h) => {
                        const ocupado = ocupadosNoDia.has(h);
                        return (
                          <button key={h} type="button" className={`public-slot-btn ${h === hora ? "active" : ""}`} disabled={ocupado} onClick={() => setHora(h)}>
                            {h}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            )}

            <Button className="public-btn-full" onClick={continuar}>
              {modalidade === "sem_agendamento" ? "Continuar com Atendimento Express" : "Continuar para seus dados"}
            </Button>
            <p className="public-note">Nada é cobrado nesta etapa. Você revisa tudo antes de pagar.</p>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
