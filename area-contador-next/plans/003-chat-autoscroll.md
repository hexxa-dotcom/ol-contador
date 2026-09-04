# 003 — Auto-scroll da lista de mensagens no Atendimento (Fila/Chat)

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Missed opportunity / Interruptibility
- **Estimated scope**: 1 arquivo (`src/components/views.tsx`), ~10 linhas
  adicionadas, 0 removidas

## Problema

`AtendimentoView` é a tela de maior uso do app (fila de atendimento +
WhatsApp). A lista de mensagens não tem nenhum mecanismo de auto-scroll —
confirmado por busca (`grep -n "scrollIntoView\|scrollTop"
src/components/views.tsx` não retorna nada dentro desta função):

```tsx
// src/components/views.tsx:2218-2223 — atual
<div className="chat-messages" aria-live="polite">
  {selectedMessages.map((item) => {
    /* ... */
  })}
</div>
```

`selectedMessages` (`views.tsx:1106-1108`) é recalculado a cada render a
partir de `messages` (prop/estado que recebe atualização em tempo real via
Supabase Realtime — confirmado em `accountant-shell.tsx:179-196`, canal
`contador-badge-mensagens-next` escuta INSERT/UPDATE em `mensagens`). Ou
seja: mensagem nova chega, a lista recebe o item novo, mas se o usuário já
tinha rolado a conversa (ou a lista é maior que a viewport), a mensagem nova
renderiza fora da área visível e ninguém percebe — nem quando o próprio
contador acabou de enviar uma mensagem seguindo o fluxo `submitMessage`.

## Alvo

```tsx
// target
<div className="chat-messages" aria-live="polite" ref={chatMessagesEndRef.current ? undefined : undefined}>
```

(placeholder acima só ilustra — ver os passos abaixo pro código real, que
usa um `<div>` sentinela no fim da lista em vez de um ref na lista inteira,
porque `selectedMessages` já é renderizado com `.map()` sem wrapper de
scroll dedicado; o padrão mais simples e seguro aqui é um elemento vazio
"âncora" no fim, igual ao padrão mais comum de chat em React):

```tsx
// target — dentro do JSX, logo depois do .map() de selectedMessages e do
// bloco de "sem mensagens" (views.tsx, dentro do <div className="chat-messages">)
<div ref={chatEndRef} />
```

```tsx
// target — novo useEffect, colocado perto dos outros useEffect da função
// AtendimentoView (ex.: logo após a declaração de `selectedMessages`)
const chatEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  chatEndRef.current?.scrollIntoView({ block: "end" });
}, [selectedMessages.length, selectedClientId]);
```

## Convenções do repositório a seguir

- `useRef`/`useEffect` já são importados de `"react"` no topo do arquivo
  (`views.tsx:4-7`), nenhum import novo necessário.
- Sem `behavior: "smooth"` no `scrollIntoView` — o resto do app não usa
  scroll suave em nenhum lugar (é um comportamento instantâneo/utilitário
  em toda a base), e usar `"smooth"` aqui criaria uma inconsistência de
  personalidade (ver Cohesion, AUDIT.md categoria 7). Manter o scroll
  instantâneo (`block: "end"` sem `behavior`) é a escolha certa — o objetivo
  é garantir que a mensagem fique visível, não fazer disso um momento de
  "delícia" (chat não é um lugar raro/especial, é usado 44x/dia).

## Passos

1. Dentro de `AtendimentoView` (começa em `views.tsx:874`), logo após a
   linha que declara `const selectedMessages = ...` (linha 1106-1108),
   adicionar:
   ```tsx
   const chatEndRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
     chatEndRef.current?.scrollIntoView({ block: "end" });
   }, [selectedMessages.length, selectedClientId]);
   ```
2. Dentro do JSX, no `<div className="chat-messages" aria-live="polite">`
   (linha 2218), como último filho — depois do `.map()` de mensagens
   (linha ~2255) e depois do bloco `{!selectedMessages.length && (<EmptyState>...)}`
   que vem em seguida (linhas 2259+, confirmar onde esse bloco termina antes
   de inserir) — adicionar:
   ```tsx
   <div ref={chatEndRef} />
   ```

## Limites

- NÃO adicionar `behavior: "smooth"` (ver justificativa de cohesion acima).
- NÃO tentar resolver o "double-animate" do `message-in` mencionado na
  auditoria (mensagens antigas reanimando ao trocar de conversa) — isso é
  um achado separado, fora de escopo deste plano.
- NÃO adicionar lógica de "só rolar se o usuário já estava perto do fim"
  (padrão comum em apps de chat pra não interromper alguém lendo histórico
  antigo) — o time não pediu esse refinamento; se quiser, é um plano
  separado depois de validar o auto-scroll básico.
- Se `selectedMessages` ou a estrutura do `<div className="chat-messages">`
  não baterem com o citado (código mudou desde `83cdbb8`), PARE e reporte.

## Risco de quebra

- **Baixo.** É uma adição pura (um `ref`, um `useEffect`, uma `div` vazia)
  — nenhum código existente é removido ou reordenado. O único
  comportamento novo é a rolagem automática.
- **Ponto de atenção real**: o `useEffect` depende de `[selectedMessages.length,
  selectedClientId]`. Se o app um dia passar a permitir editar ou apagar
  uma mensagem (mudando o conteúdo sem mudar o `length` da lista), o
  scroll não vai reagir a isso — comportamento correto e esperado, não é
  bug, só registrando o motivo da escolha de dependência.
- **Layout**: `.chat-messages` precisa já ter `overflow-y: auto` (ou
  similar) pra `scrollIntoView` fazer sentido — confirme rapidamente no CSS
  antes de aplicar (`grep -n "\.chat-messages {" src/app/globals.css`); se
  não tiver overflow próprio (ex: o scroll acontece num ancestral), ajuste
  o `ref`/scroll pro elemento que de fato rola, em vez de assumir que é
  `.chat-messages`.

## Verificação

- **Mecânica**: `npm run build` sem erro de tipo; `npm run lint` limpo.
- **Feel check**:
  - Abrir uma conversa com mensagens suficientes pra estourar a altura da
    tela — a lista deve abrir já rolada até a última mensagem.
  - Enviar uma mensagem nova — a lista deve rolar sozinha pra mostrar o que
    foi enviado, sem esperar reload ou ação manual.
  - Trocar de conversa (clicar em outro cliente na fila) — a nova conversa
    também deve abrir já no fim.
  - Simular (ou aguardar) uma mensagem chegando via Realtime enquanto a
    conversa está aberta — deve rolar sozinha também.
- **Pronto quando**: em nenhum desses 4 cenários o usuário precisa rolar
  manualmente pra ver a mensagem mais recente, e nada mais na tela quebrou.
