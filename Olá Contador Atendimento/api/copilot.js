// POST /api/copilot { clientId, mode: 'resumo'|'rascunho'|'pergunta'|'diagnostico', prompt? }
// Roda como o usuário logado (RLS). A chave da IA (Groq) fica só aqui no servidor.
const ia = require('./_lib/ia');
const { requireUser, fetchClient } = require('./_lib/auth');
const { validarCpfCnpj } = require('../documento');

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

  // Cadastro manual de cliente (fora do checkout público) e reset de senha de
  // acesso — qualquer membro da equipe pode usar, não só admin (diferente de
  // 'equipe' acima, que é gestão da própria equipe).
  if (mode === 'clientes_acesso') {
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: souStaff } = await supabaseAdmin.from('staff').select('id').eq('id', auth.user.id).maybeSingle();
    if (!souStaff) return res.status(403).json({ error: 'Apenas a equipe pode gerenciar clientes.' });

    if (action === 'criar') {
      const { name, cpfCnpj, email, phone, senha } = payload || {};
      if (!name || !email || !cpfCnpj) return res.status(400).json({ error: 'Faltam nome, e-mail ou CPF/CNPJ.' });
      if (senha && senha.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
      const { valido, digitos } = validarCpfCnpj(cpfCnpj);
      if (!valido) return res.status(400).json({ error: 'CPF/CNPJ inválido.' });

      const { data: existente } = await supabaseAdmin.from('clientes').select('id').eq('id', digitos).maybeSingle();
      if (existente) return res.status(400).json({ error: 'Já existe um cliente com esse CPF/CNPJ.' });

      const { data: novoUser, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
        email, password: senha || undefined, email_confirm: true
      });
      if (erroAuth) {
        if (/already.*registered|already exists/i.test(erroAuth.message)) return res.status(400).json({ error: 'Este e-mail já possui uma conta.' });
        return res.status(500).json({ error: erroAuth.message });
      }

      const { error: erroCliente } = await supabaseAdmin.from('clientes').insert({
        id: digitos, name, cpf: digitos, email, phone: phone || null,
        status: 'pending', user_id: novoUser.user.id
      });
      if (erroCliente) {
        await supabaseAdmin.auth.admin.deleteUser(novoUser.user.id);
        return res.status(500).json({ error: erroCliente.message });
      }
      return res.json({ success: true, clientId: digitos });
    }

    if (action === 'resetar_senha') {
      const { clientId, novaSenha } = payload || {};
      if (!clientId || !novaSenha) return res.status(400).json({ error: 'Faltam parâmetros.' });
      if (novaSenha.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

      const { data: cliente } = await supabaseAdmin.from('clientes').select('id, email, user_id').eq('id', clientId).maybeSingle();
      if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });

      // Clientes antigos podem não ter conta de acesso ainda (só nasce após o
      // primeiro pagamento) — nesse caso criamos a conta agora em vez de falhar.
      if (!cliente.user_id) {
        if (!cliente.email) return res.status(400).json({ error: 'Este cliente não tem e-mail cadastrado.' });
        const { data: novoUser, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
          email: cliente.email, password: novaSenha, email_confirm: true
        });
        if (erroAuth) return res.status(500).json({ error: erroAuth.message });
        const { error: erroUpdate } = await supabaseAdmin.from('clientes').update({ user_id: novoUser.user.id }).eq('id', clientId);
        if (erroUpdate) return res.status(500).json({ error: erroUpdate.message });
        return res.json({ success: true, contaCriada: true });
      }

      const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(cliente.user_id, { password: novaSenha });
      if (erroSenha) return res.status(500).json({ error: erroSenha.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  }

  // Envio de e-mail para o cliente (usado pelo passo "Enviar ou arquivar" do
  // wizard de relatório) — precisa da chave do Resend, que é secreta, então não
  // dá pra mandar direto do navegador como caixa postal/chat.
  if (mode === 'notificar_cliente') {
    const notify = require('./_lib/notify');
    if (!notify.emailConfigured()) return res.status(503).json({ error: 'email_not_configured' });
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: souStaff } = await supabaseAdmin.from('staff').select('id').eq('id', auth.user.id).maybeSingle();
    if (!souStaff) return res.status(403).json({ error: 'Apenas a equipe pode notificar clientes.' });

    const { clientId, subject, message } = payload || {};
    if (!clientId || !subject || !message) return res.status(400).json({ error: 'Faltam parâmetros.' });
    const { data: cliente } = await supabaseAdmin.from('clientes').select('email, name').eq('id', clientId).maybeSingle();
    if (!cliente || !cliente.email) return res.status(400).json({ error: 'Cliente sem e-mail cadastrado.' });
    const html = `<div style="font-family:sans-serif;font-size:14px;color:#111"><p>Olá ${cliente.name || ''},</p><p>${message}</p><p style="color:#888;font-size:12px;margin-top:24px">Olá, Contador — atendimento contábil</p></div>`;
    const resultado = await notify.sendEmail(cliente.email, subject, html);
    if (resultado.error) return res.status(502).json({ error: 'email_falhou', detail: resultado.error });
    return res.json({ success: true });
  }

  if (!ia.isConfigured()) return res.status(503).json({ error: 'ia_not_configured' });

  if (mode === 'skill_upload') {
    // Alimenta a base de conhecimento COMPARTILHADA da IA (todos os
    // atendimentos usam) e gasta chamada paga de embeddings — só a equipe
    // pode fazer isso, senão qualquer cliente logado injetava conteúdo (ou
    // gerava custo) nela.
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: souStaff } = await supabaseAdmin.from('staff').select('id').eq('id', auth.user.id).maybeSingle();
    if (!souStaff) return res.status(403).json({ error: 'Apenas a equipe pode enviar skills.' });
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
