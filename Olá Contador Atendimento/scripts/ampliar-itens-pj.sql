-- Amplia a lista "O que está acontecendo?" do plano Pessoa Jurídica, que hoje
-- só cobria MEI (mei-pendencia, dasn, desenquadramento do MEI), inconsistente
-- com o texto de precos.html que já promete atender qualquer porte de empresa
-- (MEI, Simples Nacional, Ltda). Idempotente.

update public.servicos set itens = '[
  {"id":"guias-atrasadas","titulo":"Tenho guias ou impostos atrasados","resumo":"DAS, DARF ou outra guia da empresa em aberto"},
  {"id":"declaracao-anual","titulo":"Não entreguei a declaração anual (DASN/DEFIS)","resumo":"Declaração anual da empresa em atraso"},
  {"id":"abertura-regularizacao","titulo":"Preciso abrir ou regularizar o CNPJ","resumo":"Abertura, alteração ou regularização de empresa"},
  {"id":"simples","titulo":"Tenho dúvidas do Simples Nacional","resumo":"Guias, parcelamento e rotina fiscal da empresa"},
  {"id":"outro","titulo":"Meu caso é outro","resumo":"Conte em poucas palavras logo abaixo"}
]'::jsonb
where id = 'pj-atendimento';

select id, name, jsonb_pretty(itens) from public.servicos where id = 'pj-atendimento';
