# Pendências até o MVP de teste

Log do que falta para o "Olá, Contador" virar uma versão testável ponta a ponta
(cliente paga → agenda → triagem → atende no chat). Atualizado em 2026-07-17.

Legenda: **[EU]** = Claude faz no código/deploy · **[VOCÊ]** = só você consegue
(dashboard, chave de API, DNS) · **[FINAL]** = combinado de deixar pro fim.

**[RESOLVIDO 2026-07-28]** `scripts/anotacoes-atendimento.sql` rodado no Supabase
(colunas `clientes.notas`, `atendimentos_historico.notas` e `.iniciado_em`).

---

## ✅ Pronto e funcionando (dá pra testar hoje)

- **Contratação em 2 etapas (2026-07-25)** — a tela única e longa virou
  `agendamento.html` (serviço + dia + horário + resumo do caso) e
  `checkout.html` (dados + crédito + Pix), com trilha "1 → 2", resumo do pedido
  sempre visível, botão "alterar" e as escolhas preservadas ao voltar. Estilo
  compartilhado em `booking.css`. Corrigido junto:
  - preço e nome do serviço agora vêm do banco (`/api/agendamento-opcoes`) —
    antes estavam fixos no HTML e podiam divergir do que era cobrado de fato;
  - a lista de serviços saiu da tela: o plano é escolhido em `precos.html` e
    chega pelo link (`?plano=`), então o agendamento só confirma o que foi
    contratado (card verde com "alterar") e cuida do horário. Sem plano no
    link, a tela manda escolher em vez de repetir a lista;
  - horários ocupados passam a sair de `agendamentos` — antes vinham do
    localStorage, sempre vazio pra quem chega de fora, então **dois clientes
    conseguiam marcar o mesmo horário**;
  - CPF/CNPJ validado no navegador antes de chamar a API (`documento.js` agora
    roda nos dois lados), com máscara de CPF/CNPJ e telefone;
  - campo "sexo" removido do checkout; cidade/UF marcados como opcionais;
  - `?plano=` desconhecido não escolhe mais um serviço qualquer em silêncio.
- Chat em tempo real: envio otimista, confirmação de leitura (✓/✓✓), "digitando",
  separadores de data, âncora no rodapé.
- Pré-atendimento / triagem: cliente descreve o problema guiado pelo assunto,
  anexa documentos, rascunho auto-salvo, contador recebe o card no dossiê.
- Área do Cliente (Configurações): edita perfil do contador, regras da triagem e
  o catálogo de assuntos ao vivo, com validação antes de salvar.
- Configurações honestas: abas sem backend estão marcadas "Em breve" e travadas.
- Backend de IA (Groq) construído (`api/copilot.js`): resumo, rascunho, pergunta,
  diagnóstico. **Funcionando em produção** (testado 2026-07-17: `/api/copilot` modo
  resumo → 200 com texto real da Groq). `GROQ_API_KEY` está na Vercel; o redeploy
  de 2026-07-17 fez o build passar a enxergá-la.
- Copiloto no chat de atendimento (botão com o símbolo "Olá"): a IA lê o
  atendimento inteiro e sugere a próxima resposta — sempre supervisionado,
  cai no campo de mensagem pra revisar antes de enviar, nunca envia sozinho
  (2026-07-25). Sem stub no modo demo (mesma limitação do `/api/copilot`).
- Créditos de Atendimento (2026-07-25): no painel Financeiro, o contador gera um
  crédito em R$ (cortesia, reembolso, parceria) com código + link
  (`/agendamento.html?credito=CODE`). O cliente resgata digitando o código ou
  abrindo o link — cai direto confirmado no sistema (cliente criado, agendamento
  marcado, cobrança registrada como paga via crédito), sem passar pelo
  checkout/Pix. Testado ponta a ponta: geração, validação, resgate, bloqueio de
  reuso, crédito insuficiente pro serviço escolhido, e cancelamento.
- Login real — as duas opções (2026-07-25): assim que o pagamento (ou resgate de
  crédito) confirma, o cliente já recebe automaticamente um e-mail com link de
  acesso — um clique, sem senha. Quem preferir, cria uma senha depois (card
  "Acesso à sua conta" no topo da área do cliente, usando a sessão já aberta pelo
  link) e passa a poder entrar também por e-mail+senha. Testado ponta a ponta em
  produção real (chave do Supabase corrigida — ver item 2 abaixo).
