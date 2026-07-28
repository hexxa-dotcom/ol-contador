-- Tabela de apoio pro rate limiting dos endpoints públicos (sem login):
-- /api/signup-checkout e /api/resgatar-credito. Cada tentativa grava uma
-- linha; o helper conta quantas linhas existem pra aquela chave (IP + rota)
-- nos últimos N minutos antes de deixar passar.
create table if not exists public.rate_limits (
  id bigint generated always as identity primary key,
  chave text not null,
  criado_em timestamptz not null default now()
);
create index if not exists rate_limits_chave_criado_em_idx on public.rate_limits (chave, criado_em);

-- RLS ligado e sem nenhuma policy: só o service_role (que ignora RLS) grava e
-- lê aqui. Ninguém no navegador, nem autenticado, acessa essa tabela direto.
alter table public.rate_limits enable row level security;

-- Faxina: apaga tentativas com mais de 1 dia, pra tabela não crescer pra
-- sempre. Chamado pelo próprio helper de tempos em tempos (ver api/_lib/
-- rateLimit.js) — não precisa de cron separado.
