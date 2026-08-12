-- Operação confiável do Atendimento Express e idempotência dos webhooks.
-- Seguro para executar mais de uma vez.

begin;

alter table public.atendimentos_express
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;
alter table public.atendimentos_express
  add column if not exists responsavel_nome text;
alter table public.atendimentos_express
  add column if not exists alerta_sla_em timestamptz;

create index if not exists atendimentos_express_responsavel_idx
  on public.atendimentos_express(responsavel_id, status, prazo_conclusao_em);

create table if not exists public.webhook_eventos (
  id bigint generated always as identity primary key,
  provedor text not null,
  evento_id text not null,
  tipo text,
  recurso_id text,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed', 'ignored')),
  erro text,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  unique (provedor, evento_id)
);

alter table public.webhook_eventos enable row level security;
revoke all on table public.webhook_eventos from anon, authenticated;
revoke all on sequence public.webhook_eventos_id_seq from anon, authenticated;
grant select, insert, update, delete on table public.webhook_eventos to service_role;
grant usage, select on sequence public.webhook_eventos_id_seq to service_role;

create index if not exists webhook_eventos_recurso_idx
  on public.webhook_eventos(provedor, recurso_id, recebido_em desc);

alter table public.agendamentos
  add column if not exists cobranca_id bigint references public.cobrancas(id) on delete set null;
update public.agendamentos a set cobranca_id = c.id
from public.cobrancas c where c.appointment_id = a.id and a.cobranca_id is null;
create unique index if not exists agendamentos_cobranca_uidx
  on public.agendamentos(cobranca_id);

alter table public.triagens
  add column if not exists cobranca_id bigint references public.cobrancas(id) on delete set null;
create unique index if not exists triagens_cobranca_uidx
  on public.triagens(cobranca_id);

commit;
