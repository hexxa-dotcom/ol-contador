(function () {
  'use strict';
  const vistos = new Set();
  function enviar(tipo, erro) {
    const mensagem = String(erro && (erro.message || erro.reason) || erro || tipo).slice(0, 500);
    const chave = `${tipo}|${mensagem}|${location.pathname}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    fetch('/api/status?acao=registrar-erro', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem: 'frontend', codigo: tipo, mensagem, rota: location.pathname,
        contexto: { navegador: navigator.userAgent.slice(0, 180), largura: innerWidth, online: navigator.onLine } })
    }).catch(function () {});
  }
  addEventListener('error', function (evento) { enviar('window_error', evento.error || evento.message); });
  addEventListener('unhandledrejection', function (evento) { enviar('promise_rejection', evento.reason); });
  addEventListener('DOMContentLoaded', function () {
    const principal = document.querySelector('main,[role="main"],.hero,.hero-grid,#hero,.login-card,.auth-card');
    if (principal) {
      if (!principal.id) principal.id = 'conteudo-principal';
      if (principal.tagName !== 'MAIN' && !principal.hasAttribute('role')) principal.setAttribute('role', 'main');
      const pular = document.createElement('a');
      pular.className = 'oc-skip-link'; pular.href = '#' + principal.id; pular.textContent = 'Pular para o conteúdo';
      document.body.insertBefore(pular, document.body.firstChild);
    }
    document.querySelectorAll('[id*="toast"],.toast,[id*="status"],.alerta').forEach(function (el) {
      if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'status');
    });
    document.querySelectorAll('button').forEach(function (botao) {
      if (botao.getAttribute('aria-label') || botao.textContent.trim()) return;
      const icone = botao.querySelector('i');
      const classe = icone ? icone.className : '';
      const rotulo = botao.title ||
        (classe.includes('fa-xmark') ? 'Fechar' : '') ||
        (classe.includes('fa-paper-plane') || classe.includes('fa-arrow-up') ? 'Enviar' : '') ||
        (classe.includes('fa-download') ? 'Baixar arquivo' : '') ||
        (classe.includes('fa-plus') ? 'Adicionar' : '');
      if (rotulo) botao.setAttribute('aria-label', rotulo);
    });
    document.querySelectorAll('input,textarea,select').forEach(function (campo) {
      if (campo.type === 'hidden' || campo.getAttribute('aria-label') || campo.getAttribute('aria-labelledby')) return;
      if (campo.id && document.querySelector(`label[for="${CSS.escape(campo.id)}"]`)) return;
      if (campo.closest('label')) return;
      const rotulo = campo.placeholder || campo.title || campo.name;
      if (rotulo) campo.setAttribute('aria-label', rotulo);
    });
  });
})();
