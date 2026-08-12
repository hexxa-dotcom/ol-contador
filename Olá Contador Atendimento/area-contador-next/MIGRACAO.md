# Migração da Área do Contador para Next.js

> O inventário funcional completo e o padrão visual reutilizável da Área do
> Cliente estão em [`../PADRAO-SISTEMA-E-MIGRACAO-AREA-CLIENTE.md`](../PADRAO-SISTEMA-E-MIGRACAO-AREA-CLIENTE.md).

Este diretório é a nova aplicação. A versão legada (`contador.html`,
`app.js`, `oc-data.js` e as APIs existentes) permanece intacta até o corte final.

## Estratégia

- Migrar por fatias verticais, uma tela funcional por vez.
- Manter o contrato das tabelas e as políticas RLS existentes.
- Consultas comuns usam o cliente Supabase autenticado e continuam limitadas por RLS.
- Operações com segredos (Asaas, IA, avisos e integrações fiscais) permanecem no servidor.
- Não transportar a interceptação global de `window.fetch` de `oc-data.js`.
- A versão antiga continua sendo o rollback até a homologação completa.

## Ordem de migração

1. **Fundação**
   - [x] Next.js, componentes e sistema visual.
   - [x] Clientes Supabase para navegador e servidor.
   - [x] Renovação segura da sessão por cookies no `proxy`.
   - [x] Login real e proteção da área autenticada.
   - [x] Tipos TypeScript gerados diretamente do projeto Supabase de produção.
2. **Leitura operacional**
   - [x] Dashboard em modo somente leitura.
   - [ ] Clientes e prontuário.
   - [ ] Agenda e fila de atendimentos.
   - [ ] Acompanhamento e tarefas.
3. **Fluxos com escrita**
   - [ ] Chat Realtime, anexos e bloqueio.
   - [ ] Relatórios, rascunho, entrega e encerramento idempotente.
   - [ ] Notificações e caixa postal.
4. **Integrações sensíveis**
   - [ ] Financeiro/Asaas.
   - [ ] Radar Fiscal.
   - [ ] Copiloto e skills de IA.
5. **Homologação e corte**
   - [ ] Testes de permissão por perfil e auditoria RLS.
   - [ ] Teste ponta a ponta dos fluxos críticos.
   - [ ] Validação responsiva e acessibilidade.
   - [ ] Publicação em URL de homologação.
   - [ ] Aprovação explícita antes de trocar a produção.

## Critérios para cada tela

Uma tela só é considerada migrada quando preserva dados, permissões, estados
de carregamento/vazio/erro, ações e comportamento móvel da versão anterior.

## Primeiro corte funcional

O primeiro corte será **autenticação + Dashboard em modo somente leitura**.
Isso valida sessão, RLS e consultas reais com risco baixo antes de migrar chat,
pagamentos ou entregas.
