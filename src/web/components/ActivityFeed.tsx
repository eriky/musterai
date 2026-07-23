import React, { useState } from 'react';
import { CAPEvent, AgentRegistration } from '../types';
import { Activity, Search, ChevronDown, ChevronRight, User, CheckCircle, FileText, Layout, Bot, MessageSquare } from 'lucide-react';

interface ActivityFeedProps {
  events: CAPEvent[];
  agents: AgentRegistration[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events, agents }) => {
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getActorName = (actorId: string): string => {
    if (!actorId || actorId === 'system') return 'System';
    const found = agents.find((a) => a.id === actorId);
    return found ? found.name : actorId;
  };

  const parsePayload = (evt: CAPEvent): any => {
    if (!evt.payload) return {};
    if (typeof evt.payload === 'string') {
      try {
        return JSON.parse(evt.payload);
      } catch (_) {
        return { text: evt.payload };
      }
    }
    return evt.payload;
  };

  const formatEventInfo = (evt: CAPEvent) => {
    const actor = getActorName(evt.actor_id);
    const p = parsePayload(evt);

    switch (`${evt.entity_type}.${evt.action}`) {
      case 'card.created':
        return {
          headline: `${actor} created task "${p.title || evt.entity_id}"`,
          icon: <Layout size={16} color="#3b82f6" />,
          accentColor: '#3b82f6',
        };
      case 'card.moved':
        return {
          headline: `${actor} moved task card "${p.title || evt.entity_id}"`,
          icon: <Layout size={16} color="#6366f1" />,
          accentColor: '#6366f1',
        };
      case 'card.updated':
        return {
          headline: `${actor} updated task card details`,
          icon: <Layout size={16} color="#8b5cf6" />,
          accentColor: '#8b5cf6',
        };
      case 'card.assigned': {
        const assignedName = getActorName(p.agent_id);
        return {
          headline: `${actor} assigned ${assignedName} to task`,
          icon: <User size={16} color="#ec4899" />,
          accentColor: '#ec4899',
        };
      }
      case 'card.unassigned': {
        const unassignedName = getActorName(p.agent_id);
        return {
          headline: `${actor} unassigned ${unassignedName} from task`,
          icon: <User size={16} color="#ef4444" />,
          accentColor: '#ef4444',
        };
      }
      case 'card.archived':
        return {
          headline: `${actor} archived task card`,
          icon: <Layout size={16} color="#64748b" />,
          accentColor: '#64748b',
        };
      case 'comment.created':
        return {
          headline: `${actor} commented`,
          subtitle: p.content ? `"${p.content}"` : undefined,
          icon: <MessageSquare size={16} color="#10b981" />,
          accentColor: '#10b981',
        };
      case 'document.created':
        return {
          headline: `${actor} created document "${p.title || evt.entity_id}"`,
          icon: <FileText size={16} color="#f59e0b" />,
          accentColor: '#f59e0b',
        };
      case 'document.updated':
        return {
          headline: `${actor} updated document "${p.title || evt.entity_id}" ${p.version ? `(v${p.version})` : ''}`,
          subtitle: p.change_summary ? `Summary: ${p.change_summary}` : undefined,
          icon: <FileText size={16} color="#f59e0b" />,
          accentColor: '#f59e0b',
        };
      case 'document.status_changed':
        return {
          headline: `${actor} changed document status to "${p.status}"`,
          icon: <CheckCircle size={16} color="#10b981" />,
          accentColor: '#10b981',
        };
      case 'agent.registered':
        return {
          headline: `Agent "${actor}" registered (${p.role || 'contributor'})`,
          icon: <Bot size={16} color="#06b6d4" />,
          accentColor: '#06b6d4',
        };
      case 'project.created':
        return {
          headline: `${actor} created project "${p.name || ''}"`,
          icon: <Activity size={16} color="#3b82f6" />,
          accentColor: '#3b82f6',
        };
      default:
        return {
          headline: `${actor} performed ${evt.action} on ${evt.entity_type}`,
          icon: <Activity size={16} color="#6366f1" />,
          accentColor: '#6366f1',
        };
    }
  };

  const filteredEvents = events.filter((evt) => {
    if (filterType !== 'all' && evt.entity_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const info = formatEventInfo(evt);
      return (
        info.headline.toLowerCase().includes(q) ||
        (info.subtitle && info.subtitle.toLowerCase().includes(q)) ||
        evt.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '24px' }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#10b981" /> Platform Activity Stream
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
              Human-readable real-time log of agent actions, task moves, and document revisions.
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

        {/* Feed List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', fontSize: '0.9rem' }}>
              No matching activity events found.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const info = formatEventInfo(evt);
              const isExpanded = !!expandedPayloads[evt.id];
              return (
                <div key={evt.id} style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderLeft: `4px solid ${info.accentColor}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ marginTop: '2px' }}>{info.icon}</div>
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{info.headline}</span>
                          <span className="badge badge-medium" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{evt.entity_type}</span>
                        </div>
                        {info.subtitle && (
                          <div style={{ fontSize: '0.84rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '4px' }}>
                            {info.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {new Date(evt.created_at).toLocaleString()}
                      </span>
                      <button
                        onClick={() => togglePayload(evt.id)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Toggle JSON details"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && evt.payload && (
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
