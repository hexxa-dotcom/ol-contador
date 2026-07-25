// GET /api/notify/status — quais canais de aviso estão configurados.
const notify = require('../_lib/notify');
module.exports = async (req, res) => {
  res.json({ email: notify.emailConfigured(), whatsapp: notify.whatsappConfigured() });
};
