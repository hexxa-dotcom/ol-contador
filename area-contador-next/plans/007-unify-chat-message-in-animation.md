# 007 — Unificar a animação de entrada da mensagem de chat (contador vs. cliente)

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Cohesion / Tokens
- **Estimated scope**: 1 arquivo (`src/app/globals.css`), 2 regras + 1 keyframe removido

## Problema

Contador e cliente conversam na MESMA thread de mensagens, mas cada lado
usa uma animação de entrada diferente pra bolha de mensagem — mesmo evento
("mensagem chegou"), ritmo diferente:

```css
/* globals.css:4941 — lado do contador (base .chat-message) — atual */
.chat-message { display: flex; animation: message-in .2s ease-out; }
```
```css
/* globals.css:6357 — keyframe do contador — atual */
@keyframes message-in { from { opacity: 0; transform: translateY(5px); } }
```
```css
/* globals.css:1894-1902 — lado do cliente (.portal-chat-card .chat-message) — atual */
.portal-chat-card .chat-message {
  display: flex;
  animation: messageIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

O lado do CLIENTE está mais correto (usa o token `cubic-bezier(0.16, 1,
0.3, 1)` estabelecido no resto do projeto); o lado do CONTADOR usa
`ease-out` puro, que é uma curva mais fraca — é ele quem precisa mudar pra
bater com o padrão certo, não o contrário.

## Alvo

Uma fonte única de verdade: a regra base `.chat-message` passa a usar os
valores do lado do cliente (que já estão certos), e a regra específica do
portal é removida por virar redundante (herda da base).

```css
/* globals.css:4941 — target */
.chat-message { display: flex; animation: message-in .22s cubic-bezier(0.16, 1, 0.3, 1); }
```
```css
/* globals.css:6357 — target */
@keyframes message-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
```

```css
/* globals.css:1894-1902 — REMOVER inteiramente (a regra e o keyframe messageIn) */
.portal-chat-card .chat-message {
  display: flex;
  animation: messageIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Depois da remoção, `.portal-chat-card .chat-message` herda a regra base
`.chat-message` (que já dá `display: flex` + a animação certa) — nenhum
efeito visual perdido, só a duplicação removida.

## Convenções do repositório a seguir

- Token de easing: `cubic-bezier(0.16, 1, 0.3, 1)`, já o mais usado no
  arquivo inteiro.
- `@keyframes message-in` ganha o `to { opacity: 1; transform:
  translateY(0); }` explícito que faltava na versão do contador (a versão
  antiga só tinha o `from`, deixando o navegador inferir o estado final a
  partir do computed style — funciona, mas o keyframe do cliente já era
  mais explícito e completo; manter a versão mais completa).

## Passos

1. Confirmar antes de editar que nenhuma outra regra referencia
   `messageIn` (case-sensitive, diferente de `message-in`):
   `grep -n "messageIn\b" src/app/globals.css` — deve retornar só as
   linhas 1896 e 1899 citadas acima. Se retornar mais alguma coisa, PARE e
   reporte em vez de remover.
2. Em `src/app/globals.css`, editar a linha 4941:
   ```diff
   -.chat-message { display: flex; animation: message-in .2s ease-out; }
   +.chat-message { display: flex; animation: message-in .22s cubic-bezier(0.16, 1, 0.3, 1); }
   ```
3. Editar a linha 6357:
   ```diff
   -@keyframes message-in { from { opacity: 0; transform: translateY(5px); } }
   +@keyframes message-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
   ```
4. Remover inteiramente o bloco das linhas 1894-1902 (a regra
   `.portal-chat-card .chat-message` e o `@keyframes messageIn`), incluindo
   a linha em branco entre eles se houver, mas preservando a linha em
   branco que separa esse bloco das regras vizinhas (`.portal-chat-card
   .chat-message.agent` antes/depois — confirme visualmente que a remoção
   não gruda duas regras diferentes sem espaço).

## Limites

- NÃO tocar em nenhuma outra regra `.portal-chat-card .chat-message.*`
  (existem várias: `.agent`, `.client`, `> div`, `p`, `small`, etc.) — só
  a regra base sem modificador e o keyframe `messageIn`.
- NÃO mudar a duração/curva de nenhuma OUTRA animação do chat (composer,
  header, capsule, etc.) — só a entrada da bolha de mensagem.
- Se o grep do passo 1 encontrar mais usos de `messageIn`, ou se as linhas
  citadas não baterem com o código atual, PARE e reporte.

## Verificação

- **Mecânica**: `npx tsc --noEmit` (CSS não afeta TS, mas rodar por
  consistência); nenhum lint de CSS configurado — só checar visualmente
  que o arquivo continua um CSS válido (sem chave sobrando).
- **Feel check**:
  - Abrir o chat do lado do CONTADOR (Fila de Atendimento) e mandar uma
    mensagem — a entrada deve continuar suave, agora com uma curva
    ligeiramente mais "assentada" (cubic-bezier em vez de ease-out).
  - Abrir o chat do lado do CLIENTE (portal) — a entrada deve parecer
    idêntica à do contador agora (mesma duração, mesma curva).
  - Comparar os dois lado a lado (duas abas) mandando mensagem de cada —
    o "ritmo" de aparecimento deve ser o mesmo dos dois lados.
- **Pronto quando**: existe um único keyframe (`message-in`) usado pelos
  dois lados, com os mesmos valores, e nenhuma bolha de mensagem parou de
  animar.
