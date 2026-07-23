// File: public/js/app.js - Shared API client, SSE, routing

const API_BASE = '/api';
let currentProjectId = null;
let currentBoardId = null;
let sseConnection = null;

// Initialize application
async function init() {
    await loadProjectSelector();
    setupEventListeners();
    setupSSE();
}

// Load project selector dropdown
async function loadProjectSelector() {
    const selector = document.getElementById('project-selector');
    if (!selector) return;

    try {
        const response = await fetch(`${API_BASE}/projects`);
        const projects = await response.json();
        
        selector.innerHTML = '<option value="">Select Project</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });

        selector.addEventListener('change', () => {
            currentProjectId = selector.value;
            refreshCurrentPage();
        });
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Load board selector if on board page
    const boardSelector = document.getElementById('board-selector');
    if (boardSelector) {
        boardSelector.addEventListener('change', async () => {
            currentBoardId = boardSelector.value;
            if (currentBoardId) {
                await loadBoard(currentBoardId);
            }
        });

        // Load boards when project changes
        const projectSelector = document.getElementById('project-selector');
        if (projectSelector) {
            projectSelector.addEventListener('change', async () => {
                currentProjectId = projectSelector.value;
                await loadBoardSelector();
            });
        }
    }
}

// Load board selector dropdown
async function loadBoardSelector() {
    const selector = document.getElementById('board-selector');
    if (!selector || !currentProjectId) return;

    try {
        const response = await fetch(`${API_BASE}/boards?projectId=${currentProjectId}`);
        const boards = await response.json();
        
        selector.innerHTML = '<option value="">Select Board</option>';
        boards.forEach(board => {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = board.name;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load boards:', error);
    }
}

// Setup SSE connection
function setupSSE() {
    if (!currentProjectId) return;

    const streamUrl = `${API_BASE}/events/stream?projectId=${currentProjectId}`;
    
    try {
        sseConnection = new EventSource(streamUrl);
        
        sseConnection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleSSEEvent(data);
        };

        sseConnection.onerror = (error) => {
            console.error('SSE Error:', error);
            // Attempt reconnection after a delay
            setTimeout(() => setupSSE(), 5000);
        };
    } catch (error) {
        console.error('Failed to connect to SSE:', error);
    }
}

// Handle SSE events
function handleSSEEvent(event) {
    console.log('Received SSE event:', event);

    switch (event.entity_type) {
        case 'card':
            updateBoardUI(event);
            break;
        case 'agent':
            updateAgentPanel(event);
            break;
        case 'document':
            updateDocList(event);
            break;
        case 'column':
            updateBoardUI(event);
            break;
        default:
            appendActivityEvent(event);
    }
}

// Refresh current page data
function refreshCurrentPage() {
    const path = window.location.pathname.split('/').pop();
    switch (path) {
        case 'index.html' || '':
            loadDashboard();
            break;
        case 'board.html':
            loadBoard(currentBoardId);
            break;
        case 'document.html':
            loadDocuments();
            break;
        case 'activity.html':
            loadActivity();
            break;
    }
}

// API helper functions
async function apiGet(url) {
    const response = await fetch(`${API_BASE}${url}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

async function apiPost(url, body) {
    const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

async function apiPatch(url, body) {
    const response = await fetch(`${API_BASE}${url}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

// Export for use in other scripts
window.APP = {
    init,
    loadProjectSelector,
    loadBoardSelector,
    apiGet,
    apiPost,
    apiPatch,
    refreshCurrentPage,
    getCurrentProject: () => currentProjectId,
    getCurrentBoard: () => currentBoardId
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    APP.init();
});
