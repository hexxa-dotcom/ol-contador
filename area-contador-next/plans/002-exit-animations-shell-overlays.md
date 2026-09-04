# 002 — Animação de saída para popovers e toast da casca do app (`AccountantShell`)

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Physicality & origin / Interruptibility
- **Estimated scope**: 2 arquivos (`src/components/accountant-shell.tsx`,
  `src/app/globals.css`), 3 componentes (`.notification-popover`,
  `.account-popover`, `.action-toast`)

## Problema

Os três overlays da casca do app (menu de notificações, menu da conta, e o
toast de feedback de ações) são renderizados condicionalmente em React
(`{condicao && <div>...}`), então ao fechar eles simplesmente somem do DOM no
frame seguinte — só existe animação de ENTRADA, nunca de saída:

```tsx
// src/components/accountant-shell.tsx:411-443 — notification-popover (atual)
{notificationOpen && (
  <div className="notification-popover" role="dialog" aria-label="Notificações recentes">
    {/* ... */}
  </div>
)}
```

```tsx
// src/components/accountant-shell.tsx:463-487 — account-popover (atual)
{accountMenuOpen && (
  <div className="account-popover" id="account-popover" role="menu">
    {/* ... */}
  </div>
)}
```

```tsx
// src/components/accountant-shell.tsx:585-593 — action-toast (atual)
{feedback && (
  <div className="action-toast" role="status">
    <CheckCircle2 size={17} />
    <span>{feedback}</span>
    <button aria-label="Fechar aviso" onClick={() => setFeedback("")}>
      <X size={15} />
    </button>
  </div>
)}
```

```css
/* src/app/globals.css:168 — notification-popover (atual) */
.notification-popover { position: absolute; z-index: 72; top: calc(100% + 10px); right: 0; width: min(360px, calc(100vw - 28px)); overflow: hidden; border: 1px solid var(--glass-border); border-radius: var(--radius-card); background: rgba(255,255,255,.9); box-shadow: 0 20px 55px rgba(15,23,42,.15), inset 0 1px 0 white; backdrop-filter: blur(26px) saturate(155%); -webkit-backdrop-filter: blur(26px) saturate(155%); animation: popover-in .18s cubic-bezier(.2,.8,.2,1); transform-origin: top right; }

/* src/app/globals.css:194-195 — account-popover (atual) */
.account-popover { position: absolute; z-index: 70; top: calc(100% + 10px); right: 0; width: 238px; padding: 6px; border: 1px solid rgba(203,213,225,.8); border-radius: var(--radius-card); background: rgba(255,255,255,.95); box-shadow: 0 18px 50px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.95); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); animation: popover-in .14s ease-out; }
@keyframes popover-in { from { opacity: 0; transform: translateY(-4px) scale(.98); } }

/* src/app/globals.css:6346 — action-toast (atual) */
.action-toast { position: fixed; z-index: 150; left: 50%; bottom: 22px; max-width: min(440px,calc(100vw - 28px)); min-height: 48px; padding: 9px 10px 9px 14px; display: flex; align-items: center; gap: 9px; border: 1px solid rgba(255,255,255,.9); border-radius: var(--radius-pill); background: rgba(15,23,42,.9); color: white; box-shadow: 0 16px 42px rgba(15,23,42,.24); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); transform: translateX(-50%); animation: toast-in .28s cubic-bezier(.2,.8,.2,1); }
@keyframes toast-in { from { opacity: 0; transform: translate(-50%,12px) scale(.97); } to { opacity: 1; transform: translate(-50%,0) scale(1); } }
```

Isso é o defeito mais repetido da auditoria inteira — o mesmo padrão aparece
em pelo menos mais 6 modais dentro de `src/components/views.tsx`
(dossiê de cliente, reset de senha, novo cliente, nova tarefa, perfil da
equipe, editar perfil). Este plano cobre só os 3 casos da casca do app
(`accountant-shell.tsx`), que já foram lidos por completo e têm o código
exato mapeado abaixo. Os 6 modais de `views.tsx` ficam fora de escopo — cada
um precisa da mesma leitura linha-a-linha antes de receber o mesmo tratamento
(ver "Limites").

## Por que `framer-motion` e não CSS puro