- Bug crítico corrigido de quebra: `cliente.js` tinha `let ultimoDiaDesenhado`
  declarado duas vezes no topo do arquivo — `SyntaxError` que impedia o arquivo
  inteiro de carregar no navegador (login, chat, tudo). Corrigido e publicado.
- E-mails de notificação do app (Resend) — chave `RESEND_API_KEY` configurada e
  testada em produção (2026-07-25): e-mail de teste confirmado recebido. Ainda
  no remetente de teste `onboarding@resend.dev` (só entrega pra caixa do dono da
  conta Resend) — ver item no backlog sobre domínio próprio.

---

## 🔴 Bloqueadores do MVP de teste

### 1. Pagamento — Asaas (✅ RESOLVIDO 2026-07-25)
Chave de produção nova gerada e colada na Vercel (`ASAAS_API_KEY` +
`ASAAS_BASE_URL=https://api.asaas.com/v3`), testada com um checkout real —
cliente, cobrança Pix e QR code reais gerados com sucesso.

### 2. Login normal (✅ RESOLVIDO 2026-07-25)
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` na Vercel estavam com valor errado/
inválido (causa real do "não encontro nada" em vários endpoints públicos, não
só do login) — corrigidos (apagar + recriar as variáveis, coladas com cuidado).
Site URL também ajustada no Supabase. Login por link mágico testado ponta a
ponta em produção; e-mail+senha disponível como opção extra (ver acima).

### 2b. Cadastro real do cliente — ✅ RESOLVIDO (bloqueio da chave sumiu em 2026-07-25)
`agendamento.html` cria cliente de verdade (`POST /api/signup-checkout`),
gera cobrança Pix real, e agora também cria o acesso de login automaticamente
(`auth.admin.createUser`) — o erro antigo de JWT sumiu depois que a
`SUPABASE_SERVICE_ROLE_KEY` foi corrigida na Vercel (item 2). Testado em
produção: `user_id` criado e vinculado certinho.

### 3. IA em produção — ✅ RESOLVIDO (2026-07-17)
`GROQ_API_KEY` na Vercel + redeploy → copilot respondendo 200. Nada pendente.

---

## 🟡 Antes de entrar cliente REAL (não bloqueia teste interno)

- **[EU/VOCÊ]** Quando forem entrar clientes reais, desligar o acesso demonstrativo
  do portal (`TESTE_CLIENTE_SEM_LOGIN.enabled: false`) e validar o login por e-mail.
- **[RESOLVIDO 2026-07-28]** Bucket `documentos` fechado (não é mais público)
  + políticas de RLS por pasta do cliente (`scripts/storage-documentos-rls.sql`)
  + upload/leitura via URL assinada (`createSignedUrl`) em vez de `public_url`
  fixo.
- **[RESOLVIDO]** Title do `index.html` e tamanho do bundle — já corrigidos desde
  a reforma do site público (título certo, ~44KB, nada de "Bundled Page").

---

## 🟡 Segurança — configurar antes/durante o deploy (2026-07-27)

- **[RESOLVIDO 2026-07-29]** Auditoria completa do Supabase aplicada
  (`scripts/supabase-hardening-2026-07-29.sql`): Caixa Postal fechada para
  `anon` e sem falsificação de remetente; confirmação de leitura limitada à
  coluna `lida`; funções privilegiadas movidas para schema privado com wrappers
  seguros; policies com papéis explícitos e chamadas RLS cacheadas; tabela
  `clientes` adicionada ao Realtime; agendamento órfão preservado com
  `cliente_ref = null` antes da criação da FK; índices de FKs adicionados; novos
  objetos passam a exigir grants explícitos.
- **[OPCIONAL/PRO]** Ativar "Leaked password protection" em Authentication →
  Sign In / Providers → Email. O Supabase só oferece a verificação contra
  senhas vazadas no plano Pro ou superior; não é uma configuração SQL.
- **[RESOLVIDO 2026-07-28]** `CRON_SECRET` configurado na Vercel + redeploy.
  O cron de lembretes fiscais volta a autenticar de verdade (não confia mais
  só no header `x-vercel-cron`, forjável).
- **[RESOLVIDO 2026-07-28]** `ASAAS_WEBHOOK_SECRET` gerado e colado também no
  painel do Asaas (campo "Token de autenticação" do webhook). A fila do
  webhook chegou a pausar sozinha nesse meio-tempo (15 tentativas falhando —
  causa real: a URL antiga do webhook passou a cair num redirect 308 quando o
  domínio novo entrou, não a checagem de token, que ainda estava vazia).
  Reativada depois de trocar a URL pro domínio novo.
- **[RESOLVIDO]** `scripts/rate-limits.sql` já rodado no Supabase —
  `/api/signup-checkout` e `/api/resgatar-credito` com rate limiting ativo.

---

## ✅ Domínio próprio conectado (2026-07-28) — pacote completo

`olacontador.com.br` no ar (DNS propagado, `www` é o domínio real, apex e
`ola-contador.vercel.app` redirecionam 308 pra ele). Código atualizado
(canonical, Open Graph, sitemap, robots.txt, `SITE_URL` na Vercel). Supabase
(Site URL + Redirect URLs), Resend (domínio verificado, `RESEND_FROM`
configurado) e o webhook do Asaas (URL nova + token) — todos resolvidos e
apontando pro domínio novo.

## 🟡 Caixas de e-mail do domínio (backlog, sem custo)

Hoje `ola@olacontador.com.br` (usado nos links `mailto:` do site) e
`contato@olacontador.com.br` (remetente das notificações via Resend) não têm
uma caixa de entrada de verdade por trás. Plano combinado, 100% grátis:

1. **ImprovMX** (encaminhamento) — cria os aliases (`ola@`, `contato@`, etc.)
   e encaminha pro Gmail pessoal de quem for responder. Precisa de 2-3
   registros MX/TXT novos no Registro.br (cuidado pra não duplicar o SPF que
   o Resend já usa — juntar num registro só).
2. **Gmail → "Enviar e-mail como"** usando o SMTP do Resend (`smtp.resend.com`,
   porta 587, usuário `resend`, senha = API Key do Resend) — permite responder
   de dentro do Gmail normal como se fosse o endereço do domínio.

---

## 🚀 Site público — PUBLICADO (2026-07-19)

- Home nova no ar (antes: bundle ilegível de 396KB com title "Bundled Page").
  Copy revisada: autoridade real no lugar do "+2 mil atendimentos" inventado,
  urgência honesta ("Adiar é o plano mais caro"), CTA "Seu problema com a
  Receita acaba hoje", Entrar (topo) e Área do contador (rodapé).
- `/precos` no ar: PF R$199 / PJ R$399 / Sob demanda (diagnóstico R$199 abatido),
  Pix ou 3x no cartão, prazos 24h/48h, asterisco da recorrência.
- Banco alinhado: avulsos PF = 19900, novo `pj-atendimento` = 39900.
  MEI mensal segue 9700 (recorrência, preço não publicado no site).
- Fonte editável da home/preços: `index.html` e `precos.html` (raiz deste
  projeto) — são os arquivos publicados de verdade. Os `docs/ola-contador-
  site-limpo.html` e `docs/precos.html` ficaram para trás numa reforma
  anterior e não refletem o site atual; não editar por lá.

## ⏭️ Deixado pro final

- **[RESOLVIDO 2026-07-26]** `gcap` (Declaração de Ganho de Capital) não tinha
  card em `precos.html`. Virou, junto com o resto da reforma de planos, um
  ITEM dentro do plano Pessoa Física ("Vendi um imóvel, carro ou outro bem" na
  lista suspensa do agendamento) em vez de plano à parte — não precisava de
  card próprio, era duplicata de preço mesmo (R$ 199).
- **[RESOLVIDO 2026-07-26]** Radar Fiscal — o botão "Assinar" tanto na home
  quanto na área do cliente estava quebrado de verdade: `subscribeRadar()`
  (em `cliente.js`) chamava `/api/subscribe-radar`, endpoint que só existia no
  `server.js` local, nunca virou função serverless (404 em produção), e ainda
  referenciava um `OC.auth.user` que não existe em nenhum lugar do código
  (daria `ReferenceError` antes mesmo do fetch). Corrigido: `subscribeRadar()`
  agora usa `clienteLogado` (dado real já carregado) e chama `/api/recorrencia`
  — endpoint que já existe e já sabe criar assinatura no Asaas — em vez de
  criar uma 13ª função serverless (o teto do Hobby já está em 12/12). Também
  corrigido um efeito colateral: `carregarRadarFiscal()` só checava
  `clienteLogado.recorrente` (um booleano só, compartilhado com qualquer outro
  acompanhamento mensal do mesmo cliente, ex. Assessoria MEI); agora confere
  `recorrenteTipo === 'Radar Fiscal'` também. Em `precos.html`, o card saiu da
  grade dos 3 planos (virava um 4º card desbalanceado no desktop) e virou uma
  faixa horizontal separada, com botão "Já sou cliente — Ativar" apontando pro
  login — Radar Fiscal é assinatura da área do cliente, não um atendimento
  avulso pra vender no fluxo público de agendamento/Pix.
  **Limitação que ficou sem resolver:** um cliente só pode ter UM acompanhamento
  mensal rastreado por vez (`clientes.recorrente_tipo`/`asaas_subscription_id`
  é um campo só). Se alguém já tiver a Assessoria MEI Mensal ativa e assinar o
  Radar Fiscal, a assinatura antiga continua cobrando no Asaas mas o sistema
  perde o rastro dela. Resolver de verdade exige suportar múltiplas assinaturas
  por cliente — mudança de banco maior (provavelmente uma tabela
  `assinaturas` separada de `clientes`).
- **[RESOLVIDO 2026-07-26]** Acesso ao chat após o caso encerrar — decisão
  final: enquanto o caso está aberto (prazo combinado de 2 a 5 dias), o chat
  fica liberado pra tirar dúvidas daquele mesmo serviço. Quando o contador
  marca o caso como concluído (Kanban), o chat bloqueia automaticamente — **e
  isso já era assim antes desta conversa**: `finishActiveChat()` /
  `atualizarStatusCliente(id, 'done')` em `app.js` já marcam `clientes.status =
  'done'`, e tanto `app.js` quanto `cliente.js` já tratam `status === 'done'`
  como chat bloqueado. O contador já tinha (e continua tendo) o botão
  "Bloquear/Liberar chat" pra reabrir manualmente quando precisar. A área do
  cliente (documentos, relatório, nota) nunca foi bloqueada, só o chat — também
  já era assim. Nada precisou ser construído nessa parte.
  Se o cliente precisar de outro serviço depois do caso encerrado, ele já
  consegue fazer um novo agendamento **de dentro da área do cliente** (aba
  "Agendar Atendimento", que já existe e já usa `/api/checkout`) — não
  precisava de nada novo aqui também.
  A única peça que era de fato nova: **10% de desconto pra quem já é
  cliente** ao agendar um novo serviço por essa aba. Implementado em
  `api/checkout.js` e no espelho local `server.js` — antes de gerar o Pix,
  confere se existe alguma `cobrancas.status = 'paid'` anterior daquele
  `cliente_ref`; se sim, aplica 10% sobre `servico.price_cents` (arredondado)
  e manda esse valor pro Asaas e pro registro da cobrança. `cliente.js` mostra
  "(10% de desconto — de R$ X)" no resumo do Pix quando aplicado. Testado
  isoladamente contra o banco (cliente + cobrança paga de teste, criados e
  apagados na hora): R$ 399,00 → R$ 359,10 corretamente com o desconto: sem
  histórico de pagamento, o valor cheio é mantido.
  A ideia anterior de um serviço curto "atendimento de dúvida" (10-15min) foi
  descartada — o modelo de reabrir o chat manualmente + cobrar por um novo
  agendamento resolve o mesmo problema sem precisar de um serviço novo.
- **[RESOLVIDO 2026-07-28]** Template do Magic Link no Supabase trocado pro
  formato `?token_hash=...&type=magiclink` (só consumido quando o JS do
  `login.html` roda de verdade) — não fica mais vulnerável ao scanner de
  segurança do provedor de e-mail queimando o token antes do clique real.
- **[RESOLVIDO 2026-07-28]** Domínio próprio — pacote inteiro (ver seção acima).
- **[FINAL]** WhatsApp (Twilio) — chaves vazias, integração "Em breve".
- **[RESOLVIDO 2026-07-28]** Integração real com o **Integra Contador** (Serpro) —
  Caixa Postal (DTE) funcionando ponta a ponta em produção com dados reais.
  - Chaves configuradas: `SERPRO_CONSUMER_KEY/SECRET`, `SERPRO_CNPJ_CONTRATANTE`
    (62.414.421/0001-16, HEXX) e o certificado em `SERPRO_CERT_PEM_BASE64` +
    `SERPRO_KEY_PEM_BASE64`.
  - **Achados/bugs corrigidos pelo caminho**: (1) `require('axios')` — pacote
    nunca instalado — derrubava o módulo inteiro mesmo em modo simulado; (2)
    endpoint de token errado (`/token` do gateway não devolve `jwt_token`; o
    certo é `https://autenticacao.sapi.serpro.gov.br/authenticate` com header
    `Role-Type: TERCEIROS`); (3) o `fetch` nativo do Node ignora certificado
    cliente passado via `agent` — trocado por `https.request` clássico; (4) o
    certificado `.pfx` original usa criptografia legada (3DES/RC2) que o
    OpenSSL 3 do Node 24 não lê mais — resolvido extraindo cert+chave em PEM
    puro (uma vez, com o openssl do sistema) em vez de guardar o `.pfx`
    original.
  - **Situação Fiscal (SITFIS)** continua em modo simulado — é assíncrona
    (protocolo + relatório em PDF) e a leitura do PDF ainda não foi
    implementada/validada.
  - **Por cliente**: cada CPF/CNPJ consultado precisa ter uma **procuração
    eletrônica** registrada no e-CAC autorizando o CNPJ da HEXX — sem isso a
    API recusa com "não tem procuração autorizada", mesmo com tudo
    tecnicamente certo.
