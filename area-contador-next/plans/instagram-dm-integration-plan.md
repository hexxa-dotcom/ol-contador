# Plano — Módulo de Instagram (DM + comentário→DM) nativo

- **Status**: EM IMPLEMENTAÇÃO — schema, rotas e UI base já existem e
  compilam; falta você configurar o app da Meta (Passo 0) pra testar com
  dado real e conectar a conta.

## Recursos — o que existe hoje vs. o que dá pra adicionar

Levantamento feito comparando com o que o OpenReply oferece (referência
de mercado pra esse tipo de automação), decidindo o que faz sentido pro
caso de vocês (atendimento + captação de lead pelo Instagram, não um
produto SaaS multi-conta).

| Recurso | Status | O que faz |
| --- | --- | --- |
| Comentário → DM por palavra-chave | ✅ Feito | Alguém comenta a palavra numa campanha ativa, recebe a DM automática |
| Resposta pública opcional no comentário | ✅ Feito (UI corrigida em 2026-09-04) | Além da DM, responde publicamente embaixo do comentário — o backend já suportava, mas faltava o campo no formulário de criar campanha; corrigido |
| Personalização `{username}` na DM | ✅ Feito | Troca pelo nome de usuário de quem comentou |
| Limite de 750 envios/hora | ✅ Feito | Trava automática, respeitando o limite da Meta |
| Inbox de DM (conversas recebidas) | ✅ Feito | Aba "Instagram" na Fila de Atendimento, independente de cliente cadastrado |
| Vínculo manual com cliente cadastrado | ✅ Feito | Busca e vincula/desvincula, nunca automático |
| Filtro de comentário do próprio dono da conta | ✅ Feito | Não dispara campanha no próprio comentário |
| Renovação automática do token (~60 dias) | ✅ Feito | Cron diário, mesmo padrão dos outros crons do sistema |
| DM/resposta de Story também dispara campanha | ✅ Feito | Checkbox por campanha — "responde X nesse Story e recebe o link" |
| Editar e excluir campanha | ✅ Feito | Antes só dava pra criar e pausar/ativar |
| Link rastreado com estatística de clique | ❌ Não construído | Precisa de rota própria de redirecionamento + contador — o link hoje é enviado direto, sem métrica de clique |
| Até 2 botões de link na mesma DM | ❌ Não construído | Hoje só 1 link solto no texto |
| Follow gate (exigir seguir antes do link) | ❌ Não construído | Só faz sentido se a meta for crescer seguidores, não conversão direta — decisão de produto, não técnica |
| Templates prontos de campanha (presets) | ❌ Não construído | Conveniência de UI, não muda o que o sistema faz |
| Log dedicado de envio/falha por campanha | ❌ Não construído | Hoje o rastro fica em `webhook_eventos` (genérico, sem tela própria) — dá pra ver só direto no banco |
| Múltiplas contas de Instagram / workspaces | ❌ Fora de escopo | Vocês têm uma conta só |

Se quiser qualquer um dos itens ❌ mais pra frente, é só pedir — nenhum
deles depende de mudar a arquitetura, são adições.
- **Baseado em**: leitura da documentação técnica do OpenReply
  (`diwenne/openreply`, `docs/setup.md`) — só o guia de como ele usa a
  API oficial de Mensagens/Comentários do Instagram, não o código dele.
  Implementação nativa, dentro do `area-contador-next`.

## Escopo (decidido com o usuário em 2026-09-04)

Diferente da v1 deste plano (que tratava o Instagram como um 4º canal
espelhando o WhatsApp, amarrado a `cliente_id`), o pedido real é:

1. **Chat de Instagram é separado e independente de cadastro de
   cliente.** Quem manda DM não precisa ser cliente cadastrado — a
   conversa aparece de qualquer jeito. Vincular a um cliente existente
   é uma ação **manual e opcional** que o contador faz depois, se
   quiser (não é requisito pra conversa existir).
