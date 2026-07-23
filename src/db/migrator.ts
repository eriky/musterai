// File: src/db/migrator.ts
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseAdapter } from './adapter.js';

export class Migrator {
  private db: DatabaseAdapter;
  private migrationsDir: string;

  constructor(db: DatabaseAdapter, migrationsDir: string) {
    this.db = db;
    this.migrationsDir = migrationsDir;
  }

  public async run(): Promise<void> {
    await this.db.migrate(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedMigrations = await this.db.query<{ filename: string }>('SELECT filename FROM _migrations');
    const appliedSet = new Set(appliedMigrations.map((m: { filename: string }) => m.filename));

    if (!fs.existsSync(this.migrationsDir)) {
      return;
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(this.migrationsDir, file), 'utf-8');
      await this.db.migrate(sql);

      const now = new Date().toISOString();
      await this.db.execute(
        'INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)',
        [file, now]
      );
    }
  }
}
