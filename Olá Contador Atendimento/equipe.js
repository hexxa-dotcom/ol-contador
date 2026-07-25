/**
 * equipe.js - Gerenciamento de Membros da Equipe (Conectado à API)
 */

document.addEventListener('DOMContentLoaded', () => {
  const formEquipe = document.getElementById('form-equipe');
  
  // Função para buscar e renderizar a equipe
  window.carregarEquipe = async function() {
    const teamList = document.getElementById('team-list');
    if (!teamList) return;
    
    try {
      teamList.innerHTML = '<div style="padding: 12px; color: var(--color-text-secondary); font-size: 13px;">Carregando equipe...</div>';
      
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'equipe', action: 'listar' })
      });
      if (res.status === 403) {
         // Oculta a área de equipe se não for admin
         const configEquipe = document.getElementById('config-equipe');
         if (configEquipe) configEquipe.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock" style="font-size: 32px; color: var(--color-border); margin-bottom: 16px;"></i><p>Você não tem permissão para gerenciar a equipe.</p></div>';
         return;
      }
      if (!res.ok) throw new Error('Erro ao buscar equipe');
      
      const equipe = await res.json();
      teamList.innerHTML = '';
      
      if (equipe.length === 0) {
        teamList.innerHTML = '<div style="padding: 12px; color: var(--color-text-secondary); font-size: 13px;">Nenhum membro encontrado.</div>';
        return;
      }
      
      equipe.forEach(membro => {
        const nome = membro.nome || 'Sem Nome';
        const initials = nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        let badgeColor = 'var(--color-pine)'; // Admin
        let roleDisplay = 'Administrador';
        if (membro.role === 'parceiro') {
          badgeColor = '#3498DB';
          roleDisplay = 'Contador Parceiro';
        }

        // Não deixa o admin excluir a si mesmo facilmente na UI
        const btnDelete = (window.OCAuth && window.OCAuth.cachedUser && window.OCAuth.cachedUser.id === membro.id) 
            ? `<span style="font-size: 10px; color: var(--color-text-secondary);">Você</span>`
            : `<button class="btn-utility" onclick="removerMembro('${membro.id}')" style="padding: 4px 8px; color: var(--color-coral); border: none; background: transparent; cursor: pointer;" title="Revogar Acesso"><i class="fa-solid fa-trash-can"></i></button>`;

        const memberHTML = `
          <div class="team-member" style="display: flex; align-items: center; gap: 12px; background: var(--color-bg); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); transition: all 0.2s ease;">
            <div class="chat-item-avatar" style="background-color: ${badgeColor}; color: white;">${initials}</div>
            <div style="flex: 1;">
              <h4 style="font-size: 14px; margin: 0; color: var(--color-pine);">${nome}</h4>
              <span style="font-size: 11px; color: var(--color-text-secondary);">${membro.email}</span>
            </div>
            <span class="status-badge" style="background-color: ${badgeColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px;">${roleDisplay}</span>
            ${btnDelete}
          </div>
        `;
        teamList.insertAdjacentHTML('beforeend', memberHTML);
      });
      
    } catch (e) {
      console.error(e);
      teamList.innerHTML = '<div style="padding: 12px; color: var(--color-coral); font-size: 13px;">Erro ao carregar a equipe.</div>';
    }
  };

  // Excluir membro
  window.removerMembro = async function(id) {
    if (!confirm('Tem certeza que deseja remover o acesso desta pessoa?')) return;
    
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'equipe', action: 'remover', payload: { id } })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover');
      }
      showToast('Acesso revogado com sucesso!');
      carregarEquipe();
    } catch (e) {
      showToast('Erro: ' + e.message);
    }
  };

  // Enviar convite
  if (formEquipe) {
    formEquipe.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nome = document.getElementById('equipe-nome').value;
      const email = document.getElementById('equipe-email').value;
      const permissao = document.getElementById('equipe-permissao').value; // 'admin' ou 'parceiro'
      
      const btn = formEquipe.querySelector('button[type="submit"]');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'equipe', action: 'convidar', payload: { nome, email, role: permissao } })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Falha ao convidar.');
        }

        if (typeof closeModal === 'function') {
          closeModal('modal-convite-equipe');
        } else {
          document.getElementById('modal-convite-equipe').style.display = 'none';
        }
        formEquipe.reset();
        
        showToast('Convite enviado com sucesso para ' + email);
        carregarEquipe();

      } catch (err) {
        showToast(err.message);
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });
  }
});
