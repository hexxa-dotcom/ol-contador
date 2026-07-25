// Helpers compartilhados pelas funções serverless.
// As funções de IA rodam COMO O USUÁRIO (token do navegador + chave anon), então o
// RLS do banco é quem autoriza a leitura — sem precisar de chave service_role.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;

function tokenFrom(req) {
  return (req.headers.authorization || '').replace(/^Bearer /i, '').trim();
}

// Cliente Supabase que herda a identidade do usuário (RLS aplicado).
function userClient(req) {
  const token = tokenFrom(req);
  return createClient(URL, ANON, {
    global: { headers: token ? { Authorization: 'Bearer ' + token } : {} },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Cliente admin (service_role) — só para operações sem usuário (webhook/cron) ou
// escrita cross-cliente. Retorna null se a chave não estiver configurada.
function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(URL, key, { auth: { persistSession: false } });
}

// Garante que há um usuário logado; retorna { sb, user } ou responde 401.
async function requireUser(req, res) {
  const token = tokenFrom(req);
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return null; }
  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) { res.status(401).json({ error: 'unauthorized' }); return null; }
  return { sb, user: data.user };
}

function mapMessage(r) {
  return { id: r.id, sender: r.sender, text: r.text, time: r.time, type: r.type,
    docName: r.doc_name || undefined, duration: r.duration || undefined, diagnosis: r.diagnosis || undefined };
}
function mapClient(r, msgs) {
  return { id: r.id, name: r.name, avatar: r.avatar, taxType: r.tax_type, cpf: r.cpf,
    status: r.status, scheduledTime: r.scheduled_time, diagnosis: r.diagnosis,
    honorarios: r.honorarios, treatment: r.treatment, evidences: r.evidences || [],
    checklist: r.checklist || {}, email: r.email || null, phone: r.phone || null,
    messages: (msgs || []).map(mapMessage) };
}

// Reconstrói o cliente (RLS decide se o usuário pode vê-lo).
async function fetchClient(sb, clientId) {
  const { data: c } = await sb.from('clientes').select('*').eq('id', clientId).single();
  if (!c) return null;
  const { data: msgs } = await sb.from('mensagens').select('*').eq('cliente_id', clientId).order('seq', { ascending: true });
  return mapClient(c, msgs);
}

module.exports = { tokenFrom, userClient, adminClient, requireUser, fetchClient, mapClient, mapMessage };
