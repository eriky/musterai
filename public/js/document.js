// File: public/js/document.js - Document page logic

async function loadDocuments() {
    const projectId = APP.getCurrentProject();
    if (!projectId) return;

    const tree = document.getElementById('document-tree');
    if (!tree) return;

    try {
        const documents = await APP.apiGet(`/documents?projectId=${projectId}`);
        
        if (documents.length === 0) {
            tree.innerHTML = '<div class="empty-state">No documents yet</div>';
            return;
        }

        tree.innerHTML = documents.map(doc => {
            const statusBadge = doc.status === 'approved' ? 'badge-approved' : 
                              doc.status === 'in_review' ? 'badge-review' : 'badge-draft';
            return `
                <div class="doc-tree-item" data-doc-id="${doc.id}">
                    <span class="badge ${statusBadge}">${doc.status}</span>
                    <span>${doc.title}</span>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">v${doc.version}</span>
                </div>
            `;
        }).join('');

        // Add click handlers
        tree.querySelectorAll('.doc-tree-item').forEach(item => {
            item.addEventListener('click', () => {
                const docId = item.dataset.docId;
                viewDocument(docId);
                
                // Update active state
                tree.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    } catch (error) {
        console.error('Failed to load documents:', error);
        tree.innerHTML = '<div class="empty-state">Failed to load documents</div>';
    }
}

async function viewDocument(docId) {
    const viewer = document.getElementById('document-viewer');
    if (!viewer) return;

    try {
        const doc = await APP.apiGet(`/documents/${docId}`);
        
        viewer.innerHTML = `
            <div class="document-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2>${doc.title}</h2>
                    <div style="display: flex; gap: 0.5rem;">
                        <span class="badge badge-${doc.status === 'approved' ? 'approved' : doc.status === 'in_review' ? 'review' : 'draft'}">${doc.status}</span>
                        <span>v${doc.version}</span>
                    </div>
                </div>
                <div style="white-space: pre-wrap; line-height: 1.8;">${renderMarkdown(doc.content)}</div>
                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); font-size: 0.8rem; color: var(--text-muted);">
                    Last updated: ${formatTime(doc.updated_at)}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load document:', error);
        viewer.innerHTML = '<div class="empty-state">Failed to load document</div>';
    }
}

// Create new document
function createNewDocument() {
    const modal = document.getElementById('doc-modal');
    const titleInput = document.getElementById('doc-modal-title');
    const contentInput = document.getElementById('doc-modal-content');
    
    titleInput.value = '';
    contentInput.value = '';
    modal.style.display = 'flex';
}

function closeDocModal() {
    const modal = document.getElementById('doc-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveDocument() {
    const projectId = APP.getCurrentProject();
    const title = document.getElementById('doc-modal-title').value;
    const content = document.getElementById('doc-modal-content').value;
    
    if (!projectId) {
        alert('Please select a project first.');
        return;
    }
    
    try {
        await APP.apiPost(`/documents`, {
            project_id: projectId,
            title: title || 'Untitled Document',
            content: content
        });
        
        closeDocModal();
        loadDocuments();
    } catch (error) {
        console.error('Failed to save document:', error);
        alert('Failed to save document.');
    }
}

// Simple markdown renderer (basic support)
function renderMarkdown(text) {
    if (!text) return '';
    
    return text
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n/g, '<br>');
}

// Initialize document page
document.addEventListener('DOMContentLoaded', () => {
    APP.loadDocuments = loadDocuments;
});

window.createNewDocument = createNewDocument;
window.closeDocModal = closeDocModal;
window.saveDocument = saveDocument;
