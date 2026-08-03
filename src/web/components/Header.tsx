import React, { useState } from 'react';
import { Project, ProjectSummary, AuthMe } from '../types.js';
import { Bot, Layout, FileText, Activity, Plus, FolderPlus, Layers, Database, UserPlus, Trash2, Edit2, KeyRound, ShieldCheck, UserCircle } from 'lucide-react';
import { ThemePicker } from './ThemePicker.js';
import { PrincipalChip } from './PrincipalChip.js';
import { NotificationCenter } from './NotificationCenter.js';
import { NotificationPrefs } from '../notifications.js';

type TabId = 'agents' | 'board' | 'docs' | 'activity' | 'kb' | 'tokens' | 'admin';

interface HeaderProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenEditProject?: () => void;
  summary: ProjectSummary | null;
  activeBoardNotDoneCount?: number | null;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenNewProject: () => void;
  onOpenNewBoard: () => void;
  onOpenRegisterAgent: () => void;
  onOpenNewCard: () => void;
  onOpenNewDoc: () => void;
  currentUser?: AuthMe['user'] | null;
  attentionCount: number;
  notificationPermission: NotificationPermission | 'unsupported';
  notificationPrefs: NotificationPrefs;
  onUpdateNotificationPrefs: (prefs: NotificationPrefs) => void;
  onRequestNotificationPermission: () => void;
  authMode?: AuthMe['auth_mode'] | null;
  onSetLocalIdentity?: (displayName: string) => Promise<void>;
}

