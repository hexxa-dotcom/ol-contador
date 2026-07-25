# Teste do portal do cliente sem login

O login automático com contas e senhas públicas foi removido. Enquanto o produto
está em teste, apenas o **portal do cliente** abre sem login com dados locais de
demonstração; ele não lê nem grava dados no Supabase.

O modo fica em `config.js`:
```js
TESTE_CLIENTE_SEM_LOGIN: { enabled: true, clientId: 'ana-silva' }
```

Enquanto estiver ativo, uma faixa dourada no rodapé avisa que a conversa é só
demonstrativa. O painel do contador continua exigindo login normal.

## Para liberar clientes reais

1. Em `config.js`, defina `enabled: false`.
2. Configure o login por e-mail e a Site URL no Supabase.
3. Garanta que as políticas RLS continuem liberando cada cliente apenas para o
   próprio cadastro.

## Pendências para o login normal

- **Template de e-mail**: Supabase → Authentication → Emails → Magic Link precisa conter
  `{{ .Token }}`. Hoje manda um botão de Magic Link em vez do código de 6 dígitos, e a
  tela de login espera o código.
- **Site URL**: Authentication → URL Configuration → `https://ola-contador.vercel.app`.
