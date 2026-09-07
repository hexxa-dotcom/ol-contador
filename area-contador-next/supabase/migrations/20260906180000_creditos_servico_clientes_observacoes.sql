-- Item 7 (créditos de uso): permite vincular um crédito a um serviço do
-- catálogo pra pré-preencher o valor na criação — nullable, porque o crédito
-- continua podendo ser de valor livre sem vínculo a nenhum serviço.
alter table public.creditos
  add column if not exists servico_id text references public.servicos(id);

-- Item 12 (ficha do cliente): observação rápida na aba Cadastro, separada de
-- `notas` (texto rico e longo da aba Prontuário).
alter table public.clientes
  add column if not exists observacoes text;
