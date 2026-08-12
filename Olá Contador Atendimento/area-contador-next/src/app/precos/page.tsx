import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";
import { SiteHeader, SiteFooter } from "@/components/site-shell";

export const metadata = {
  title: "Planos e preços — Olá, Contador",
  description: "Preço fixo e duas formas de resolver: Atendimento Express, mais ágil e sem reunião, ou atendimento com horário. Relatório assinado com CRC.",
};
export const dynamic = "force-dynamic";

const FAQ = [
  { pergunta: "Preciso entender de imposto para ser atendido?", resposta: 'Não. Você conta o que aconteceu com as suas palavras — "recebi uma carta assustadora", "vendi meu carro", "não declarei ano passado" — e anexa o que tiver. Traduzir a burocracia é o nosso trabalho, não o seu.' },
  { pergunta: "O que é o relatório do atendimento?", resposta: "É um PDF assinado por contador com registro CRC dizendo o que aconteceu, o que foi feito e o que vem agora — como uma receita médica, só que do seu imposto. Fica guardado na sua área do cliente para baixar quando quiser." },
  { pergunta: "Como funciona o pagamento?", resposta: "Preço fixo, combinado antes, pago na contratação — no Pix ou no cartão, em até 3x. Você escolhe Atendimento Express ou atendimento com horário. Sem mensalidade e sem fidelidade: paga apenas pelo serviço que usar." },
  { pergunta: "O que está incluído no atendimento sob demanda?", resposta: "O valor exibido cobre a análise inicial, o diagnóstico e um plano de ação por escrito. Se o caso exigir execução adicional, você recebe escopo, prazo e preço antes de decidir contratar." },
  { pergunta: "E se vocês não conseguirem resolver meu caso?", resposta: "Você recebe 100% de volta. Se o contador avaliar o seu caso e concluir que não temos como ajudar, devolvemos o valor integral — não cobramos por um problema que não resolvemos." },
  { pergunta: "Em quanto tempo meu caso é resolvido?", resposta: "No Atendimento Express, o prazo padrão é de até 1 dia útil para pessoa física, 2 dias úteis para empresas e 5 dias úteis para casos mais complexos, contado da confirmação do pagamento." },
  { pergunta: "E se eu ficar com dúvida depois?", resposta: "O caso, as providências realizadas e a resolução ficam por escrito no relatório. Se precisar falar de novo com o contador sobre o mesmo caso, é só chamar no chat." },
];

async function precoDe(id: string, fallbackCents: number): Promise<number> {
  const admin = adminClient();
  if (!admin) return fallbackCents;
  const { data } = await admin.from("servicos").select("price_cents").eq("id", id).maybeSingle();
  return data?.price_cents ?? fallbackCents;
}