- **✅ RESOLVIDO (2026-07-25)** Múltiplos contadores atendendo (perfil de convidado
  com acesso limitado). O convite real (equipe.js + `api/copilot.js` modo `equipe`)
  já estava implementado, mas a tabela `staff` no banco não tinha as colunas
  `id`/`nome`/`role` que o código esperava (migração `scripts/setup-equipe.sql`
  nunca tinha rodado) — toda ação dava erro de coluna inexistente. Rodei a
  migração corrigida (`scripts/setup-equipe-v2.sql`), que também atualizou
  `is_staff()`/`my_role()` pra checar por `id` em vez de e-mail. De quebra, achei
  e corrigi um bug não relacionado que derrubava o `/api/copilot` inteiro (IA +
  equipe) em produção: `api/_lib/ia.js` usava a API antiga do pacote `pdf-parse`
  (v1), que quebrou depois que o pacote foi pra v2. Testado de ponta a ponta em
  produção (listar/convidar/remover) e funcionando.
  Ainda em aberto, só quando o volume de agenda justificar: granularidade fina de
  permissão por seção (hoje "parceiro" só esconde financeiro/config/dossiê/
  recorrentes) e se a distribuição de atendimentos entre contadores é automática
  ou manual.

---

## Relatório do Cliente — Fase 1 concluída (2026-07-17)

