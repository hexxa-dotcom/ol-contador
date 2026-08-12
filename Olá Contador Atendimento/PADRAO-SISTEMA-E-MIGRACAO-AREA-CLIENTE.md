# Padrão do Sistema e Plano de Migração da Área do Cliente

Última revisão: 11 de agosto de 2026.

Este documento é o contrato funcional e visual para terminar a nova Área do
Contador em Next.js e, depois, aplicar o mesmo padrão na Área do Cliente.

A versão legada continua sendo a referência de comportamento até que cada
fluxo seja migrado, testado e homologado. Aparência semelhante não significa
função migrada.

## 1. Situação atual

A aplicação Next.js está publicada em
`https://area-contador-next.vercel.app`, com:

- autenticação real por Supabase Auth e sessão em cookies;
- proteção da rota autenticada e validação do usuário na tabela `staff`;
- dashboard real em modo de leitura;
- leitura real das notificações;
- edição completa do perfil profissional, incluindo CRC, especialidades,
  biografia, formação, logo e assinatura;
- identidade visual, navegação responsiva e componentes-base;
- gráficos interativos em Recharts alimentados pelo histórico real;
- telas operacionais de atendimento, clientes, acompanhamento, relatórios,
  agenda, financeiro, Radar Fiscal, insights e configurações ligadas aos
  contratos reais do sistema.

### Avanço da migração em 11/08/2026

- Clientes, busca, edição e prontuário usam registros reais.
- Chat carrega e envia mensagens reais, marca leitura e acompanha inserções
  por Realtime.
- Anexos do chat usam o bucket privado `documentos`, com validação de MIME,
  limite de 10 MB e pasta por cliente.
- Copiloto possui Route Handler autenticado, verifica `staff` e mantém a chave
  do provedor somente no servidor.
- Acompanhamento, relatórios, agenda, financeiro, Radar Fiscal, caixa postal e
  insights exibem os registros reais disponíveis.
- Notificações podem ser marcadas individualmente ou em conjunto como lidas.
- Preferências visuais do painel são persistidas em `configuracoes`.
- RLS das tabelas operacionais e políticas do Storage foram auditadas.
- Insights possui filtros Hoje, Semana, Mês, Ano, Tudo e intervalo por datas,
  com volume, duração, ticket, rentabilidade e perfil da carteira.
- Radar Fiscal possui pesquisa e seleção de cliente, contexto de procuração,
  teste de conexão, cache/histórico e adaptador autenticado no servidor.
- Perfil profissional lê e grava o contrato legado `perfil_contador` sem perder
  logo ou assinatura.
- O chat encaminha casos para acompanhamento e registra o encerramento no
  histórico; o formulário de relatório já cria rascunhos reais.
- Clientes possuem cadastro completo, conta do portal, prontuário, checklist,
  evidências, histórico e recorrência com assinatura real no Asaas.
- Financeiro cria cobranças Pix/cartão, planos, links e créditos; Agenda possui
  calendário, disponibilidade, bloqueios e consultas manuais.
- Relatórios possuem edição integral, anexos, validação, canais de entrega e
  finalização transacional pela RPC `finalizar_pos_atendimento`.
- Caixa Postal envia mensagens ao cliente e persiste leitura; configurações
  operacionais, equipe, NFS-e, Radar, skills e aparência são persistidas.
- As tabelas críticas foram verificadas com RLS ativo e o pacote de produção
  passou no `npm audit` sem vulnerabilidades.
- Recuperação de senha possui callback seguro, solicitação por e-mail e troca
  de senha pela sessão de recuperação.
- Timer do chat é persistido por cliente, tarefas internas possuem criação,
  conclusão e exclusão, e notificações usam Realtime com deep link.
- Documentos privados usam URL assinada de curta duração e recuperaram a ação
  autenticada de leitura por IA existente no sistema anterior.
- Revisões de relatórios preservam o documento entregue, e entregas com falha
  podem ser reenviadas pelo fluxo transacional.
- Guias mensais aparecem no dashboard e na recorrência do cliente, com ação
  autenticada para registrar a geração.
- Radar Fiscal preserva os contratos legados `radar_fiscal_config` e
  `radar_fiscal_clientes`, incluindo paginação da Caixa Postal, mensagem,
  extrato, emissão de DAS e detalhe de Dívida Ativa.
