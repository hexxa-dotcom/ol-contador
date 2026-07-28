-- Anotações ricas do atendimento (negrito, lista numerada, cor de destaque) e
-- registro de início de cada atendimento finalizado (para a timeline do
-- histórico por cliente). Idempotente.

-- Anotações do atendimento EM ABERTO (rascunho vivo enquanto o caso do
-- cliente está ativo). Guarda HTML simples (só <b>, <ol>/<li>, <span style=
-- color>) produzido pelo editor do prontuário.
alter table public.clientes add column if not exists notas text;

-- Ao finalizar o atendimento, as notas migram pra cá (arquivo permanente) e
-- clientes.notas volta a ficar vazio para o próximo caso do mesmo cliente.
alter table public.atendimentos_historico add column if not exists notas text;

-- Início do atendimento (hoje só guardávamos finalizado_em + duração). Sem
-- isso não dá pra mostrar "iniciado às 10:00, encerrado às 11:30" na timeline.
alter table public.atendimentos_historico add column if not exists iniciado_em timestamptz;

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'clientes' and column_name = 'notas';

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'atendimentos_historico'
  and column_name in ('notas', 'iniciado_em');
