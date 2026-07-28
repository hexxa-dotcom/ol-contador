// Integração de IA via OpenRouter (gateway único, igual ao AIA).
// A chamada é SEMPRE server-side — a chave nunca vai para o navegador.
require('dotenv').config();

// Provedor de IA. Groq e OpenRouter são ambos compatíveis com a API da OpenAI.
// Escolhe Groq automaticamente se houver GROQ_API_KEY (ou force via IA_PROVIDER).
const PROVIDER = process.env.IA_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'openrouter');

const PROVIDERS = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    key: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    visionModel: process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview'
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    key: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
    visionModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
  }
};

const ACTIVE = PROVIDERS[PROVIDER] || PROVIDERS.openrouter;
const BASE_URL = ACTIVE.baseURL;
const API_KEY = ACTIVE.key;
const MODEL = ACTIVE.model;
const VISION_MODEL = ACTIVE.visionModel;

function isConfigured() {
  return !!API_KEY;
}

// Faz uma completion de chat no OpenRouter. messages = [{role, content}].
async function chatCompletion(messages, { temperature = 0.3, maxTokens = 700 } = {}) {
  if (!isConfigured()) {
    const err = new Error('ia_not_configured');
    err.code = 'ia_not_configured';
    throw err;
  }
  const res = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Ola Contador'
    },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || res.statusText;
    const err = new Error(`ia_error: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

// Monta um texto do histórico do chat para dar contexto ao modelo.
function historyToText(messages) {
  const nome = { client: 'Cliente', agent: 'Contador', system: 'Sistema' };
  return (messages || [])
    .filter(m => m.text)
    .map(m => `${nome[m.sender] || m.sender}: ${m.text}`)
    .join('\n');
}

const PERSONA = `Você é o assistente de IA de um escritório de contabilidade brasileiro (plataforma "Olá, Contador").
Você auxilia o CONTADOR (não o cliente) durante o atendimento. Seja técnico, objetivo e correto quanto à legislação
fiscal brasileira (Receita Federal, Simples Nacional, MEI, IRPF, ganho de capital). Não invente valores.
Responda em português do Brasil.`;

// Resumo do caso do cliente (2-3 linhas).
async function resumirCaso(cliente) {
  return chatCompletion([
    { role: 'system', content: PERSONA },
    { role: 'user', content:
      `Resuma em no máximo 3 linhas a situação fiscal deste cliente para o contador abrir o atendimento.\n\n` +
      `Cliente: ${cliente.name} | Tipo: ${cliente.taxType || '-'}\n` +
      `Diagnóstico atual: ${cliente.diagnosis || '(vazio)'}\n\n` +
      `Conversa:\n${historyToText(cliente.messages)}`
    }
  ], { maxTokens: 250 });
}

async function generateEmbeddingForQuery(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
    });
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch(e) {
    console.error('Embedding error', e);
    return null;
  }
}

async function getRagContext(skillName, query, sb) {
  if (!skillName || !sb) return '';
  const embedding = await generateEmbeddingForQuery(query);
  if (!embedding) return '';
  
  const { data, error } = await sb.rpc('match_skills', {
    query_embedding: embedding,
    match_threshold: 0.1, // Aceita resultados menos similares se for necessário
    match_count: 5,
    skill_filter: skillName
  });
  
  if (error || !data || data.length === 0) return '';
  
  return data.map(d => d.chunk_text).join('\n\n');
}

// Rascunho de resposta para o contador enviar ao cliente.
async function rascunharResposta(cliente, pedido, sb) {
  const ragContext = await getRagContext(cliente.taxType, pedido || 'Qual a orientação geral?', sb);
  
  return chatCompletion([
    { role: 'system', content: PERSONA },
    { role: 'user', content:
      `Escreva uma resposta pronta para o contador ENVIAR ao cliente no chat. Tom profissional e acolhedor, ` +
      `linguagem acessível (o cliente é leigo). ${pedido ? 'Pedido específico: ' + pedido : ''}\n\n` +
      (ragContext ? `ATENÇÃO: Utilize este conhecimento extraído da legislação/manuais da base de conhecimento "${cliente.taxType}" para embasar a resposta:\n${ragContext}\n\n` : '') +
      `Cliente: ${cliente.name} | Tipo: ${cliente.taxType || '-'}\n` +
      `Conversa até agora:\n${historyToText(cliente.messages)}`
    }
  ], { maxTokens: 400 });
}

// Pergunta livre do contador, com o contexto do cliente.
async function perguntaLivre(cliente, pergunta, skill, sb) {
  const messages = [{ role: 'system', content: PERSONA }];
  
  // Tenta buscar no vector database se o nome da skill estiver definido
  let ragContext = '';
  if (skill && skill.name) {
    ragContext = await getRagContext(skill.name, pergunta, sb);
  }

  if (skill && skill.content) {
    messages.push({ role: 'system', content:
      `Conhecimento específico ativado pelo contador ("${skill.name}"). Priorize estas instruções ao responder:\n${skill.content}`
    });
  }
  
  if (ragContext) {
    messages.push({ role: 'system', content: 
      `Resultados da busca na Base de Conhecimento ("${skill.name}") para a pergunta atual:\n${ragContext}`
    });
  }

  messages.push({ role: 'user', content:
    `Contexto do cliente ${cliente.name} (${cliente.taxType || '-'}):\n` +
    `Diagnóstico: ${cliente.diagnosis || '(vazio)'}\n` +
    `Conversa:\n${historyToText(cliente.messages)}\n\n` +
    `Pergunta do contador: ${pergunta}`
  });
  return chatCompletion(messages);
}

// Sugere Diagnóstico Fiscal + Tratamento (prescrição) a partir da conversa. Retorna JSON.
async function sugerirDiagnostico(cliente) {
  const raw = await chatCompletion([
    { role: 'system', content: PERSONA },
    { role: 'user', content:
      `A partir da conversa abaixo, proponha o Diagnóstico Fiscal e o Tratamento (passos numerados) para a Receita Fiscal.\n` +
      `Responda APENAS um JSON válido, sem markdown, no formato:\n` +
      `{"diagnosis": "resumo do diagnóstico em uma linha", "treatment": "1. passo\\n2. passo\\n3. passo"}\n\n` +
      `Cliente: ${cliente.name} | Tipo: ${cliente.taxType || '-'}\n` +
      `Conversa:\n${historyToText(cliente.messages)}`
    }
  ], { temperature: 0.2, maxTokens: 500 });

  // tenta extrair o JSON mesmo se vier cercado por texto/markdown
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch (e) {
    return { diagnosis: '', treatment: raw };
  }
}

// Gera o RELATÓRIO DO CLIENTE a partir da conversa. Diferente dos outros modos,
// o texto é escrito PARA O CLIENTE (leigo) — o contador só revisa antes de mandar.
// Retorna JSON com as quatro seções do documento.
async function gerarRelatorioCliente(cliente) {
  const raw = await chatCompletion([
    { role: 'system', content: PERSONA },
    { role: 'user', content:
      `Com base na conversa e no diagnóstico, escreva um RELATÓRIO DE ATENDIMENTO para ENTREGAR AO CLIENTE ` +
      `(pessoa leiga). Linguagem clara, acolhedora e sem jargão — quando um termo técnico for inevitável, ` +
      `explique em uma frase. Não invente valores nem prazos que não estejam na conversa. Fale do caso na ` +
      `terceira pessoa ("o cliente", "sua declaração").\n\n` +
      `Responda APENAS um JSON válido, sem markdown, no formato:\n` +
      `{"titulo":"título curto do atendimento, ex.: Regularização de Malha Fina 2024",` +
      `"problema":"qual era o problema do cliente, 1-2 frases",` +
      `"solucao":"a solução proposta, 1-2 frases",` +
      `"oqueFeito":"o que foi feito, em itens separados por \\n começando com '- '",` +
      `"comoFeito":"como foi feito / próximos passos do cliente, em itens separados por \\n começando com '- '"}\n\n` +
      `Cliente: ${cliente.name} | Tipo: ${cliente.taxType || '-'}\n` +
      `Diagnóstico do contador: ${cliente.diagnosis || '(vazio)'}\n` +
      `Tratamento/prescrição: ${cliente.treatment || '(vazio)'}\n` +
      `Conversa:\n${historyToText(cliente.messages)}`
    }
  ], { temperature: 0.3, maxTokens: 700 });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch (e) {
    return { titulo: '', problema: raw, solucao: '', oqueFeito: '', comoFeito: '' };
  }
}

// Envia uma mensagem multimodal (texto + imagem) ao modelo (visão).
async function chatVision(promptText, imageDataUrl, { maxTokens = 700 } = {}) {
  if (!isConfigured()) {
    const err = new Error('ia_not_configured');
    err.code = 'ia_not_configured';
    throw err;
  }
  const res = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Ola Contador'
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: PERSONA },
        { role: 'user', content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ] }
      ]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || res.statusText;
    const err = new Error(`ia_error: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

const PROMPT_DOC = `Analise este documento fiscal brasileiro (ex.: intimação da Receita, DARF, DAS, extrato, comprovante).
Responda APENAS um JSON válido, sem markdown, no formato:
{"tipo":"tipo do documento","resumo":"o que é e o que exige, em 1-2 linhas","diagnostico":"problema fiscal identificado","dados":"campos-chave extraídos (valores, datas, códigos, competência)"}`;

// pdf-parse v2 usa a classe PDFParse (a API antiga `require('pdf-parse/lib/pdf-parse.js')`
// não existe mais e quebra o require no Node do Vercel).
async function extrairTextoPDF(buffer) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text || '';
}