- NFS-e usa o contrato legado `nota_fiscal_config` e consulta o catálogo
  municipal no servidor; a triagem volta a gravar `triagem_regras` e
  `triagem_assuntos` sem perder perguntas, documentos ou diagnósticos.
- Diagnóstico do cliente e relatório podem ser preenchidos pelo adaptador de IA
  autenticado; skills aceitam indexação de PDF.
- Erros operacionais possuem painel autenticado para consulta, atualização e
  resolução; exclusão de agendamentos foi restaurada.
- Acompanhamento permite atribuir e transferir responsáveis usando a equipe
  real, com restrição administrativa no servidor.
- Aparência, modo escuro, sons e atalhos do chat/Copiloto deixaram de ser apenas
  configurações salvas e passaram a ser aplicados no atendimento.
- Notificações recuperaram a limpeza integral do histórico com confirmação,
  além da exclusão individual e marcação de leitura.
- O cadastro `staff` permite que cada membro leia o próprio registro; a edição
  do perfil foi limitada no banco às colunas `name` e `nome` do próprio membro,
  sem conceder alteração de `role`, e-mail ou identificador.
- A política de inserção em `documentos` foi alinhada ao contrato do chat:
  membros autenticados da equipe podem anexar arquivos, enquanto clientes
  continuam restritos à própria referência e a `uploaded_by = 'client'`.

### Independência do backend legado em 11/08/2026

Os módulos abaixo eram *proxy* autenticado para `www.olacontador.com.br`
(repassavam o JWT do usuário e o legado processava de verdade) e passaram a
ser implementações nativas no Next.js, sem depender do site antigo continuar
no ar:

- **Equipe**: convidar/remover membro (`src/app/api/team/route.ts`) via Auth
  Admin API + tabela `staff`, direto com `service_role`.
- **Clientes/Acesso**: criar cliente manualmente e resetar senha de acesso
  (`src/app/api/clients/access/route.ts`), com validação de CPF/CNPJ
  (`src/lib/documento.ts`) e rollback manual se o insert falhar.
- **Erros Operacionais** e **Métricas de Funil**: leitura/atualização de
  `app_erros` e agregação de `funil_eventos`/`cobrancas`
  (`operational-errors` e novo `funnel-metrics`).
- **Financeiro**: `src/lib/asaas.ts` portado por completo. `finance/charge` e
  `finance/recurrence` agora cobrem os dois fluxos — contador agindo por
  qualquer cliente **e** autoatendimento do próprio cliente (catálogo de
  preço fixo, desconto de 10% para recorrente, preço nunca vindo do body) —
  pronto como API mesmo antes de existir tela de cliente para chamá-lo.
- **Cofre gov.br**: `src/lib/govbrVault.ts` (AES-256-GCM, `GOVBR_VAULT_KEY`
  agora obrigatória, sem fallback para `service_role`) e
  `clients/vault/route.ts` com claim condicional no `reveal` (evita
  revelação dupla) e nulificação após revelar/expirar.
- **IA — diagnóstico e relatório**: `src/lib/ia.ts` portado por completo
  (os modos resumo/rascunho/pergunta/pendências já eram nativos); os dois
  que faltavam agora rodam no próprio Route Handler do Copiloto.
- **Upload de skills (RAG)** e **análise de documento por IA**: embeddings
  OpenAI, chunking e `skills_embeddings` nativos; leitura de PDF/imagem
  (`pdf-parse` + visão) grava `documentos.ai_extracted` direto.
- **Radar Fiscal / SERPRO**: `src/lib/serpro.ts` (mTLS via `node:https`),
  `cnd.ts` e `dividaAtiva.ts` portados. `radar-fiscal/route.ts` reescrito com
  a matriz de permissão completa staff × cliente (nunca confia no
  `clienteRef` enviado pelo cliente comum), checagem anti-fraude de
  `emitir-das`, cache por serviço e log mascarado em `serpro_consultas`.

Também foi feita uma faxina: as ~1.460 linhas de componentes de tela
substituídos (`ClientesView`, `AcompanhamentoView`, `RelatoriosView`,
`AgendamentosView`, `FinanceiroView`, `RadarView`, `NotificacoesView`,
`ConfiguracoesView` — todos trocados por versões `*IntegralView`/
`RadarFiscalView` há tempos, mas nunca apagados) foram removidas de
`views.tsx`; a aba "Prontuário" em Relatórios (que caía num `else` genérico
mostrando a lista inteira) foi renomeada para "Todos os Relatórios",
condizente com o que sempre mostrou; e o atalho de áudio no chat (que insere
texto fingindo ser áudio) ganhou rótulo "(demo)" — não grava áudio real.

