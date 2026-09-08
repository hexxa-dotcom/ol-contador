-- Modo permanente do cofre gov.br: além do cofre temporário (TTL +
-- visualização única e apaga o conteúdo), a equipe agora pode guardar uma
-- senha sem expiração automática, revelável quantas vezes precisar — toda
-- visualização continua registrada em govbr_credenciais_auditoria.
alter table govbr_credenciais_cofre
  add column if not exists permanente boolean not null default false;
