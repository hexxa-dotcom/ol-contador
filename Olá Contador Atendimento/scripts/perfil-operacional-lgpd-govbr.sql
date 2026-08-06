-- Perfil operacional do cliente: prontidão para serviços gov.br e preferências
-- de comunicação. Nunca armazena senha, código de autenticação ou resposta de
-- recuperação. O JSON permite evoluir o checklist sem criar uma coluna para
-- cada nova orientação.

alter table public.clientes
  add column if not exists perfil_operacional jsonb not null default '{}'::jsonb;

comment on column public.clientes.perfil_operacional is
  'Preferências de comunicação, situação declarada da conta gov.br e registro de ciência LGPD. Proibido armazenar credenciais.';

-- Impede que uma gravação acidental transforme o campo em lista/string.
alter table public.clientes
  drop constraint if exists clientes_perfil_operacional_objeto_check;

alter table public.clientes
  add constraint clientes_perfil_operacional_objeto_check
  check (jsonb_typeof(perfil_operacional) = 'object');

-- Cofre separado do cadastro. Somente funções server-side com service_role
-- conseguem ler; não existe política para anon/authenticated.
create table if not exists public.govbr_credenciais_cofre (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null unique references public.clientes(id) on delete cascade,
  ciphertext text,
  iv text,
  auth_tag text,
  status text not null default 'pending'
    check (status in ('pending', 'viewed', 'deleted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  viewed_at timestamptz,
  viewed_by uuid,
  deleted_at timestamptz
);

create table if not exists public.govbr_credenciais_auditoria (
  id bigint generated always as identity primary key,
  cliente_id text not null references public.clientes(id) on delete cascade,
  ator_id uuid,
  evento text not null check (evento in ('stored', 'revealed_once', 'deleted', 'expired')),
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.govbr_credenciais_cofre enable row level security;
alter table public.govbr_credenciais_auditoria enable row level security;

revoke all on table public.govbr_credenciais_cofre from anon, authenticated;
revoke all on table public.govbr_credenciais_auditoria from anon, authenticated;
revoke all on sequence public.govbr_credenciais_auditoria_id_seq from anon, authenticated;

-- A função server-side usa exclusivamente a role de serviço. O GRANT é
-- explícito porque tabelas criadas pelo SQL Editor podem não herdar as
-- permissões padrão do schema.
grant select, insert, update, delete
  on table public.govbr_credenciais_cofre to service_role;

grant select, insert, update, delete
  on table public.govbr_credenciais_auditoria to service_role;

grant usage, select
  on sequence public.govbr_credenciais_auditoria_id_seq to service_role;

create index if not exists govbr_credenciais_cofre_expira_idx
  on public.govbr_credenciais_cofre (status, expires_at);

create index if not exists govbr_credenciais_auditoria_cliente_idx
  on public.govbr_credenciais_auditoria (cliente_id, created_at desc);
