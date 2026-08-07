// File: src/services/user.service.ts
//
// Human user accounts and OIDC identity binding for MUS-25.
// A user is matched on (provider, sub) — never on email, which is mutable
// and can be reassigned by the identity provider. See design doc §7.1.

import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { ValidationError } from '../shared/errors.js';

export interface AppUser {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  status: 'active' | 'idle' | 'offline';
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role_id: string;
  role_name: string;
  joined_at: string;
}

export class UserService {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Resolve a user from an OIDC (provider, sub) pair, creating both the
   * identity link and the app_user on first sign-in. The identity's stored
   * email is refreshed on every login so a provider-side email change is
   * reflected, but the match is always on (provider, sub) — never on email.
   */
  async findOrCreateBySubject(
    provider: string,
    subject: string,
    email: string | null,
    displayName?: string | null,
  ): Promise<{ user: AppUser; isNewUser: boolean }> {
    const existing = await this.db.query<any>(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, u.status, u.created_at
       FROM identity i JOIN app_user u ON u.id = i.user_id
       WHERE i.provider = ? AND i.subject = ?`,
      [provider, subject],
    );

    if (existing.length > 0) {
      if (email) {
        await this.db.execute('UPDATE identity SET email = ? WHERE provider = ? AND subject = ?', [email, provider, subject]);
        await this.db.execute('UPDATE app_user SET email = ? WHERE id = ?', [email, existing[0].id]);
      }
      return { user: { ...existing[0], email: email || existing[0].email }, isNewUser: false };
    }

    const now = new Date().toISOString();
    const userId = ulid();
    const identityId = ulid();

    await this.db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', [userId, 'user', now]);
    await this.db.execute(
      'INSERT INTO app_user (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, email, displayName || email || 'New User', 'active', now],
    );
    await this.db.execute(
      'INSERT INTO identity (id, user_id, provider, subject, email) VALUES (?, ?, ?, ?, ?)',
      [identityId, userId, provider, subject, email],
    );

    return {
      user: { id: userId, email, display_name: displayName || email || 'New User', avatar_url: null, status: 'active', created_at: now },
      isNewUser: true,
    };
  }

  async findById(id: string): Promise<AppUser | null> {
    const rows = await this.db.query<AppUser>(
      'SELECT id, email, display_name, avatar_url, status, created_at FROM app_user WHERE id = ?',
      [id],
    );
    return rows[0] || null;
  }

  async findByDisplayName(displayName: string): Promise<AppUser | null> {
    const rows = await this.db.query<AppUser>(
      'SELECT id, email, display_name, avatar_url, status, created_at FROM app_user WHERE LOWER(display_name) = LOWER(?) LIMIT 1',
      [displayName.trim()],
    );
    return rows[0] || null;
  }

  /**
   * Create a human principal directly, with no OIDC identity behind it —
   * the open-mode "who are you" self-service flow. Only ever called when
   * config.auth.mode === 'open': every request there already carries full
   * trust, so this just gives that trust a name and a real app_user row
   * (so the person shows up in Members, can be @assigned, etc.) instead of
   * leaving them unable to appear as anyone at all.
   */
  async createLocalUser(displayName: string): Promise<AppUser> {
    const now = new Date().toISOString();
    const userId = ulid();

    await this.db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', [userId, 'user', now]);
    await this.db.execute(
      'INSERT INTO app_user (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, null, displayName, 'active', now],
    );

    return { id: userId, email: null, display_name: displayName, avatar_url: null, status: 'active', created_at: now };
  }

  async isWorkspaceEmpty(workspaceId: string): Promise<boolean> {
    const rows = await this.db.query<any>('SELECT 1 FROM workspace_member WHERE workspace_id = ? LIMIT 1', [workspaceId]);
    return rows.length === 0;
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const rows = await this.db.query<any>(
      'SELECT 1 FROM workspace_member WHERE workspace_id = ? AND user_id = ? LIMIT 1',
      [workspaceId, userId],
    );
    return rows.length > 0;
  }

  async addWorkspaceMember(workspaceId: string, userId: string, roleId: string, invitedBy?: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      'INSERT INTO workspace_member (workspace_id, user_id, role_id, joined_at, invited_by) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, userId, roleId, now, invitedBy || null],
    );
  }

  /**
   * List the human members of a workspace — the "Members" surface (MUS-26)
   * and the agent roster's operator lookup (MUS-32) both read this. No
   * liveness/status column: that telemetry is agent-only, see design §4.1.
   */
  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.db.query<WorkspaceMember>(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, wm.role_id, r.name as role_name, wm.joined_at
       FROM workspace_member wm
       JOIN app_user u ON u.id = wm.user_id
       JOIN role r ON r.id = wm.role_id
       WHERE wm.workspace_id = ?
       ORDER BY u.display_name ASC`,
      [workspaceId],
    );
  }

