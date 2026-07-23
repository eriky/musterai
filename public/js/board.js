// File: public/js/board.js - Board page logic with drag-and-drop

async function loadBoard(boardId) {
    const container = document.getElementById('board-container');
    if (!container) return;

    if (!boardId) {
        container.innerHTML = '<div class="empty-state">Select a board to view</div>';
        return;
    }

    try {
        const board = await APP.apiGet(`/boards/${boardId}`);
        renderBoard(board, container);
    } catch (error) {
        console.error('Failed to load board:', error);
        container.innerHTML = '<div class="empty-state">Failed to load board</div>';
    }
}

function renderBoard(board, container) {
    container.innerHTML = '';
    
    board.columns.forEach(column => {
        const columnEl = document.createElement('div');
        columnEl.className = 'board-column';
        columnEl.dataset.columnId = column.id;
        
        columnEl.innerHTML = `
            <div class="board-column-header">
                <span>${column.name}</span>
                ${column.wip_limit ? `<span class="badge badge-default">WIP: ${column.wip_limit}</span>` : ''}
            </div>
            <div class="board-cards" data-column-id="${column.id}">
                ${column.card_count > 0 ? `
                    <div style="color: var(--text-muted); font-size: 0.8rem;">${column.card_count} card${column.card_count !== 1 ? 's' : ''}</div>
                ` : '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 1rem 0;">Empty</div>'}
            </div>
        `;
        
        // Add drop zone styling
        columnEl.querySelector('.board-cards').addEventListener('dragover', (e) => {
            e.preventDefault();
            columnEl.style.background = 'rgba(99, 102, 241, 0.1)';
        });
        
        columnEl.querySelector('.board-cards').addEventListener('dragleave', () => {
            columnEl.style.background = '';
        });
        
        columnEl.querySelector('.board-cards').addEventListener('drop', (e) => {
            e.preventDefault();
            columnEl.style.background = '';
            const cardId = e.dataTransfer.getData('text/plain');
            const sourceColumnId = columnEl.dataset.columnId;
            
            if (cardId && sourceColumnId) {
                moveCard(cardId, sourceColumnId, column.id);
            }
        });
        
        container.appendChild(columnEl);
    });
}

// Move card to different column
async function moveCard(cardId, fromColumnId, toColumnId) {
    try {
        await APP.apiPost(`/cards/${cardId}/move`, { 
            target_column_id: toColumnId 
        });
        
        // Refresh the board
        const boardId = APP.getCurrentBoard();
        if (boardId) {
            await loadBoard(boardId);
        }
    } catch (error) {
        console.error('Failed to move card:', error);
        alert('Failed to move card. The column may have reached its WIP limit.');
    }
}

// Open card detail modal
async function openCardModal(cardId) {
    const modal = document.getElementById('card-modal');
    const titleEl = document.getElementById('modal-card-title');
    const bodyEl = document.getElementById('modal-card-body');
    
    try {
        const card = await APP.apiGet(`/cards/${cardId}`);
        
        titleEl.textContent = card.title;
        
        bodyEl.innerHTML = `
            <div class="card-details">
                <div class="card-meta">
                    <span class="badge badge-${card.priority}">${card.priority}</span>
                    ${card.due_date ? `<span>Due: ${new Date(card.due_date).toLocaleDateString()}</span>` : ''}
                </div>
                <div class="card-description" style="margin-top: 1rem; white-space: pre-wrap;">${card.description || 'No description'}</div>
                
                ${card.labels && card.labels.length > 0 ? `
                    <div style="margin-top: 1rem;">
                        <strong>Labels:</strong>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                            ${card.labels.map(label => `<span class="badge badge-default">${label.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${card.assignees && card.assignees.length > 0 ? `
                    <div style="margin-top: 1rem;">
                        <strong>Assignees:</strong>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                            ${card.assignees.map(a => `<span class="badge badge-default">${a.agent_id}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${card.comments && card.comments.length > 0 ? `
                    <div style="margin-top: 1.5rem;">
                        <strong>Comments:</strong>
                        <div style="margin-top: 0.5rem;">
                            ${card.comments.map(c => `
                                <div style="padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px; margin-bottom: 0.5rem;">
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${formatTime(c.created_at)}</div>
                                    <div style="white-space: pre-wrap;">${c.content}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Failed to load card:', error);
        bodyEl.innerHTML = '<div class="empty-state">Failed to load card details</div>';
        modal.style.display = 'flex';
    }
}

function closeCardModal() {
    const modal = document.getElementById('card-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Make cards draggable
function makeCardsDraggable(container) {
    const cards = container.querySelectorAll('.board-card');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.cardId);
            card.classList.add('dragging');
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        
        card.addEventListener('click', () => {
            openCardModal(card.dataset.cardId);
        });
    });
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('card-modal');
    if (modal && e.target === modal) {
        closeCardModal();
    }
});

// Initialize board page
document.addEventListener('DOMContentLoaded', () => {
    const boardSelector = document.getElementById('board-selector');
    if (boardSelector) {
        boardSelector.addEventListener('change', () => {
            loadBoard(boardSelector.value);
        });
    }
});

window.closeCardModal = closeCardModal;
