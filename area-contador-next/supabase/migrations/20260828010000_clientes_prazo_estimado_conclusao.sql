-- Previsão de conclusão definida manualmente pelo contador — mostrada pro
-- cliente na linha do tempo do portal. No Atendimento Express já existe um
-- prazo automático (atendimentos_express.prazo_conclusao_em, baseado nos
-- dias úteis do plano); este campo serve pra sobrescrever esse prazo quando
-- o caso for mais demorado, e pra cobrir o atendimento agendado, que não
-- tem prazo automático nenhum.
alter table public.clientes
  add column if not exists prazo_estimado_conclusao date;
