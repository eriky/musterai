import React, { useState } from 'react';
import { CAPEvent } from '../types';
import { Activity, Search, Filter, Terminal, Code, Cpu } from 'lucide-react';

interface ActivityFeedProps {
  events: CAPEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = events.filter((evt) => {
    if (filterType !== 'all' && evt.entity_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        evt.action.toLowerCase().includes(q) ||
        evt.entity_id.toLowerCase().includes(q) ||
        evt.actor_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#10b981" /> Platform Activity Stream
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
              Live Event Log of all autonomous agent actions, board updates, and document revisions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ width: '220px', height: '36px', fontSize: '0.84rem' }}
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field"
              style={{ width: '150px', height: '36px', fontSize: '0.84rem' }}
            >
              <option value="all">All Entities</option>
              <option value="card">Cards</option>
              <option value="board">Boards</option>
              <option value="column">Columns</option>
              <option value="document">Documents</option>
              <option value="agent">Agents</option>
            </select>
          </div>
        </div>

        {/* Log feed list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', fontSize: '0.9rem' }}>
              No matching activity events found.
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div key={evt.id} style={{
                padding: '14px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderLeft: '4px solid #6366f1',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-medium">{evt.entity_type}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                        {evt.action.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Actor: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{evt.actor_id}</span> • Target ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{evt.entity_id}</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    {new Date(evt.created_at).toLocaleString()}
                  </span>
                </div>

                {evt.payload && (
                  <pre style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.76rem',
                    color: '#94a3b8',
                    overflowX: 'auto',
                  }}>
                    {typeof evt.payload === 'string' ? evt.payload : JSON.stringify(evt.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
