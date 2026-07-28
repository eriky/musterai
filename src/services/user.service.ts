// File: src/services/user.service.ts
//
// Human user accounts and OIDC identity binding for MUS-25.
// A user is matched on (provider, sub) — never on email, which is mutable
// and can be reassigned by the identity provider. See design doc §7.1.

import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';

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
}
