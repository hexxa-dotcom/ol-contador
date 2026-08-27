# Pendências — Olá, Contador (migração legado → area-contador-next)

> Última atualização: 2026-08-27 (WhatsApp validado ponta a ponta no número de teste; falta só número de produção)
> Este arquivo é o ponto único de referência das pendências em aberto. Qualquer agente/sessão nova deve ler este arquivo primeiro para entender o que falta.

## ✅ Domínio de produção — RESOLVIDO em 2026-08-21
`www.olacontador.com.br` e `olacontador.com.br` agora apontam pro projeto **novo** `area-contador-next` (`vercel alias set`, confirmado via curl — HTTP 200, footer com o Instagram novo aparece). O domínio antigo apontava pro app legado (`ola-contador`); isso não é mais o caso.

## 🟡 Credenciais / variáveis de ambiente ainda sem valor real (Vercel, projeto `area-contador-next`)

Sem fonte disponível ainda:
- **RESEND_API_KEY** — nunca teve valor real (nem no legado). Precisa gerar em resend.com.
- **GOVBR_VAULT_KEY** — provavelmente vazia em produção. Dá pra gerar uma nova localmente, mas isso é uma chave de criptografia — **pedir confirmação explícita ao usuário antes de gerar/aplicar**.
- **SERPRO_CND_\*** (4 vars) e **SERPRO_DIVIDA_ATIVA_\*** (4 vars) — credenciamentos separados no portal SERPRO, nunca configurados (é greenfield, sem código de integração ainda).
- **OPENROUTER_API_KEY / OPENROUTER_MODEL** — deixadas vazias de propósito, uso futuro, não é prioridade agora.
- ~~**TWILIO_\*** — usuário decidiu não usar Twilio~~ — removido do código em 2026-08-21, substituído pela WhatsApp Cloud API (Meta). Ver seção WhatsApp abaixo.

Já resolvidas (contexto, não precisa mexer):
- ASAAS_*, CRON_SECRET, GROQ_*, OPENAI_API_KEY, RESEND_FROM, GROQ_MODEL/VISION_MODEL — reimportadas de fonte confiável em 2026-08-19.
- SERPRO Integra Contador (OAuth2 + mTLS) — funcionando em produção desde 2026-08-20. Certificado e-CNPJ (HEXX SERVIÇOS DIGITAIS LTDA) válido até **2027-01-08** — vai precisar repetir o processo de extração do `.pfx` quando vencer.

⚠️ **Cuidado ao verificar:** `vercel env pull` (e `vercel env ls`) sempre retorna vazio pra variáveis marcadas "Sensitive" na Vercel, mesmo quando o valor real existe. Nunca usar isso pra validar credencial. Formas corretas: confiar na confirmação do `vercel env add`, testar via efeito observável (chamar o endpoint que usa a credencial), ou comparar com um `.env` local em texto puro que nunca passou por `pull`.

## 🟢 Notificações e e-mails

- **E-mails do Supabase Auth em inglês** — o projeto não versiona templates customizados; está usando os templates default do Supabase (confirmação de cadastro, magic link, reset de senha, convite, troca de e-mail, reautenticação), todos em inglês. Já escrevi os 6 textos em português (tom amistoso, sem jargão contábil), prontos em [docs/supabase-email-templates-pt-br.md](docs/supabase-email-templates-pt-br.md).
  - **Ação:** aplicar via Supabase Dashboard → Authentication → Email Templates. Consigo aplicar automaticamente pela API assim que o conector MCP do Supabase for autorizado (usuário precisa autorizar em claude.ai → configurações de conectores, ou via `/mcp` numa sessão interativa).
- **Aviso de "processo concluído" depende do RESEND_API_KEY** — quando o Kanban de Acompanhamento muda pro status "concluído", o sistema tenta mandar e-mail pro cliente (`src/app/api/operations/route.ts:20,86-89`). Como `RESEND_API_KEY` ainda está vazia (ver pendência acima), o envio é silenciosamente pulado — o status muda no banco normalmente, mas o cliente não é avisado. Resolve sozinho assim que a chave da Resend for configurada, não precisa mexer em código.
- **Gap separado no Atendimento Express:** diferente do Kanban de Acompanhamento, quando um atendimento Express vira "concluído" **não existe e-mail configurado** nesse fluxo (`EXPRESS_AVISO_POR_STATUS` em `operations/route.ts` não tem entrada pra `concluido`). Isso não é sobre a chave da Resend — é falta de código mesmo. Ainda não decidido se o usuário quer esse aviso; perguntar antes de implementar.

