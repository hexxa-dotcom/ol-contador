// ===========================================================================
// Painel do contador no celular
// ---------------------------------------------------------------------------
// O painel foi desenhado para tela grande: a aba de atendimento são QUATRO
// painéis lado a lado (trilha de ícones · fila · conversa · dossiê/copiloto) e
// a navegação tem NOVE seções. Nada disso cabe em 375px.
//
// Em vez de esconder função — o pedido foi explicitamente "sem perder as
// funções" — este módulo reorganiza:
//
//   1. Navegação: as 4 seções do dia a dia ficam na barra de baixo; as outras 5
//      vão para uma folha "Mais". Todas continuam alcançáveis.
//   2. Atendimento: os painéis viram TRÊS VISTAS, uma de cada vez —
//      Fila → Conversa → Dossiê — com voltar, como qualquer app de mensagem.
//   3. Atalhos do compositor: recolhidos atrás de um botão, para sobrar tela
//      para a conversa.
//
// Só roda abaixo de 768px, e desfaz tudo se a janela crescer (girar o celular,
// abrir no iPad): o desktop continua exatamente como era.
// ===========================================================================

(function () {
  'use strict';

  const MQ = window.matchMedia('(max-width: 768px)');

  // Seções que o contador usa enquanto atende. O resto é administração, que na
  // prática se faz no computador — vai para a folha "Mais", não some.
  const PRIMARIAS = [
    'section-atendimento',
    'section-agendamentos',
    'section-clientes',
    'section-dashboard'
  ];

  // Rótulos curtos: "Atendimentos" e "Agendamentos" são quase idênticos de
  // relance e não cabem lado a lado numa barra de 5 colunas.
  const ROTULO_CURTO = {
    'section-atendimento': 'Atender',
    'section-agendamentos': 'Agenda',
    'section-clientes': 'Clientes',
    'section-dashboard': 'Painel'
  };

  let montado = false;

  // ------------------------------------------------------------------
  // 1. NAVEGAÇÃO — barra inferior + folha "Mais"
  // ------------------------------------------------------------------

  function itensNav() {
    return [...document.querySelectorAll('.app-sidebar-nav .nav-item[data-target]')];
  }

  function montarNav() {
    const barra = document.querySelector('.app-sidebar-nav');
    if (!barra || document.getElementById('mob-btn-mais')) return;

    itensNav().forEach(item => {
      const alvo = item.dataset.target;
      const primaria = PRIMARIAS.includes(alvo);
      item.classList.toggle('mob-primaria', primaria);
      if (primaria && ROTULO_CURTO[alvo]) {
        const rot = item.querySelector('.nav-label');
        if (rot && !rot.dataset.rotuloLongo) {
          rot.dataset.rotuloLongo = rot.textContent.trim();
          rot.textContent = ROTULO_CURTO[alvo];
        }
      }
    });

    // Botão "Mais" — quinta coluna da barra.
    const mais = document.createElement('button');
    mais.id = 'mob-btn-mais';
    mais.className = 'nav-item mob-primaria';
    mais.type = 'button';
    mais.innerHTML = '<i class="fa-solid fa-ellipsis"></i> <span class="nav-label">Mais</span>';
    mais.addEventListener('click', abrirFolha);
    barra.appendChild(mais);

    montarFolha();
  }

  function montarFolha() {
    if (document.getElementById('mob-folha')) return;

    const fundo = document.createElement('div');
    fundo.id = 'mob-folha-fundo';
    fundo.addEventListener('click', fecharFolha);

    const folha = document.createElement('div');
    folha.id = 'mob-folha';
    folha.setAttribute('role', 'dialog');
    folha.setAttribute('aria-label', 'Mais seções');

    const titulo = document.createElement('div');
    titulo.className = 'mob-folha-titulo';
    titulo.textContent = 'Mais';
    folha.appendChild(titulo);

    // Os botões da folha NÃO duplicam lógica: clicam no item original da
    // barra lateral, que já tem todo o roteamento. Se o roteamento mudar,
    // isto continua funcionando sozinho.
    itensNav()
      .filter(item => !PRIMARIAS.includes(item.dataset.target))
      .forEach(original => {
        const icone = original.querySelector('i');
        const rot = original.querySelector('.nav-label');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mob-folha-item';
        b.dataset.target = original.dataset.target;
        b.innerHTML = '<i class="' + (icone ? icone.className : 'fa-solid fa-circle') + '"></i>' +
                      '<span>' + (rot ? rot.textContent.trim() : original.title || '') + '</span>';
        b.addEventListener('click', () => {
          fecharFolha();
          original.click();
        });
        folha.appendChild(b);
      });

    // Só entra "Sair" na folha se ele viver na barra lateral. No painel do
    // contador o [data-logout] fica no cabeçalho, que continua visível no
    // celular — repetir aqui seria dois botões para a mesma coisa.
    const sair = document.querySelector('.app-sidebar-nav [data-logout]');
    if (sair) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mob-folha-item mob-folha-sair';
      b.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i><span>Sair</span>';
      b.addEventListener('click', () => { fecharFolha(); sair.click(); });
      folha.appendChild(b);
    }

    document.body.appendChild(fundo);
    document.body.appendChild(folha);
  }

  function abrirFolha() {
    document.body.classList.add('mob-folha-aberta');
  }

  function fecharFolha() {
    document.body.classList.remove('mob-folha-aberta');
  }

  // O "Mais" precisa acender quando a seção visível é uma das secundárias,
  // senão a pessoa navega para Financeiro e a barra não indica nada.
  function sincronizarMais() {
    const mais = document.getElementById('mob-btn-mais');
    if (!mais) return;
    const ativa = document.querySelector('.content-panel.active');
    const secundaria = !!ativa && !PRIMARIAS.includes(ativa.id);
    mais.classList.toggle('active', secundaria);
  }

  // ------------------------------------------------------------------
  // 2. ATENDIMENTO — três vistas, uma de cada vez
  // ------------------------------------------------------------------

  function modulo() {
    return document.querySelector('.atendimento-module-container');
  }

  function irPara(vista) {
    const m = modulo();
    if (!m) return;
    m.dataset.mob = vista;
    // A conversa rola até o fim ao abrir; sem isto ela aparece no topo,
    // mostrando mensagens velhas em vez da última.
    if (vista === 'chat') {
      const hist = document.getElementById('chat-messages');
      if (hist) requestAnimationFrame(() => { hist.scrollTop = hist.scrollHeight; });
    }
    if (vista === 'copilot') {
      const hist = document.getElementById('copilot-chat');
      if (hist) requestAnimationFrame(() => { hist.scrollTop = hist.scrollHeight; });
    }
  }

  function vistaAtual() {
    const m = modulo();
    return m ? (m.dataset.mob || 'fila') : null;
  }

  function montarAtendimento() {
    const m = modulo();
    if (!m || m.dataset.mobPronto) return;
    m.dataset.mobPronto = '1';

    // --- Botão voltar + atalho do dossiê no cabeçalho da conversa ---
    const cab = m.querySelector('.chat-area-header');
    if (cab && !document.getElementById('mob-btn-voltar')) {
      const voltar = document.createElement('button');
      voltar.id = 'mob-btn-voltar';
      voltar.type = 'button';
      voltar.title = 'Voltar para os chats';
      voltar.setAttribute('aria-label', 'Voltar para os chats');
      voltar.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      voltar.addEventListener('click', () => irPara('fila'));
      cab.insertBefore(voltar, cab.firstChild);

      const dossie = document.createElement('button');
      dossie.id = 'mob-btn-dossie';
      dossie.type = 'button';
      dossie.title = 'Abrir dossiê do cliente';
      dossie.setAttribute('aria-label', 'Abrir dossiê do cliente');
      dossie.innerHTML = '<i class="fa-solid fa-notes-medical"></i>';
      dossie.addEventListener('click', () => {
        // O dossiê morava num painel lateral do atendimento
        // (panel-content-dossie); numa reforma ele virou a seção própria
        // "Relatório" (section-dossie). O botão serve os dois mundos: usa o
        // painel se existir, senão navega para a seção — que o app.js já
        // popula com o cliente ativo.
        const btn = document.getElementById('btn-tool-dossie');
        const painel = document.getElementById('panel-content-dossie');
        if (btn && painel) {
          if (!painel.classList.contains('active')) btn.click();
          irPara('dossie');
          return;
        }
        const nav = document.querySelector('.nav-item[data-target="section-dossie"]');
        if (nav) nav.click();
      });
      cab.appendChild(dossie);
    }

    // --- Voltar de dentro do dossiê ---
    const painelDossie = document.getElementById('panel-content-dossie');
    if (painelDossie && !document.getElementById('mob-dossie-voltar')) {
      const barra = document.createElement('button');
      barra.id = 'mob-dossie-voltar';
      barra.type = 'button';
      barra.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Voltar para a conversa';
      barra.addEventListener('click', () => irPara('chat'));
      painelDossie.insertBefore(barra, painelDossie.firstChild);
    }

    // --- Voltar de dentro do Copiloto IA ---
    const painelCopilot = document.getElementById('panel-content-copilot');
    if (painelCopilot && !document.getElementById('mob-copilot-voltar')) {
      const barra = document.createElement('button');
      barra.id = 'mob-copilot-voltar';
      barra.type = 'button';
      barra.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Voltar para os chats';
      barra.addEventListener('click', () => irPara('fila'));
      painelCopilot.insertBefore(barra, painelCopilot.firstChild);
    }

    // --- A 2ª aba do painel (Fila/Agenda) vira Copiloto IA no celular ---
    // No desktop essa aba mostra a Agenda do Dia; no celular ela já existe
    // inteira na seção "Agendamentos" da barra de baixo, então repetir aqui é
    // redundante — e o Copiloto, sem isso, não tinha NENHUM jeito de abrir no
    // celular (a trilha de ícones que o abre só existe no desktop).
    const abaAgenda = document.getElementById('aba-agenda');
    if (abaAgenda && !abaAgenda.dataset.mobCopilotBind) {
      abaAgenda.dataset.mobCopilotBind = '1';
      // Fase de captura: roda antes do listener de desktop (trocarListaDoPainel)
      // e o interrompe quando estamos no celular, sem mexer no código dele.
      abaAgenda.addEventListener('click', (ev) => {
        if (!MQ.matches) return;
        ev.stopImmediatePropagation();
        ev.preventDefault();
        irPara('copilot');
      }, true);
    }

    // --- Escolher um cliente na fila abre a conversa ---
    // Delegado no container: a lista é redesenhada por renderClientList() a
    // cada atualização, então prender o evento nos itens não sobreviveria.
    const lista = document.getElementById('client-list-tab');
    if (lista) {
      lista.addEventListener('click', ev => {
        if (!MQ.matches) return;
        if (ev.target.closest('.chat-item')) irPara('chat');
      });
    }

    // --- Atalhos do compositor recolhidos ---
    const atalhos = m.querySelector('.shortcuts-bar');
    if (atalhos && !document.getElementById('mob-btn-atalhos')) {
      const b = document.createElement('button');
      b.id = 'mob-btn-atalhos';
      b.type = 'button';
      b.title = 'Atalhos';
      b.setAttribute('aria-label', 'Mostrar atalhos');
      b.innerHTML = '<i class="fa-solid fa-bolt"></i>';
      b.addEventListener('click', () => {
        const aberto = m.classList.toggle('mob-atalhos-abertos');
        b.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
      const form = m.querySelector('#chat-form');
      if (form) form.insertBefore(b, form.firstChild);
      // Escolher um atalho já fecha a gaveta.
      atalhos.addEventListener('click', ev => {
        if (ev.target.closest('.btn-shortcut-tag')) {
          m.classList.remove('mob-atalhos-abertos');
        }
      });
    }

    irPara('fila');
  }

  // O seletor de tag mora junto do nome do cliente. Numa tela de 375px isso
  // empurrava o cabeçalho para 236px de altura — quase um terço do celular
  // gasto em cabeçalho. No celular ele passa para a linha de ações, que já rola
  // de lado; ao voltar para tela grande, volta para o lugar de origem.
  //
  // É MOVER, não clonar: mesmo elemento, mesmos listeners, mesmo valor. Um
  // clone daria um select que muda de valor e não muda nada no atendimento.
  function moverTag(paraCelular) {
    const m = modulo();
    if (!m) return;
    const acoes = m.querySelector('.chat-actions-top');
    const casa = m.querySelector('.active-client-details');
    if (!acoes || !casa) return;

    if (paraCelular) {
      const tag = casa.querySelector('select');
      if (tag) {
        tag.dataset.mobMovido = '1';
        acoes.insertBefore(tag, acoes.firstChild);
      }
    } else {
      const tag = acoes.querySelector('select[data-mob-movido]');
      if (tag) {
        delete tag.dataset.mobMovido;
        casa.appendChild(tag);
      }
    }
  }

  // Rótulo da 2ª aba: "Agenda do dia" (desktop) vira "Copiloto IA" (celular).
  // Reversível — o innerHTML original fica guardado pra desfazer ao girar a
  // tela ou abrir num tablet, igual ao ROTULO_CURTO da navegação.
  function trocarRotuloAbaAgenda(paraCelular) {
    const aba = document.getElementById('aba-agenda');
    if (!aba) return;
    if (paraCelular) {
      if (!aba.dataset.rotuloOriginal) aba.dataset.rotuloOriginal = aba.innerHTML;
      aba.innerHTML = '<i class="fa-solid fa-robot"></i> Copiloto IA';
    } else if (aba.dataset.rotuloOriginal) {
      aba.innerHTML = aba.dataset.rotuloOriginal;
      delete aba.dataset.rotuloOriginal;
    }
  }

  // O botão físico de voltar do Android deve recuar a vista, não sair do painel.
  window.addEventListener('popstate', () => {
    if (!MQ.matches) return;
    const v = vistaAtual();
    if (v === 'dossie') { irPara('chat'); history.pushState(null, ''); }
    else if (v === 'copilot') { irPara('fila'); history.pushState(null, ''); }
    else if (v === 'chat') { irPara('fila'); history.pushState(null, ''); }
  });

  // ------------------------------------------------------------------
  // Montagem / desmontagem
  // ------------------------------------------------------------------

  function montar() {
    if (montado) return;
    montado = true;
    document.body.classList.add('mob-contador');
    montarNav();
    montarAtendimento();
    moverTag(true);
    trocarRotuloAbaAgenda(true);
    sincronizarMais();
  }

  function desmontar() {
    if (!montado) return;
    montado = false;
    document.body.classList.remove('mob-contador');
    fecharFolha();
    moverTag(false);
    trocarRotuloAbaAgenda(false);
    // Devolve os rótulos longos e libera o layout de 4 painéis do desktop.
    document.querySelectorAll('.nav-label[data-rotulo-longo]').forEach(r => {
      r.textContent = r.dataset.rotuloLongo;
      delete r.dataset.rotuloLongo;
    });
    const m = modulo();
    if (m) delete m.dataset.mob;
  }

  function avaliar() {
    if (MQ.matches) montar(); else desmontar();
  }

  function iniciar() {
    avaliar();
    if (MQ.addEventListener) MQ.addEventListener('change', avaliar);
    else MQ.addListener(avaliar);

    // Rede de segurança: em alguns navegadores (e no painel de preview) o evento
    // 'change' do matchMedia não dispara em toda mudança de viewport, e o painel
    // fica preso no modo errado — barra lateral ocupando a tela inteira. O
    // resize sempre vem. Como avaliar() é idempotente, chamar duas vezes não
    // custa nada; não chamar uma vez custa o layout inteiro.
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(avaliar, 150);
    });
    window.addEventListener('orientationchange', () => setTimeout(avaliar, 200));

    // A barra precisa refletir a seção ativa mesmo quando a troca vem de outro
    // lugar do app (um "ver detalhes" que pula para Clientes, por exemplo).
    document.querySelectorAll('.app-sidebar-nav .nav-item[data-target]')
      .forEach(i => i.addEventListener('click', () => setTimeout(sincronizarMais, 0)));

    history.pushState(null, '');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  // O app.js monta a lista de clientes depois; expõe para ele avisar quando
  // trocar de cliente por conta própria (notificação, card da agenda).
  window.OCMobile = {
    irParaConversa() { if (MQ.matches) irPara('chat'); },
    ativo() { return MQ.matches; }
  };
})();
