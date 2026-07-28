// File: tests/user.service.test.ts
//
// MUS-25 acceptance criteria:
// - a second sign-in by the same `sub` with a changed email resolves to the
//   same user, not a new one (match on sub, never on email)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { UserService } from '../src/services/user.service.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test-user-service.db');
const PROVIDER = 'https://idp.example.com';

describe('MUS-25: UserService — OIDC identity resolution', () => {
  let db: DatabaseAdapter;
  let userService: UserService;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = createDatabaseAdapter(TEST_DB);
    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();
    userService = new UserService(db);
  });

  afterEach(async () => {
    if (db) await db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(TEST_DB + suffix); } catch { /* ok */ }
    }
  });

  it('creates a new user on first sign-in', async () => {
    const { user, isNewUser } = await userService.findOrCreateBySubject(PROVIDER, 'sub-1', 'first@example.com');
    expect(isNewUser).toBe(true);
    expect(user.email).toBe('first@example.com');
  });

  it('resolves to the same user on a second sign-in with the same sub', async () => {
    const first = await userService.findOrCreateBySubject(PROVIDER, 'sub-2', 'a@example.com');
    const second = await userService.findOrCreateBySubject(PROVIDER, 'sub-2', 'a@example.com');
    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('resolves to the same user when the email changes — matched on sub, not email', async () => {
    const first = await userService.findOrCreateBySubject(PROVIDER, 'sub-3', 'old@example.com');
    const second = await userService.findOrCreateBySubject(PROVIDER, 'sub-3', 'new@example.com');

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.email).toBe('new@example.com');

    // The identity row's stored email is refreshed, not the sub — only one
    // identity row should exist for this (provider, sub) pair.
    const identities = await db.query<any>('SELECT * FROM identity WHERE provider = ? AND subject = ?', [PROVIDER, 'sub-3']);
    expect(identities.length).toBe(1);
    expect(identities[0].email).toBe('new@example.com');
  });

  it('creates distinct users for distinct subs even with the same email', async () => {
    const first = await userService.findOrCreateBySubject(PROVIDER, 'sub-4', 'shared@example.com');
    const second = await userService.findOrCreateBySubject(PROVIDER, 'sub-5', 'shared@example.com');
    expect(second.user.id).not.toBe(first.user.id);
  });

  it('reports the workspace as empty until a first member is admitted', async () => {
    const now = new Date().toISOString();
    const wsId = 'ws-empty-check';
    await db.execute('INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [wsId, 'WS', 'ws-empty', now, now]);

    expect(await userService.isWorkspaceEmpty(wsId)).toBe(true);

    const { user } = await userService.findOrCreateBySubject(PROVIDER, 'sub-owner', 'owner@example.com');
    // No roles seeded here — insert a bare role row directly for the FK
    const roleId = 'role-x';
    await db.execute('INSERT INTO role (id, workspace_id, key, name, permissions_json, is_system, rank) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roleId, wsId, 'owner', 'Owner', '[]', 1, 100]);
    await userService.addWorkspaceMember(wsId, user.id, roleId);

    expect(await userService.isWorkspaceEmpty(wsId)).toBe(false);
    expect(await userService.isWorkspaceMember(wsId, user.id)).toBe(true);
  });
});
