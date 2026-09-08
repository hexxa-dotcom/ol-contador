-- Rastreia quais parcelas já foram avisadas ao cliente (WhatsApp/e-mail),
-- pra não repetir sem querer e pra UI mostrar "Avisado" por parcela.
alter table parcelamentos_manuais add column if not exists avisos_enviados integer[] not null default '{}';