Feature nova pedida: a IA gera o relatório de atendimento, o contador revisa,
vira PDF branded com CRC e o cliente recebe.

- **[FEITO]** Renomeado "Receita Fiscal / Gerar Diagnóstico Final" → **Relatório do
  Cliente**. Botão no dossiê abre o modal novo (editor + prévia ao vivo).
- **[FEITO]** IA preenche (novo modo `relatorio` em `api/_lib/ia.js`): título,
  problema, solução, o que foi feito, como foi feito — em linguagem do cliente.
- **[FEITO]** Prévia editável antes de enviar; PDF real via html2pdf, com cabeçalho
  e rodapé da marca, assinatura e CRC (estilo receita). Módulo `relatorio-pdf.js`
  compartilhado pelos dois lados.
- **[FEITO]** Entrega: tabela `relatorios` (RLS: cliente lê o seu, só staff escreve)
  + card no chat + bloco "Relatórios de Atendimento" em Meus Documentos. O cliente
  baixa o mesmo PDF sob demanda.
- Verificado no ar: IA gerou conteúdo real, prévia branded renderizou, salvou,
  cliente vê e o PDF gera (`pdfGerado: true`). Um relatório de exemplo ficou na
  Ana Silva como demo.

### Fase 2 — CONCLUÍDA (2026-07-17)
- **Linha do tempo do caso**: o stepper era 100% fixo ("Malha Fina IR2025" com
  passos inventados). Agora cada passo vem do estado real — triagem enviada,
  documentos recebidos, consulta realizada, relatório entregue — e o título/status
  saem do caso de verdade. O relatório entregue fecha o caso como "Concluído".
