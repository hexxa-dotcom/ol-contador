# Pendências — Olá, Contador (migração legado → area-contador-next)

> Última atualização: 2026-08-21 (adicionadas pendências de notificações/e-mails)
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

## ⏸️ WhatsApp integrado (Cloud API da Meta) — código pronto, PARADO no backlog

Decisão: usar a WhatsApp Cloud API oficial da Meta (não Baileys/Z-API/Evolution, que violam os termos e arriscam banimento do número). Chat do WhatsApp vive dentro da própria "Fila de Atendimento" da área do contador, como uma terceira ferramenta ao lado de "Fila" e "Copiloto" (não é uma aba separada) — troca a lista de conversas e filtra as mensagens por canal, sem misturar com o chat interno. Plano completo salvo em `~/.claude/plans/melodic-giggling-parasol.md`.

**Já feito (código, 2026-08-21):**
- Schema: colunas `canal`, `wa_message_id`, `wa_status` em `mensagens`; `status`/`encerrado_em` restauradas em `caixa_postal` (bug separado descoberto de bônus, corrigido).
- `src/lib/whatsapp.ts` — cliente da Graph API (texto livre, template, download de mídia, verificação de assinatura HMAC).
- `src/lib/notify.ts` — motor de WhatsApp trocado de Twilio pra Meta Cloud API (mesma assinatura, os 4 chamadores existentes não mudaram).
- `src/app/api/whatsapp/webhook/route.ts` — recebe mensagens/documentos/status, idempotente via `webhook_eventos`.
- `sendWhatsAppMessage` em `src/app/auth/actions.ts` — contador responde pelo WhatsApp.
- Ferramenta "WhatsApp" dentro de `AtendimentoView` (`src/components/views.tsx`), junto de Fila/Copiloto.

Usuário decidiu pausar em 2026-08-21 — travou na configuração do lado da Meta e preferiu deixar pra retomar depois em vez de insistir agora.

**Onde travou:** app "Ola-contador" criado no Meta for Developers (App ID `1333162505291515`), produto WhatsApp com o caso de uso já configurado (então o item "adicionar produto WhatsApp Business Platform" já está feito), mas o botão "Reivindicar número de teste do WhatsApp" não responde a clique nenhum — testado em Chrome, Brave e Safari (inclusive janela anônima), sem erro nenhum aparente. "Ações necessárias" da conta Business não mostra nada pendente. Tentamos contornar conectando o MCP `meta_developer_tools` (`claude mcp add --transport http meta_developer_tools https://mcp.facebook.com/devtools`) numa sessão de terminal separada, mas essa conexão ficou vinculada àquela sessão específica e não apareceu disponível nesta sessão — não foi possível usar.

**Próximo passo quando retomar:**
1. Pular o número de teste (que está bugado) e ir direto pra "Etapa 2: Configuração da produção" no painel do WhatsApp do app, cadastrando um número de telefone real em vez do gratuito de teste — ou tentar de novo o MCP numa sessão nova, dedicada a isso.
2. Pegar `Phone Number ID`, `WABA ID`, gerar token de acesso permanente (System User, permissões `whatsapp_business_messaging` + `whatsapp_business_management`, sem expiração), e o App Secret (Configurações do app → Básico).
3. Me passar essas 4 credenciais pra eu configurar as 7 env vars na Vercel: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` (documentadas em `.env.example`).
4. Depois disso: registrar a URL do webhook (`/api/whatsapp/webhook`) + verify token no painel da Meta, e submeter 1 template de utilidade genérico pra aprovação (2 variáveis, mesmo formato que já existia pro Twilio).

**Limitação conhecida da V1:** mensagem de número não cadastrado como cliente não vira conversa (só fica registrada em `webhook_eventos`) — não há inbox de números desconhecidos ainda.

**Discussão em aberto:** usuário mencionou querer discutir mais sobre a estratégia de WhatsApp depois (possível CRM mais completo). Fica pra depois desta V1 estar rodando.

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
