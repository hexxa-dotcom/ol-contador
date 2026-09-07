"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  User, 
  Building2, 
  Zap,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import styles from "./precos.module.css";
import { LeadForm } from "@/components/lead-form";

interface PricingGridProps {
  pfCents: number;
  pjCents: number;
  consultaCents: number;
}

type PlanoId = "pf" | "pj" | "sob-demanda";

// Só os 3 exemplos mais essenciais aparecem de cara — o resto fica atrás do
// "mostrar mais", pra não deixar o card comprido com todos os serviços
// atendidos de uma vez.
const CHIPS_PF = [
  "Regularizar CPF pendente/suspenso",
  "Malha fina & cartas da Receita",
  "Declarar / retificar IRPF",
  "Carnê-leão autônomo & exterior",
  "Parcelamento PF & CND",
  "Emissão de DECORE",
  "Ganho de Capital (GCAP / Imóveis)",
  "+ Pendências fiscais de PF",
];
const CHIPS_PJ = [
  "Parcelamento de guias DAS / dívida ativa do MEI",
  "Guias DAS atrasadas & recálculo",
  "Declaração DASN-SIMEI",
  "Desenquadramento MEI para ME",
  "Certidão Negativa (CND) do MEI",
  "+ Pendências de MEI & Simples",
];
const CHIPS_SOB_DEMANDA = [
  "Abertura de Empresa / CNPJ",
  "Baixa & encerramento de CNPJ",
  "Reativação de CNPJ Inapto",
  "Parcelamento de dívidas fiscais",
  "CND para empresas",
  "Registro de Associações & Terceiro Setor",
  "Apoio a Advogados, Contadores e Empresas",
  "Processos & dossiês na Receita (e-CAC)",
  "Alteração contratual & sócios",
  "Múltiplos anos acumulados",
  "+ Outras demandas de empresas",
];
const CHIPS_VISIVEIS_PADRAO = 3;

