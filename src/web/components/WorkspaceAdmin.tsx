// File: src/web/components/WorkspaceAdmin.tsx
//
// Workspace admin UI (MUS-26): members, roles, and invitations. The
// operational "Agents" roster (grouped by operator, liveness) lives in
// AgentGrid.tsx — this surface answers "who is on this team and what may
// they do?", never renders liveness, and is where role/membership changes
// actually happen. See design doc §6, §12 and DESIGN_LANGUAGE.md.

import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, Invitation, Agent, AuthMe } from '../types.js';
import { api, ApiError } from '../api.js';
import { ALL_PERMISSIONS, Permission } from '../../shared/permissions.js';
import {
  Users, ShieldCheck, Mail, Trash2, Plus, X, Copy, Check,
  Bot, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import { PrincipalChip } from './PrincipalChip.js';

type AdminTab = 'members' | 'roles' | 'invitations';

interface WorkspaceAdminProps {
  workspaceId: string;
  currentUser: AuthMe['user'] | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export const WorkspaceAdmin: React.FC<WorkspaceAdminProps> = ({ workspaceId, currentUser }) => {
  const [tab, setTab] = useState<AdminTab>('members');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [usersData, rolesData, agentsData, invitationsData] = await Promise.all([
        api.getUsers(),
        api.getRoles(workspaceId),
        api.getAgents(),
        api.getInvitations(workspaceId),
      ]);
      setUsers(usersData);
      setRoles(rolesData.sort((a, b) => b.rank - a.rank));
      setAgents(agentsData);
      setInvitations(invitationsData);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load workspace admin data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const roleById = new Map(roles.map(r => [r.id, r]));

  const tabs: { id: AdminTab; icon: React.ElementType; label: string }[] = [
    { id: 'members', icon: Users, label: `Members (${users.length})` },
    { id: 'roles', icon: ShieldCheck, label: `Roles (${roles.length})` },
    { id: 'invitations', icon: Mail, label: `Invitations (${invitations.filter(i => !i.accepted_at).length})` },
  ];

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-4">
      <div className="flex-none flex items-center justify-between border-b border-muster-border pb-4">
        <div>
          <h2 className="text-lg font-sans font-bold muster-text-primary flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 muster-accent" />
            Workspace Admin
          </h2>
          <p className="text-xs font-sans muster-text-muted mt-0.5">
            Who is on this team, what they may do, and who is waiting to join
          </p>
        </div>
      </div>

      <div className="flex-none flex space-x-1">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium muster-tab ${tab === id ? 'muster-tab-active' : ''}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="muster-badge muster-badge-danger w-fit">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 muster-text-muted text-sm">Loading…</div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {tab === 'members' && (
            <MembersPanel
              workspaceId={workspaceId}
              users={users}
              roles={roles}
              agents={agents}
              currentUser={currentUser}
              onChange={loadAll}
              onError={setError}
            />
          )}
          {tab === 'roles' && (
            <RolesPanel
              workspaceId={workspaceId}
              roles={roles}
              users={users}
              agents={agents}
              onChange={loadAll}
              onError={setError}
            />
          )}
          {tab === 'invitations' && (
            <InvitationsPanel
              workspaceId={workspaceId}
              roles={roles}
              invitations={invitations}
              onChange={loadAll}
              onError={setError}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Members ────────────────────────────────────────────────────────────────

const MembersPanel: React.FC<{
  workspaceId: string;
  users: User[];
  roles: Role[];
  agents: Agent[];
  currentUser: AuthMe['user'] | null;
  onChange: () => void;
  onError: (msg: string) => void;
}> = ({ workspaceId, users, roles, agents, currentUser, onChange, onError }) => {
  const [savingId, setSavingId] = useState<string | null>(null);

  const agentCountFor = (userId: string) => agents.filter(a => a.operator_user_id === userId).length;

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
          Invite a teammate from the Invitations tab, or sign in via OIDC to become the first member.
        </p>
      </div>
    );
  }

  return (
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
                className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1 cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </td>
            <td className="py-2.5 pr-4 muster-text-secondary">
              {agentCountFor(u.id) > 0 ? (
                <span className="inline-flex items-center gap-1"><Bot className="w-3 h-3" /> {agentCountFor(u.id)}</span>
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
  );
};

// ─── Roles ──────────────────────────────────────────────────────────────────

/** Group the flat permission catalog by its verb's noun prefix, so the matrix reads in sections instead of one 26-row wall. */
function groupPermissions(perms: readonly Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>();
  for (const p of perms) {
    const group = p.split('.')[0];
    const list = groups.get(group) || [];
    list.push(p);
    groups.set(group, list);
  }
  return Array.from(groups.entries());
}

const RolesPanel: React.FC<{
  workspaceId: string;
  roles: Role[];
  users: User[];
  agents: Agent[];
  onChange: () => void;
  onError: (msg: string) => void;
}> = ({ workspaceId, roles, users, agents, onChange, onError }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(groupPermissions(ALL_PERMISSIONS).map(([g]) => g)));
  const [showNewRole, setShowNewRole] = useState(false);

  const holderCounts = (roleId: string) => ({
    members: users.filter(u => u.role_id === roleId).length,
    agents: agents.filter(a => a.role_id === roleId).length,
  });

  const toggleGroup = (group: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const handleTogglePermission = async (role: Role, permission: string, checked: boolean) => {
    if (role.is_system) return;
    const nextPermissions = checked
      ? [...role.permissions, permission]
      : role.permissions.filter(p => p !== permission);
    try {
      await api.updateRole(role.id, { permissions: nextPermissions });
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  };

  const handleClone = async (role: Role) => {
    const newKey = prompt(`Key for the cloned role (lowercase, no spaces):`, `${role.key}_custom`);
    if (!newKey) return;
    try {
      await api.cloneRole(role.id, newKey, `${role.name} (custom)`);
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to clone role');
    }
  };

  const handleDelete = async (role: Role) => {
    const counts = holderCounts(role.id);
    if (counts.members + counts.agents > 0) {
      alert(`Cannot delete "${role.name}" — it is held by ${counts.members} member(s) and ${counts.agents} agent(s). Reassign them first.`);
      return;
    }
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteRole(role.id);
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to delete role');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNewRole(true)} className="muster-btn muster-btn-primary">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Role
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs font-sans border-collapse min-w-full">
          <thead>
            <tr className="border-b border-muster-border muster-text-muted uppercase text-[10px] tracking-wide">
              <th className="text-left py-2 pr-4 font-semibold sticky left-0 bg-muster-base">Permission</th>
              {roles.map((r) => {
                const counts = holderCounts(r.id);
                return (
                  <th key={r.id} className="text-center py-2 px-2 font-semibold whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="muster-text-primary normal-case font-bold">{r.name}</span>
                      {r.is_system ? (
                        <span className="muster-badge muster-badge-neutral text-[9px]">system</span>
                      ) : (
                        <span className="muster-badge muster-badge-info text-[9px]">custom</span>
                      )}
                      <span className="text-[9px] font-normal normal-case">{counts.members}m · {counts.agents}a</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleClone(r)} className="muster-btn muster-btn-icon muster-btn-ghost" title={`Clone ${r.name}`}>
                          <Copy className="w-3 h-3" />
                        </button>
                        {!r.is_system && (
                          <button onClick={() => handleDelete(r)} className="muster-btn muster-btn-icon muster-btn-ghost-danger" title={`Delete ${r.name}`}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groupPermissions(ALL_PERMISSIONS).map(([group, perms]) => (
              <React.Fragment key={group}>
                <tr className="border-b border-muster-border/60 bg-muster-surface/60">
                  <td colSpan={roles.length + 1} className="py-1.5 pr-4 sticky left-0">
                    <button
                      onClick={() => toggleGroup(group)}
                      className="flex items-center gap-1 muster-text-secondary font-semibold uppercase text-[10px] tracking-wide"
                    >
                      {expanded.has(group) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {group}
                    </button>
                  </td>
                </tr>
                {expanded.has(group) && perms.map((perm) => (
                  <tr key={perm} className="border-b border-muster-border/40">
                    <td className="py-1.5 pr-4 font-mono muster-text-muted sticky left-0 bg-muster-base whitespace-nowrap">{perm}</td>
                    {roles.map((r) => (
                      <td key={r.id} className="text-center py-1.5 px-2">
                        <input
                          type="checkbox"
                          checked={r.permissions.includes(perm)}
                          disabled={!!r.is_system}
                          onChange={(e) => handleTogglePermission(r, perm, e.target.checked)}
                          className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`${perm} for ${r.name}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showNewRole && (
        <NewRoleModal
          workspaceId={workspaceId}
          onClose={() => setShowNewRole(false)}
          onSuccess={() => { setShowNewRole(false); onChange(); }}
          onError={onError}
        />
      )}
    </div>
  );
};

const NewRoleModal: React.FC<{
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}> = ({ workspaceId, onClose, onSuccess, onError }) => {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const togglePerm = (p: string) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !name.trim()) return;
    setSubmitting(true);
    try {
      await api.createRole(workspaceId, { key: key.trim(), name: name.trim(), permissions: Array.from(permissions) });
      onSuccess();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-base font-bold muster-text-primary uppercase tracking-wide">New Role</h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="muster-label uppercase">Key</label>
              <input required value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. sre" className="muster-input font-mono" />
            </div>
            <div>
              <label className="muster-label uppercase">Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SRE" className="muster-input" />
            </div>
          </div>
          <div>
            <label className="muster-label uppercase">Permissions</label>
            <div className="max-h-64 overflow-y-auto space-y-2 mt-1 border border-muster-border rounded-md p-3">
              {groupPermissions(ALL_PERMISSIONS).map(([group, perms]) => (
                <div key={group}>
                  <div className="text-[10px] font-semibold uppercase muster-text-muted mb-1">{group}</div>
                  <div className="grid grid-cols-2 gap-1">
                    {perms.map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-[11px] font-mono muster-text-secondary cursor-pointer">
                        <input type="checkbox" checked={permissions.has(p)} onChange={() => togglePerm(p)} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">You can only grant permissions your own role already holds.</p>
          </div>
          <div className="flex justify-end space-x-3 pt-3 border-t border-muster-border">
            <button type="button" onClick={onClose} className="muster-btn muster-btn-lg muster-btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="muster-btn muster-btn-lg muster-btn-primary">
              {submitting ? 'Creating…' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Invitations ────────────────────────────────────────────────────────────

const InvitationsPanel: React.FC<{
  workspaceId: string;
  roles: Role[];
  invitations: Invitation[];
  onChange: () => void;
  onError: (msg: string) => void;
}> = ({ workspaceId, roles, invitations, onChange, onError }) => {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const roleName = (id: string) => roles.find(r => r.id === id)?.name || id;
  const signInUrl = `${window.location.origin}/`;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !roleId) return;
    setSubmitting(true);
    try {
      await api.createInvitation(workspaceId, email.trim(), roleId);
      setInvited(email.trim());
      setEmail('');
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to create invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    if (!confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    try {
      await api.revokeInvitation(invitation.id);
      onChange();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to revoke invitation');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signInUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the URL is still selectable text.
    }
  };

  const isExpired = (i: Invitation) => new Date(i.expires_at) <= new Date();

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="flex items-end gap-2 bg-muster-surface p-3 rounded-lg tactical-border">
        <div className="flex-1">
          <label className="muster-label uppercase">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className="muster-input" />
        </div>
        <div>
          <label className="muster-label uppercase">Role</label>
          <select required value={roleId} onChange={(e) => setRoleId(e.target.value)} className="muster-input font-mono cursor-pointer">
            <option value="">Select role…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={submitting} className="muster-btn muster-btn-primary">
          <Mail className="w-3.5 h-3.5 mr-1.5" /> Invite
        </button>
      </form>

      {invitations.length === 0 ? (
        <div className="text-center py-16 bg-muster-surface rounded-lg tactical-border">
          <Mail className="w-12 h-12 muster-text-faint mx-auto mb-3" />
          <h3 className="text-sm font-sans muster-text-secondary font-semibold">No Invitations Yet</h3>
        </div>
      ) : (
        <table className="w-full text-xs font-sans border-collapse">
          <thead>
            <tr className="border-b border-muster-border muster-text-muted uppercase text-[10px] tracking-wide">
              <th className="text-left py-2 pr-4 font-semibold">Email</th>
              <th className="text-left py-2 pr-4 font-semibold">Role</th>
              <th className="text-left py-2 pr-4 font-semibold">Expires</th>
              <th className="text-left py-2 pr-4 font-semibold">Status</th>
              <th className="text-right py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((i) => (
              <tr key={i.id} className="border-b border-muster-border/60">
                <td className="py-2.5 pr-4 muster-text-primary font-medium">{i.email}</td>
                <td className="py-2.5 pr-4 muster-text-secondary">{roleName(i.role_id)}</td>
                <td className="py-2.5 pr-4 muster-text-muted">{formatDate(i.expires_at)}</td>
                <td className="py-2.5 pr-4">
                  {i.accepted_at ? (
                    <span className="muster-badge muster-badge-success">Accepted</span>
                  ) : isExpired(i) ? (
                    <span className="muster-badge muster-badge-neutral">Expired</span>
                  ) : (
                    <span className="muster-badge muster-badge-warning">Pending</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  {!i.accepted_at && (
                    <button onClick={() => handleRevoke(i)} title="Revoke invitation" className="muster-btn muster-btn-icon muster-btn-ghost-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {invited && (
        <div className="muster-scrim">
          <div className="muster-dialog w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-muster-border pb-3">
              <Mail className="w-5 h-5 muster-text-warning" />
              <h3 className="text-base font-bold muster-text-primary uppercase tracking-wide">Invitation Created</h3>
            </div>
            <p className="text-xs muster-text-muted">
              No email is sent yet — tell <span className="font-semibold muster-text-primary">{invited}</span> to sign in
              at the URL below with an identity provider account using that exact email address. They are admitted
              automatically on their first login; no separate link or code is needed.
            </p>
            <div className="flex items-center gap-2 bg-muster-base border border-muster-border rounded-md px-3 py-2">
              <code className="flex-1 font-mono text-xs muster-text-primary break-all select-all">{signInUrl}</code>
              <button onClick={handleCopy} className="muster-btn muster-btn-icon muster-btn-ghost" title="Copy to clipboard">
                {copied ? <Check className="w-4 h-4 muster-text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end pt-3 border-t border-muster-border">
              <button onClick={() => { setInvited(null); setCopied(false); }} className="muster-btn muster-btn-lg muster-btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
