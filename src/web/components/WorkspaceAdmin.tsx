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
import { Users, ShieldCheck, Mail, AlertCircle, ScrollText } from 'lucide-react';
import { MembersPanel } from './admin/MembersPanel.js';
import { RolesPanel } from './admin/RolesPanel.js';
import { InvitationsPanel } from './admin/InvitationsPanel.js';
import { AuditLogPanel } from './admin/AuditLogPanel.js';

type AdminTab = 'members' | 'roles' | 'invitations' | 'audit';

interface WorkspaceAdminProps {
  workspaceId: string;
  currentUser: AuthMe['user'] | null;
  authMode?: AuthMe['auth_mode'] | null;
}

export const WorkspaceAdmin: React.FC<WorkspaceAdminProps> = ({ workspaceId, currentUser, authMode }) => {
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

  const tabs: { id: AdminTab; icon: React.ElementType; label: string }[] = [
    { id: 'members', icon: Users, label: `Members (${users.length})` },
    { id: 'roles', icon: ShieldCheck, label: `Roles (${roles.length})` },
    { id: 'invitations', icon: Mail, label: `Invitations (${invitations.filter((i) => !i.accepted_at).length})` },
    { id: 'audit', icon: ScrollText, label: 'Audit Log' },
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium muster-tab ${
              tab === id ? 'muster-tab-active' : ''
            }`}
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
              authMode={authMode}
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
          {tab === 'audit' && (
            <AuditLogPanel workspaceId={workspaceId} users={users} agents={agents} onError={setError} />
          )}
        </div>
      )}
    </div>
  );
};
