-- Módulo de Instagram (DM + comentário→DM), separado do chat interno e do
-- WhatsApp: não exige cliente_id (quem manda DM não precisa ser cliente
-- cadastrado ainda), vínculo com clientes é manual e opcional.
-- Idempotência dos eventos de webhook (DM e comentário) reaproveita a tabela
-- webhook_eventos já existente (provedor = 'instagram'), não cria tabela nova
-- pra isso.

create table if not exists public.instagram_conversas (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null unique,
  ig_username text,
  cliente_id text references public.clientes(id) on delete set null,
  ultima_mensagem_em timestamptz not null default now(),
  nao_lida boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists instagram_conversas_cliente_id_idx
  on public.instagram_conversas (cliente_id);

create table if not exists public.instagram_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.instagram_conversas(id) on delete cascade,
  sender text not null check (sender in ('lead', 'contador')),
  texto text not null,
  ig_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists instagram_mensagens_conversa_id_idx
  on public.instagram_mensagens (conversa_id, created_at);

create unique index if not exists instagram_mensagens_ig_message_id_key
  on public.instagram_mensagens (ig_message_id)
  where ig_message_id is not null;

create table if not exists public.instagram_campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  post_id text,
  palavras_chave text[] not null default '{}',
  resposta_dm text not null,
  link_destino text,
  resposta_publica_ativa boolean not null default false,
  resposta_publica_texto text,
  ativa boolean not null default true,
  -- Além de disparar por comentário (comportamento original), também
  -- dispara quando a palavra-chave chega numa DM direta ou numa resposta
  -- de Story (a Meta entrega resposta de Story como DM comum) — "responde
  -- LINK nesse Story e recebe automaticamente".
  dispara_por_dm boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.instagram_campanhas
  add column if not exists dispara_por_dm boolean not null default false;

-- Tabelas criadas via SQL Editor não herdam privilégio automático pro
-- service_role (diferente das criadas pela CLI/dashboard Table Editor) —
-- sem isso, o app inteiro recebe "permission denied" (42501) ao tentar ler
-- ou escrever. Módulo é 100% server-side (webhook, cron, futuras rotas de
-- API), nunca acessado direto pelo navegador — só service_role precisa.
grant select, insert, update, delete on public.instagram_conversas to service_role;
grant select, insert, update, delete on public.instagram_mensagens to service_role;
grant select, insert, update, delete on public.instagram_campanhas to service_role;