export default async function PrecosPage() {
  const [pf, pj, consulta] = await Promise.all([precoDe("pf", 19900), precoDe("pj-atendimento", 39900), precoDe("consulta", 19900)]);
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cents / 100);

  return (
    <>
      <SiteHeader active="precos" />
      <main className="public-shell public-precos">
        <div className="public-eyebrow-center">Planos e preços</div>
        <h1 className="public-hero-title">Problema com a Receita tem solução. E a solução tem preço fixo.</h1>
        <p className="public-hero-sub">Você sabe quanto custa antes de começar. Escolha o serviço agora e, na etapa seguinte, decida como prefere ser atendido. No fim, recebe tudo por escrito e assinado por contador com CRC.</p>

        <div className="public-passos">
          {[
            { n: 1, t: "Escolha o serviço", d: "Selecione Pessoa Física, Pessoa Jurídica ou um caso sob demanda." },
            { n: 2, t: "Escolha o atendimento", d: "Na próxima tela, escolha entre um horário para conversar ou Atendimento Express." },
            { n: 3, t: "Faça a triagem", d: "Depois da confirmação, explique o caso com suas palavras e envie os documentos pela área do cliente." },
            { n: 4, t: "Receba o relatório", d: "No fim, um PDF assinado com CRC registra o caso, as providências e a resolução." },
          ].map((p) => (
            <div className="public-passo" key={p.n}>
              <div className="public-passo-n">{p.n}</div>
              <b>{p.t}</b>
              <p>{p.d}</p>
            </div>
          ))}
        </div>

        <div className="public-planos" id="planos">
          <div className="public-plano">
            <div className="public-plano-nome">Pessoa Física</div>
            <div className="public-plano-desc">Para quem recebeu uma carta da Receita, travou no IR ou vendeu um bem e não sabe o que fazer agora.</div>
            <div className="public-plano-preco">
              R$ <span>{money(pf)}</span>
            </div>
            <div className="public-plano-por">por atendimento · no Pix ou em até 3x no cartão</div>
            <div className="public-resolve-rotulo">Resolve, por exemplo</div>
            <div className="public-chips">
              {["Malha fina e cartas da Receita", "Declarar ou corrigir o IR", "Vendi imóvel, carro ou outro bem", "Recebo como autônomo (carnê-leão)", "Outros assuntos"].map((c) => (
                <span className="public-chip" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <Link className="public-btn-full public-btn-secundario" href="/agendar?plano=pf">
              Escolher Pessoa Física
            </Link>
          </div>

          <div className="public-plano public-plano-destaque">
            <div className="public-plano-nome">Pessoa Jurídica</div>
            <div className="public-plano-desc">Para MEI, Simples Nacional ou Ltda — qualquer porte de empresa que precise de alguém cuidando das guias, dos prazos e das pendências.</div>
            <div className="public-plano-preco">
              R$ <span>{money(pj)}</span>
            </div>
            <div className="public-plano-por">por atendimento · no Pix ou em até 3x no cartão</div>
            <div className="public-resolve-rotulo">Resolve, por exemplo</div>
            <div className="public-chips">
              {["Guias e impostos atrasados", "Declaração anual (DASN/DEFIS)", "Parcelamento de débitos em geral", "Dúvidas do Simples Nacional", "Outros assuntos da empresa"].map((c) => (
                <span className="public-chip" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <Link className="public-btn-full" href="/agendar?plano=pj">
              Escolher Pessoa Jurídica
            </Link>
          </div>

          <div className="public-plano">
            <div className="public-plano-nome">Sob demanda</div>
            <div className="public-plano-desc">Para o caso grande que não cabe num atendimento: baixa de empresa, CNPJ inapto, anos de declaração atrasados.</div>
            <div className="public-plano-preco">
              <span className="public-plano-preco-eyebrow">análise inicial</span>
              R$ <span>{money(consulta)}</span>
            </div>
            <div className="public-plano-por">diagnóstico e plano de ação por escrito</div>
            <div className="public-resolve-rotulo">Resolve, por exemplo</div>
            <div className="public-chips">
              {["Baixa de empresa", "Regularização de CNPJ inapto", "Desenquadramento e mudança de regime", "Vários anos de IR atrasados", "Outros casos específicos"].map((c) => (
                <span className="public-chip" key={c}>
                  {c}
                </span>
              ))}
            </div>
            <Link className="public-btn-full public-btn-outline" href="/agendar?plano=sob-demanda">
              Contratar análise inicial
            </Link>
          </div>
        </div>

        <div className="public-garantia">
          <span>🛡️</span>
          <div>
            <b>Não resolveu, não paga.</b>
            <span>Se o contador avaliar seu caso e concluir que não temos como ajudar, você recebe 100% de volta. Sem discussão.</span>
          </div>
        </div>

        <div className="public-faq-section">
          <h2>Perguntas de quem chegou até aqui</h2>
          <div className="public-faq">
            {FAQ.map((item) => (
              <details key={item.pergunta}>
                <summary>{item.pergunta}</summary>
                <p>{item.resposta}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="public-cta-final">
          <h2>Quanto custa continuar adiando isso?</h2>
          <p>Multa e juros da Receita não esperam. Um atendimento com preço fixo resolve — e você sai com o caminho por escrito.</p>
          <a className="public-btn-full public-btn-cta" href="#planos">
            Escolher meu plano
          </a>
          <div className="public-cta-alt">
            ou <a href="mailto:ola@olacontador.com.br?subject=Pedido%20de%20or%C3%A7amento">peça um orçamento sob demanda</a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
