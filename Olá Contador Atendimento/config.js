// Configuração pública do front. A chave publishable NÃO é segredo — quem protege
// os dados é o RLS do Supabase (cada usuário só enxerga o que a política permite).
window.OC_CONFIG = {
  SUPABASE_URL: 'https://vosuzicovnyvvtzvpqdz.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_CUQGA9sJ6EzSIA_adBSe9A_G5u-cJQ2',

  // Teste temporário do PORTAL DO CLIENTE sem login. Não cria sessão, não contém
  // credenciais e usa apenas dados demonstrativos guardados no próprio projeto.
  // Antes de abrir para clientes reais, defina enabled como false.
  TESTE_CLIENTE_SEM_LOGIN: {
    enabled: true,
    clientId: 'ana-silva'
  },

  // Teste temporário do PAINEL DO CONTADOR sem login. Usa dados demonstrativos
  // locais/em memória para validar interface e fluxo enquanto a autenticação
  // real fica para a etapa final.
  TESTE_CONTADOR_SEM_LOGIN: {
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

// No modo dev cada papel guarda a sessão numa chave própria, senão abrir o painel
// do cliente numa aba derruba a sessão do contador na outra (mesma origem, mesmo
// localStorage) — e não dá para testar os dois lados do chat ao mesmo tempo.
// Em produção é uma chave só: a pessoa entra uma vez no /login e o painel dela
// acha a sessão. Uma pessoa real é de um papel só.
window.sb = window.supabase.createClient(
  window.OC_CONFIG.SUPABASE_URL,
  window.OC_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'oc-auth'
    }
  }
);
