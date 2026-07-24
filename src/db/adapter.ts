// File: src/db/adapter.ts

export interface ExecutionResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

/**
 * Portable SQL Database Adapter interface.
 * Returns Promises so that remote or network-backed drivers (PostgreSQL, MySQL, Cloud SQLite)
 * can be plugged in without changing service signatures.
 */
export interface DatabaseAdapter {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<ExecutionResult>;
  transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;
  migrate(sql: string): Promise<void>;
  close(): Promise<void>;
}
