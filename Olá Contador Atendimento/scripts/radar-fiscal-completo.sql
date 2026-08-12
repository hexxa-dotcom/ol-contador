-- Correção completa das permissões e do cache do Radar Fiscal.
-- Seguro para executar mais de uma vez no SQL Editor do Supabase.
begin;

alter table public.clientes
  add column if not exists regime_tributario text,
  add column if not exists regime_detectado_em timestamptz,
  add column if not exists caixa_postal_novas boolean default false,
  add column if not exists caixa_postal_checada_em timestamptz;

create table if not exists public.serpro_consultas (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  cliente_ref text references public.clientes(id) on delete set null,
  documento text not null,
  id_sistema text not null,
  id_servico text not null,
  acao text not null,
  sucesso boolean not null,
  erro_codigo text,
  erro_detalhe text,
  disparado_por uuid references auth.users(id) on delete set null,
  origem text not null default 'painel'
);

create table if not exists public.serpro_resultados (
  id bigserial primary key,
  cliente_ref text not null references public.clientes(id) on delete cascade,
  servico text not null,
  resultado jsonb not null,
  obtido_em timestamptz not null default now(),
  expira_em timestamptz,
  unique (cliente_ref, servico)
);

create index if not exists serpro_consultas_cliente_idx on public.serpro_consultas(cliente_ref);
create index if not exists serpro_consultas_criado_idx on public.serpro_consultas(criado_em desc);
create index if not exists serpro_consultas_disparado_por_idx on public.serpro_consultas(disparado_por);
create index if not exists serpro_resultados_cliente_idx on public.serpro_resultados(cliente_ref);

-- O backend usa service_role. Sem estes GRANTs, a Data API devolve 42501 e
-- as consultas pagas não ficam registradas nem reaproveitadas.
grant usage on schema public to authenticated, service_role;
grant select on table public.serpro_consultas, public.serpro_resultados to authenticated;
grant select, insert, update, delete on table public.serpro_consultas, public.serpro_resultados to service_role;
grant usage, select on sequence public.serpro_consultas_id_seq, public.serpro_resultados_id_seq to service_role;

alter table public.serpro_consultas enable row level security;
alter table public.serpro_resultados enable row level security;

drop policy if exists "serpro_consultas_select_staff" on public.serpro_consultas;
create policy "serpro_consultas_select_staff"
on public.serpro_consultas for select to authenticated
using ((select public.is_staff()));

drop policy if exists "serpro_resultados_select" on public.serpro_resultados;
create policy "serpro_resultados_select"
on public.serpro_resultados for select to authenticated
using ((select public.is_staff()) or cliente_ref = (select public.my_client_id()));

insert into public.configuracoes (chave, valor) values
  ('radar_fiscal_config', '{"portalAtivo":true,"caixaPostalAutomatica":true,"caixaPostalIntervaloDias":7,"parcelamentosValidadeDias":0,"clientePodeEmitirDas":true}'::jsonb),
  ('radar_fiscal_clientes', '{}'::jsonb)
on conflict (chave) do nothing;

commit;
