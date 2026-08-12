-- Anexos vinculados ao relatório e trilha comercial auditável.
-- Seguro para executar mais de uma vez.

begin;

create table if not exists public.relatorio_anexos (
  id bigint generated always as identity primary key,
  relatorio_id bigint not null references public.relatorios(id) on delete cascade,
  cliente_ref text not null references public.clientes(id) on delete cascade,
  caso_ref text,
  documento_id bigint references public.documentos(id) on delete set null,
  tipo text not null default 'arquivo'
    check (tipo in ('arquivo', 'guia', 'protocolo', 'comprovante', 'link', 'outro')),
  titulo text not null,
  descricao text,
  referencia text,
  url text check (url is null or url ~* '^https?://'),
  visivel_cliente boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists relatorio_anexos_relatorio_idx
  on public.relatorio_anexos(relatorio_id, created_at);
create index if not exists relatorio_anexos_caso_idx
  on public.relatorio_anexos(caso_ref, created_at);
create index if not exists relatorio_anexos_cliente_idx
  on public.relatorio_anexos(cliente_ref);
create index if not exists relatorio_anexos_documento_idx
  on public.relatorio_anexos(documento_id) where documento_id is not null;

alter table public.relatorio_anexos enable row level security;
grant select, insert, update, delete on public.relatorio_anexos to authenticated;
grant usage, select on sequence public.relatorio_anexos_id_seq to authenticated;
grant select, insert, update, delete on public.relatorio_anexos to service_role;
grant usage, select on sequence public.relatorio_anexos_id_seq to service_role;

drop policy if exists "relatorio_anexos_select" on public.relatorio_anexos;
create policy "relatorio_anexos_select"
on public.relatorio_anexos for select to authenticated
using (
  (select public.is_staff())
  or (
    visivel_cliente
    and cliente_ref = (select public.my_client_id())
    and exists (
      select 1 from public.relatorios r
      where r.id = relatorio_id and r.status = 'entregue'
    )
  )
);

drop policy if exists "relatorio_anexos_insert_staff" on public.relatorio_anexos;
create policy "relatorio_anexos_insert_staff"
on public.relatorio_anexos for insert to authenticated
with check ((select public.is_staff()));

drop policy if exists "relatorio_anexos_update_staff" on public.relatorio_anexos;
create policy "relatorio_anexos_update_staff"
on public.relatorio_anexos for update to authenticated
using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists "relatorio_anexos_delete_staff" on public.relatorio_anexos;
create policy "relatorio_anexos_delete_staff"
on public.relatorio_anexos for delete to authenticated
using ((select public.is_staff()));

alter table public.cobrancas add column if not exists valor_original_cents integer;
alter table public.cobrancas add column if not exists desconto_cents integer not null default 0;
alter table public.cobrancas add column if not exists desconto_tipo text;
alter table public.cobrancas add column if not exists origem text not null default 'plataforma';

alter table public.cobrancas drop constraint if exists cobrancas_desconto_valido;
alter table public.cobrancas add constraint cobrancas_desconto_valido check (
  valor_original_cents is null or (
    valor_original_cents >= 0 and desconto_cents >= 0
    and desconto_cents <= valor_original_cents
    and valor_cents = valor_original_cents - desconto_cents
  )
);

update public.cobrancas
set valor_original_cents = coalesce(valor_original_cents, valor_cents),
    desconto_cents = coalesce(desconto_cents, 0)
where valor_original_cents is null;

alter table public.creditos add column if not exists expira_em timestamptz;
alter table public.creditos add column if not exists cancelado_em timestamptz;
alter table public.creditos add column if not exists cancelado_por text;

create table if not exists public.assinaturas_historico (
  id bigint generated always as identity primary key,
  cliente_ref text not null references public.clientes(id) on delete cascade,
  asaas_subscription_id text,
  tipo text,
  valor_cents integer not null,
  dia_vencimento integer,
  status text not null check (status in ('ativa', 'cancelada', 'falha')),
  motivo text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists assinaturas_historico_cliente_idx
  on public.assinaturas_historico(cliente_ref, created_at desc);
alter table public.assinaturas_historico enable row level security;
grant select, insert on public.assinaturas_historico to authenticated;
grant usage, select on sequence public.assinaturas_historico_id_seq to authenticated;
grant select, insert, update, delete on public.assinaturas_historico to service_role;
grant usage, select on sequence public.assinaturas_historico_id_seq to service_role;

drop policy if exists "assinaturas_historico_select" on public.assinaturas_historico;
create policy "assinaturas_historico_select"
on public.assinaturas_historico for select to authenticated
using ((select public.is_staff()) or cliente_ref = (select public.my_client_id()));
drop policy if exists "assinaturas_historico_insert_staff" on public.assinaturas_historico;
create policy "assinaturas_historico_insert_staff"
on public.assinaturas_historico for insert to authenticated
with check ((select public.is_staff()));

create table if not exists public.funil_eventos (
  id bigint generated always as identity primary key,
  evento text not null check (evento in (
    'precos_visualizados', 'agendamento_iniciado', 'checkout_iniciado',
    'cobranca_criada', 'pagamento_confirmado', 'credito_resgatado',
    'assinatura_ativada', 'assinatura_cancelada', 'relatorio_entregue',
    'pagamento_cancelado', 'pagamento_estornado', 'pagamento_em_disputa'
  )),
  sessao_ref uuid,
  cliente_ref text,
  cobranca_id bigint references public.cobrancas(id) on delete set null,
  servico_id text references public.servicos(id) on delete set null,
  origem text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists funil_eventos_evento_data_idx
  on public.funil_eventos(evento, created_at desc);
create index if not exists funil_eventos_servico_idx
  on public.funil_eventos(servico_id) where servico_id is not null;
create unique index if not exists funil_eventos_cobranca_evento_uidx
  on public.funil_eventos(cobranca_id, evento) where cobranca_id is not null;
create unique index if not exists funil_eventos_sessao_evento_uidx
  on public.funil_eventos(sessao_ref, evento) where sessao_ref is not null;

alter table public.funil_eventos enable row level security;
revoke all on public.funil_eventos from anon, authenticated;
revoke all on sequence public.funil_eventos_id_seq from anon, authenticated;
grant select, insert, update, delete on public.funil_eventos to service_role;
grant usage, select on sequence public.funil_eventos_id_seq to service_role;
drop policy if exists "funil_eventos_service_only" on public.funil_eventos;
create policy "funil_eventos_service_only" on public.funil_eventos
for all to service_role using (true) with check (true);

commit;
