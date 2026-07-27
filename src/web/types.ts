// File: src/web/types.ts

export interface Project {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  card_seq: number;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: string;
  wip_limit: number | null;
}

export interface CardAssignee {
  id: string;
  name: string;
  kind: 'user' | 'agent';
  status: 'active' | 'idle' | 'offline';
}

export interface Card {
  id: string;
  key: string;
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
  /** Marks this card as a container for related work — see 'parent_of' link type. */
  is_epic: number;
  assignees?: CardAssignee[];
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  status: 'active' | 'idle' | 'offline';
  last_seen_at: string;
  created_at: string;
  operator_user_id?: string | null;
  role_id?: string | null;
  workspace_id?: string | null;
}

export interface User {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
}


/** Document without its markdown body — cards embed this, never the full content. */
export type DocumentSummary = Omit<Document, 'content'>;

export interface CardDetails extends Card {
  assignees: CardAssignee[];
  labels: Label[];
  linked_documents: DocumentSummary[];
  linked_cards: LinkedCardSummary[];
  work_links: CardWorkLink[];
  comments: {
    id: string;
    card_id: string;
    author_id: string;
    author_name?: string;
    content: string;
    created_at: string;
  }[];
}

export type CardWorkLinkKind = 'branch' | 'pull_request' | 'commit' | 'pipeline';
export type CardWorkLinkProvider = 'forgejo' | 'github' | 'gitlab' | 'other';

export interface CardWorkLink {
  id: string;
  card_id: string;
  kind: CardWorkLinkKind;
  provider: CardWorkLinkProvider;
  url: string;
  external_ref: string | null;
  title: string | null;
  status: string | null;
  created_at: string;
}

export interface CreateCardWorkLink {
  kind: CardWorkLinkKind;
  provider: CardWorkLinkProvider;
  url: string;
  external_ref?: string;
  title?: string;
  status?: string;
}

// Stored relation types are directional; 'blocked_by' is the inverse view of
// a 'blocks' row and is never sent to the API directly.
// 'blocked_by' and 'child_of' are inverse views computed by the server —
// never written directly. See shared/types.ts for the canonical comment.
export type StoredCardLinkType = 'blocks' | 'relates_to' | 'duplicates' | 'parent_of';
export type CardLinkRelationType = StoredCardLinkType | 'blocked_by' | 'child_of';

export interface LinkedCardSummary {
  id: string;
  relation_type: CardLinkRelationType;
  card: {
    id: string;
    title: string;
    column_id: string;
    status: 'active' | 'blocked' | 'in_review';
    priority: 'critical' | 'high' | 'medium' | 'low';
    archived: number;
  };
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

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  title: string;
  content: string;
  author_id: string | null;
  author_name?: string | null;
  change_summary: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  project_id: string;
  entity_type: 'card' | 'column' | 'board' | 'document' | 'agent' | 'project' | 'knowledge_base';
  entity_id: string;

  action: string;
  actor_id: string | null;
  payload: any;
  created_at: string;
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

export interface KBEntity {
  id: string;
  kb_id: string;
  name: string;
  type: string;
  identifier: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface KBFact {
  id: string;
  kb_id: string;
  entity_id: string | null;
  title: string;
  content: string;
  category: string;
  confidence: number;
  source_principal_id: string | null;
  created_at: string;
  updated_at: string;
  entity_name?: string;
  entity_identifier?: string;
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
