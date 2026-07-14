const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8000;
const root = __dirname;
const DB_FILE = path.join(root, 'db', 'clients.json');

// Middleware
app.use(express.json());
app.use(express.static(root)); // Serve static files (HTML, CSS, JS)

// Redirect root to admin panel
app.get('/', (req, res) => {
  res.redirect('/contador.html');
});

// --- Database Helpers ---
function readDB(filename = 'clients.json') {
  try {
    const data = fs.readFileSync(path.join(root, 'db', filename), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading DB:", err);
    return {};
  }
}

function writeDB(data, filename = 'clients.json') {
  try {
    fs.writeFileSync(path.join(root, 'db', filename), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing DB:", err);
  }
}

// --- REST API ROUTES (for legacy fetches) ---

app.get('/api/clients', (req, res) => {
  res.json(readDB('clients.json'));
});

app.get('/api/appointments', (req, res) => {
  res.json(readDB('appointments.json'));
});

app.get('/api/notifications', (req, res) => {
  res.json(readDB('notifications.json'));
});

app.post('/api/messages', (req, res) => {
  const { clientId, message } = req.body;
  if (!clientId || !message) return res.status(400).send('Invalid params');

  const clients = readDB();
  const client = clients[clientId];
  if (!client) return res.status(404).send('Client not found');

  client.messages.push(message);

  if (message.type === 'doc-request') {
    client.status = 'docs';
    client.checklist[message.docName] = false;
  } else if (message.type === 'doc-upload') {
    client.status = 'active';
    client.checklist[message.docName] = true;
  }

  writeDB(clients);

  // Broadcast to WebSockets!
  io.emit('new_message', { clientId, message });
  
  res.json(client);
});

app.post('/api/prontuario', (req, res) => {
  const { clientId, diagnosis, honorarios, treatment, evidences } = req.body;
  if (!clientId) return res.status(400).send('Invalid params');

  const clients = readDB();
  const client = clients[clientId];
  if (!client) return res.status(404).send('Client not found');

  if (diagnosis !== undefined) client.diagnosis = diagnosis;
  if (honorarios !== undefined) client.honorarios = parseInt(honorarios);
  if (treatment !== undefined) client.treatment = treatment;
  if (evidences !== undefined) client.evidences = evidences;

  writeDB(clients);
  res.json(client);
});

// --- WebSockets (Real-time Chat) ---

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // When a user (client or admin) sends a real-time chat message
  socket.on('send_chat_message', (data) => {
    // data should have: { clientId: 'client_1', message: { text, sender, time, type } }
    console.log('Chat message received:', data);
    
    // Save to DB
    const clients = readDB();
    if (clients[data.clientId]) {
      clients[data.clientId].messages.push(data.message);
      writeDB(clients);
    }

    // Broadcast to everyone (including sender, for confirmation)
    io.emit('receive_chat_message', data);
  });

  // When a user uploads a document
  socket.on('doc_upload', (data) => {
    // data: { clientId, docName }
    const clients = readDB();
    if (clients[data.clientId]) {
      // Create a mock system message
      const msg = {
        id: "msg_" + Date.now(),
        sender: "system",
        text: `Arquivo enviado: ${data.docName}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: "doc-upload",
        docName: data.docName
      };
      
      clients[data.clientId].messages.push(msg);
      writeDB(clients);
      
      io.emit('receive_chat_message', { clientId: data.clientId, message: msg });
      io.emit('doc_status_update', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});
