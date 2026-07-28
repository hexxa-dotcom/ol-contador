-- Resolve o "cliente órfão": hoje a linha em `clientes` nasce assim que o
-- formulário de checkout é enviado, antes de saber se a pessoa vai pagar. Quem
-- gera o Pix e desiste (ou o Pix expira) fica pra sempre como cliente
-- "pending" sem nenhuma cobrança paga atrás.
--
-- A partir de agora, os dados do formulário ficam guardados aqui na própria
-- cobrança (que já nasce mesmo sem pagamento confirmado) e o cliente só é
-- criado de verdade quando o pagamento confirma — ver confirmCobranca em
-- api/_lib/pagamento.js e server.js.
--
-- Idempotente: pode rodar de novo sem estragar nada.

alter table public.cobrancas add column if not exists dados_cliente jsonb;

comment on column public.cobrancas.dados_cliente is
  'Dados do formulário de checkout guardados até o pagamento confirmar (name, email, phone, sexo, cidade, estado, assunto, summary). Depois disso o cliente nasce e o campo vira histórico.';
