# 004 — Transição de movimento dos cards Express no kanban de Processos & Dossiês

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 arquivo (`src/components/views.tsx`), 1 componente
  (`.kanban-item` dos itens Express)
- **Depende de**: nenhum outro plano — `moveExpress` já atualiza o estado
  local sem `window.location.reload()` (ver "Por que só os itens Express").
  Os cards **legado** (`legacyItems`, mesma view) ficam de fora deste plano
  até o 001 estar aplicado — sem a troca do reload, não existe DOM vivo pra
  animar a saída de coluna.

## Problema

Ao mover um card Express de coluna (via drag-and-drop ou pelo `<select>` de
status), o item simplesmente desaparece de uma `.kanban-items` e reaparece
em outra — não existe transição:

```tsx
// src/components/views.tsx:8396-8451 — atual (Card Express, dentro do .map)
{expressItems.map((item) => (
  <Card
    className="kanban-item"
    key={`e-${item.id}`}
    draggable
    onDragStart={(event) =>
      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ kind: "express", id: item.id }),
      )
    }
  >
    <strong>
      {item.assunto || item.servico_id || `Express #${item.id}`}
    </strong>
    <span>{clientName(item.cliente_ref)}</span>
    <small>
      Prazo{" "}
      {new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(item.prazo_conclusao_em))}
    </small>
    <label className="kanban-assignee">
      {/* ...select de responsável... */}
    </label>
    <select
      disabled={moving === `e-${item.id}`}
      value={item.status}
      onChange={(event) => void moveExpress(item.id, event.target.value)}
    >
      {/* ...opções de etapa... */}
    </select>
  </Card>
))}
```

```css
/* src/app/globals.css:6284-6288 — .kanban-item (atual) */
.kanban-item { min-height: 112px; padding: 13px; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; background: rgba(255,255,255,.84); cursor: grab; }
.kanban-item:active { cursor: grabbing; }
```

Nenhuma `transition` na regra. Como cada coluna é uma `<div
className="kanban-items">` diferente (`views.tsx:8375-8391`), um card
mudando de `stage.express` sai de um pai React e entra em outro — mesmo que
a regra CSS tivesse uma `transition`, ela não anima reparenting entre
containers diferentes (isso não é o que `transition` do CSS resolve).

## Por que só os itens Express (e não também os legado)

`moveExpress` (`views.tsx:8206-8230`) já faz update otimista local sem
recarregar a página:

```tsx
setExpress((items) =>
  items.map((item) => (item.id === id ? { ...item, status } : item)),
);
```

Ou seja, o DOM permanece vivo entre o "antes" e o "depois" — é exatamente o
cenário em que uma animação de layout consegue interpolar a posição.
`moveLegacy`, hoje, dá `window.location.reload()` no sucesso — não existe
"antes e depois" pro navegador animar, a página inteira é recriada do zero.
Animar o card legado antes do plano 001 seria trabalho jogado fora (a
animação nunca teria tempo de rodar, o reload interrompe tudo).

## Alvo

```tsx
// target
{expressItems.map((item) => (
  <motion.div
    layout
    layoutId={`kanban-item-e-${item.id}`}
    transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
    className="card kanban-item"
    key={`e-${item.id}`}
    draggable
    onDragStart={(event) =>
      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ kind: "express", id: item.id }),
      )
    }
  >
    <strong>
      {item.assunto || item.servico_id || `Express #${item.id}`}
    </strong>
    <span>{clientName(item.cliente_ref)}</span>
    <small>
      Prazo{" "}
      {new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(item.prazo_conclusao_em))}
    </small>
    <label className="kanban-assignee">
      {/* ...select de responsável, inalterado... */}
    </label>
    <select
      disabled={moving === `e-${item.id}`}
      value={item.status}
      onChange={(event) => void moveExpress(item.id, event.target.value)}
    >
      {/* ...opções de etapa, inalterado... */}
    </select>
  </motion.div>
))}
```

Também envolver a `.kanban-items` (o container de cada coluna) com
`<AnimatePresence>` não é necessário aqui — `layout`/`layoutId` no
`motion.div` já é suficiente pro framer-motion detectar que o elemento com
aquele `layoutId` mudou de posição/pai entre renders e animar a transição
(FLIP automático). `AnimatePresence` só seria necessário se o card também
pudesse ser removido da lista inteira (ex: cancelado some do kanban) — isso
não é o escopo deste plano.

## Convenções do repositório a seguir

- Import de `framer-motion`: igual ao plano 002,
  `import { motion } from "framer-motion";` (se o plano 002 já tiver sido
  aplicado neste arquivo — não é o caso aqui, `views.tsx` é um arquivo
  diferente de `accountant-shell.tsx` — adicionar o import
  independentemente).
- Spring "Apple-style" recomendado pra movimento com física real (não
  duração fixa): `{ type: "spring", duration: 0.5, bounce: 0.2 }` — mesmo
  valor citado no playbook de animação do projeto, `bounce: 0.2` fica
  dentro da faixa sutil (0.1-0.3) recomendada, sem exagerar num app de
  dashboard sério.
- `Card` (`src/components/ui/primitives.tsx:8-10`) é só
  `<div className={cn("card", className)}>` — como `motion.div` precisa
  substituir o `Card` diretamente (layout animation exige que o próprio
  elemento seja um componente `motion.*`, não um componente arbitrário
  embrulhando um `div`), a classe vira `className="card kanban-item"`
  escrita à mão, replicando o que `cn("card", className)` já produzia.

## Passos

1. Em `src/components/views.tsx`, adicionar no topo:
   ```tsx
   import { motion } from "framer-motion";
   ```
2. No `.map()` de `expressItems` (dentro de `AcompanhamentoIntegralView`,
   por volta da linha 8396), trocar a tag `<Card ... className="kanban-item" ...>`
   por `<motion.div layout layoutId={`kanban-item-e-${item.id}`} transition={{ type: "spring", duration: 0.5, bounce: 0.2 }} className="card kanban-item" ...>`
   (mesmos outros atributos: `key`, `draggable`, `onDragStart`) e a tag de
   fechamento `</Card>` por `</motion.div>`. Todo o conteúdo interno
   permanece idêntico.
3. NÃO tocar no `.map()` de `legacyItems` logo abaixo (continua usando
   `Card` normalmente).

## Limites

- NÃO aplicar `motion.div`/`layout` nos cards `legacyItems` neste plano
  (ver "Depende de" acima).
- NÃO usar o prop `drag` do framer-motion (que ativaria o sistema de
  arrastar dele) — o app já usa HTML5 Drag and Drop nativo
  (`draggable`/`onDragStart`/`onDrop`) e os dois sistemas não devem ser
  misturados no mesmo elemento. Só usar `layout`/`layoutId`, que é
  independente do sistema de drag.
- NÃO mexer no `<select>` de status nem no `<select>` de responsável dentro
  do card.
- NÃO adicionar animação de entrada/saída do card na lista (isso cobriria
  criar/cancelar um Express, que é um cenário diferente do "mover de
  coluna") — fora de escopo.
- Se `expressItems.map` não bater com o código citado (mudou desde
  `83cdbb8`), PARE e reporte.

## Risco de quebra

- **Baixo-médio.** `layout`/`layoutId` do framer-motion é uma feature
  bem estabelecida da biblioteca (não é API experimental), mas é a
  primeira vez que "layout animation" (como oposto a "animação simples de
  entrada/saída") é usada neste projeto — vale testar com atenção redobrada
  o comportamento de drag: `draggable` nativo + `motion.div` podem, em
  navegadores mais antigos/Safari, ter uma leve fricção com o
  `transform` que o framer aplica durante o drag visual nativo (o
  navegador desenha um "ghost" do elemento ao arrastar, isso é
  independente do React, então o risco real é baixo, mas é o item mais
  novo tecnicamente deste plano).
- **`key` duplicada com `layoutId` inconsistente**: se em algum reload
  parcial dois `express` items acabarem com o mesmo `id` (não deveria
  acontecer, `id` vem do banco), o `layoutId` colidiria e o framer-motion
  animaria entre dois cards errados — risco teórico, não foi observado no
  código, mas vale checar no feel-check com uma lista realista de
  10+ itens.
- **Não afeta `moveLegacy`/plano 001** — arquivos e blocos JSX totalmente
  separados dentro da mesma função, sem sobreposição de linhas.

## Verificação

- **Mecânica**: `npm run build` sem erro de tipo; `npm run lint` limpo.
- **Feel check**:
  - Mudar o status de um card Express pelo `<select>` — o card deve
    deslizar suavemente da coluna atual pra nova coluna, não teleportar.
  - Arrastar um card Express pra outra coluna (drag-and-drop) — mesma
    checagem.
  - Mover 2-3 cards em sequência rápida — nenhuma animação deve travar ou
    empilhar de forma estranha (o spring deve conseguir ser interrompido
    por um novo movimento sem "voltar do zero").
  - No DevTools → Animations panel, reduzir a velocidade e confirmar que o
    movimento tem uma leve física de mola (levíssimo overshoot no final),
    não um linear/ease-out reto.
  - Ativar `prefers-reduced-motion` e confirmar (mesma ressalva do plano
    002: framer-motion não obedece a media query de CSS automaticamente —
    se o movimento continuar cheio mesmo com a preferência ativada, isso é
    um achado a reportar, não corrigir aqui).
- **Pronto quando**: cards Express mudam de coluna com uma transição visível
  e suave, o drag continua funcionando normalmente, e nada mais quebrou.
