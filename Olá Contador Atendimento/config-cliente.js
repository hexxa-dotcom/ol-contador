// ============================================================================
// config-cliente.js — Configurações → Área do Cliente.
//
// Edita a tabela `configuracoes`: o perfil que o cliente vê, as regras da
// triagem e o catálogo de assuntos. Antes disso, mexer numa pergunta da triagem
// exigia editar arquivo e publicar de novo.
//
// Trabalha sobre uma CÓPIA e só grava no Salvar. Auto-salvar aqui seria errado:
// no meio de uma edição o catálogo fica pela metade, e ele é servido ao vivo
// para quem estiver preenchendo a triagem naquele instante.
// ============================================================================
window.ConfigCliente = (function () {
  'use strict';

  var original = null;   // o que veio do banco, para o "descartar"
  var rascunho = null;   // o que está sendo editado
  var montado = false;
  // Quais cards de assunto estão abertos, por índice. Sem isto, cada edição
  // estrutural (trocar tipo, acrescentar pergunta/documento/opção) chamava
  // desenharAssuntos e o card em que a pessoa estava editando se fechava sozinho.
  var abertos = {};

  function $(id) { return document.getElementById(id); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // O select de diagnóstico do dossiê é a lista oficial. Lê de lá para as duas
  // telas nunca discordarem sobre quais diagnósticos existem.
  function diagnosticosDisponiveis() {
    var sel = $('prontuario-diagnostico');
    if (!sel) return [];
    return [].slice.call(sel.options).map(function (o) { return o.value; });
  }

  async function abrir() {
    if (!$('tab-cliente')) return;
    if (!montado) {
      $('cfg-salvar').addEventListener('click', salvar);
      $('cfg-descartar').addEventListener('click', descartar);
      $('cfg-add-assunto').addEventListener('click', novoAssunto);
      montado = true;
    }
    try {
      var res = await fetch(API_BASE + '/api/config');
      var cfg = await res.json();
      original = {
        contador_perfil: cfg.contador_perfil || { nome: '', crc: '', especialidade: '' },
        triagem_regras: cfg.triagem_regras || { minimoRelato: 20, obrigatoriaParaChat: false },
        triagem_assuntos: cfg.triagem_assuntos || []
      };
      rascunho = clonar(original);
      desenhar();
    } catch (e) {
      console.error('Falha ao carregar as configurações:', e);
      avisar('Não consegui carregar as configurações.', 'erro');
    }
  }

  function desenhar() {
    abertos = {};   // recomeça com todos os cards fechados
    $('cfg-contador-nome').value = rascunho.contador_perfil.nome || '';
    $('cfg-contador-crc').value = rascunho.contador_perfil.crc || '';
    $('cfg-contador-espec').value = rascunho.contador_perfil.especialidade || '';
    $('cfg-triagem-obrigatoria').checked = !!rascunho.triagem_regras.obrigatoriaParaChat;
    $('cfg-triagem-minimo').value = rascunho.triagem_regras.minimoRelato != null
      ? rascunho.triagem_regras.minimoRelato : 20;
    desenharAssuntos();
  }

  function lerCampos() {
    rascunho.contador_perfil = {
      nome: $('cfg-contador-nome').value.trim(),
      crc: $('cfg-contador-crc').value.trim(),
      especialidade: $('cfg-contador-espec').value.trim()
    };
    rascunho.triagem_regras = {
      obrigatoriaParaChat: $('cfg-triagem-obrigatoria').checked,
      minimoRelato: parseInt($('cfg-triagem-minimo').value, 10) || 0
    };
  }

  // ------------------------------------------------------------- assuntos
  function desenharAssuntos() {
    var box = $('cfg-assuntos');
    box.innerHTML = '';
    if (!rascunho.triagem_assuntos.length) {
      box.innerHTML = '<p class="cfg-vazio">Nenhum assunto. O cliente veria a triagem em branco — acrescente pelo menos um.</p>';
      return;
    }
    rascunho.triagem_assuntos.forEach(function (a, i) {
      box.appendChild(cardAssunto(a, i));
    });
  }

  function cardAssunto(a, i) {
    var card = document.createElement('div');
    card.className = 'cfg-assunto';

    var cabeca = document.createElement('div');
    cabeca.className = 'cfg-assunto-cabeca';
    cabeca.innerHTML =
      '<i class="fa-solid fa-chevron-right cfg-seta"></i>' +
      '<i class="fa-solid ' + esc(a.icone || 'fa-circle-question') + '" style="color: var(--color-coral); width: 16px;"></i>' +
      '<div class="cfg-assunto-resumo">' +
        '<strong>' + esc(a.titulo || '(sem título)') + '</strong>' +
        '<span>' + (a.perguntas || []).length + ' pergunta(s) · ' + (a.documentos || []).length + ' documento(s)</span>' +
      '</div>';

    var acoes = document.createElement('div');
    acoes.className = 'cfg-assunto-acoes';
    acoes.appendChild(botaoIcone('fa-arrow-up', 'Subir', function (e) { e.stopPropagation(); mover(i, -1); }));
    acoes.appendChild(botaoIcone('fa-arrow-down', 'Descer', function (e) { e.stopPropagation(); mover(i, 1); }));
    acoes.appendChild(botaoIcone('fa-trash', 'Remover', function (e) { e.stopPropagation(); removerAssunto(i); }, 'perigo'));
    cabeca.appendChild(acoes);

    var corpo = document.createElement('div');
    corpo.className = 'cfg-assunto-corpo';
    corpo.hidden = !abertos[i];
    cabeca.querySelector('.cfg-seta').className =
      'fa-solid cfg-seta ' + (corpo.hidden ? 'fa-chevron-right' : 'fa-chevron-down');
    montarCorpo(corpo, a, i);

    cabeca.addEventListener('click', function () {
      corpo.hidden = !corpo.hidden;
      abertos[i] = !corpo.hidden;
      cabeca.querySelector('.cfg-seta').className =
        'fa-solid cfg-seta ' + (corpo.hidden ? 'fa-chevron-right' : 'fa-chevron-down');
    });

    card.appendChild(cabeca);
    card.appendChild(corpo);
    return card;
  }

  function botaoIcone(icone, titulo, aoClicar, classe) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cfg-btn-icone' + (classe ? ' ' + classe : '');
    b.title = titulo;
    b.innerHTML = '<i class="fa-solid ' + icone + '"></i>';
    b.addEventListener('click', aoClicar);
    return b;
  }

  function montarCorpo(corpo, a, i) {
    corpo.innerHTML =
      '<label class="cfg-label">Título — como o cliente diria</label>' +
      '<input class="cfg-input" data-campo="titulo" value="' + esc(a.titulo || '') + '">' +
      '<label class="cfg-label">Subtítulo</label>' +
      '<input class="cfg-input" data-campo="resumo" value="' + esc(a.resumo || '') + '">' +
      '<div class="cfg-grid" style="margin-top: 12px;">' +
        '<div><label class="cfg-label">Ícone (Font Awesome)</label>' +
        '<input class="cfg-input" data-campo="icone" value="' + esc(a.icone || '') + '" placeholder="fa-triangle-exclamation"></div>' +
        '<div><label class="cfg-label">Hipótese de diagnóstico</label>' + selectDiagnostico(a) + '</div>' +
      '</div>';

    corpo.querySelectorAll('[data-campo]').forEach(function (el) {
      el.addEventListener('input', function () {
        rascunho.triagem_assuntos[i][el.dataset.campo] = el.value;
      });
    });
    corpo.querySelector('[data-diag]').addEventListener('change', function () {
      rascunho.triagem_assuntos[i].diagnosticoProvavel = this.value || null;
    });

    corpo.appendChild(blocoLista('Documentos que costumam ajudar', a.documentos || [], function (nova) {
      rascunho.triagem_assuntos[i].documentos = nova;
      desenharAssuntos();
    }, 'Ex.: Notificação da Receita'));

    corpo.appendChild(blocoPerguntas(a, i));
  }

  function selectDiagnostico(a) {
    var opts = '<option value="">Nenhuma — o contador decide</option>';
    diagnosticosDisponiveis().forEach(function (d) {
      opts += '<option value="' + esc(d) + '"' + (a.diagnosticoProvavel === d ? ' selected' : '') + '>' + esc(d) + '</option>';
    });
    return '<select class="cfg-input" data-diag>' + opts + '</select>';
  }

  // Lista de textos simples (documentos, opções de uma pergunta).
  function blocoLista(titulo, itens, aoMudar, placeholder) {
    var wrap = document.createElement('div');
    wrap.className = 'cfg-lista';
    wrap.innerHTML = '<label class="cfg-label">' + esc(titulo) + '</label>';

    var chips = document.createElement('div');
    chips.className = 'cfg-chips';
    itens.forEach(function (item, k) {
      var chip = document.createElement('span');
      chip.className = 'cfg-chip';
      chip.textContent = item;
      var x = document.createElement('button');
      x.type = 'button';
      x.innerHTML = '&times;';
      x.title = 'Remover';
      x.addEventListener('click', function () {
        var nova = itens.slice();
        nova.splice(k, 1);
        aoMudar(nova);
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);

    var add = document.createElement('div');
    add.className = 'cfg-add-linha';
    var input = document.createElement('input');
    input.className = 'cfg-input';
    input.placeholder = placeholder || 'Acrescentar...';
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'cfg-btn-add';
    botao.textContent = 'Acrescentar';
    function acrescentar() {
      var v = input.value.trim();
      if (!v) return;
      aoMudar(itens.concat([v]));
    }
    botao.addEventListener('click', acrescentar);
    // Enter acrescenta: quem está digitando cinco documentos não quer trocar
    // para o mouse a cada um.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); acrescentar(); }
    });
    add.appendChild(input);
    add.appendChild(botao);
    wrap.appendChild(add);
    return wrap;
  }

  function blocoPerguntas(a, i) {
    var wrap = document.createElement('div');
    wrap.className = 'cfg-lista';
    wrap.innerHTML = '<label class="cfg-label">Perguntas deste assunto</label>';

    (a.perguntas || []).forEach(function (p, k) {
      var linha = document.createElement('div');
      linha.className = 'cfg-pergunta';

      var topo = document.createElement('div');
      topo.className = 'cfg-pergunta-topo';

      var lbl = document.createElement('input');
      lbl.className = 'cfg-input';
      lbl.value = p.label || '';
      lbl.placeholder = 'A pergunta, na língua do cliente';
      lbl.addEventListener('input', function () { p.label = this.value; });

      var tipo = document.createElement('select');
      tipo.className = 'cfg-input';
      tipo.style.maxWidth = '130px';
      [['texto', 'Texto curto'], ['textao', 'Texto longo'], ['data', 'Data'],
       ['escolha', 'Escolha'], ['sim-nao', 'Sim / Não']].forEach(function (t) {
        var o = document.createElement('option');
        o.value = t[0]; o.textContent = t[1];
        if ((p.tipo || 'texto') === t[0]) o.selected = true;
        tipo.appendChild(o);
      });
      tipo.addEventListener('change', function () {
        p.tipo = this.value;
        if (p.tipo === 'escolha' && !p.opcoes) p.opcoes = [];
        desenharAssuntos();
      });

      topo.appendChild(lbl);
      topo.appendChild(tipo);
      topo.appendChild(botaoIcone('fa-trash', 'Remover pergunta', function () {
        a.perguntas.splice(k, 1);
        desenharAssuntos();
      }, 'perigo'));
      linha.appendChild(topo);

      var dica = document.createElement('input');
      dica.className = 'cfg-input cfg-input-fraco';
      dica.value = p.dica || '';
      dica.placeholder = 'Dica embaixo da pergunta (opcional)';
      dica.addEventListener('input', function () { p.dica = this.value; });
      linha.appendChild(dica);

      var opc = document.createElement('label');
      opc.className = 'cfg-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!p.opcional;
      cb.addEventListener('change', function () { p.opcional = this.checked; });
      opc.appendChild(cb);
      opc.appendChild(document.createTextNode(' Pode deixar em branco'));
      linha.appendChild(opc);

      if (p.tipo === 'escolha') {
        linha.appendChild(blocoLista('Opções', p.opcoes || [], function (nova) {
          p.opcoes = nova;
          desenharAssuntos();
        }, 'Ex.: Despesas médicas'));
      }

      wrap.appendChild(linha);
    });

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'cfg-btn-add';
    add.innerHTML = '<i class="fa-solid fa-plus"></i> Nova pergunta';
    add.addEventListener('click', function () {
      if (!a.perguntas) a.perguntas = [];
      a.perguntas.push({ id: 'p' + Date.now().toString(36), label: '', tipo: 'texto' });
      desenharAssuntos();
    });
    wrap.appendChild(add);
    return wrap;
  }

  function novoAssunto() {
    rascunho.triagem_assuntos.push({
      id: 'assunto-' + Date.now().toString(36),
      titulo: '', resumo: '', icone: 'fa-circle-question',
      diagnosticoProvavel: null, perguntas: [], documentos: []
    });
    // Já abre o card novo — a pessoa acabou de criá-lo para preencher.
    abertos[rascunho.triagem_assuntos.length - 1] = true;
    desenharAssuntos();
  }

  function removerAssunto(i) {
    var a = rascunho.triagem_assuntos[i];
    if (!confirm('Remover "' + (a.titulo || 'assunto sem título') + '"?\n\nTriagens já enviadas com esse assunto continuam no sistema, mas o painel não vai mais saber traduzi-las.')) return;
    rascunho.triagem_assuntos.splice(i, 1);
    // Os índices mudaram; recomeça o estado de aberto para não abrir o card errado.
    abertos = {};
    desenharAssuntos();
  }

  function mover(i, passo) {
    var j = i + passo;
    if (j < 0 || j >= rascunho.triagem_assuntos.length) return;
    var t = rascunho.triagem_assuntos[i];
    rascunho.triagem_assuntos[i] = rascunho.triagem_assuntos[j];
    rascunho.triagem_assuntos[j] = t;
    // A ordem mudou; o estado de aberto por índice não vale mais.
    abertos = {};
    desenharAssuntos();
  }

  // -------------------------------------------------------------- salvar
  // Um catálogo quebrado só apareceria na cara de um cliente que já pagou —
  // por isso a conferência é aqui, antes de gravar, e não na tela dele.
  function problemas() {
    var erros = [];
    var ids = {};
    rascunho.triagem_assuntos.forEach(function (a, i) {
      var quem = a.titulo ? '"' + a.titulo + '"' : 'o assunto ' + (i + 1);
      if (!a.titulo || !a.titulo.trim()) erros.push('O assunto ' + (i + 1) + ' está sem título.');
      if (!a.id) a.id = 'assunto-' + i;
      if (ids[a.id]) erros.push('Dois assuntos com o mesmo identificador (' + a.id + ').');
      ids[a.id] = true;
      (a.perguntas || []).forEach(function (p) {
        if (!p.label || !p.label.trim()) erros.push('Há uma pergunta sem texto em ' + quem + '.');
        if (p.tipo === 'escolha' && (!p.opcoes || !p.opcoes.length))
          erros.push('A pergunta "' + (p.label || '?') + '" é de escolha mas não tem opções.');
      });
    });
    if (!rascunho.triagem_assuntos.length) erros.push('Sem nenhum assunto, o cliente abre a triagem em branco.');
    if (!rascunho.contador_perfil.nome) erros.push('O nome de exibição não pode ficar vazio — é o que o cliente lê no chat.');
    return erros;
  }

  async function salvar() {
    lerCampos();
    var erros = problemas();
    if (erros.length) { avisar(erros[0], 'erro'); return; }

    var btn = $('cfg-salvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    try {
      var res = await fetch(API_BASE + '/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rascunho)
      });
      if (!res.ok) throw new Error('resposta ' + res.status);
      original = clonar(rascunho);
      // O painel também lê o catálogo (card da triagem no dossiê): sem isto ele
      // ficaria com a versão antiga até alguém recarregar a página.
      OC_TRIAGEM.assuntos = clonar(rascunho.triagem_assuntos);
      OC_TRIAGEM.regras = clonar(rascunho.triagem_regras);
      avisar('Salvo. O portal do cliente já está usando isto.', 'ok');
    } catch (e) {
      console.error('Falha ao salvar as configurações:', e);
      avisar('Não consegui salvar. Suas mudanças continuam aqui na tela.', 'erro');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-save"></i> Salvar';
  }

  function descartar() {
    if (!confirm('Descartar as mudanças e voltar ao que está salvo?')) return;
    rascunho = clonar(original);
    desenhar();
    avisar('Voltou ao que estava salvo.', 'ok');
  }

  var avisoTimer = null;
  function avisar(texto, tipo) {
    var el = $('cfg-aviso');
    if (!el) return;
    clearTimeout(avisoTimer);
    el.textContent = texto;
    el.className = 'cfg-aviso ' + (tipo === 'erro' ? 'erro' : 'ok');
    avisoTimer = setTimeout(function () { el.textContent = ''; el.className = 'cfg-aviso'; }, 5000);
  }

  return { abrir: abrir };
})();