- **Lembretes fiscais**: já existiam e são personalizados (`/api/agenda-fiscal`
  por cliente, com urgência). Verificado funcionando (IRPF com dias até o
  vencimento). Nada a construir.
- **Avaliação pós-atendimento**: nova tabela `avaliacoes` (RLS: o cliente só
  insere a própria e ninguém edita depois — nota reescrita não é nota). Card de
  estrelas aparece só quando há relatório, e some depois de avaliar.
- **NPS real no painel**: o KPI era o texto fixo "9.8 / 10". Agora é a média das
  avaliações (`/api/avaliacoes/resumo`), com o total de respostas.
- **Faxina**: removidos o modal órfão "Receita Fiscal" (que abriria vazio, pois
  quem o preenchia não roda mais), as funções mortas `generatePrescription` e
  `sharePrescriptionInChat`, o botão "Baixar PDF" que só dava toast, e os PDFs
  FALSOS em "Documentos Recebidos"/"Meus Arquivos" do portal do cliente. Os
  documentos agora são separados de verdade por quem enviou.

Dados de demonstração deixados na Ana Silva: 1 relatório e 1 avaliação (nota 5).

---

## Revisão das funções novas (2026-07-17)

Varredura de bugs pedida antes do MVP. Dois bugs achados e corrigidos, ambos no ar:

