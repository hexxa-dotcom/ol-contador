import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as serpro from "@/lib/serpro";
import * as dividaAtiva from "@/lib/dividaAtiva";
import * as cnd from "@/lib/cnd";
import { registrarErro } from "@/lib/observability";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Porte 1:1 de api/radar-fiscal.js. TODA ação abaixo (menos `cache` e
// `estado-cliente`) gasta uma requisição PAGA no SERPRO — por isso a matriz
// de permissão staff x cliente é reproduzida aqui, e não só uma whitelist.

type RadarConfig = {
  portalAtivo: boolean;
  caixaPostalAutomatica: boolean;
  caixaPostalIntervaloDias: number;
  parcelamentosValidadeDias: number;
  clientePodeEmitirDas: boolean;
};

const DEFAULT_RADAR_CONFIG: RadarConfig = {
  portalAtivo: true,
  caixaPostalAutomatica: true,
  caixaPostalIntervaloDias: 7,
  parcelamentosValidadeDias: 0,
  clientePodeEmitirDas: true,
};

function objeto(valor: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) return valor as Record<string, unknown>;
  if (typeof valor === "string") {
    try {
      const p = JSON.parse(valor);
      return p && typeof p === "object" ? p : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function carregarConfiguracaoRadar(admin: SupabaseClient<Database>) {
  const { data } = await admin.from("configuracoes").select("chave, valor").in("chave", ["radar_fiscal_config", "radar_fiscal_clientes"]);
  const porChave: Record<string, unknown> = {};
  (data || []).forEach((linha) => {
    porChave[linha.chave] = linha.valor;
  });
  const cfg: RadarConfig = { ...DEFAULT_RADAR_CONFIG, ...objeto(porChave.radar_fiscal_config) };
  cfg.portalAtivo = cfg.portalAtivo !== false;
  cfg.caixaPostalAutomatica = cfg.caixaPostalAutomatica !== false;
  cfg.caixaPostalIntervaloDias = Math.min(30, Math.max(1, parseInt(String(cfg.caixaPostalIntervaloDias), 10) || 7));
  cfg.parcelamentosValidadeDias = Math.min(365, Math.max(0, parseInt(String(cfg.parcelamentosValidadeDias), 10) || 0));
  cfg.clientePodeEmitirDas = cfg.clientePodeEmitirDas !== false;
  return { cfg, clientes: objeto(porChave.radar_fiscal_clientes) };
}

type ClienteRadar = {
  id: string;
  cpf: string | null;
  regime_tributario: string | null;
  regime_detectado_em: string | null;
  recorrente: boolean | null;
  recorrente_tipo: string | null;
  user_id: string | null;
};

function clienteLiberadoNoRadar(cliente: ClienteRadar | null, liberacoes: Record<string, unknown>): boolean {
  if (!cliente) return false;
  if (Object.prototype.hasOwnProperty.call(liberacoes, cliente.id)) return liberacoes[cliente.id] === true;
  return !!(cliente.recorrente && cliente.recorrente_tipo === "Radar Fiscal");
}

async function buscarResultadoSalvo(admin: SupabaseClient<Database>, clienteRef: string | null, servico: string, validadeHoras: number) {
  if (!clienteRef) return null;
  const { data, error } = await admin.from("serpro_resultados").select("*").eq("cliente_ref", clienteRef).eq("servico", servico).maybeSingle();
  if (error) {
    console.error("[radar-fiscal] falha ao ler cache:", error.message);
    return null;
  }
  if (!data) return null;
  if (validadeHoras > 0) {
    const limite = Date.now() - validadeHoras * 3600 * 1000;
    if (!data.obtido_em || new Date(data.obtido_em).getTime() < limite) return null;
  }
  return data;
}

async function registrarConsumo(
  admin: SupabaseClient<Database>,
  { clienteRef, documento, idSistema, idServico, acao, sucesso, erro, userId, origem }: { clienteRef: string | null; documento: string; idSistema: string; idServico: string; acao: string; sucesso: boolean; erro?: { code?: string; message: string } | null; userId: string; origem: string }
) {
  try {
    const { error } = await admin.from("serpro_consultas").insert({
      cliente_ref: clienteRef || null,
      documento: `${String(documento).length === 14 ? "CNPJ" : "CPF"}-***${String(documento).slice(-4)}`,
      id_sistema: idSistema,
      id_servico: idServico,
      acao,
      sucesso,
      erro_codigo: erro ? erro.code || "erro" : null,
      erro_detalhe: erro ? String(erro.message).slice(0, 500) : null,
      disparado_por: userId || null,
      origem: origem || "painel",
    });
    if (error) throw error;
  } catch (e) {
    console.error("[radar-fiscal] falha ao registrar consumo:", (e as Error).message);
  }
}

// PARCSN (Simples Nacional) libera parcelas atualizadas todo dia 10; PARCMEI
// libera todo dia 1º — antes disso, no mesmo mês, não existe nada novo pra
// buscar, então o cache vale até a última liberação (não um prazo fixo).
function horasDesdeUltimaLiberacaoParcelamento(regime: string): number {
  const dia = regime === "mei" ? 1 : 10;
  const agora = new Date();
  let liberacao = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), dia));
  if (agora.getTime() < liberacao.getTime()) {
    liberacao = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, dia));
  }
  return Math.max(1, Math.round((agora.getTime() - liberacao.getTime()) / 3600000));
}

