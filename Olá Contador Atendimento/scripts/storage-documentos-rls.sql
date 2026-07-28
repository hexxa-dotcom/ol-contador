-- Corrige o alerta do Supabase Advisor: "Clients can list all files in this
-- bucket" — existe hoje uma política de SELECT ampla em storage.objects para
-- o bucket "documentos" que deixa qualquer cliente autenticado LISTAR todos os
-- arquivos (não só os dele).
--
-- O upload em oc-data.js (uploadDocumento) salva cada arquivo em
-- "<clientId>/<timestamp>_<nome>" — ou seja, já existe uma "pasta" por
-- cliente dentro do bucket. Isso troca a política ampla por uma que só deixa:
--   - a equipe (is_staff()) ver/gerenciar tudo;
--   - cada cliente ver/enviar só dentro da própria pasta (a dele mesmo).
--
-- Não mexe no público/privado do bucket em si (isso é outra decisão, já
-- listada à parte no PENDENCIAS-MVP.md) — só fecha a listagem indevida via
-- storage.objects, que era exatamente o que o advisor apontou.

-- 1) Remove qualquer política antiga em storage.objects que mencione o bucket
--    "documentos" (nome pode variar; isso pega qualquer uma pelo texto da
--    condição, então funciona mesmo sem saber o nome exato dado no painel).
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (qual ilike '%documentos%' or with_check ilike '%documentos%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- 2) Políticas novas, restritas por pasta (equivalente ao cliente_ref usado
--    no resto do banco) + acesso total pra equipe.
create policy "documentos select proprio ou staff"
on storage.objects for select
using (
  bucket_id = 'documentos'
  and (
    public.is_staff()
    or (storage.foldername(name))[1] = public.my_client_id()::text
  )
);

create policy "documentos insert proprio ou staff"
on storage.objects for insert
with check (
  bucket_id = 'documentos'
  and (
    public.is_staff()
    or (storage.foldername(name))[1] = public.my_client_id()::text
  )
);

-- Apagar documento fica só com a equipe (cliente nunca precisou disso no
-- fluxo atual — ele só envia e visualiza).
create policy "documentos delete somente staff"
on storage.objects for delete
using (
  bucket_id = 'documentos' and public.is_staff()
);

-- 3) Conferência rápida — deve listar as 3 políticas acima e nenhuma antiga.
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and qual ilike '%documentos%'
   or with_check ilike '%documentos%';
