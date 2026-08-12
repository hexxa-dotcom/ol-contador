-- Observabilidade, menor privilégio, retenção LGPD e proteção de uploads.
-- Seguro para executar mais de uma vez.
begin;

create table if not exists public.app_erros (
  id bigint generated always as identity primary key,
  origem text not null,
  codigo text,
  mensagem text not null,
  rota text,
  severidade text not null default 'erro' check (severidade in ('aviso','erro','critico')),
  fingerprint text not null,
  contexto jsonb not null default '{}'::jsonb,
  ocorrencias integer not null default 1,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid
);
create index if not exists app_erros_abertos_idx on public.app_erros(ultimo_em desc) where resolvido_em is null;
create unique index if not exists app_erros_fingerprint_aberto_uidx on public.app_erros(fingerprint) where resolvido_em is null;
alter table public.app_erros enable row level security;
revoke all on public.app_erros from anon, authenticated;
revoke all on sequence public.app_erros_id_seq from anon, authenticated;
grant select, insert, update, delete on public.app_erros to service_role;
grant usage, select on sequence public.app_erros_id_seq to service_role;
drop policy if exists "app_erros_service_only" on public.app_erros;
create policy "app_erros_service_only" on public.app_erros for all to service_role using (true) with check (true);

-- Só um subconjunto explicitamente público das configurações chega ao cliente.
alter table public.configuracoes add column if not exists visivel_cliente boolean not null default false;
update public.configuracoes set visivel_cliente = chave in (
  'perfil_contador','contador_perfil','triagem_assuntos','triagem_regras','agenda_disponibilidade','agenda_dias_bloqueados'
);
drop policy if exists "configuracoes_select" on public.configuracoes;
create policy "configuracoes_select" on public.configuracoes for select to authenticated
using ((select public.is_staff()) or visivel_cliente);

-- Um cliente só pode falar como cliente. Mensagens de contador/sistema exigem staff.
drop policy if exists "mensagens_insert" on public.mensagens;
create policy "mensagens_insert" on public.mensagens for insert to authenticated
with check (
  ((select public.is_staff()) and sender in ('agent','system'))
  or (cliente_id = (select public.my_client_id()) and sender = 'client')
);

-- Metadados de documentos também não podem afirmar que o cliente é a equipe.
drop policy if exists "documentos_insert" on public.documentos;
create policy "documentos_insert" on public.documentos for insert to authenticated
with check (
  ((select public.is_staff()) and uploaded_by in ('agent','contador'))
  or (cliente_ref = (select public.my_client_id()) and uploaded_by = 'client')
);

-- O cliente edita somente a própria triagem e apenas nos estados de entrada.
drop policy if exists "triagens_update" on public.triagens;
create policy "triagens_update" on public.triagens for update to authenticated
using ((select public.is_staff()) or cliente_ref = (select public.my_client_id()))
with check ((select public.is_staff()) or (
  cliente_ref = (select public.my_client_id()) and status in ('rascunho','enviada')
));

-- Remove privilégios de administração de estrutura herdados por padrão.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Defesa adicional no Storage, mesmo para chamadas que ignorem o JavaScript.
update storage.buckets set
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/png','image/jpeg']::text[]
where id = 'documentos';

-- Minimização retroativa: a auditoria do SERPRO não precisa guardar CPF/CNPJ inteiro.
update public.serpro_consultas
set documento = case
  when length(regexp_replace(documento, '\D', '', 'g')) = 14 then 'CNPJ-***' || right(regexp_replace(documento, '\D', '', 'g'), 4)
  when length(regexp_replace(documento, '\D', '', 'g')) = 11 then 'CPF-***' || right(regexp_replace(documento, '\D', '', 'g'), 4)
  else 'DOC-***' || right(regexp_replace(documento, '\D', '', 'g'), 4)
end
where documento !~ '^(CPF|CNPJ|DOC)-\*\*\*';

insert into public.configuracoes(chave,valor,visivel_cliente) values
('retencao_dados', '{"errosDias":90,"rateLimitsDias":2,"webhooksDias":180,"serproAuditoriaDias":365,"serproCacheExpiradoDias":30}'::jsonb, false)
on conflict (chave) do update set visivel_cliente = false;

commit;
