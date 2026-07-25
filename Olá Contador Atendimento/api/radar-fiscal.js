const { requireUser, adminClient } = require('./_lib/auth');
const serpro = require('./_lib/serpro');

module.exports = async (req, res) => {
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'service_role_not_configured' });

  // Exige que quem chama seja um usuário logado (Contador ou o próprio Cliente)
  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    // Pode vir via query param (?documento=123) ou body ({ documento: 123 })
    let documento = req.query.documento || (req.body && req.body.documento);
    
    // Se não passou um documento explícito, pega do próprio usuário logado (se for cliente)
    if (!documento) {
      const { data: cli } = await admin.from('clientes').select('cpf').eq('id', auth.id).single();
      if (cli && cli.cpf) {
        documento = cli.cpf;
      } else {
        return res.status(400).json({ error: 'documento_required', detail: 'Forneça o CPF/CNPJ para o Radar Fiscal.' });
      }
    }

    // Consulta na Serpro
    const dadosRadar = await serpro.consultarRadarFiscal(documento);

    res.json(dadosRadar);
  } catch (e) {
    console.error('[Radar Fiscal API Error]', e.message);
    res.status(500).json({ error: 'radar_fiscal_failed', detail: e.message });
  }
};
