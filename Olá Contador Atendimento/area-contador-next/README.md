# Área do Contador — Next.js

Reescrita da Área do Contador em Next.js (App Router). Roda em paralelo ao
sistema legado (`www.olacontador.com.br`), em homologação — o banner fixo no
topo do app avisa isso a quem está logado.

> O plano de migração completo (o que já foi portado, o que falta, contrato
> funcional e padrão visual) está em
> [`../PADRAO-SISTEMA-E-MIGRACAO-AREA-CLIENTE.md`](../PADRAO-SISTEMA-E-MIGRACAO-AREA-CLIENTE.md).
> Este README cobre só como rodar e a estrutura do projeto — não duplique o
> status da migração aqui, mantenha isso só no documento acima.

## Segurança

- Autenticação real via Supabase Auth (sessão por cookies), RLS em todas as
  tabelas de usuário.
- Rotas administrativas (equipe, cofre gov.br, Radar Fiscal/SERPRO, erros
  operacionais, upload de skills) usam `service_role` — nunca exposto ao
  navegador, só em `src/lib/supabase/admin.ts` e chamado a partir de Route
  Handlers/Server Actions.
- Lê e escreve dados reais no Supabase — não é modo demonstrativo.

## Executar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Preencha `.env.local` a partir de `.env.example`
— sem `SUPABASE_SERVICE_ROLE_KEY`/`GOVBR_VAULT_KEY`/chaves de Asaas, SERPRO e
IA, as rotas administrativas correspondentes respondem `503` de forma
controlada (sem quebrar a UI), mas não funcionam de verdade.

## Estrutura

- `src/app/**` — páginas (App Router) e Route Handlers (`src/app/api/**`).
- `src/lib/**` — lógica de servidor compartilhada: clientes Supabase
  (`supabase/server.ts` com RLS, `supabase/admin.ts` com `service_role`),
  integrações externas (`asaas.ts`, `serpro.ts`, `cnd.ts`, `dividaAtiva.ts`,
  `ia.ts`, `govbrVault.ts`), e utilidades (`documento.ts`, `observability.ts`,
  `rateLimit.ts`, `metricas.ts`).
- `src/components/**` — UI. `views.tsx` concentra as telas principais (uma
  função `*IntegralView` por seção); `accountant-shell.tsx` é o layout com
  sidebar/topo.

## Testar

```bash
npm run typecheck
npm run build
```

Não há suíte de testes automatizados ainda.
