import React, { useState, useEffect } from 'react';
import { AuthMe } from '../types.js';
import { ThemePicker } from './ThemePicker.js';
import { TokensView } from './TokensView.js';
import { WorkspaceAdmin } from './WorkspaceAdmin.js';
import { PrincipalChip } from './PrincipalChip.js';
import { X, User, Palette, KeyRound, ShieldCheck, UserCircle } from 'lucide-react';

type AccountTab = 'appearance' | 'tokens' | 'admin' | 'profile';

interface UserAccountModalProps {
  currentUser: AuthMe['user'] | null;
  workspaceId: string | null;
  authMode?: AuthMe['auth_mode'] | null;
  onClose: () => void;
  onSetLocalIdentity?: (displayName: string) => Promise<void>;
  initialTab?: AccountTab;
}

export const UserAccountModal: React.FC<UserAccountModalProps> = ({
  currentUser,
  workspaceId,
  authMode,
  onClose,
  onSetLocalIdentity,
  initialTab = 'appearance',
}) => {
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [name, setName] = useState(currentUser?.display_name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const displayName = currentUser?.display_name || 'Operator';

  return (
    <div className="muster-scrim" onClick={onClose}>
      <div
        className="muster-dialog w-full max-w-3xl max-h-[85vh] flex flex-col font-sans overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-muster-border flex items-center justify-between bg-muster-surface">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 muster-accent" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold muster-text-primary">{displayName}</h2>
                <PrincipalChip name={displayName} kind="user" />
              </div>
              <p className="text-[11px] muster-text-muted">Account Preferences & Workspace Settings</p>
            </div>
          </div>

          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-muster-border/80 px-4 bg-muster-surface/60 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-2 text-xs font-medium border-b-2 inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'border-brand-500 muster-accent font-semibold'
                : 'border-transparent muster-text-muted hover:muster-text-primary'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance & Theme</span>
          </button>

          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-3 py-2 text-xs font-medium border-b-2 inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
              activeTab === 'tokens'
                ? 'border-brand-500 muster-accent font-semibold'
                : 'border-transparent muster-text-muted hover:muster-text-primary'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>API Tokens</span>
          </button>

          {workspaceId && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 text-xs font-medium border-b-2 inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'border-brand-500 muster-accent font-semibold'
                  : 'border-transparent muster-text-muted hover:muster-text-primary'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Workspace Admin</span>
            </button>
          )}

          {authMode === 'open' && onSetLocalIdentity && (
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-2 text-xs font-medium border-b-2 inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-brand-500 muster-accent font-semibold'
                  : 'border-transparent muster-text-muted hover:muster-text-primary'
              }`}
            >
              <UserCircle className="w-3.5 h-3.5" />
              <span>Identity Profile</span>
            </button>
          )}
        </div>

        {/* Tab Body Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'appearance' && (
            <ThemePicker />
          )}

          {activeTab === 'tokens' && (
            <TokensView />
          )}

          {activeTab === 'admin' && workspaceId && (
            <WorkspaceAdmin workspaceId={workspaceId} currentUser={currentUser} authMode={authMode} />
          )}

          {activeTab === 'profile' && authMode === 'open' && onSetLocalIdentity && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = name.trim();
                if (!trimmed || saving) return;
                setSaving(true);
                try {
                  await onSetLocalIdentity(trimmed);
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
              className="space-y-3 max-w-sm"
            >
              <div>
                <label className="muster-label">Local Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  className="muster-input muster-input-lg"
                />
              </div>
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="muster-btn muster-btn-primary"
              >
                {saving ? 'Saving…' : 'Save Name'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
