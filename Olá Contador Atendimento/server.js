const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { supabase } = require('./supabase');
const { createClient } = require('@supabase/supabase-js');
const asaas = require('./asaas');
const ia = require('./ia');
const notify = require('./notify');
const agenda = require('./agenda');
const { validarCpfCnpj } = require('./documento');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 8000;
const root = __dirname;

// Rota de checkout local não tem sessão de usuário (server.js é só pro dev local,
// a produção usa api/checkout.js com o mesmo esquema). servicos/cobrancas ficaram
// bloqueados pro anon quando o RLS foi apertado — usa service_role aqui, igual
// ao lado serverless, em vez de reabrir a política pra anon.
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : supabase;

app.use(express.json({ limit: '15mb' })); // base64 de documentos
app.use(express.static(root));

app.get('/', (req, res) => res.redirect('/contador.html'));

// ============ Mapeadores DB (snake_case) -> Front (camelCase) ============
function mapMessage(row) {
  return {
    id: row.id,
    sender: row.sender,
    text: row.text,
    time: row.time,
    type: row.type,
    docName: row.doc_name || undefined,
    duration: row.duration || undefined,
    diagnosis: row.diagnosis || undefined
  };
}

function mapClient(row, messages) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    taxType: row.tax_type,
    cpf: row.cpf,
    status: row.status,
    scheduledTime: row.scheduled_time,
    diagnosis: row.diagnosis,
    honorarios: row.honorarios,
    treatment: row.treatment,
    evidences: row.evidences || [],
    checklist: row.checklist || {},
    email: row.email || null,
    phone: row.phone || null,
    recorrente: !!row.recorrente,
    recorrenteTipo: row.recorrente_tipo || null,
    recorrenteDiaVenc: row.recorrente_dia_venc || null,
    ultimoFinalizadoEm: row.ultimo_atendimento_finalizado_em || null,
    sexo: row.sexo || null, cidade: row.cidade || null, estado: row.estado || null,
    messages: messages || []
  };
}

function mapAppointment(row) {
  return {
    id: row.id,
    clientName: row.client_name,
    date: row.date,
    time: row.time,
    taxType: row.tax_type,
    status: row.status,
    clientRef: row.cliente_ref
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    text: row.text,
    time: row.time,
    unread: row.unread,
    clientRef: row.cliente_ref
  };
}

// Monta um cliente único no formato do front (com messages aninhadas).
// service_role (não anon): server.js não tem sessão de usuário por requisição,
// então o RLS sempre bloquearia a leitura anônima (mesmo motivo já corrigido
// no checkout local).
async function fetchClient(clientId) {
  const db = supabaseAdmin || supabase;
  const { data: c } = await db.from('clientes').select('*').eq('id', clientId).single();
  if (!c) return null;
  const { data: msgs } = await db
    .from('mensagens').select('*').eq('cliente_id', clientId).order('seq', { ascending: true });
  return mapClient(c, (msgs || []).map(mapMessage));
}

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Código de crédito legível (sem 0/O/1/I, que se confundem ao digitar).
function gerarCodigoCredito() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let cod = '';
  for (let i = 0; i < 8; i++) cod += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return 'OC-' + cod;
}
function mapCredito(r) {
  return {
    id: r.id, codigo: r.codigo, valorCents: r.valor_cents, valor: r.valor_cents / 100,
    status: r.status, observacao: r.observacao, clienteRef: r.cliente_ref,
    clienteNome: r.clientes ? r.clientes.name : null,
    usadoEm: r.usado_em, criadoPor: r.criado_por, createdAt: r.created_at
  };
}

// ============ REST API ============

// Todos os clientes no formato { id: {...cliente, messages:[...] } }
app.get('/api/clients', async (req, res) => {
  const { data: clients, error } = await supabase.from('clientes').select('*');
  if (error) { console.error(error); return res.status(500).json({}); }

  const { data: msgs } = await supabase.from('mensagens').select('*').order('seq', { ascending: true });
  const byClient = {};
  (msgs || []).forEach(m => {
    (byClient[m.cliente_id] = byClient[m.cliente_id] || []).push(mapMessage(m));
  });

  const out = {};
  (clients || []).forEach(c => { out[c.id] = mapClient(c, byClient[c.id] || []); });
  res.json(out);
});

app.get('/api/appointments', async (req, res) => {
  const { data, error } = await supabase.from('agendamentos').select('*').order('id', { ascending: true });
  if (error) { console.error(error); return res.status(500).json([]); }
  res.json((data || []).map(mapAppointment));
});

app.get('/api/notifications', async (req, res) => {
  const { data, error } = await supabase.from('notificacoes').select('*').order('id', { ascending: false });
  if (error) { console.error(error); return res.status(500).json([]); }
  res.json((data || []).map(mapNotification));
});

// Persiste uma mensagem e transmite em tempo real.
async function persistMessage(clientId, message) {
  const id = message.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const row = {
    id,
    cliente_id: clientId,
    sender: message.sender,
    text: message.text,
    time: message.time || nowTime(),
    type: message.type || 'internal',
    doc_name: message.docName || null,
    duration: message.duration || null,
    diagnosis: message.diagnosis || null
  };
  await supabase.from('mensagens').insert(row);

  // Efeitos colaterais de documentos: atualiza status + checklist do cliente.
  if (message.type === 'doc-request' || message.type === 'doc-upload') {
    const { data: c } = await supabase.from('clientes').select('checklist').eq('id', clientId).single();
    const checklist = (c && c.checklist) || {};
    if (message.type === 'doc-request') checklist[message.docName] = false;
    else checklist[message.docName] = true;
    await supabase.from('clientes')
      .update({ checklist, status: message.type === 'doc-request' ? 'docs' : 'active' })
      .eq('id', clientId);

    // Aviso externo ao cliente quando o contador SOLICITA um documento.
    if (message.type === 'doc-request' && notify.anyConfigured()) {
      const cliente = await fetchClient(clientId);
      notify.notifyCliente(cliente, 'Documento solicitado pelo seu contador',
        `Seu contador solicitou o seguinte documento: <strong>${message.docName}</strong>. Envie pelo portal de atendimento assim que possível.`);
    }
  }

  const outMsg = { ...message, id };
  return outMsg;
}

