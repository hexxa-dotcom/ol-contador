-- Campos que faltavam pra parcelamento vinculado a uma recorrência: qual
-- tributo (IRPF, INSS, ICMS...) e quando o parcelamento começou (o término
-- é derivado de data_inicio + numero_parcelas, não precisa de coluna própria).
alter table parcelamentos_manuais add column if not exists tributo text;
alter table parcelamentos_manuais add column if not exists data_inicio date;
