-- Permite que cada membro autenticado leia o próprio cadastro.
-- Administradores continuam vendo a equipe inteira.
-- As demais tabelas usam is_staff() e mantêm suas políticas específicas.

alter table public.staff enable row level security;

drop policy if exists "Apenas admin pode ler toda a equipe" on public.staff;
create policy "Admin le equipe e membro le proprio cadastro"
on public.staff
for select
to authenticated
using (
  (select public.my_role()) = 'admin'
  or id = (select auth.uid())
);

-- A tela de perfil pode atualizar somente os dois campos de exibição do
-- próprio membro. role, email e id continuam sem UPDATE para authenticated.
revoke update on public.staff from authenticated;
grant update (name, nome) on public.staff to authenticated;

drop policy if exists "Membro atualiza o proprio nome" on public.staff;
create policy "Membro atualiza o proprio nome"
on public.staff
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Staff já é autenticado por is_staff(); uploaded_by é metadado e pode ser
-- 'contador', 'agent' ou o UUID legado. Cliente continua obrigado a usar
-- uploaded_by='client' e a própria pasta/cliente_ref.
drop policy if exists "documentos_insert" on public.documentos;
create policy "documentos_insert"
on public.documentos
for insert
to authenticated
with check (
  (select public.is_staff())
  or (
    cliente_ref = (select public.my_client_id())
    and uploaded_by = 'client'
  )
);
