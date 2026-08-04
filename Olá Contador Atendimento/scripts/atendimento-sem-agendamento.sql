-- Atendimento sem agendamento
--
-- A modalidade fica no cliente como o atendimento atual em andamento e na
-- cobranca como registro historico da contratacao. Assim o fluxo novo pode
-- reaproveitar triagem, documentos, dossie e Kanban sem criar um chat ou um
-- horario ficticio na agenda.

begin;

alter table public.clientes
  add column if not exists atendimento_modalidade text not null default 'agendado',
  add column if not exists canal_resultado text not null default 'email',
  add column if not exists sem_agendamento_recebido_em timestamptz;

alter table public.cobrancas
  add column if not exists modalidade text not null default 'agendado',
  add column if not exists canal_resultado text not null default 'email';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_atendimento_modalidade_check'
      and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes add constraint clientes_atendimento_modalidade_check
      check (atendimento_modalidade in ('agendado', 'sem_agendamento'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_canal_resultado_check'
      and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes add constraint clientes_canal_resultado_check
      check (canal_resultado in ('email', 'whatsapp'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cobrancas_modalidade_check'
      and conrelid = 'public.cobrancas'::regclass
  ) then
    alter table public.cobrancas add constraint cobrancas_modalidade_check
      check (modalidade in ('agendado', 'sem_agendamento'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cobrancas_canal_resultado_check'
      and conrelid = 'public.cobrancas'::regclass
  ) then
    alter table public.cobrancas add constraint cobrancas_canal_resultado_check
      check (canal_resultado in ('email', 'whatsapp'));
  end if;
end
$$;

comment on column public.clientes.atendimento_modalidade is
  'Modalidade do caso atual: agendado ou sem_agendamento.';
comment on column public.clientes.canal_resultado is
  'Canal escolhido para avisos e entrega do resultado do caso atual.';
comment on column public.clientes.sem_agendamento_recebido_em is
  'Instante em que o atendimento sem agendamento pago entrou na fila.';
comment on column public.cobrancas.modalidade is
  'Modalidade contratada nesta cobranca.';
comment on column public.cobrancas.canal_resultado is
  'Canal de comunicacao escolhido nesta contratacao.';

create index if not exists clientes_atendimento_modalidade_idx
  on public.clientes(atendimento_modalidade, status);
create index if not exists cobrancas_modalidade_idx
  on public.cobrancas(modalidade, status, created_at desc);

commit;