  /**
   * Number of members currently holding a role that grants workspace.admin —
   * the "owner" rank, regardless of whether that role is still named/keyed
   * "owner" after editing. Used to refuse leaving a workspace ownerless.
   */
  async countAdmins(workspaceId: string): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM workspace_member wm
       JOIN role r ON r.id = wm.role_id
       WHERE wm.workspace_id = ? AND r.permissions_json LIKE '%"workspace.admin"%'`,
      [workspaceId],
    );
    return rows[0]?.count ?? 0;
  }

  private async isSoleAdmin(workspaceId: string, userId: string, roleId: string): Promise<boolean> {
    const roleRows = await this.db.query<{ permissions_json: string }>('SELECT permissions_json FROM role WHERE id = ?', [roleId]);
    const permissions: string[] = roleRows[0] ? JSON.parse(roleRows[0].permissions_json) : [];
    if (!permissions.includes('workspace.admin')) return false;
    return (await this.countAdmins(workspaceId)) <= 1;
  }

  /** Change a member's role. Refuses to demote the last remaining admin — a workspace must always keep an owner. */
  async changeMemberRole(workspaceId: string, userId: string, newRoleId: string): Promise<void> {
    const memberRows = await this.db.query<{ role_id: string }>(
      'SELECT role_id FROM workspace_member WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId],
    );
    if (memberRows.length === 0) throw new ValidationError('User is not a member of this workspace');
    const currentRoleId = memberRows[0].role_id;

    if (currentRoleId !== newRoleId && await this.isSoleAdmin(workspaceId, userId, currentRoleId)) {
      throw new ValidationError('Cannot change the role of the last owner — promote another member first');
    }

    await this.db.execute(
      'UPDATE workspace_member SET role_id = ? WHERE workspace_id = ? AND user_id = ?',
      [newRoleId, workspaceId, userId],
    );
  }

  /**
   * Remove a member from the workspace. Refuses to remove the last admin.
   * Agents the member operates are never orphaned silently — they are
   * unassigned (operator_user_id = NULL) and surface in the roster's
   * "Unassigned" group rather than being deleted or left pointing at a
   * principal no longer in the workspace.
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const memberRows = await this.db.query<{ role_id: string }>(
      'SELECT role_id FROM workspace_member WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId],
    );

    const userRows = await this.db.query<{ id: string }>('SELECT id FROM app_user WHERE id = ?', [userId]);

    if (memberRows.length === 0 && userRows.length === 0) {
      throw new ValidationError('User is not a member of this workspace');
    }

    if (memberRows.length > 0 && await this.isSoleAdmin(workspaceId, userId, memberRows[0].role_id)) {
      throw new ValidationError('Cannot remove the last owner — promote another member first');
    }

    await this.db.execute('UPDATE agent SET operator_user_id = NULL WHERE operator_user_id = ?', [userId]);
    await this.db.execute('DELETE FROM workspace_member WHERE workspace_id = ? AND user_id = ?', [workspaceId, userId]);
    await this.db.execute('DELETE FROM session WHERE user_id = ?', [userId]);
    await this.db.execute('DELETE FROM identity WHERE user_id = ?', [userId]);
    await this.db.execute('DELETE FROM device_grant WHERE principal_id = ?', [userId]);
    await this.db.execute('DELETE FROM app_user WHERE id = ?', [userId]);
    await this.db.execute('DELETE FROM principal WHERE id = ?', [userId]);
  }
}