app.post('/api/messages', async (req, res) => {
  const { clientId, message } = req.body;
  if (!clientId || !message) return res.status(400).send('Invalid params');

  const outMsg = await persistMessage(clientId, message);

  // Mesmo evento que os dois portais escutam (contador + cliente).
  io.emit('receive_chat_message', { clientId, message: outMsg });
  if (message.type === 'doc-request' || message.type === 'doc-upload') {
    io.emit('doc_status_update', { clientId, docName: message.docName });
  }

  const client = await fetchClient(clientId);
  res.json(client);
});

app.post('/api/prontuario', async (req, res) => {
  const { clientId, diagnosis, honorarios, treatment, evidences } = req.body;
  if (!clientId) return res.status(400).send('Invalid params');

  const patch = {};
  if (diagnosis !== undefined) patch.diagnosis = diagnosis;
  if (honorarios !== undefined) patch.honorarios = parseInt(honorarios);
  if (treatment !== undefined) patch.treatment = treatment;
  if (evidences !== undefined) patch.evidences = evidences;

  const { error } = await supabase.from('clientes').update(patch).eq('id', clientId);
  if (error) { console.error(error); return res.status(500).send('DB error'); }
  res.json(await fetchClient(clientId));
});

app.post('/api/checklist', async (req, res) => {
  const { clientId, docName, isChecked } = req.body;
  if (!clientId || !docName) return res.status(400).send('Invalid params');

  const { data: c } = await supabase.from('clientes').select('checklist').eq('id', clientId).single();
  if (!c) return res.status(404).send('Client not found');
  const checklist = c.checklist || {};
  checklist[docName] = !!isChecked;

  await supabase.from('clientes').update({ checklist }).eq('id', clientId);
  res.json(await fetchClient(clientId));
});

// ============ NOTIFICATIONS ============
app.post('/api/notifications', async (req, res) => {
  const { text, clientRef } = req.body;
  if (!text) return res.status(400).send('Invalid params');

  const { data, error } = await supabase.from('notificacoes')
    .insert({ text, time: nowTime(), unread: true, cliente_ref: clientRef || null })
    .select().single();
  if (error) { console.error(error); return res.status(500).send('DB error'); }

  io.emit('notifications_updated');
  res.json(mapNotification(data));
});

app.post('/api/notifications/read-all', async (req, res) => {
  await supabase.from('notificacoes').update({ unread: false }).neq('unread', false);
  io.emit('notifications_updated');
  res.json({ ok: true });
});

app.delete('/api/notifications', async (req, res) => {
  if (req.query.clear === 'all') {
    await supabase.from('notificacoes').delete().neq('id', -1);
  } else if (req.query.id !== undefined) {
    await supabase.from('notificacoes').delete().eq('id', parseInt(req.query.id));
  } else {
    return res.status(400).send('Invalid params');
  }
  io.emit('notifications_updated');
  res.json({ ok: true });
});

// ============ APPOINTMENTS ============
app.post('/api/appointments', async (req, res) => {
  const { clientName, date, time, taxType, status, clientRef } = req.body;
  if (!clientName || !date || !time) return res.status(400).send('Invalid params');

  const { data, error } = await supabase.from('agendamentos')
    .insert({
      client_name: clientName,
      date, time,
      tax_type: taxType || '',
      status: status || 'pending',
      cliente_ref: clientRef || slugify(clientName)
    })
    .select().single();
  if (error) { console.error(error); return res.status(500).send('DB error'); }

  io.emit('appointments_updated');
  res.json(mapAppointment(data));
});

app.post('/api/appointments/done', async (req, res) => {
  const { clientRef, id } = req.body;
  const q = supabase.from('agendamentos').update({ status: 'done' });
  if (id !== undefined) await q.eq('id', id);
  else if (clientRef) await q.eq('cliente_ref', clientRef);
  else return res.status(400).send('Invalid params');

  io.emit('appointments_updated');
  res.json({ ok: true });
});

app.delete('/api/appointments', async (req, res) => {
  if (req.query.id === undefined) return res.status(400).send('Invalid params');
  await supabase.from('agendamentos').delete().eq('id', parseInt(req.query.id));
  io.emit('appointments_updated');
  res.json({ ok: true });
});

// ============ PAGAMENTOS (Asaas) — fluxo "cliente paga -> agenda" ============

function mapServico(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    price: row.price_cents / 100,
    recurrence: row.recurrence
  };
}

// Lista os serviços que o cliente pode contratar.
app.get('/api/servicos', async (req, res) => {
  const { data, error } = await supabase.from('servicos').select('*').eq('active', true).order('price_cents');
  if (error) { console.error(error); return res.status(500).json([]); }
  res.json((data || []).map(mapServico));
});