/** Open-mode-only "who are you" control — sits where a signed-in user's chip would go. */
const IdentityPicker: React.FC<{ onSubmit: (displayName: string) => Promise<void> }> = ({ onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="muster-btn muster-btn-ghost font-mono text-xs"
        title="Set your name so comments and assignments show who you are"
      >
        <UserCircle className="w-3.5 h-3.5 muster-accent" /> Who are you?
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        try {
          await onSubmit(trimmed);
          setOpen(false);
        } finally {
          setSaving(false);
        }
      }}
      className="flex items-center space-x-1.5"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoFocus
        className="muster-input text-xs py-1 px-2 w-36"
      />
      <button
        type="submit"
        disabled={!name.trim() || saving}
        className="muster-btn muster-btn-primary text-xs py-1 px-2"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="muster-btn muster-btn-ghost text-xs py-1 px-2"
      >
        Cancel
      </button>
    </form>
  );
};

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
  activeBoardNotDoneCount,
  activeTab,
  onSelectTab,
  onOpenNewProject,
  onOpenNewBoard,
  onOpenRegisterAgent,
  onOpenNewCard,
  onOpenNewDoc,
  currentUser,
  attentionCount,
  notificationPermission,
  notificationPrefs,
  onUpdateNotificationPrefs,
  onRequestNotificationPermission,
  authMode,
  onSetLocalIdentity,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const kanbanCount = activeBoardNotDoneCount !== undefined && activeBoardNotDoneCount !== null
    ? activeBoardNotDoneCount
    : summary?.not_done_card_count ?? summary?.card_count;

  const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
    { id: 'agents', icon: Bot, label: `Agents ${summary ? `(${summary.active_agent_count}/${summary.agent_count})` : ''}` },
    { id: 'board', icon: Layout, label: `Kanban Board ${kanbanCount !== undefined ? `(${kanbanCount})` : ''}` },
    { id: 'docs', icon: FileText, label: `Design Documents ${summary ? `(${summary.document_count})` : ''}` },
    { id: 'kb', icon: Database, label: 'Knowledge Base' },
    { id: 'activity', icon: Activity, label: 'Activity Log' },
    { id: 'tokens', icon: KeyRound, label: 'Tokens' },
    { id: 'admin', icon: ShieldCheck, label: 'Admin' },
  ];

  return (
    <header className="bg-muster-surface border-b border-muster-border sticky top-0 z-40 backdrop-blur-md w-full">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-2">

          {/* Left Side: Brand & Selectors */}
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">

            {/* Logo */}
            <div className="flex items-center space-x-2 shrink-0">
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

            {/* Signed-in user — read-only, derived from the session, never picked. */}
            <div className="flex items-center space-x-2">
              {currentUser ? (
                <>
                  <PrincipalChip name={currentUser.display_name} kind="user" />
                  <Divider />
                </>
              ) : authMode === 'open' && onSetLocalIdentity ? (
                <>
                  <IdentityPicker onSubmit={onSetLocalIdentity} />
                  <Divider />
                </>
              ) : null}
            </div>

            {/* Project Selector Dropdown */}
            <div className="flex items-center space-x-1 min-w-0">
              <select
                value={selectedProjectId || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="muster-input max-w-[140px] sm:max-w-[220px] font-mono cursor-pointer truncate text-xs sm:text-sm py-1.5 px-2"
                aria-label="Select active project"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-muster-surface muster-text-primary">
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Desktop Project Actions */}
              <div className="hidden lg:flex items-center space-x-1">
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
                  className="muster-btn muster-btn-soft font-mono text-xs"
                  title="Create New Project"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> + Project
                </button>
              </div>
            </div>

            <div className="hidden lg:block">
              <Divider />
            </div>

            {/* Desktop Entity Creation Buttons */}
            <div className="hidden lg:flex items-center space-x-2">
              <button onClick={onOpenNewBoard} className="muster-btn muster-btn-secondary font-mono text-xs">
                <Layers className="w-3.5 h-3.5 muster-accent" /> + Board
              </button>

              <button onClick={onOpenRegisterAgent} className="muster-btn muster-btn-secondary font-mono text-xs">
                <UserPlus className="w-3.5 h-3.5 muster-accent" /> + Agent
              </button>

              <button onClick={onOpenNewCard} className="muster-btn muster-btn-secondary font-mono text-xs">
                <Plus className="w-3.5 h-3.5 muster-accent" /> + Card
              </button>

              <button onClick={onOpenNewDoc} className="muster-btn muster-btn-secondary font-mono text-xs">
                <FileText className="w-3.5 h-3.5 muster-accent" /> + Doc
              </button>
            </div>

          </div>

          {/* Right Side: Quick Actions on Mobile, Notifications & Theme Picker */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Mobile Actions Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden muster-btn muster-btn-soft p-1.5 text-xs font-mono flex items-center gap-1"
              title="Quick Actions"
              aria-label="Toggle mobile actions menu"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Actions</span>
            </button>

            <NotificationCenter
              attentionCount={attentionCount}
              permission={notificationPermission}
              prefs={notificationPrefs}
              onUpdatePrefs={onUpdateNotificationPrefs}
              onRequestPermission={onRequestNotificationPermission}
            />
            <ThemePicker />
          </div>

        </div>

        {/* Mobile Actions Drawer / Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-muster-border/60 py-3 grid grid-cols-2 gap-2 bg-muster-surface/95 backdrop-blur-md">
            <button
              onClick={() => { onOpenNewCard(); setMobileMenuOpen(false); }}
              className="muster-btn muster-btn-primary font-mono text-xs justify-start py-2"
            >
              <Plus className="w-3.5 h-3.5" /> + New Card
            </button>
            <button
              onClick={() => { onOpenNewDoc(); setMobileMenuOpen(false); }}
              className="muster-btn muster-btn-secondary font-mono text-xs justify-start py-2"
            >
              <FileText className="w-3.5 h-3.5 muster-accent" /> + New Doc
            </button>
            <button
              onClick={() => { onOpenNewBoard(); setMobileMenuOpen(false); }}
              className="muster-btn muster-btn-secondary font-mono text-xs justify-start py-2"
            >
              <Layers className="w-3.5 h-3.5 muster-accent" /> + New Board
            </button>
            <button
              onClick={() => { onOpenRegisterAgent(); setMobileMenuOpen(false); }}
              className="muster-btn muster-btn-secondary font-mono text-xs justify-start py-2"
            >
              <UserPlus className="w-3.5 h-3.5 muster-accent" /> + Register Agent
            </button>
            <button
              onClick={() => { onOpenNewProject(); setMobileMenuOpen(false); }}
              className="muster-btn muster-btn-soft font-mono text-xs justify-start py-2"
            >
              <FolderPlus className="w-3.5 h-3.5" /> + New Project
            </button>
            {selectedProjectId && projects.length > 0 && onOpenEditProject && (
              <button
                onClick={() => { onOpenEditProject(); setMobileMenuOpen(false); }}
                className="muster-btn muster-btn-ghost font-mono text-xs justify-start py-2"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Project
              </button>
            )}
          </div>
        )}

        {/* Sub-Navigation & Summary Telemetry */}
        <div className="flex items-center justify-between border-t border-muster-border/60 py-1.5 overflow-hidden">
          <nav className="flex space-x-1.5 overflow-x-auto no-scrollbar snap-x py-0.5 w-full md:w-auto">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => onSelectTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium muster-tab shrink-0 snap-start whitespace-nowrap ${
                  activeTab === id ? 'muster-tab-active' : ''
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Summary telemetry */}
          {summary && (
            <div className="hidden md:flex items-center gap-3 text-xs font-sans shrink-0 pl-3">
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