**O que ainda falta para essa independência ser testada de verdade**: as
credenciais sensíveis (Asaas, SERPRO/CND/Dívida Ativa, Groq/OpenAI,
`SUPABASE_SERVICE_ROLE_KEY`, `GOVBR_VAULT_KEY`) ainda não foram cadastradas no
ambiente Vercel do `area-contador-next` — são variáveis marcadas como
"Sensitive" no projeto legado, que a Vercel não deixa ler de volta nem pelo
dono da conta, então precisam ser recadastradas manualmente a partir da fonte
original de cada uma. Até isso acontecer, todas as rotas acima falham de
forma controlada (`503`), mas nenhuma foi exercitada contra os provedores
reais (Asaas sandbox/produção, SERPRO mTLS, OpenAI) nesta reescrita.

A nova versão permanece em homologação antes do corte. Restam: cadastrar as
credenciais acima, os testes E2E autenticados contra provedores reais, a
ativação da proteção contra senhas vazadas no Supabase Auth, e a homologação
final de cada integração sensível. A versão antiga continua sendo o rollback
até a aprovação desses gates — inclusive o webhook do Asaas, que
deliberadamente continua apontando para o backend legado até o corte final.

## 2. Princípios obrigatórios da migração

1. Migrar por fluxo vertical completo, e não apenas por tela.
2. Não transportar o interceptador global de `window.fetch` de `oc-data.js`.
3. Não acessar segredos de Asaas, IA, SERPRO ou `service_role` no navegador.
4. Toda tabela exposta deve ter RLS e políticas específicas por proprietário,
   equipe ou papel.
5. Ações sensíveis devem executar no servidor por Server Actions, Route
   Handlers ou funções de banco com contrato explícito.
6. Operações financeiras e encerramentos devem ser idempotentes.
7. Realtime complementa a consulta inicial; não substitui a fonte de verdade.
8. Toda tela precisa ter estados de carregamento, vazio, erro, sucesso e nova
   tentativa.
9. Nenhum botão deve ser um clique morto. A ação funciona, fica desabilitada
   com motivo, ou informa claramente a dependência ainda não migrada.
10. A versão antiga permanece como rollback até o corte final aprovado.

## 3. Arquitetura de destino

```text
Next.js
├── Server Components: leitura inicial e páginas protegidas
├── Client Components: interação, formulários e Realtime
├── Server Actions: escritas simples autenticadas
├── Route Handlers: webhooks, integrações e arquivos
└── componentes compartilhados: UI, estados, gráficos e formulários

Supabase
├── Auth: contador, equipe e clientes
├── Postgres + RLS: dados operacionais
├── Realtime: mensagens, fila e notificações
├── Storage privado: documentos e relatórios
└── funções/RPC: operações transacionais e idempotentes

Serviços externos no servidor
├── Asaas: cobrança, assinatura e webhook
├── IA/Copiloto: prompts, skills, análise e OCR
├── SERPRO/Integra Contador: Radar Fiscal
└── canais de aviso: Área do Cliente, e-mail e caixa postal
```

## 4. Mapa funcional: atual x necessário

