-- Restaura as colunas status/encerrado_em da Caixa Postal que o código já
-- usa (setCaixaPostalThreadStatus, portal.ts, views.tsx) mas nunca existiram
-- em produção — descoberto ao regenerar database.types.ts durante o trabalho
-- de WhatsApp em 2026-08-21.
alter table public.caixa_postal
  add column if not exists status text not null default 'aberto',
  add column if not exists encerrado_em timestamptz;
