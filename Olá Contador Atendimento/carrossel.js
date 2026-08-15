/* Carrossel de cards para o celular.
 *
 * Uso: adicione a classe `carrossel` no container dos cards (o mesmo que já é
 * grid no desktop) e inclua este arquivo. No desktop nada muda; no celular o
 * container vira uma faixa com rolagem horizontal e scroll-snap.
 *
 * O gesto de arrastar é nativo do navegador — este arquivo só cuida das
 * bolinhas de posição e do avanço automático. Sem dependência externa.
 *
 * Vive num arquivo próprio porque três páginas usam (index, precos e
 * radar-fiscal) e duplicar o bloco em cada uma sairia caro de manter.
 */
(() => {
  'use strict';

  const CSS = `
  .carrossel-pontos { display: none; }
  @media (max-width: 860px) {
    .carrossel {
      display: flex !important;
      grid-template-columns: none !important;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      gap: 14px !important;
      /* Sem sangria pra fora do container: o padding do pai varia por página
         (18px aqui, 20px ali) e margem negativa fixa estourava a tela. Os
         cards ficam alinhados com o texto acima. */
      padding: 6px 0 10px;
    }
    .carrossel::-webkit-scrollbar { display: none; }
    /* Menos de 100%: o card seguinte fica espiando na borda, e é isso que
       avisa que dá pra arrastar — sem precisar de seta. */
    .carrossel > * { flex: 0 0 87%; scroll-snap-align: start; }
    .carrossel-pontos { display: flex; gap: 7px; justify-content: center; margin-top: 20px; }
    .carrossel-pontos button {
      width: 7px; height: 7px; padding: 0; border: none; border-radius: 50%;
      background: rgba(52,76,75,.24); cursor: pointer;
      transition: background .3s ease, width .3s ease;
    }
    .carrossel-pontos button.ativo { background: #EE5F3A; width: 20px; border-radius: 4px; }
    /* Dentro de bloco escuro as bolinhas precisam do contraste invertido. */
    .dark-box .carrossel-pontos button, .card-escuro .carrossel-pontos button { background: rgba(255,255,255,.28); }
    .dark-box .carrossel-pontos button.ativo, .card-escuro .carrossel-pontos button.ativo { background: #fff; }
  }`;

  const estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  function montar() {
    const consultaMobile = window.matchMedia('(max-width: 860px)');
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.querySelectorAll('.carrossel').forEach(faixa => {
      if (faixa.dataset.carrosselPronto) return;
      const itens = [...faixa.children];
      if (itens.length < 2) return;
      faixa.dataset.carrosselPronto = '1';

      let atual = 0, timer = null, retomar = null, visivel = false;

      const irPara = (i) => {
        atual = (i + itens.length) % itens.length;
        faixa.scrollTo({ left: itens[atual].offsetLeft - faixa.offsetLeft, behavior: 'smooth' });
      };

      const pontos = document.createElement('div');
      pontos.className = 'carrossel-pontos';
      itens.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Ir para o card ' + (i + 1));
        if (i === 0) b.className = 'ativo';
        b.addEventListener('click', () => { irPara(i); pausar(); });
        pontos.appendChild(b);
      });
      faixa.after(pontos);
      const bolinhas = [...pontos.children];

      // Quem manda no ponto aceso é a posição real da rolagem, não o timer —
      // assim arrastar com o dedo também atualiza as bolinhas.
      let agendado = false;
      faixa.addEventListener('scroll', () => {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(() => {
          agendado = false;
          const meio = faixa.scrollLeft + faixa.clientWidth / 2;
          let maisPerto = 0, menorDist = Infinity;
          itens.forEach((it, i) => {
            const centro = it.offsetLeft - faixa.offsetLeft + it.clientWidth / 2;
            const d = Math.abs(centro - meio);
            if (d < menorDist) { menorDist = d; maisPerto = i; }
          });
          atual = maisPerto;
          bolinhas.forEach((b, i) => b.classList.toggle('ativo', i === atual));
        });
      }, { passive: true });

      const rodar = () => {
        if (timer || !visivel || !consultaMobile.matches || semMovimento.matches) return;
        timer = setInterval(() => irPara(atual + 1), 5000);
      };
      const parar = () => { clearInterval(timer); timer = null; };
      // Depois de tocar, a pessoa assumiu o controle: só volta a girar sozinho
      // se ela ficar um bom tempo parada.
      const pausar = () => { parar(); clearTimeout(retomar); retomar = setTimeout(rodar, 9000); };

      faixa.addEventListener('pointerdown', pausar);
      faixa.addEventListener('wheel', pausar, { passive: true });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          visivel = e.isIntersecting;
          visivel ? rodar() : parar();
        }, { threshold: 0.35 }).observe(faixa);
      } else { visivel = true; rodar(); }

      document.addEventListener('visibilitychange', () => document.hidden ? parar() : rodar());
      // Ao girar o celular pra paisagem o container volta a ser grid: derruba
      // o timer pra não rolar um elemento que não rola mais.
      consultaMobile.addEventListener('change', () => consultaMobile.matches ? rodar() : parar());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
