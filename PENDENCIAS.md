# Pendências — Olá, Contador (migração legado → area-contador-next)

> Última atualização: 2026-08-21 (adicionadas pendências de notificações/e-mails)
> Este arquivo é o ponto único de referência das pendências em aberto. Qualquer agente/sessão nova deve ler este arquivo primeiro para entender o que falta.

## 🔴 Domínio de produção apontando pro app errado
`www.olacontador.com.br` e `olacontador.com.br` (Vercel) ainda apontam pro projeto **legado** `ola-contador` (vanilla JS), não pro **novo** `area-contador-next` (Next.js), onde está todo o trabalho atual.

- Confirmado via `vercel alias ls`.
- Enquanto isso não for corrigido, quem acessar o domínio real não vê nada do rewrite (Equipe, Chaves de API, checkout redesenhado, Integra Contador SERPRO, etc).
- **Ação:** repontar o domínio pro projeto `area-contador-next` em Project Settings → Domains (ou `vercel alias set`). É uma mudança visível publicamente — **confirmar com o usuário antes de agir**, ele ainda não decidiu quando fazer o cutover.
- Até lá, testar/demonstrar sempre em `area-contador-next.vercel.app` (ou preview), nunca no domínio custom.

## 🟡 Credenciais / variáveis de ambiente ainda sem valor real (Vercel, projeto `area-contador-next`)

Sem fonte disponível ainda:
- **RESEND_API_KEY** — nunca teve valor real (nem no legado). Precisa gerar em resend.com.
- **GOVBR_VAULT_KEY** — provavelmente vazia em produção. Dá pra gerar uma nova localmente, mas isso é uma chave de criptografia — **pedir confirmação explícita ao usuário antes de gerar/aplicar**.
- **SERPRO_CND_\*** (4 vars) e **SERPRO_DIVIDA_ATIVA_\*** (4 vars) — credenciamentos separados no portal SERPRO, nunca configurados (é greenfield, sem código de integração ainda).
- **OPENROUTER_API_KEY / OPENROUTER_MODEL** — deixadas vazias de propósito, uso futuro, não é prioridade agora.
- **TWILIO_\*** (ACCOUNT_SID, AUTH_TOKEN, WHATSAPP_CONTENT_SID) — usuário decidiu **não usar Twilio** pro WhatsApp. Alternativas já discutidas: API oficial WhatsApp Cloud (Meta) ou Z-API/Evolution API (não-oficiais). Não sugerir Twilio de novo.

Já resolvidas (contexto, não precisa mexer):
- ASAAS_*, CRON_SECRET, GROQ_*, OPENAI_API_KEY, RESEND_FROM, GROQ_MODEL/VISION_MODEL — reimportadas de fonte confiável em 2026-08-19.
- SERPRO Integra Contador (OAuth2 + mTLS) — funcionando em produção desde 2026-08-20. Certificado e-CNPJ (HEXX SERVIÇOS DIGITAIS LTDA) válido até **2027-01-08** — vai precisar repetir o processo de extração do `.pfx` quando vencer.

⚠️ **Cuidado ao verificar:** `vercel env pull` (e `vercel env ls`) sempre retorna vazio pra variáveis marcadas "Sensitive" na Vercel, mesmo quando o valor real existe. Nunca usar isso pra validar credencial. Formas corretas: confiar na confirmação do `vercel env add`, testar via efeito observável (chamar o endpoint que usa a credencial), ou comparar com um `.env` local em texto puro que nunca passou por `pull`.

## 🟢 Notificações e e-mails

- **E-mails do Supabase Auth em inglês** — o projeto não versiona templates customizados; está usando os templates default do Supabase (confirmação de cadastro, magic link, reset de senha, convite, troca de e-mail, reautenticação), todos em inglês. Já escrevi os 6 textos em português (tom amistoso, sem jargão contábil), prontos em [docs/supabase-email-templates-pt-br.md](docs/supabase-email-templates-pt-br.md).
  - **Ação:** aplicar via Supabase Dashboard → Authentication → Email Templates. Consigo aplicar automaticamente pela API assim que o conector MCP do Supabase for autorizado (usuário precisa autorizar em claude.ai → configurações de conectores, ou via `/mcp` numa sessão interativa).
- **Aviso de "processo concluído" depende do RESEND_API_KEY** — quando o Kanban de Acompanhamento muda pro status "concluído", o sistema tenta mandar e-mail pro cliente (`src/app/api/operations/route.ts:20,86-89`). Como `RESEND_API_KEY` ainda está vazia (ver pendência acima), o envio é silenciosamente pulado — o status muda no banco normalmente, mas o cliente não é avisado. Resolve sozinho assim que a chave da Resend for configurada, não precisa mexer em código.
- **Gap separado no Atendimento Express:** diferente do Kanban de Acompanhamento, quando um atendimento Express vira "concluído" **não existe e-mail configurado** nesse fluxo (`EXPRESS_AVISO_POR_STATUS` em `operations/route.ts` não tem entrada pra `concluido`). Isso não é sobre a chave da Resend — é falta de código mesmo. Ainda não decidido se o usuário quer esse aviso; perguntar antes de implementar.

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
