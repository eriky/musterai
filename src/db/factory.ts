// File: src/db/factory.ts
import { config } from '../config/index.js';
import { DatabaseAdapter } from './adapter.js';
import { SQLiteAdapter } from './sqlite-adapter.js';

export function createDatabaseAdapter(dbPath?: string): DatabaseAdapter {
  const targetPath = dbPath || config.db.path;
  return new SQLiteAdapter(targetPath);
}