// Cria/edita um serviço no painel Financeiro. Faltava por completo neste
// servidor local — "Novo serviço" chamava isto e caía no 404 padrão do Express.
app.post('/api/servicos', async (req, res) => {
  const body = req.body || {};
  const payload = {
    name: String(body.name || '').trim(), description: String(body.description || '').trim() || null,
    price_cents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
    recurrence: body.recurrence || 'once', active: body.active !== false
  };
  if (!payload.name) return res.status(400).json({ error: 'name_required' });

  try {
    let query;
    if (body.id) {
      query = supabaseAdmin.from('servicos').update(payload).eq('id', body.id);
    } else {
      // id é o slug (texto sem valor padrão) — sem gerar aqui o insert falha
      // com "null value in column id".
      const base = slugify(payload.name) || 'servico';
      let id = base, tentativa = 1;
      while ((await supabaseAdmin.from('servicos').select('id').eq('id', id).maybeSingle()).data) {
        tentativa++; id = `${base}-${tentativa}`;
      }
      query = supabaseAdmin.from('servicos').insert({ ...payload, id });
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    res.json(mapServico(data));
  } catch (e) {
    console.error('servicos POST error:', e.message);
    res.status(500).json({ error: 'save_failed', detail: e.message });
  }
});

// Cria a cobrança Pix para um serviço + horário pretendido.
// body: { clientId, servicoId, date, time }
app.post('/api/checkout', async (req, res) => {
  const { clientId, servicoId, date, time } = req.body;
  if (!clientId || !servicoId) return res.status(400).send('Invalid params');

  const { data: servico } = await supabaseAdmin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).send('Serviço não encontrado');

  const { data: cliente } = await supabaseAdmin.from('clientes').select('*').eq('id', clientId).single();
  if (!cliente) return res.status(404).send('Cliente não encontrado');

  if (!asaas.isConfigured()) {
    return res.status(503).json({ error: 'asaas_not_configured' });
  }

  try {
    // 1) cliente no Asaas
    const customerId = await asaas.createCustomer({ name: cliente.name, cpfCnpj: cliente.cpf });
    // 2) cobrança Pix
    const payment = await asaas.createPixPayment({
      customerId,
      value: servico.price_cents / 100,
      description: `${servico.name} — ${cliente.name}`,
      dueDate: new Date().toISOString().slice(0, 10)
    });
    // 3) QR code Pix
    const qr = await asaas.getPixQrCode(payment.id);

    // 4) persiste a cobrança (pendente) com o horário pretendido
    const { data: cob, error } = await supabaseAdmin.from('cobrancas').insert({
      cliente_ref: clientId,
      servico_id: servicoId,
      asaas_customer_id: customerId,
      asaas_payment_id: payment.id,
      valor_cents: servico.price_cents,
      status: 'pending',
      pix_payload: qr.payload,
      pix_image: qr.encodedImage,
      invoice_url: payment.invoiceUrl,
      appt_date: date || null,
      appt_time: time || null
    }).select().single();
    if (error) throw error;

    res.json({
      cobrancaId: cob.id,
      servico: mapServico(servico),
      valor: servico.price_cents / 100,
      pixPayload: qr.payload,
      pixImage: qr.encodedImage,
      invoiceUrl: payment.invoiceUrl,
      status: 'pending'
    });
  } catch (e) {
    console.error('checkout error:', e.message);
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
});

// Checkout público (site de agendamento, sem login) — cria o cliente de
// verdade na primeira compra. O ID do cliente é o próprio CPF/CNPJ (só
// dígitos). A conta de acesso (auth) só nasce quando o pagamento confirma,
// dentro de confirmCobranca — nunca aqui, pra não criar conta órfã de quem
// não pagou.
// body: { name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary }
app.post('/api/subscribe-radar', async (req, res) => {
  const { cliente_ref, name, cpfCnpj, email } = req.body;
  if (!cliente_ref || !cpfCnpj) return res.status(400).send('Invalid params');
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });

  try {
    const { digitos } = validarCpfCnpj(cpfCnpj);
    const customerId = await asaas.createCustomer({ name: name || 'Cliente Radar Fiscal', cpfCnpj: digitos, email });
    const nextDueDate = new Date().toISOString().slice(0, 10);
    const sub = await asaas.createSubscription({
      customerId,
      value: 29.90,
      description: 'Assinatura Mensal - Radar Fiscal (Prevenção e Monitoramento)',
      nextDueDate
    });

    // Registra a assinatura no cliente usando o client_ref (que é o ID no Supabase)
    await supabaseAdmin.from('clientes')
      .update({ 
        recorrente: true, 
        recorrente_tipo: 'Radar Fiscal',
        recorrente_dia_venc: new Date().getDate()
      })
      .eq('id', cliente_ref);

    res.json({ success: true, subscriptionId: sub.id });
  } catch (e) {
    console.error('subscribe-radar error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/signup-checkout', async (req, res) => {
  const { name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary } = req.body || {};
  if (!name || !email || !phone || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  const { valido, digitos } = validarCpfCnpj(cpfCnpj);
  if (!valido) return res.status(400).json({ error: 'cpf_cnpj_invalido' });
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });

  const { data: servico } = await supabaseAdmin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });

  try {
    const clientId = digitos;
    const { data: existente } = await supabaseAdmin.from('clientes').select('id').eq('id', clientId).maybeSingle();
    if (!existente) {
      const { error: erroInsert } = await supabaseAdmin.from('clientes').insert({
        id: clientId, name, cpf: digitos, email, phone,
        sexo: sexo || null, cidade: cidade || null, estado: estado || null,
        tax_type: servico.name, honorarios: Math.round(servico.price_cents / 100),
        status: 'pending'
      });
      if (erroInsert) throw erroInsert;
    } else {
      // Já existe (comprou de novo) — atualiza só o contato, preserva o resto do prontuário.
      await supabaseAdmin.from('clientes').update({ email, phone, sexo: sexo || null, cidade: cidade || null, estado: estado || null }).eq('id', clientId);
    }
    if (summary) {
      await supabaseAdmin.from('triagens').insert({
        cliente_ref: clientId, assunto: servico.name, descricao: summary, status: 'enviada', enviada_at: new Date().toISOString()
      });
    }

    const customerId = await asaas.createCustomer({ name, cpfCnpj: digitos });
    const payment = await asaas.createPixPayment({
      customerId, value: servico.price_cents / 100,
      description: `${servico.name} — ${name}`, dueDate: new Date().toISOString().slice(0, 10)
    });
    const qr = await asaas.getPixQrCode(payment.id);

    const { data: cob, error } = await supabaseAdmin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, asaas_customer_id: customerId,
      asaas_payment_id: payment.id, valor_cents: servico.price_cents, status: 'pending',
      pix_payload: qr.payload, pix_image: qr.encodedImage, invoice_url: payment.invoiceUrl,
      appt_date: date || null, appt_time: time || null
    }).select().single();
    if (error) throw error;

    res.json({
      clientId, cobrancaId: cob.id, servico: mapServico(servico),
      valor: servico.price_cents / 100, pixPayload: qr.payload, pixImage: qr.encodedImage,
      invoiceUrl: payment.invoiceUrl, status: 'pending'
    });
  } catch (e) {
    console.error('signup-checkout error:', e.message);
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
});

