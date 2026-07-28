// File: tests/role.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { RoleService, EventService } from '../src/services/index.js';
import { PRESET_ROLES, validatePermissions, effectivePermissions, ALL_PERMISSIONS } from '../src/shared/permissions.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test-role.db');

describe('RoleService & permissions', () => {
  let db: DatabaseAdapter;
  let roleService: RoleService;
  let wsId: string;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = createDatabaseAdapter(TEST_DB);

    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    // Create a workspace
    wsId = 'test-ws-role-01';
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [wsId, 'Role Test Workspace', 'role-test', now, now]
    );

    roleService = new RoleService(db);
  });

  afterEach(async () => {
    if (db) await db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('seeds 6 preset roles idempotently', async () => {
    const first = await roleService.seedPreset(wsId);
    expect(first).toHaveLength(6);

    const second = await roleService.seedPreset(wsId);
    expect(second).toHaveLength(6); // Same count, no duplicates

    const listed = await roleService.list(wsId);
    expect(listed).toHaveLength(6);
    expect(listed.filter(r => r.is_system).length).toBe(6);
  });

  it('seeded owner role has all permissions', async () => {
    await roleService.seedPreset(wsId);
    const owner = await roleService.getByKey(wsId, 'owner');
    expect(owner).not.toBeNull();
    expect(owner!.permissions.sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('seeded observer role has only kb.read', async () => {
    await roleService.seedPreset(wsId);
    const observer = await roleService.getByKey(wsId, 'observer');
    expect(observer).not.toBeNull();
    expect(observer!.permissions).toEqual(['kb.read']);
  });

  it('senior_engineer does not have doc.approve', async () => {
    await roleService.seedPreset(wsId);
    const se = await roleService.getByKey(wsId, 'senior_engineer');
    expect(se).not.toBeNull();
    expect(se!.permissions).not.toContain('doc.approve');
    expect(se!.permissions).not.toContain('board.manage');
  });

  it('junior_engineer cannot delete cards or assign others', async () => {
    await roleService.seedPreset(wsId);
    const je = await roleService.getByKey(wsId, 'junior_engineer');
    expect(je).not.toBeNull();
    expect(je!.permissions).not.toContain('card.delete');
    expect(je!.permissions).not.toContain('card.assign_others');
    expect(je!.permissions).toContain('card.assign_self');
  });

  it('creating a role with invalid permission throws', async () => {
    await expect(
      roleService.create({
        workspace_id: wsId,
        key: 'bad',
        name: 'Bad Role',
        permissions: ['not_a_real_permission'],
      })
    ).rejects.toThrow('Unknown permission');
  });

  it('system roles cannot be deleted', async () => {
    await roleService.seedPreset(wsId);
    const owner = await roleService.getByKey(wsId, 'owner');
    await expect(roleService.delete(owner!.id)).rejects.toThrow('cannot be deleted');
  });

  it('custom roles can be created, updated, and deleted', async () => {
    const role = await roleService.create({
      workspace_id: wsId,
      key: 'sre',
      name: 'Site Reliability Engineer',
      permissions: ['card.update', 'card.move', 'comment.create', 'kb.read'],
      rank: 55,
    });
    expect(role.key).toBe('sre');
    expect(role.is_system).toBe(0);

    // Update
    const updated = await roleService.update(role.id, { description: 'For SRE team' });
    expect(updated.description).toBe('For SRE team');

    // Delete
    await roleService.delete(role.id);
    const listed = await roleService.list(wsId);
    expect(listed.find(r => r.id === role.id)).toBeUndefined();
  });

  it('cloning a system role creates an editable copy', async () => {
    await roleService.seedPreset(wsId);
    const architect = await roleService.getByKey(wsId, 'architect');
    const clone = await roleService.clone(architect!.id, 'arch-clone', 'Architect Clone');
    expect(clone.key).toBe('arch-clone');
    expect(clone.is_system).toBe(0);
    expect(clone.permissions).toEqual(architect!.permissions);
    // Clone can be deleted
    await roleService.delete(clone.id);
  });

  it('effective permissions intersect agent role with operator role', async () => {
    await roleService.seedPreset(wsId);
    const juniorRole = await roleService.getByKey(wsId, 'junior_engineer');
    const ownerRole = await roleService.getByKey(wsId, 'owner');

    // Create a principal + agent + user to test intersection
    const now = new Date().toISOString();

    // Create operator user first (agent FK depends on it)
    await db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', ['user-op-01', 'user', now]);
    await db.execute('INSERT INTO app_user (id, display_name, status, created_at) VALUES (?, ?, ?, ?)', ['user-op-01', 'Operator', 'active', now]);
    await db.execute('INSERT INTO workspace_member (workspace_id, user_id, role_id, joined_at) VALUES (?, ?, ?, ?)', [wsId, 'user-op-01', ownerRole!.id, now]);

    // Create agent
    await db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', ['agent-01', 'agent', now]);
    await db.execute('INSERT INTO agent (id, name, status, last_seen_at, role_id, operator_user_id, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['agent-01', 'Test Agent', 'active', now, juniorRole!.id, 'user-op-01', wsId, now]);

    // Agent under owner operator gets junior permissions (full set)
    const perms = await roleService.getEffectivePermissions('agent-01');
    expect(perms).toEqual(juniorRole!.permissions);

    // Now give operator the observer role — agent's perms should be reduced
    const observerRole = await roleService.getByKey(wsId, 'observer');
    await db.execute('UPDATE workspace_member SET role_id = ? WHERE user_id = ?', [observerRole!.id, 'user-op-01']);
    const reducedPerms = await roleService.getEffectivePermissions('agent-01');
    expect(reducedPerms).toEqual(['kb.read']); // Only kb.read survives intersection
  });

  it('validatePermissions rejects unknown permission strings', () => {
    expect(() => validatePermissions(['card.create', 'card.delete'])).not.toThrow();
    expect(() => validatePermissions(['totally_fake'])).toThrow('Unknown permission');
  });

  it('effectivePermissions utility computes intersection correctly', () => {
    const agentPerms = ['card.create', 'card.update', 'card.move', 'doc.approve', 'kb.read'];
    const operatorPerms = ['card.create', 'card.update', 'comment.create', 'kb.read'];
    const result = effectivePermissions(agentPerms, operatorPerms);
    expect(result.sort()).toEqual(['card.create', 'card.update', 'kb.read']);
  });

  it('backfillAgentRoles assigns senior_engineer to agents without a role', async () => {
    await roleService.seedPreset(wsId);

    // Create an agent without a role
    const now = new Date().toISOString();
    await db.execute('INSERT INTO principal (id, kind, created_at) VALUES (?, ?, ?)', ['orphan-agent', 'agent', now]);
    await db.execute('INSERT INTO agent (id, name, status, last_seen_at, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['orphan-agent', 'Orphan', 'active', now, wsId, now]);

    const count = await roleService.backfillAgentRoles(wsId);
    expect(count).toBe(1);

    const updated = await db.query<any>('SELECT role_id FROM agent WHERE id = ?', ['orphan-agent']);
    expect(updated[0].role_id).toBeTruthy();
  });
});