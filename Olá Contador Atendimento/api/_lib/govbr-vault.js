// Cofre temporário de credenciais gov.br.
// A senha nunca é salva em clientes, mensagens, logs ou relatórios. O banco
// recebe somente AES-256-GCM; a equipe pode revelar uma única vez e o conteúdo
// cifrado é apagado logo depois. Toda resposta é marcada como no-store.
const crypto = require('crypto');
const { requireUser, adminClient } = require('./auth');

function chaveDoCofre() {
  const segredo = process.env.GOVBR_VAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error('vault_key_not_configured');
  return crypto.createHash('sha256').update(`ola-contador:govbr-vault:v1:${segredo}`).digest();
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chaveDoCofre(), iv);
  const ciphertext = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64')
  };
}

function decifrar(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', chaveDoCofre(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

async function contextoDeAcesso(auth, clientId) {
  const [{ data: isStaff }, { data: myClientId }] = await Promise.all([
    auth.sb.rpc('is_staff'),
    auth.sb.rpc('my_client_id')
  ]);
  return { isStaff: !!isStaff, isOwner: String(myClientId || '') === String(clientId || '') };
}

async function auditar(admin, clientId, actorId, evento, detalhes) {
  await admin.from('govbr_credenciais_auditoria').insert({
    cliente_id: clientId,
    ator_id: actorId,
    evento,
    detalhes: detalhes || {}
  });
}

function statusPublico(row) {
  if (!row) return { status: 'empty' };
  return {
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewedAt: row.viewed_at || null,
    deletedAt: row.deleted_at || null
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = await requireUser(req, res);
  if (!auth) return;
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'vault_unavailable' });

  const body = req.body || {};
  const action = String(body.action || 'status');
  const clientId = String(body.clientId || '').trim();
  if (!clientId) return res.status(400).json({ error: 'invalid_params' });

  const acesso = await contextoDeAcesso(auth, clientId);
  if (!acesso.isOwner && !acesso.isStaff) return res.status(403).json({ error: 'forbidden' });

  try {
    if (action === 'store') {
      if (!acesso.isOwner) return res.status(403).json({ error: 'only_client_can_store' });
      const password = String(body.password || '');
      const ttlHours = [24, 48, 72].includes(Number(body.ttlHours)) ? Number(body.ttlHours) : 48;
      if (password.length < 8 || password.length > 256) {
        return res.status(400).json({ error: 'invalid_password_length' });
      }
      if (body.authorized !== true) return res.status(400).json({ error: 'authorization_required' });

      const encrypted = cifrar(password);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin.from('govbr_credenciais_cofre').upsert({
        cliente_id: clientId,
        ...encrypted,
        status: 'pending',
        created_at: now.toISOString(),
        expires_at: expiresAt,
        viewed_at: null,
        viewed_by: null,
        deleted_at: null
      }, { onConflict: 'cliente_id' }).select('*').single();
      if (error) throw error;
      await auditar(admin, clientId, auth.user.id, 'stored', { ttlHours });
      return res.json(statusPublico(data));
    }

    const { data: row, error } = await admin.from('govbr_credenciais_cofre')
      .select('*').eq('cliente_id', clientId).maybeSingle();
    if (error) throw error;

    if (row && row.status === 'pending' && new Date(row.expires_at) <= new Date()) {
      await admin.from('govbr_credenciais_cofre').update({
        status: 'expired', ciphertext: null, iv: null, auth_tag: null, deleted_at: new Date().toISOString()
      }).eq('id', row.id).eq('status', 'pending');
      await auditar(admin, clientId, auth.user.id, 'expired');
      row.status = 'expired';
      row.ciphertext = null;
    }

    if (action === 'status') return res.json(statusPublico(row));

    if (action === 'delete') {
      if (!row) return res.json({ status: 'empty' });
      const deletedAt = new Date().toISOString();
      await admin.from('govbr_credenciais_cofre').update({
        status: 'deleted', ciphertext: null, iv: null, auth_tag: null, deleted_at: deletedAt
      }).eq('id', row.id);
      await auditar(admin, clientId, auth.user.id, 'deleted', { actorType: acesso.isStaff ? 'staff' : 'client' });
      return res.json({ status: 'deleted', deletedAt });
    }

    if (action === 'reveal') {
      if (!acesso.isStaff) return res.status(403).json({ error: 'only_staff_can_reveal' });
      if (!row || row.status !== 'pending' || !row.ciphertext) {
        return res.status(409).json({ error: 'credential_not_available', ...statusPublico(row) });
      }

      // Primeiro reivindica a visualização de forma condicional. Se duas telas
      // tentarem abrir juntas, só a primeira muda pending -> viewed.
      const viewedAt = new Date().toISOString();
      const { data: claimed, error: claimError } = await admin.from('govbr_credenciais_cofre')
        .update({ status: 'viewed', viewed_at: viewedAt, viewed_by: auth.user.id })
        .eq('id', row.id).eq('status', 'pending').select('id').maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return res.status(409).json({ error: 'credential_already_viewed' });

      let password;
      try {
        password = decifrar(row);
      } finally {
        await admin.from('govbr_credenciais_cofre').update({
          ciphertext: null, iv: null, auth_tag: null, deleted_at: viewedAt
        }).eq('id', row.id);
      }
      await auditar(admin, clientId, auth.user.id, 'revealed_once');
      return res.json({ status: 'viewed', password, viewedAt });
    }

    return res.status(400).json({ error: 'invalid_action' });
  } catch (error) {
    console.error('[govbr-vault]', error.message);
    return res.status(500).json({ error: error.message === 'vault_key_not_configured' ? 'vault_unavailable' : 'vault_failed' });
  }
};