- **[CRÍTICO — corrigido]** `OCAuth.guard()` estava como bypass falso ("LOGIN
  DESATIVADO", assumindo RLS desligado). Fingia a sessão: o app se dava por logado
  mas o `sb` seguia anônimo. Com RLS ligado, `my_client_id()` voltava nulo e **toda
  escrita do cliente** (salvar/enviar triagem, anexar documento) batia no RLS →
  500. Reescrito para login automático REAL (`signInWithPassword` com a conta de
  teste do papel). Verificado: sessão real, `my_client_id`='ana-silva', triagem
  salvando 200. Bônus: resolve o acesso — os dois papéis entram sem senha.

- **[UX — corrigido]** Editor da Área do Cliente: o card do assunto se fechava
  sozinho a cada edição estrutural (trocar tipo, +pergunta/documento/opção), porque
  `desenharAssuntos` reconstruía tudo fechado. Agora preserva o estado aberto.

- **Revisados sem bug:** `triagem-catalogo.js`, `triagem.js`, o backend de IA.

### Acesso à Vercel (o "pediu senha")
Use SEMPRE a URL curta: **`ola-contador.vercel.app/contador`** ou **`/cliente`**.
A URL LONGA de cada deploy (`ola-contador-xxxxx-hexxa-s-projects.vercel.app`) cai no
login da Vercel (SSO) — é proteção da Vercel nas URLs internas, não do app. A curta
é pública e o modo dev já loga sozinho.

---

## Estado das chaves no `.env` (atualizado 2026-07-28)

| Chave                | Estado      |
|----------------------|-------------|
| SUPABASE_URL / ANON  | preenchida  |
| GROQ_API_KEY         | preenchida  |
| ASAAS_API_KEY        | preenchida  |
| ASAAS_WEBHOOK_SECRET | preenchida  |
| RESEND_API_KEY       | preenchida  |
| RESEND_FROM          | preenchida  |
| SITE_URL             | preenchida  |
| CRON_SECRET          | preenchida  |
| TWILIO_* (SID/TOKEN) | **vazia**   |
