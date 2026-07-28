// File: src/db/migrator.ts
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseAdapter } from './adapter.js';
import { deriveKeyPrefix, formatCardKey } from '../shared/card-key.js';

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

    if (!fs.existsSync(targetDir)) return;

    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.sql')).sort();
    if (files.length === 0) return;

    // Splitting is a naive `;`-scan below, so `--` line comments are
    // stripped first — a semicolon inside a comment (e.g. "one grant;
    // rotating on reuse") would otherwise silently cut a CREATE TABLE in
    // half and fail with a confusing "syntax error near ..." far from its
    // actual cause. None of these files put `--` inside a string literal.
    const stripLineComments = (sql: string): string =>
      sql.split('\n').map(line => line.replace(/--.*$/, '')).join('\n');

    const sqlToRun = files
      .map(file => stripLineComments(fs.readFileSync(path.join(targetDir, file), 'utf-8')))
      .join('\n;\n');

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
   * card keys were introduced. No-op once every row has been backfilled.
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