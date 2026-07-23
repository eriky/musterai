// File: public/js/dashboard.js - Dashboard page logic

async function loadDashboard() {
    const projectId = APP.getCurrentProject();
    if (!projectId) return;

    // Load agents
    loadAgents(projectId);
    
    // Load board snapshot
    loadBoardSnapshot(projectId);
    
    // Load recent activity
    loadActivity(projectId);
    
    // Load documents
    loadDocuments(projectId);
    
    // Load boards for selector
    await APP.loadBoardSelector();
}

// Load agents panel
async function loadAgents(projectId) {
    const agentsList = document.getElementById('agents-list');
    const agentCount = document.getElementById('agent-count');
    
    try {
        const agents = await APP.apiGet(`/agents?projectId=${projectId}`);
        
        if (agentCount) {
            agentCount.textContent = agents.length;
        }
        
        if (!agentsList) return;
        
        if (agents.length === 0) {
            agentsList.innerHTML = '<div class="empty-state">No agents registered</div>';
            return;
        }

        agentsList.innerHTML = agents.map(agent => {
            const statusClass = agent.status === 'active' ? 'status-online' : 
                              agent.status === 'idle' ? 'status-busy' : 'status-offline';
            return `
                <div class="agent-item">
                    <span class="status-dot ${statusClass}"></span>
                    <div class="agent-info">
                        <div class="agent-name">${agent.name}</div>
                        <div class="agent-role">${agent.role}</div>
                        <div class="agent-task">${agent.type}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load agents:', error);
        if (agentsList) {
            agentsList.innerHTML = '<div class="empty-state">Failed to load agents</div>';
        }
    }
}

// Load board snapshot
async function loadBoardSnapshot(projectId) {
    const boardSnapshot = document.getElementById('board-snapshot');
    if (!boardSnapshot) return;

    try {
        const boards = await APP.apiGet(`/boards?projectId=${projectId}`);
        
        if (boards.length === 0) {
            boardSnapshot.innerHTML = '<div class="empty-state">No boards created yet</div>';
            return;
        }

        // Load first board's snapshot
        const board = await APP.apiGet(`/boards/${boards[0].id}`);
        
        boardSnapshot.innerHTML = `
            <div class="snapshot-columns">
                ${board.columns.map(col => `
                    <div class="snapshot-column">
                        <div class="snapshot-col-header">
                            <span>${col.name}</span>
                            <span class="badge badge-default">${col.card_count}</span>
                        </div>
                        ${col.card_count > 0 ? `
                            <div style="height: 100%; background: rgba(255,255,255,0.02); border-radius: 4px; padding: 0.5rem;">
                                <div style="height: ${Math.min(col.card_count * 20, 100)}px; background: var(--accent-primary); opacity: 0.3; border-radius: 4px;"></div>
                            </div>
                        ` : '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center;">Empty</div>'}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Failed to load board snapshot:', error);
        boardSnapshot.innerHTML = '<div class="empty-state">Failed to load board</div>';
    }
}

// Load activity feed
async function loadActivity(projectId) {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    try {
        const events = await APP.apiGet(`/events?projectId=${projectId}&limit=20`);
        
        if (events.length === 0) {
            activityList.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        activityList.innerHTML = events.map(event => {
            const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
            return `
                <div class="activity-item ${event.entity_type}">
                    <div class="activity-icon">${getActivityIcon(event.action)}</div>
                    <div class="activity-content">
                        <div class="activity-header">
                            <span class="activity-author">${event.actor_id}</span>
                            <span class="activity-time">${formatTime(event.created_at)}</span>
                        </div>
                        <div class="activity-message">${formatAction(event.action, payload)}</div>
                        ${payload.entity_id ? `<div class="activity-details">Entity: ${payload.entity_id}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load activity:', error);
        activityList.innerHTML = '<div class="empty-state">Failed to load activity</div>';
    }
}

// Load documents panel
async function loadDocuments(projectId) {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;

    try {
        const documents = await APP.apiGet(`/documents?projectId=${projectId}`);
        
        if (documents.length === 0) {
            documentsList.innerHTML = '<div class="empty-state">No documents yet</div>';
            return;
        }

        documentsList.innerHTML = documents.map(doc => {
            const statusBadge = doc.status === 'approved' ? 'badge-approved' : 
                              doc.status === 'in_review' ? 'badge-review' : 'badge-draft';
            return `
                <div class="doc-item">
                    <div>
                        <div class="doc-title">${doc.title}</div>
                        <div class="doc-meta">
                            <span class="badge ${statusBadge}">${doc.status}</span>
                            <span>v${doc.version}</span>
                            <span>${formatTime(doc.updated_at)}</span>
                        </div>
                    </div>
                    <a href="document.html?id=${doc.id}" class="btn btn-sm">View</a>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load documents:', error);
        documentsList.innerHTML = '<div class="empty-state">Failed to load documents</div>';
    }
}

// Helper functions
function getActivityIcon(action) {
    const icons = {
        created: '➕',
        updated: '✏️',
        moved: '↔️',
        deleted: '🗑️',
        assigned: '👤',
        commented: '💬'
    };
    return icons[action] || '📋';
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
}

function formatAction(action, payload) {
    switch (action) {
        case 'created': return `Created ${payload.entity_type}`;
        case 'updated': return `Updated ${payload.entity_type}`;
        case 'moved': return `Moved ${payload.entity_type}`;
        case 'deleted': return `Deleted ${payload.entity_type}`;
        case 'assigned': return `Assigned ${payload.entity_type}`;
        case 'commented': return `Commented on ${payload.entity_type}`;
        default: return `${action} ${payload.entity_type}`;
    }
}

function updateBoardUI(event) {
    // Refresh board snapshot
    const projectId = APP.getCurrentProject();
    if (projectId) {
        loadBoardSnapshot(projectId);
    }
}

function updateAgentPanel(event) {
    const projectId = APP.getCurrentProject();
    if (projectId) {
        loadAgents(projectId);
    }
}

function updateDocList(event) {
    const projectId = APP.getCurrentProject();
    if (projectId) {
        loadDocuments(projectId);
    }
}

function appendActivityEvent(event) {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
    const newEvent = document.createElement('div');
    newEvent.className = `activity-item ${event.entity_type}`;
    newEvent.style.animation = 'slideIn 0.3s ease-out forwards';
    newEvent.innerHTML = `
        <div class="activity-icon">${getActivityIcon(event.action)}</div>
        <div class="activity-content">
            <div class="activity-header">
                <span class="activity-author">${event.actor_id}</span>
                <span class="activity-time">${formatTime(event.created_at)}</span>
            </div>
            <div class="activity-message">${formatAction(event.action, payload)}</div>
        </div>
    `;

    activityList.insertBefore(newEvent, activityList.firstChild);

    // Keep only last 50 events
    while (activityList.children.length > 50) {
        activityList.removeChild(activityList.lastChild);
    }
}

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    APP.loadDashboard = loadDashboard;
});
