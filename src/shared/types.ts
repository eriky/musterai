// File: src/shared/types.ts

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProject {
  name: string;
  description?: string;
}

export interface UpdateProject {
  name?: string;
  description?: string;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBoard {
  project_id: string;
  name: string;
  columns?: string[];
  template?: 'simple' | 'standard';
}

export interface UpdateBoard {
  name?: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: string;
  wip_limit: number | null;
}

export interface CreateColumn {
  board_id: string;
  name: string;
  position?: string;
  wip_limit?: number;
}

export interface UpdateColumn {
  name?: string;
  wip_limit?: number | null;
  position?: string;
}

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date: string | null;
  status: 'active' | 'blocked' | 'in_review';
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
  archived: number;
}

export interface CreateCard {
  column_id: string;
  title: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  position?: string;
  due_date?: string;
  status?: 'active' | 'blocked' | 'in_review';
  blocked_reason?: string | null;
  labels?: string[];
  assignees?: string[];
}

export interface UpdateCard {
  title?: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string | null;
  status?: 'active' | 'blocked' | 'in_review';
  blocked_reason?: string | null;
  archived?: number;
}

export interface MoveCard {
  target_column_id?: string;
  position?: string;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface CreateLabel {
  board_id: string;
  name: string;
  color: string;
}

export interface Agent {
  id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities: string[];
  status: 'active' | 'idle' | 'offline';
  last_seen_at: string;
  created_at: string;
  owner_id?: string | null;
  secret_token?: string | null;
}

export interface RegisterAgent {
  id?: string;
  agent_id?: string;
  name?: string;
  type?: 'ai_agent' | 'human';
  role?: 'owner' | 'contributor' | 'observer';
  capabilities?: string | string[];
  status?: 'active' | 'idle' | 'offline';
  secret_token?: string;
  owner_id?: string;
}


export interface UpdateAgentStatus {
  status: 'active' | 'idle' | 'offline';
}

export interface UpdateAgent {
  name?: string;
  role?: 'owner' | 'contributor' | 'observer';
  capabilities?: string | string[];
  status?: 'active' | 'idle' | 'offline';
  owner_id?: string | null;
}


export interface Comment {
  id: string;
  card_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
}

export interface CreateComment {
  card_id: string;
  author_id: string;
  content: string;
}

export interface Document {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  author_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDocument {
  project_id: string;
  parent_id?: string;
  title: string;
  content: string;
  author_id?: string;
}

export interface UpdateDocument {
  title?: string;
  content?: string;
  change_summary?: string;
  author_id?: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  title: string;
  content: string;
  author_id: string | null;
  change_summary: string | null;
  created_at: string;
  /** Joined from agent_registration; absent if the author was never registered. */
  author_name?: string | null;
}

export interface Event {
  id: string;
  project_id: string;
  entity_type: 'project' | 'board' | 'column' | 'card' | 'document' | 'agent' | 'knowledge_base';
  entity_id: string;
  action: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateEvent {
  project_id: string;
  entity_type: 'project' | 'board' | 'column' | 'card' | 'document' | 'agent' | 'knowledge_base';
  entity_id: string;
  action: string;
  actor_id?: string;
  payload?: Record<string, unknown>;
}

export interface CardDetails extends Card {
  assignees: Agent[];
  labels: Label[];
  comments: Comment[];
  linked_documents: Document[];
}

export interface ProjectSummary {
  project_id: string;
  name: string;
  description: string | null;
  board_count: number;
  card_count: number;
  agent_count: number;
  active_agent_count: number;
  document_count: number;
  kb_count?: number;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  is_global: number;
  created_at: string;
  updated_at: string;
  linked_project_ids?: string[];
}

export interface CreateKnowledgeBase {
  name: string;
  description?: string;
  is_global?: boolean;
  project_ids?: string[];
}

export interface KBEntity {
  id: string;
  kb_id: string;
  name: string;
  type: string;
  identifier: string | null;
  metadata: Record<string, unknown> | string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertKBEntity {
  kb_id: string;
  name: string;
  type?: string;
  identifier?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateKBEntity {
  name?: string;
  type?: string;
  identifier?: string;
  metadata?: Record<string, unknown>;
}

export interface KBFact {
  id: string;
  kb_id: string;
  entity_id: string | null;
  title: string;
  content: string;
  category: string;
  confidence: number;
  source_agent_id: string | null;
  created_at: string;
  updated_at: string;
  entity_name?: string;
  entity_identifier?: string;
}

export interface AddGainedKnowledge {
  kb_id: string;
  title: string;
  content: string;
  category?: string;
  entity_id?: string;
  entity_name?: string;
  entity_type?: string;
  entity_identifier?: string;
  confidence?: number;
  source_agent_id?: string;
}

export interface UpdateKBFact {
  title?: string;
  content?: string;
  category?: string;
  entity_id?: string;
  entity_name?: string;
  entity_type?: string;
  entity_identifier?: string;
  confidence?: number;
}


export interface KBRelation {
  id: string;
  kb_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  description: string | null;
  created_at: string;
  source_entity_name?: string;
  target_entity_name?: string;
}

export interface AddKBRelation {
  kb_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  description?: string;
}

export interface EntityKnowledgeResult {
  entity: KBEntity;
  facts: KBFact[];
  outgoing_relations: KBRelation[];
  incoming_relations: KBRelation[];
}

export interface KBGraphNode {
  id: string;
  name: string;
  type: string;
  identifier: string | null;
  kb_id: string;
  fact_count: number;
}

export interface KBGraphLink {
  id: string;
  source: string;
  target: string;
  relation_type: string;
  description: string | null;
}

export interface KBGraphTree {
  nodes: KBGraphNode[];
  links: KBGraphLink[];
}

