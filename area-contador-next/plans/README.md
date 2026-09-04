# Planos de fluidez — Área do Contador

Gerados a partir da auditoria de motion/animação da área do contador
(`accountant-shell.tsx`, `views.tsx`, `globals.css`), aplicando os
princípios de física/fluidez do design da Apple. Nenhuma alteração foi
aplicada ao código ainda — só os planos.

| # | Título | Severidade | Categoria | Depende de | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-kill-reload-on-move-legacy.md) | Trocar reload por `router.refresh()` no `moveLegacy` | HIGH | Interruptibility/Physicality | — | DONE |
| [002](002-exit-animations-shell-overlays.md) | Animação de saída nos popovers/toast da casca | HIGH | Physicality/Interruptibility | — | DONE |
| [003](003-chat-autoscroll.md) | Auto-scroll do chat na Fila de Atendimento | HIGH | Missed opportunity | — | DONE |
| [004](004-kanban-express-move-animation.md) | Card Express desliza entre colunas do kanban | HIGH | Physicality | — (mas cards **legado** ficam de fora até 001 estar pronto) | DONE |
| [005](005-portal-content-swap-transitions.md) | Crossfade no resumo da triagem e na confirmação de agendamento pago (cliente) | HIGH | Missed opportunity/Physicality | — | DONE |
| [006](006-portal-faq-accordion-motion.md) | Portar o accordion do FAQ público pro portal do cliente | HIGH | Cohesion/Missed opportunity | — | DONE |
| [007](007-unify-chat-message-in-animation.md) | Unificar a animação de mensagem do chat (contador vs. cliente) | HIGH | Cohesion/Tokens | — | DONE |
| [008](008-portal-validation-feedback-fade.md) | Fade no feedback de validação (senha, cofre gov.br) do cliente | HIGH | Physicality | — | DONE |

Também aplicado direto (sem plano formal, mudança mecânica de 1 token já
existente): a borda do chat do **cliente** (`.portal-chat-card` e 6
descendentes) foi migrada pro mesmo `--chat-line` escuro já usado no chat
do contador — estava com a cor antiga (`rgba(203,213,225,X)`/`#cbd5e1`)
porque não fazia parte do escopo do ajuste original.

## Ordem recomendada

001 → 003 → 002 → 004, ou os quatro em paralelo por engenheiros diferentes
(são arquivos/blocos de código sem sobreposição — só 002 e 004 tocam
`framer-motion` pela primeira vez em cada arquivo, sem conflito entre si).
001 antes de 004 só importa se você quiser depois estender o 004 pros cards
**legado** também (fora do escopo atual).

## O que NÃO está coberto ainda (ficou de fora da auditoria priorizada)

Da tabela completa da auditoria, os itens abaixo têm achados confirmados mas
ainda sem plano escrito — perguntar antes de fazer:

- `transition: all` em 60+ regras do `globals.css` (achado #5) — mudança
  ampla, de baixo risco individual mas alto volume; melhor como um passe
  dedicado depois que os 4 planos acima estiverem validados.
- Sidebar animando `width`/`flex-basis` em vez de `transform` (achado #6).
- Consolidação de tokens de duração/easing — 12+ valores distintos sem
  nenhuma custom property (achado #7).
- Badges/pills sem transition em mudança de valor (achado #8).
- Os outros 6 modais com o mesmo defeito do plano 002, dentro de
  `views.tsx` (dossiê de cliente, reset de senha, novo cliente, nova
  tarefa, perfil da equipe, editar perfil).
- Os outros 11 pontos com `window.location.reload()` fora do `moveLegacy`
  — cada um precisa da mesma checagem de "o dado depende de prop direta ou
  de `useState` sem re-sincronização" feita pro plano 001 antes de receber
  o mesmo tratamento.

## Risco geral — resumo pra quem for revisar/aplicar

- **001** é o mais delicado dos quatro: mexe em como o dado chega na tela
  depois de uma ação, não só em CSS/animação. Já foi verificado que é
  seguro especificamente pro `moveLegacy` (o dado que a coluna usa,
  `legacyMap`, é derivado direto da prop a cada render, não fica preso em
  `useState` velho) — mas essa mesma verificação NÃO foi feita pros outros
  11 `window.location.reload()` do arquivo, e não deve ser presumida.
- **002** e **004** introduzem `framer-motion` numa parte do app que hoje é
  100% CSS puro — a biblioteca já é dependência do projeto (usada nas
  páginas públicas), mas é a primeira vez que aparece na área logada. Baixo
  risco técnico, maior risco é de "esquecimento" (alguém não perceber que
  agora há uma segunda forma de fazer animação no projeto e criar
  inconsistência no futuro).
- **003** é o de menor risco dos quatro — é só adição (ref + effect + uma
  div vazia), nada é removido ou reordenado.
- Nenhum dos quatro planos muda regra de negócio, permissão (RBAC) ou
  contrato de API — só a forma como a interface reage ao que já acontece
  hoje.

## Nota operacional (worktrees isolados vs. mudanças não commitadas)

Nenhuma das mudanças destes planos foi commitada — tudo fica como alteração
não commitada no repositório principal. Isso importa porque cada execução
de plano roda num **worktree git isolado**, que é criado a partir do
último COMMIT, não do estado atual (não commitado) do repositório
principal. Ou seja: um worktree novo NUNCA vê as mudanças não commitadas de
um plano anterior, mesmo que os dois planos sejam "sequenciais" em ordem de
execução. Na prática isso não travou nada porque os planos tocaram partes
diferentes do arquivo (ou, quando bateram na mesma regra, o conteúdo
citado no plano ainda era idêntico ao do commit original) — mas dois
episódios valem registrar:

- **Plano 006** foi instruído (por mim, incorretamente) a assumir que o
  import do `framer-motion` já existia em `client-views.tsx` "por causa do
  plano 005" — falso no worktree isolado dele. O executor corretamente
  parou e reportou a inconsistência em vez de adivinhar; resolvido
  confirmando que ele deveria simplesmente adicionar o import (o próprio
  plano já preva esse caso).
- **Planos 007 e 008** geraram diffs corretos nos respectivos worktrees,
  mas o `git apply` no repositório principal falhou por divergência de
  CONTEXTO ao redor da linha (não do conteúdo em si, que batia) — resolvido
  aplicando a mudança manualmente, conferindo que o texto citado no plano
  ainda existia no arquivo real antes de editar.

Se for repetir esse fluxo depois de mais commits acumularem, esse atrito
tende a diminuir (menos divergência entre o HEAD commitado e o estado dos
planos).

## Desvio registrado na execução do 004

O executor do plano 004 bateu num erro de tipo real que o plano não previu:
`motion.div` do framer-motion redefine a assinatura de `onDragStart` pro
próprio sistema de gestos dele, incompatível com o `event.dataTransfer` do
drag-and-drop nativo do HTML5 que o kanban já usa. Corrigido trocando só
esse handler específico (no card Express) de `onDragStart` pra
`onDragStartCapture` (mesmo comportamento pro elemento que dispara o evento,
já que a fase de captura e a de bolha coincidem no próprio alvo do evento) —
não muda nada do design do plano, só resolve a colisão de tipos. Validado
com `tsc --noEmit` limpo antes e depois de aplicar.
