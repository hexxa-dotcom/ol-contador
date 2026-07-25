# Pendências até o MVP de teste

Log do que falta para o "Olá, Contador" virar uma versão testável ponta a ponta
(cliente paga → agenda → triagem → atende no chat). Atualizado em 2026-07-17.

Legenda: **[EU]** = Claude faz no código/deploy · **[VOCÊ]** = só você consegue
(dashboard, chave de API, DNS) · **[FINAL]** = combinado de deixar pro fim.

---

## ✅ Pronto e funcionando (dá pra testar hoje)

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

---

## 🔴 Bloqueadores do MVP de teste

### 1. Pagamento — Asaas (atualizado 2026-07-24: já não é falta de chave)
`ASAAS_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já estão preenchidas no `.env` local.
Testado ponta a ponta local (login real → RLS → serviço → cliente → Asaas): passou
por tudo, chegou no Asaas de verdade e só barrou no CPF fictício da Ana Silva
(dado de demo, não é bug). **A chave local funciona.**

Corrigido de quebra: `server.js` (rota de checkout local) usava a chave anon do
Supabase pra ler `servicos`/`cobrancas`, e o RLS dessas tabelas hoje bloqueia leitura
anônima — sempre dava 404 antes de chegar no Asaas. Passou a usar `service_role`
(mesmo padrão que `api/checkout.js` já usava). Só afeta o ambiente local; a Vercel
já estava certa.

**Bloqueio real que sobra — no backlog, sem prioridade por ora:** a `ASAAS_API_KEY`
configurada **na Vercel** (Production) não é aceita pelo Asaas ("não parece ser uma
chave de API válida" — testado direto contra `ola-contador.vercel.app/api/checkout`).
A variável existe lá (configurada há ~23h), só o valor está errado — provável espaço/
quebra de linha ao colar, ou colou outra coisa (ex. Wallet ID) no lugar da chave de
API. **[VOCÊ]** reabrir o Asaas → Integrações → Chave de API do Sandbox, copiar de
novo com cuidado, colar em Vercel → Settings → Environment Variables → `ASAAS_API_KEY`
(Production) e redeploy. Nenhuma ação minha aqui — é conteúdo secreto.

### 2. Login normal (hoje só funciona pelo modo dev)
Do `MODO-DEV.md`:
- **[VOCÊ]** Supabase → Authentication → Emails → Magic Link precisa conter `{{ .Token }}`
  (hoje manda botão de link; a tela de login espera o código de 6 dígitos).
- **[VOCÊ]** Supabase → Authentication → URL Configuration → Site URL =
  `https://ola-contador.vercel.app`.

### 2b. Cadastro real do cliente — ✅ construído (2026-07-25), com 1 bloqueio novo
`agendamento.html` (site público) agora cria cliente de verdade: `POST
/api/signup-checkout` valida CPF/CNPJ (dígito verificador — vira o `id` do
cliente), cria a linha em `clientes` com nome/e-mail/telefone/sexo/cidade/estado,
gera a cobrança Pix real no Asaas e mostra o QR na hora. Testado ponta a ponta
local: QR real gerado, dado salvo certinho no Supabase. `confirmCobranca` (que
já cria o agendamento quando o Pix é pago) agora também tenta criar o acesso de
login do cliente nesse momento — só depois de pago, de propósito, pra não sobrar
conta órfã de quem preencheu e não pagou.

**Bloqueio novo:** essa criação de acesso (`auth.admin.createUser`) falha com
`invalid JWT: unrecognized JWT kid` — o `SUPABASE_SERVICE_ROLE_KEY` no `.env`
está no formato novo (`sb_secret_...`), que funciona liso pra tabela/dados mas
a API de Auth do Supabase ainda não aceita esse formato pra operações admin como
criar usuário. Não derruba o pagamento/agendamento (isso já funciona), só a
parte de criar o login automaticamente fica pendente até resolver a chave.
**[VOCÊ]**: no Supabase → Settings → API, ver se ainda existe a opção de pegar
a `service_role key` no formato antigo (JWT longo, 3 partes separadas por
`.`) e trocar no `.env`; senão, é esperar o Supabase/supabase-js suportarem o
formato novo nesse endpoint específico. Não mexi na chave — é conteúdo secreto.

