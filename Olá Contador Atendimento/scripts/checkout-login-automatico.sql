-- Login automático pós-pagamento: sem isso, o cliente só entrava na área dele
-- clicando num link recebido por e-mail — um passo extra, fora da página, que
-- na prática travava a triagem obrigatória (ninguém chegava a executá-la).
--
-- poll_token é um segredo opaco (gerado no servidor, em api/signup-checkout.js)
-- que o navegador precisa apresentar de volta pra saber o status do próprio
-- pagamento. Sem ele, /api/status?cobrancaId=N seria adivinhável (id
-- sequencial) e qualquer um poderia consultar — ou pior, herdar o login
-- automático de — o pagamento de outra pessoa.
alter table cobrancas
  add column if not exists poll_token uuid;

create index if not exists cobrancas_poll_token_idx on cobrancas (poll_token)
  where poll_token is not null;
