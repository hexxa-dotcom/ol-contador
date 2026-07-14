# Olá, Contador — Painel Administrativo Geral & Central de Atendimento

Este projeto é um protótipo funcional e interativo do **Painel de Controle do Administrador** para a plataforma Olá, Contador. A aplicação foi expandida para além do chat de atendimento e se tornou um sistema completo de gestão de escritório (Dashboard, Central de Agendamentos, Sistema de Prontuário Fiscal e Registro de Notificações).

---

## 🚀 Como Executar

O projeto foi construído em **HTML5, CSS3 e JavaScript puro (Vanilla JS)**. Não há dependências de build ou instalações.

1. Navegue até a pasta:
   `/Users/filipeheck/Downloads/Meus Projetos/Olá, Contador/Olá Contador Atendimento/`
2. Dê um duplo clique no arquivo `index.html` para abrir diretamente no navegador.
3. Se quiser rodar com um servidor local:
   ```bash
   npx serve .
   ```

---

## 💎 Módulos e Funcionalidades

### 1. 📊 Painel Geral (Dashboard Executivo)
* **KPI Cards:** Exibe estatísticas consolidadas e faturamento semanal dinâmico (somando honorários profissionais).
* **Agenda de Atividades de Hoje:** Timeline vertical que puxa os compromissos diários com atalho rápido ("Chat") para iniciar a conversa correspondente.
* **Produtividade Semanal:** Gráfico de volumetria de atendimento resolvido por dia da semana construído em HTML/CSS.

### 2. 💬 Atendimentos (Central de Chat)
* **Lista de Conversas:** Painel com badges de status de pendência de documentos.
* **Chat Interativo:** Linha do tempo de mensagens, incluindo áudios, uploads fictícios e atalhos rápidos de frases frequentes (`/boasvindas`, `/doc-malha`, `/honorarios`).
* **Calculadoras Fiscais Modais:** Calculadoras de Ganho de Capital e Simples Nacional com envio direto da memória de cálculo no chat do cliente.

### 3. 🩺 Prontuário & Receita Fiscal (Estilo Memed)
* Campo de Diagnóstico Fiscal dinâmico que repopula as tags de evidências coletadas.
* O contador seleciona evidências para montar o prontuário.
* **Gerar Receita Fiscal:** Abre a receita em formato impresso profissional contendo assinaturas e selos oficiais. É possível **compartilhar no chat**, **gerar PDF** ou **imprimir**.

### 4. 📅 Sistema de Agendamento
* Log de consultas reservadas filtrável (Hoje, Próximos, Concluídos).
* **Formulário de Reserva:** Permite cadastrar novos agendamentos na agenda geral, atualizando a timeline do dashboard e notificando o sistema.

### 5. 🔔 Central de Notificações (Reatividade Integrada)
* Sino com contagem dinâmica no cabeçalho + painel suspenso de notificações.
* Tela de Log de Notificações completo para acompanhar uploads de arquivos de clientes em tempo real (ex: ao usar o "Simulador de Cliente" para enviar arquivo no chat, o sistema gera instantaneamente um alerta global de notificação).
