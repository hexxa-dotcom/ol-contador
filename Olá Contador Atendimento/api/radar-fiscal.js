// POST /api/radar-fiscal — roteador das consultas ao Integra Contador (Serpro).
//
// É UMA função serverless só, com várias ações, de propósito: o plano Hobby da
// Vercel tem teto de 12 funções por deploy e o projeto já está em 12/12.
// Cada ação nova aqui dentro não custa uma vaga; um arquivo novo em /api sim.
//
// TODA ação abaixo (menos `cache`) gasta uma requisição PAGA no Serpro. Por
// isso: só a EQUIPE dispara — nunca o cliente. Um botão exposto ao cliente
// vira custo aberto, e a decisão foi manter o gasto previsível.
const { requireUser, adminClient } = require('./_lib/auth');
const serpro = require('./_lib/serpro');
const dividaAtiva = require('./_lib/divida-ativa');

const DEFAULT_RADAR_CONFIG = {
  portalAtivo: true,
  caixaPostalAutomatica: true,
  caixaPostalIntervaloDias: 7,
  parcelamentosValidadeDias: 0,
  clientePodeEmitirDas: true
};

function objeto(valor, fallback = {}) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor;
  if (typeof valor === 'string') { try { const p = JSON.parse(valor); return p && typeof p === 'object' ? p : fallback; } catch (_) {} }
  return fallback;
}

async function carregarConfiguracaoRadar(admin) {
  const { data } = await admin.from('configuracoes').select('chave, valor').in('chave', ['radar_fiscal_config', 'radar_fiscal_clientes']);
  const porChave = {};
  (data || []).forEach(linha => { porChave[linha.chave] = linha.valor; });
  const cfg = { ...DEFAULT_RADAR_CONFIG, ...objeto(porChave.radar_fiscal_config) };
  cfg.portalAtivo = cfg.portalAtivo !== false;
  cfg.caixaPostalAutomatica = cfg.caixaPostalAutomatica !== false;
  cfg.caixaPostalIntervaloDias = Math.min(30, Math.max(1, parseInt(cfg.caixaPostalIntervaloDias, 10) || 7));
  cfg.parcelamentosValidadeDias = Math.min(365, Math.max(0, parseInt(cfg.parcelamentosValidadeDias, 10) || 0));
  cfg.clientePodeEmitirDas = cfg.clientePodeEmitirDas !== false;
  return { cfg, clientes: objeto(porChave.radar_fiscal_clientes) };
}

function clienteLiberadoNoRadar(cliente, liberacoes) {
  if (!cliente) return false;
  if (Object.prototype.hasOwnProperty.call(liberacoes, cliente.id)) return liberacoes[cliente.id] === true;
  return !!(cliente.recorrente && cliente.recorrente_tipo === 'Radar Fiscal');
}

async function buscarResultadoSalvo(admin, clienteRef, servico, validadeHoras) {
  if (!clienteRef) return null;
  const { data, error } = await admin.from('serpro_resultados').select('*').eq('cliente_ref', clienteRef).eq('servico', servico).maybeSingle();
  if (error) {
    console.error('[radar-fiscal] falha ao ler cache:', error.message);
    return null;
  }
  if (!data) return null;
  // 0 significa validade indefinida (caso dos parcelamentos por padrão).
  if (validadeHoras > 0) {
    const limite = Date.now() - validadeHoras * 3600 * 1000;
    if (!data.obtido_em || new Date(data.obtido_em).getTime() < limite) return null;
  }
  return data;
}

async function registrarConsumo(admin, { clienteRef, documento, idSistema, idServico, acao, sucesso, erro, userId, origem }) {
  try {
    const { error } = await admin.from('serpro_consultas').insert({
      cliente_ref: clienteRef || null,
      documento,
      id_sistema: idSistema,
      id_servico: idServico,
      acao,
      sucesso,
      erro_codigo: erro ? (erro.code || 'erro') : null,
      erro_detalhe: erro ? String(erro.message).slice(0, 500) : null,
      disparado_por: userId || null,
      origem: origem || 'painel'
    });
    if (error) throw error;
  } catch (e) {
    // Falha ao registrar não pode derrubar a consulta que o usuário pediu —
    // mas precisa aparecer no log, senão o controle de custo silenciosamente
    // para de funcionar sem ninguém notar.
    console.error('[radar-fiscal] falha ao registrar consumo:', e.message);
  }
}