## 🟡 WhatsApp integrado (Cloud API da Meta) — FUNCIONANDO no número de teste, falta número de produção

Decisão: usar a WhatsApp Cloud API oficial da Meta (não Baileys/Z-API/Evolution, que violam os termos e arriscam banimento do número). Chat do WhatsApp vive dentro da própria "Fila de Atendimento" da área do contador, como uma terceira ferramenta ao lado de "Fila" e "Copiloto" (não é uma aba separada) — troca a lista de conversas e filtra as mensagens por canal, sem misturar com o chat interno. Plano completo salvo em `~/.claude/plans/melodic-giggling-parasol.md`.

**Status em 2026-08-27: ponta a ponta validado, rodando no número de teste da Meta.**
- Webhook (`/api/whatsapp/webhook`) recebendo e processando mensagens reais — confirmado via logs de produção (POST 200).
- App "Ola-contador" (App ID `1333162505291515`, WABA `1114295581165367`) inscrito corretamente na conta (`subscribed_apps`) — o problema anterior era que a WABA estava assinada em outro app (`WA DevX Webhook Events 1P App`), corrigido via API.
- Token de acesso: **System User permanente** (`SYSTEM_USER`, sem expiração, escopos `whatsapp_business_management` + `whatsapp_business_messaging`) — gerado via Business Manager → Usuários do sistema, não pelo app dashboard (lá só dá token temporário de 1-2h).
- Template `aviso_generico` (categoria UTILITY, 2 variáveis — assunto/corpo, cliente) submetido pra aprovação da Meta, status `PENDING` em 2026-08-27.
- Template `aviso_admin_nova_solicitacao` (categoria UTILITY, header + 3 variáveis — cliente/serviço/valor — + botão URL pro `/painel`) submetido em 2026-08-27, status `PENDING`. Dedicado só pro aviso interno, mais detalhado que o genérico.
- `notify.ts`: `notifyCliente()` agora dispara **e-mail E WhatsApp em paralelo** sempre que o cliente tiver os dois configurados (antes era um OU outro, baseado em `canal_resultado`). Cobre automaticamente todos os pontos que já chamavam essa função: pagamento aprovado (`pagamento.ts`), agendamento via créditos (`checkout/redeem/route.ts`), mudança de status no Kanban e no Express (`operations/route.ts`), lembretes (`cron/reminders/route.ts`).
- Nova função `notify.notifyAdminNovaSolicitacao({ cliente, servico, valorCents })` — avisa o contador (não o cliente) via WhatsApp quando entra uma compra nova (`pagamento.ts`, logo após a notificação do cliente), usando o template `aviso_admin_nova_solicitacao` (formata o valor em R$ automaticamente). Usa `WHATSAPP_ADMIN_PHONE` (número pessoal do usuário, `+5547984935695` — já cadastrado como destinatário de teste) e `WHATSAPP_ADMIN_TEMPLATE_NAME`.
- Template `resumo_diario` (categoria UTILITY, header + 1 variável de corpo livre + botão pro `/painel`) submetido em 2026-08-27, status `PENDING`. Novo endpoint `src/app/api/cron/whatsapp-digest/route.ts` monta o resumo (agenda de hoje via tabela `agendamentos` + Atendimento Express pendente via `atendimentos_express`, nomes via join em `clientes`) e manda pro WhatsApp do contador via `notify.notifyAdminResumoDiario(texto)`. Registrado em `vercel.json` pra rodar 1x/dia às 8h Brasília (`0 11 * * *` UTC), mesmo padrão de auth (`CRON_SECRET`) do `cron/reminders`. Env var `WHATSAPP_DIGEST_TEMPLATE_NAME` já setada na Vercel.

**Pesquisa de custo/regras feita em 2026-08-27** (docs oficiais da Meta):
- Utility message pro Brasil: **~US$ 0,0068/mensagem** (~R$ 0,03–0,04) — irrelevante frente ao valor do serviço.
- Categoria utility é rígida quanto a conteúdo promocional — má classificação repetida pode gerar recategorização automática pra MARKETING (sem aviso, desde abr/2025) e bloqueio de criação de templates utility por até 30 dias.
- A partir de **1º de outubro de 2026**, a Meta passa a cobrar mensagem utility mesmo dentro da janela de 24h (hoje é grátis) — decidido usar template em todo evento de negócio, sem tentar explorar a janela.

