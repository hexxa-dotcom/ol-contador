-- Leads da categoria "Demais Empresas" — avaliação gratuita, sem passar pelo
-- checkout pago. Cliente preenche o formulário público, cai aqui, e o
-- contador responde manualmente (WhatsApp/e-mail) e depois gera um crédito
-- de pagamento (Financeiro → Gerar crédito) se fechar o serviço.
create table if not exists public.leads_empresariais (
  id bigint generated always as identity primary key,
  nome text not null,
  email text,
  telefone text,
  empresa text,
  servico_slug text,
  mensagem text,
  status text not null default 'novo',
  created_at timestamptz not null default now(),
  respondido_em timestamptz
);

grant select, insert, update, delete on public.leads_empresariais to service_role;
grant usage, select on sequence public.leads_empresariais_id_seq to service_role;
