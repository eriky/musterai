import React from 'react';
import { Project, AgentRegistration, CAPEvent, Board, Document } from '../types';
import { Kanban, Users, FileText, Activity, ArrowRight, ShieldCheck, Cpu, Zap, Plus } from 'lucide-react';

interface DashboardProps {
  project: Project | null;
  summary: Project | null;
  agents: AgentRegistration[];
  events: CAPEvent[];
  boards: Board[];
  documents: Document[];
  onNavigate: (tab: 'board' | 'documents' | 'activity' | 'agents') => void;
  onOpenNewCard: () => void;
  onOpenNewDoc: () => void;
  onOpenRegisterAgent: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  project,
  summary,
  agents,
  events,
  boards,
  documents,
  onNavigate,
  onOpenNewCard,
  onOpenNewDoc,
  onOpenRegisterAgent,
}) => {
  const activeAgents = agents.filter((a) => a.status === 'active');

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }} className="animate-fade-in">
      {/* Welcome Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-medium">Active Workspace</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Created {project ? new Date(project.created_at).toLocaleDateString() : ''}</span>
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
              {project?.name || 'Collaborative Agent Platform'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginTop: '4px', maxWidth: '700px' }}>
              {project?.description || 'Autonomous agent coordination, task execution, and architectural decision documentation engine.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onOpenNewCard} className="btn btn-primary btn-sm">
              <Plus size={14} /> New Task Card
            </button>
            <button onClick={onOpenNewDoc} className="btn btn-secondary btn-sm">
              <Plus size={14} /> New Document
            </button>
            <button onClick={onOpenRegisterAgent} className="btn btn-secondary btn-sm">
              <Cpu size={14} /> Register Agent
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => onNavigate('board')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Active Boards</span>
            <Kanban size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', margin: '8px 0 4px' }}>
            {summary?.board_count ?? boards.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View kanban boards <ArrowRight size={12} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => onNavigate('board')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Total Task Cards</span>
            <Zap size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', margin: '8px 0 4px' }}>
            {summary?.card_count ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Tasks in project <ArrowRight size={12} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => onNavigate('agents')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Agents Online</span>
            <Users size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', margin: '8px 0 4px' }}>
            {activeAgents.length} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>/ {agents.length}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Active AI & Human agents <ArrowRight size={12} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => onNavigate('documents')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>System Documents</span>
            <FileText size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', margin: '8px 0 4px' }}>
            {summary?.document_count ?? documents.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Architecture & Specs <ArrowRight size={12} />
          </div>
        </div>
      </div>

      {/* Grid Layout: Agents & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
        {/* Agents Online Roster */}
        <div className="glass-panel" style={{ gridColumn: 'span 5', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#6366f1" /> Agent Registrations
            </h3>
            <button onClick={() => onNavigate('agents')} className="btn btn-secondary btn-sm">
              View All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '380px' }}>
            {agents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.88rem' }}>
                No registered agents found. Click "Register Agent" to add one.
              </div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: agent.type === 'ai_agent' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      border: `1px solid ${agent.type === 'ai_agent' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: agent.type === 'ai_agent' ? '#818cf8' : '#34d399',
                    }}>
                      {agent.type === 'ai_agent' ? <Cpu size={18} /> : <ShieldCheck size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {agent.name}
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          background: agent.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)',
                          color: agent.status === 'active' ? '#34d399' : '#94a3b8',
                        }}>
                          {agent.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                        Role: {agent.role} • {agent.type}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {new Date(agent.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Realtime Activity Ticker */}
        <div className="glass-panel" style={{ gridColumn: 'span 7', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#10b981" /> Realtime Activity Stream
            </h3>
            <button onClick={() => onNavigate('activity')} className="btn btn-secondary btn-sm">
              Full Log
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '380px' }}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.88rem' }}>
                Waiting for platform events...
              </div>
            ) : (
              events.slice(0, 8).map((evt) => (
                <div key={evt.id} style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderLeft: '3px solid #6366f1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>
                      {evt.action.replace('_', ' ').toUpperCase()} on {evt.entity_type}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                      Actor: <span style={{ color: '#a5b4fc' }}>{evt.actor_id}</span> • ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{evt.entity_id}</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