`framer-motion` (`^13.1.0`) já é dependência do projeto — não é dependência
nova. Ele já é usado em produção nas páginas públicas de marketing
(`src/app/(public)/home-page.tsx`, `faq-accordion.tsx`, `carrossel.tsx`,
`passos-como-funciona.tsx`), inclusive com `AnimatePresence` no
`faq-accordion.tsx`. Só nunca foi usado dentro da área do contador — este
plano introduz o mesmo padrão já validado em outro lugar do código, não um
padrão novo. `AnimatePresence` resolve exatamente o problema de "animar a
saída de algo que some do DOM condicionalmente", que é impossível com CSS
puro sem manter o elemento montado manualmente (mais código, mais estado
duplicado).

## Alvo

```tsx
// target — notification-popover
<AnimatePresence>
  {notificationOpen && (
    <motion.div
      key="notification-popover"
      className="notification-popover"
      role="dialog"
      aria-label="Notificações recentes"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {/* ...conteúdo inalterado... */}
    </motion.div>
  )}
</AnimatePresence>
```

```tsx
// target — account-popover
<AnimatePresence>
  {accountMenuOpen && (
    <motion.div
      key="account-popover"
      className="account-popover"
      id="account-popover"
      role="menu"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.14, ease: [0, 0, 0.58, 1] }}
    >
      {/* ...conteúdo inalterado... */}
    </motion.div>
  )}
</AnimatePresence>
```

```tsx
// target — action-toast
<AnimatePresence>
  {feedback && (
    <motion.div
      key="action-toast"
      className="action-toast"
      role="status"
      initial={{ opacity: 0, x: "-50%", y: 12, scale: 0.97 }}
      animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
      exit={{ opacity: 0, x: "-50%", y: 12, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <CheckCircle2 size={17} />
      <span>{feedback}</span>
      <button aria-label="Fechar aviso" onClick={() => setFeedback("")}>
        <X size={15} />
      </button>
    </motion.div>
  )}
</AnimatePresence>
```

```css
/* target — remover só a linha `animation:` das 3 regras, manter tudo o
   resto (fundo, blur, borda, sombra, z-index, position...) intacto */
.notification-popover { position: absolute; z-index: 72; top: calc(100% + 10px); right: 0; width: min(360px, calc(100vw - 28px)); overflow: hidden; border: 1px solid var(--glass-border); border-radius: var(--radius-card); background: rgba(255,255,255,.9); box-shadow: 0 20px 55px rgba(15,23,42,.15), inset 0 1px 0 white; backdrop-filter: blur(26px) saturate(155%); -webkit-backdrop-filter: blur(26px) saturate(155%); transform-origin: top right; }

.account-popover { position: absolute; z-index: 70; top: calc(100% + 10px); right: 0; width: 238px; padding: 6px; border: 1px solid rgba(203,213,225,.8); border-radius: var(--radius-card); background: rgba(255,255,255,.95); box-shadow: 0 18px 50px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.95); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }

.action-toast { position: fixed; z-index: 150; left: 50%; bottom: 22px; max-width: min(440px,calc(100vw - 28px)); min-height: 48px; padding: 9px 10px 9px 14px; display: flex; align-items: center; gap: 9px; border: 1px solid rgba(255,255,255,.9); border-radius: var(--radius-pill); background: rgba(15,23,42,.9); color: white; box-shadow: 0 16px 42px rgba(15,23,42,.24); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
```

Note que `transform: translateX(-50%)` foi removido de `.action-toast`
porque agora a centralização horizontal é feita via `x: "-50%"` no
`motion.div` (o `motion.div` escreve um `transform` inline que substituiria
o da classe de qualquer forma — melhor remover da classe pra não deixar
regra morta). `left: 50%` continua na classe, isso não muda.

Os `@keyframes popover-in` e `@keyframes toast-in` podem ficar no arquivo
sem uso (não quebram nada) — ou serem removidos se quiser limpar, mas isso é
opcional e fora do essencial deste plano.

## Convenções do repositório a seguir

- Import de `framer-motion`: `import { AnimatePresence, motion } from
  "framer-motion";` — exatamente como em
  `src/app/(public)/faq-accordion.tsx:4`.
- Duração/curva: reaproveitar os valores que cada popover já tinha no CSS
  (não inventar novos): notification-popover `.18s cubic-bezier(.2,.8,.2,1)`,
  account-popover `.14s ease-out` (equivalente exato em cubic-bezier:
  `[0, 0, 0.58, 1]`), action-toast `.28s cubic-bezier(.2,.8,.2,1)`.

## Passos

1. Em `src/components/accountant-shell.tsx`, adicionar no topo (junto aos
   outros imports de bibliotecas):
   ```tsx
   import { AnimatePresence, motion } from "framer-motion";
   ```
