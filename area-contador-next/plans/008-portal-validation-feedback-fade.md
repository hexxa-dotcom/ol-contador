# 008 — Fade de entrada no feedback de validação (senha, cofre gov.br)

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Physicality
- **Estimated scope**: 1 arquivo (`src/app/globals.css`), 2 regras

## Problema

Duas classes de feedback de validação/erro, usadas em fluxos sensíveis
(troca de senha do perfil, senha do cofre gov.br), não têm nenhuma
transition/animation — aparecem e somem de golpe:

```css
/* globals.css:2760-2765 — atual */
.portal-form-feedback {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}
```
```css
/* globals.css:6374 — atual */
.login-error { padding: 10px 14px; border: 1px solid rgba(220,38,38,.18); border-radius: var(--radius-control); background: rgba(254,242,242,.82); color: #b91c1c; font-size: 11px; }
```

Usadas assim (conditional render — cada montagem já é o gatilho certo pra
uma animação CSS de entrada, sem precisar de saída animada já que somem
por re-render normal, não por um botão de fechar):

```tsx
// client-views.tsx:1625-1629
{mensagem && (
  <div className={`portal-form-feedback ${erro ? "erro" : "sucesso"}`}>
    <span>{mensagem}</span>
  </div>
)}
```
```tsx
// client-views.tsx:1372, 2037, 3699 (variações do mesmo padrão)
{erro && <p className="login-error">{erro}</p>}
```

## Alvo

Reaproveitar o keyframe `fade-in` que já existe no arquivo (usado hoje só
em `.dialog-backdrop`, `globals.css:6350`), com a mesma duração/curva já
estabelecida pra ele — sem inventar um valor novo:

```css
/* globals.css:2760-2766 — target */
.portal-form-feedback {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  animation: fade-in .18s ease-out;
}
```
```css
/* globals.css:6374 — target */
.login-error { padding: 10px 14px; border: 1px solid rgba(220,38,38,.18); border-radius: var(--radius-control); background: rgba(254,242,242,.82); color: #b91c1c; font-size: 11px; animation: fade-in .18s ease-out; }
```

## Convenções do repositório a seguir

- `@keyframes fade-in { from { opacity: 0; } }` já existe em
  `globals.css:6354` — reaproveitar, não duplicar.
- Duração/curva `.18s ease-out` é a que já acompanha esse mesmo keyframe
  em `.dialog-backdrop` (`globals.css:6350`) — manter o par
  keyframe+timing como já usado, não misturar com outra curva.

## Passos

1. Confirmar que `@keyframes fade-in` existe e tem só a declaração `from
   { opacity: 0; }` (sem `to`, deixando o navegador inferir o estado final
   — comportamento válido em CSS): `grep -n "@keyframes fade-in" -A 1
   src/app/globals.css`.
2. Em `src/app/globals.css`, adicionar `animation: fade-in .18s
   ease-out;` como última propriedade da regra `.portal-form-feedback`
   (linha ~2760-2765).
3. Adicionar a mesma `animation: fade-in .18s ease-out;` como última
   propriedade da regra `.login-error` (linha ~6374) — CUIDADO: essa regra
   está toda numa linha só, então a edição é inserir `animation: fade-in
   .18s ease-out;` antes do `}` de fechamento, no meio da mesma linha, sem
   quebrar as outras propriedades já presentes.

## Limites

- NÃO adicionar animação de SAÍDA (exit) — essas mensagens não têm botão
  de fechar, elas trocam de conteúdo (nova mensagem de erro/sucesso) ou
  somem por navegação; animação de entrada já resolve o problema relatado
  (aparecer de golpe).
- NÃO mudar cor, borda, padding ou qualquer outra propriedade visual das
  duas classes — só adicionar a linha de `animation`.
- NÃO tocar em outras classes de feedback/erro do arquivo que não sejam
  exatamente `.portal-form-feedback` e `.login-error`.
- Se o keyframe `fade-in` não existir mais no arquivo (mudou desde
  `83cdbb8`), PARE e reporte em vez de criar um novo com valores
  diferentes.

## Verificação

- **Mecânica**: nenhum lint de CSS configurado — conferir visualmente que
  o arquivo continua válido (chaves balanceadas nas duas regras editadas).
- **Feel check**:
  - Trocar a senha do perfil com uma senha inválida — a mensagem de erro
    deve aparecer com um fade curto, não instantânea.
  - Trocar a senha do perfil com sucesso — a mensagem de sucesso
    (`.sucesso`) deve ter o mesmo fade.
  - Errar a senha do cofre gov.br (ou qualquer outro fluxo que usa
    `.login-error`) — mesmo fade.
- **Pronto quando**: as duas classes têm uma entrada suave em vez de
  aparecer de golpe, e nenhum outro elemento da tela foi afetado.
