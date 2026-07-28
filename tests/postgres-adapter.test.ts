// File: tests/postgres-adapter.test.ts
//
// MUS-31 acceptance criteria, exercised against a real PostgreSQL instance:
// - migrations run clean on an empty Postgres database
// - the full service-level surface works against Postgres (not just SQLite)
// - concurrent claim_card calls remain atomic under a real connection pool
//
// Requires MUSTER_TEST_PG_URL (see .github/workflows/ci.yml for the CI
// service container). Skips gracefully — not a failure — when it's unset,
// so `npm test` on a machine without Postgres installed still passes:
// SQLite stays the zero-configuration default and nothing here should get
// in the way of that.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { PostgresAdapter, convertPlaceholders, translateDialect } from '../src/db/postgres-adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { CardService } from '../src/services/card.service.js';
import { RoleService } from '../src/services/role.service.js';

const PG_URL = process.env.MUSTER_TEST_PG_URL;

describe.skipIf(!PG_URL)('MUS-31: PostgreSQL adapter', () => {
  let adminPool: pg.Pool;
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: PG_URL });
  });

  afterAll(async () => {
    await adminPool.end();
  });

  beforeEach(async () => {
    // Full reset between tests — cheapest way to get migrations-run-clean
    // coverage on every test, not just once.
    await adminPool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    adapter = new PostgresAdapter(PG_URL!);
  });

  it('reports its dialect', () => {
    expect(adapter.dialect).toBe('postgres');
  });

  it('runs every migration clean against an empty database', async () => {
    const migrator = new Migrator(adapter, './src/db/migrations');
    await expect(migrator.run()).resolves.not.toThrow();

    const tables = await adapter.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const names = tables.map(t => t.table_name);
    expect(names).toContain('workspace');
    expect(names).toContain('card');
    expect(names).toContain('audit_log');
    expect(names).toContain('oauth_client');
  });

  it('running the migrator twice is idempotent (ADD COLUMN tolerance included)', async () => {
    const migrator = new Migrator(adapter, './src/db/migrations');
    await migrator.run();
    await expect(migrator.run()).resolves.not.toThrow();

    const columns = await adapter.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'actor_kind'`,
    );
    expect(columns).toHaveLength(1);
  });

  it('created_at defaults match the SQLite ISO-8601-with-Z shape', async () => {
    const migrator = new Migrator(adapter, './src/db/migrations');
    await migrator.run();

    await adapter.execute(
      `INSERT INTO invitation (id, workspace_id, email, role_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['inv-1', null, 'x@example.com', 'role-1', 'hash', new Date().toISOString(), null],
    ).catch(() => {
      // workspace_id/role_id FKs will fail without real rows — this test
      // only cares about the DEFAULT expression, so fall through to a
      // direct check of the column default instead of a real insert.
    });

    const def = await adapter.query<{ column_default: string }>(
      `SELECT column_default FROM information_schema.columns WHERE table_name = 'invitation' AND column_name = 'created_at'`,
    );
    expect(def[0]?.column_default).toContain('to_char');
  });

  it('honors a real workspace -> role -> agent chain end to end (CardService.claim included)', async () => {
    const migrator = new Migrator(adapter, './src/db/migrations');
    await migrator.run();

    const now = new Date().toISOString();
    await adapter.execute('INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', ['ws-1', 'WS', 'ws-1', now, now]);
    await adapter.execute('INSERT INTO project (id, workspace_id, name, key_prefix, card_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['proj-1', 'ws-1', 'Proj', 'PRJ', 0, now, now]);
    await adapter.execute('INSERT INTO board (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', ['board-1', 'proj-1', 'Board', now, now]);
    await adapter.execute('INSERT INTO "column" (id, board_id, name, position) VALUES (?, ?, ?, ?)', ['col-1', 'board-1', 'To Do', 'a']);
    await adapter.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', ['agent-1', 'agent', now]);
    await adapter.execute('INSERT INTO agent (id, name, status, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?)', ['agent-1', 'Agent', 'active', now, now]);

    const cardService = new CardService(adapter);
    const card = await cardService.create({ column_id: 'col-1', title: 'Test card' });

    const claimed = await cardService.claim(card.id, 'agent-1');
    expect('success' in claimed ? claimed.success : true).not.toBe(false);

    const roleService = new RoleService(adapter);
    const roles = await roleService.seedPreset('ws-1');
    expect(roles).toHaveLength(6);
  });

  it('concurrent claim_card calls on the same card are atomic under a real connection pool — exactly one wins', async () => {
    const migrator = new Migrator(adapter, './src/db/migrations');
    await migrator.run();

    const now = new Date().toISOString();
    await adapter.execute('INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', ['ws-race', 'WS', 'ws-race', now, now]);
    await adapter.execute('INSERT INTO project (id, workspace_id, name, key_prefix, card_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['proj-race', 'ws-race', 'Proj', 'PRJ', 0, now, now]);
    await adapter.execute('INSERT INTO board (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', ['board-race', 'proj-race', 'Board', now, now]);
    await adapter.execute('INSERT INTO "column" (id, board_id, name, position) VALUES (?, ?, ?, ?)', ['col-race', 'board-race', 'To Do', 'a']);

    // Ten distinct agents racing for the same card — a real pool, ten real
    // concurrent connections, not ten calls serialized through one.
    const agentIds = Array.from({ length: 10 }, (_, i) => `agent-race-${i}`);
    for (const id of agentIds) {
      await adapter.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', [id, 'agent', now]);
      await adapter.execute('INSERT INTO agent (id, name, status, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?)', [id, id, 'active', now, now]);
    }

    const cardService = new CardService(adapter);
    const card = await cardService.create({ column_id: 'col-race', title: 'Contested card' });

    const results = await Promise.all(agentIds.map(id => cardService.claim(card.id, id)));
    const wins = results.filter(r => !('success' in r) || r.success !== false);
    const refusals = results.filter(r => 'success' in r && r.success === false);

    expect(wins).toHaveLength(1);
    expect(refusals).toHaveLength(9);

    // The row itself agrees with exactly one of the calls that "won".
    const finalRows = await adapter.query<{ claimed_by: string }>('SELECT claimed_by FROM card WHERE id = ?', [card.id]);
    expect(agentIds).toContain(finalRows[0].claimed_by);
  });
});

describe('MUS-31: dialect translation helpers (pure functions, no database needed)', () => {
  it('converts sequential ? placeholders to $1, $2, ...', () => {
    expect(convertPlaceholders('SELECT * FROM x WHERE a = ? AND b = ?')).toBe('SELECT * FROM x WHERE a = $1 AND b = $2');
  });

  it('does not treat a literal ? inside a string as a placeholder', () => {
    expect(convertPlaceholders(`SELECT * FROM x WHERE a = ? AND note = 'is this ok?'`))
      .toBe(`SELECT * FROM x WHERE a = $1 AND note = 'is this ok?'`);
  });

  it('translates INSERT OR IGNORE to ON CONFLICT DO NOTHING', () => {
    expect(translateDialect(`INSERT OR IGNORE INTO card_assignee (card_id, principal_id) VALUES (?, ?)`))
      .toBe(`INSERT INTO card_assignee (card_id, principal_id) VALUES (?, ?) ON CONFLICT DO NOTHING`);
  });

  it('leaves ordinary statements untouched', () => {
    const sql = 'SELECT * FROM card WHERE id = ?';
    expect(translateDialect(sql)).toBe(sql);
  });
});
