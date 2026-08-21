-- Suporte a WhatsApp na tabela de mensagens do chat (canal unificado com o chat interno)
alter table public.mensagens
  add column if not exists canal text not null default 'chat',
  add column if not exists wa_message_id text,
  add column if not exists wa_status text;

create unique index if not exists mensagens_wa_message_id_key
  on public.mensagens (wa_message_id)
  where wa_message_id is not null;
