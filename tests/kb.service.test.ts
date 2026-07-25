// File: tests/kb.service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import { KBService, ProjectService, EventService } from '../src/services/index.js';

const TEST_DB = path.join(process.cwd(), 'data', 'kb-test.db');

describe('KBService Knowledge Base & Graph Integration Tests', () => {
  let db: DatabaseAdapter;
  let kbService: KBService;
  let projectService: ProjectService;
  let eventService: EventService;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    db = createDatabaseAdapter(TEST_DB);

    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    eventService = new EventService(db);
    kbService = new KBService(db, eventService);
    projectService = new ProjectService(db, eventService);
  });

  afterEach(async () => {
    if (db) await db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  it('creates Home KB and Work KB and links to projects', async () => {
    const projectHome = await projectService.create({ name: 'Home Automation' });
    const projectWork = await projectService.create({ name: 'Work Muster' });

    const homeKb = await kbService.create({
      name: 'Home KB',
      description: 'Local network & homelab hardware',
      project_ids: [projectHome.id],
    });

    const workKb = await kbService.create({
      name: 'Work KB',
      description: 'Work credentials & cloud servers',
      project_ids: [projectWork.id],
    });

    const globalKb = await kbService.create({
      name: 'Global Infra KB',
      is_global: true,
    });

    expect(homeKb.id).toBeDefined();
    expect(workKb.id).toBeDefined();

    // Verify project specific listing
    const homeKbs = await kbService.list(projectHome.id);
    expect(homeKbs.map(k => k.name)).toContain('Home KB');
    expect(homeKbs.map(k => k.name)).toContain('Global Infra KB');
    expect(homeKbs.map(k => k.name)).not.toContain('Work KB');
  });

  it('auto-resolves entity IP addresses and stores gained knowledge facts', async () => {
    const kb = await kbService.create({ name: 'Homelab KB' });

    const fact = await kbService.addFact({
      kb_id: kb.id,
      title: 'Server X CPU Constraint',
      content: 'Server X on 192.168.1.50 has only 1 CPU core and 2GB RAM. Do not use to build container images.',
      category: 'constraint',
    });

    expect(fact.id).toBeDefined();
    expect(fact.entity_id).toBeDefined();

    // Canonical entity search
    const entityResult = await kbService.getEntityKnowledge('192.168.1.50');
    expect(entityResult).not.toBeNull();
    expect(entityResult?.entity.type).toBe('ip_address');
    expect(entityResult?.facts[0].title).toBe('Server X CPU Constraint');
  });

  it('builds directed graph relations between entities and returns graph tree', async () => {
    const kb = await kbService.create({ name: 'Graph KB' });

    const serverNode = await kbService.upsertEntity({
      kb_id: kb.id,
      name: 'server-01',
      type: 'server',
      identifier: 'server-01',
    });

    const ipNode = await kbService.upsertEntity({
      kb_id: kb.id,
      name: '192.168.1.100',
      type: 'ip_address',
      identifier: '192.168.1.100',
    });

    const relation = await kbService.addRelation({
      kb_id: kb.id,
      source_entity_id: serverNode.id,
      target_entity_id: ipNode.id,
      relation_type: 'has_ip',
      description: 'Primary static IP assignment',
    });

    expect(relation.id).toBeDefined();

    const tree = await kbService.getGraphTree(kb.id);
    expect(tree.nodes.length).toBe(2);
    expect(tree.links.length).toBe(1);
    expect(tree.links[0].relation_type).toBe('has_ip');
  });
});
