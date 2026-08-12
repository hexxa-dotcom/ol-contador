-- Políticas explícitas para tabelas exclusivamente server-side. As roles do
-- navegador continuam sem GRANT; service_role permanece o único acesso.

do $$
declare tabela text;
begin
  foreach tabela in array array[
    'govbr_credenciais_cofre',
    'govbr_credenciais_auditoria',
    'rate_limits',
    'webhook_eventos'
  ] loop
    execute format('drop policy if exists %I on public.%I', tabela || '_service_only', tabela);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      tabela || '_service_only', tabela
    );
  end loop;
end $$;
