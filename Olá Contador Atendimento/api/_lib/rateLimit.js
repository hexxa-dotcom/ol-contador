// Rate limiting simples pra endpoints públicos (sem login), usando a própria
// tabela do Supabase como armazenamento — sem precisar de Redis ou outro
// serviço novo. Cada tentativa grava uma linha em rate_limits; se já tiver
// `max` ou mais linhas pra essa chave dentro da janela, bloqueia.
// Não é perfeito (uma corrida rara entre duas requisições simultâneas pode
// deixar passar uma a mais), mas é o suficiente pra travar automação básica
// contra formulário público — o que hoje não existia nenhum.

function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconhecido';
}

// rota: nome curto do endpoint (ex. 'signup-checkout'). max: tentativas
// permitidas dentro de janelaMin minutos.
async function checarRateLimit(admin, req, rota, max = 8, janelaMin = 15) {
  const chave = `${rota}:${ipDe(req)}`;
  const desde = new Date(Date.now() - janelaMin * 60 * 1000).toISOString();

  const { count } = await admin.from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('chave', chave).gte('criado_em', desde);

  if ((count || 0) >= max) return false;

  await admin.from('rate_limits').insert({ chave });

  // Faxina oportunista (1 em ~50 chamadas): apaga tentativas com mais de 1
  // dia, sem precisar de um cron dedicado só pra isso.
  if (Math.random() < 0.02) {
    const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    admin.from('rate_limits').delete().lt('criado_em', umDiaAtras).then(() => {}).catch(() => {});
  }

  return true;
}

module.exports = { checarRateLimit, ipDe };
