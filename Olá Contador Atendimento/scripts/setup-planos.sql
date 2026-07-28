-- Planos de atendimento + o que cada plano abarca.
--
-- Antes: a tabela `servicos` misturava plano e serviço. "Regularização Malha
-- Fina" (R$ 199) era o alvo de ?plano=pf, então quem clicava em "Agendar Pessoa
-- Física" via o nome de um serviço específico no lugar do nome do plano.
--
-- Agora: `servicos` guarda os PLANOS (Pessoa Física, Pessoa Jurídica, Sob
-- Demanda) e a coluna `itens` lista os serviços que aquele preço abarca — é ela
-- que alimenta a lista suspensa "O que está acontecendo?" na tela de
-- agendamento, e ela muda conforme o plano escolhido.
--
-- Idempotente: pode rodar de novo sem estragar nada.

alter table public.servicos add column if not exists itens jsonb not null default '[]'::jsonb;

comment on column public.servicos.itens is
  'Serviços que o plano abarca: [{id, titulo, resumo}]. Alimenta a lista suspensa do agendamento.';

-- ---------------------------------------------------------------- Pessoa Física
insert into public.servicos (id, name, description, price_cents, recurrence, active)
values ('pf', 'Pessoa Física', 'Atendimento individual com contador para o seu caso de IR e Receita Federal.', 19900, 'avulso', true)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  price_cents = excluded.price_cents, recurrence = excluded.recurrence, active = true;

update public.servicos set itens = '[
  {"id":"malha-fina","titulo":"Caí na malha fina ou recebi carta da Receita","resumo":"Intimação, notificação ou aviso no e-CAC"},
  {"id":"ir-atrasado","titulo":"Não declarei o IR ou declarei errado","resumo":"Declaração atrasada, retificação ou primeira vez"},
  {"id":"vendi-bem","titulo":"Vendi um imóvel, carro ou outro bem","resumo":"Ganho de capital: a venda com lucro pode gerar imposto"},
  {"id":"autonomo","titulo":"Recebo como autônomo e não sei se pago certo","resumo":"Carnê-leão, INSS e recibos"},
  {"id":"outro","titulo":"Meu caso é outro","resumo":"Conte em poucas palavras logo abaixo"}
]'::jsonb where id = 'pf';

-- ------------------------------------------------------------- Pessoa Jurídica
update public.servicos set
  name = 'Pessoa Jurídica',
  description = 'Atendimento para MEI e pequenas empresas: guias, prazos e pendências.',
  active = true,
  itens = '[
    {"id":"mei-pendencia","titulo":"Tenho guias DAS atrasadas","resumo":"Débitos do MEI acumulados"},
    {"id":"dasn","titulo":"Não entreguei a declaração anual (DASN)","resumo":"Declaração anual do MEI em atraso"},
    {"id":"desenquadramento","titulo":"Faturei acima do limite ou fui desenquadrado","resumo":"Saída do MEI e enquadramento no Simples"},
    {"id":"simples","titulo":"Tenho dúvidas ou pendências do Simples Nacional","resumo":"Guias, parcelamento e rotina fiscal da empresa"},
    {"id":"outro","titulo":"Meu caso é outro","resumo":"Conte em poucas palavras logo abaixo"}
  ]'::jsonb
where id = 'pj-atendimento';

-- ----------------------------------------------------------------- Sob demanda
update public.servicos set
  name = 'Sob Demanda',
  description = 'Diagnóstico do caso por escrito, com escopo, prazo e valor fechados antes de começar.',
  active = true,
  itens = '[
    {"id":"ir-varios-anos","titulo":"Tenho vários anos de IR atrasados","resumo":"Mais de uma declaração pendente"},
    {"id":"regularizacao","titulo":"Preciso de uma regularização extensa","resumo":"Situação que não cabe em um atendimento só"},
    {"id":"recorrente","titulo":"Quero um acompanhamento sob medida","resumo":"Demanda recorrente, com escopo próprio"},
    {"id":"outro","titulo":"Meu caso é outro","resumo":"Conte em poucas palavras logo abaixo"}
  ]'::jsonb
where id = 'consulta';

-- --------------------------------------------------- serviços que viram itens
-- Não apagamos: cobranças antigas apontam para eles. Só saem do catálogo, já
-- que agora são itens dentro do plano Pessoa Física.
update public.servicos set active = false where id in ('malha-fina', 'gcap');

select id, name, price_cents, active, jsonb_array_length(itens) as qtd_itens
from public.servicos order by active desc, price_cents;
