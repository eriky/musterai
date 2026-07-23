import React, { useState } from 'react';
import { AgentRegistration } from '../types';
import { Users, Cpu, ShieldCheck, Plus, CheckCircle2, Clock } from 'lucide-react';

interface AgentsHubProps {
  agents: AgentRegistration[];
  onOpenRegisterAgent: () => void;
}

export const AgentsHub: React.FC<AgentsHubProps> = ({ agents, onOpenRegisterAgent }) => {
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredAgents = agents.filter((a) => {
    if (roleFilter !== 'all' && a.role !== roleFilter) return false;
    return true;
  });

  const parseCaps = (caps: any): string[] => {
    if (Array.isArray(caps)) return caps;
    if (typeof caps === 'string') {
      try {
        const p = JSON.parse(caps);
        if (Array.isArray(p)) return p;
      } catch (_) {}
      return caps.split(',').filter(Boolean);
    }
    return [];
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#6366f1" /> Agent Orchestration Directory
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: '2px' }}>
              Manage registered AI agents, human contributors, role permissions, and active capabilities.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field"
              style={{ width: '150px', height: '36px', fontSize: '0.84rem' }}
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="contributor">Contributor</option>
              <option value="observer">Observer</option>
            </select>

            <button onClick={onOpenRegisterAgent} className="btn btn-primary btn-sm">
              <Plus size={16} /> Register Agent
            </button>
          </div>
        </div>

        {/* Agent Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredAgents.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '0.9rem' }}>
              No registered agents match the filter.
            </div>
          ) : (
            filteredAgents.map((agent) => {
              const caps = parseCaps(agent.capabilities);
              const isActive = agent.status === 'active';

              return (
                <div key={agent.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: agent.type === 'ai_agent' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: `1px solid ${agent.type === 'ai_agent' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: agent.type === 'ai_agent' ? '#818cf8' : '#34d399',
                      }}>
                        {agent.type === 'ai_agent' ? <Cpu size={22} /> : <ShieldCheck size={22} />}
                      </div>

                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                          {agent.name}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Role: <span style={{ color: '#a5b4fc', textTransform: 'capitalize' }}>{agent.role}</span>
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      color: isActive ? '#34d399' : '#94a3b8',
                      border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                    }}>
                      {agent.status}
                    </span>
                  </div>

                  {/* Capabilities Tags */}
                  <div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '6px' }}>Capabilities</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {caps.length === 0 ? (
                        <span style={{ fontSize: '0.76rem', color: '#475569', fontStyle: 'italic' }}>None listed</span>
                      ) : (
                        caps.map((cap, i) => (
                          <span key={i} style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#c7d2fe',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                          }}>
                            {cap}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.74rem',
                    color: '#64748b',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  }}>
                    <span>ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{agent.id.substring(0, 8)}</span></span>
                    <span>Last Seen: {new Date(agent.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