// Liga/desliga o acompanhamento mensal de um cliente recorrente (parcelamento,
// obrigação mensal etc.) e cria/cancela a assinatura de cobrança no Asaas.
app.post('/api/recorrencia', async (req, res) => {
  const { clientId, ativar, tipo, diaVenc, valor } = req.body || {};
  if (!clientId) return res.status(400).json({ error: 'invalid_params' });

  const { data: cliente } = await supabaseAdmin.from('clientes').select('*').eq('id', clientId).single();
  if (!cliente) return res.status(404).json({ error: 'client_not_found' });

  try {
    if (ativar === false) {
      if (cliente.asaas_subscription_id && asaas.isConfigured()) {
        await asaas.cancelSubscription(cliente.asaas_subscription_id).catch(() => {});
      }
      await supabaseAdmin.from('clientes').update({ recorrente: false, asaas_subscription_id: null }).eq('id', clientId);
      return res.json({ recorrente: false });
    }

    if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
    const dia = Math.min(28, Math.max(1, parseInt(diaVenc, 10) || 10));
    const valorNum = Number(valor) || (cliente.honorarios || 0);
    if (!valorNum) return res.status(400).json({ error: 'valor_invalido' });

    const customerId = await asaas.createCustomer({ name: cliente.name, cpfCnpj: cliente.cpf });
    const hoje = new Date();
    let proximo = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (proximo <= hoje) proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
    const nextDueDate = proximo.toISOString().slice(0, 10);

    const sub = await asaas.createSubscription({
      customerId, value: valorNum,
      description: `${tipo || 'Acompanhamento mensal'} — ${cliente.name}`,
      nextDueDate
    });

    await supabaseAdmin.from('clientes').update({
      recorrente: true, recorrente_tipo: tipo || null, recorrente_dia_venc: dia,
      asaas_subscription_id: sub.id, honorarios: valorNum
    }).eq('id', clientId);

    res.json({ recorrente: true, subscriptionId: sub.id, nextDueDate });
  } catch (e) {
    console.error('recorrencia error:', e.message);
    if (e.code === 'asaas_not_configured') return res.status(503).json({ error: 'asaas_not_configured' });
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
});

// Checklist mensal do acompanhamento recorrente: sem certificado/API do Integra
// Contador ainda, a geração da guia é manual — o sistema lembra quem vence
// este mês, o contador gera fora (e-CAC) e marca como feito aqui.
app.get('/api/guias-mensais', async (req, res) => {
  const competencia = req.query.competencia || new Date().toISOString().slice(0, 7);
  try {
    const { data: recorrentes } = await supabaseAdmin.from('clientes').select('id').eq('recorrente', true);
    if (recorrentes && recorrentes.length) {
      await supabaseAdmin.from('guias_mensais').upsert(
        recorrentes.map(c => ({ cliente_ref: c.id, competencia })),
        { onConflict: 'cliente_ref,competencia', ignoreDuplicates: true }
      );
    }
    const { data, error } = await supabaseAdmin.from('guias_mensais')
      .select('*, clientes(name, recorrente_tipo)').eq('competencia', competencia).order('created_at');
    if (error) throw error;
    res.json((data || []).map(g => ({
      id: g.id, clientRef: g.cliente_ref, clientName: g.clientes ? g.clientes.name : g.cliente_ref,
      tipo: g.clientes ? g.clientes.recorrente_tipo : null, competencia: g.competencia,
      status: g.status, geradaEm: g.gerada_em, observacao: g.observacao
    })));
  } catch (e) {
    console.error('guias-mensais error:', e.message);
    res.status(500).json({ error: 'query_failed', detail: e.message });
  }
});

app.post('/api/guias-mensais/:id/concluir', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('guias_mensais').update({
      status: 'gerada', gerada_em: new Date().toISOString(), observacao: (req.body || {}).observacao || null
    }).eq('id', parseInt(req.params.id, 10));
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('guias-mensais concluir error:', e.message);
    res.status(500).json({ error: 'update_failed', detail: e.message });
  }
});

