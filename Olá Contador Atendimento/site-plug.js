// ============================================================================
// site-plug.js — liga o site (feito no Claude Design) ao sistema.
//
// O index.html é o bundle exportado do Claude Design, e fica INTOCADO de
// propósito: o design continua nascendo lá, e aqui a gente só pluga o que o
// design não tem como saber (login, checkout). Se você reexportar o site,
// basta copiar o novo bundle por cima e acrescentar de volta, antes do </body>:
//     <script src="site-plug.js"></script>
//
// Nada aqui depende de classe ou id do bundle — tudo é encontrado pelo texto
// visível, que é o que menos muda quando o design é refeito.
// ============================================================================
(function () {
  'use strict';

  var LOGIN = 'login.html';

  function textoDe(el) { return (el.textContent || '').trim(); }

  // O React desenha depois do load. Em vez de chutar um setTimeout, observa o
  // DOM e age assim que os elementos aparecem.
  function quandoAparecer(procurar, agir, tentativas) {
    var achado = procurar();
    if (achado) { agir(achado); return; }
    if ((tentativas || 0) > 40) return; // ~10s: desiste em silêncio
    setTimeout(function () { quandoAparecer(procurar, agir, (tentativas || 0) + 1); }, 250);
  }

  // ---- 1. "Entrar" no menu -------------------------------------------------
  function acharMenu() {
    var links = [].slice.call(document.querySelectorAll('a'));
    var comoFunciona = links.filter(function (a) { return textoDe(a) === 'Como funciona'; })[0];
    return comoFunciona ? comoFunciona.parentElement : null;
  }

  function porEntrarNoMenu(menu) {
    if (document.getElementById('oc-entrar')) return;
    var modelo = menu.querySelector('a');
    var entrar = document.createElement('a');
    entrar.id = 'oc-entrar';
    entrar.href = LOGIN;
    entrar.textContent = 'Entrar';
    // herda a aparência dos vizinhos, para o botão não destoar quando o
    // design mudar de cor/fonte
    if (modelo) { entrar.className = modelo.className; entrar.style.cssText = modelo.style.cssText; }
    menu.appendChild(entrar);
  }

  // ---- 2. Botões de agendar ------------------------------------------------
  // Hoje levam pro login: quem já é cliente entra e agenda por dentro. Quando o
  // Asaas estiver ligado, é aqui que o checkout entra (troque o destino abaixo).
  function ligarBotoesDeAgendar() {
    var alvos = [].slice.call(document.querySelectorAll('a, button')).filter(function (el) {
      var t = textoDe(el);
      return /^(Agendar atendimento|Agendar meu atendimento)$/.test(t);
    });
    alvos.forEach(function (el) {
      if (el.dataset.ocLigado) return;
      el.dataset.ocLigado = '1';
      if (el.tagName === 'A') el.href = LOGIN + destinoDe(el);
      else el.addEventListener('click', function () { location.href = LOGIN + destinoDe(el); });
    });
  }

  // Descobre a qual plano o botão pertence subindo pelo card até achar o título.
  // Para no primeiro ancestral que fala de UM plano só — se subir demais, o
  // ancestral engloba os dois cards e a resposta seria sempre "pf".
  function destinoDe(botao) {
    var no = botao.parentElement;
    while (no && no !== document.body) {
      var t = no.textContent || '';
      var pf = /Pessoa F[ií]sica/i.test(t), pj = /Pessoa Jur[ií]dica/i.test(t);
      if (pf !== pj) return '?plano=' + (pj ? 'pj' : 'pf');
      no = no.parentElement;
    }
    return ''; // botão fora dos cards (ex.: o do topo) — sem plano definido
  }

  function iniciar() {
    quandoAparecer(acharMenu, porEntrarNoMenu);
    quandoAparecer(function () {
      return document.querySelector('a, button') && document.body.innerText.indexOf('Agendar') > -1 ? true : null;
    }, ligarBotoesDeAgendar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
