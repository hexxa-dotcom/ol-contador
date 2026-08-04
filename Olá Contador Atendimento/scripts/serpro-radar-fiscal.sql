-- Radar Fiscal sob demanda (Integra Contador / Serpro)
-- Rodar no SQL Editor do Supabase. Seguro para reexecução.
--
-- Contexto: o Integra Contador cobra POR REQUISIÇÃO. Estas tabelas existem
-- para (a) não repetir uma consulta que já foi paga, (b) saber exatamente
-- quanto foi consumido e por quem, e (c) guardar o regime do contribuinte
-- para não precisar descobrir de novo a cada consulta de parcelamento.

begin;

-- ---------------------------------------------------------------------------
-- 1. Regime tributário do cliente
-- Define QUAL sistema de parcelamento chamar (PARCMEI x PARCSN). Descoberto
-- uma única vez via CCMEI/CCMEISITCADASTRAL123 e guardado para sempre —
-- sem isso, toda consulta de parcelamento custaria o dobro (tentar os dois).
-- ---------------------------------------------------------------------------
alter table public.clientes
  add column if not exists regime_tributario text,
  add column if not exists regime_detectado_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_regime_tributario_check'
  ) then
    alter table public.clientes
      add constraint clientes_regime_tributario_check
      check (regime_tributario is null or regime_tributario in ('mei', 'simples', 'outro'));
  end if;
end
$$;

-- Estado da caixa postal: o indicador semanal (barato) grava aqui, e a lista
-- completa (cara) só é buscada quando este campo acusa novidade.
alter table public.clientes
  add column if not exists caixa_postal_novas boolean default false,
  add column if not exists caixa_postal_checada_em timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Log de consumo — uma linha por requisição PAGA ao Serpro
-- É a única forma de saber o custo real antes da fatura chegar. Gravado
-- inclusive quando a chamada falha (requisição recusada também é chamada
-- feita, e erro repetido é dinheiro repetido).
-- ---------------------------------------------------------------------------
create table if not exists public.serpro_consultas (
  id           bigserial primary key,
  criado_em    timestamptz not null default now(),
  cliente_ref  text references public.clientes(id) on delete set null,
  documento    text not null,
  id_sistema   text not null,
  id_servico   text not null,
  acao         text not null,
  sucesso      boolean not null,
  erro_codigo  text,
  erro_detalhe text,
  -- Quem disparou. Nulo quando foi o cron (varredura automática).
  disparado_por uuid references auth.users(id) on delete set null,
  origem       text not null default 'painel'  -- 'painel' | 'cron'
);

create index if not exists serpro_consultas_cliente_idx on public.serpro_consultas(cliente_ref);
create index if not exists serpro_consultas_criado_idx  on public.serpro_consultas(criado_em desc);

-- Projetos Supabase recentes não expõem automaticamente tabelas novas para a
-- Data API. RLS e GRANT são camadas separadas: sem estes privilégios até o
-- backend com service_role recebe 42501 antes de avaliar qualquer policy.
grant select on table public.serpro_consultas to authenticated;
grant select, insert, update, delete on table public.serpro_consultas to service_role;
grant usage, select on sequence public.serpro_consultas_id_seq to service_role;

-- Só a equipe enxerga o consumo; ninguém escreve pelo navegador (quem grava
-- é o backend com service_role, que ignora RLS).
alter table public.serpro_consultas enable row level security;

drop policy if exists "serpro_consultas_select_staff" on public.serpro_consultas;
create policy "serpro_consultas_select_staff"
on public.serpro_consultas for select
to authenticated
using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- 3. Cache de resultados
-- Guarda a última resposta de cada serviço por cliente, para reabrir a tela
-- sem pagar de novo. `expira_em` deixa explícito até quando o dado é
-- confiável — situação fiscal de ontem não é situação fiscal de hoje.
-- ---------------------------------------------------------------------------
create table if not exists public.serpro_resultados (
  id          bigserial primary key,
  cliente_ref text not null references public.clientes(id) on delete cascade,
  servico     text not null,           -- 'caixa-postal' | 'sitfis' | 'parcelamentos'
  resultado   jsonb not null,
  obtido_em   timestamptz not null default now(),
  expira_em   timestamptz,
  unique (cliente_ref, servico)
);

create index if not exists serpro_resultados_cliente_idx on public.serpro_resultados(cliente_ref);

grant select on table public.serpro_resultados to authenticated;
grant select, insert, update, delete on table public.serpro_resultados to service_role;
grant usage, select on sequence public.serpro_resultados_id_seq to service_role;

alter table public.serpro_resultados enable row level security;

-- A equipe lê tudo; o cliente lê só o resultado do próprio cadastro (é ele
-- quem assina o Radar). Escrita é exclusivamente server-side.
drop policy if exists "serpro_resultados_select" on public.serpro_resultados;
create policy "serpro_resultados_select"
on public.serpro_resultados for select
to authenticated
using (
  (select public.is_staff())
  or cliente_ref = (select public.my_client_id())
);

-- Regras editáveis em Configurações → Radar Fiscal. Parcelamentos com 0 dias
-- ficam salvos até atualização manual; a Caixa Postal é monitorada semanalmente.
insert into public.configuracoes (chave, valor) values
  ('radar_fiscal_config', '{"portalAtivo":true,"caixaPostalAutomatica":true,"caixaPostalIntervaloDias":7,"parcelamentosValidadeDias":0,"clientePodeEmitirDas":true}'::jsonb),
  ('radar_fiscal_clientes', '{}'::jsonb)
on conflict (chave) do nothing;

commit;
