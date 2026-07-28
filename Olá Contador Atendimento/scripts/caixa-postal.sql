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

-- Staff (contador/equipe) vê e escreve em qualquer caixa.
drop policy if exists "staff_ve_caixa_postal" on public.caixa_postal;
create policy "staff_ve_caixa_postal" on public.caixa_postal for select using (public.is_staff());

drop policy if exists "staff_envia_caixa_postal" on public.caixa_postal;
create policy "staff_envia_caixa_postal" on public.caixa_postal for insert with check (public.is_staff());

drop policy if exists "staff_atualiza_caixa_postal" on public.caixa_postal;
create policy "staff_atualiza_caixa_postal" on public.caixa_postal for update using (public.is_staff());

-- Cliente só vê/escreve na própria caixa (cliente_ref -> clientes.user_id = auth.uid()).
drop policy if exists "cliente_ve_sua_caixa_postal" on public.caixa_postal;
create policy "cliente_ve_sua_caixa_postal" on public.caixa_postal for select using (
  cliente_ref in (select id from public.clientes where user_id = auth.uid())
);

drop policy if exists "cliente_envia_caixa_postal" on public.caixa_postal;
create policy "cliente_envia_caixa_postal" on public.caixa_postal for insert with check (
  remetente = 'cliente' and cliente_ref in (select id from public.clientes where user_id = auth.uid())
);

drop policy if exists "cliente_marca_lida_caixa_postal" on public.caixa_postal;
create policy "cliente_marca_lida_caixa_postal" on public.caixa_postal for update using (
  cliente_ref in (select id from public.clientes where user_id = auth.uid())
) with check (
  cliente_ref in (select id from public.clientes where user_id = auth.uid())
);

select count(*) as ok from public.caixa_postal;