2. Substituir o bloco `{notificationOpen && (<div className="notification-popover" ...>...)}`
   (linhas 411-443) pelo target acima — só troca a tag (`div` → `motion.div`),
   adiciona `key`, `initial`, `animate`, `exit`, `transition`, e envolve com
   `<AnimatePresence>...</AnimatePresence>`. O conteúdo interno (linhas
   413-442) não muda em nada.
3. Substituir o bloco `{accountMenuOpen && (<div className="account-popover" ...>...)}`
   (linhas 463-487) da mesma forma.
4. Substituir o bloco `{feedback && (<div className="action-toast" ...>...)}`
   (linhas 585-593) da mesma forma.
5. Em `src/app/globals.css`, remover a propriedade `animation: popover-in
   ...` da regra `.notification-popover` (linha 168) e da regra
   `.account-popover` (linha 194), e `animation: toast-in ...` +
   `transform: translateX(-50%);` da regra `.action-toast` (linha 6346).
   Não mexer em mais nada nessas três regras.

## Limites

- NÃO tocar nos 6 modais de `src/components/views.tsx` que têm o mesmo
  defeito (dossiê de cliente, reset de senha, novo cliente, nova tarefa,
  perfil da equipe, editar perfil) — candidatos a um plano 005 separado,
  precisam de leitura própria antes.
- NÃO mudar a lógica de abrir/fechar (`notificationOpen`,
  `accountMenuOpen`, `feedback`, os `useEffect` de clique-fora e Escape) —
  só a forma como o JSX é montado/desmontado.
- NÃO adicionar `mode="wait"` no `AnimatePresence` — cada um desses três é
  um filho único e independente, não uma lista, não precisa.
- NÃO remover os `@keyframes popover-in`/`toast-in` do CSS se não tiver
  certeza que nada mais no arquivo os usa — confirme com
  `grep -n "popover-in\|toast-in" src/app/globals.css` antes de remover;
  se aparecer em outro lugar, deixe os keyframes como estão.
- Se o JSX não bater exatamente com o citado acima (código mudou desde o
  commit `83cdbb8`), PARE e reporte em vez de improvisar.

## Risco de quebra (o que verificar com atenção)

- **Fechar-clicando-fora e Esc continuam funcionando** — os handlers
  (`accountMenuRef`, `notificationRef`, `closeOnEscape`) estão presos ao
  `<div className="notification-wrap" ref={notificationRef}>` /
  `account-menu-wrap` que ENVOLVE o popover, não ao popover em si. Trocar
  `div` por `motion.div` dentro desse wrapper não muda a estrutura de quem
  é filho de quem — o ref continua pegando cliques dentro do popover
  corretamente. Baixo risco, mas confirme no feel-check.
- **CSS responsivo mobile não quebra** — o bloco `@media` que reposiciona
  `.notification-popover` no celular (`globals.css:7332-7341`) só mexe em
  `position/top/left/width/border-radius/box-shadow/transform-origin`, não
  redefine `animation` — continua válido sem alteração.
- **`transform-origin: top right` no CSS continua valendo** mesmo com o
  `transform` (translate/scale) agora vindo inline do framer-motion —
  `transform-origin` é propriedade independente, não é sobrescrita pelo
  style inline do `transform`.

## Verificação

- **Mecânica**: `npm run build` sem erro de tipo (framer-motion já tem
  tipos); `npm run lint` sem warnings novos.
- **Feel check**:
  - Abrir e fechar o menu de notificações várias vezes seguidas rápido —
    nunca deve travar em estado "pela metade" nem duplicar o popover.
  - Abrir notificações, sem fechar, clicar no avatar (deve fechar
    notificações E abrir o menu de conta, ambos com a transição certa).
  - Disparar uma ação que gera toast (ex: mudar status de algo), ver o
    toast entrar e sumir sozinho depois de alguns segundos suavemente (hoje
    ele só some de golpe).
  - No DevTools → Animations panel, reduzir a velocidade pra 25% e
    conferir que o popover encolhe/desaparece pro canto de onde veio (não
    do centro).
  - Ativar `prefers-reduced-motion` (aba Rendering do DevTools) e confirmar
    que o popover ainda aparece/some (sem quebrar), mesmo que a regra
    global de `transition-duration: .01ms` não alcance animações do
    framer-motion diretamente — se notar que o framer ignora a preferência
    do usuário aqui, reportar como achado novo, não tentar corrigir neste
    plano.
- **Pronto quando**: os três overlays entram E saem com transição, sem
  regressão nos handlers de fechar, e nenhum teste/typecheck quebrou.
