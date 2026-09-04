# 001 — Trocar `window.location.reload()` por `router.refresh()` no fluxo `moveLegacy`

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Interruptibility / Physicality
- **Estimated scope**: 1 arquivo (`src/components/views.tsx`), ~3 linhas alteradas + 1 import novo

## Problema

Em `AcompanhamentoIntegralView` ("Processos & Dossiês"), mover um caso legado
entre etapas do kanban (`moveLegacy`) recarrega a página inteira depois que o
servidor confirma a mudança:

```tsx
// src/components/views.tsx:8231-8248 — atual
async function moveLegacy(clientId: string, status: string) {
  setMoving(`l-${clientId}`);
  const response = await fetch("/api/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "kanban-stage", clientId, status }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    recurrenceMessage?: string;
  };
  setMoving(null);
  feedback(
    response.ok
      ? result.recurrenceMessage || "Etapa atualizada e cliente notificado."
      : "Não foi possível mover este caso.",
  );
  if (response.ok) window.location.reload();
}
```

Isso mata qualquer transição visual do card (não há continuidade de DOM
possível — o navegador descarta tudo), reseta scroll, fecha qualquer
modal/drawer aberto, e pisca a tela inteira a cada arrasto de card. É o
padrão mais destrutivo pra fluidez encontrado na auditoria.

## Por que `router.refresh()` é seguro aqui (e por que NÃO é um "find and
replace" nos outros 11 `window.location.reload()` do arquivo)

`operationsData` chega em `AcompanhamentoIntegralView` como prop (`data`),
que vem direto de `AccountantShell` (`src/components/accountant-shell.tsx:89`,
`operationsData` também é prop simples, sem `useState`), que por sua vez vem
do Server Component `src/app/painel/page.tsx` (`loadOperationsData`).
`router.refresh()` do Next.js re-executa esse Server Component e empurra as
novas props para baixo — SEM descartar a árvore de componentes React do
cliente (diferente de um reload de navegador).

O detalhe que importa: `legacyMap` (usado para desenhar as colunas do kanban
legado) é **derivado direto da prop a cada render**
(`views.tsx:8185-8193`, `const legacyMap = kanbanValue && ... ? kanbanValue : {}`)
— não é `useState`. Então quando a prop `data` chega atualizada via
`router.refresh()`, `legacyMap` reflete o novo valor automaticamente, sem
precisar de nenhum código extra de sincronização.

Isso NÃO é verdade pro `express` (mesma view, linha 8177:
`const [express, setExpress] = useState(data.express)`) — esse é `useState`
inicializado uma vez só; `router.refresh()` sozinho NÃO atualizaria essa
lista (React preserva a instância do componente e ignora o valor inicial em
renders seguintes). Por sorte `moveExpress` (a função irmã, linhas 8206-8230)
já faz update otimista local (`setExpress(...)`) e nunca chamou reload — não
precisa de mudança. Mas isso significa que este plano NÃO pode ser copiado
cegamente pros outros 11 pontos com `window.location.reload()` no arquivo
(RelatoriosIntegralView, AgendaIntegralView, FinanceiroIntegralView,
ClientesIntegralView) sem antes checar, pra cada um, se o dado que a tela
mostra vem de prop direta (seguro) ou de `useState` sem re-sincronização
(precisa de um `useEffect` adicional pra não deixar a tela "mentir" depois da
ação — pior que o reload atual). Esse plano cobre só o caso já verificado
como seguro.

## Alvo

```tsx
// target
async function moveLegacy(clientId: string, status: string) {
  setMoving(`l-${clientId}`);
  const response = await fetch("/api/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "kanban-stage", clientId, status }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    recurrenceMessage?: string;
  };
  setMoving(null);
  feedback(
    response.ok
      ? result.recurrenceMessage || "Etapa atualizada e cliente notificado."
      : "Não foi possível mover este caso.",
  );
  if (response.ok) router.refresh();
}
```

## Convenções do repositório a seguir

- `useRouter` de `"next/navigation"` (não `"next/router"` — este é App
  Router, Next 16). Nenhum outro componente da área do contador usa
  `useRouter` ainda; será a primeira vez — está tudo bem, é API padrão do
  Next, não é dependência nova.
- O componente já é `"use client"` (topo de `src/components/views.tsx:1`).

## Passos

1. Em `src/components/views.tsx`, no topo do arquivo, adicionar o import:
   ```tsx
   import { useRouter } from "next/navigation";
   ```
   (colocar junto aos outros imports de `next/*`, se houver, ou logo abaixo
   do bloco de imports de `"react"` no topo do arquivo).
2. Dentro de `AcompanhamentoIntegralView` (função que começa em
   `views.tsx:8168`), logo após a linha `const [express, setExpress] =
   useState(data.express);` (linha 8177), adicionar:
   ```tsx
   const router = useRouter();
   ```
3. Na função `moveLegacy` (linha 8248), trocar a última linha:
   ```diff
   -    if (response.ok) window.location.reload();
   +    if (response.ok) router.refresh();
   ```

## Limites

- NÃO tocar em `moveExpress` (linhas 8206-8230) — já funciona sem reload.
- NÃO trocar nenhum outro `window.location.reload()` do arquivo (linhas
  3226, 8784, 8937, 8974, 9690, 9701, 9710, 10416, 10425, 10475, 10484) —
  cada um precisa de uma análise própria de qual estado local depende da
  prop antes de receber o mesmo tratamento.
- NÃO adicionar animação de movimento do card neste plano (isso é o plano
  004 — depende deste aqui estar pronto primeiro, já que sem a troca do
  reload não existe continuidade de DOM pra animar).
- Se `moveLegacy` não estiver mais nas linhas indicadas (código mudou desde
  o commit `83cdbb8`), PARE e reporte em vez de improvisar.

## Verificação

- **Mecânica**: `npm run build` (ou `next build`) sem erros de tipo; `npm
  run lint` sem novos warnings.
- **Feel check**:
  - Abrir "Processos & Dossiês", arrastar um card legado pra outra coluna.
    A tela NÃO deve piscar/recarregar; o card some da coluna de origem e
    reaparece na nova (ainda sem animação suave — isso vem no plano 004).
  - O toast de feedback ("Etapa atualizada e cliente notificado.") deve
    aparecer normalmente.
  - Abrir o DevTools → aba Network → filtrar por "Doc" e confirmar que NÃO
    há uma nova requisição de documento HTML completo após o drop (só a
    chamada RSC do `router.refresh()`).
  - Testar duas vezes seguidas rápido (mover dois cards em sequência) — a
    segunda ação não deve ser perdida nem duplicar o toast.
- **Pronto quando**: mover um card legado atualiza a coluna sem reload de
  página, o contador consegue mover 3+ cards em sequência sem a tela
  piscar, e nenhum teste/typecheck quebrou.
