# Templates de e-mail do Supabase Auth — em português (Olá, Contador)

Status: prontos para aplicar. Aplicação automática pendente de autorização do conector Supabase (ver nota no fim).

Onde colar cada um: Supabase Dashboard → Authentication → Email Templates → escolher o tipo → colar "Subject" e "Message body (HTML)".

Variáveis do Supabase preservadas em cada template (não remover): `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

---

## 1) Confirm signup (confirmação de cadastro)

**Subject:**
```
Confirme seu cadastro no Olá, Contador
```

**Message body (HTML):**
```html
<h2>Bem-vindo(a) ao Olá, Contador!</h2>
<p>Que bom ter você com a gente. Falta só um passo pra liberar seu acesso.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar meu cadastro</a></p>
<p>Se você não pediu esse cadastro, pode ignorar este e-mail com tranquilidade — nada será ativado.</p>
<p>Qualquer dúvida, é só responder este e-mail ou falar com a gente em ola@olacontador.com.br.</p>
<p>Um abraço,<br>Equipe Olá, Contador</p>
```

---

## 2) Invite user (convite)

**Subject:**
```
Você foi convidado(a) para o Olá, Contador
```

**Message body (HTML):**
```html
<h2>Você recebeu um convite!</h2>
<p>Alguém da equipe te chamou pra fazer parte do Olá, Contador. É só aceitar o convite abaixo pra criar seu acesso.</p>
<p><a href="{{ .ConfirmationURL }}">Aceitar convite</a></p>
<p>Se você não esperava este convite, pode ignorar este e-mail sem problema.</p>
<p>Um abraço,<br>Equipe Olá, Contador</p>
```

---

## 3) Magic Link (login sem senha)

**Subject:**
```
Seu link de acesso ao Olá, Contador
```

**Message body (HTML):**
```html
<h2>Seu link de acesso chegou</h2>
<p>Clique no botão abaixo para entrar na sua conta. É rápido, seguro e não precisa de senha.</p>
<p><a href="{{ .ConfirmationURL }}">Entrar no Olá, Contador</a></p>
<p>Este link expira em breve por segurança. Se você não pediu esse acesso, pode ignorar este e-mail — sua conta continua protegida.</p>
<p>Um abraço,<br>Equipe Olá, Contador</p>
```

---

## 4) Change Email Address (confirmação de troca de e-mail)

**Subject:**
```
Confirme seu novo e-mail no Olá, Contador
```

**Message body (HTML):**
```html
<h2>Confirme a troca do seu e-mail</h2>
<p>Recebemos um pedido para alterar o e-mail da sua conta para <strong>{{ .Email }}</strong>. Para confirmar, clique abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar novo e-mail</a></p>
<p>Se você não pediu essa alteração, entre em contato com a gente imediatamente em ola@olacontador.com.br — sua conta pode estar em risco.</p>
<p>Um abraço,<br>Equipe Olá, Contador</p>
```

---

## 5) Reset Password (recuperação de senha)

**Subject:**
```
Redefinir sua senha — Olá, Contador
```

**Message body (HTML):**
```html
<h2>Vamos redefinir sua senha</h2>
<p>Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>
<p><a href="{{ .ConfirmationURL }}">Criar nova senha</a></p>
<p>Se você não pediu essa redefinição, pode ignorar este e-mail — sua senha atual continua valendo normalmente.</p>
<p>Um abraço,<br>Equipe Olá, Contador</p>
```

---

## 6) Reauthentication (confirmação por código, ações sensíveis)

**Subject:**
```
Seu código de confirmação — Olá, Contador
```

**Message body (HTML):**
```html
<h2>Confirme que é você</h2>
<p>Para concluir essa ação com segurança, use o código abaixo:</p>
<p style="font-size:24px; font-weight:bold; letter-spacing:2px;">{{ .Token }}</p>
<p>Se você não solicitou essa ação, ignore este e-mail e, por precaução, avise a gente em ola@olacontador.com.br.</p>
<p>Um abraço,<br>Equipe Olá, Contador</p>
```

---

## Como foram pensados
Tom amistoso, sem jargão contábil, sempre reforçando confiança (explicando o que fazer se o e-mail não foi solicitado pelo usuário) e assinando como "Equipe Olá, Contador" para manter a identidade humana da marca, consistente com o restante do site (ex.: "Fale com a gente" no FAQ da home).

## Aplicação
Não consegui aplicar automaticamente porque o conector MCP do Supabase ainda não está autorizado nesta sessão. Para eu aplicar direto (sem você precisar colar no painel):
1. Autorize o conector "supabase" nas configurações de conectores do claude.ai (ou via `/mcp` numa sessão interativa do Claude Code).
2. Me avise que autorizou — eu aplico os 6 templates automaticamente via API.

Se preferir, os textos acima já estão prontos pra colar manualmente no Dashboard.
