// ============================================================================
// triagem.js — o pré-atendimento do portal do cliente.
//
// A tela inteira nasce do triagem-catalogo.js: acrescentar um assunto lá faz
// aparecer aqui, sem tocar neste arquivo.
//
// Nada aqui escreve no prontuário. O cliente só grava na tabela `triagens` —
// o RLS de `clientes` (update = is_staff) garante isso mesmo que este código
// tentasse. Quem transforma o relato em diagnóstico é o contador, no painel dele.
// ============================================================================
window.TriagemUI = (function () {
  'use strict';

  var CLIENT_ID = null;
  var triagem = { assunto: null, descricao: '', respostas: {}, status: 'rascunho' };
  var documentos = [];
  var salvarTimer = null;
  var enviando = false;

  // --------------------------------------------------------------- utilidades
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ------------------------------------------------------------------ arranque
  async function iniciar(clientId) {
    CLIENT_ID = clientId;
    if (!$('triagem-assuntos')) return;

    // O catálogo vem do banco (Configurações → Área do Cliente). Precisa chegar
    // antes de desenhar, senão a tela montaria com a lista de reserva e trocaria
    // debaixo do cliente meio segundo depois.
    await Promise.all([OC_TRIAGEM.carregar(), carregarTriagem(), carregarDocumentos()]);
    desenharAssuntos();
    if (triagem.assunto) abrirAssunto(triagem.assunto, true);
    $('triagem-enviar').addEventListener('click', enviar);
    $('triagem-descricao').addEventListener('input', function () {
      triagem.descricao = this.value;
      agendarSalvar();
      atualizarMedidor();
    });
    atualizarMedidor();
    atualizarBadge();
    desenharSalaDeEspera();
  }

  async function carregarTriagem() {
    try {
      var res = await fetch('/api/triagem?clientId=' + encodeURIComponent(CLIENT_ID));
      var t = await res.json();
      if (t) triagem = { id: t.id, assunto: t.assunto, descricao: t.descricao || '',
                         respostas: t.respostas || {}, status: t.status, enviadaAt: t.enviadaAt };
    } catch (e) { console.error('Falha ao carregar a triagem:', e); }
  }

  async function carregarDocumentos() {
    try {
      var res = await fetch('/api/documentos?clientId=' + encodeURIComponent(CLIENT_ID));
      documentos = await res.json();
    } catch (e) { documentos = []; }
  }

  // ------------------------------------------------------- passo 1: o assunto
  function desenharAssuntos() {
    var box = $('triagem-assuntos');
    box.innerHTML = '';
    OC_TRIAGEM.assuntos.forEach(function (a) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'triagem-assunto' + (triagem.assunto === a.id ? ' escolhido' : '');
      card.dataset.assunto = a.id;
      card.innerHTML =
        '<i class="fa-solid ' + a.icone + '"></i>' +
        '<span class="triagem-assunto-titulo">' + esc(a.titulo) + '</span>' +
        '<span class="triagem-assunto-resumo">' + esc(a.resumo) + '</span>';
      card.addEventListener('click', function () { escolherAssunto(a.id); });
      box.appendChild(card);
    });
  }

  function escolherAssunto(id) {
    // Trocar de assunto zera as respostas: elas eram de outras perguntas, e
    // arrastá-las adiante encheria o prontuário do contador de lixo.
    if (triagem.assunto && triagem.assunto !== id) triagem.respostas = {};
    triagem.assunto = id;
    desenharAssuntos();
    abrirAssunto(id);
    agendarSalvar();
  }

  function abrirAssunto(id, silencioso) {
    var a = OC_TRIAGEM.acharAssunto(id);
    if (!a) return;
    desenharPerguntas(a);
    desenharDocs(a);
    $('triagem-bloco-detalhes').hidden = false;
    $('triagem-bloco-docs').hidden = false;
    $('triagem-barra').hidden = false;
    $('triagem-descricao').value = triagem.descricao || '';
    atualizarMedidor();
    if (!silencioso) $('triagem-bloco-detalhes').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // -------------------------------------------- passo 2: perguntas do assunto
  function desenharPerguntas(a) {
    var box = $('triagem-perguntas');
    box.innerHTML = '';
    a.perguntas.forEach(function (p) {
      var wrap = document.createElement('div');
      wrap.className = 'triagem-campo';
      var valor = triagem.respostas[p.id] || '';
      var marca = p.opcional ? '<span class="triagem-opcional">opcional</span>' : '';
      var dica = p.dica ? '<p class="triagem-dica">' + esc(p.dica) + '</p>' : '';

      wrap.innerHTML = '<label class="triagem-label">' + esc(p.label) + ' ' + marca + '</label>' + dica;
      wrap.appendChild(campoDe(p, valor));
      box.appendChild(wrap);
    });
  }

  function campoDe(p, valor) {
    var el;
    if (p.tipo === 'escolha') {
      el = document.createElement('div');
      el.className = 'triagem-opcoes';
      p.opcoes.forEach(function (op) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'triagem-opcao' + (valor === op ? ' escolhido' : '');
        b.textContent = op;
        b.addEventListener('click', function () {
          // Clicar de novo desmarca: sem isso, um clique errado numa pergunta
          // opcional ficaria preso para sempre.
          responder(p.id, valor === op ? '' : op);
          desenharPerguntas(OC_TRIAGEM.acharAssunto(triagem.assunto));
        });
        el.appendChild(b);
      });
      return el;
    }
    if (p.tipo === 'sim-nao') {
      el = document.createElement('div');
      el.className = 'triagem-opcoes';
      ['Sim', 'Não', 'Não sei'].forEach(function (op) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'triagem-opcao' + (valor === op ? ' escolhido' : '');
        b.textContent = op;
        b.addEventListener('click', function () {
          responder(p.id, valor === op ? '' : op);
          desenharPerguntas(OC_TRIAGEM.acharAssunto(triagem.assunto));
        });
        el.appendChild(b);
      });
      return el;
    }
    if (p.tipo === 'textao') {
      el = document.createElement('textarea');
      el.className = 'triagem-textarea';
      el.rows = 3;
    } else {
      el = document.createElement('input');
      el.className = 'triagem-input';
      el.type = p.tipo === 'data' ? 'date' : 'text';
    }
    el.value = valor;
    el.addEventListener('input', function () { responder(p.id, this.value); });
    return el;
  }

  function responder(id, valor) {
    triagem.respostas[id] = valor;
    agendarSalvar();
    atualizarMedidor();
  }

  // ------------------------------------------------ passo 3: os documentos
  function desenharDocs(a) {
    var box = $('triagem-docs');
    box.innerHTML = '';
    a.documentos.forEach(function (nome) {
      var enviado = documentos.filter(function (d) { return d.checklistItem === nome; })[0];
      var item = document.createElement('div');
      item.className = 'triagem-doc' + (enviado ? ' pronto' : '');
      item.innerHTML =
        '<i class="fa-solid ' + (enviado ? 'fa-circle-check' : 'fa-circle-plus') + '"></i>' +
        '<div class="triagem-doc-nome">' + esc(nome) +
          (enviado ? '<span class="triagem-doc-arquivo">' + esc(enviado.fileName) + '</span>' : '') +
        '</div>';

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'triagem-doc-btn';
      botao.textContent = enviado ? 'Trocar' : 'Anexar';
      botao.addEventListener('click', function () { pedirArquivo(nome, botao); });
      item.appendChild(botao);
      box.appendChild(item);
    });
  }

  function pedirArquivo(nomeDoItem, botao) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.addEventListener('change', async function () {
      if (!this.files.length) return;
      var file = this.files[0];
      var textoOriginal = botao.textContent;
      botao.disabled = true;
      botao.textContent = 'Enviando...';
      try {
        var dataBase64 = await lerBase64(file);
        var res = await fetch('/api/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: CLIENT_ID, fileName: file.name, mime: file.type,
            dataBase64: dataBase64, uploadedBy: 'client', checklistItem: nomeDoItem
          })
        });
        if (!res.ok) throw new Error('resposta ' + res.status);
        await carregarDocumentos();
        desenharDocs(OC_TRIAGEM.acharAssunto(triagem.assunto));
      } catch (e) {
        console.error('Falha ao anexar:', e);
        botao.disabled = false;
        botao.textContent = textoOriginal;
        avisar('Não consegui anexar esse arquivo. Tente de novo.', 'erro');
      }
    });
    input.click();
  }

  function lerBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // ------------------------------------------------- salvar, medir, enviar
  // Rascunho salva sozinho: quem está contando um problema fiscal não deveria
  // ter que lembrar de apertar "salvar" — e perder o texto seria imperdoável.
  function agendarSalvar() {
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(salvar, 800);
  }

  async function salvar(enviar) {
    try {
      var res = await fetch('/api/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_ID, assunto: triagem.assunto,
          descricao: triagem.descricao, respostas: triagem.respostas, enviar: !!enviar
        })
      });
      if (!res.ok) throw new Error('resposta ' + res.status);
      var t = await res.json();
      triagem.id = t.id;
      triagem.status = t.status;
      triagem.enviadaAt = t.enviadaAt;
      marcarSalvo();
      return true;
    } catch (e) {
      console.error('Falha ao salvar a triagem:', e);
      avisar('Não consegui salvar agora. Vou tentar de novo quando você continuar.', 'erro');
      return false;
    }
  }

  // Um timer só para o aviso. Com um setTimeout novo a cada salvamento, o timer
  // de um "Salvo" antigo apagava a mensagem seguinte no meio — inclusive avisos
  // de erro, que sumiam antes de serem lidos.
  var avisoTimer = null;

  function marcarSalvo() { avisar('Salvo', 'ok', 2000); }

  function avisar(texto, tipo, sumirEm) {
    var el = $('triagem-salvo');
    if (!el) return;
    clearTimeout(avisoTimer);
    el.textContent = texto;
    el.className = 'triagem-salvo ' + (tipo === 'erro' ? 'erro' : 'ok');
    if (sumirEm) {
      avisoTimer = setTimeout(function () {
        el.textContent = '';
        el.className = 'triagem-salvo';
      }, sumirEm);
    }
  }

  function atualizarMedidor() {
    var pct = OC_TRIAGEM.completude(triagem);
    var barra = $('triagem-medidor-barra');
    if (!barra) return;
    barra.style.width = pct + '%';
    $('triagem-medidor-pct').textContent = pct + '%';
    $('triagem-medidor-texto').textContent =
      pct >= 90 ? 'O contador vai chegar sabendo do seu caso' :
      pct >= 60 ? 'Já dá um bom contexto — se puder, complete' :
      pct >= 30 ? 'Falta o principal: o que aconteceu' :
                  'Vamos lá';
    var btn = $('triagem-enviar');
    if (triagem.status === 'enviada') {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado — atualizar';
    }
  }

  // O mínimo: assunto + relato. Documento e detalhe são bônus. Barrar quem já
  // pagou por causa de um campo opcional seria maltratar cliente.
  function faltaOMinimo() {
    if (!triagem.assunto) return 'Escolha do que se trata, ali em cima.';
    if ((triagem.descricao || '').trim().length < (OC_TRIAGEM.regras.minimoRelato || 20))
      return 'Conte um pouco do que aconteceu — nem que sejam duas linhas.';
    return null;
  }

  async function enviar() {
    if (enviando) return;
    var falta = faltaOMinimo();
    if (falta) {
      avisar(falta, 'erro');
      $('triagem-descricao').focus();
      return;
    }
    enviando = true;
    var btn = $('triagem-enviar');
    var antes = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    clearTimeout(salvarTimer);

    var ok = await salvar(true);
    enviando = false;
    btn.disabled = false;
    if (!ok) { btn.innerHTML = antes; return; }

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado — atualizar';
    avisar('Pronto! O contador já foi avisado e vai chegar sabendo do seu caso.', 'ok');
    atualizarBadge();
    desenharSalaDeEspera();
    if (window.montarLinhaDoTempo) window.montarLinhaDoTempo();
  }

  // Aviso no menu enquanto a triagem não foi entregue.
  function atualizarBadge() {
    var b = $('badge-triagem');
    if (!b) return;
    b.style.display = triagem.status === 'enviada' ? 'none' : 'block';
  }

  // ------------------------------------------------------- sala de espera
  // O bloco só aparece quando existe horário marcado: sem agendamento, uma
  // contagem regressiva para lugar nenhum só geraria ansiedade.
  async function desenharSalaDeEspera() {
    var box = $('triagem-espera');
    if (!box) return;
    try {
      var res = await fetch('/api/appointments');
      var lista = await res.json();
      var meu = (lista || []).filter(function (a) {
        return a.clientRef === CLIENT_ID && a.status !== 'done';
      }).sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); })[0];
      if (!meu) { box.hidden = true; return; }

      var quando = new Date(meu.date + 'T' + (meu.time || '00:00') + ':00');
      var enviada = triagem.status === 'enviada';
      box.hidden = false;
      box.className = 'triagem-espera' + (enviada ? ' pronto' : '');
      box.innerHTML =
        '<i class="fa-solid ' + (enviada ? 'fa-circle-check' : 'fa-hourglass-half') + '"></i>' +
        '<div>' +
          '<strong>' + (enviada
            ? 'Tudo certo — é só aguardar seu horário'
            : 'Seu atendimento já está marcado') + '</strong>' +
          '<p>' + esc(formatarQuando(quando)) +
            (enviada ? '' : '. Aproveite a espera para contar seu caso aqui embaixo.') + '</p>' +
        '</div>';
    } catch (e) { box.hidden = true; }
  }

  function formatarQuando(d) {
    if (isNaN(d)) return 'Horário a confirmar';
    var hoje = new Date();
    var zera = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
    var dias = Math.round((zera(d) - zera(hoje)) / 86400000);
    var hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dias === 0) return 'Hoje às ' + hora;
    if (dias === 1) return 'Amanhã às ' + hora;
    if (dias > 1) return 'Em ' + dias + ' dias, ' + d.toLocaleDateString('pt-BR') + ' às ' + hora;
    return d.toLocaleDateString('pt-BR') + ' às ' + hora;
  }

  return { iniciar: iniciar };
})();
