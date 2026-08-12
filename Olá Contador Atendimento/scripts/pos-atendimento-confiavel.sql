-- Pós-atendimento confiável: relatório com estado de entrega, vínculo com o
-- caso e finalização idempotente. Seguro para executar mais de uma vez.

begin;

alter table public.relatorios add column if not exists caso_ref text;
alter table public.relatorios add column if not exists atendimento_express_id bigint;
alter table public.relatorios add column if not exists agendamento_id bigint;
alter table public.relatorios add column if not exists status text;
alter table public.relatorios add column if not exists versao integer not null default 1;
alter table public.relatorios add column if not exists revisao_de bigint;
alter table public.relatorios add column if not exists pendencias text;
alter table public.relatorios add column if not exists proximos_passos jsonb not null default '[]'::jsonb;
alter table public.relatorios add column if not exists responsavel_proximo_passo text;
alter table public.relatorios add column if not exists prazo_proximo_passo date;
alter table public.relatorios add column if not exists entregas text;
alter table public.relatorios add column if not exists entregue_em timestamptz;
alter table public.relatorios add column if not exists entregue_por text;
alter table public.relatorios add column if not exists canais_entrega jsonb not null default '[]'::jsonb;
alter table public.relatorios add column if not exists entrega_tentativas jsonb not null default '[]'::jsonb;
alter table public.relatorios add column if not exists falha_entrega text;
alter table public.relatorios add column if not exists updated_at timestamptz not null default now();
alter table public.relatorios add column if not exists formato text not null default 'completo';
alter table public.relatorios add column if not exists tipo_relatorio text not null default 'atendimento';
alter table public.relatorios add column if not exists codigo_validacao uuid not null default gen_random_uuid();

-- Documentos antigos já eram visíveis ao cliente e devem continuar entregues.
update public.relatorios
set status = 'entregue',
    entregue_em = coalesce(entregue_em, created_at),
    canais_entrega = case when canais_entrega = '[]'::jsonb then '["area_cliente"]'::jsonb else canais_entrega end
where status is null;

alter table public.relatorios alter column status set default 'rascunho';
alter table public.relatorios alter column status set not null;
alter table public.relatorios drop constraint if exists relatorios_status_check;
alter table public.relatorios add constraint relatorios_status_check check (
  status in ('rascunho', 'gerado', 'entrega_pendente', 'entregue', 'falha_na_entrega', 'arquivado_interno')
);
alter table public.relatorios drop constraint if exists relatorios_formato_check;
alter table public.relatorios add constraint relatorios_formato_check check (
  formato in ('essencial', 'completo')
);
alter table public.relatorios drop constraint if exists relatorios_tipo_relatorio_check;
alter table public.relatorios add constraint relatorios_tipo_relatorio_check check (
  tipo_relatorio in ('atendimento', 'pendencias')
);
create unique index if not exists relatorios_codigo_validacao_uidx
  on public.relatorios(codigo_validacao);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'relatorios_express_fkey') then
    alter table public.relatorios add constraint relatorios_express_fkey
      foreign key (atendimento_express_id) references public.atendimentos_express(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'relatorios_agendamento_fkey') then
    alter table public.relatorios add constraint relatorios_agendamento_fkey
      foreign key (agendamento_id) references public.agendamentos(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'relatorios_revisao_de_fkey') then
    alter table public.relatorios add constraint relatorios_revisao_de_fkey
      foreign key (revisao_de) references public.relatorios(id) on delete set null;
  end if;
end
$$;

create index if not exists relatorios_caso_ref_idx on public.relatorios(caso_ref, versao desc);
create unique index if not exists relatorios_caso_versao_uidx
  on public.relatorios(caso_ref, versao) where caso_ref is not null and status <> 'arquivado_interno';
