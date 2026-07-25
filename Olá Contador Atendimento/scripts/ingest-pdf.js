require('dotenv').config();
const fs = require('fs');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data[0].embedding;
}

// Quebra o texto em chunks de tamanho aproximado, respeitando quebras de parágrafo
function chunkText(text, maxChars = 1000) {
  const chunks = [];
  let currentChunk = '';
  // Divide por parágrafos para não quebrar no meio de uma frase
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const p of paragraphs) {
    if (currentChunk.length + p.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += p + '\n\n';
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

async function ingestPdf(filePath, skillName) {
  if (!OPENAI_API_KEY) {
    console.error('Erro: OPENAI_API_KEY não definida no .env');
    process.exit(1);
  }

  console.log(`Lendo PDF: ${filePath}...`);
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;
  
  console.log(`Extraídos ${text.length} caracteres. Quebrando em chunks...`);
  const chunks = chunkText(text, 1200);
  console.log(`Criados ${chunks.length} chunks. Gerando embeddings e salvando...`);

  let count = 0;
  for (const chunk of chunks) {
    if (chunk.length < 50) continue; // ignora chunks muito curtos (ruído)
    try {
      const embedding = await generateEmbedding(chunk);
      const { error } = await supabase.from('skills_embeddings').insert({
        skill_name: skillName,
        chunk_text: chunk,
        embedding: embedding
      });
      if (error) {
        console.error('Erro ao salvar chunk no Supabase:', error);
      } else {
        count++;
        process.stdout.write(`\rSalvos: ${count}/${chunks.length}`);
      }
    } catch (e) {
      console.error('\nErro na API da OpenAI:', e.message);
    }
  }
  console.log('\nIngestão finalizada com sucesso!');
}

const file = process.argv[2];
const skill = process.argv[3];

if (!file || !skill) {
  console.log('Uso: node ingest-pdf.js <caminho_do_pdf> <nome_da_skill>');
  console.log('Exemplo: node ingest-pdf.js simples_nacional.pdf SimplesNacional');
  process.exit(1);
}

ingestPdf(file, skill);