2. **Automação comentário→DM** (a função central do OpenReply):
   alguém comenta uma palavra-chave configurada num post/reel, recebe
   automaticamente uma DM com um link (de agendamento, de preços, etc.),
   com opção de resposta pública também no comentário.
3. Ainda mora dentro da Fila de Atendimento, como uma aba própria
   (igual a ideia original de "aba de Instagram" ao lado de
   Fila/Copiloto/WhatsApp) — mas os dados NÃO usam a tabela `mensagens`
   nem exigem `cliente_id`, por serem conceitualmente diferentes
   (suporte a cliente cadastrado vs. inbox público + captação de lead).

## Por que não usar o OpenReply direto

Mesma razão da v1: é uma aplicação separada (Next.js + Postgres + Redis +
worker, hospedada à parte). A API que ele usa é pública — replicamos o
uso dela, não o código/infra dele.

## O que a documentação deles ensinou (continua valendo)

- Produto certo no app da Meta: **"Instagram Login"**. Tipo de app:
  Business. Caso de uso: "Manage messaging and content on Instagram".
- Permissões: `instagram_business_basic` +
  `instagram_business_manage_messages` (DM) +
  `instagram_business_manage_comments` (comentário→DM — agora ENTRA no
  escopo, diferente da v1).
- Conta já confirmada como Business/Creator (item resolvido).
- Conta é de vocês mesmos → **Standard Access basta, sem App Review**.
- Pegadinha do ID: usar sempre `user_id` (ID da conta profissional),
  nunca o `id` (com escopo do app).
- Token de acesso expira (~60 dias) → precisa de cron de renovação.
- Dentro da janela de 24h da última mensagem do usuário, DM é texto
  livre; fora dela, não existe fallback de template (diferente do
  WhatsApp) — só reabre a janela se a pessoa mandar mensagem de novo.
- Limite documentado da Meta: **750 respostas privadas por hora** por
  conta — a automação de comentário precisa respeitar isso (fila com
  limite de taxa, não disparo direto).
- Um comentário próprio (do dono da conta) nunca deve disparar a
  automação nele mesmo — a Meta rejeita DM pra si mesmo de qualquer
  forma, mas filtrar antes evita erro desnecessário nos logs.
- Webhook recebe DOIS campos separados: `messages` (DM/Story reply) e
  `comments` — os dois precisam estar inscritos; assinar só um não
  ativa o outro.

## Modelo de dados (novo, separado de `mensagens`/`clientes`)

Duas tabelas novas, sem tocar no schema existente do chat interno/WhatsApp:

**`instagram_conversas`**
- `id` (uuid)
- `ig_user_id` (o `user_id` de quem mandou a DM — identidade real)
- `ig_username` (pra exibir na UI; pode mudar com o tempo, `ig_user_id`
  é o identificador estável)
- `cliente_id` (uuid, **nullable**, FK pra `clientes` — só preenchido
  quando o contador vincula manualmente)
- `ultima_mensagem_em`, `nao_lida` (pra ordenar/destacar na lista, igual
  o WhatsApp já faz)

**`instagram_mensagens`**
- `id`, `conversa_id` (FK), `sender` (`"lead"` ou `"contador"`), `texto`,
  `ig_message_id` (idempotência, mesmo padrão do `wa_message_id`),
  `created_at`

**`instagram_campanhas`** (a automação comentário→DM)
- `id`, `nome`, `post_id` (ID do post/reel monitorado, ou vazio = todos
  os posts), `palavras_chave` (array de texto), `resposta_dm` (texto
  com placeholder `{username}`, igual o OpenReply faz), `link_destino`,
  `resposta_publica_ativa` (bool), `resposta_publica_texto`, `ativa`
  (bool), `criado_em`

**`instagram_comentario_eventos`** (log/idempotência dos comentários já
processados, evita responder duas vezes ao mesmo comentário — mesmo
papel que `webhook_eventos` já cumpre pro WhatsApp, mas reaproveitar a
tabela existente também é uma opção válida se o formato dela já for
genérico o bastante — checar antes de criar uma nova).

## Rotas novas

