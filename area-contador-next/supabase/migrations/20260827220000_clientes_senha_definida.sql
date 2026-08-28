-- Sinaliza de verdade quando o cliente já criou uma senha (updateUser com
-- password), em vez de depender só de uma chave no localStorage do
-- navegador — isso fazia o card "criar senha" reaparecer sempre que o
-- cliente trocava de aparelho/navegador, mesmo já tendo senha.
alter table public.clientes
  add column if not exists senha_definida boolean not null default false;
