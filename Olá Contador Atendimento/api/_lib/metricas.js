// Registro best-effort do funil comercial. Uma falha de telemetria nunca pode
// impedir checkout, pagamento ou entrega do serviço principal.
async function registrarEventoFunil(admin, evento, dados = {}) {
  if (!admin || !evento) return false;
  const linha = {
    evento,
    sessao_ref: dados.sessaoRef || null,
    cliente_ref: dados.clienteRef || null,
    cobranca_id: dados.cobrancaId || null,
    servico_id: dados.servicoId || null,
    origem: dados.origem || null,
    metadata: dados.metadata || {}
  };
  const { error } = await admin.from('funil_eventos').insert(linha);
  if (error && error.code !== '23505') { console.error('métrica do funil não registrada:', error.message); return false; }
  return true;
}

module.exports = { registrarEventoFunil };