async function guardarResultado(admin, clienteRef, servico, resultado, validadeHoras) {
  if (!clienteRef) return;
  const horas = Number.isFinite(validadeHoras) ? validadeHoras : 24;
  try {
    const { error } = await admin.from('serpro_resultados').upsert({
      cliente_ref: clienteRef,
      servico,
      resultado,
      obtido_em: new Date().toISOString(),
      expira_em: horas > 0 ? new Date(Date.now() + horas * 3600 * 1000).toISOString() : null
    }, { onConflict: 'cliente_ref,servico' });
    if (error) throw error;
  } catch (e) {
    console.error('[radar-fiscal] falha ao guardar resultado:', e.message);
  }
}

module.exports = async (req, res) => {
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { data: souStaff } = await admin.from('staff').select('id').eq('id', auth.user.id).maybeSingle();
  const body = req.body || {};
  const acao = body.acao || req.query.acao;
  if (!acao) return res.status(400).json({ error: 'acao_required' });

  let clienteRef = body.clienteRef || req.query.clienteRef || null;
  let cliente = null;

  if (souStaff && clienteRef) {
    const consultaCliente = await admin
      .from('clientes')
      .select('id, cpf, regime_tributario, regime_detectado_em, recorrente, recorrente_tipo, user_id')
      .eq('id', clienteRef)
      .maybeSingle();
    if (consultaCliente.error) return res.status(500).json({ error: 'falha_ao_buscar_cliente', detail: consultaCliente.error.message });
    cliente = consultaCliente.data;
    if (!cliente) return res.status(404).json({ error: 'cliente_nao_encontrado' });
  } else if (!souStaff) {
    const consultaCliente = await admin
      .from('clientes')
      .select('id, cpf, regime_tributario, regime_detectado_em, recorrente, recorrente_tipo, user_id')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (consultaCliente.error || !consultaCliente.data) return res.status(403).json({ error: 'forbidden' });
    cliente = consultaCliente.data;
    clienteRef = cliente.id; // nunca confia no clientId enviado pelo navegador
  }

  const { cfg: radarCfg, clientes: liberacoesRadar } = await carregarConfiguracaoRadar(admin);
  const radarLiberado = clienteLiberadoNoRadar(cliente, liberacoesRadar);

  // Estado é leitura gratuita. O cliente recebe somente o próprio cadastro e
  // os resultados já pagos; a equipe pode consultar o estado de qualquer cliente.
  if (acao === 'estado-cliente') {
    if (!clienteRef || !cliente) return res.status(400).json({ error: 'cliente_required' });
    const { data } = await admin.from('serpro_resultados').select('*').eq('cliente_ref', clienteRef);
    return res.json({
      habilitado: radarCfg.portalAtivo && radarLiberado,
      configuracao: {
        caixaPostalIntervaloDias: radarCfg.caixaPostalIntervaloDias,
        parcelamentosValidadeDias: radarCfg.parcelamentosValidadeDias,
        clientePodeEmitirDas: radarCfg.clientePodeEmitirDas
      },
      regime: cliente.regime_tributario || null,
      resultados: data || [],
      capacidades: {
        integraContador: serpro.isSerproConfigured(),
        dividaAtiva: dividaAtiva.isConfigured()
      }
    });
  }

  // Diagnóstico sem consumo: mostra exatamente quais contratos estão prontos.
  if (acao === 'capacidades') {
    if (!souStaff) return res.status(403).json({ error: 'forbidden' });
    return res.json({
      integraContador: serpro.isSerproConfigured(),
      dividaAtiva: dividaAtiva.isConfigured(),
      servicos: {
        caixaPostal: true,
        situacaoFiscal: true,
        parcelamentosSimplesMei: true,
        dividaAtivaUniao: dividaAtiva.isConfigured(),
        parcelamentosPgfnRegularize: false,
        cnd: false
      }
    });
  }

  if (!souStaff) {
    if (!radarCfg.portalAtivo || !radarLiberado) return res.status(403).json({ error: 'radar_nao_habilitado' });
    const permitidas = radarCfg.clientePodeEmitirDas ? ['parcelamentos', 'emitir-das'] : ['parcelamentos'];
    if (!permitidas.includes(acao)) return res.status(403).json({ error: 'acao_nao_liberada_ao_cliente' });
  }

  // Leitura do cache não chama o Serpro e não custa nada.
  if (acao === 'cache') {
    if (!souStaff) return res.status(403).json({ error: 'forbidden' });
    if (!clienteRef) return res.status(400).json({ error: 'cliente_required' });
    const { data } = await admin.from('serpro_resultados').select('*').eq('cliente_ref', clienteRef);
    return res.json({ resultados: data || [] });
  }

  const documento = String((cliente && cliente.cpf) || body.documento || req.query.documento || '').replace(/\D/g, '');
  if (!documento) {
    return res.status(400).json({ error: 'documento_required', detail: 'Informe o CPF/CNPJ que será consultado.' });
  }
  if (![11, 14].includes(documento.length)) {
    return res.status(400).json({ error: 'documento_invalido', detail: 'Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.' });
  }

  // Antes de conferir credenciais, tenta reutilizar o que já foi pago. Assim
  // até uma indisponibilidade do Serpro não impede abrir dados salvos.
  const forcarAtualizacao = !!(souStaff && body.forcar);
  if (acao === 'caixa-postal' && clienteRef && !forcarAtualizacao && (parseInt(body.pagina, 10) || 1) === 1) {
    const salvo = await buscarResultadoSalvo(admin, clienteRef, 'caixa-postal', radarCfg.caixaPostalIntervaloDias * 24);
    if (salvo) return res.json({ ...salvo.resultado, cacheado: true, obtidoEm: salvo.obtido_em });
  }
  if (acao === 'parcelamentos' && clienteRef && !forcarAtualizacao) {
    const horas = radarCfg.parcelamentosValidadeDias > 0 ? radarCfg.parcelamentosValidadeDias * 24 : 0;
    const salvo = await buscarResultadoSalvo(admin, clienteRef, 'parcelamentos', horas);
    if (salvo) return res.json({ ...salvo.resultado, cacheado: true, obtidoEm: salvo.obtido_em });
  }
  if (acao === 'divida-ativa' && clienteRef && !forcarAtualizacao) {
    const salvo = await buscarResultadoSalvo(admin, clienteRef, 'divida-ativa', 24);
    if (salvo) return res.json({ ...salvo.resultado, cacheado: true, obtidoEm: salvo.obtido_em });
  }

  const acaoDividaAtiva = ['divida-ativa', 'divida-ativa-detalhe'].includes(acao);
  if (!acaoDividaAtiva && !serpro.isSerproConfigured()) {
    return res.status(503).json({ error: 'serpro_not_configured' });
  }

  const log = (idSistema, idServico, verbo, sucesso, erro) => registrarConsumo(admin, {
    clienteRef, documento, idSistema, idServico, acao: verbo, sucesso, erro, userId: auth.user.id,
    origem: souStaff ? 'painel' : 'cliente'
  });

  try {
    switch (acao) {

      // Diagnóstico gratuito: autentica via certificado/OAuth, mas não chama
      // nenhum serviço tributário do catálogo e não gera consumo no SERPRO.
      case 'testar-autenticacao': {
        await serpro.testarAutenticacao();
        return res.json({ ok: true, autenticacao: 'mtls_oauth' });
      }

      // ---- Caixa Postal -------------------------------------------------
      case 'caixa-postal': {
        try {
          const pagina = Math.max(1, parseInt(body.pagina, 10) || 1);
          const r = await serpro.consultarCaixaPostal(documento, pagina);
          await log('CAIXAPOSTAL', 'MSGCONTRIBUINTE61', 'Consultar', true);
          // O cache principal representa a primeira página. Páginas seguintes
          // são complementos sob demanda e não substituem esse resumo.
          if (pagina === 1) await guardarResultado(admin, clienteRef, 'caixa-postal', r, radarCfg.caixaPostalIntervaloDias * 24);
          // A lista foi lida agora: zera o sinalizador que a varredura semanal
          // levantou, senão o aviso de "tem mensagem nova" nunca sumiria.
          if (clienteRef) {
            await admin.from('clientes')
              .update({ caixa_postal_novas: false, caixa_postal_checada_em: new Date().toISOString() })
              .eq('id', clienteRef);
          }
          return res.json(r);
        } catch (e) {
          await log('CAIXAPOSTAL', 'MSGCONTRIBUINTE61', 'Consultar', false, e);
          throw e;
        }
      }

      case 'mensagem-detalhe': {
        const isn = body.isn;
        if (!isn) return res.status(400).json({ error: 'isn_required' });
        try {
          const r = await serpro.detalharMensagem(documento, isn);
          await log('CAIXAPOSTAL', 'MSGDETALHAMENTO62', 'Consultar', true);
          return res.json({ detalhe: r });
        } catch (e) {
          await log('CAIXAPOSTAL', 'MSGDETALHAMENTO62', 'Consultar', false, e);
          throw e;
        }
      }

      // ---- Situação fiscal (SITFIS) -------------------------------------
      // Duas etapas. A primeira devolve um protocolo e, às vezes, um tempo de
      // espera; a segunda emite o PDF. Quem chama precisa respeitar a espera
      // antes de pedir a emissão, senão gasta uma requisição à toa.
      case 'sitfis-solicitar': {
        try {
          const r = await serpro.solicitarProtocoloSitfis(documento);
          await log('SITFIS', 'SOLICITARPROTOCOLO91', 'Apoiar', true);
          return res.json(r);
        } catch (e) {
          await log('SITFIS', 'SOLICITARPROTOCOLO91', 'Apoiar', false, e);
          throw e;
        }
      }

      case 'sitfis-emitir': {
        const protocolo = body.protocolo;
        if (!protocolo) return res.status(400).json({ error: 'protocolo_required' });
        try {
          const r = await serpro.emitirRelatorioSitfis(documento, protocolo);
          await log('SITFIS', 'RELATORIOSITFIS92', 'Emitir', true);
          if (r.pdfBase64) {
            // Guarda só o metadado, não o PDF inteiro — base64 de relatório
            // fiscal estoura o tamanho útil de uma linha de cache.
            await guardarResultado(admin, clienteRef, 'sitfis', {
              emitidoEm: new Date().toISOString(), temPdf: true
            }, 0);
          }
          return res.json(r);
        } catch (e) {
          await log('SITFIS', 'RELATORIOSITFIS92', 'Emitir', false, e);
          throw e;
        }
      }

      // ---- Regime (uma vez por cliente) ---------------------------------
      case 'regime': {
        if (cliente && cliente.regime_tributario && !body.forcar) {
          return res.json({ regime: cliente.regime_tributario, cacheado: true });
        }
        try {
          const r = await serpro.consultarSituacaoMei(documento);
          await log('CCMEI', 'CCMEISITCADASTRAL123', 'Consultar', true);
          const regime = r.mei ? 'mei' : (documento.length > 11 ? 'simples' : 'outro');
          if (clienteRef) {
            await admin.from('clientes')
              .update({ regime_tributario: regime, regime_detectado_em: new Date().toISOString() })
              .eq('id', clienteRef);
          }
          return res.json({ regime, cacheado: false, detalhe: r });
        } catch (e) {
          await log('CCMEI', 'CCMEISITCADASTRAL123', 'Consultar', false, e);
          throw e;
        }
      }

      // ---- Parcelamentos -------------------------------------------------
      // Uma ação só devolve os pedidos E as parcelas prontas para emissão —
      // é o "constatar todas as guias que tem" antes de emitir qualquer uma.
      case 'parcelamentos': {
        const regime = body.regime || (cliente && cliente.regime_tributario);
        if (regime && !['mei', 'simples'].includes(regime)) {
          return res.status(400).json({ error: 'regime_invalido', detail: 'Escolha MEI ou Simples Nacional.' });
        }
        if (!regime) {
          return res.status(409).json({
            error: 'regime_desconhecido',
            detail: 'Informe se o CNPJ é MEI ou Simples Nacional antes de consultar parcelamentos.'
          });
        }
        // Quando a equipe escolhe o regime, grava no cadastro. O cliente não
        // precisará pagar uma chamada separada só para redescobrir isso.
        if (souStaff && clienteRef && body.regime && body.regime !== cliente.regime_tributario) {
          await admin.from('clientes').update({
            regime_tributario: body.regime,
            regime_detectado_em: new Date().toISOString()
          }).eq('id', clienteRef);
        }
        const sistemas = serpro.sistemasParcelamentoPara(regime);
        const saida = { regime, sistemas: [] };

        for (const sistema of sistemas) {
          const bloco = { sistema, pedidos: [], parcelas: [], erro: null };
          try {
            bloco.pedidos = await serpro.consultarPedidosParcelamento(documento, sistema);
            await log(sistema, 'PEDIDOSPARC', 'Consultar', true);
          } catch (e) {
            bloco.erro = e.code === 'sem_procuracao' ? 'sem_procuracao' : 'falha';
            await log(sistema, 'PEDIDOSPARC', 'Consultar', false, e);
          }
          // Só vale pedir as parcelas se existe parcelamento — evita uma
          // requisição paga garantida a vazio.
          if (bloco.pedidos.length > 0) {
            try {
              bloco.parcelas = await serpro.consultarParcelasParaGerar(documento, sistema);
              await log(sistema, 'PARCELASPARAGERAR', 'Consultar', true);
            } catch (e) {
              await log(sistema, 'PARCELASPARAGERAR', 'Consultar', false, e);
            }
          }
          saida.sistemas.push(bloco);
        }

        const validadeHoras = radarCfg.parcelamentosValidadeDias > 0 ? radarCfg.parcelamentosValidadeDias * 24 : 0;
        await guardarResultado(admin, clienteRef, 'parcelamentos', saida, validadeHoras);
        return res.json({ ...saida, cacheado: false });
      }

      case 'parcelamento-detalhe': {
        if (!souStaff) return res.status(403).json({ error: 'forbidden' });
        const { sistema, numeroParcelamento } = body;
        const permitidos = serpro.sistemasParcelamentoPara(body.regime || (cliente && cliente.regime_tributario));
        if (!sistema || !numeroParcelamento || !permitidos.includes(sistema)) {
          return res.status(400).json({ error: 'parcelamento_invalido' });
        }
        try {
          const r = await serpro.obterDetalheParcelamento(documento, sistema, numeroParcelamento);
          await log(sistema, 'OBTERPARC', 'Consultar', true);
          return res.json({ detalhe: r });
        } catch (e) {
          await log(sistema, 'OBTERPARC', 'Consultar', false, e);
          throw e;
        }
      }

      // ---- Dívida Ativa da União (produto SERPRO separado) --------------
      // Retorna inscrições e seus estados. A gestão de acordos/parcelas da
      // PGFN e emissão de DARF continuam no REGULARIZE/SISPAR.
      case 'divida-ativa': {
        try {
          const r = await dividaAtiva.consultarDevedor(documento);
          await log('PGFN-SIDA', 'CONSULTAR-DEVEDOR', 'Consultar', true);
          const saida = { ...r, consultadoEm: new Date().toISOString() };
          await guardarResultado(admin, clienteRef, 'divida-ativa', saida, 24);
          return res.json({ ...saida, cacheado: false });
        } catch (e) {
          await log('PGFN-SIDA', 'CONSULTAR-DEVEDOR', 'Consultar', false, e);
          throw e;
        }
      }

      case 'divida-ativa-detalhe': {
        const numero = String(body.numeroInscricao || '').replace(/\D/g, '');
        if (!numero) return res.status(400).json({ error: 'inscricao_required' });
        try {
          const r = await dividaAtiva.consultarInscricao(numero);
          await log('PGFN-SIDA', 'CONSULTAR-INSCRICAO', 'Consultar', true);
          return res.json(r);
        } catch (e) {
          await log('PGFN-SIDA', 'CONSULTAR-INSCRICAO', 'Consultar', false, e);
          throw e;
        }
      }

      case 'emitir-das': {
        const { sistema, parcela } = body;
        if (!sistema || !parcela) return res.status(400).json({ error: 'sistema_e_parcela_required' });
        if (!souStaff) {
          const salvo = await buscarResultadoSalvo(admin, clienteRef, 'parcelamentos', 0);
          const permitido = salvo && salvo.resultado && (salvo.resultado.sistemas || []).some(bloco =>
            bloco.sistema === sistema && (bloco.parcelas || []).some(item => String(item.parcela) === String(parcela))
          );
          if (!permitido) return res.status(403).json({ error: 'parcela_nao_liberada', detail: 'Esta parcela não está entre os dados salvos do seu Radar Fiscal.' });
        }
        try {
          const r = await serpro.emitirDasParcelamento(documento, sistema, parcela);
          await log(sistema, 'GERARDAS', 'Emitir', true);
          return res.json(r);
        } catch (e) {
          await log(sistema, 'GERARDAS', 'Emitir', false, e);
          throw e;
        }
      }

      default:
        return res.status(400).json({ error: 'acao_desconhecida', detail: acao });
    }
  } catch (e) {
    console.error('[radar-fiscal]', acao, e.message);
    if (e.code === 'sem_procuracao') {
      return res.status(422).json({
        error: 'sem_procuracao',
        detail: 'O contribuinte precisa outorgar procuração eletrônica para a HEXX no e-CAC antes desta consulta.'
      });
    }
    if (e.code === 'serpro_not_configured') return res.status(503).json({ error: 'serpro_not_configured' });
    if (e.code === 'divida_ativa_not_configured') {
      return res.status(503).json({
        error: e.code,
        detail: 'A Consulta Dívida Ativa é um contrato separado do Integra Contador. Configure as credenciais próprias do produto SERPRO.'
      });
    }
    if (e.code === 'divida_ativa_not_contracted') {
      return res.status(403).json({ error: e.code, detail: 'As credenciais informadas não têm acesso contratado à Consulta Dívida Ativa.' });
    }
    return res.status(502).json({ error: 'serpro_error', detail: e.message });
  }
};
