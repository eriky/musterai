// File: tests/invitation.test.ts
//
// MUS-25 acceptance criteria:
// - an invitation is single-use and cannot be replayed after acceptance
// - a revoked invitation can never be accepted

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { InvitationService } from '../src/services/invitation.service.js';
import { RoleService } from '../src/services/role.service.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test-invitation.db');

describe('MUS-25: InvitationService', () => {
  let db: DatabaseAdapter;
  let invitationService: InvitationService;
  let roleService: RoleService;
  let workspaceId: string;
  let roleId: string;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = createDatabaseAdapter(TEST_DB);
    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    invitationService = new InvitationService(db);
    roleService = new RoleService(db);

    workspaceId = 'test-ws-invite-01';
    const now = new Date().toISOString();
    await db.execute('INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'Invite Test WS', 'invite-test', now, now]);
    await roleService.seedPreset(workspaceId);
    const role = await roleService.getByKey(workspaceId, 'junior_engineer');
    roleId = role!.id;
  });

  afterEach(async () => {
    if (db) await db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(TEST_DB + suffix); } catch { /* ok */ }
    }
  });

  async function makeUser(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', [id, 'user', now]);
    await db.execute('INSERT INTO app_user (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, `${id}@example.com`, id, 'active', now]);
  }

  it('creates an invitation and finds it as pending by email', async () => {
    await invitationService.create({ workspace_id: workspaceId, email: 'new@example.com', role_id: roleId });
    const pending = await invitationService.findPendingByEmail(workspaceId, 'new@example.com');
    expect(pending).not.toBeNull();
    expect(pending!.email).toBe('new@example.com');
  });

  it('is case-insensitive on email matching', async () => {
    await invitationService.create({ workspace_id: workspaceId, email: 'New@Example.com', role_id: roleId });
    const pending = await invitationService.findPendingByEmail(workspaceId, 'new@example.com');
    expect(pending).not.toBeNull();
  });

  it('accepts an invitation exactly once — a second accept is refused', async () => {
    const invite = await invitationService.create({ workspace_id: workspaceId, email: 'once@example.com', role_id: roleId });
    await makeUser('user-once');

    await invitationService.accept(invite.id, 'user-once');

    const members = await db.query<any>('SELECT * FROM workspace_member WHERE workspace_id = ? AND user_id = ?', [workspaceId, 'user-once']);
    expect(members.length).toBe(1);

    await makeUser('user-once-again');
    await expect(invitationService.accept(invite.id, 'user-once-again')).rejects.toThrow(/already been accepted/i);
  });

  it('an accepted invitation no longer appears as pending', async () => {
    const invite = await invitationService.create({ workspace_id: workspaceId, email: 'accepted@example.com', role_id: roleId });
    await makeUser('user-accepted');
    await invitationService.accept(invite.id, 'user-accepted');

    const pending = await invitationService.findPendingByEmail(workspaceId, 'accepted@example.com');
    expect(pending).toBeNull();
  });

  it('refuses to accept an expired invitation', async () => {
    const invite = await invitationService.create({
      workspace_id: workspaceId, email: 'expired@example.com', role_id: roleId, ttlMs: -1000,
    });
    await makeUser('user-expired');
    await expect(invitationService.accept(invite.id, 'user-expired')).rejects.toThrow(/expired/i);
  });

  it('a revoked invitation can never be accepted', async () => {
    const invite = await invitationService.create({ workspace_id: workspaceId, email: 'revoked@example.com', role_id: roleId });
    await invitationService.revoke(invite.id);

    await makeUser('user-revoked');
    await expect(invitationService.accept(invite.id, 'user-revoked')).rejects.toThrow(/not found/i);

    const pending = await invitationService.findPendingByEmail(workspaceId, 'revoked@example.com');
    expect(pending).toBeNull();
  });

  it('list never exposes the token hash', async () => {
    await invitationService.create({ workspace_id: workspaceId, email: 'list@example.com', role_id: roleId });
    const listed = await invitationService.list(workspaceId);
    expect(listed.length).toBe(1);
    expect((listed[0] as any).token_hash).toBeUndefined();
  });
});
