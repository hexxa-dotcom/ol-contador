-- Onboarding obrigatório pós-pagamento: o cliente só é liberado pro portal
-- depois de enviar a triagem. Este campo é o que o servidor usa pra saber se
-- ainda falta esse passo (cliente.js lê via /api/clients -> onboardingPendente).
--
-- Default false: só o checkout público (api/_lib/pagamento.js, na criação do
-- cliente) grava true. Clientes já existentes, ou criados manualmente pelo
-- contador, não são pegos por este bloqueio.
alter table clientes
  add column if not exists onboarding_pendente boolean not null default false;

-- O RLS de clientes só permite UPDATE por staff (is_staff) — de propósito,
-- pra um cliente nunca poder reescrever o próprio prontuário. Por isso apagar
-- a própria flag de onboarding precisa de uma função SECURITY DEFINER restrita
-- (mesmo padrão de private.marcar_lidas em supabase-hardening-2026-07-29.sql),
-- em vez de abrir UPDATE geral na tabela pro cliente.
create or replace function private.concluir_onboarding_cliente()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meu text := private.my_client_id();
begin
  if v_meu is null then
    raise exception 'sem cliente associado a esta sessão';
  end if;

  update public.clientes
     set onboarding_pendente = false
   where id = v_meu;
end
$$;

revoke all on function private.concluir_onboarding_cliente() from public, anon;
grant execute on function private.concluir_onboarding_cliente() to authenticated;

create or replace function public.concluir_onboarding_cliente()
returns void
language sql
security invoker
set search_path = ''
as $$ select private.concluir_onboarding_cliente(); $$;

revoke all on function public.concluir_onboarding_cliente() from public, anon;
grant execute on function public.concluir_onboarding_cliente() to authenticated;
