# 006 — Portar o accordion do FAQ do site público pro portal do cliente

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Cohesion / Missed opportunity
- **Estimated scope**: 1 arquivo (`src/components/client-views.tsx`),
  1 componente (`PortalFaqView`)

## Problema

O FAQ do portal do cliente usa `<details>`/`<summary>` nativos do HTML —
que abrem/fecham instantaneamente, sem nenhuma transição possível (é
comportamento do navegador, não dá pra animar com CSS de forma
confiável):

```tsx
// src/components/client-views.tsx:3955-3966 — atual
<details key={item.pergunta} className="portal-faq-accordion-item" open={Boolean(termo)}>
  <summary className="portal-faq-accordion-summary">
    <span className="portal-faq-question-text">{item.pergunta}</span>
    <div className="portal-faq-chevron-wrap">
      <ChevronDown size={17} />
    </div>
  </summary>
  <div className="portal-faq-accordion-content">
    <div className="portal-faq-answer-body">{item.resposta}</div>
  </div>
</details>
```

O mesmo produto já resolveu exatamente esse problema no site público, com
`framer-motion`:

```tsx
// src/app/(public)/faq-accordion.tsx:26-37 — referência, já em produção
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={styles.faqContent}
    >
      <p>{item.r}</p>
    </motion.div>
  )}
</AnimatePresence>
```

## Diferença de comportamento a preservar

`open={Boolean(termo)}` força TODOS os itens abertos quando o usuário está
buscando (`termo` = texto normalizado da busca). Como `<details>` é
descontrolado (o navegador guarda o estado, React só define o valor
inicial daquele render), hoje o comportamento real é: fora de busca, cada
item abre/fecha independente por clique nativo; durante busca, o React
força todos abertos a cada re-render.

Como o novo componente vai ser controlado por `useState`, é preciso
reproduzir isso explicitamente: cada item fica aberto se **(a)** o usuário
clicou nele OU **(b)** existe um termo de busca ativo.

## Alvo

```tsx
// target — dentro de PortalFaqView, adicionar estado local
const [itensAbertos, setItensAbertos] = useState<Set<string>>(new Set());

function toggleItem(chave: string) {
  setItensAbertos((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(chave)) proximo.delete(chave);
    else proximo.add(chave);
    return proximo;
  });
}
```

```tsx
// target — substitui o <details> das linhas 3955-3966
{grupo.itens.map((item) => {
  const chave = `${grupo.titulo}::${item.pergunta}`;
  const aberto = Boolean(termo) || itensAbertos.has(chave);
  return (
    <div key={item.pergunta} className={`portal-faq-accordion-item ${aberto ? "is-open" : ""}`}>
      <button
        type="button"
        className="portal-faq-accordion-summary"
        onClick={() => toggleItem(chave)}
        aria-expanded={aberto}
      >
        <span className="portal-faq-question-text">{item.pergunta}</span>
        <div className="portal-faq-chevron-wrap">
          <ChevronDown size={17} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="portal-faq-accordion-content-motion"
          >
            <div className="portal-faq-accordion-content">
              <div className="portal-faq-answer-body">{item.resposta}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
})}
```

`.portal-faq-accordion-item` já tem CSS existente baseado no atributo
nativo `[open]` do `<details>` (que deixa de existir com essa troca).
Trocar esses DOIS seletores em `globals.css` de atributo pra classe:

```css
/* globals.css:3054-3058 — atual */
.portal-faq-accordion-item[open] {
  background: #FFFFFF;
  border-color: #0f172a;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
}
```
vira
```css
/* target */
.portal-faq-accordion-item.is-open {
  background: #FFFFFF;
  border-color: #0f172a;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
}
```

```css
/* globals.css:3095-3099 — atual */
.portal-faq-accordion-item[open] .portal-faq-chevron-wrap {
  transform: rotate(180deg);
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}
```
vira
```css
/* target */
.portal-faq-accordion-item.is-open .portal-faq-chevron-wrap {
  transform: rotate(180deg);
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}
```

A regra `.portal-faq-accordion-summary::-webkit-details-marker { display:
none; }` (globals.css:3070-3072) fica órfã (não faz mal nenhum ficar, é
um seletor que nunca mais casa com nada já que não existe mais
`<summary>`) — pode deixar como está, não precisa remover.