// Confirma pagamento: cria o agendamento se pago. Idempotente.
async function confirmCobranca(cob) {
  if (cob.status === 'paid' && cob.appointment_id) {
    return { status: 'paid', appointmentId: cob.appointment_id };
  }
  const payment = await asaas.getPayment(cob.asaas_payment_id);
  if (!asaas.PAID_STATUSES.includes(payment.status)) {
    return { status: 'pending' };
  }

  // Pago: cria o agendamento (se ainda não criou)
  let appointmentId = cob.appointment_id;
  if (!appointmentId) {
    const { data: cliente } = await supabaseAdmin.from('clientes').select('*').eq('id', cob.cliente_ref).single();
    const { data: servico } = await supabaseAdmin.from('servicos').select('*').eq('id', cob.servico_id).single();
    const { data: appt } = await supabaseAdmin.from('agendamentos').insert({
      cliente_ref: cob.cliente_ref,
      client_name: cliente ? cliente.name : cob.cliente_ref,
      date: cob.appt_date || 'A definir',
      time: cob.appt_time || '',
      tax_type: servico ? servico.name : '',
      status: 'pending'
    }).select().single();
    appointmentId = appt ? appt.id : null;

    await supabaseAdmin.from('cobrancas')
      .update({ status: 'paid', paid_at: new Date().toISOString(), appointment_id: appointmentId })
      .eq('id', cob.id);

    await supabaseAdmin.from('notificacoes').insert({
      text: `Pagamento confirmado: ${cliente ? cliente.name : cob.cliente_ref} agendou ${servico ? servico.name : ''}.`,
      time: nowTime(), unread: true, cliente_ref: cob.cliente_ref
    });

    if (cliente) {
      await notify.notifyCliente(
        cliente, 
        'Agendamento Confirmado - Olá, Contador', 
        `Seu pagamento foi confirmado com sucesso. O seu atendimento do serviço <strong>${servico ? servico.name : 'Atendimento'}</strong> está agendado.<br><br>
        Acesse sua área do cliente em nosso site para acompanhar sua triagem e falar diretamente com o contador.`
      );
    }

    io.emit('appointments_updated');
    io.emit('notifications_updated');
    io.emit('payment_confirmed', { cobrancaId: cob.id, clientId: cob.cliente_ref, appointmentId });

    // Só agora — pagamento confirmado — nasce a conta de acesso do cliente.
    // Se der erro (e-mail já cadastrado em outra conta, etc.), não derruba a
    // confirmação do pagamento: o essencial (agendamento) já está feito.
    if (cliente && cliente.email && !cliente.user_id && supabaseAdmin) {
      try {
        const { data: novoUser, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
          email: cliente.email, email_confirm: true
        });
        if (!erroAuth && novoUser && novoUser.user) {
          await supabaseAdmin.from('clientes').update({ user_id: novoUser.user.id }).eq('id', cliente.id);
        } else if (erroAuth) {
          console.error('criação de conta do cliente falhou:', erroAuth.message);
        }
      } catch (e) {
        console.error('criação de conta do cliente falhou:', e.message);
      }
    }

    // Aviso externo ao cliente: pagamento confirmado + agendamento.
    if (notify.anyConfigured()) {
      const clienteFull = await fetchClient(cob.cliente_ref);
      const quando = [cob.appt_date, cob.appt_time].filter(Boolean).join(' às ');
      notify.notifyCliente(clienteFull, 'Pagamento confirmado — atendimento agendado',
        `Recebemos seu pagamento de <strong>${servico ? servico.name : 'atendimento'}</strong>. ` +
        `Seu horário${quando ? ' (' + quando + ')' : ''} está confirmado. O contador falará com você no chat de atendimento.`);
    }
  }
  return { status: 'paid', appointmentId };
}