**🔴 Único bloqueio real: número de teste não serve pra clientes reais.**
O número de teste (`+1 555-205-2539`) só consegue **enviar** mensagem (template ou texto livre) pros até 5 números manualmente cadastrados na allow list de destinatários de teste — não tem contorno via API, é limite físico do modo `SANDBOX`. Enquanto isso:
- E-mail continua funcionando 100% normal pra todos os clientes.
- WhatsApp só chega pros números na allow list (ex: o do usuário, pra receber o aviso de nova compra).
- Nada quebra — o envio de WhatsApp pra número fora da lista falha silenciosamente, sem derrubar o fluxo.

Usuário está comprando uma linha (decidiu por pós-pago, não pré-pago — chip pré-pago sem recarga é reciclado pela operadora em ~90-180 dias, risco de perder o número pra outra pessoa depois de já registrado na Meta).

**🟡 Aguardando aprovação dos 2 templates (`aviso_generico`, `aviso_admin_nova_solicitacao`) — checar status e fazer redeploy quando aprovar.**
Código e env vars já estão prontos e no ar; falta só a aprovação da Meta (costuma sair em minutos a poucas horas) + um redeploy manual (Vercel dashboard → Deployments → ⋯ → Redeploy — não é automatizável, trava de segurança do Claude Code) pra pegar as env vars novas.

**Próximo passo quando o chip/linha chegar:**
1. No app "Ola-contador" → Casos de Uso → WhatsApp → Configuração da API → "Adicionar número de telefone", cadastrar o número real **dentro da mesma WABA `1114295581165367`** (não criar uma WABA nova — evita ter que reconfigurar permissão do System User).
2. Verificar com o código SMS/ligação.
3. Passar o novo `Phone Number ID` (o `WABA ID` continua o mesmo) pra trocar `WHATSAPP_PHONE_NUMBER_ID` na Vercel.
4. Registrar de novo o webhook + verify token nesse número (mesmo processo já validado no de teste).
5. Redeploy de produção.

Depois disso, todas as notificações (cliente + admin) passam a valer pra qualquer número, sem limite de allow list.

**Nota sobre criação de números pela Meta:** não existe número "grátis emitido pela Meta" fora do de teste — toda vez que aparece um número novo tipo `+1 555-xxx-xxxx` no fluxo de criação de app/caso de uso, é outro número de demonstração (mesma trava de allow list), não produção. Produção sempre exige um número real (seu, linha dedicada, ou virtual/VoIP) verificado por SMS/ligação uma única vez — depois disso não precisa mais do aparelho físico, só existiu pra passar por aquela verificação.

**Limitação conhecida da V1:** mensagem de número não cadastrado como cliente não vira conversa (só fica registrada em `webhook_eventos`) — não há inbox de números desconhecidos ainda.

**Discussão em aberto:** usuário mencionou querer discutir mais sobre a estratégia de WhatsApp depois (possível CRM mais completo, segundo número dedicado só pra suporte separado do de notificação). Fica pra depois do número de produção estar rodando.

## 🔵 Produtos SERPRO planejados para o futuro (Radar Fiscal)

Além do Integra Contador (já ativo) e CND/Dívida Ativa (pendentes acima), o usuário pretende contratar:
- Consulta CND: https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnd/
- Consulta CNPJ: https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnpj/
- Consulta Restituição (IR): https://loja.serpro.gov.br/consulta-restituicao/product/ConsultaRestituicao
- Consulta Renda (por CPF): https://loja.serpro.gov.br/consulta-renda/product/consultarenda
- Consulta de faturamento — produto SERPRO ainda não identificado/linkado

Ainda não há chaves nem código de integração pra nenhum desses — é só a lista do que ele vai contratar, na ordem que for fechando cada um.

---

*Fontes: memórias em `~/.claude/projects/-Users-filipeheck-Downloads-Meus-Projetos-Ol---Contador/memory/` (chaves_credenciais_pendentes, dominio_vercel_projeto_errado, serpro_produtos_futuros, vercel_env_pull_redige_sensitive). Atualize este arquivo conforme as pendências forem resolvidas.*
