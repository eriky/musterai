// File: tests/session.test.ts
//
// MUS-25 acceptance criteria:
// - session cookie carries httpOnly, Secure, SameSite (tested at the
//   serialization layer in tests/cookies.test.ts)
// - logout invalidates the session server-side

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { SessionService, hashSessionToken } from '../src/services/session.service.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test-session.db');

describe('MUS-25: SessionService', () => {
  let db: DatabaseAdapter;
  let sessionService: SessionService;
  const userId = 'test-user-01';

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = createDatabaseAdapter(TEST_DB);
    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();
    sessionService = new SessionService(db);

    const now = new Date().toISOString();
    await db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', [userId, 'user', now]);
    await db.execute('INSERT INTO app_user (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, 'test@example.com', 'Test User', 'active', now]);
  });

  afterEach(async () => {
    if (db) await db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(TEST_DB + suffix); } catch { /* ok */ }
    }
  });

  it('creates a session and verifies it resolves the correct user', async () => {
    const created = await sessionService.create(userId);
    const verification = await sessionService.verify(created.token);
    expect(verification).not.toBeNull();
    expect(verification!.user_id).toBe(userId);
  });

  it('never stores the plaintext session token', async () => {
    const created = await sessionService.create(userId);
    const rows = await db.query<any>('SELECT token_hash FROM session WHERE id = ?', [created.id]);
    expect(rows[0].token_hash).not.toBe(created.token);
    expect(rows[0].token_hash).toBe(hashSessionToken(created.token));
  });

  it('rejects an unknown session token', async () => {
    expect(await sessionService.verify('not-a-real-token')).toBeNull();
  });

  it('rejects an expired session', async () => {
    const created = await sessionService.create(userId, { ttlMs: -1000 });
    expect(await sessionService.verify(created.token)).toBeNull();
  });

  it('logout invalidates the session server-side immediately', async () => {
    const created = await sessionService.create(userId);
    expect(await sessionService.verify(created.token)).not.toBeNull();

    await sessionService.revokeByToken(created.token);

    expect(await sessionService.verify(created.token)).toBeNull();
  });

  it('throttles last_seen_at updates to at most once per 60 seconds', async () => {
    const created = await sessionService.create(userId);

    await sessionService.verify(created.token);
    const rows1 = await db.query<any>('SELECT last_seen_at FROM session WHERE id = ?', [created.id]);
    const firstSeen = rows1[0].last_seen_at;
    expect(firstSeen).not.toBeNull();

    await sessionService.verify(created.token);
    const rows2 = await db.query<any>('SELECT last_seen_at FROM session WHERE id = ?', [created.id]);
    expect(rows2[0].last_seen_at).toBe(firstSeen);
  });
});
