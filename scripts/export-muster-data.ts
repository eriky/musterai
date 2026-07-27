// File: scripts/export-muster-data.ts
// One-shot throwaway script: reads an old-schema database and writes a
// new-schema copy. Designed for the MUS-20 schema squash — the old database
// has agent_registration + project (no workspace_id) while the new schema
// has principal/app_user/agent tables and project.workspace_id.
//
// Usage: npx tsx scripts/export-muster-data.ts <old-db-path> <new-db-path>
//   If <new-db-path> does not exist, the script creates it by running migrations.
//   The old database is never modified.

import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { ulid } from 'ulid';

const OLD = process.argv[2];
const NEW = process.argv[3];

if (!OLD || !NEW) {
  console.error('Usage: npx tsx scripts/export-muster-data.ts <old-db> <new-db>');
  process.exit(1);
}

// ---- Step 1: Open the OLD database (read-only) ----
if (!fs.existsSync(OLD)) {
  console.error(`Old database not found: ${OLD}`);
  process.exit(1);
}
const oldDb = new Database(OLD, { readonly: true });

// ---- Step 2: Create the NEW database by running migrations ----
const newDbExists = fs.existsSync(NEW);
if (!newDbExists) {
  // Run the migrator by starting the server briefly — but that's complex.
  // Instead, apply the SQL directly.
  console.log('Creating new database from migrations...');
  const migDir = path.join(process.cwd(), 'src/db/migrations');
  const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
  const sql = files.map(f => fs.readFileSync(path.join(migDir, f), 'utf-8')).join('\n;\n');
  // Write to new DB
  const newDb = new Database(NEW);
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    try { newDb.exec(stmt); } catch (err: any) {
      if (err.message?.includes('duplicate column name')) continue;
      throw err;
    }
  }
  newDb.close();
  console.log('New database created with fresh schema.');
}

const newDb = new Database(NEW);
newDb.pragma('journal_mode = WAL');
newDb.pragma('foreign_keys = OFF'); // disable during import

const now = new Date().toISOString();

