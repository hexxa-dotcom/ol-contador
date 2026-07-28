-- Suporte a emissão de nota fiscal de serviço (NFS-e) via Asaas.
-- Pré-requisito FORA deste script: a conta Asaas precisa ter as informações
-- fiscais (inscrição municipal, certificado/credenciais da prefeitura, CNAE)
-- configuradas — via painel Asaas ou POST /v3/fiscalInfo. Sem isso, a emissão
-- automática falha (o erro fica só no log, não trava o pagamento).
-- Idempotente.

-- Endereço do cliente: é o dado do TOMADOR exigido pela prefeitura na nota.
alter table public.clientes add column if not exists cep text;
alter table public.clientes add column if not exists endereco text;
alter table public.clientes add column if not exists numero text;
alter table public.clientes add column if not exists bairro text;

-- Rastreio da nota emitida por cobrança (id e status no Asaas: SCHEDULED,
-- SYNCHRONIZED, AUTHORIZED, CANCELLED, ERROR...).
alter table public.cobrancas add column if not exists nota_fiscal_id text;
alter table public.cobrancas add column if not exists nota_fiscal_status text;

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'clientes'
  and column_name in ('cep','endereco','numero','bairro');

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'cobrancas'
  and column_name in ('nota_fiscal_id','nota_fiscal_status');
