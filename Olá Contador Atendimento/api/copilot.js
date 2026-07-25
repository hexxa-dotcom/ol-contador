// POST /api/copilot { clientId, mode: 'resumo'|'rascunho'|'pergunta'|'diagnostico', prompt? }
// Roda como o usuário logado (RLS). A chave da IA (Groq) fica só aqui no servidor.
const ia = require('./_lib/ia');
const { requireUser, fetchClient } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const { clientId, mode, prompt, skill } = req.body || {};
  if (!clientId || !mode) return res.status(400).json({ error: 'invalid_params' });
  if (!ia.isConfigured()) return res.status(503).json({ error: 'ia_not_configured' });

  const cliente = await fetchClient(auth.sb, clientId);
  if (!cliente) return res.status(404).json({ error: 'client_not_found' });

  try {
    if (mode === 'resumo') return res.json({ text: await ia.resumirCaso(cliente) });
    if (mode === 'rascunho') return res.json({ text: await ia.rascunharResposta(cliente, prompt, auth.sb) });
    if (mode === 'pergunta') return res.json({ text: await ia.perguntaLivre(cliente, prompt || '', skill, auth.sb) });
    if (mode === 'diagnostico') return res.json(await ia.sugerirDiagnostico(cliente));
    if (mode === 'relatorio') return res.json(await ia.gerarRelatorioCliente(cliente));
    return res.status(400).json({ error: 'invalid_mode' });
  } catch (e) {
    if (e.code === 'ia_not_configured') return res.status(503).json({ error: 'ia_not_configured' });
    console.error('copilot error:', e.message);
    return res.status(502).json({ error: 'ia_error', detail: e.message });
  }
};
