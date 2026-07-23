// File: public/js/activity.js - Activity feed page logic

async function loadActivity() {
    const projectId = APP.getCurrentProject();
    if (!projectId) return;

    const feed = document.getElementById('activity-feed');
    if (!feed) return;

    try {
        const events = await APP.apiGet(`/events?projectId=${projectId}&limit=100`);
        
        if (events.length === 0) {
            feed.innerHTML = '<div class="empty-state">No activity yet</div>';
            return;
        }

        feed.innerHTML = events.map(event => {
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
        feed.innerHTML = '<div class="empty-state">Failed to load activity</div>';
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

// Initialize activity page
document.addEventListener('DOMContentLoaded', () => {
    APP.loadActivity = loadActivity;
});
