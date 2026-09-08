-- Acompanhamento manual de parcelamento fiscal (PGFN, Receita Federal,
-- prefeitura etc.) para PF e PJ. Independente do Radar Fiscal (que só
-- consulta parcelamento via SERPRO/Integra Contador, e só cobre CNPJ do
-- Simples Nacional/MEI) — este é um controle manual da equipe, sem
-- integração externa.
create table if not exists parcelamentos_manuais (
  id bigserial primary key,
  cliente_ref text not null references clientes(id) on delete cascade,
  orgao text not null,
  descricao text,
  valor_total_cents integer not null default 0,
  numero_parcelas integer not null default 1,
  parcelas_pagas integer not null default 0,
  valor_parcela_cents integer not null default 0,
  dia_vencimento integer,
  status text not null default 'ativo',
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table parcelamentos_manuais enable row level security;

create policy "staff_full_access" on parcelamentos_manuais
  for all using (is_staff()) with check (is_staff());

grant select, insert, update, delete on parcelamentos_manuais to service_role;
grant usage, select on sequence parcelamentos_manuais_id_seq to service_role;
