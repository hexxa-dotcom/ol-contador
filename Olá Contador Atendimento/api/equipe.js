const { requireUser } = require('./_lib/auth');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const auth = await requireUser(req, res);
  if (!auth) return;

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Verificar se quem está chamando é Admin
  const { data: staffData } = await supabaseAdmin
    .from('staff')
    .select('role')
    .eq('id', auth.user.id)
    .single();
    
  if (!staffData || staffData.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem gerenciar a equipe.' });
  }

  // GET: Listar Equipe
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('staff').select('*').order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // POST: Convidar Membro
  if (req.method === 'POST') {
    const { email, nome, role } = req.body || {};
    if (!email || !nome || !role) return res.status(400).json({ error: 'Faltam parâmetros.' });

    // Enviar convite via Auth do Supabase (cria o usuário e dispara email)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name: nome }
    });

    if (inviteError) {
      // Se o usuário já existe no auth.users (mas não no staff), podemos tentar inseri-lo diretamente
      // Mas o erro de email já cadastrado retorna no inviteError.
      if (inviteError.message.includes('already exists')) {
         // Não dá para pegar o ID facilmente aqui sem buscar. Vamos buscar o usuário por email se possível.
         // Mas como a API de buscar usuário por email exige listUsers(), é mais simples retornar um erro dizendo para o Admin.
         return res.status(400).json({ error: 'Este e-mail já possui uma conta. Peça para a pessoa fazer login.' });
      }
      return res.status(500).json({ error: inviteError.message });
    }

    const userId = inviteData.user.id;

    // Inserir na tabela staff
    const { error: insertError } = await supabaseAdmin.from('staff').insert({
      id: userId,
      email: email,
      nome: nome,
      role: role
    });

    if (insertError) {
      // Se falhar ao inserir no staff, pelo menos o convite foi enviado. Pode gerar inconsistência, mas na prática é raro.
      console.error('Erro ao inserir staff:', insertError.message);
      return res.status(500).json({ error: 'Convite enviado, mas erro ao salvar perfil: ' + insertError.message });
    }

    return res.json({ success: true, message: 'Convite enviado com sucesso!' });
  }

  // DELETE: Remover Membro
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'Falta o ID.' });
    if (id === auth.user.id) return res.status(400).json({ error: 'Você não pode se remover.' });

    // Remove da tabela staff
    const { error: deleteError } = await supabaseAdmin.from('staff').delete().eq('id', id);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    
    // Opcional: Remover do auth.users também? Sim, para revogar o acesso completamente.
    await supabaseAdmin.auth.admin.deleteUser(id);

    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