| Módulo | Estado na versão Next | O que falta para ficar funcional |
|---|---|---|
| Autenticação | Login, logout, recuperação de senha, cookies e proteção reais | Homologar convites, expiração, papéis, sessão revogada e testes de permissão |
| Dashboard | Leitura real de faturamento, agenda e pendências | Links para os registros, tratamento de falha parcial, atualização e filtros |
| Perfil | Edição completa persistida em `configuracoes.perfil_contador`, com nome próprio protegido por RLS e privilégio por coluna em `staff` | Homologação dos arquivos de marca no PDF e testes por papel |
| Clientes | Cadastro, conta do portal, prontuário, checklist, histórico e recorrência reais — criação de acesso e reset de senha nativos (sem proxy) | Cadastrar `SUPABASE_SERVICE_ROLE_KEY` na Vercel; homologação E2E dos papéis |
| Atendimento | Fila, mensagens, busca, Realtime, bloqueio, anexos, copiloto, timer persistido e encerramento reais | Homologação por papel e reconexão prolongada |
| Copiloto | Contexto real, Route Handler protegido, skills e leitura de documentos; diagnóstico e relatório agora nativos (sem proxy) | Cadastrar chaves de IA na Vercel; limites por usuário e auditoria de consumo |
| Acompanhamento | Kanban real com movimentação, SLA, notificação e atribuição de responsável | Homologar transferência com conta de parceiro |
| Relatórios | Editor integral, anexos, PDF/impressão e entrega transacional | Homologar reenvio e revisões com dados reais |
| Agenda | CRUD de status, calendário, lista, disponibilidade e bloqueios | Homologar lembretes em produção |
| Financeiro | `src/lib/asaas.ts` nativo (sem proxy); cobrança e recorrência cobrem contador e autoatendimento do cliente | Cadastrar `ASAAS_API_KEY` na Vercel; homologar conciliação, estorno e webhook (webhook continua no legado até o corte) |
| Radar Fiscal | `src/lib/serpro.ts` (mTLS), CND e Dívida Ativa nativos (sem proxy); matriz de permissão staff × cliente completa | Cadastrar credenciais SERPRO/CND/Dívida Ativa na Vercel; homologar consentimento em todos os serviços pagos |
| Notificações | Leitura, contador, exclusão, Realtime e deep link reais | Preferências por tipo e homologação prolongada |
| Caixa Postal | Listagem, envio, leitura e busca reais | Atualização em tempo real |
| Insights | Métricas reais, períodos e intervalo de datas | Comparação, metas, drill-down e exportação |
| Configurações | Persistência por domínio, contratos legados compatíveis; NFS-e e upload de skills agora nativos (sem proxy) | Cadastrar `OPENAI_API_KEY`; homologação de cada integração |
| Equipe | Lista, convites e revogação protegidos por administrador — nativos (sem proxy) | Trilha de auditoria detalhada |
| Documentos | Upload privado validado, URL assinada, leitura por IA e vínculo aos relatórios | Trilha detalhada de download |

## 5. Contratos legados que precisam ser migrados

Os seguintes domínios já existem no sistema antigo e não devem ser
reimplementados sem preservar suas regras:

### Clientes e atendimento

- clientes, status e prontuário;
- mensagens e checklist;
- triagem, aplicação e arquivamento;
- histórico de atendimentos;
- fila Express e atendimento agendado;
- timer, bloqueio e passagem para acompanhamento.

### Agenda

- listar, criar, concluir e excluir agendamentos;
- disponibilidade e dias bloqueados;
- opções de agendamento por serviço;
- lembretes e obrigações fiscais.

### Pós-atendimento

- rascunho e versões de relatórios;
- anexos do relatório;
- validação de campos e assinatura;
- entrega principal e canais adicionais;
- RPC/operação `finalizar_pos_atendimento`;
- idempotência e reprocessamento de falhas.

### Financeiro

- serviços e preços;
- checkout e status da cobrança;
- recorrência;
- cobranças e créditos;
- guias mensais;
- webhook idempotente do Asaas.

### Fiscal e IA

- Copiloto e skills;
- análise de documentos;
- Caixa Postal do e-CAC;
- situação fiscal, parcelamentos, Dívida Ativa e CND;
- histórico, custo, expiração e resultado das consultas SERPRO.

## 6. Fontes de dados já existentes

O banco tipado atualmente contém, entre outras, as tabelas:

- `agendamentos`;
- `atendimentos_express` e `atendimentos_historico`;
- `avaliacoes`;
- `caixa_postal`;
- `clientes`;
- `cobrancas`, `creditos` e `guias_mensais`;
- `configuracoes`;
- `documentos`;
- `mensagens` e `notificacoes`;
- `obrigacoes` e `lembretes_enviados`;
- `relatorios` e `relatorio_anexos`;
- `serpro_consultas` e `serpro_resultados`;
- `servicos`, `staff` e `triagens`;
- `webhook_eventos`, auditoria e monitoramento.

Antes de criar uma tabela nova, verificar se o domínio já existe nessas
estruturas ou nos scripts SQL do projeto.

## 7. Ordem recomendada de implementação

### Fase 0 — segurança e contratos

- [x] Auditar as políticas RLS de todas as tabelas utilizadas pelo Next.js.
- [x] Restringir a atualização de `staff` ao próprio registro e somente às
  colunas de nome; `role`, e-mail e ID permanecem sem privilégio de atualização.