create index if not exists relatorios_entrega_idx on public.relatorios(status, entregue_em desc);
create index if not exists relatorios_express_idx on public.relatorios(atendimento_express_id);
create index if not exists relatorios_agendamento_idx on public.relatorios(agendamento_id);
create index if not exists relatorios_revisao_de_idx on public.relatorios(revisao_de);

alter table public.atendimentos_historico add column if not exists caso_ref text;
alter table public.atendimentos_historico add column if not exists relatorio_id bigint;
alter table public.atendimentos_historico add column if not exists modalidade text;
alter table public.atendimentos_historico add column if not exists assunto text;
create unique index if not exists atendimentos_historico_caso_ref_uidx
  on public.atendimentos_historico(caso_ref) where caso_ref is not null;
create index if not exists atendimentos_historico_relatorio_idx
  on public.atendimentos_historico(relatorio_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atendimentos_historico_relatorio_fkey') then
    alter table public.atendimentos_historico add constraint atendimentos_historico_relatorio_fkey
      foreign key (relatorio_id) references public.relatorios(id) on delete set null;
  end if;
end
$$;

alter table public.avaliacoes add column if not exists caso_ref text;
create unique index if not exists avaliacoes_caso_ref_uidx
  on public.avaliacoes(caso_ref) where caso_ref is not null;

-- O cliente só enxerga o documento depois da entrega. A equipe continua vendo
-- rascunhos, documentos pendentes e falhas para poder reprocessar.
alter table public.relatorios enable row level security;
do $$
declare politica record;
begin
  for politica in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'relatorios' and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.relatorios', politica.policyname);
  end loop;
end
$$;
drop policy if exists "relatorios_select" on public.relatorios;
drop policy if exists "relatorios leitura" on public.relatorios;
drop policy if exists "relatorios_select_own" on public.relatorios;
drop policy if exists "relatorios_select_staff_cliente" on public.relatorios;
create policy "relatorios_select_staff_cliente"
on public.relatorios for select to authenticated
using (
  (select public.is_staff())
  or (
    cliente_ref = (select public.my_client_id())
    and status = 'entregue'
  )
);

drop policy if exists "relatorios_insert" on public.relatorios;
drop policy if exists "relatorios_insert_staff" on public.relatorios;
create policy "relatorios_insert_staff"
on public.relatorios for insert to authenticated
with check ((select public.is_staff()));

drop policy if exists "relatorios_update" on public.relatorios;
drop policy if exists "relatorios_update_staff" on public.relatorios;
create policy "relatorios_update_staff"
on public.relatorios for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

grant select, insert, update on public.relatorios to authenticated;
grant select, insert, update, delete on public.relatorios to service_role;

-- Finaliza o caso em uma transação. Repetir a chamada para o mesmo relatório
-- não duplica histórico nem altera novamente a data de conclusão.
create or replace function public.finalizar_pos_atendimento(
  p_relatorio_id bigint,
  p_canais jsonb,
  p_entregue_por text,
  p_falhas jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rel public.relatorios%rowtype;
  v_cli public.clientes%rowtype;
  v_ag public.agendamentos%rowtype;
  v_exp public.atendimentos_express%rowtype;
  v_caso_ref text;
  v_finalizado_em timestamptz := now();
  v_inicio timestamptz;
  v_duracao bigint;
begin
  select * into v_rel from public.relatorios where id = p_relatorio_id for update;
  if not found then raise exception 'relatorio_nao_encontrado'; end if;

  if v_rel.status = 'entregue' then
    return jsonb_build_object('ok', true, 'alreadyDelivered', true, 'casoRef', v_rel.caso_ref);
  end if;

  if coalesce(trim(v_rel.titulo), '') = ''
     or coalesce(trim(v_rel.problema), '') = ''
     or coalesce(trim(v_rel.solucao), '') = ''
     or coalesce(trim(v_rel.oque_feito), '') = '' then
    raise exception 'relatorio_incompleto';
  end if;

  if coalesce(trim(v_rel.contador_nome), '') = ''
     or coalesce(trim(v_rel.contador_crc), '') = ''
     or coalesce(trim(v_rel.contador_assinatura), '') = '' then
    raise exception 'assinatura_contador_incompleta';
  end if;

  select * into v_cli from public.clientes where id = v_rel.cliente_ref for update;
  if not found then raise exception 'cliente_nao_encontrado'; end if;

  if v_rel.atendimento_express_id is not null then
    select * into v_exp from public.atendimentos_express where id = v_rel.atendimento_express_id for update;
  elsif v_rel.agendamento_id is not null then
    select * into v_ag from public.agendamentos where id = v_rel.agendamento_id for update;
  end if;

  v_caso_ref := coalesce(
    v_rel.caso_ref,
    case when v_rel.atendimento_express_id is not null then 'express:' || v_rel.atendimento_express_id end,
    case when v_rel.agendamento_id is not null then 'agendamento:' || v_rel.agendamento_id end,
    'cliente:' || v_rel.cliente_ref || ':relatorio:' || v_rel.id
  );

  update public.relatorios set
    caso_ref = v_caso_ref,
    cliente_nome = v_cli.name,
    cliente_cpf = v_cli.cpf,
    status = 'entregue',
    entregue_em = v_finalizado_em,
    entregue_por = p_entregue_por,
    canais_entrega = coalesce(p_canais, '["area_cliente"]'::jsonb),
    falha_entrega = case when jsonb_array_length(coalesce(p_falhas, '[]'::jsonb)) > 0 then p_falhas::text else null end,
    updated_at = v_finalizado_em
  where id = p_relatorio_id;

  update public.clientes set
    status = 'done',
    ultimo_atendimento_finalizado_em = v_finalizado_em,
    notas = null
  where id = v_rel.cliente_ref;

  if v_rel.atendimento_express_id is not null then
    update public.atendimentos_express set
      status = 'concluido', concluido_em = v_finalizado_em, updated_at = v_finalizado_em
    where id = v_rel.atendimento_express_id;
    v_inicio := coalesce(v_exp.iniciado_em, v_exp.contratado_em, v_rel.created_at);
  elsif v_rel.agendamento_id is not null then
    update public.agendamentos set status = 'done' where id = v_rel.agendamento_id;
    v_inicio := coalesce(v_ag.date::text::date + coalesce(v_ag.time, '00:00')::time, v_rel.created_at);
  else
    v_inicio := coalesce(v_cli.created_at, v_rel.created_at);
  end if;

  update public.triagens set status = 'arquivada'
  where cliente_ref = v_rel.cliente_ref and status <> 'arquivada';

  v_duracao := greatest(0, extract(epoch from (v_finalizado_em - v_inicio))::bigint);
  insert into public.atendimentos_historico (
    cliente_id, cliente_nome, tax_type, duracao_segundos, honorarios,
    iniciado_em, finalizado_em, notas, caso_ref, relatorio_id, modalidade, assunto
  ) values (
    v_cli.id, v_cli.name, v_cli.tax_type, v_duracao, coalesce(v_cli.honorarios, 0),
    v_inicio, v_finalizado_em, v_cli.notas, v_caso_ref, v_rel.id,
    case when v_rel.atendimento_express_id is not null then 'sem_agendamento' else 'agendado' end,
    v_rel.titulo
  )
  on conflict (caso_ref) where caso_ref is not null do update set
    relatorio_id = excluded.relatorio_id,
    assunto = excluded.assunto,
    finalizado_em = excluded.finalizado_em;

  return jsonb_build_object('ok', true, 'alreadyDelivered', false, 'casoRef', v_caso_ref, 'entregueEm', v_finalizado_em);
end;
$$;

revoke all on function public.finalizar_pos_atendimento(bigint, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalizar_pos_atendimento(bigint, jsonb, text, jsonb) to service_role;

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'relatorios'
order by ordinal_position;
