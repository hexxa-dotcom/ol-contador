// POST /api/documentos/:id/analisar — lê o documento com IA e salva a extração.
// Roda como o usuário (RLS). Bucket é público, então o download usa a URL pública.
const ia = require('../../_lib/ia');
const { requireUser } = require('../../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!ia.isConfigured()) return res.status(503).json({ error: 'ia_not_configured' });

  const id = parseInt(req.query.id, 10);
  const { data: doc } = await auth.sb.from('documentos').select('*').eq('id', id).single();
  if (!doc) return res.status(404).json({ error: 'doc_not_found' });

  try {
    const dl = await auth.sb.storage.from('documentos').download(doc.storage_path);
    if (dl.error) throw dl.error;
    const buffer = Buffer.from(await dl.data.arrayBuffer());

    const extracted = await ia.analisarDocumento(buffer, doc.mime);
    await auth.sb.from('documentos').update({ ai_extracted: extracted }).eq('id', id);

    return res.json({ id: doc.id, fileName: doc.file_name, mime: doc.mime, url: doc.public_url, ai: extracted });
  } catch (e) {
    if (e.code === 'ia_not_configured') return res.status(503).json({ error: 'ia_not_configured' });
    console.error('analisar error:', e.message);
    return res.status(502).json({ error: 'ia_error', detail: e.message });
  }
};
