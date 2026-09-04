# 005 — Crossfade nos dois momentos de maior carga emocional do portal

- **Status**: TODO
- **Commit**: 83cdbb8
- **Severity**: HIGH
- **Category**: Missed opportunity / Physicality
- **Estimated scope**: 1 arquivo (`src/components/client-views.tsx`), 2 componentes (`PortalTriagemView`, `PortalAgendaView`)

## Problema

Dois momentos do portal do cliente têm carga emocional alta (terminar o
questionário obrigatório de pré-atendimento; confirmar um agendamento já
pago) e os dois trocam de conteúdo instantaneamente, sem nenhum
reconhecimento visual — a tela simplesmente "pisca" pro novo estado.

**1. `PortalTriagemView` — resumo vs. formulário** (`client-views.tsx:2509-2741`):

```tsx
// atual — linha 2509
{mostrarResumo ? (
  <Card className="triagem-resumo-card">
    {/* ... resumo do diagnóstico enviado ... */}
  </Card>
) : (
  <>
    {/* ... formulário de 3 passos ... */}
  </>
)}
```

**2. `PortalAgendaView` — pagamento pendente vs. confirmado**
(`client-views.tsx:1804-1854`):

```tsx
// atual — linha 1804
{pago ? (
  <div className="portal-checkout-success">
    <div className="portal-checkout-success-icon">
      <CheckCheck size={28} />
    </div>
    <h3 className="portal-checkout-success-title">Agendamento Confirmado com Sucesso!</h3>
    {/* ... */}
  </div>
) : (
  <div className="portal-checkout-pending">
    {/* ... QR code do Pix, status "aguardando confirmação" ... */}
  </div>
)}
```

Nenhum dos dois usa `framer-motion` hoje (`client-views.tsx` não importa a
biblioteca em nenhum lugar — confirmado por grep). `framer-motion` já é
dependência do projeto (usada nas páginas públicas e, desde a auditoria
anterior, em `client-shell.tsx` e `accountant-shell.tsx`).

## Alvo

Mesmo padrão nos dois lugares: `AnimatePresence mode="wait"` com um
`motion.div` por branch, chaveado por uma string estável, fade + leve
deslocamento vertical. Sem alterar NADA do conteúdo interno de cada branch
— só envolver.

**1. `PortalTriagemView`:**

```tsx
// target — substitui só a abertura/fechamento do ternário, conteúdo interno idêntico
<AnimatePresence mode="wait">
  {mostrarResumo ? (
    <motion.div
      key="triagem-resumo"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="triagem-resumo-card">
        {/* ...conteúdo inalterado, linhas 2510-2550... */}
      </Card>
    </motion.div>
  ) : (
    <motion.div
      key="triagem-form"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ...conteúdo inalterado, linhas 2552-2740 (era um <>...</>, vira o motion.div acima)... */}
    </motion.div>
  )}
</AnimatePresence>
```

**2. `PortalAgendaView`:**

```tsx
// target — dentro de <Card className="portal-checkout-card">, substitui o ternário das linhas 1804-1854
<AnimatePresence mode="wait">
  {pago ? (
    <motion.div
      key="checkout-success"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="portal-checkout-success"
    >
      <motion.div
        className="portal-checkout-success-icon"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      >
        <CheckCheck size={28} />
      </motion.div>
      <h3 className="portal-checkout-success-title">Agendamento Confirmado com Sucesso!</h3>
      {/* ...resto do conteúdo inalterado... */}
    </motion.div>
  ) : (
    <motion.div
      key="checkout-pending"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="portal-checkout-pending"
    >
      {/* ...conteúdo inalterado... */}
    </motion.div>
  )}
</AnimatePresence>
```

Note que o `<div className="portal-checkout-success">`/`<div
className="portal-checkout-pending">` original vira o PRÓPRIO
`motion.div` (a classe migra pra ele, não fica um `<div>` redundante por
dentro) — mesma técnica já usada no plano 004 pro card do kanban.

## Convenções do repositório a seguir

