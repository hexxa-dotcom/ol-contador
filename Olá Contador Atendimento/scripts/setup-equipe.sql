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

-- Garantir acesso ao is_staff e my_role
create or replace function public.is_staff()
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from public.staff where id = auth.uid()
  );
$$;

create or replace function public.my_role()
returns text
language sql security definer
as $$
  select role from public.staff where id = auth.uid();
$$;
