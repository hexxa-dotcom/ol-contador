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

-- 5) is_staff() e my_role() passam a checar por id (auth.uid()) em vez de
--    e-mail — mais robusto (não quebra se o e-mail mudar) e é o que o
--    restante do sistema (RLS de clientes, créditos, etc.) já espera via
--    is_staff(), sem precisar mexer em mais nada porque a função continua
--    retornando boolean do mesmo jeito.
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

-- 6) Conferência rápida — deve mostrar sua linha com id preenchido e role='admin'.
select email, id, nome, role from public.staff;
