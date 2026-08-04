import React, { useState } from 'react';
import { User, Role, Agent, AuthMe } from '../../types.js';
import { api, ApiError } from '../../api.js';
import { Users, Trash2, Bot } from 'lucide-react';
import { PrincipalChip } from '../PrincipalChip.js';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

interface MembersPanelProps {
  workspaceId: string;
  users: User[];
  roles: Role[];
  agents: Agent[];
  currentUser: AuthMe['user'] | null;
  authMode?: AuthMe['auth_mode'] | null;
  onChange: () => void;
  onError: (msg: string) => void;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  workspaceId,
  users,
  roles,
  agents,
  currentUser,
  authMode,
  onChange,
  onError,
}) => {
  const [savingId, setSavingId] = useState<string | null>(null);

  const agentCountFor = (userId: string) => agents.filter((a) => a.operator_user_id === userId).length;

  const handleRoleChange = async (userId: string, roleId: string) => {
    setSavingId(userId);
    try {
      await api.changeMemberRole(workspaceId, userId, roleId);
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to change role');
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (user: User) => {
    if (!confirm(`Remove ${user.display_name} from the workspace? Any agents they operate become unassigned, not deleted.`)) return;
    try {
      await api.removeMember(workspaceId, user.id);
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-16 bg-muster-surface rounded-lg tactical-border">
        <Users className="w-12 h-12 muster-text-faint mx-auto mb-3" />
        <h3 className="text-sm font-sans muster-text-secondary font-semibold">No Members Yet</h3>
        <p className="text-xs font-sans text-neutral-500 max-w-sm mx-auto mt-1">
          {authMode === 'open'
            ? 'Click "Who are you?" in the top bar to claim your name — everyone reaching this instance can do the same for themselves.'
            : 'Invite a teammate from the Invitations tab, or sign in via OIDC to become the first member.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <table className="w-full text-xs font-sans border-collapse">
        <thead>
          <tr className="border-b border-muster-border muster-text-muted uppercase text-[10px] tracking-wide">
            <th className="text-left py-2 pr-4 font-semibold">Member</th>
            <th className="text-left py-2 pr-4 font-semibold">Role</th>
            <th className="text-left py-2 pr-4 font-semibold">Agents Operated</th>
            <th className="text-left py-2 pr-4 font-semibold">Joined</th>
            <th className="text-right py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-muster-border/60">
              <td className="py-2.5 pr-4">
                <PrincipalChip name={u.display_name} kind="user" />
                {u.id === currentUser?.id && <span className="ml-1.5 muster-text-muted text-[10px]">(you)</span>}
                {u.email && <div className="text-[10px] muster-text-muted mt-0.5 ml-0.5">{u.email}</div>}
              </td>
              <td className="py-2.5 pr-4">
                <select
                  value={u.role_id}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  disabled={savingId === u.id}
                  className="muster-input text-xs py-1 cursor-pointer"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2.5 pr-4 muster-text-secondary">
                {agentCountFor(u.id) > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Bot className="w-3 h-3" /> {agentCountFor(u.id)}
                  </span>
                ) : (
                  <span className="muster-text-muted">—</span>
                )}
              </td>
              <td className="py-2.5 pr-4 muster-text-muted">{formatDate(u.joined_at)}</td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => handleRemove(u)}
                  title="Remove from workspace"
                  className="muster-btn muster-btn-icon muster-btn-ghost-danger"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