Também adicionar, perto de `.portal-faq-accordion-item` (~linha 3046):

```css
/* target — nova regra */
.portal-faq-accordion-content-motion { overflow: hidden; }
```

## Convenções do repositório a seguir

- `AnimatePresence`/`motion` exatamente como em `faq-accordion.tsx`
  (mesma técnica de `height: 0 → "auto"`).
- `initial={false}` no `AnimatePresence` — sem isso, TODO item já aberto
  por causa de uma busca ativa no primeiro render tocaria a animação de
  entrada ao montar a página; com `initial={false}` só anima mudanças
  DEPOIS do primeiro render, igual ao comportamento nativo do `<details>`
  original (que nunca "anima" a abertura inicial).
- Duração/curva: `0.22s cubic-bezier(0.16, 1, 0.3, 1)` — mesmo valor já
  usado no plano da bolha de mensagem do chat do portal (mesma família de
  "conteúdo revelando", consistente).
- O ícone de chevron já gira via CSS (`globals.css:3092`, `transform
  0.25s cubic-bezier(0.16,1,0.3,1)` na classe `.rotated` — CONFIRME essa
  classe existe e o seletor certo antes de aplicar; se o projeto usa outro
  nome de classe pra "chevron aberto", ajuste o `className` condicional
  pra bater com o que já existe, não invente um novo).

## Passos

1. Em `src/components/client-views.tsx`, adicionar no topo (se ainda não
   existir depois dos planos anteriores):
   ```tsx
   import { AnimatePresence, motion } from "framer-motion";
   ```
2. Dentro de `PortalFaqView` (começa em `client-views.tsx:3854`), logo após
   a declaração de `termo` (linha ~3857), adicionar o estado
   `itensAbertos` e a função `toggleItem` do alvo acima.
3. Substituir o bloco `<details>...</details>` (linhas ~3955-3966, dentro
   do `.map()` de `grupo.itens`) pelo JSX alvo acima.
4. Em `src/app/globals.css`, trocar os dois seletores de atributo por
   classe conforme "Alvo" acima: `.portal-faq-accordion-item[open]`
   (linha 3054) vira `.portal-faq-accordion-item.is-open`, e
   `.portal-faq-accordion-item[open] .portal-faq-chevron-wrap` (linha
   3095) vira `.portal-faq-accordion-item.is-open .portal-faq-chevron-wrap`.
   Não mexer no corpo de nenhuma das duas regras, só no seletor.
5. Adicionar a regra `.portal-faq-accordion-content-motion { overflow:
   hidden; }` em `globals.css`, perto de `.portal-faq-accordion-item`
   (~linha 3046).

## Limites

- NÃO mudar a lógica de busca/filtro (`gruposFiltrados`, `bate`,
  `normalizarBusca`) — só a forma como cada item individual abre/fecha.
- NÃO adicionar animação de entrada/saída pros GRUPOS inteiros
  (`portal-faq-group-card`) neste plano — é sobre o accordion de
  pergunta/resposta especificamente.
- NÃO remover o atributo `key` do `.map()` nem trocar pra usar índice como
  chave — manter `item.pergunta` (ou a `chave` composta) como identidade
  estável.
- Se a estrutura do `<details>` não bater com o código citado (mudou
  desde `83cdbb8`), PARE e reporte.

## Verificação

- **Mecânica**: `npx tsc --noEmit` sem erro; `npm run lint` limpo.
- **Feel check**:
  - Clicar numa pergunta — a resposta deve expandir suavemente (altura +
    opacidade), não aparecer de golpe.
  - Clicar de novo — deve fechar suavemente, não sumir instantaneamente.
  - Digitar um termo de busca que bate em várias perguntas — todas devem
    aparecer já abertas (sem replay da animação de entrada — é aqui que o
    `initial={false}` importa).
  - Limpar a busca — os itens voltam a fechar (a menos que o usuário tenha
    clicado neles manualmente antes — confirmar que esse estado
    manual persiste corretamente).
  - Abrir várias perguntas ao mesmo tempo, clicando rápido em sequência —
    nenhuma trava ou "pula" no meio da animação.
- **Pronto quando**: abrir/fechar qualquer pergunta do FAQ tem uma
  transição visível de altura+opacidade, a busca continua forçando tudo
  aberto como antes, e nada mais quebrou.
