-- Hardening consolidado do Supabase em 2026-07-29.
-- Aplicado no projeto de produção e mantido aqui como fonte reproduzível.
-- Seguro para reexecução: policies são recriadas e constraints/publicações
-- são conferidas antes de adicionar.

begin;

-- Funções SECURITY DEFINER ficam fora do schema exposto pela Data API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff where id = (select auth.uid())
  );
$$;

create or replace function private.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.staff
  where id = (select auth.uid())
  limit 1;
$$;

create or replace function private.my_client_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.clientes
  where user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.my_role() from public, anon;
revoke all on function private.my_client_id() from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.my_role() to authenticated;
grant execute on function private.my_client_id() to authenticated;

-- Wrappers preservam os RPCs usados pelo app sem expor SECURITY DEFINER.
create or replace function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_staff(); $$;

create or replace function public.my_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.my_role(); $$;

create or replace function public.my_client_id()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.my_client_id(); $$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.my_role() from public, anon;
revoke all on function public.my_client_id() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_client_id() to authenticated;

-- Confirmação de leitura continua compatível com a versão publicada, mas a
-- função privilegiada deixa de ficar exposta diretamente em public.
create or replace function private.marcar_lidas(p_cliente_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.is_staff();
  v_meu text := private.my_client_id();
  v_qtd integer;
begin
  if not (v_staff or p_cliente_id = v_meu) then
    raise exception 'sem permissão para esta conversa';
  end if;

  update public.mensagens
     set read_at = now()
   where cliente_id = p_cliente_id
     and read_at is null
     and sender = any (
       case when v_staff then array['client'] else array['agent','system'] end
     );

  get diagnostics v_qtd = row_count;
  return v_qtd;
end
$$;

revoke all on function private.marcar_lidas(text) from public, anon;
grant execute on function private.marcar_lidas(text) to authenticated;

create or replace function public.marcar_lidas(p_cliente_id text)
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.marcar_lidas(p_cliente_id); $$;

revoke all on function public.marcar_lidas(text) from public, anon;
grant execute on function public.marcar_lidas(text) to authenticated;

-- Função de trigger nunca precisa ser executável pela Data API.
create or replace function public.link_cliente_to_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clientes
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end
$$;
revoke all on function public.link_cliente_to_user()
  from public, anon, authenticated;

-- Policies que dependem de identidade passam a declarar o papel correto.
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where 'public' = any(roles)
      and (
        coalesce(qual, '') ilike '%is_staff%'
        or coalesce(qual, '') ilike '%my_client_id%'
        or coalesce(qual, '') ilike '%auth.uid%'
        or coalesce(with_check, '') ilike '%is_staff%'
        or coalesce(with_check, '') ilike '%my_client_id%'
        or coalesce(with_check, '') ilike '%auth.uid%'
      )
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      pol.policyname, pol.schemaname, pol.tablename
    );
  end loop;
end
$$;

drop policy if exists "Apenas admin pode ler toda a equipe" on public.staff;
create policy "Apenas admin pode ler toda a equipe"
on public.staff for select
to authenticated
using (
  (select public.my_role()) = 'admin'
  or id = (select auth.uid())
);

-- Caixa Postal: cliente só opera a própria caixa e não pode se passar pelo
-- contador; equipe opera qualquer caixa.
drop policy if exists "staff_ve_caixa_postal" on public.caixa_postal;
drop policy if exists "staff_envia_caixa_postal" on public.caixa_postal;
drop policy if exists "staff_atualiza_caixa_postal" on public.caixa_postal;
drop policy if exists "cliente_ve_sua_caixa_postal" on public.caixa_postal;
drop policy if exists "cliente_envia_caixa_postal" on public.caixa_postal;
drop policy if exists "cliente_marca_lida_caixa_postal" on public.caixa_postal;
drop policy if exists "caixa_postal_select" on public.caixa_postal;
drop policy if exists "caixa_postal_insert" on public.caixa_postal;
drop policy if exists "caixa_postal_update_lida" on public.caixa_postal;

create policy "caixa_postal_select"
on public.caixa_postal for select
to authenticated
using (
  (select public.is_staff())
  or cliente_ref = (select public.my_client_id())
);

create policy "caixa_postal_insert"
on public.caixa_postal for insert
to authenticated
with check (
  ((select public.is_staff()) and remetente = 'contador')
  or (
    cliente_ref = (select public.my_client_id())
    and remetente = 'cliente'
  )
);