// Polling público do checkout de agendamento (sem login) — mesmo par de nome
// usado em produção (api/signup-status.js), pra agendamento.html chamar igual
// nos dois ambientes.
app.get('/api/signup-status', async (req, res) => {
  const { data: cob } = await supabaseAdmin.from('cobrancas').select('*').eq('id', parseInt(req.query.cobrancaId, 10)).single();
  if (!cob) return res.status(404).json({ error: 'cobranca_not_found' });
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  try {
    res.json(await confirmCobranca(cob));
  } catch (e) {
    console.error('signup-status error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
});

// ============ Créditos de atendimento ============
// Gerados manualmente pelo contador no painel financeiro (ex.: cortesia,
// reembolso, parceria). O cliente resgata com o código OU com um link direto
// (/agendamento.html?credito=CODE) e cai direto no sistema, sem passar pelo
// checkout/pagamento — o valor do crédito cobre o serviço escolhido.
app.get('/api/creditos', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('creditos').select('*, clientes(name)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'query_failed', detail: error.message });
  res.json((data || []).map(mapCredito));
});

app.post('/api/creditos', async (req, res) => {
  const valorCents = Math.round(Number(req.body?.valorCents) || 0);
  if (!valorCents || valorCents < 100) return res.status(400).json({ error: 'valor_invalido' });
  const observacao = (req.body?.observacao || '').trim() || null;

  let codigo, tentativas = 0;
  do {
    codigo = gerarCodigoCredito();
    tentativas++;
  } while (tentativas < 5 && (await supabaseAdmin.from('creditos').select('id').eq('codigo', codigo).maybeSingle()).data);

  const { data, error } = await supabaseAdmin.from('creditos').insert({ codigo, valor_cents: valorCents, observacao }).select().single();
  if (error) return res.status(500).json({ error: 'insert_failed', detail: error.message });
  res.json(mapCredito(data));
});

app.post('/api/creditos/:id/cancelar', async (req, res) => {
  const { data: credito } = await supabaseAdmin.from('creditos').select('*').eq('id', parseInt(req.params.id, 10)).single();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(400).json({ error: 'credito_nao_esta_ativo' });
  const { error } = await supabaseAdmin.from('creditos').update({ status: 'cancelado' }).eq('id', credito.id);
  if (error) return res.status(500).json({ error: 'update_failed', detail: error.message });
  res.json({ ok: true });
});

// Validação pública do código (tela de agendamento, sem login).
app.get('/api/credito-status', async (req, res) => {
  const codigo = String(req.query.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: 'invalid_params' });
  const { data: credito } = await supabaseAdmin.from('creditos').select('*').eq('codigo', codigo).maybeSingle();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(410).json({ error: 'credito_indisponivel', status: credito.status });
  res.json({ valido: true, valorCents: credito.valor_cents, valor: credito.valor_cents / 100 });
});

// Resgate público do crédito — mesma coisa que o checkout pago, mas sem Asaas:
// o crédito já cobre o valor, então o cliente cai direto confirmado no sistema.
// body: { codigo, name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary }
app.post('/api/resgatar-credito', async (req, res) => {
  const { codigo, name, cpfCnpj, email, phone, sexo, cidade, estado, servicoId, date, time, summary } = req.body || {};
  if (!codigo || !name || !email || !phone || !servicoId) return res.status(400).json({ error: 'invalid_params' });
  const { valido, digitos } = validarCpfCnpj(cpfCnpj);
  if (!valido) return res.status(400).json({ error: 'cpf_cnpj_invalido' });

  const { data: credito } = await supabaseAdmin.from('creditos').select('*').eq('codigo', String(codigo).trim().toUpperCase()).maybeSingle();
  if (!credito) return res.status(404).json({ error: 'credito_not_found' });
  if (credito.status !== 'ativo') return res.status(410).json({ error: 'credito_indisponivel' });

  const { data: servico } = await supabaseAdmin.from('servicos').select('*').eq('id', servicoId).single();
  if (!servico) return res.status(404).json({ error: 'servico_not_found' });
  if (servico.price_cents > credito.valor_cents) return res.status(400).json({ error: 'credito_insuficiente' });

  try {
    const clientId = digitos;
    const { data: existente } = await supabaseAdmin.from('clientes').select('id').eq('id', clientId).maybeSingle();
    if (!existente) {
      const { error: erroInsert } = await supabaseAdmin.from('clientes').insert({
        id: clientId, name, cpf: digitos, email, phone,
        sexo: sexo || null, cidade: cidade || null, estado: estado || null,
        tax_type: servico.name, honorarios: Math.round(servico.price_cents / 100),
        status: 'pending'
      });
      if (erroInsert) throw erroInsert;
    } else {
      await supabaseAdmin.from('clientes').update({ email, phone, sexo: sexo || null, cidade: cidade || null, estado: estado || null }).eq('id', clientId);
    }
    if (summary) {
      await supabaseAdmin.from('triagens').insert({
        cliente_ref: clientId, assunto: servico.name, descricao: summary, status: 'enviada', enviada_at: new Date().toISOString()
      });
    }

    const { data: appt } = await supabaseAdmin.from('agendamentos').insert({
      cliente_ref: clientId, client_name: name, date: date || 'A definir', time: time || '',
      tax_type: servico.name, status: 'pending'
    }).select().single();

    const { data: cob, error: erroCob } = await supabaseAdmin.from('cobrancas').insert({
      cliente_ref: clientId, servico_id: servicoId, valor_cents: servico.price_cents,
      status: 'paid', billing_type: 'CREDITO', paid_at: new Date().toISOString(),
      appt_date: date || null, appt_time: time || null, appointment_id: appt ? appt.id : null
    }).select().single();
    if (erroCob) throw erroCob;

    await supabaseAdmin.from('creditos').update({
      status: 'usado', usado_em: new Date().toISOString(), cliente_ref: clientId, cobranca_id: cob.id
    }).eq('id', credito.id);

    await supabaseAdmin.from('notificacoes').insert({
      text: `Crédito resgatado: ${name} agendou ${servico.name} com o código ${credito.codigo}.`,
      time: nowTime(), unread: true, cliente_ref: clientId
    });

    io.emit('appointments_updated');
    io.emit('notifications_updated');

    // Mesma criação de acesso do checkout pago normal — best-effort.
    if (email && supabaseAdmin) {
      try {
        const { data: clienteAtual } = await supabaseAdmin.from('clientes').select('user_id').eq('id', clientId).single();
        if (clienteAtual && !clienteAtual.user_id) {
          const { data: novoUser, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
          if (!erroAuth && novoUser && novoUser.user) {
            await supabaseAdmin.from('clientes').update({ user_id: novoUser.user.id }).eq('id', clientId);
          } else if (erroAuth) {
            console.error('criação de conta via crédito falhou:', erroAuth.message);
          }
        }
      } catch (e) {
        console.error('criação de conta via crédito falhou:', e.message);
      }
    }

    res.json({ clientId, appointmentId: appt ? appt.id : null, servico: mapServico(servico), valor: servico.price_cents / 100, status: 'confirmado' });
  } catch (e) {
    console.error('resgatar-credito error:', e.message);
    res.status(500).json({ error: 'resgate_failed', detail: e.message });
  }
});

// Polling do cliente: consulta status da cobrança (funciona em localhost).
app.get('/api/checkout/:id/status', async (req, res) => {
  const { data: cob } = await supabaseAdmin.from('cobrancas').select('*').eq('id', parseInt(req.params.id)).single();
  if (!cob) return res.status(404).send('Cobrança não encontrada');
  if (!asaas.isConfigured()) return res.status(503).json({ error: 'asaas_not_configured' });
  try {
    const result = await confirmCobranca(cob);
    res.json(result);
  } catch (e) {
    console.error('status error:', e.message);
    res.status(502).json({ error: 'asaas_error', detail: e.message });
  }
});

// Webhook do Asaas (produção): confirma pagamento vindo do gateway.
app.post('/api/asaas/webhook', async (req, res) => {
  const event = req.body || {};
  const paymentId = event.payment && event.payment.id;
  if (!paymentId) return res.status(200).send('ignored');

  const { data: cob } = await supabase.from('cobrancas').select('*').eq('asaas_payment_id', paymentId).single();
  if (cob) {
    try { await confirmCobranca(cob); } catch (e) { console.error('webhook error:', e.message); }
  }
  res.status(200).send('ok'); // Asaas exige 200 para não reenviar
});

// ============ IA / COPILOT (OpenRouter) ============
// body: { clientId, mode: 'resumo'|'rascunho'|'pergunta'|'diagnostico', prompt? }
app.post('/api/copilot', async (req, res) => {
  const { clientId, mode, prompt, skill } = req.body;
  if (!clientId || !mode) return res.status(400).send('Invalid params');
  if (!ia.isConfigured()) return res.status(503).json({ error: 'ia_not_configured' });

  const cliente = await fetchClient(clientId);
  if (!cliente) return res.status(404).send('Cliente não encontrado');

  try {
    if (mode === 'resumo') {
      return res.json({ text: await ia.resumirCaso(cliente) });
    }
    if (mode === 'rascunho') {
      return res.json({ text: await ia.rascunharResposta(cliente, prompt) });
    }
    if (mode === 'pergunta') {
      return res.json({ text: await ia.perguntaLivre(cliente, prompt || '', skill) });
    }
    if (mode === 'diagnostico') {
      return res.json(await ia.sugerirDiagnostico(cliente));
    }
    return res.status(400).send('Modo inválido');
  } catch (e) {
    console.error('copilot error:', e.message);
    if (e.code === 'ia_not_configured') return res.status(503).json({ error: 'ia_not_configured' });
    res.status(502).json({ error: 'ia_error', detail: e.message });
  }
});

// ============ DOCUMENTOS (upload real + leitura por IA) ============

function mapDocumento(row) {
  return {
    id: row.id,
    clientRef: row.cliente_ref,
    fileName: row.file_name,
    mime: row.mime,
    size: row.size_bytes,
    uploadedBy: row.uploaded_by,
    url: row.public_url,
    ai: row.ai_extracted || null,
    createdAt: row.created_at
  };
}

// Lista documentos de um cliente.
app.get('/api/documentos', async (req, res) => {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).send('clientId obrigatório');
  const { data, error } = await supabase.from('documentos')
    .select('*').eq('cliente_ref', clientId).order('created_at', { ascending: false });
  if (error) { console.error(error); return res.status(500).json([]); }
  res.json((data || []).map(mapDocumento));
});

// Upload de um documento. body: { clientId, fileName, mime, dataBase64, uploadedBy }
app.post('/api/documentos', async (req, res) => {
  const { clientId, fileName, mime, dataBase64, uploadedBy } = req.body;
  if (!clientId || !fileName || !dataBase64) return res.status(400).send('Invalid params');

  try {
    const buffer = Buffer.from(dataBase64, 'base64');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${clientId}/${Date.now()}_${safeName}`;

    const up = await supabase.storage.from('documentos')
      .upload(storagePath, buffer, { contentType: mime || 'application/octet-stream', upsert: false });
    if (up.error) throw up.error;

    const publicUrl = supabase.storage.from('documentos').getPublicUrl(storagePath).data.publicUrl;

    const { data: doc, error } = await supabase.from('documentos').insert({
      cliente_ref: clientId,
      file_name: fileName,
      storage_path: storagePath,
      mime: mime || null,
      size_bytes: buffer.length,
      uploaded_by: uploadedBy || 'client',
      public_url: publicUrl
    }).select().single();
    if (error) throw error;

    // Mensagem no chat + notificação (mesma lógica de doc-upload)
    const msg = await persistMessage(clientId, {
      sender: uploadedBy === 'agent' ? 'agent' : 'client',
      text: `Arquivo enviado: ${fileName}`,
      time: nowTime(),
      type: 'doc-upload',
      docName: fileName
    });
    io.emit('receive_chat_message', { clientId, message: msg });

    await supabase.from('notificacoes').insert({
      text: `${clientId} enviou o documento: ${fileName}`,
      time: nowTime(), unread: true, cliente_ref: clientId
    });
    io.emit('notifications_updated');
    io.emit('documentos_updated', { clientId });

    res.json(mapDocumento(doc));
  } catch (e) {
    console.error('upload error:', e.message);
    res.status(500).json({ error: 'upload_failed', detail: e.message });
  }
});

// Lê o documento com IA e salva a extração.
app.post('/api/documentos/:id/analisar', async (req, res) => {
  if (!ia.isConfigured()) return res.status(503).json({ error: 'ia_not_configured' });

  const { data: doc } = await supabase.from('documentos').select('*').eq('id', parseInt(req.params.id)).single();
  if (!doc) return res.status(404).send('Documento não encontrado');

  try {
    const dl = await supabase.storage.from('documentos').download(doc.storage_path);
    if (dl.error) throw dl.error;
    const buffer = Buffer.from(await dl.data.arrayBuffer());

    const extracted = await ia.analisarDocumento(buffer, doc.mime);
    await supabase.from('documentos').update({ ai_extracted: extracted }).eq('id', doc.id);

    res.json({ ...mapDocumento(doc), ai: extracted });
  } catch (e) {
    console.error('analisar error:', e.message);
    if (e.code === 'ia_not_configured') return res.status(503).json({ error: 'ia_not_configured' });
    res.status(502).json({ error: 'ia_error', detail: e.message });
  }
});

// ============ RADAR FISCAL (Serpro) ============
app.post('/api/radar-fiscal', async (req, res) => {
  // Mesmo do arquivo serverless
  if (!supabaseAdmin) return res.status(503).json({ error: 'service_role_not_configured' });

  try {
    let documento = req.query.documento || (req.body && req.body.documento);
    
    // Auth check via header
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'unauthorized' });

    if (!documento) {
      const { data: cli } = await supabaseAdmin.from('clientes').select('cpf').eq('id', user.id).single();
      if (cli && cli.cpf) {
        documento = cli.cpf;
      } else {
        return res.status(400).json({ error: 'documento_required', detail: 'Forneça o CPF/CNPJ para o Radar Fiscal.' });
      }
    }

    const serpro = require('./api/_lib/serpro');
    const dadosRadar = await serpro.consultarRadarFiscal(documento);
    res.json(dadosRadar);
  } catch (e) {
    console.error('[Radar Fiscal API Error]', e.message);
    res.status(500).json({ error: 'radar_fiscal_failed', detail: e.message });
  }
});

// ============ NOTIFICAÇÕES EXTERNAS (status + teste) ============
app.get('/api/notify/status', (req, res) => {
  res.json({ email: notify.emailConfigured(), whatsapp: notify.whatsappConfigured() });
});

// Envia uma notificação de teste para um cliente. body: { clientId }
app.post('/api/notify/test', async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).send('clientId obrigatório');
  if (!notify.anyConfigured()) return res.status(503).json({ error: 'notify_not_configured' });

  const cliente = await fetchClient(clientId);
  if (!cliente) return res.status(404).send('Cliente não encontrado');

  const results = await notify.notifyCliente(cliente,
    'Teste — Olá, Contador',
    'Este é um aviso de teste do sistema Olá, Contador. Se você recebeu, os avisos estão funcionando!');
  res.json({ to: { email: cliente.email, phone: cliente.phone }, results });
});

// ============ AGENDA FISCAL (obrigações + lembretes proativos) ============

// Próximos vencimentos. Com ?clientId= filtra pelo tipo do cliente; sem, retorna todos.
app.get('/api/agenda-fiscal', async (req, res) => {
  const { data: obrigacoes, error } = await supabase.from('obrigacoes').select('*').eq('active', true);
  if (error) { console.error(error); return res.status(500).json([]); }

  let taxType = null;
  if (req.query.clientId) {
    const { data: c } = await supabase.from('clientes').select('tax_type').eq('id', req.query.clientId).single();
    taxType = c ? c.tax_type : null;
    return res.json(agenda.proximosVencimentos(obrigacoes, taxType));
  }
  // sem cliente: mostra todas as obrigações (agenda geral do escritório)
  res.json(agenda.proximosVencimentos(obrigacoes, null));
});

// Motor de lembretes: avisa clientes cujas obrigações vencem dentro de reminder_days.
// Idempotente via tabela lembretes_enviados. Retorna quantos avisos enviou.
async function rodarLembretes() {
  const { data: obrigacoes } = await supabase.from('obrigacoes').select('*').eq('active', true);
  const { data: clientes } = await supabase.from('clientes').select('*');
  if (!obrigacoes || !clientes) return { enviados: 0 };

  let enviados = 0;
  for (const cli of clientes) {
    const venc = agenda.proximosVencimentos(obrigacoes, cli.tax_type);
    for (const v of venc) {
      const ob = obrigacoes.find(o => o.id === v.id);
      if (v.daysUntil > (ob.reminder_days || 3)) continue; // ainda não é hora

      // já avisou esse cliente sobre esse vencimento?
      const { data: existe } = await supabase.from('lembretes_enviados')
        .select('id').eq('obrigacao_id', v.id).eq('cliente_ref', cli.id).eq('due_date', v.dueDate).maybeSingle();
      if (existe) continue;

      // registra ANTES de enviar (evita duplicar em corridas)
      const ins = await supabase.from('lembretes_enviados')
        .insert({ obrigacao_id: v.id, cliente_ref: cli.id, due_date: v.dueDate });
      if (ins.error) continue;

      // notificação interna (sempre) + externa (se configurada)
      await supabase.from('notificacoes').insert({
        text: `Lembrete: ${v.title} vence em ${v.dueDate} (${cli.name}).`,
        time: nowTime(), unread: true, cliente_ref: cli.id
      });
      const clienteFull = await fetchClient(cli.id);
      await notify.notifyCliente(clienteFull, `Lembrete: ${v.title}`,
        `Sua obrigação <strong>${v.title}</strong> vence em <strong>${v.dueDate}</strong>. ${v.description || ''}`);
      enviados++;
    }
  }
  if (enviados) { io.emit('notifications_updated'); }
  return { enviados };
}

// Dispara os lembretes manualmente (teste / botão do contador).
app.post('/api/agenda-fiscal/run-reminders', async (req, res) => {
  try {
    const r = await rodarLembretes();
    res.json(r);
  } catch (e) {
    console.error('lembretes error:', e.message);
    res.status(500).json({ error: 'reminders_failed', detail: e.message });
  }
});

// Agenda diária: roda os lembretes 1x por dia enquanto o servidor estiver de pé.
setInterval(() => { rodarLembretes().catch(e => console.error('cron lembretes:', e.message)); }, 24 * 60 * 60 * 1000);

// ============ WebSockets (chat em tempo real) ============
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('send_chat_message', async (data) => {
    if (!data || !data.clientId || !data.message) return;
    const outMsg = await persistMessage(data.clientId, data.message);
    io.emit('receive_chat_message', { clientId: data.clientId, message: outMsg });
  });

  socket.on('doc_upload', async (data) => {
    if (!data || !data.clientId || !data.docName) return;
    const msg = {
      id: 'msg_' + Date.now(),
      sender: 'system',
      text: `Arquivo enviado: ${data.docName}`,
      time: nowTime(),
      type: 'doc-upload',
      docName: data.docName
    };
    const outMsg = await persistMessage(data.clientId, msg);
    io.emit('receive_chat_message', { clientId: data.clientId, message: outMsg });
    io.emit('doc_status_update', data);
  });

  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

server.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT} (Supabase)`);
});
