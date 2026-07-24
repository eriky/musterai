// File: src/web/components/Header.tsx
import React from 'react';
import { Project, ProjectSummary } from '../types.js';
import { Bot, Layout, FileText, Activity, Plus, FolderPlus, Layers } from 'lucide-react';

interface HeaderProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  summary: ProjectSummary | null;
  activeTab: 'agents' | 'board' | 'docs' | 'activity';
  onSelectTab: (tab: 'agents' | 'board' | 'docs' | 'activity') => void;
  onOpenNewProject: () => void;
  onOpenNewBoard: () => void;
  onOpenRegisterAgent: () => void;
  onOpenNewCard: () => void;
  onOpenNewDoc: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  summary,
  activeTab,
  onSelectTab,
  onOpenNewProject,
  onOpenNewBoard,
  onOpenRegisterAgent,
  onOpenNewCard,
  onOpenNewDoc,
}) => {
  return (
    <header className="bg-command-surface border-b border-command-border sticky top-0 z-40 backdrop-blur-md bg-opacity-95 w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-sans text-sm font-bold text-zinc-100 tracking-tight">Collaborative Agent Platform</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] font-sans text-zinc-400">Project management & design doc hub for AI agents & humans</p>
            </div>
          </div>

          {/* Project Selector & Actions */}
          <div className="flex items-center space-x-3">
            {/* Project Selector Dropdown */}
            <div className="flex items-center space-x-1.5">
              <select
                value={selectedProjectId || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-command-bg border border-command-border text-zinc-200 text-xs font-mono rounded-md px-3 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-command-card text-zinc-200">
                    Project: {p.name}
                  </option>
                ))}
              </select>

              <button
                onClick={onOpenNewProject}
                className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer"
                title="Create New Project"
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1" /> + Project
              </button>
            </div>

            <span className="text-zinc-700">|</span>

            {/* Entity Creation Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onOpenNewBoard}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 mr-1 text-cyan-400" /> + Board
              </button>

              <button
                onClick={onOpenRegisterAgent}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 mr-1 text-emerald-400" /> + Agent
              </button>

              <button
                onClick={onOpenNewCard}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-indigo-400" /> + Card
              </button>

              <button
                onClick={onOpenNewDoc}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 mr-1 text-amber-400" /> + Doc
              </button>
            </div>

          </div>

        </div>

        {/* Sub-Navigation & Summary Telemetry */}
        <div className="flex items-center justify-between border-t border-command-border/60 py-2">
          {/* Clean Navigation Tabs */}
          <nav className="flex space-x-2">
            <button
              onClick={() => onSelectTab('agents')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
                activeTab === 'agents'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-command-card'
              }`}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5" />
              Agents {summary ? `(${summary.active_agent_count}/${summary.agent_count})` : ''}
            </button>

            <button
              onClick={() => onSelectTab('board')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
                activeTab === 'board'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-command-card'
              }`}
            >
              <Layout className="w-3.5 h-3.5 mr-1.5" />
              Kanban Board {summary ? `(${summary.card_count})` : ''}
            </button>

            <button
              onClick={() => onSelectTab('docs')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
                activeTab === 'docs'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-command-card'
              }`}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Design Documents {summary ? `(${summary.document_count})` : ''}
            </button>

            <button
              onClick={() => onSelectTab('activity')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
                activeTab === 'activity'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-command-card'
              }`}
            >
              <Activity className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Activity Log
            </button>
          </nav>

          {/* Clean Summary Stats */}
          {summary && (
            <div className="hidden md:flex items-center space-x-4 text-xs font-sans text-zinc-400">
              <div>
                <span className="text-zinc-500">Active Agents: </span>
                <span className="text-emerald-400 font-medium">{summary.active_agent_count}</span>
              </div>
              <span className="text-zinc-700">•</span>
              <div>
                <span className="text-zinc-500">Boards: </span>
                <span className="text-zinc-200 font-medium">{summary.board_count}</span>
              </div>
              <span className="text-zinc-700">•</span>
              <div>
                <span className="text-zinc-500">Total Cards: </span>
                <span className="text-cyan-400 font-medium">{summary.card_count}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
