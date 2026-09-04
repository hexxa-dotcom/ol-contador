# Plano — Modo Escuro na Área do Contador

- **Status**: PLANEJAMENTO (nenhum código escrito ainda)
- **Commit de referência**: ver `git rev-parse --short HEAD` no momento de
  começar a execução — este documento não fixa um commit porque é só plano.

## Onde estamos hoje

Já existe um toggle de "modo escuro" em **Configurações → Aparência do
Chat** (`chat_appearance.dark`, `views.tsx:966,1639,6014,6876`), que liga a
classe `dark-mode` na casca do app inteiro
(`accountant-shell.tsx:324` — `` `app-shell ${darkModeEnabled ? "dark-mode" : ""} ...` ``).
O nome sugere que é só do chat, mas na prática ele tenta escurecer o app
inteiro — só que cobre pouquíssima coisa: **10 regras de CSS** no total
(`globals.css:48-56`), tratando sidebar, popovers, inputs e cards
genéricos. O resto do arquivo continua com cor fixa clara.

Achei o tamanho real do problema com uma varredura no
`src/app/globals.css` (8.811 linhas):

| Métrica | Valor |
| --- | --- |
| Cores hex fixas (`#rrggbb`) distintas | 133 |
| Ocorrências totais de hex fixo | 1.213 |
| Ocorrências de `rgba(...)` fixo | 676 |
| Regras com `background: #ffffff`/`white` (superfície travada no claro) | 100 |
| Regras com `color: #0f172a` (texto escuro travado, precisaria virar claro no dark) | 168 |
| Tokens de cor já definidos em `:root` | 35 (mas a maioria do CSS não os usa — usa hex direto) |

Ou seja: o design system TEM tokens (`--background`, `--foreground`,
`--card`, `--border`, `--muted`, etc.), mas a maior parte das ~8.800 linhas
de CSS não os usa — escreve a cor direto. Isso é a causa raiz de por que o
toggle atual "não faz nada" na prática: ligar `dark-mode` muda 10 regras,
mas as outras centenas continuam hardcoded.

O portal do cliente (`client-shell.tsx`) não tem NENHUMA lógica de modo
escuro — nem o toggle existe lá.

Por área (proxy de tamanho pelo nº de regras que citam a classe):

| Área | Regras no CSS (aprox.) |
| --- | --- |
| Chat / Fila de Atendimento | 174 |
| Tabelas / listas (clientes, e-mail) | 19 |
| Dashboard / stats | 21 |
| Kanban (Processos & Dossiês) | 13 |
| Financeiro | 11 |
| Modais/diálogos | 10 |

O chat é, de longe, a área mais densa — faz sentido ser o piloto, também
porque é onde você está olhando agora.

## O que "fazer direito" significa aqui

Não dá pra simplesmente "aplicar um filtro escuro" — o app usa cor pra
comunicar hierarquia (texto principal vs. secundário), estado (sucesso,
alerta, erro), e material (vidro/blur, sombra). Um modo escuro de verdade
precisa:

1. **Consolidar as ~133 cores hex + 676 rgba num punhado de tokens
   semânticos** (fundo em 2-3 níveis de profundidade, texto em 2-3 níveis de
   ênfase, borda em 1-2 intensidades, mais os tokens de acento/estado que já
   existem: coral, sucesso, alerta). A maioria das 676 ocorrências de
   `rgba(...)` já são variações de opacidade de só duas cores-base
   (`rgba(15,23,42,X)` = preto-azulado, `rgba(203,213,225,X)` = cinza-claro)
   — isso ajuda: não são 676 valores únicos, são poucos padrões repetidos
   com opacidade diferente.
2. **Trocar cada declaração hardcoded pelo token equivalente**, regra por
   regra — mecânico, mas tem volume (potencialmente mais de mil pontos).
3. **Definir o valor escuro de cada token** — isso é decisão de design, não
   só troca de sintaxe: precisa manter contraste legível (WCAG AA pelo
   menos), decidir se o dark mode é "verdadeiro preto" ou "cinza-chumbo"
   (mais fácil pros olhos, é o que a maioria dos apps profissionais usa —
   ex: o preto de fundo já usado em `.app-shell.dark-mode`,
   `#0f172a`, é um bom candidato a continuar sendo a base), e decidir o que
   acontece com o gradiente/blur/glassmorphism que o app usa bastante
   (`backdrop-filter`) — vidro no escuro se comporta diferente do vidro no
   claro.
