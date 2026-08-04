// Configuração pública do front. A chave publishable NÃO é segredo — quem protege
// os dados é o RLS do Supabase (cada usuário só enxerga o que a política permite).
window.OC_CONFIG = {
  SUPABASE_URL: 'https://vosuzicovnyvvtzvpqdz.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_CUQGA9sJ6EzSIA_adBSe9A_G5u-cJQ2',

  // Teste temporário do PORTAL DO CLIENTE sem login. Não cria sessão, não contém
  // credenciais e usa apenas dados demonstrativos guardados no próprio projeto.
  // Antes de abrir para clientes reais, defina enabled como false.
  TESTE_CLIENTE_SEM_LOGIN: {
    enabled: false,
    clientId: 'ana-silva'
  },

  // Teste temporário do PAINEL DO CONTADOR sem login. Usa dados demonstrativos
  // locais/em memória para validar interface e fluxo enquanto a autenticação
  // real fica para a etapa final.
  TESTE_CONTADOR_SEM_LOGIN: {
    enabled: false
  },

  // Compatibilidade com versões antigas. A permissão real agora é individual
  // por cliente e fica em Configurações → Radar Fiscal no painel do contador.
  RADAR_FISCAL_CLIENTE: {
    enabled: true
  }
};

// Qual papel esta página representa. O login.html usa o ?role= da URL; as demais,
// o próprio nome do arquivo.
window.OC_ROLE = (function () {
  const porUrl = new URLSearchParams(location.search).get('role');
  if (porUrl === 'cliente' || porUrl === 'contador') return porUrl;
  // Normaliza antes de comparar: minúsculas, sem barra no fim e sem .html.
  // Assim /contador, /contador/, /Contador e /contador.html caem no mesmo papel.
  // Antes, uma simples barra no fim fazia o papel virar 'geral' — e como não
  // existe conta de teste para 'geral', o login automático nem tentava e a
  // pessoa era mandada para a tela de login sem entender por quê.
  const p = location.pathname.toLowerCase().replace(/\/+$/, '').replace(/\.html$/, '');
  if (p.endsWith('/cliente')) return 'cliente';
  if (p.endsWith('/contador')) return 'contador';
  return 'geral';
})();

// Cada papel guarda a sessão numa chave própria do localStorage. O supabase-js
// sincroniza a sessão entre abas da mesma origem que usam a MESMA storageKey —
// então com uma chave única, abrir /contador numa aba e /cliente em outra (o
// jeito natural de testar os dois lados do chat) fazia o login de uma aba
// substituir silenciosamente a sessão da outra. Foi por isso que o bloqueio de
// chat "só funcionava no meu lado": a aba do cliente ficava autenticada como o
// contador (ou com uma sessão morta), then my_client_id() não resolvia mais
// para aquele cliente e o Realtime nunca entregava a mudança de status pra ela.
// Um papel real só usa a própria página, então isolar por papel não tem custo.
window.sb = window.supabase.createClient(
  window.OC_CONFIG.SUPABASE_URL,
  window.OC_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'oc-auth-' + window.OC_ROLE
    }
  }
);
