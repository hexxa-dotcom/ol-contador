// ============================================================================
// relatorio-pdf.js — o RELATÓRIO DO CLIENTE como documento branded + gerador PDF.
//
// Um template só, usado pelos dois portais: o contador gera/baixa e o cliente
// baixa o mesmo arquivo. Como o conteúdo mora na tabela `relatorios`, o PDF é
// sempre reproduzível — nada é guardado em Storage.
//
// Estilo INLINE de propósito: o html2pdf rasteriza via html2canvas, que lê o
// estilo computado. Um bloco autocontido garante que o PDF saia igual em
// qualquer página, sem depender do CSS ao redor.
// ============================================================================
window.OCRelatorio = (function () {
  'use strict';

  var CORAL = '#FF6A45', PINE = '#0A3121', PAPER = '#FFFFFF', TINTA = '#1c1c1c';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // "- item\n- item" (ou linhas soltas) vira uma lista <li>.
  function itens(txt) {
    var linhas = String(txt || '').split('\n')
      .map(function (l) { return l.replace(/^\s*[-•*]\s*/, '').trim(); })
      .filter(Boolean);
    if (!linhas.length) return '<p style="margin:0;color:#666;">—</p>';
    return '<ul style="margin:0;padding-left:18px;">' + linhas.map(function (l) {
      return '<li style="margin:0 0 6px;line-height:1.5;">' + esc(l) + '</li>';
    }).join('') + '</ul>';
  }

  function dataBR(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) d = new Date();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Monta o documento como um nó DOM de 720px (proporção A4), pronto pro html2pdf.
  function montarNo(rel, cliente) {
    cliente = cliente || {};
    var nome = cliente.name || rel.clienteNome || rel.clientRef || 'Cliente';
    var cpf = cliente.cpf || rel.clienteCpf || '';
    var contador = rel.contadorNome || 'Contador';
    // O CRC pode vir com ou sem o prefixo "CRC" — normaliza pra não duplicar.
    var crc = String(rel.contadorCrc || '').replace(/^\s*crc\s*/i, '').trim();
    var protocolo = 'OC-' + String(rel.id || Date.now()).toString().padStart(6, '0');
    var logo = rel.contadorLogo || '';
    var assinatura = rel.contadorAssinatura || '';
    // Se o contador subiu uma logo própria em Meu Perfil, ela substitui o círculo
    // genérico "O" no cabeçalho — mesma marca em todo relatório emitido por ele.
    var marca = logo
      ? '<img src="' + logo + '" style="width:30px;height:30px;border-radius:8px;object-fit:cover;" />'
      : '<span style="width:30px;height:30px;border-radius:8px;background:' + CORAL + ';display:inline-flex;' +
        'align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-weight:800;font-size:17px;color:#fff;">O</span>';

    var secao = function (titulo, corpoHTML) {
      return '<div style="margin-bottom:20px;">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;' +
          'color:' + CORAL + ';border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:10px;">' + esc(titulo) + '</div>' +
        '<div style="font-size:13.5px;color:' + TINTA + ';line-height:1.6;">' + corpoHTML + '</div>' +
      '</div>';
    };

    var el = document.createElement('div');
    el.style.cssText = 'width:720px;background:' + PAPER + ';color:' + TINTA +
      ';font-family:Georgia,\'Times New Roman\',serif;box-sizing:border-box;';
    el.innerHTML =
      // ---------- Cabeçalho com a marca ----------
      '<div style="background:' + PINE + ';color:#fff;padding:26px 40px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="display:flex;align-items:center;gap:11px;">' +
          marca +
          '<span style="font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:20px;">Olá, Contador' +
            '<span style="color:' + CORAL + ';">.</span></span>' +
        '</div>' +
        '<div style="text-align:right;font-family:system-ui,sans-serif;font-size:10.5px;line-height:1.5;opacity:.9;">' +
          '<div style="font-weight:700;letter-spacing:1px;">RELATÓRIO DE ATENDIMENTO</div>' +
          '<div>Emitido em ' + dataBR(rel.createdAt) + '</div>' +
          '<div>Protocolo ' + esc(protocolo) + '</div>' +
        '</div>' +
      '</div>' +

      '<div style="padding:32px 40px 24px;">' +
        // ---------- Cliente + título ----------
        '<div style="display:flex;justify-content:space-between;gap:16px;background:#F7F5F0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">' +
          '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;font-family:system-ui,sans-serif;">Cliente</div>' +
            '<div style="font-size:15px;font-weight:700;">' + esc(nome) + '</div></div>' +
          (cpf ? '<div style="text-align:right;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;font-family:system-ui,sans-serif;">CPF</div>' +
            '<div style="font-size:15px;font-weight:700;">' + esc(cpf) + '</div></div>' : '') +
        '</div>' +

        (rel.titulo ? '<h1 style="font-size:20px;color:' + PINE + ';margin:0 0 24px;line-height:1.3;">' + esc(rel.titulo) + '</h1>' : '') +

        secao('O que aconteceu', '<p style="margin:0;line-height:1.6;">' + esc(rel.problema || '—') + '</p>') +
        secao('Solução proposta', '<p style="margin:0;line-height:1.6;">' + esc(rel.solucao || '—') + '</p>') +
        secao('O que foi feito', itens(rel.oqueFeito)) +
        secao('Como foi feito e próximos passos', itens(rel.comoFeito)) +

        // ---------- Assinatura com CRC (como uma receita) ----------
        '<div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;">' +
          '<div style="text-align:center;min-width:240px;">' +
            (assinatura ? '<img src="' + assinatura + '" style="height:44px;max-width:220px;object-fit:contain;margin:0 auto 2px;display:block;" />' : '') +
            '<div style="border-top:1.5px solid ' + TINTA + ';padding-top:6px;">' +
              '<div style="font-weight:700;font-size:13px;">' + esc(contador) + '</div>' +
              '<div style="font-size:11px;color:#666;font-family:system-ui,sans-serif;">' +
                'Contador responsável' + (crc ? ' · CRC ' + esc(crc) : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center;border:2px solid ' + CORAL + ';color:' + CORAL +
            ';border-radius:8px;padding:8px 14px;transform:rotate(-4deg);font-family:system-ui,sans-serif;">' +
            '<div style="font-weight:800;font-size:13px;letter-spacing:1px;">CONCLUÍDO</div>' +
            '<div style="font-size:8px;letter-spacing:1px;">OLÁ, CONTADOR</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ---------- Rodapé com a marca ----------
      '<div style="background:#F7F5F0;border-top:2px solid ' + CORAL + ';padding:14px 40px;' +
        'font-family:system-ui,sans-serif;font-size:10px;color:#888;display:flex;justify-content:space-between;">' +
        '<span>Documento emitido por <strong style="color:' + PINE + ';">Olá, Contador</strong> — seu escritório de contabilidade digital.</span>' +
        '<span>' + esc(protocolo) + '</span>' +
      '</div>';
    return el;
  }

  // HTML do documento (para uma prévia embutida na tela).
  function montarHTML(rel, cliente) { return montarNo(rel, cliente).outerHTML; }

  // Gera e baixa o PDF. Renderiza o nó fora da tela e entrega ao html2pdf.
  function baixarPDF(rel, cliente) {
    if (typeof html2pdf === 'undefined') {
      alert('Gerador de PDF ainda carregando. Tente de novo em um instante.');
      return Promise.resolve(false);
    }
    var no = montarNo(rel, cliente);
    var berco = document.createElement('div');
    berco.style.cssText = 'position:fixed;left:-9999px;top:0;';
    berco.appendChild(no);
    document.body.appendChild(berco);

    var nomeArq = 'Relatorio-OlaContador-' + String((cliente && cliente.name) || rel.clientRef || 'cliente')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, '-') + '.pdf';

    return html2pdf().set({
      margin: 0,
      filename: nomeArq,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    }).from(no).save().then(function () {
      document.body.removeChild(berco);
      return true;
    }).catch(function (e) {
      document.body.removeChild(berco);
      console.error('Falha ao gerar PDF:', e);
      return false;
    });
  }

  return { montarHTML: montarHTML, montarNo: montarNo, baixarPDF: baixarPDF };
})();