async function guardarResultado(admin: SupabaseClient<Database>, clienteRef: string | null, servico: string, resultado: unknown, validadeHoras: number) {
  if (!clienteRef) return;
  const horas = Number.isFinite(validadeHoras) ? validadeHoras : 24;
  try {
    const { error } = await admin.from("serpro_resultados").upsert(
      {
        cliente_ref: clienteRef,
        servico,
        resultado: resultado as never,
        obtido_em: new Date().toISOString(),
        expira_em: horas > 0 ? new Date(Date.now() + horas * 3600 * 1000).toISOString() : null,
      },
      { onConflict: "cliente_ref,servico" }
    );
    if (error) throw error;
  } catch (e) {
    console.error("[radar-fiscal] falha ao guardar resultado:", (e as Error).message);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const { data: souStaffRow } = await admin.from("staff").select("id").eq("id", userId).maybeSingle();
  const souStaff = !!souStaffRow;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = String(body.acao || "");
  if (!acao) return NextResponse.json({ error: "acao_required" }, { status: 400 });

  let clienteRef = (body.clienteRef as string) || null;
  let cliente: ClienteRadar | null = null;

  if (souStaff && clienteRef) {
    const { data, error } = await admin.from("clientes").select("id, cpf, regime_tributario, regime_detectado_em, recorrente, recorrente_tipo, user_id").eq("id", clienteRef).maybeSingle();
    if (error) return NextResponse.json({ error: "falha_ao_buscar_cliente", detail: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "cliente_nao_encontrado" }, { status: 404 });
    cliente = data;
  } else if (!souStaff) {
    const { data, error } = await admin.from("clientes").select("id, cpf, regime_tributario, regime_detectado_em, recorrente, recorrente_tipo, user_id").eq("user_id", userId).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    cliente = data;
    clienteRef = cliente.id; // nunca confia no clientId enviado pelo navegador
  }

  const { cfg: radarCfg, clientes: liberacoesRadar } = await carregarConfiguracaoRadar(admin);
  const radarLiberado = clienteLiberadoNoRadar(cliente, liberacoesRadar);

  if (acao === "estado-cliente") {
    if (!clienteRef || !cliente) return NextResponse.json({ error: "cliente_required" }, { status: 400 });
    const { data } = await admin.from("serpro_resultados").select("*").eq("cliente_ref", clienteRef);
    return NextResponse.json({
      habilitado: radarCfg.portalAtivo && radarLiberado,
      configuracao: { caixaPostalIntervaloDias: radarCfg.caixaPostalIntervaloDias, parcelamentosValidadeDias: radarCfg.parcelamentosValidadeDias, clientePodeEmitirDas: radarCfg.clientePodeEmitirDas },
      regime: cliente.regime_tributario || null,
      resultados: data || [],
      capacidades: { integraContador: serpro.isSerproConfigured(), dividaAtiva: dividaAtiva.isConfigured(), cnd: cnd.isConfigured() },
    });
  }

  if (acao === "capacidades") {
    if (!souStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({
      integraContador: serpro.isSerproConfigured(),
      dividaAtiva: dividaAtiva.isConfigured(),
      cnd: cnd.isConfigured(),
      servicos: { caixaPostal: true, situacaoFiscal: true, parcelamentosSimplesMei: true, dividaAtivaUniao: dividaAtiva.isConfigured(), parcelamentosPgfnRegularize: false, cnd: cnd.isConfigured() },
    });
  }

  if (!souStaff) {
    if (!radarCfg.portalAtivo || !radarLiberado) return NextResponse.json({ error: "radar_nao_habilitado" }, { status: 403 });
    const permitidas = radarCfg.clientePodeEmitirDas ? ["parcelamentos", "emitir-das"] : ["parcelamentos"];
    if (!permitidas.includes(acao)) return NextResponse.json({ error: "acao_nao_liberada_ao_cliente" }, { status: 403 });
  }

  if (acao === "cache") {
    if (!souStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!clienteRef) return NextResponse.json({ error: "cliente_required" }, { status: 400 });
    const { data } = await admin.from("serpro_resultados").select("*").eq("cliente_ref", clienteRef);
    return NextResponse.json({ resultados: data || [] });
  }

  const documento = String((cliente && cliente.cpf) || body.documento || "").replace(/\D/g, "");
  if (!documento) return NextResponse.json({ error: "documento_required", detail: "Informe o CPF/CNPJ que será consultado." }, { status: 400 });
  if (![11, 14].includes(documento.length)) return NextResponse.json({ error: "documento_invalido", detail: "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos." }, { status: 400 });

  const forcarAtualizacao = !!(souStaff && body.forcar);
  if (acao === "caixa-postal" && clienteRef && !forcarAtualizacao && !body.ponteiroPagina) {
    const salvo = await buscarResultadoSalvo(admin, clienteRef, "caixa-postal", radarCfg.caixaPostalIntervaloDias * 24);
    if (salvo) return NextResponse.json({ ...(salvo.resultado as object), cacheado: true, obtidoEm: salvo.obtido_em });
  }
  if (acao === "parcelamentos" && clienteRef && !forcarAtualizacao) {
    const regimeConhecido = (body.regime as string) || cliente?.regime_tributario || "";
    const horas = regimeConhecido
      ? horasDesdeUltimaLiberacaoParcelamento(regimeConhecido)
      : radarCfg.parcelamentosValidadeDias > 0
        ? radarCfg.parcelamentosValidadeDias * 24
        : 0;
    const salvo = await buscarResultadoSalvo(admin, clienteRef, "parcelamentos", horas);
    if (salvo) return NextResponse.json({ ...(salvo.resultado as object), cacheado: true, obtidoEm: salvo.obtido_em });
  }
  if (acao === "divida-ativa" && clienteRef && !forcarAtualizacao) {
    const salvo = await buscarResultadoSalvo(admin, clienteRef, "divida-ativa", 24);
    if (salvo) return NextResponse.json({ ...(salvo.resultado as object), cacheado: true, obtidoEm: salvo.obtido_em });
  }
  if (acao === "situacao-fiscal" && clienteRef && !forcarAtualizacao) {
    const salvo = await buscarResultadoSalvo(admin, clienteRef, "situacao-fiscal", 24);
    if (salvo) return NextResponse.json({ ...(salvo.resultado as object), cacheado: true, obtidoEm: salvo.obtido_em });
  }

  const acaoExterna = ["divida-ativa", "divida-ativa-detalhe", "cnd"].includes(acao);
  if (!acaoExterna && !serpro.isSerproConfigured()) return NextResponse.json({ error: "serpro_not_configured" }, { status: 503 });

  const log = (idSistema: string, idServico: string, verbo: string, sucesso: boolean, erro?: { code?: string; message: string } | null) =>
    registrarConsumo(admin, { clienteRef, documento, idSistema, idServico, acao: verbo, sucesso, erro, userId, origem: souStaff ? "painel" : "cliente" });

  try {
    switch (acao) {
      case "testar-autenticacao": {
        await serpro.testarAutenticacao();
        return NextResponse.json({ ok: true, autenticacao: "mtls_oauth" });
      }

      case "caixa-postal": {
        try {
          const ponteiroPagina = (body.ponteiroPagina as string) || null;
          const r = await serpro.consultarCaixaPostal(documento, ponteiroPagina);
          await log("CAIXAPOSTAL", "MSGCONTRIBUINTE61", "Consultar", true);
          if (!ponteiroPagina) await guardarResultado(admin, clienteRef, "caixa-postal", r, radarCfg.caixaPostalIntervaloDias * 24);
          if (clienteRef) {
            await admin.from("clientes").update({ caixa_postal_novas: false, caixa_postal_checada_em: new Date().toISOString() }).eq("id", clienteRef);
          }
          return NextResponse.json(r);
        } catch (e) {
          await log("CAIXAPOSTAL", "MSGCONTRIBUINTE61", "Consultar", false, e as Error);
          throw e;
        }
      }

      case "mensagem-detalhe": {
        const isn = body.isn as string;
        if (!isn) return NextResponse.json({ error: "isn_required" }, { status: 400 });
        // O conteúdo de uma mensagem já enviada pela Receita não muda —
        // guarda sem expiração, pra reabrir a mesma mensagem nunca gastar
        // uma nova requisição paga.
        const servicoCache = `caixa-postal-msg-${isn}`;
        if (clienteRef && !forcarAtualizacao) {
          const salvo = await buscarResultadoSalvo(admin, clienteRef, servicoCache, 0);
          if (salvo) return NextResponse.json({ detalhe: salvo.resultado, cacheado: true, obtidoEm: salvo.obtido_em });
        }
        try {
          const r = await serpro.detalharMensagem(documento, isn);
          await log("CAIXAPOSTAL", "MSGDETALHAMENTO62", "Consultar", true);
          if (clienteRef) await guardarResultado(admin, clienteRef, servicoCache, r, 0);
          return NextResponse.json({ detalhe: r });
        } catch (e) {
          await log("CAIXAPOSTAL", "MSGDETALHAMENTO62", "Consultar", false, e as Error);
          throw e;
        }
      }

      // Orquestra o fluxo de duas etapas (solicitar protocolo + esperar +
      // emitir) num único request e guarda o relatório completo (com PDF)
      // em cache — assim "Ver dados salvos" reabre o mesmo relatório sem
      // gastar outra requisição paga.
      case "situacao-fiscal": {
        try {
          const protocolo = await serpro.solicitarProtocoloSitfis(documento);
          await log("SITFIS", "SOLICITARPROTOCOLO91", "Apoiar", true);
          if (!protocolo.protocolo) throw new Error("A Receita não devolveu o protocolo SITFIS.");
          const espera = Math.min(Number(protocolo.tempoEsperaMs) || 0, 20000);
          if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
          const relatorio = await serpro.emitirRelatorioSitfis(documento, String(protocolo.protocolo));
          await log("SITFIS", "RELATORIOSITFIS92", "Emitir", true);
          if (clienteRef) await guardarResultado(admin, clienteRef, "situacao-fiscal", relatorio, 24);
          return NextResponse.json(relatorio);
        } catch (e) {
          await log("SITFIS", "RELATORIOSITFIS92", "Emitir", false, e as Error);
          throw e;
        }
      }

      case "sitfis-solicitar": {
        try {
          const r = await serpro.solicitarProtocoloSitfis(documento);
          await log("SITFIS", "SOLICITARPROTOCOLO91", "Apoiar", true);
          return NextResponse.json(r);
        } catch (e) {
          await log("SITFIS", "SOLICITARPROTOCOLO91", "Apoiar", false, e as Error);
          throw e;
        }
      }

      case "sitfis-emitir": {
        const protocolo = body.protocolo as string;
        if (!protocolo) return NextResponse.json({ error: "protocolo_required" }, { status: 400 });
        try {
          const r = await serpro.emitirRelatorioSitfis(documento, protocolo);
          await log("SITFIS", "RELATORIOSITFIS92", "Emitir", true);
          if (r.pdfBase64) await guardarResultado(admin, clienteRef, "sitfis", { emitidoEm: new Date().toISOString(), temPdf: true }, 0);
          return NextResponse.json(r);
        } catch (e) {
          await log("SITFIS", "RELATORIOSITFIS92", "Emitir", false, e as Error);
          throw e;
        }
      }

      case "regime": {
        if (cliente && cliente.regime_tributario && !body.forcar) {
          return NextResponse.json({ regime: cliente.regime_tributario, cacheado: true });
        }
        try {
          const r = await serpro.consultarSituacaoMei(documento);
          await log("CCMEI", "CCMEISITCADASTRAL123", "Consultar", true);
          const regime = r.mei ? "mei" : documento.length > 11 ? "simples" : "outro";
          if (clienteRef) await admin.from("clientes").update({ regime_tributario: regime, regime_detectado_em: new Date().toISOString() }).eq("id", clienteRef);
          return NextResponse.json({ regime, cacheado: false, detalhe: r });
        } catch (e) {
          await log("CCMEI", "CCMEISITCADASTRAL123", "Consultar", false, e as Error);
          throw e;
        }
      }

      case "parcelamentos": {
        const regime = (body.regime as string) || (cliente && cliente.regime_tributario) || "";
        if (regime && !["mei", "simples"].includes(regime)) return NextResponse.json({ error: "regime_invalido", detail: "Escolha MEI ou Simples Nacional." }, { status: 400 });
        if (!regime) return NextResponse.json({ error: "regime_desconhecido", detail: "Informe se o CNPJ é MEI ou Simples Nacional antes de consultar parcelamentos." }, { status: 409 });
        if (souStaff && clienteRef && body.regime && body.regime !== cliente?.regime_tributario) {
          await admin.from("clientes").update({ regime_tributario: regime, regime_detectado_em: new Date().toISOString() }).eq("id", clienteRef);
        }
        const sistemas = serpro.sistemasParcelamentoPara(regime);
        const saida: { regime: string; sistemas: { sistema: string; pedidos: unknown[]; parcelas: unknown[]; erro: string | null }[] } = { regime, sistemas: [] };

        for (const sistema of sistemas) {
          const bloco: { sistema: string; pedidos: unknown[]; parcelas: unknown[]; erro: string | null } = { sistema, pedidos: [], parcelas: [], erro: null };
          try {
            bloco.pedidos = await serpro.consultarPedidosParcelamento(documento, sistema);
            await log(sistema, "PEDIDOSPARC", "Consultar", true);
          } catch (e) {
            bloco.erro = (e as { code?: string }).code === "sem_procuracao" ? "sem_procuracao" : "falha";
            await log(sistema, "PEDIDOSPARC", "Consultar", false, e as Error);
          }
          if (bloco.pedidos.length > 0) {
            try {
              bloco.parcelas = await serpro.consultarParcelasParaGerar(documento, sistema);
              await log(sistema, "PARCELASPARAGERAR", "Consultar", true);
            } catch (e) {
              await log(sistema, "PARCELASPARAGERAR", "Consultar", false, e as Error);
            }
          }
          saida.sistemas.push(bloco);
        }

        // expira_em é só metadado aqui — a validade real é calculada na
        // hora da leitura via horasDesdeUltimaLiberacaoParcelamento.
        await guardarResultado(admin, clienteRef, "parcelamentos", saida, 0);
        return NextResponse.json({ ...saida, cacheado: false });
      }

      case "parcelamento-detalhe": {
        if (!souStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
        const sistema = body.sistema as string;
        const numeroParcelamento = body.numeroParcelamento as string;
        const permitidos = serpro.sistemasParcelamentoPara((body.regime as string) || (cliente && cliente.regime_tributario) || "");
        if (!sistema || !numeroParcelamento || !permitidos.includes(sistema)) return NextResponse.json({ error: "parcelamento_invalido" }, { status: 400 });
        try {
          const r = await serpro.obterDetalheParcelamento(documento, sistema, numeroParcelamento);
          await log(sistema, "OBTERPARC", "Consultar", true);
          return NextResponse.json({ detalhe: r });
        } catch (e) {
          await log(sistema, "OBTERPARC", "Consultar", false, e as Error);
          throw e;
        }
      }

      case "divida-ativa": {
        try {
          const r = await dividaAtiva.consultarDevedor(documento);
          await log("PGFN-SIDA", "CONSULTAR-DEVEDOR", "Consultar", true);
          const saida = { ...r, consultadoEm: new Date().toISOString() };
          await guardarResultado(admin, clienteRef, "divida-ativa", saida, 24);
          return NextResponse.json({ ...saida, cacheado: false });
        } catch (e) {
          await log("PGFN-SIDA", "CONSULTAR-DEVEDOR", "Consultar", false, e as Error);
          throw e;
        }
      }

      case "divida-ativa-detalhe": {
        const numero = String(body.numeroInscricao || "").replace(/\D/g, "");
        if (!numero) return NextResponse.json({ error: "inscricao_required" }, { status: 400 });
        try {
          const r = await dividaAtiva.consultarInscricao(numero);
          await log("PGFN-SIDA", "CONSULTAR-INSCRICAO", "Consultar", true);
          return NextResponse.json(r);
        } catch (e) {
          await log("PGFN-SIDA", "CONSULTAR-INSCRICAO", "Consultar", false, e as Error);
          throw e;
        }
      }

      case "cnd": {
        try {
          const r = await cnd.emitir(documento);
          await log("CND", "EMITIR-CERTIDAO", "Emitir", true);
          if (r.pdfBase64) await guardarResultado(admin, clienteRef, "cnd", { emitidoEm: new Date().toISOString(), temPdf: true, protocolo: r.protocolo || null }, 24);
          return NextResponse.json(r);
        } catch (e) {
          await log("CND", "EMITIR-CERTIDAO", "Emitir", false, e as Error);
          throw e;
        }
      }

      case "emitir-das": {
        const sistema = body.sistema as string;
        const parcela = body.parcela as string;
        if (!sistema || !parcela) return NextResponse.json({ error: "sistema_e_parcela_required" }, { status: 400 });
        if (!souStaff) {
          const salvo = await buscarResultadoSalvo(admin, clienteRef, "parcelamentos", 0);
          const resultado = salvo?.resultado as { sistemas?: { sistema: string; parcelas?: { parcela: unknown }[] }[] } | undefined;
          const permitido = resultado?.sistemas?.some((bloco) => bloco.sistema === sistema && bloco.parcelas?.some((item) => String(item.parcela) === String(parcela)));
          if (!permitido) return NextResponse.json({ error: "parcela_nao_liberada", detail: "Esta parcela não está entre os dados salvos do seu Radar Fiscal." }, { status: 403 });
        }
        try {
          const r = await serpro.emitirDasParcelamento(documento, sistema, parcela);
          await log(sistema, "GERARDAS", "Emitir", true);
          return NextResponse.json(r);
        } catch (e) {
          await log(sistema, "GERARDAS", "Emitir", false, e as Error);
          throw e;
        }
      }

      default:
        return NextResponse.json({ error: "acao_desconhecida", detail: acao }, { status: 400 });
    }
  } catch (e) {
    const err = e as { code?: string; status?: number; message: string };
    console.error("[radar-fiscal]", acao, err.message);
    await registrarErro(admin, {
      origem: "radar_fiscal",
      codigo: err.code || "radar_error",
      mensagem: err.message,
      rota: "/api/radar-fiscal",
      severidade: err.code === "sem_procuracao" ? "aviso" : "erro",
      contexto: { acao, clienteRef, status: err.status || null },
    });
    if (err.code === "sem_procuracao") {
      return NextResponse.json({ error: "sem_procuracao", detail: "O contribuinte precisa outorgar procuração eletrônica para a HEXX no e-CAC antes desta consulta." }, { status: 422 });
    }
    if (err.code === "serpro_not_configured") return NextResponse.json({ error: "serpro_not_configured" }, { status: 503 });
    if (err.code === "divida_ativa_not_configured") {
      return NextResponse.json({ error: err.code, detail: "A Consulta Dívida Ativa é um contrato separado do Integra Contador. Configure as credenciais próprias do produto SERPRO." }, { status: 503 });
    }
    if (err.code === "divida_ativa_not_contracted") {
      return NextResponse.json({ error: err.code, detail: "As credenciais informadas não têm acesso contratado à Consulta Dívida Ativa." }, { status: 403 });
    }
    if (err.code === "cnd_not_configured") {
      return NextResponse.json({ error: err.code, detail: "A CND exige contratação e credenciais próprias. Configure a URL e as chaves do produto SERPRO na Vercel." }, { status: 503 });
    }
    return NextResponse.json({ error: "serpro_error", detail: err.message }, { status: 502 });
  }
}
