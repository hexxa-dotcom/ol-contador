// Lógica pura da agenda fiscal: calcula próximos vencimentos e aplicabilidade.

// Último dia do mês (para obrigações com dia > dias do mês).
function lastDayOfMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

// Próxima data de vencimento (>= from) de uma obrigação.
function nextDueDate(ob, from = new Date()) {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (ob.recurrence === 'monthly') {
    let y = base.getFullYear();
    let m = base.getMonth();
    for (let i = 0; i < 13; i++) {
      const day = Math.min(ob.day_of_month, lastDayOfMonth(y, m));
      const d = new Date(y, m, day);
      if (d >= base) return d;
      m++; if (m > 11) { m = 0; y++; }
    }
  } else if (ob.recurrence === 'yearly') {
    const month0 = (ob.month || 1) - 1;
    for (let y = base.getFullYear(); y <= base.getFullYear() + 1; y++) {
      const day = Math.min(ob.day_of_month, lastDayOfMonth(y, month0));
      const d = new Date(y, month0, day);
      if (d >= base) return d;
    }
  }
  return null;
}

// A obrigação se aplica ao cliente? (keywords casam com o taxType; vazio = todos)
function applies(ob, taxType) {
  const kw = ob.keywords || [];
  if (!kw.length) return true;
  const t = (taxType || '').toLowerCase();
  return kw.some(k => t.includes(String(k).toLowerCase()));
}

function daysUntil(date, from = new Date()) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86400000);
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monta a lista de próximos vencimentos aplicáveis, ordenada por data.
function proximosVencimentos(obrigacoes, taxType, from = new Date()) {
  return (obrigacoes || [])
    .filter(ob => ob.active !== false && applies(ob, taxType))
    .map(ob => {
      const due = nextDueDate(ob, from);
      return {
        id: ob.id,
        title: ob.title,
        description: ob.description,
        dueDate: due ? toISODate(due) : null,
        daysUntil: due ? daysUntil(due, from) : null,
        reminderDays: ob.reminder_days
      };
    })
    .filter(x => x.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

module.exports = { nextDueDate, applies, daysUntil, toISODate, proximosVencimentos };
