-- Criação da tabela de equipe (caso ainda não exista)
create table if not exists public.staff (
  id uuid primary key references auth.users(id),
  email text not null,
  nome text,
  role text default 'parceiro', -- 'admin' ou 'parceiro'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Se a tabela já existia e não tinha as colunas de nome e role, vamos adicioná-las com segurança
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name='staff' and column_name='role') then
    alter table public.staff add column role text default 'parceiro';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='staff' and column_name='nome') then
    alter table public.staff add column nome text;
  end if;
end $$;

-- Atualizar o(s) dono(s) atual(is) para Admin, caso a tabela já estivesse populada com o dono
update public.staff set role = 'admin' where role is null or role = 'parceiro' and email = (select email from auth.users order by created_at asc limit 1);

alter table public.staff enable row level security;

-- Políticas de RLS
create policy "Apenas admin pode ler toda a equipe" on public.staff for select using (
  (select role from public.staff where id = auth.uid()) = 'admin'
  or
  id = auth.uid()
);

-- Garantir acesso seguro ao is_staff e my_role. A implementação privilegiada
-- fica fora do schema exposto; public contém apenas wrappers SECURITY INVOKER.
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
