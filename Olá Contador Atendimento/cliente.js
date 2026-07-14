let socket = null;

document.addEventListener('DOMContentLoaded', () => {
  socket = io();
  setupNavigation();
  setupChat();
  setupFileUpload();
  
  // Listen for incoming messages from contador
  socket.on('receive_chat_message', (data) => {
    // Only process if it's for this client
    if (data.clientId === 'ana-silva') {
      appendMessageToChat(data.message);
    }
  });
});

// Navigation Handling (SPA routing)
function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const targetSectionId = button.getAttribute("data-target");
      
      // Remove active class from all nav items
      document.querySelectorAll(".app-sidebar-nav .nav-item").forEach(el => el.classList.remove("active"));
      button.classList.add("active");
      
      // Hide all panels
      document.querySelectorAll(".content-panel").forEach(panel => panel.classList.remove("active"));
      
      // Show target panel
      const targetPanel = document.getElementById(targetSectionId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });
}

function appendMessageToChat(msgObj) {
  const history = document.getElementById('client-chat-history');
  if (!history) return;

  const bubble = document.createElement('div');
  // client uses "cliente", server/accountant uses "contador"
  bubble.className = `chat-bubble ${msgObj.sender === 'client' ? 'cliente' : 'contador'}`;
  
  // Handle different message types if needed
  let content = msgObj.text;
  if (msgObj.type === 'doc-upload') {
    content = `<i class="fa-solid fa-file-pdf"></i> Arquivo enviado: ${msgObj.docName}`;
  }

  bubble.innerHTML = `
    ${content}
    <span class="chat-time">${msgObj.time}</span>
  `;
  
  history.appendChild(bubble);
  history.scrollTop = history.scrollHeight;
}

function setupChat() {
  const form = document.getElementById('client-chat-form');
  const input = document.getElementById('client-chat-input');
  
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const msg = input.value.trim();
    if (!msg) return;

    const newMsg = {
      id: "msg_" + Date.now(),
      sender: "client",
      text: msg,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type: "internal"
    };

    // Emit to backend
    socket.emit('send_chat_message', { clientId: 'ana-silva', message: newMsg });
    
    input.value = '';
  });
}

function setupFileUpload() {
  const fileInput = document.getElementById('file-upload');
  const docList = document.getElementById('client-doc-list');

  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Add to list visually
      const docItem = document.createElement('div');
      docItem.className = 'doc-item';
      
      docItem.innerHTML = `
        <div class="doc-info">
          <i class="fa-solid fa-file-pdf"></i>
          <div>
            <div class="doc-name">${file.name}</div>
            <div class="doc-meta">Enviado agora</div>
          </div>
        </div>
        <button class="btn-attach" title="Baixar"><i class="fa-solid fa-download"></i></button>
      `;
      
      docList.prepend(docItem); // add to top
      
      // Emit socket event for upload
      socket.emit('doc_upload', { clientId: 'ana-silva', docName: file.name });
      
      // Reset input
      fileInput.value = '';
    }
  });
}