- [x] Alinhar a política de upload de `documentos` entre equipe e cliente.
- [ ] Confirmar políticas separadas para contador, equipe e cliente.
- [ ] Garantir `USING` e `WITH CHECK` nas políticas de atualização.
- [ ] Confirmar que nenhuma chave privilegiada chega ao bundle do navegador.
- [ ] Definir papéis oficiais e uma matriz de permissões.
- [ ] Padronizar validação, erros, logs e identificador de correlação.
- [ ] Gerar novamente os tipos do banco após qualquer alteração de schema.

### Fase 1 — leitura operacional real

- [x] Migrar Clientes e Prontuário com busca e estados completos.
- [x] Ligar fila, agenda do dia e dados do atendimento selecionado.
- [x] Migrar Acompanhamento em modo de leitura.
- [x] Migrar listas de relatórios, cobranças e Radar Fiscal.
- [x] Substituir os dados demonstrativos dos Insights por agregações reais.

### Fase 2 — escritas de menor risco

- [x] Completar checklist do cliente e edição cadastral.
- [x] Criar/editar agendamento e disponibilidade.
- [x] Marcar notificações e Caixa Postal como lidas.
- [x] Persistir preferências gerais do painel.
- [ ] Criar e mover tarefas com histórico.
- [x] Completar perfil profissional.

### Fase 3 — comunicação e arquivos

- [x] Implementar Chat Realtime com consulta inicial e reconexão.
- [x] Persistir timer e bloqueio por atendimento.
- [x] Implementar anexos no Storage privado.
- [x] Usar URLs assinadas com expiração para downloads.
- [x] Integrar Copiloto e análise de documentos no servidor.
- [x] Implementar notificações Realtime e deep links.

### Fase 4 — fluxos críticos

- [x] Migrar relatório completo, rascunho e anexos.
- [x] Executar finalização pós-atendimento de forma transacional e idempotente.
- [x] Migrar checkout, recorrência e créditos; webhook permanece no backend legado durante o rollback.
- [x] Migrar o adaptador server-side e a seleção do Radar Fiscal; falta
  homologar consentimento e credenciais dos serviços pagos.
- [ ] Implementar reprocessamento seguro e trilha de auditoria.

### Fase 5 — Área do Cliente

- [ ] Reaplicar os tokens e componentes descritos neste documento.
- [ ] Implementar autenticação e vínculo seguro com `clientes.user_id`.
- [ ] Exibir somente registros pertencentes ao cliente autenticado.
- [ ] Migrar triagem, agenda, mensagens, documentos, pagamentos, relatórios,
  avaliações e Radar Fiscal.
- [ ] Adaptar a densidade: menos opções simultâneas e foco na próxima ação.
- [ ] Testar os mesmos eventos aparecendo de forma consistente nas duas áreas.

### Fase 6 — homologação e corte

- [ ] Testar o fluxo completo com contador, membro de equipe e cliente.
- [ ] Executar testes E2E dos fluxos financeiros e de entrega.
- [ ] Verificar RLS com usuários de organizações diferentes.
- [ ] Validar mobile, teclado, leitor de tela e movimento reduzido.
- [ ] Medir erros, latência e falhas de integrações.
- [ ] Congelar alterações no legado durante o corte.
- [ ] Manter rollback documentado e só remover o legado após estabilização.

## 8. Padrão visual oficial

### 8.1 Direção

O sistema deve parecer leve, profissional e operacional. A base é próxima ao
shadcn: componentes simples, contraste claro, poucos efeitos decorativos e
estados previsíveis. Liquid glass é usado como hierarquia e seleção, não como
ornamento em toda a tela.

### 8.2 Tokens principais

| Token | Valor atual | Uso |
|---|---:|---|
| Fundo | `#dfe5ec` | Superfície geral com contraste para cards claros |
| Texto principal | `#0f172a` | Títulos e ações de alta prioridade |
| Texto secundário | `#64748b` | Descrições, legendas e metadados |
| Borda | `#cbd5e1` | Campos e divisões estruturais |
| Laranja | `#f97316` | Notificações, seleção e ação excepcional |
| Glass | `rgba(255,255,255,.64)` | Cards e controles flutuantes |
| Borda glass | `rgba(255,255,255,.82)` | Contorno translúcido |
| Pílula | `999px` | Tabs, badges, botões e campos de linha única |
| Controle | `18px` | Textareas e controles compostos |
| Card | `22px` | Cards de conteúdo |
| Painel | `26px` | Painéis principais e contêineres grandes |

