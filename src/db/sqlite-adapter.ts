// File: src/db/sqlite-adapter.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseAdapter, ExecutionResult } from './adapter.js';

export class SQLiteAdapter implements DatabaseAdapter {
  readonly dialect = 'sqlite' as const;
  private db: Database.Database;
  // better-sqlite3 is one synchronous connection: a second BEGIN IMMEDIATE while
  // a transaction is still open throws immediately instead of waiting. Chain
  // transaction() calls through this queue so concurrent callers serialize
  // instead of crashing on a nested transaction.
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(filepath: string) {
    if (filepath !== ':memory:') {
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(filepath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecutionResult> {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid,
    };
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(this);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // Ignore rollback failure if already rolled back
        }
        throw error;
      }
    };

    const scheduled = this.txQueue.then(run, run);
    this.txQueue = scheduled.catch(() => undefined);
    return scheduled;
  }

  async migrate(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
