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
  description?: string | null;
}

export interface UpdateProject {
  name?: string;
  description?: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface CreateColumn {
  board_id: string;
  name: string;
  position?: string;
  wip_limit?: number | null;
}

export interface UpdateColumn {
  name?: string;
  position?: string;
  wip_limit?: number | null;
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
  archived: 0 | 1;
}

export interface CreateCard {
  column_id: string;
  title: string;
  description?: string | null;
  position: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string | null;
  assignees?: string[];
  labels?: string[];
}

export interface UpdateCard {
  column_id?: string;
  title?: string;
  description?: string | null;
  position?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string | null;
  archived?: 0 | 1;
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

export interface UpdateLabel {
  name?: string;
  color?: string;
}

export interface CardLabel {
  card_id: string;
  label_id: string;
}

export interface CardAssignee {
  card_id: string;
  agent_id: string;
}

export interface Comment {
  id: string;
  card_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateComment {
  card_id: string;
  author_id: string;
  content: string;
}

export interface Attachment {
  id: string;
  card_id: string;
  filename: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface CreateAttachment {
  card_id: string;
  filename: string;
  path: string;
  mime_type: string;
  size_bytes: number;
}

export interface Document {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  author_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDocument {
  project_id: string;
  parent_id?: string | null;
  title: string;
  content: string;
  status?: 'draft' | 'in_review' | 'approved' | 'archived';
  author_id: string;
}

export interface UpdateDocument {
  parent_id?: string | null;
  title?: string;
  content?: string;
  status?: 'draft' | 'in_review' | 'approved' | 'archived';
  author_id?: string;
  change_summary?: string;
}

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  title: string;
  content: string;
  author_id: string;
  change_summary: string | null;
  created_at: string;
}

export interface CreateDocumentVersion {
  document_id: string;
  version: number;
  content: string;
  author_id: string;
  change_summary?: string | null;
}

export interface AgentRegistration {
  id: string;
  project_id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities: string;
  status: 'active' | 'idle' | 'offline';
  last_seen_at: string;
  created_at: string;
}

export interface CreateAgentRegistration {
  project_id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities: string;
  status: 'active' | 'idle' | 'offline';
}

export interface UpdateAgentRegistration {
  name?: string;
  role?: 'owner' | 'contributor' | 'observer';
  capabilities?: string;
  status?: 'active' | 'idle' | 'offline';
  last_seen_at?: string;
}

export interface CAPEvent {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  payload: string;
  created_at: string;
}

export interface CreateCAPEvent {
  project_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  payload: string;
}
