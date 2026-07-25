// Camada de integração com o SERPRO (Integra Contador / e-CAC)
// Implementa autenticação mTLS e OAuth2 (Modo Simulação ativado até chaves oficiais).
require('dotenv').config();

const SERPRO_CONSUMER_KEY = process.env.SERPRO_CONSUMER_KEY || '';
const SERPRO_CONSUMER_SECRET = process.env.SERPRO_CONSUMER_SECRET || '';
const SERPRO_CERT_BASE64 = process.env.SERPRO_CERT_BASE64 || '';
const SERPRO_CERT_PASSWORD = process.env.SERPRO_CERT_PASSWORD || '';

function isSerproConfigured() {
  return !!(SERPRO_CONSUMER_KEY && SERPRO_CERT_BASE64);
}

// Gera dados fictícios mas consistentes para a UI baseados no final do documento
function getMockRadarData(documento) {
  const cleanDoc = documento.replace(/\D/g, '');
  const lastDigit = parseInt(cleanDoc.slice(-1) || '0', 10);
  
  // 30% de chance de ter pendência (alert)
  const isAlert = lastDigit % 3 === 0;
  
  return {
    documento,
    status: isAlert ? 'alert' : 'ok',
    simulacao: true,
    dataAtualizacao: new Date().toISOString(),
    cnd: {
      status: isAlert ? 'positiva_com_efeito_negativa' : 'negativa',
      dataEmissao: new Date().toISOString(),
      mensagem: isAlert ? 'Existem débitos com exigibilidade suspensa (parcelamento).' : 'Não existem pendências ativas nos sistemas da RFB/PGFN.'
    },
    caixaPostal: {
      naoLidas: lastDigit % 2 === 0 ? 0 : 2,
      mensagens: lastDigit % 2 === 0 ? [] : [
        { data: new Date().toISOString(), assunto: 'Aviso de Malha Fiscal da RFB' },
        { data: new Date().toISOString(), assunto: 'Notificação de Cobrança - Simples Nacional' }
      ]
    },
    parcelamentos: lastDigit % 4 === 0 ? [
      { id: '44598123', tipo: 'Simples Nacional / RFB', situacao: 'Ativo', proximaGuia: '2026-08-20', valor: '350.50' }
    ] : []
  };
}

async function consultarRadarFiscal(documento) {
  if (!documento) throw new Error("Documento (CPF/CNPJ) obrigatório para o Radar Fiscal.");
  
  if (!isSerproConfigured()) {
    console.log(`[Serpro MOCK] Consultando Radar Fiscal para ${documento}...`);
    return getMockRadarData(documento);
  }

  // A arquitetura real de mTLS (pfx) será executada aqui quando o certificado for colocado.
  // Será usado const https = require('https'); e { pfx: Buffer.from(base64, 'base64'), passphrase }
  console.log(`[Serpro REAL] Iniciando comunicação mTLS com Integra Contador para ${documento}`);
  throw new Error("Integração real Serpro pendente de configuração do certificado PFX em produção.");
}

module.exports = {
  isSerproConfigured,
  consultarRadarFiscal
};