4. **Testar cada área depois de migrada** — não só "compila", mas olhar de
   verdade (mesmo processo de feel-check dos planos de animação: abrir a
   tela, ligar o toggle, checar contraste e se nada ficou "branco sobre
   branco" ou "preto sobre preto" por engano).

## Estratégia de tokens (proposta)

Reaproveitar os tokens que já existem em `:root` (não inventar um sistema
paralelo) e completar o que falta. Hoje `:root` já tem `--background`,
`--foreground`, `--card`, `--card-border`, `--muted`, `--muted-foreground`,
`--border`, `--primary`. Faltam, no mínimo:

- Um segundo nível de fundo (`--surface-2` ou similar) pra distinguir
  "fundo da página" de "fundo de painel/coluna dentro da página" (ex: o
  fundo `#f8fafc` do `.chat-tool-rail`, usado em dezenas de lugares como
  "fundo levemente diferente do card branco").
- Um token pra borda mais forte (o `--chat-line` que acabei de criar pro
  chat é candidato a virar um token geral, ex. `--border-strong`, reutilizado
  em vez de ficar só no chat).
- Tokens de texto em pelo menos 2 níveis além do `--foreground` /
  `--muted-foreground` atuais (parece que já cobre bem, mas confirmar
  durante a migração).
- Os tokens de acento (`--coral-accent`, `--pine`, etc.) provavelmente NÃO
  mudam de valor no escuro (cor de marca se mantém), só o fundo/texto ao
  redor deles muda — confirmar caso a caso.

Mecanismo de troca: manter o padrão já usado (`.dark-mode` como classe na
raiz, ligada pela preferência salva do usuário) — não introduzir
`prefers-color-scheme` automático nesta fase (decisão consciente: o app já
tem um toggle manual funcionando e conectado a uma configuração persistida;
trocar pra detecção automática do sistema operacional é uma decisão de
produto separada, perguntar antes se quiser isso também).

## Fases propostas

### Fase 0 — Fundação de tokens (sem mudar nenhuma tela ainda)
Levantar as ~133 cores hex + padrões de `rgba()` reais do arquivo, agrupar
em tokens semânticos, decidir o valor escuro de cada um. Entregável: lista
de tokens (claro + escuro) documentada, zero risco visual porque nada muda
ainda — só cria as variáveis, sem usar em lugar nenhum.

### Fase 1 — Piloto: Chat / Fila de Atendimento
Migrar as 174 regras do chat pra usar os tokens da Fase 0, com valores
escuros de verdade (não os 2 overrides improvisados que existem hoje em
`.chat-dark`, que tratavam só composer/header). Como é a área mais densa e
mais usada, prova a abordagem inteira (incluindo o caso mais difícil: vidro
com blur sobre fundo escuro) antes de gastar esforço no resto. Ao final
desta fase, ligar o toggle já deixa o chat inteiro coerente no escuro —
mesmo que o resto do app ainda não esteja.

### Fase 2 — Resto da área do contador, por prioridade de uso
Dashboard → Clientes → Processos & Dossiês (kanban) → Agenda → Financeiro
→ Relatórios → Configurações/Equipe/Perfil → Notificações. Cada tela migra
independente (mesmo padrão de plano+execução+revisão usado nos planos de
animação), então dá pra parar entre uma e outra sem deixar nada pela
metade — mas até completar todas, o toggle vai deixar algumas telas escuras
e outras ainda claras (mesmo problema de hoje, só que cada vez menor).

### Fase 3 — Portal do cliente (fora de escopo até decidir)
`client-shell.tsx` não tem nenhuma lógica de tema hoje. Entra só se/quando
você decidir que o cliente final também deve ter modo escuro — não
está incluído nas fases acima.

## Decisões já tomadas (2026-09-04)

1. **Ativação: automático + manual.** O modo escuro detecta
   `prefers-color-scheme: dark` do sistema operacional como padrão inicial,
   mas o usuário pode sobrescrever manualmente pelo toggle em
   Configurações (a preferência manual, quando definida, tem prioridade
   sobre a detecção automática — mesmo padrão que a maioria dos apps usa:
   "Sistema" / "Claro" / "Escuro" como três estados, ou pelo menos
   "seguir o sistema" vs. a escolha manual salva).
2. **Tom do fundo: cinza-chumbo**, baseado no `#0f172a` já usado hoje em
   `.app-shell.dark-mode` — não verdadeiro preto.
3. **Cores de marca (coral, verde de sucesso, vermelho de erro): mantêm o
   hue.** Só ajustar luminosidade pontualmente se o contraste contra o
   fundo escuro ficar insuficiente (checar caso a caso durante a
   migração, não uma revisão de marca à parte).
4. **Lançamento progressivo.** Cada fase concluída já fica disponível pro
   usuário; áreas ainda não migradas continuam no claro até a fase
   seguinte (mesma situação de hoje, só que encolhendo a cada fase em vez
   de crescendo).

## Estimativa de esforço (ordem de grandeza, não compromisso)

Baseado no que os planos de animação já mostraram (uma mudança pequena e
bem especificada leva ~1 execução+revisão de ~15-20min cada): a Fase 1
sozinha (174 regras do chat) é maior que os 4 planos de animação somados —
plausivelmente precisa ser dividida em 2-3 sub-planos (ex: painel de
conversas / mensagens / composer e ações). A Fase 2 completa (resto do
app) é várias vezes esse tamanho. Isto não é uma tarde de trabalho — é um
projeto com várias sessões, mesmo indo tela por tela.
