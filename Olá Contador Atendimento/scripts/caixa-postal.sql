-- Caixa Postal: mensagens assíncronas entre contador e cliente, FORA do chat
-- ao vivo (que só abre no horário agendado). Serve pra avisos/comunicados que
-- não cabem esperar a próxima sessão — ex.: "sua guia vence dia 20".
-- Idempotente.

create table if not exists public.caixa_postal (
  id bigint generated always as identity primary key,
  cliente_ref text not null references public.clientes(id) on delete cascade,
  remetente text not null check (remetente in ('contador', 'cliente')),
  assunto text,
  mensagem text not null,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists caixa_postal_cliente_ref_idx on public.caixa_postal(cliente_ref);
create index if not exists caixa_postal_created_at_idx on public.caixa_postal(created_at desc);

alter table public.caixa_postal enable row level security;

-- Uma policy por ação evita sobreposição. O papel fica explícito: nenhuma
-- operação desta tabela é exposta ao anon.
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

-- UPDATE fica limitado também por coluna: cliente só confirma mensagens do
-- contador e não consegue alterar texto, assunto, remetente ou cliente_ref.
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

select count(*) as ok from public.caixa_postal;