// ---- Step 3: Bootstrap workspace if empty ----
const existingWs = newDb.prepare('SELECT id FROM workspace LIMIT 1').get() as any;
let workspaceId: string;
if (!existingWs) {
  workspaceId = ulid();
  newDb.prepare(
    'INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(workspaceId, 'Default Workspace', 'default', now, now);
  console.log('Created workspace:', workspaceId);
} else {
  workspaceId = existingWs.id;
}

// ---- Step 4: Map agent_registration → principal + agent ----
// Old schema: agent_registration(id, name, type, role, capabilities, status, last_seen_at, created_at, owner_id, secret_token)
// New schema: principal(id, kind, created_at)
//   agent(id, name, capabilities, status, last_seen_at, operator_user_id, role_id, workspace_id, created_at)

const agentRows = oldDb.prepare('SELECT * FROM agent_registration').all() as any[];
const insertPrincipal = newDb.prepare('INSERT OR IGNORE INTO principal (id, kind, created_at) VALUES (?, ?, ?)');
const insertAgent = newDb.prepare(
  'INSERT OR IGNORE INTO agent (id, name, capabilities, status, last_seen_at, operator_user_id, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

const insertUser = newDb.prepare(
  'INSERT OR IGNORE INTO app_user (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)'
);

for (const ar of agentRows) {
  const kind = ar.type === 'human' ? 'user' : 'agent';
  insertPrincipal.run(ar.id, kind, ar.created_at || now);

  if (kind === 'user') {
    insertUser.run(ar.id, null, ar.name, ar.status || 'active', ar.created_at || now);
  } else {
    const capabilities = ar.capabilities ? (
      typeof ar.capabilities === 'string' ? ar.capabilities : JSON.stringify(ar.capabilities)
    ) : null;
    insertAgent.run(
      ar.id,
      ar.name,
      capabilities,
      ar.status || 'active',
      ar.last_seen_at || now,
      ar.owner_id || null,
      workspaceId,
      ar.created_at || now
    );
  }
}
console.log(`Migrated ${agentRows.length} agent_registration rows → principal + agent/app_user`);

// Also ensure every app_user has a corresponding agent row for UI visibility
const orphanUsers = newDb.prepare(
  'SELECT id, display_name, created_at FROM app_user WHERE id NOT IN (SELECT id FROM agent)'
).all() as any[];
const insertOrphanAgent = newDb.prepare(
  'INSERT OR IGNORE INTO agent (id, name, capabilities, status, last_seen_at, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
for (const u of orphanUsers) {
  insertOrphanAgent.run(u.id, u.display_name, '["management","architecture","review"]', 'active', now, workspaceId, u.created_at || now);
}
if (orphanUsers.length > 0) {
  console.log(`Also added ${orphanUsers.length} app_user rows as agents for UI visibility`);
}

// ---- Step 5: Map project + workspace_id ----
const projectRows = oldDb.prepare('SELECT * FROM project').all() as any[];
const insertProject = newDb.prepare(
  'INSERT OR IGNORE INTO project (id, workspace_id, name, description, key_prefix, card_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const p of projectRows) {
  insertProject.run(
    p.id,
    workspaceId,
    p.name,
    p.description || null,
    p.key_prefix || null,
    p.card_seq || 0,
    p.created_at || now,
    p.updated_at || now
  );
}
console.log(`Migrated ${projectRows.length} projects`);

// ---- Step 6: Copy board, column, label, card, card_assignee, card_label, card_link, card_work_link, card_document ----
// These tables are structurally identical across old and new schemas EXCEPT:
// card_assignee: old has agent_id, new has principal_id
// card: old schema might not have is_epic/claimed_by columns if migrations didn't run

function copyTable(table: string, columns: string, select: string, insertPrefix?: string) {
  const rows = oldDb.prepare(`SELECT ${select} FROM ${table}`).all() as any[];
  if (rows.length === 0) return;
  const insert = newDb.prepare(insertPrefix || `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${rows[0] ? Object.keys(rows[0]).map(() => '?').join(', ') : ''})`);
  const insertMany = newDb.transaction((rows: any[]) => {
    for (const row of rows) {
      insert.run(...Object.values(row));
    }
  });
  insertMany(rows);
  console.log(`Copied ${rows.length} rows from ${table}`);
}

// Board
copyTable('board', 'id, project_id, name, created_at, updated_at', 'id, project_id, name, created_at, updated_at');

// Column
copyTable('"column"', 'id, board_id, name, position, wip_limit', 'id, board_id, name, position, wip_limit');

// Label
copyTable('label', 'id, board_id, name, color', 'id, board_id, name, color');

// Card — old schema may lack is_epic, claimed_by, claimed_at, claim_expires_at, key
const cardRows = oldDb.prepare('SELECT * FROM card').all() as any[];
const insertCard = newDb.prepare(`
  INSERT OR IGNORE INTO card (id, key, column_id, title, description, position, priority, due_date, status, blocked_reason, created_at, updated_at, archived, claimed_by, claimed_at, claim_expires_at, is_epic)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const c of cardRows) {
  insertCard.run(
    c.id,
    c.key || null,
    c.column_id,
    c.title,
    c.description || null,
    c.position,
    c.priority || 'medium',
    c.due_date || null,
    c.status || 'active',
    c.blocked_reason || null,
    c.created_at || now,
    c.updated_at || now,
    c.archived || 0,
    c.claimed_by || null,
    c.claimed_at || null,
    c.claim_expires_at || null,
    c.is_epic || 0
  );
}
console.log(`Copied ${cardRows.length} cards`);

// Card assignee — map agent_id → principal_id
const assigneeRows = oldDb.prepare('SELECT * FROM card_assignee').all() as any[];
const insertAssignee = newDb.prepare('INSERT OR IGNORE INTO card_assignee (card_id, principal_id) VALUES (?, ?)');
for (const a of assigneeRows) {
  insertAssignee.run(a.card_id, a.agent_id);
}
console.log(`Copied ${assigneeRows.length} card_assignee rows (agent_id → principal_id)`);

// card_label
copyTable('card_label', 'card_id, label_id', 'card_id, label_id');

// card_link
copyTable('card_link', 'id, source_card_id, target_card_id, relation_type, created_at', 'id, source_card_id, target_card_id, relation_type, created_at');

// card_work_link
copyTable('card_work_link', 'id, card_id, kind, provider, url, external_ref, title, status, created_at', 'id, card_id, kind, provider, url, external_ref, title, status, created_at');

// card_document
copyTable('card_document', 'card_id, document_id, linked_at', 'card_id, document_id, linked_at');

// ---- Step 7: Comment ----
// Old schema: author_id REFERENCES agent_registration. New schema: REFERENCES principal.
// The IDs are the same (we mapped them), so just copy.
copyTable('comment', 'id, card_id, author_id, content, created_at', 'id, card_id, author_id, content, created_at');

// ---- Step 8: Document & document_version ----
copyTable('document', 'id, project_id, parent_id, title, content, status, author_id, version, created_at, updated_at', 'id, project_id, parent_id, title, content, status, author_id, version, created_at, updated_at');
copyTable('document_version', 'id, document_id, version, title, content, author_id, change_summary, created_at', 'id, document_id, version, title, content, author_id, change_summary, created_at');

// ---- Step 9: Event ----
copyTable('event', 'id, project_id, entity_type, entity_id, action, actor_id, payload, created_at', 'id, project_id, entity_type, entity_id, action, actor_id, payload, created_at');

// ---- Step 10: Knowledge Base ----
copyTable('knowledge_base', 'id, name, description, is_global, created_at, updated_at', 'id, name, description, is_global, created_at, updated_at');
copyTable('project_knowledge_base', 'project_id, kb_id, created_at', 'project_id, kb_id, created_at');
copyTable('kb_entity', 'id, kb_id, name, type, identifier, metadata, created_at, updated_at', 'id, kb_id, name, type, identifier, metadata, created_at, updated_at');
copyTable('kb_relation', 'id, kb_id, source_entity_id, target_entity_id, relation_type, description, created_at', 'id, kb_id, source_entity_id, target_entity_id, relation_type, description, created_at');

// kb_fact — old has source_agent_id, new has source_principal_id
const factRows = oldDb.prepare('SELECT * FROM kb_fact').all() as any[];
const insertFact = newDb.prepare(`
  INSERT OR IGNORE INTO kb_fact (id, kb_id, entity_id, title, content, category, confidence, source_principal_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const f of factRows) {
  insertFact.run(
    f.id, f.kb_id, f.entity_id || null, f.title, f.content,
    f.category || 'general', f.confidence || 1.0,
    f.source_agent_id || f.source_principal_id || null,
    f.created_at || now, f.updated_at || now
  );
}
console.log(`Copied ${factRows.length} kb_fact rows (source_agent_id → source_principal_id)`);

newDb.pragma('foreign_keys = ON');
oldDb.close();
newDb.close();

console.log('\n✅ Export complete. Replace data/muster.db with the new database.');
console.log(`   Old DB: ${OLD}`);
console.log(`   New DB: ${NEW}`);