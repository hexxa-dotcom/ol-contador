-- Fila operacional dos Atendimentos Express (antigo "sem agendamento").
-- Uma linha por contratação paga, não por cliente: o mesmo cliente pode ter
-- vários serviços Express sem que um sobrescreva o histórico do outro.
-- Seguro para executar novamente.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicos'
      and column_name = 'prazo_express_dias_uteis'
  ) then
    alter table public.servicos
      add column prazo_express_dias_uteis integer not null default 2;

    update public.servicos set prazo_express_dias_uteis = case
      when id = 'pf' then 1
      when id = 'consulta' then 5
      else 2
    end;
  end if;
end
$$;

comment on column public.servicos.prazo_express_dias_uteis is
  'Prazo padrão prometido para a modalidade Atendimento Express.';

create table if not exists public.atendimentos_express (
  id bigserial primary key,
  cobranca_id bigint not null unique references public.cobrancas(id) on delete cascade,
  cliente_ref text not null references public.clientes(id) on delete cascade,
  servico_id text references public.servicos(id) on delete set null,
  assunto text,
  status text not null default 'aguardando_triagem',
  contratado_em timestamptz not null default now(),
  prazo_conclusao_em timestamptz not null,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atendimentos_express_status_check check (
    status in ('aguardando_triagem', 'em_analise', 'em_execucao', 'aguardando_documentos', 'pronto_envio', 'concluido', 'cancelado')
  )
);

-- Atualiza também instalações onde uma versão anterior desta migração já foi
-- executada, sem apagar nenhum atendimento existente.
alter table public.atendimentos_express
  drop constraint if exists atendimentos_express_status_check;
alter table public.atendimentos_express
  add constraint atendimentos_express_status_check check (
    status in ('aguardando_triagem', 'em_analise', 'em_execucao', 'aguardando_documentos', 'pronto_envio', 'concluido', 'cancelado')
  );

create index if not exists atendimentos_express_fila_idx
  on public.atendimentos_express(status, prazo_conclusao_em);
create index if not exists atendimentos_express_cliente_idx
  on public.atendimentos_express(cliente_ref, contratado_em desc);

comment on table public.atendimentos_express is
  'Fila de serviços sem horário marcado. Cada linha representa uma contratação paga.';
comment on column public.atendimentos_express.prazo_conclusao_em is
  'SLA prometido ao cliente, calculado conforme o prazo configurado no serviço.';

grant select, insert, update, delete on public.atendimentos_express to service_role;
grant usage, select on sequence public.atendimentos_express_id_seq to service_role;
grant select, update on public.atendimentos_express to authenticated;

alter table public.atendimentos_express enable row level security;

drop policy if exists "atendimentos_express_select" on public.atendimentos_express;
create policy "atendimentos_express_select"
on public.atendimentos_express for select to authenticated
using ((select public.is_staff()) or cliente_ref = (select public.my_client_id()));

drop policy if exists "atendimentos_express_update_staff" on public.atendimentos_express;
create policy "atendimentos_express_update_staff"
on public.atendimentos_express for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

-- O cliente não recebe permissão genérica de update na fila. Esta função só
-- avança a contratação Express mais antiga dele que ainda aguarda triagem.
create or replace function public.confirmar_triagem_atendimento_express()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente_ref text;
  v_atendimento_id bigint;
begin
  v_cliente_ref := public.my_client_id();
  if v_cliente_ref is null then
    raise exception 'cliente_nao_identificado';
  end if;

  select id into v_atendimento_id
  from public.atendimentos_express
  where cliente_ref = v_cliente_ref and status = 'aguardando_triagem'
  order by contratado_em asc
  limit 1
  for update;

  if v_atendimento_id is not null then
    update public.atendimentos_express
    set status = 'em_analise', updated_at = now()
    where id = v_atendimento_id;
  end if;

  return v_atendimento_id;
end;
$$;

revoke all on function public.confirmar_triagem_atendimento_express() from public;
grant execute on function public.confirmar_triagem_atendimento_express() to authenticated;

-- Recupera contratações Express que já existiam antes desta fila. O cálculo
-- preserva o horário e pula o fim de semana conforme o SLA de cada serviço.
insert into public.atendimentos_express (
  cobranca_id, cliente_ref, servico_id, assunto, status,
  contratado_em, prazo_conclusao_em, concluido_em
)
select
  c.id,
  c.cliente_ref,
  c.servico_id,
  coalesce(c.dados_cliente->>'assunto', s.name, 'Atendimento Express'),
  case when cl.status in ('done', 'locked') then 'concluido'
       when t.status = 'enviada' then 'em_analise'
       else 'aguardando_triagem' end,
  coalesce(c.paid_at, c.created_at, now()),
  coalesce(c.paid_at, c.created_at, now()) + (
    select (n || ' days')::interval
    from generate_series(1, 14) n
    where extract(isodow from coalesce(c.paid_at, c.created_at, now()) + (n || ' days')::interval) between 1 and 5
    order by n
    offset greatest(coalesce(s.prazo_express_dias_uteis, 2) - 1, 0) limit 1
  ),
  case when cl.status in ('done', 'locked')
       then coalesce(cl.ultimo_atendimento_finalizado_em, now()) else null end
from public.cobrancas c
join public.clientes cl on cl.id = c.cliente_ref
left join public.servicos s on s.id = c.servico_id
left join lateral (
  select status from public.triagens
  where cliente_ref = c.cliente_ref and status <> 'arquivada'
  order by created_at desc limit 1
) t on true
where c.status = 'paid' and c.modalidade = 'sem_agendamento'
on conflict (cobranca_id) do nothing;

commit;
