// POST /api/skills/upload
// Roda no Vercel (Serverless). Quebra o PDF, chama OpenAI e joga pro Supabase.
const { requireUser } = require('../_lib/auth');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  // Usa role de admin para inserir os vetores (já que o RLS protege insert de anônimos e usuários normais não têm permissão para inserir em skills_embeddings sem auth especial, mas como estamos no backend podemos usar o service_role)
  const supabaseAdmin = require('@supabase/supabase-js').createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI não configurada no servidor.' });
  }

  const { skillName, base64 } = req.body || {};
  if (!skillName || !base64) return res.status(400).json({ error: 'Faltam parâmetros (skillName ou base64).' });

  try {
    // 1. Decodifica o PDF e extrai o texto
    const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');
    const parsed = await pdfParse(buffer);
    const text = parsed.text || '';
    if (text.length < 50) return res.status(400).json({ error: 'PDF sem texto legível ou imagem pura.' });

    // 2. Quebra o texto
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

    // 3. Processa e salva
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
          skill_name: skillName,
          chunk_text: chunk,
          embedding: embedding
        });
        successCount++;
      }
    }

    return res.json({ success: true, chunksProcessed: successCount });
  } catch (e) {
    console.error('Erro no upload de skill:', e.message);
    return res.status(500).json({ error: 'Erro interno.', detail: e.message });
  }
};
