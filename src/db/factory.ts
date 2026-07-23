// File: src/db/factory.ts
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseAdapter } from './adapter.js';
import { SQLiteAdapter } from './sqlite-adapter.js';
import { config } from '../config/index.js';

export function createDatabaseAdapter(): DatabaseAdapter {
  const dbConfig = config.db;

  if (dbConfig.type !== 'sqlite') {
    throw new Error(`Unsupported database type: ${dbConfig.type}`);
  }

  const dir = path.dirname(dbConfig.path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new SQLiteAdapter(dbConfig.path);
}