Os tokens devem virar variáveis compartilhadas ou um pacote interno antes de
começar a Área do Cliente. Não duplicar valores manualmente entre aplicações.

### 8.3 Sidebar e navegação

- largura recolhida: `64px`;
- largura expandida: `238px`;
- ícones: `21px`, `strokeWidth` aproximado de `1.9`;
- item: `48px` de altura e espaçamento vertical total de `53px`;
- seleção: liquid glass com contraste sutil;
- indicador: linha laranja de `18 × 2px` que desliza entre os itens;
- contadores: cápsula laranja, texto branco e borda clara;
- configurações ficam no menu de perfil, não duplicadas na sidebar.

Na Área do Cliente, usar o mesmo padrão visual, mas com menos itens. Em mobile,
preferir navegação inferior ou sheet lateral conforme a quantidade de destinos.

### 8.4 Topo e perfil

- topo sem barra sólida pesada;
- sino flutuante circular de `46 × 46px`;
- contador de notificações sempre laranja;
- hover do sino permanece claro e translúcido, nunca preto;
- perfil em cápsula de aproximadamente `50px` de altura;
- fundo do perfil em liquid glass, blur, saturação e reflexo discreto;
- popovers fecham por clique externo e tecla `Escape`.

### 8.5 Cards

- fundo translúcido claro com contraste perceptível sobre o fundo geral;
- borda branca translúcida;
- raio de `22px`;
- sombra curta para profundidade, sem contorno pesado;
- hover com elevação máxima de `2px` quando o card for interativo;
- cards estáticos não devem parecer clicáveis.

### 8.6 Menus em pílula

- trilho cinza translúcido;
- item ativo branco/translúcido com sombra interna leve;
- transição de `200–240ms` com curva suave;
- mesma altura e raio no chat, financeiro, Radar, relatórios e filtros;
- tabs sempre usam `role="tablist"`, `role="tab"` e `aria-selected`.

### 8.7 Formulários e botões

- inputs e selects de uma linha são totalmente arredondados;
- textarea usa raio de `18px`;
- botão primário escuro para ações normais;
- laranja apenas para destaque, notificação ou ação operacional importante;
- ação destrutiva exige confirmação e cor sem ambiguidade;
- carregamento desabilita repetição e mantém o texto de progresso;
- erro aparece junto ao campo ou formulário, não somente em toast;
- sucesso pode usar toast e atualização imediata do conteúdo.

### 8.8 Gráficos

- usar Recharts por meio de componentes compartilhados;
- tooltip escuro translúcido e legendas compactas;
- laranja como série de destaque, não para todas as séries;
- eixos e grades com contraste baixo;
- animação entre `650–750ms`, respeitando movimento reduzido;
- incluir estado vazio e nunca desenhar dados fictícios como se fossem reais;
- próximo padrão: comparação com período anterior, metas, drill-down, exportação
  e filtros compartilhados;
- na Área do Cliente, mostrar apenas indicadores que gerem uma decisão clara.

### 8.9 Movimento

| Interação | Duração recomendada |
|---|---:|
| Hover de controle | `180–220ms` |
| Troca de pílula | `200–240ms` |
| Entrada de página | `280ms` |
| Indicador da sidebar | `340ms` |
| Dialog/popover | `180–240ms` |
| Gráfico | `650–750ms` |

Sempre manter `prefers-reduced-motion` para reduzir animações a praticamente
zero quando solicitado pelo sistema operacional.

## 9. Componentes que devem ser compartilhados

Antes de iniciar a nova Área do Cliente, extrair ou consolidar:

- `Button`, `IconButton`, `Input`, `Select` e `Textarea`;
- `Card`, `StatCard` e `EmptyState`;
- `Badge` e `NotificationBadge`;
- `PillTabs`;
- `FloatingNotificationButton`;
- `ProfileGlassMenu`;
- `Dialog`, `Popover`, `Dropdown` e `Toast`;
- `PageTitle`, `DataTable` e paginação;
- `ChartContainer`, tooltip, legenda e estado vazio;
- skeleton, erro recuperável e confirmação destrutiva.

