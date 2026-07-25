/**
 * kanban.js - Lógica de Drag and Drop para a esteira de acompanhamento
 */

document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.kanban-card');
  const columns = document.querySelectorAll('.kanban-col-body');

  let draggedCard = null;

  // Atualiza as contagens nas badges
  function updateKanbanCounts() {
    const allCols = document.querySelectorAll('.kanban-col');
    allCols.forEach(col => {
      const count = col.querySelectorAll('.kanban-card').length;
      const badge = col.querySelector('.kanban-badge');
      if (badge) {
        badge.textContent = count;
      }
    });
  }

  // Eventos nos Cards
  cards.forEach(card => {
    // Certificar que todos são arrastáveis (caso o HTML não tenha)
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      draggedCard = card;
      // timeout para aplicar classe de dragging após o preview do drag ser gerado
      setTimeout(() => {
        card.classList.add('dragging');
      }, 0);
      e.dataTransfer.effectAllowed = 'move';
      // Fallback data
      e.dataTransfer.setData('text/plain', card.innerText);
    });

    card.addEventListener('dragend', () => {
      draggedCard.classList.remove('dragging');
      draggedCard = null;
      updateKanbanCounts();
    });
  });

  // Helper para descobrir onde o card deve ser solto (acima de qual card)
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Eventos nas Colunas
  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.classList.add('drag-over');
      
      const afterElement = getDragAfterElement(column, e.clientY);
      if (draggedCard) {
        if (afterElement == null) {
          column.appendChild(draggedCard);
        } else {
          column.insertBefore(draggedCard, afterElement);
        }
      }
    });

    column.addEventListener('dragenter', (e) => {
      e.preventDefault();
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');
      // A própria inserção já ocorreu no dragover, mas se for necessário lógica final:
      updateKanbanCounts();
    });
  });

  // Contagem inicial
  updateKanbanCounts();
});