create policy "caixa_postal_update_lida"
on public.caixa_postal for update
to authenticated
using (
  (select public.is_staff())
  or (
    cliente_ref = (select public.my_client_id())
    and remetente = 'contador'
  )
)
with check (
  (select public.is_staff())
  or (
    cliente_ref = (select public.my_client_id())
    and remetente = 'contador'
  )
);

revoke all on table public.caixa_postal from anon, authenticated;
grant select, insert on table public.caixa_postal to authenticated;
grant update (lida) on table public.caixa_postal to authenticated;
grant usage, select on sequence public.caixa_postal_id_seq to authenticated;

-- Remove policies permissivas sobrepostas.
drop policy if exists "guias_mensais_staff_all" on public.guias_mensais;
drop policy if exists "guias_mensais_cliente_select" on public.guias_mensais;
drop policy if exists "guias_mensais_select" on public.guias_mensais;
drop policy if exists "guias_mensais_insert_staff" on public.guias_mensais;
drop policy if exists "guias_mensais_update_staff" on public.guias_mensais;
drop policy if exists "guias_mensais_delete_staff" on public.guias_mensais;

create policy "guias_mensais_select"
on public.guias_mensais for select to authenticated
using (
  (select public.is_staff())
  or cliente_ref = (select public.my_client_id())
);
create policy "guias_mensais_insert_staff"
on public.guias_mensais for insert to authenticated
with check ((select public.is_staff()));
create policy "guias_mensais_update_staff"
on public.guias_mensais for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));
create policy "guias_mensais_delete_staff"
on public.guias_mensais for delete to authenticated
using ((select public.is_staff()));

drop policy if exists "servicos_staff_write" on public.servicos;
drop policy if exists "servicos_select" on public.servicos;
drop policy if exists "servicos_insert_staff" on public.servicos;
drop policy if exists "servicos_update_staff" on public.servicos;
drop policy if exists "servicos_delete_staff" on public.servicos;

create policy "servicos_select"
on public.servicos for select to authenticated using (true);
create policy "servicos_insert_staff"
on public.servicos for insert to authenticated
with check ((select public.is_staff()));
create policy "servicos_update_staff"
on public.servicos for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));
create policy "servicos_delete_staff"
on public.servicos for delete to authenticated
using ((select public.is_staff()));

-- Storage privado por pasta do cliente.
drop policy if exists "documentos select proprio ou staff" on storage.objects;
drop policy if exists "documentos insert proprio ou staff" on storage.objects;
drop policy if exists "documentos delete somente staff" on storage.objects;

create policy "documentos select proprio ou staff"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and (
    (select public.is_staff())
    or (storage.foldername(name))[1] = (select public.my_client_id())
  )
);
create policy "documentos insert proprio ou staff"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos'
  and (
    (select public.is_staff())
    or (storage.foldername(name))[1] = (select public.my_client_id())
  )
);
create policy "documentos delete somente staff"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documentos'
  and (select public.is_staff())
);

-- Rate limit é exclusivamente server-side.
revoke all on table public.rate_limits from anon, authenticated;

-- Preserva o agendamento antigo, mas remove a referência inválida antes da FK.
update public.agendamentos a
set cliente_ref = null
where cliente_ref is not null
  and not exists (
    select 1 from public.clientes c where c.id = a.cliente_ref
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agendamentos_cliente_ref_fkey'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos
      add constraint agendamentos_cliente_ref_fkey
      foreign key (cliente_ref)
      references public.clientes(id)
      on delete set null;
  end if;
end
$$;

create index if not exists agendamentos_cliente_ref_idx
  on public.agendamentos(cliente_ref);
create index if not exists avaliacoes_relatorio_id_idx
  on public.avaliacoes(relatorio_id);
create index if not exists creditos_cliente_ref_idx
  on public.creditos(cliente_ref);
create index if not exists creditos_cobranca_id_idx
  on public.creditos(cobranca_id);
create unique index if not exists staff_id_uidx
  on public.staff(id);

-- O frontend já assina clientes; faltava publicar a tabela.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'clientes'
  ) then
    alter publication supabase_realtime add table public.clientes;
  end if;
end
$$;

-- Novos objetos passam a exigir grants explícitos.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences
  from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

commit;
