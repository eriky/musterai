export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  board_count?: number;
  agent_count?: number;
  document_count?: number;
  card_count?: number;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  columns?: Column[];
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: string;
  wip_limit: number | null;
  created_at: string;
  updated_at: string;
  card_count?: number;
  cards?: Card[];
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
  labels?: Label[];
  assignees?: CardAssignee[];
  comments?: Comment[];
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
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

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content: string;
  author_id: string;
  change_summary: string | null;
  created_at: string;
}

export interface AgentRegistration {
  id: string;
  project_id: string;
  name: string;
  type: 'ai_agent' | 'human';
  role: 'owner' | 'contributor' | 'observer';
  capabilities: string[] | string;
  status: 'active' | 'idle' | 'offline';
  last_seen_at: string;
  created_at: string;
}

export interface CAPEvent {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  payload: any;
  created_at: string;
}