// Analisa um documento. Imagem -> visão; PDF -> extrai texto e analisa.
async function analisarDocumento(buffer, mime) {
  let raw;
  if (mime && mime.startsWith('image/')) {
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    raw = await chatVision(PROMPT_DOC, dataUrl, { maxTokens: 600 });
  } else if (mime === 'application/pdf') {
    let texto = '';
    try {
      texto = (await extrairTextoPDF(buffer)).slice(0, 8000);
    } catch (e) {
      return { tipo: 'PDF', resumo: 'Não consegui extrair o texto deste PDF automaticamente.', diagnostico: '', dados: '' };
    }
    raw = await chatCompletion([
      { role: 'system', content: PERSONA },
      { role: 'user', content: `${PROMPT_DOC}\n\nConteúdo extraído do PDF:\n${texto}` }
    ], { temperature: 0.2, maxTokens: 600 });
  } else {
    return { tipo: 'Desconhecido', resumo: 'Formato não suportado para leitura automática (envie imagem ou PDF).', diagnostico: '', dados: '' };
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch (e) {
    return { tipo: '', resumo: raw, diagnostico: '', dados: '' };
  }
}

// ============================================================================
// UPLOAD DE SKILLS PDF
// ============================================================================
async function uploadSkillPDF(skillName, base64) {
  if (!skillName || !base64) throw new Error('Faltam parâmetros.');
  const supabaseAdmin = require('@supabase/supabase-js').createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    const e = new Error('OPENAI_API_KEY_MISSING');
    e.code = 'ia_not_configured';
    throw e;
  }

  const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');
  const text = await extrairTextoPDF(buffer);
  if (text.length < 50) throw new Error('PDF sem texto legível.');

  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';
  for (const p of paragraphs) {
    if (currentChunk.length + p.length > 1200 && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += p + '\n\n';
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());

  let successCount = 0;
  for (const chunk of chunks) {
    if (chunk.length < 50) continue;
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: chunk })
    });
    const embData = await embRes.json();
    const embedding = embData.data?.[0]?.embedding;
    if (embedding) {
      await supabaseAdmin.from('skills_embeddings').insert({
        skill_name: skillName, chunk_text: chunk, embedding: embedding
      });
      successCount++;
    }
  }
  return { success: true, chunksProcessed: successCount };
}

module.exports = {
  isConfigured,
  resumirCaso,
  rascunharResposta,
  perguntaLivre,
  sugerirDiagnostico,
  gerarRelatorioCliente,
  analisarDocumento,
  uploadSkillPDF,
  MODEL
};
