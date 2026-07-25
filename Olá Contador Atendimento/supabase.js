// Cliente Supabase compartilhado pelo servidor.
// Usa a chave publishable (anon); o acesso é liberado pelas políticas de RLS
// (hoje permissivas — serão restringidas por cliente quando o login for definido).
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('[supabase] SUPABASE_URL / SUPABASE_ANON_KEY ausentes no .env');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

module.exports = { supabase };
