# Plano de evolução — Olá, Contador

Última revisão: 10 de agosto de 2026.

Este arquivo guarda a fila de melhorias do produto. Os itens estão ordenados por prioridade e devem ser marcados somente depois de implementação, teste completo e validação em produção.

## Prioridade imediata — confiabilidade do fluxo completo

- [ ] Testar uma contratação real de ponta a ponta: preços, checkout, pagamento, triagem, documentos, área do contador, execução, relatório, entrega e área do cliente.
- [x] Automatizar o Atendimento Express: criação da tarefa, responsável ao iniciar, prazo em dias úteis, alerta de SLA, mudança de status e encerramento condicionado à entrega.
- [x] Garantir avisos ao cliente quando faltar documento, houver mudança de etapa ou o resultado estiver pronto, com a Área do Cliente como fonte principal.
- [x] Revisar pagamentos: confirmação automática, reconciliação, idempotência de webhook/agendamento/triagem, cancelamento, disputa e estorno.
- [x] Finalizar o cofre GOV.BR com criptografia dedicada, expiração automática, exclusão, consentimento LGPD e histórico de acesso.
- [ ] Refinar no celular as telas restantes: preços, login, cadastro, recuperação de senha e área do contador.
- [x] Concluir e validar o Radar Fiscal conforme os serviços disponíveis: caixa postal, SITFIS, parcelamentos e DAS pelo Integra Contador; Dívida Ativa e CND por adaptadores próprios, ativados somente após contratação/configuração das respectivas APIs.
- [x] Adicionar monitoramento de erros agrupados no painel e métricas de conversão/abandono do funil.
- [x] Fazer revisão de segurança, permissões, LGPD e acessibilidade: RLS endurecido, dados de auditoria minimizados, retenção automática, upload privado limitado, cabeçalhos de segurança e navegação acessível. A proteção de senhas vazadas permanece como configuração manual recomendada no painel do Supabase.

## Auditoria do pós-atendimento e dos relatórios

### P0 — corrigir antes de considerar o pós-atendimento automático

- [x] Criar estados reais para o relatório: `rascunho`, `gerado`, `entrega_pendente`, `entregue`, `falha_na_entrega` e `arquivado_interno`.
- [x] Impedir que um relatório apenas gerado ou arquivado internamente apareça nos Documentos, Histórico ou linha do tempo do cliente.
- [x] Corrigir a opção “Arquivar sem enviar”: o documento fica apenas no painel interno e o caso permanece aberto.
- [x] Unificar a conclusão em uma única ação segura: validar o relatório, registrar a entrega principal, encerrar o atendimento correto, arquivar a triagem, concluir a tarefa e liberar a avaliação.
- [x] Não encerrar o caso se a entrega principal na Área do Cliente falhar. Registrar falhas dos avisos adicionais e permitir nova tentativa.
- [x] Registrar `entregue_em`, canais utilizados, tentativas, erros e quem realizou a entrega.
- [x] Ligar cada relatório a um atendimento específico, usando um identificador do caso, e não apenas o cliente e a comparação de datas.
- [x] Sincronizar o Atendimento Express com o relatório: a entrega marca o Express correspondente como concluído.
- [x] Impedir que uma ação direta retire um Atendimento Express da fila antes de o resultado ter sido efetivamente entregue.
- [x] Fazer o encerramento criar somente um registro no histórico, mesmo com repetição de clique, atualização da página ou nova tentativa.

### P1 — consistência operacional e qualidade da entrega

- [x] Salvar o rascunho do relatório automaticamente e permitir continuar depois sem perder o texto.
- [x] Pedir confirmação antes de trocar de cliente, sair da aba ou abandonar um relatório com alterações não salvas.
- [x] Exigir campos mínimos coerentes para cada documento: caso, resolução e providências no relatório de atendimento; análise, pendências e orientações no relatório de pendências.
- [x] Usar linguagem que diferencie resolução executada, orientação fornecida e pendência identificada.
- [x] Remover o selo “Concluído” do documento e separar o relatório de atendimento do relatório de pendências.
- [x] Validar nome do contador, CRC e assinatura também no servidor antes da entrega final.
- [x] Permitir revisão ou nova versão do relatório sem apagar o documento originalmente entregue, mantendo histórico de versões.
- [ ] Transformar próximos passos em itens estruturados com responsável, prazo e situação; criar tarefas automaticamente quando necessário.
- [x] Melhorar “Aguardando Relatório” com assunto do caso, modalidade, data de encerramento, tempo em espera, SLA e prioridade.
- [x] Concluir automaticamente a tarefa pós-atendimento quando o relatório for entregue e impedir tarefas duplicadas.
- [x] Corrigir o prazo pós-atendimento para dois dias úteis, sem contar sábados e domingos.
- [x] Mover o pedido de avaliação para depois da entrega real e limitar a uma avaliação por atendimento, não apenas por cliente.
- [x] Fazer a linha do tempo do cliente considerar `entregue_em`, e não apenas a criação do registro.
- [ ] Incluir no relatório o que foi entregue além do PDF: guias, protocolos, comprovantes, arquivos e links relevantes.
- [x] Exibir uma revisão final antes do envio com cliente, caso, canais e consequência da ação de encerramento.

### P2 — produtividade, histórico e experiência móvel

- [x] Adicionar busca e filtros em Relatórios Finalizados por cliente, assunto, período, modalidade e situação da entrega.
- [x] Mostrar ações de visualizar, baixar, reenviar, consultar falhas e abrir o caso relacionado.
- [x] Exibir os relatórios finalizados em cartões adaptáveis à largura da tela.
- [x] Exibir comprovante de entrega e histórico de tentativas dentro do prontuário do cliente.
- [x] Criar um resumo de conclusão na área do cliente com resolução e acesso ao documento.
- [ ] Padronizar os nomes “Atendimento Express”, “atendimento sem agendamento”, “conclusão”, “resultado” e “relatório” em todas as telas.
- [x] Adicionar modelos de relatório para pessoa física, pessoa jurídica e regularizações, mantendo o tipo do documento como informação interna.
- [x] Monitorar relatórios pendentes, entregas com falha, tempo médio até a entrega e avaliações pós-atendimento.

## Critério de conclusão do pós-atendimento

O pós-atendimento estará consistente quando uma única ação final conseguir, sem duplicidade:

1. identificar exatamente qual caso está sendo concluído;
2. validar o conteúdo e a assinatura do relatório;
3. entregar pelo canal escolhido e comprovar a entrega;
4. atualizar o atendimento agendado ou Express correspondente;
5. concluir tarefas e arquivar a triagem;
6. atualizar Documentos, Histórico e linha do tempo do cliente;
7. solicitar a avaliação apenas depois da entrega;
8. permitir reprocessamento seguro se qualquer etapa falhar.
