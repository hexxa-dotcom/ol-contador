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

interface PricingGridProps {
  pfCents: number;
  pjCents: number;
  consultaCents: number;
}

export function PricingGrid({ pfCents, pjCents, consultaCents }: PricingGridProps) {
  const [selectedPlan, setSelectedPlan] = useState<"pf" | "pj" | "sob-demanda">("pj");
  const [expandedCards, setExpandedCards] = useState<{ pf: boolean; pj: boolean; "sob-demanda": boolean }>({
    pf: false,
    pj: false,
    "sob-demanda": false,
  });

  const toggleExpand = (plan: "pf" | "pj" | "sob-demanda", e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [plan]: !prev[plan] }));
  };

  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(cents / 100);

  return (
    <div className={styles.planosContainer}>
      
      {/* GRID DE PLANOS 3D */}
      <div className={styles.planosGrid} id="planos">
        
        {/* 1. PESSOA FÍSICA */}
        <div
          onClick={() => setSelectedPlan("pf")}
          className={`${styles.planoCard} ${styles.planoLight} ${selectedPlan === "pf" ? styles.planoSelecionado : ""}`}
        >
          {selectedPlan === "pf" && (
            <div className={styles.badgeSelecionado}>
              <CheckCircle2 size={14} />
              <span>Plano Selecionado</span>
            </div>
          )}

          <div className={styles.planoHeader}>
            <div className={styles.planoNomeFlex}>
              <span className={styles.planoTitulo}>Pessoa Física</span>
              <div className={styles.planoIconBadge}>
                <User size={22} />
              </div>
            </div>
            <p className={styles.planoSubtitulo}>
              Para quem recebeu uma carta da Receita, travou no IR ou vendeu um bem e não sabe o que fazer agora.
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
            <div className={styles.resolveRotulo}>Resolve, por exemplo:</div>
            <div className={styles.chipsWrap}>
              <span className={styles.chipLight}>Malha fina e cartas</span>
              <span className={styles.chipLight}>Declarar / corrigir IR</span>
              <span className={styles.chipLight}>Venda de bens</span>
              <span className={styles.chipLight}>Carnê-leão autônomo</span>
            </div>
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
                <small>O que aconteceu, o que foi feito e os próximos passos — assinado por contador com registro CRC.</small>
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
            <span>Agendar Pessoa Física</span>
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
              <span>Mais Recomendado</span>
            </div>
          ) : (
            <div className={styles.badgeDestaqueFixo}>
              <span>Recomendado para Empresas</span>
            </div>
          )}

          <div className={styles.planoHeader}>
            <div className={styles.planoNomeFlex}>
              <span className={`${styles.planoTitulo} ${styles.textLight}`}>Pessoa Jurídica</span>
              <div className={`${styles.planoIconBadge} ${styles.iconDark}`}>
                <Building2 size={22} />
              </div>
            </div>
            <p className={`${styles.planoSubtitulo} ${styles.textMutedDark}`}>
              Para MEI e pequenas empresas que precisam de alguém cuidando das guias, dos prazos e das pendências.
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
            <div className={`${styles.resolveRotulo} ${styles.textCoral}`}>Resolve, por exemplo:</div>
            <div className={styles.chipsWrap}>
              <span className={styles.chipDark}>Guias DAS atrasadas</span>
              <span className={styles.chipDark}>Declaração DASN</span>
              <span className={styles.chipDark}>Desenquadramento MEI</span>
              <span className={styles.chipDark}>Dúvidas do Simples</span>
            </div>
          </div>

          {/* LISTA DE ENTREGÁVEIS (REDUZIDA / EXPANSÍVEL) */}
          <div className={styles.entregaveisList}>
            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconCoral} />
              <div className={styles.entregavelText}>
                <b className={styles.textLight}>Tudo do plano Pessoa Física</b>
                <small className={styles.textMutedDark}>Pré-atendimento guiado, chat seguro, relatório assinado com CRC e retorno grátis.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconCoral} />
              <div className={styles.entregavelText}>
                <b className={styles.textLight}>Contador especialista em empresas</b>
                <small className={styles.textMutedDark}>Profissional com foco em MEI, Simples Nacional e rotina fiscal do seu negócio.</small>
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
                    <b className={styles.textLight}>Emissão de guias inclusa</b>
                    <small className={styles.textMutedDark}>DAS e guias do Simples Nacional emitidas e disponibilizadas na área do cliente.</small>
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
            <span>Agendar Pessoa Jurídica</span>
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* 3. SOB DEMANDA */}
        <div
          onClick={() => setSelectedPlan("sob-demanda")}
          className={`${styles.planoCard} ${styles.planoLight} ${selectedPlan === "sob-demanda" ? styles.planoSelecionado : ""}`}
        >
          {selectedPlan === "sob-demanda" && (
            <div className={styles.badgeSelecionado}>
              <CheckCircle2 size={14} />
              <span>Plano Selecionado</span>
            </div>
          )}

          <div className={styles.planoHeader}>
            <div className={styles.planoNomeFlex}>
              <span className={styles.planoTitulo}>Sob Demanda</span>
              <div className={styles.planoIconBadge}>
                <Zap size={22} />
              </div>
            </div>
            <p className={styles.planoSubtitulo}>
              Para o caso que não cabe em um atendimento: anos de declaração atrasada ou escopo grande.
            </p>
          </div>

          <div className={styles.precoBox}>
            <div className={styles.precoSobConsultaTitle}>Sob Consulta</div>
            <div className={styles.precoUnidade}>ou Diagnóstico por R$ {money(consultaCents)}</div>
            <div className={styles.precoPagamento}>orçamento fechado por escrito antes de começar</div>
          </div>

          <div className={styles.resolveSection}>
            <div className={styles.resolveRotulo}>Resolve, por exemplo:</div>
            <div className={styles.chipsWrap}>
              <span className={styles.chipLight}>Vários anos atrasados</span>
              <span className={styles.chipLight}>Regularizações extensas</span>
              <span className={styles.chipLight}>Demanda recorrente</span>
            </div>
          </div>

          {/* LISTA DE ENTREGÁVEIS (REDUZIDA / EXPANSÍVEL) */}
          <div className={styles.entregaveisList}>
            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Diagnóstico inicial por R$ {money(consultaCents)}</b>
                <small>O contador analisa o caso e entrega escopo, prazo e valor. Aprovou? O valor é 100% abatido do total.</small>
              </div>
            </div>

            <div className={styles.entregavelItem}>
              <CheckCircle2 size={18} className={styles.checkIconLight} />
              <div className={styles.entregavelText}>
                <b>Escopo, prazo e valor por escrito</b>
                <small>Orçamento totalmente fechado antes de qualquer cobrança — zero surpresas no final.</small>
              </div>
            </div>

            {/* ITENS EXPANDIDOS */}
            {expandedCards["sob-demanda"] && (
              <>
                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>A mesma estrutura completa</b>
                    <small>Chat seguro com contador, linha do tempo na área do cliente e relatório final assinado com CRC.</small>
                  </div>
                </div>

                <div className={styles.entregavelItem}>
                  <CheckCircle2 size={18} className={styles.checkIconLight} />
                  <div className={styles.entregavelText}>
                    <b>Sem compromisso de fechar</b>
                    <small>Você decide com a proposta formal na mão. Se optar por não seguir, o relatório de diagnóstico é seu.</small>
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
            <span>Pedir Orçamento Sob Demanda</span>
            <ArrowRight size={18} />
          </Link>
        </div>

      </div>

      <div className={styles.observacaoRecorrencia}>
        * O acompanhamento das obrigações mensais da empresa é realizado via recorrência, acordado com o contador no atendimento.
      </div>
    </div>
  );
}
