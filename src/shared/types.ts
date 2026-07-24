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
  labels?: string[];
  assignees?: string[];
}

export interface UpdateCard {
  title?: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string | null;
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
  project_id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities: string[];
  status: 'active' | 'idle' | 'offline';
  last_seen_at: string;
  created_at: string;
}

export interface RegisterAgent {
  project_id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities?: string | string[];
  status?: 'active' | 'idle' | 'offline';
}

export interface UpdateAgentStatus {
  status: 'active' | 'idle' | 'offline';
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
}

export interface Event {
  id: string;
  project_id: string;
  entity_type: 'project' | 'board' | 'column' | 'card' | 'document' | 'agent';
  entity_id: string;
  action: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateEvent {
  project_id: string;
  entity_type: 'project' | 'board' | 'column' | 'card' | 'document' | 'agent';
  entity_id: string;
  action: string;
  actor_id?: string;
  payload?: Record<string, unknown>;
}

export interface CardDetails extends Card {
  assignees: Agent[];
  labels: Label[];
  comments: Comment[];
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