export function PricingGrid({ pfCents, pjCents, consultaCents }: PricingGridProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanoId>("pj");
  const [expandedCards, setExpandedCards] = useState<{ pf: boolean; pj: boolean; "sob-demanda": boolean }>({
    pf: false,
    pj: false,
    "sob-demanda": false,
  });
  const [expandedChips, setExpandedChips] = useState<{ pf: boolean; pj: boolean; "sob-demanda": boolean }>({
    pf: false,
    pj: false,
    "sob-demanda": false,
  });

  const toggleExpand = (plan: PlanoId, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [plan]: !prev[plan] }));
  };

  const toggleChips = (plan: PlanoId, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChips((prev) => ({ ...prev, [plan]: !prev[plan] }));
  };

  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cents / 100);

  function renderChips(plan: PlanoId, chips: string[], chipClass: string, destaqueClass: string, btnClass: string) {
    const expandido = expandedChips[plan];
    const visiveis = expandido ? chips : chips.slice(0, CHIPS_VISIVEIS_PADRAO);
    const restantes = chips.length - CHIPS_VISIVEIS_PADRAO;
    return (
      <>
        <div className={styles.chipsWrap}>
          {visiveis.map((chip) => (
            <span key={chip} className={`${chipClass} ${chip.startsWith("+") ? destaqueClass : ""}`}>
              {chip}
            </span>
          ))}
        </div>
        {restantes > 0 && (
          <button type="button" className={btnClass} onClick={(e) => toggleChips(plan, e)}>
            <span>{expandido ? "Ver menos exemplos" : `+ ver mais ${restantes}`}</span>
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </>
    );
  }

  return (
    <div className={styles.planosContainer}>
      
      {/* GRID DE PLANOS 3D */}
      <div className={styles.planosGrid} id="planos">
        
        {/* 1. PESSOA FÍSICA */}
        <div
          onClick={() => setSelectedPlan("pf")}
          className={`${styles.planoCard} ${styles.planoLight} ${selectedPlan === "pf" ? styles.planoSelecionado : ""}`}
        >
          {selectedPlan === "pf" ? (
            <div className={styles.badgeSelecionado}>
              <CheckCircle2 size={14} />
              <span>Plano Selecionado</span>
            </div>
          ) : (
            <div className={styles.badgeDestaqueFixo} style={{ background: "#EBF3EF", color: "#093726" }}>
              <span>Regularização de CPF</span>
            </div>
          )}

          <div className={styles.planoHeader}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#0C5446", marginBottom: 4, display: "block" }}>Para Você</span>
            <div className={styles.planoNomeFlex}>
              <span className={styles.planoTitulo}>Pessoa Física</span>
              <div className={styles.planoIconBadge}>
                <User size={22} />
              </div>
            </div>
            <p className={styles.planoSubtitulo}>
              Para quem precisa regularizar CPF suspenso ou pendente, resolver malha fina do IRPF ou negociar débitos individuais.
            </p>
          </div>

          <div className={styles.precoBox}>
            <div className={styles.precoFlex}>
              <span className={styles.moeda}>R$</span>
              <span className={styles.precoNum}>{money(pfCents)}</span>
            </div>
            <div className={styles.precoUnidade}>por atendimento Express</div>
            <div className={styles.precoPagamento}>no Pix ou em até 3x no cartão · agendar horário com o contador sai por um valor à parte</div>
          </div>

          <div className={styles.resolveSection}>
            <div className={styles.resolveRotulo}>Exemplos do que resolvemos:</div>
            {renderChips("pf", CHIPS_PF, styles.chipLight, styles.chipDestaque, styles.btnExpandir)}
          </div>

          {/* LISTA DE ENTREGÁVEIS (REDUZIDA / EXPANSÍVEL) */}
          <div className={styles.entregaveisList}>
            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Pré-atendimento guiado</b>
                <small>Você conta o caso antes, com suas palavras, e anexa o que tiver. O contador chega sabendo de tudo.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Atendimento individual no chat seguro</b>
                <small>Direto com o contador, do celular ou do computador — com envio de documentos e confirmação de leitura.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Relatório do atendimento em PDF</b>
                <small>O que aconteceu, o que foi feito e os próximos passos — assinado pelo contador responsável.</small>
              </div>
            </div>

            {/* ITENS EXPANDIDOS */}
            {expandedCards.pf && (
              <>
                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>Conclusão rápida em até 24h</b>
                    <small>Muitos casos de pessoa física se resolvem no mesmo dia.</small>
                  </div>
                </div>

                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>Transparência total na área do cliente</b>
                    <small>Linha do tempo do caso, documentos e lembretes de vencimentos registrados.</small>
                  </div>
                </div>

                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>Sigilo e segurança dos seus dados</b>
                    <small>Conversa e documentos protegidos, visíveis só para você e o contador responsável.</small>
                  </div>
                </div>

                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>Retorno grátis em até 7 dias</b>
                    <small>Ficou dúvida depois do atendimento? Volta sem pagar de novo.</small>
                  </div>
                </div>
              </>
            )}

            {/* BOTÃO EXPANDIR / RECOLHER */}
            <button
              type="button"
              className={styles.btnExpandir}
              onClick={(e) => toggleExpand("pf", e)}
            >
              <span>{expandedCards.pf ? "Ver menos detalhes" : "Ver todos os 7 entregáveis"}</span>
              {expandedCards.pf ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <Link
            href="/agendar?plano=pf"
            className={`${styles.btnCard} ${selectedPlan === "pf" ? styles.btnCardSelected : styles.btnCardSecondary}`}
          >
            <span>Quero Regularizar meu CPF</span>
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* 2. PESSOA JURÍDICA (CARD DARK EMBOSSED) */}
        <div
          onClick={() => setSelectedPlan("pj")}
          className={`${styles.planoCard} ${styles.planoDark} ${selectedPlan === "pj" ? styles.planoSelecionadoDark : ""}`}
        >
          {selectedPlan === "pj" ? (
            <div className={`${styles.badgeSelecionado} ${styles.badgeCoral}`}>
              <Sparkles size={14} />
              <span>MEI & Simples Nacional</span>
            </div>
          ) : (
            <div className={styles.badgeDestaqueFixo}>
              <span>MEI & Simples Nacional</span>
            </div>
          )}

          <div className={styles.planoHeader}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#FF9C7E", marginBottom: 4, display: "block" }}>Para Sua Empresa · Micro e Pequenas</span>
            <div className={styles.planoNomeFlex}>
              <span className={`${styles.planoTitulo} ${styles.textLight}`}>Empresas 1</span>
              <div className={`${styles.planoIconBadge} ${styles.iconDark}`}>
                <Building2 size={22} />
              </div>
            </div>
            <p className={`${styles.planoSubtitulo} ${styles.textMutedDark}`}>
              Para MEI e Microempresas do Simples Nacional que precisam parcelar dívidas, regularizar o CNPJ ou acertar guias atrasadas.
            </p>
          </div>

          <div className={styles.precoBox}>
            <div className={styles.precoFlex}>
              <span className={`${styles.moeda} ${styles.textCoral}`}>R$</span>
              <span className={`${styles.precoNum} ${styles.textCoral}`}>{money(pjCents)}</span>
            </div>
            <div className={`${styles.precoUnidade} ${styles.textLightMuted}`}>por atendimento Express</div>
            <div className={`${styles.precoPagamento} ${styles.textCoral}`}>no Pix ou em até 3x no cartão · agendar horário com o contador sai por um valor à parte</div>
          </div>

          <div className={styles.resolveSection}>
            <div className={`${styles.resolveRotulo} ${styles.textCoral}`}>Exemplos do que resolvemos:</div>
            {renderChips("pj", CHIPS_PJ, styles.chipDark, styles.chipDestaqueDark, `${styles.btnExpandir} ${styles.btnExpandirDark}`)}
          </div>

          {/* LISTA DE ENTREGÁVEIS (REDUZIDA / EXPANSÍVEL) */}
          <div className={styles.entregaveisList}>
            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconCoral} />
              <div className={styles.entregavelText}>
                <b className={styles.textLight}>Tudo do plano Pessoa Física</b>
                <small className={styles.textMutedDark}>Pré-atendimento guiado, chat seguro, relatório assinado e retorno grátis.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconCoral} />
              <div className={styles.entregavelText}>
                <b className={styles.textLight}>Contador especialista em empresas</b>
                <small className={styles.textMutedDark}>Profissional com foco em MEI, Simples Nacional e parcelamento de dívidas fiscais.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconCoral} />
              <div className={styles.entregavelText}>
                <b className={styles.textLight}>Conclusão em até 48 horas</b>
                <small className={styles.textMutedDark}>Da abertura do caso à análise completa e entrega do relatório técnico.</small>
              </div>
            </div>

            {/* ITENS EXPANDIDOS */}
            {expandedCards.pj && (
              <>
                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconCoral} />
                  <div className={styles.entregavelText}>
                    <b className={styles.textLight}>Emissão de guias e parcelamento inclusos</b>
                    <small className={styles.textMutedDark}>DAS e parcelamentos do Simples Nacional emitidos e disponibilizados na área do cliente.</small>
                  </div>
                </div>

                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconCoral} />
                  <div className={styles.entregavelText}>
                    <b className={styles.textLight}>Acompanhamento de obrigações</b>
                    <small className={styles.textMutedDark}>Lembretes de prazos e pendências para você não perder datas nem pagar multas.</small>
                  </div>
                </div>
              </>
            )}

            {/* BOTÃO EXPANDIR / RECOLHER (DARK) */}
            <button
              type="button"
              className={`${styles.btnExpandir} ${styles.btnExpandirDark}`}
              onClick={(e) => toggleExpand("pj", e)}
            >
              <span>{expandedCards.pj ? "Ver menos detalhes" : "Ver todos os 5 entregáveis"}</span>
              {expandedCards.pj ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <Link
            href="/agendar?plano=pj"
            className={`${styles.btnCard} ${styles.btnCardCoral}`}
          >
            <span>Quero Regularizar meu CNPJ</span>
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* 3. SERVIÇOS SOB MEDIDA */}
        <div
          onClick={() => setSelectedPlan("sob-demanda")}
          className={`${styles.planoCard} ${styles.planoWarm} ${selectedPlan === "sob-demanda" ? styles.planoSelecionadoWarm : ""}`}
        >
          {selectedPlan === "sob-demanda" ? (
            <div className={styles.badgeSelecionado} style={{ background: "#C23F1F" }}>
              <CheckCircle2 size={14} />
              <span>Plano Selecionado</span>
            </div>
          ) : (
            <div className={styles.badgeDestaqueFixo} style={{ background: "rgba(194, 63, 31, 0.14)", color: "#9A3412" }}>
              <span>Empresas 2</span>
            </div>
          )}

          <div className={styles.planoHeader}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#C23F1F", marginBottom: 4, display: "block" }}>Para Sua Empresa · Todo Tipo de Empresa</span>
            <div className={styles.planoNomeFlex}>
              <span className={styles.planoTitulo}>Empresas 2</span>
              <div className={styles.planoIconBadge}>
                <Zap size={22} />
              </div>
            </div>
            <p className={styles.planoSubtitulo}>
              Para empresas de qualquer porte e regime tributário — não é para pendências do dia a dia (essas ficam nos planos Pessoa Física e Empresas 1 acima): abertura de empresa, baixa de CNPJ, registro de associações e apoio contábil para advogados, contadores e demais empresas.
            </p>
          </div>

          <div className={styles.precoBox}>
            <div className={styles.precoFlex}>
              <span className={styles.moeda}>R$</span>
              <span className={styles.precoNum}>{money(consultaCents)}</span>
            </div>
            <div className={styles.precoUnidade}>valor de referência, fechado por escrito</div>
            <div className={styles.precoPagamento}>não sabe qual serviço é o seu? fale com a gente — a triagem é gratuita</div>
          </div>

          <div className={styles.resolveSection}>
            <div className={styles.resolveRotulo}>Exemplos do que resolvemos:</div>
            {renderChips("sob-demanda", CHIPS_SOB_DEMANDA, styles.chipLight, styles.chipDestaque, styles.btnExpandir)}
          </div>

          {/* LISTA DE ENTREGÁVEIS (REDUZIDA / EXPANSÍVEL) */}
          <div className={styles.entregaveisList}>
            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Preço fechado de R$ {money(consultaCents)}</b>
                <small>Valor de referência já fechado — sem diagnóstico prévio pago à parte, sem sustos no final.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Não sabe qual serviço é o seu?</b>
                <small>Fale com a gente antes de contratar — a triagem do seu caso é gratuita e sem compromisso.</small>
              </div>
            </div>

            {/* ITENS EXPANDIDOS */}
            {expandedCards["sob-demanda"] && (
              <>
                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>A mesma estrutura completa</b>
                    <small>Chat seguro com o contador, linha do tempo na área do cliente e relatório final com parecer técnico.</small>
                  </div>
                </div>

                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>Escopo fechado por escrito</b>
                    <small>Antes de começar o trabalho, você recebe o escopo e o prazo por escrito — zero surpresas.</small>
                  </div>
                </div>
              </>
            )}

            {/* BOTÃO EXPANDIR / RECOLHER */}
            <button
              type="button"
              className={styles.btnExpandir}
              onClick={(e) => toggleExpand("sob-demanda", e)}
            >
              <span>{expandedCards["sob-demanda"] ? "Ver menos detalhes" : "Ver todos os 4 entregáveis"}</span>
              {expandedCards["sob-demanda"] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <Link
            href="/agendar?plano=sob-demanda"
            className={`${styles.btnCard} ${selectedPlan === "sob-demanda" ? styles.btnCardSelected : styles.btnCardOutline}`}
          >
            <span>Contratar por R$ {money(consultaCents)}</span>
            <ArrowRight size={18} />
          </Link>
        </div>

      </div>

      <div
        style={{
          marginTop: 28,
          padding: "22px 24px",
          borderRadius: 20,
          border: "1px solid rgba(34, 49, 47, 0.12)",
          background: "#FFFFFF",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#22312F" }}>
          Não sabe qual serviço é o seu? Fale com a gente — a triagem é gratuita.
        </p>
        <LeadForm ctaLabel="Não sei qual serviço é o meu — falar com a gente" accentColor="#000000" />
      </div>
    </div>
  );
}
