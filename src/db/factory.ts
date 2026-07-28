// File: src/db/factory.ts
import { config } from '../config/index.js';
import { DatabaseAdapter } from './adapter.js';
import { SQLiteAdapter } from './sqlite-adapter.js';
import { PostgresAdapter } from './postgres-adapter.js';

/**
 * `dbPath`/`connectionString` overrides `config.db` — used by tests to point
 * at an isolated database without touching environment variables that other
 * concurrently-running tests may depend on.
 */
export function createDatabaseAdapter(dbPathOrConnectionString?: string): DatabaseAdapter {
  if (config.db.type === 'postgres') {
    const connectionString = dbPathOrConnectionString || config.db.url;
    if (!connectionString) {
      throw new Error('MUSTER_DATABASE_URL is required when MUSTER_DB_TYPE=postgres');
    }
    return new PostgresAdapter(connectionString);
  }

  const targetPath = dbPathOrConnectionString || config.db.path;
  return new SQLiteAdapter(targetPath);
}
