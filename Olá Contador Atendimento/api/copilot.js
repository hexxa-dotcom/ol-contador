// POST /api/copilot { clientId, mode: 'resumo'|'rascunho'|'pergunta'|'diagnostico', prompt? }
// Roda como o usuário logado (RLS). A chave da IA (Groq) fica só aqui no servidor.
const ia = require('./_lib/ia');
const { requireUser, fetchClient } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;

  const { clientId, mode, prompt, skill, skillName, base64, action, payload } = req.body || {};
  if (!mode) return res.status(400).json({ error: 'invalid_params' });

  if (mode === 'equipe') {
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: staffData } = await supabaseAdmin.from('staff').select('role').eq('id', auth.user.id).single();
    if (!staffData || staffData.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem gerenciar a equipe.' });

    if (action === 'listar') {
      const { data, error } = await supabaseAdmin.from('staff').select('*').order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
    
    if (action === 'convidar') {
      const { email, nome, role } = payload || {};
      if (!email || !nome || !role) return res.status(400).json({ error: 'Faltam parâmetros.' });
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { name: nome } });
      if (inviteError) {
        if (inviteError.message.includes('already exists')) return res.status(400).json({ error: 'Este e-mail já possui uma conta.' });
        return res.status(500).json({ error: inviteError.message });
      }
      const { error: insertError } = await supabaseAdmin.from('staff').insert({ id: inviteData.user.id, email, nome, role });
      if (insertError) return res.status(500).json({ error: insertError.message });
      return res.json({ success: true, message: 'Convite enviado com sucesso!' });
    }

    if (action === 'remover') {
      const { id } = payload || {};
      if (!id) return res.status(400).json({ error: 'Falta o ID.' });
      if (id === auth.user.id) return res.status(400).json({ error: 'Você não pode se remover.' });
      const { error: deleteError } = await supabaseAdmin.from('staff').delete().eq('id', id);
      if (deleteError) return res.status(500).json({ error: deleteError.message });
      await supabaseAdmin.auth.admin.deleteUser(id);
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Ação inválida.' });
  }

  if (!ia.isConfigured()) return res.status(503).json({ error: 'ia_not_configured' });

  if (mode === 'skill_upload') {
    return res.json(await ia.uploadSkillPDF(skillName, base64));
  }

  if (!clientId) return res.status(400).json({ error: 'invalid_params' });
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