- **`src/app/api/instagram/callback/route.ts`** — OAuth (conectar a
  conta @olacontador, roda uma vez).
- **`src/app/api/instagram/webhook/route.ts`** — GET (handshake) + POST
  processando dois tipos de evento:
  - `messages` → insere em `instagram_mensagens` (cria
    `instagram_conversas` se `ig_user_id` for novo, sem exigir cliente).
  - `comments` → confere campanhas ativas pro `post_id`, testa
    palavra-chave no texto do comentário, ignora comentário do próprio
    dono da conta, enfileira o envio da DM (respeitando o limite de
    750/h) e opcionalmente a resposta pública.
- **Envio de DM** (`src/lib/instagram.ts`, espelhando `whatsapp.ts`) —
  `sendInstagramText`, `verifyInstagramWebhookSignature`, e uma função
  de rate-limit simples (contador de envios na última hora, mesmo
  princípio do OpenReply, sem precisar de Redis — dá pra fazer com uma
  contagem na própria tabela `instagram_mensagens`/`instagram_campanhas`
  já que o volume de uma conta pequena não justifica infra nova).
- **`src/app/api/cron/instagram-token-refresh/route.ts`** — mesmo
  padrão dos crons existentes.

## Fila de Atendimento — nova aba "Instagram"

Diferente do WhatsApp (que reaproveita `selectedMessages`/`canal`),
o Instagram ganha seu próprio pedaço de estado dentro de
`AtendimentoView`, já que os dados vêm de tabelas diferentes:

- Lista de conversas: busca em `instagram_conversas` (ordenada por
  `ultima_mensagem_em`), mostrando `ig_username`, e um selo "Vinculado a
  {cliente}" quando `cliente_id` estiver preenchido.
- Ação manual "Vincular a um cliente" na conversa aberta — um campo de
  busca simples que grava `cliente_id` na `instagram_conversas`. Não é
  obrigatório pra nada funcionar.
- Uma tela/aba separada de **Campanhas** (dentro da mesma seção
  Instagram, não em Configurações) pra criar/editar/pausar campanhas de
  comentário→DM: nome, post-alvo, palavras-chave, texto da DM, link,
  toggle de resposta pública.

## O que fica de fora deste plano (mesmo assim)

- **Tracked links com estatística de clique** (o OpenReply tem isso) —
  dá pra adicionar depois; pro início, o link pode ser direto (sem
  redirecionamento próprio contando clique).
- **Follow gate** (exigir seguir antes de mandar o link) — feature do
  OpenReply, não pedida, fica de fora por padrão.
- **Múltiplas contas de Instagram / workspaces** — assume uma conta só.
- **Vincular automaticamente por nome/telefone** — a vinculação é
  manual por decisão explícita do usuário, não tentar adivinhar.

## Ordem de execução sugerida

1. Vocês fazem o Passo 0 do app da Meta (produto "Instagram Login",
   permissões incluindo `instagram_business_manage_comments`, tester,
   igual descrito na v1 deste plano — não mudou).
2. Eu implemento as 4 tabelas novas + as rotas (schema e webhook, sem
   depender de credencial real pra escrever o código).
3. Vocês passam as env vars (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
   `FACEBOOK_APP_SECRET`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`,
   `INSTAGRAM_TOKEN_ENCRYPTION_KEY`) assim que o app estiver pronto.
4. Testamos ponta a ponta: uma DM de teste vira conversa na aba nova; um
   comentário de teste com a palavra-chave de uma campanha de teste
   dispara a DM automática.
5. Eu implemento a UI completa (lista de conversas + campanhas) por
   cima, já com dado real fluindo.

## Estimativa de esforço

Maior que a v1 deste plano — agora inclui uma automação de marketing
completa (campanhas, casamento de palavra-chave, rate limit, resposta
pública opcional), não só um inbox. Ainda assim menor que rodar o
OpenReply de verdade, porque não precisa de conta de usuário/login,
múltiplos workspaces, nem os relatórios de clique — só o que vocês
realmente vão usar.
