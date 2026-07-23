// File: src/db/sqlite-adapter.ts
import initSqlJs from 'sql.js';
import { DatabaseAdapter } from './adapter.js';
import path from 'node:path';
import fs from 'node:fs';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: any = null;
  private initialized = false;
  private dbPath: string;
  private autoSave = true;

  constructor(filepath: string) {
    this.dbPath = filepath;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.initialized = true;
  }

  private save(): void {
    if (!this.db || !this.autoSave) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.dbPath, buffer);
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.init();
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    await this.init();
    this.db.run(sql, params);
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    await this.init();
    this.autoSave = false;
    this.db.run('BEGIN');
    try {
      const result = await fn(this);
      this.db.run('COMMIT');
      this.save();
      return result;
    } catch (error) {
      try { this.db.run('ROLLBACK'); } catch (_) { /* ignore rollback errors */ }
      this.save();
      throw error;
    } finally {
      this.autoSave = true;
    }
  }

  async migrate(sql: string): Promise<void> {
    await this.init();
    this.db.exec(sql);
    this.save();
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
