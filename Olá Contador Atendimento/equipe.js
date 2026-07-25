/**
 * equipe.js - Gerenciamento de Membros da Equipe
 */

document.addEventListener('DOMContentLoaded', () => {
  const formEquipe = document.getElementById('form-equipe');
  
  if (formEquipe) {
    formEquipe.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const nome = document.getElementById('equipe-nome').value;
      const email = document.getElementById('equipe-email').value;
      const permissao = document.getElementById('equipe-permissao').value;
      
      // Gera as iniciais (ex: Joana Alves -> JA)
      const initials = nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      // Define a cor da badge baseada na permissão
      let badgeColor = 'var(--color-pine)'; // Admin
      if (permissao === 'Atendente') badgeColor = '#3498DB';
      if (permissao === 'Leitura') badgeColor = '#9B59B6';

      // Monta o novo elemento HTML
      const memberHTML = `
        <div class="team-member" style="display: flex; align-items: center; gap: 12px; background: var(--color-bg); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); transition: all 0.2s ease;">
          <div class="chat-item-avatar" style="background-color: ${badgeColor}; color: white;">${initials}</div>
          <div style="flex: 1;">
            <h4 style="font-size: 14px; margin: 0; color: var(--color-pine);">${nome}</h4>
            <span style="font-size: 11px; color: var(--color-text-secondary);">${email}</span>
          </div>
          <span class="status-badge" style="background-color: ${badgeColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px;">${permissao}</span>
          <button class="btn-utility" onclick="this.closest('.team-member').remove()" style="padding: 4px 8px; color: var(--color-coral); border: none; background: transparent; cursor: pointer;" title="Revogar Acesso"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `;
      
      // Adiciona na lista
      const teamList = document.getElementById('team-list');
      teamList.insertAdjacentHTML('beforeend', memberHTML);
      
      // Fecha o modal e limpa o formulário
      if (typeof closeModal === 'function') {
        closeModal('modal-convite-equipe');
      } else {
        document.getElementById('modal-convite-equipe').style.display = 'none';
      }
      formEquipe.reset();
      
      // Mostra o Toast de sucesso (se a função existir no app.js)
      if (typeof showToast === 'function') {
        showToast('Convite enviado com sucesso!');
      } else {
        alert('Convite enviado com sucesso!');
      }
    });
  }
});
