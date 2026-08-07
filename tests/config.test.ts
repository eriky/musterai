import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { resolveDbPath, setDatabaseOverride, config } from '../src/config/index.js';

describe('Database Configuration & Path Resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MUSTER_DB_NAME;
    delete process.env.MUSTER_DB_PATH;
    delete process.env.MUSTER_DB_TYPE;
    delete process.env.MUSTER_DATABASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves default path when no option or env var is supplied', () => {
    const res = resolveDbPath();
    expect(res.path).toContain(path.join('data', 'muster.db'));
  });

  it('resolves MUSTER_DB_PATH when env var is set and no explicit option is passed', () => {
    process.env.MUSTER_DB_PATH = '/custom/env/muster.db';
    const res = resolveDbPath();
    expect(res.path).toBe('/custom/env/muster.db');
  });

  it('resolves simple database name into data/<name>.db', () => {
    const res = resolveDbPath('alpha');
    expect(res.path).toContain(path.join('data', 'alpha.db'));
  });

  it('preserves existing SQLite file extension for simple name', () => {
    const res = resolveDbPath('test.sqlite');
    expect(res.path).toContain(path.join('data', 'test.sqlite'));
  });

  it('resolves absolute path directly', () => {
    const res = resolveDbPath('/tmp/custom_test.db');
    expect(res.path).toBe('/tmp/custom_test.db');
  });

  it('resolves relative path containing path separators relative to cwd', () => {
    const res = resolveDbPath('./custom_folder/app.db');
    expect(res.path).toBe(path.resolve(process.cwd(), './custom_folder/app.db'));
  });

  it('overrides postgres database URL pathname when in postgres mode', () => {
    process.env.MUSTER_DB_TYPE = 'postgres';
    process.env.MUSTER_DATABASE_URL = 'postgres://admin:secret@localhost:5432/production_db';

    const res = resolveDbPath('staging_db');
    expect(res.url).toBe('postgres://admin:secret@localhost:5432/staging_db');
  });

  it('setDatabaseOverride updates global config.db', () => {
    setDatabaseOverride('override_db');
    expect(config.db.path).toContain(path.join('data', 'override_db.db'));
  });
});
