-- Migração corrigida da equipe (contadores convidados).
-- Rode isso no SQL Editor do Supabase (projeto vosuzicovnyvvtzvpqdz).
-- É seguro rodar mais de uma vez (idempotente).

-- 1) Adiciona as colunas que faltam na tabela staff existente (hoje só tem
--    email, name, created_at).
alter table public.staff add column if not exists id uuid references auth.users(id);
alter table public.staff add column if not exists nome text;
alter table public.staff add column if not exists role text default 'parceiro';

-- 2) Preenche id (casando por e-mail com auth.users) e nome (copiando de
--    "name", que já existia) pros registros que já existem.
update public.staff s
set id = u.id
from auth.users u
where s.id is null and lower(u.email) = lower(s.email);

update public.staff set nome = name where nome is null;

-- 3) Você é o dono da conta — garante que fica como admin mesmo se a linha já
--    existisse com role padrão 'parceiro'.
update public.staff set role = 'admin' where lower(email) = lower('filipeheck7@gmail.com');

-- 4) RLS na própria tabela staff: admin vê todo mundo, cada um vê a própria
--    linha. (Remove a policy antiga antes, se existir, pra não duplicar.)
alter table public.staff enable row level security;
drop policy if exists "Apenas admin pode ler toda a equipe" on public.staff;
create policy "Apenas admin pode ler toda a equipe" on public.staff for select using (
  (select role from public.staff where id = auth.uid()) = 'admin'
  or id = auth.uid()
);

-- 5) Helpers privilegiados ficam fora do schema exposto. Os wrappers públicos
--    preservam os RPCs e policies existentes sem expor SECURITY DEFINER.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff where id = (select auth.uid())
  );
$$;

create or replace function private.my_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select role from public.staff where id = (select auth.uid()) limit 1;
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.my_role() from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.my_role() to authenticated;

create or replace function public.is_staff()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select private.is_staff(); $$;

create or replace function public.my_role()
returns text
language sql stable security invoker
set search_path = ''
as $$ select private.my_role(); $$;

revoke all on function public.is_staff() from public, anon;
revoke all on function public.my_role() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_role() to authenticated;

-- 6) Conferência rápida — deve mostrar sua linha com id preenchido e role='admin'.
select email, id, nome, role from public.staff;
