// File: src/web/types.ts

export interface Project {
  id: string;
  name: string;
  description: string | null;
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

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  archived: number;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities: string[];
  status: 'active' | 'idle' | 'offline';
  last_seen_at: string;
  created_at: string;
}

export interface CardDetails extends Card {
  assignees: Agent[];
  labels: Label[];
  linked_documents: Document[];
  comments: {
    id: string;
    card_id: string;
    author_id: string;
    author_name?: string;
    content: string;
    created_at: string;
  }[];
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

export interface Event {
  id: string;
  project_id: string;
  entity_type: 'card' | 'column' | 'board' | 'document' | 'agent' | 'project';
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