Os componentes compartilhados devem expor variantes sem permitir que cada
tela invente novos raios, sombras ou cores.

## 10. Padrão de dados e estados

Cada módulo deve separar:

- consulta no servidor;
- validação do payload;
- autorização e RLS;
- ação de escrita;
- atualização otimista quando segura;
- reconciliação com o resultado real;
- log e mensagem de erro compreensível.

Estados mínimos de toda consulta:

```text
idle → loading → success
               ↘ empty
               ↘ error → retry
```

Estados mínimos de toda escrita:

```text
ready → submitting → success
                   ↘ validation_error
                   ↘ permission_error
                   ↘ integration_error → retry seguro
```

## 11. Segurança e LGPD

- Nunca autorizar por `user_metadata` editável pelo usuário.
- Relacionar autorização a `auth.uid()`, tabelas internas e papéis confiáveis.
- Políticas de UPDATE precisam de leitura correspondente, `USING` e
  `WITH CHECK`.
- Views expostas devem respeitar RLS (`security_invoker` quando aplicável).
- Documentos ficam privados e são acessados por URL assinada curta.
- Upload exige validação de tipo, tamanho, extensão e destino.
- Credenciais GOV.BR, Asaas e SERPRO nunca aparecem no cliente.
- Registrar acesso e alteração de dados sensíveis sem guardar conteúdo
  desnecessário no log.
- Aplicar retenção, exclusão e consentimento conforme o domínio.
- Webhooks precisam de assinatura, idempotência e proteção contra repetição.

Referências oficiais para implementação:

- Supabase SSR com Next.js: `https://supabase.com/docs/guides/auth/server-side/nextjs`
- Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Realtime: `https://supabase.com/docs/guides/realtime/postgres-changes`
- Storage e controle de acesso: `https://supabase.com/docs/guides/storage/security/access-control`

## 12. Testes obrigatórios

### Por módulo

- unidade para validadores, formatadores e regras financeiras;
- integração para queries, Server Actions e Route Handlers;
- teste de RLS com usuário permitido e usuário proibido;
- E2E para o caminho principal e para falhas recuperáveis;
- responsivo em desktop, tablet e mobile;
- teclado, foco, nomes acessíveis e leitor de tela.

### Fluxos ponta a ponta

1. Login do contador → cliente → atendimento → relatório → entrega.
2. Cliente → contratação → pagamento → triagem → agendamento.
3. Upload do cliente → mensagem → notificação → acesso do contador.
4. Atendimento Express → tarefa → entrega → histórico → avaliação.
5. Cobrança Asaas → webhook repetido → uma única confirmação.
6. Radar Fiscal → consentimento → consulta → resultado → aviso.
7. Membro sem permissão tentando ação administrativa ou financeira.

## 13. Definição de pronto

Uma tela só está migrada quando:

- usa dados reais e identifica claramente ambientes de demonstração;
- preserva todas as ações relevantes da versão anterior;
- possui autorização no servidor e RLS verificadas;
- trata loading, vazio, erro, sucesso e nova tentativa;
- funciona em desktop e mobile;
- possui testes proporcionais ao risco;
- registra eventos críticos e falhas;
- foi validada em homologação por um usuário real;
- tem rollback conhecido.

## 14. Próxima execução recomendada

A próxima fatia é **fechamento transacional e testes ponta a ponta**:

1. concluir atendimento, criar versão do relatório e registrar histórico em
   uma operação idempotente;
2. implementar CRUD de agenda com disponibilidade e conflitos;
3. validar Copiloto, e-mail, Asaas e SERPRO com credenciais de homologação;
4. testar RLS com perfis de equipe, administrador e cliente;
5. executar os fluxos E2E e homologar com usuário real;
6. somente então iniciar a Área do Cliente com os mesmos tokens e componentes.

## 15. Decisões pendentes antes do corte

- A aplicação será de um único escritório ou multiempresa?
- Quais papéis oficiais existirão além de administrador e equipe?
- Qual dado identifica o escritório/tenant em cada tabela?
- Quais configurações o cliente pode alterar?
- Quais notificações precisam de e-mail além da Área do Cliente?
- Qual é a política de retenção de mensagens, documentos e auditoria?
- Qual URL substituirá definitivamente a versão antiga?

Essas decisões devem ser resolvidas antes de expandir as políticas RLS ou
duplicar a aplicação para a Área do Cliente.
