// File: src/db/migrator.ts
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseAdapter } from './adapter.js';

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
  }
}
