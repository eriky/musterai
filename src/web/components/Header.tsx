import React from 'react';
import { Project, ProjectSummary, Agent } from '../types.js';
import { Bot, Layout, FileText, Activity, Plus, FolderPlus, Layers, Database, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { ThemePicker } from './ThemePicker.js';

type TabId = 'agents' | 'board' | 'docs' | 'activity' | 'kb';

interface HeaderProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenEditProject?: () => void;
  summary: ProjectSummary | null;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenNewProject: () => void;
  onOpenNewBoard: () => void;
  onOpenRegisterAgent: () => void;
  onOpenNewCard: () => void;
  onOpenNewDoc: () => void;
  agents?: Agent[];
  selectedHumanId?: string | null;
  onSelectHuman?: (id: string) => void;
}

/** Vertical rule between header groups. Decorative, so it carries no text. */
const Divider: React.FC = () => (
  <span className="muster-divider w-px h-4 shrink-0" aria-hidden="true" />
);

/** Small dot separator in the telemetry strip. */
const Dot: React.FC = () => (
  <span className="muster-divider w-1 h-1 rounded-full shrink-0" aria-hidden="true" />
);

export const Header: React.FC<HeaderProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onDeleteProject,
  onOpenEditProject,
  summary,
  activeTab,
  onSelectTab,
  onOpenNewProject,
  onOpenNewBoard,
  onOpenRegisterAgent,
  onOpenNewCard,
  onOpenNewDoc,
  agents = [],
  selectedHumanId,
  onSelectHuman,
}) => {
  const humanAgents = agents.filter(a => a.type === 'human');

  const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
    { id: 'agents', icon: Bot, label: `Agents ${summary ? `(${summary.active_agent_count}/${summary.agent_count})` : ''}` },
    { id: 'board', icon: Layout, label: `Kanban Board ${summary ? `(${summary.card_count})` : ''}` },
    { id: 'docs', icon: FileText, label: `Design Documents ${summary ? `(${summary.document_count})` : ''}` },
    { id: 'kb', icon: Database, label: 'Knowledge Base' },
    { id: 'activity', icon: Activity, label: 'Activity Log' },
  ];

  return (
    <header className="bg-muster-surface border-b border-muster-border sticky top-0 z-40 backdrop-blur-md w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Left Side: Brand & Selectors */}
          <div className="flex items-center space-x-4">

            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div
                className="w-8 h-8 shrink-0 rounded-md muster-accent-bg border muster-accent flex items-center justify-center"
              >
                <svg viewBox="0 0 32 32" className="w-6 h-6 muster-accent" fill="none" role="img" aria-label="Muster logo">
                  <title>Muster logo</title>
                  <path d="M6 23V9l10 10L26 9v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="6" cy="23" r="2.5" fill="currentColor" />
                  <circle cx="6" cy="9" r="2.5" fill="currentColor" />
                  <circle cx="16" cy="19" r="2.5" fill="currentColor" />
                  <circle cx="26" cy="9" r="2.5" fill="currentColor" />
                  <circle cx="26" cy="23" r="2.5" fill="currentColor" />
                </svg>
              </div>
            </div>

            {/* Human Operator Picker */}
            {humanAgents.length > 0 && onSelectHuman && (
              <div className="flex items-center space-x-1.5 bg-muster-base border border-muster-border rounded-md px-2 py-1">
                <span className="text-[11px] font-mono muster-text-muted font-semibold uppercase">I am:</span>
                <select
                  value={selectedHumanId || ''}
                  onChange={(e) => onSelectHuman(e.target.value)}
                  className="bg-transparent muster-accent text-xs font-mono font-bold focus:outline-none cursor-pointer"
                >
                  {humanAgents.map((h) => (
                    <option key={h.id} value={h.id} className="bg-muster-surface muster-text-primary">
                      {h.name} ({h.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Divider />

            {/* Project Selector Dropdown, Edit & Delete Buttons */}
            <div className="flex items-center space-x-1.5">
              <select
                value={selectedProjectId || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="muster-input w-auto font-mono cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-muster-surface muster-text-primary">
                    Project: {p.name}
                  </option>
                ))}
              </select>

              {selectedProjectId && projects.length > 0 && onOpenEditProject && (
                <button
                  onClick={onOpenEditProject}
                  className="muster-btn muster-btn-icon muster-btn-ghost"
                  title="Edit Selected Project Details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

              {selectedProjectId && projects.length > 0 && (
                <button
                  onClick={() => {
                    const proj = projects.find(p => p.id === selectedProjectId);
                    if (proj && confirm(`Are you sure you want to delete project "${proj.name}"?\n\nThis will permanently delete all boards, cards, documents, and knowledge base links in this project.`)) {
                      onDeleteProject(selectedProjectId);
                    }
                  }}
                  className="muster-btn muster-btn-icon muster-btn-ghost-danger"
                  title="Delete Selected Project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={onOpenNewProject}
                className="muster-btn muster-btn-soft font-mono"
                title="Create New Project"
              >
                <FolderPlus className="w-3.5 h-3.5" /> + Project
              </button>
            </div>

            <Divider />

            {/* Entity Creation Buttons */}
            <div className="flex items-center space-x-2">
              <button onClick={onOpenNewBoard} className="muster-btn muster-btn-secondary font-mono">
                <Layers className="w-3.5 h-3.5 muster-accent" /> + Board
              </button>

              <button onClick={onOpenRegisterAgent} className="muster-btn muster-btn-secondary font-mono">
                <UserPlus className="w-3.5 h-3.5 muster-accent" /> + User
              </button>

              <button onClick={onOpenNewCard} className="muster-btn muster-btn-secondary font-mono">
                <Plus className="w-3.5 h-3.5 muster-accent" /> + Card
              </button>

              <button onClick={onOpenNewDoc} className="muster-btn muster-btn-secondary font-mono">
                <FileText className="w-3.5 h-3.5 muster-accent" /> + Doc
              </button>
            </div>

          </div>

          {/* Right Side: Theme Picker */}
          <div className="flex items-center">
            <ThemePicker />
          </div>

        </div>

        {/* Sub-Navigation & Summary Telemetry */}
        <div className="flex items-center justify-between border-t border-muster-border/60 py-2">
          <nav className="flex space-x-2">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => onSelectTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium muster-tab ${
                  activeTab === id ? 'muster-tab-active' : ''
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* Summary telemetry */}
          {summary && (
            <div className="hidden md:flex items-center gap-3 text-xs font-sans">
              <div>
                <span className="muster-text-muted">Active Agents: </span>
                <span className="muster-text-success font-medium">{summary.active_agent_count}</span>
              </div>
              <Dot />
              <div>
                <span className="muster-text-muted">Boards: </span>
                <span className="muster-text-primary font-medium">{summary.board_count}</span>
              </div>
              <Dot />
              <div>
                <span className="muster-text-muted">Total Cards: </span>
                <span className="muster-accent font-medium">{summary.card_count}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