- Import: `import { AnimatePresence, motion } from "framer-motion";` — já
  usado exatamente assim em `client-shell.tsx` (não precisa reimportar se
  o plano de correção do popover/toast do client-shell já rodou nesse
  arquivo — mas `client-views.tsx` é um arquivo diferente, então precisa do
  import próprio aqui).
- Duração/curva: `cubic-bezier(0.16, 1, 0.3, 1)` é o token dominante do
  projeto — usado em vez de inventar um novo.
- `mode="wait"` AQUI é intencional (diferente do plano 002, que não
  precisou): os dois branches ocupam o mesmo espaço/linha do layout — sem
  `mode="wait"` os dois ficariam sobrepostos brevemente durante a transição
  em vez de um esperar o outro sair primeiro.

## Passos

1. Em `src/components/client-views.tsx`, adicionar no topo:
   ```tsx
   import { AnimatePresence, motion } from "framer-motion";
   ```
2. Em `PortalTriagemView`, localizar o ternário `{mostrarResumo ? (` na
   linha 2509 e `) : (` na linha 2551 e `)}` de fechamento na linha 2741
   (confirme via `grep -n "mostrarResumo ? ("` e a indentação de 6 espaços
   antes de editar — o conteúdo interno de cada branch NÃO muda, só a
   abertura/fechamento). Envolver com `<AnimatePresence mode="wait">` e
   trocar `<Card className="triagem-resumo-card">`/`</Card>` (branch
   verdadeiro) e `<>`/`</>` (branch falso, linhas 2552/2740) pelos
   `motion.div` do alvo acima, com o `className` do Card preservado nele
   mesmo (`<motion.div key="triagem-resumo" ... > <Card
   className="triagem-resumo-card"> ...` — o Card continua existindo
   DENTRO do motion.div nesse caso, diferente do checkout; só o branch
   falso é que perde o Fragment em favor do motion.div direto).
3. Em `PortalAgendaView`, localizar o ternário `{pago ? (` na linha 1804
   até o `)}` de fechamento na linha 1854 (confirme via grep antes de
   editar). Envolver com `<AnimatePresence mode="wait">` e migrar as
   classes `portal-checkout-success`/`portal-checkout-pending` pros
   `motion.div` como no alvo acima. Adicionalmente, envolver só o ícone de
   sucesso (`<div className="portal-checkout-success-icon"><CheckCheck
   size={28} /></div>`, linhas 1806-1808) num `motion.div` próprio com o
   pop de escala especificado, com um `delay: 0.05` pra ele aparecer
   ligeiramente depois do card (não junto).

## Limites

- NÃO mudar nada do conteúdo interno de nenhum dos 4 branches — só a
  tag de abertura/fechamento e a adição das props de animação.
- NÃO aplicar esse padrão em outros ternários do arquivo (existem vários
  — este plano é só sobre estes 2 pontos específicos).
- NÃO adicionar confete, som, ou qualquer elemento novo — só a transição
  de entrada/saída do conteúdo que já existe.
- Se as linhas citadas não baterem com o código atual (mudou desde
  `83cdbb8`), PARE e reporte.

## Verificação

- **Mecânica**: `npx tsc --noEmit` sem erro; `npm run lint` limpo.
- **Feel check**:
  - Preencher a triagem até o fim e enviar — o card de resumo deve
    aparecer com um fade+leve subida, não um corte seco.
  - Clicar "Editar informações" no resumo — o formulário deve voltar com
    a mesma transição, sem sobrepor visualmente o resumo saindo.
  - Simular/aguardar um pagamento confirmar no checkout — o ícone de
    sucesso deve aparecer com um leve "pop" de escala, ligeiramente atrasado
    em relação ao resto do card.
  - Reduzir a velocidade no DevTools Animations panel e confirmar que os
    dois estados nunca ficam visíveis ao mesmo tempo (por causa do
    `mode="wait"`).
- **Pronto quando**: os dois momentos têm uma transição visível de
  entrada/saída, sem sobreposição, e nada mais quebrou.
