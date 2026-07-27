// File: src/db/migrator.ts
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseAdapter } from './adapter.js';
import { deriveKeyPrefix, formatCardKey } from '../shared/card-key.js';

const INITIAL_SQL = `-- Migration fallback
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS board (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "column" (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  wip_limit INTEGER
);

CREATE TABLE IF NOT EXISTS card (
  id TEXT PRIMARY KEY,
  column_id TEXT NOT NULL REFERENCES "column"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  blocked_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS label (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_label (
  card_id TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES label(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE IF NOT EXISTS agent_registration (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  role TEXT NOT NULL,
  capabilities TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_assignee (
  card_id TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agent_registration(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, agent_id)
);

CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES agent_registration(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachment (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES document(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  author_id TEXT REFERENCES agent_registration(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_version (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES agent_registration(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT REFERENCES agent_registration(id) ON DELETE SET NULL,
  payload TEXT,
  created_at TEXT NOT NULL
);
`;

export class Migrator {
  private db: DatabaseAdapter;
  private migrationsDir: string;

  constructor(db: DatabaseAdapter, migrationsDir: string) {
    this.db = db;
    this.migrationsDir = migrationsDir;
  }

  async run(): Promise<void> {
    let targetDir = this.migrationsDir;
    if (!fs.existsSync(targetDir) || fs.readdirSync(targetDir).filter(f => f.endsWith('.sql')).length === 0) {
      const srcDir = path.join(process.cwd(), 'src/db/migrations');
      if (fs.existsSync(srcDir)) {
        targetDir = srcDir;
      }
    }

    let sqlToRun = INITIAL_SQL;
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.sql')).sort();
      if (files.length > 0) {
        sqlToRun = files.map(file => fs.readFileSync(path.join(targetDir, file), 'utf-8')).join('\n;\n');
      }
    }

    const statements = sqlToRun
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await this.db.migrate(stmt);
      } catch (err: any) {
        if (err.message && err.message.includes('duplicate column name')) {
          // Column already exists, ignore
          continue;
        }
        throw err;
      }
    }

    await this.backfillCardKeys();
  }

  /**
   * Assigns key_prefix/key to any project/card rows left over from before
   * migration 008. Deriving a prefix from a name (word-initials, collision
   * avoidance) isn't practical in plain SQL, so it's done here once at
   * startup; it's a no-op once every row has been backfilled.
   */
  private async backfillCardKeys(): Promise<void> {
    const projects = await this.db.query<{ id: string; name: string; key_prefix: string | null }>(
      `SELECT id, name, key_prefix FROM project ORDER BY created_at ASC`
    );
    if (projects.length === 0) return;

    const taken = new Set(projects.map(p => p.key_prefix).filter((p): p is string => !!p));
    for (const project of projects) {
      if (project.key_prefix) continue;
      const prefix = deriveKeyPrefix(project.name, taken);
      taken.add(prefix);
      await this.db.execute(`UPDATE project SET key_prefix = ? WHERE id = ?`, [prefix, project.id]);
    }

    const cards = await this.db.query<{ id: string; project_id: string }>(
      `SELECT c.id, b.project_id FROM card c
       JOIN "column" col ON c.column_id = col.id
       JOIN board b ON col.board_id = b.id
       WHERE c.key IS NULL
       ORDER BY c.created_at ASC`
    );
    if (cards.length === 0) return;

    const seqByProject = new Map<string, number>();
    const prefixRows = await this.db.query<{ id: string; key_prefix: string; card_seq: number }>(
      `SELECT id, key_prefix, card_seq FROM project`
    );
    const prefixByProject = new Map(prefixRows.map(p => [p.id, p.key_prefix]));
    for (const p of prefixRows) seqByProject.set(p.id, p.card_seq);

    for (const card of cards) {
      const prefix = prefixByProject.get(card.project_id);
      if (!prefix) continue;
      const seq = (seqByProject.get(card.project_id) || 0) + 1;
      seqByProject.set(card.project_id, seq);
      await this.db.execute(`UPDATE card SET key = ? WHERE id = ?`, [formatCardKey(prefix, seq), card.id]);
    }

    for (const [projectId, seq] of seqByProject) {
      await this.db.execute(`UPDATE project SET card_seq = ? WHERE id = ?`, [seq, projectId]);
    }
  }
}