### 3. IA em produção — ✅ RESOLVIDO (2026-07-17)
`GROQ_API_KEY` na Vercel + redeploy → copilot respondendo 200. Nada pendente.

---

## 🟡 Antes de entrar cliente REAL (não bloqueia teste interno)

- **[EU/VOCÊ]** Quando forem entrar clientes reais, desligar o acesso demonstrativo
  do portal (`TESTE_CLIENTE_SEM_LOGIN.enabled: false`) e validar o login por e-mail.
- **[EU]** Fechar o bucket `documentos` (hoje público).
- **[EU]** Corrigir title do `index.html` ("Bundled Page") e olhar o bundle de ~400KB.

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
- Fonte editável da home/preços: `docs/ola-contador-site-limpo.html` e
  `docs/precos.html` — editar lá e copiar pra cá. Backup do bundle antigo
  no scratchpad da sessão.

## ⏭️ Deixado pro final

- **[FINAL/VOCÊ]** Conectar domínio próprio (Registro.br, apex + www) ao projeto Vercel.
- **[FINAL]** E-mail (Resend) e WhatsApp (Twilio) — chaves vazias, integrações "Em breve".
- **[FINAL]** Integração com a API oficial **Integra Contador** (Serpro), usando o
  certificado digital e a chave de API que o usuário já possui e usa em outro
  sistema (mesmo modelo: certificado + API key fazem a ponte com o e-CAC/Receita).
  Não é gambiarra de navegador nem precisa de contrato/homologação novos — é
  reaproveitar acesso já pago. Caso de uso definido (2026-07-24): cliente recorrente
  que fez parcelamento no atendimento; depois de assinar procuração eletrônica
  (passo manual, fora do sistema), o "Olá, Contador" consulta mensalmente/sob
  demanda os parcelamentos dele via API e mostra numa aba "Guias" no dossiê do
  contador e no portal do cliente — isso vira o gancho pra cobrar a mensalidade
  de acompanhamento recorrente (mesmo mecanismo do MEI mensal já citado no site).
  Custo por requisição é baixo (centavos), volume baixo (1 cliente = poucas
  chamadas/mês), então não é bloqueio de custo. **[VOCÊ]** precisa fornecer o
  certificado `.pfx` (arquivo + senha, tratado como segredo, nunca em texto no
  chat) e a chave de API do Integra Contador (mesmo fluxo do .env: abro no
  TextEdit, você cola). **[EU]** construo a function de consulta depois disso.
  Fica atrás de login real + Asaas testado na fila, mas é o próximo passo natural
  de valor depois que o MVP básico estiver rodando com clientes de verdade.
- **[FINAL]** Múltiplos contadores atendendo (perfil de convidado com acesso limitado).
  Objetivo: suprir a demanda da agenda trazendo outros contadores, cada um com uma
  área própria e permissões reduzidas (não é o mesmo nível de acesso do admin).
  Hoje o "Convidar" em Configurações → Equipe é só fachada (equipe.js insere um
  card na tela, não persiste, não manda e-mail — ver conversa 2026-07-24). A base
  de RLS já existe (tabela `staff` + função `is_staff()`), mas falta desenhar: convite
  real com e-mail, granularidade de permissão (vê só a própria fila? financeiro?
  catálogo?), e se a distribição de atendimentos é automática ou manual. Decisão:
  só faz sentido resolver quando o volume de agenda já estiver justificando —
  antes disso qualquer regra de permissão seria chute. Login real + Asaas testado
  continuam sendo prioridade antes disso.

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

## Estado das chaves no `.env` (2026-07-17)

| Chave                | Estado      |
|----------------------|-------------|
| SUPABASE_URL / ANON  | preenchida  |
| GROQ_API_KEY         | preenchida  |
| ASAAS_API_KEY        | **vazia**   |
| RESEND_API_KEY       | **vazia**   |
| TWILIO_* (SID/TOKEN) | **vazia**   |
