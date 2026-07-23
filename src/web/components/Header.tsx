import React from 'react';
import { Project } from '../types';
import { LayoutDashboard, Kanban, FileText, Activity, Users, Plus, Radio } from 'lucide-react';

interface HeaderProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project) => void;
  onOpenNewProject: () => void;
  activeTab: 'dashboard' | 'board' | 'documents' | 'activity' | 'agents';
  onTabChange: (tab: 'dashboard' | 'board' | 'documents' | 'activity' | 'agents') => void;
  isSseConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  activeTab,
  onTabChange,
  isSseConnected,
}) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      background: 'rgba(17, 24, 39, 0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand & Project Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.1rem',
          }}>
            C
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
              Collaborative Agent Platform
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
              <span>CAP Engine v1.0</span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isSseConnected ? '#10b981' : '#f59e0b' }}>
                <span className="live-pulse" style={{ backgroundColor: isSseConnected ? '#10b981' : '#f59e0b' }} />
                {isSseConnected ? 'Live Stream' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
          <select
            value={activeProject?.id || ''}
            onChange={(e) => {
              const p = projects.find((proj) => proj.id === e.target.value);
              if (p) onSelectProject(p);
            }}
            className="input-field"
            style={{ width: '210px', height: '36px', fontSize: '0.85rem' }}
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={onOpenNewProject}
            className="btn btn-secondary btn-sm"
            title="Create New Project"
            style={{ height: '36px', padding: '0 10px' }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Main Nav Tabs */}
      <nav style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => onTabChange('dashboard')}
          className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '34px', fontSize: '0.82rem', padding: '0 12px' }}
        >
          <LayoutDashboard size={15} /> Dashboard
        </button>
        <button
          onClick={() => onTabChange('board')}
          className={`btn ${activeTab === 'board' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '34px', fontSize: '0.82rem', padding: '0 12px' }}
        >
          <Kanban size={15} /> Kanban Boards
        </button>
        <button
          onClick={() => onTabChange('documents')}
          className={`btn ${activeTab === 'documents' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '34px', fontSize: '0.82rem', padding: '0 12px' }}
        >
          <FileText size={15} /> Documents
        </button>
        <button
          onClick={() => onTabChange('activity')}
          className={`btn ${activeTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '34px', fontSize: '0.82rem', padding: '0 12px' }}
        >
          <Activity size={15} /> Activity Feed
        </button>
        <button
          onClick={() => onTabChange('agents')}
          className={`btn ${activeTab === 'agents' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '34px', fontSize: '0.82rem', padding: '0 12px' }}
        >
          <Users size={15} /> Agents Hub
        </button>
      </nav>
    </header>
  );
};
