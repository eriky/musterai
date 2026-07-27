// File: src/web/api.ts
import { Project, Board, Column, Card, CardDetails, Document, DocumentVersion, Agent, Event, ProjectSummary, Label, KnowledgeBase, KBEntity, KBFact, KBRelation, EntityKnowledgeResult, KBGraphTree, CardLinkRelationType, CreateCardWorkLink } from './types.js';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      ...headers,
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(res.status, `API Error (${res.status}): ${errText}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Projects
  getProjects: () => fetchJSON<Project[]>('/projects'),
  createProject: (data: { name: string; description?: string }) => fetchJSON<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProjectSummary: (id: string) => fetchJSON<ProjectSummary>(`/projects/${id}/summary`),
  updateProject: (id: string, data: { name?: string; description?: string }) =>
    fetchJSON<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => fetchJSON<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Boards
  getBoards: (projectId: string) => fetchJSON<Board[]>(`/projects/${projectId}/boards`),
  createBoard: (projectId: string, name: string, template?: 'simple' | 'standard', columns?: string[]) =>
    fetchJSON<Board>(`/projects/${projectId}/boards`, { method: 'POST', body: JSON.stringify({ name, template, columns }) }),
  getBoardDetails: (id: string) => fetchJSON<Board & { columns: Column[]; cards: Card[] }>(`/boards/${id}`),
  updateBoard: (id: string, name: string) => fetchJSON<Board>(`/boards/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteBoard: (id: string) => fetchJSON<void>(`/boards/${id}`, { method: 'DELETE' }),

  // Columns
  createColumn: (boardId: string, name: string, wipLimit?: number) => fetchJSON<Column>(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify({ name, wip_limit: wipLimit }) }),
  updateColumn: (id: string, data: Partial<Column>) => fetchJSON<Column>(`/columns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  moveColumn: (id: string, position: string) => fetchJSON<Column>(`/columns/${id}`, { method: 'PUT', body: JSON.stringify({ position }) }),
  deleteColumn: (id: string) => fetchJSON<void>(`/columns/${id}`, { method: 'DELETE' }),

  // Cards
  getCards: (boardId: string) => fetchJSON<Card[]>(`/boards/${boardId}/cards`),
  createCard: (columnId: string, data: { title: string; description?: string; priority?: string; status?: string; blocked_reason?: string | null; labels?: string[]; assignees?: string[]; is_epic?: boolean }) =>
    fetchJSON<Card>(`/columns/${columnId}/cards`, { method: 'POST', body: JSON.stringify(data) }),
  getCardDetails: (id: string) => fetchJSON<CardDetails>(`/cards/${id}`),
  updateCard: (id: string, data: Partial<Card>) => fetchJSON<CardDetails>(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  moveCard: (id: string, targetColumnId: string, position?: string) =>
    fetchJSON<CardDetails>(`/cards/${id}/move`, { method: 'PATCH', body: JSON.stringify({ target_column_id: targetColumnId, position }) }),
  assignCard: (cardId: string, agentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/assignees`, { method: 'POST', body: JSON.stringify({ agent_id: agentId }) }),
  unassignCard: (cardId: string, agentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/assignees/${agentId}`, { method: 'DELETE' }),
  addComment: (cardId: string, authorId: string, content: string) => fetchJSON<any>(`/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify({ author_id: authorId, content }) }),
  linkDocument: (cardId: string, documentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/documents`, { method: 'POST', body: JSON.stringify({ document_id: documentId }) }),
  unlinkDocument: (cardId: string, documentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/documents/${documentId}`, { method: 'DELETE' }),
  searchCards: (projectId: string, query: string, excludeCardId?: string) => {
    let url = `/projects/${projectId}/cards/search?q=${encodeURIComponent(query)}`;
    if (excludeCardId) url += `&exclude_card_id=${excludeCardId}`;
    return fetchJSON<Card[]>(url);
  },
  linkCard: (cardId: string, targetCardId: string, relationType: CardLinkRelationType) =>
    fetchJSON<CardDetails>(`/cards/${cardId}/links`, { method: 'POST', body: JSON.stringify({ target_card_id: targetCardId, relation_type: relationType }) }),
  unlinkCard: (cardId: string, linkId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/links/${linkId}`, { method: 'DELETE' }),
  addWorkLink: (cardId: string, data: CreateCardWorkLink) =>
    fetchJSON<CardDetails>(`/cards/${cardId}/work-links`, { method: 'POST', body: JSON.stringify(data) }),
  removeWorkLink: (cardId: string, linkId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/work-links/${linkId}`, { method: 'DELETE' }),
  deleteCard: (id: string) => fetchJSON<void>(`/cards/${id}`, { method: 'DELETE' }),


  // Documents
  getDocuments: (projectId: string) => fetchJSON<Document[]>(`/projects/${projectId}/documents`),
  createDocument: (projectId: string, data: { title: string; content: string; parent_id?: string; author_id?: string }) =>
    fetchJSON<Document>(`/projects/${projectId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  getDocumentDetails: (id: string) => fetchJSON<Document>(`/documents/${id}`),
  updateDocument: (id: string, data: { title?: string; content?: string; change_summary?: string; author_id?: string }) =>
    fetchJSON<Document>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDocumentStatus: (id: string, status: string) => fetchJSON<Document>(`/documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getDocumentHistory: (id: string) => fetchJSON<DocumentVersion[]>(`/documents/${id}/versions`),

  // Agents & Settings
  getAgents: () => fetchJSON<Agent[]>(`/agents`),
  registerAgent: (data: { name: string; capabilities?: string }) =>
    fetchJSON<Agent>(`/agents`, { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: { name?: string; capabilities?: string; status?: string; operator_user_id?: string | null; role_id?: string | null }) =>
    fetchJSON<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  unregisterAgent: (id: string) => fetchJSON<void>(`/agents/${id}`, { method: 'DELETE' }),
  agentHeartbeat: (id: string) => fetchJSON<Agent>(`/agents/${id}/heartbeat`, { method: 'POST' }),



  // Events
  getEvents: (projectId: string, limit: number = 30) => fetchJSON<Event[]>(`/projects/${projectId}/events?limit=${limit}`),

  // Knowledge Base
  getKBs: (projectId?: string) => fetchJSON<KnowledgeBase[]>(projectId ? `/kbs?project_id=${projectId}` : '/kbs'),
  createKB: (data: { name: string; description?: string; is_global?: boolean; project_ids?: string[] }) =>
    fetchJSON<KnowledgeBase>('/kbs', { method: 'POST', body: JSON.stringify(data) }),
  linkKB: (kbId: string, projectId: string) => fetchJSON<void>(`/kbs/${kbId}/link`, { method: 'POST', body: JSON.stringify({ project_id: projectId }) }),
  unlinkKB: (kbId: string, projectId: string) => fetchJSON<void>(`/kbs/${kbId}/unlink`, { method: 'POST', body: JSON.stringify({ project_id: projectId }) }),
  deleteKB: (id: string) => fetchJSON<void>(`/kbs/${id}`, { method: 'DELETE' }),
  searchKnowledge: (query: string, kbId?: string, projectId?: string) => {
    let url = `/kbs/search?q=${encodeURIComponent(query)}`;
    if (kbId) url += `&kb_id=${kbId}`;
    if (projectId) url += `&project_id=${projectId}`;
    return fetchJSON<{ facts: KBFact[]; entities: KBEntity[] }>(url);
  },
  getGraphTree: (kbId?: string, projectId?: string) => {
    let url = '/kbs/graph';
    if (kbId) url += `?kb_id=${kbId}`;
    else if (projectId) url += `?project_id=${projectId}`;
    return fetchJSON<KBGraphTree>(url);
  },
  getEntityKnowledge: (queryStr: string, kbId?: string) => {
    let url = `/kbs/entity-knowledge?q=${encodeURIComponent(queryStr)}`;
    if (kbId) url += `&kb_id=${kbId}`;
    return fetchJSON<EntityKnowledgeResult>(url);
  },
  getKBFacts: (kbId: string) => fetchJSON<KBFact[]>(`/kbs/${kbId}/facts`),
  addFact: (data: { kb_id: string; title: string; content: string; category?: string; entity_name?: string; entity_identifier?: string; entity_type?: string }) =>
    fetchJSON<KBFact>('/kbs/facts', { method: 'POST', body: JSON.stringify(data) }),
  updateFact: (id: string, data: Partial<{ title: string; content: string; category: string; entity_name: string; entity_identifier: string; entity_type: string }>) =>
    fetchJSON<KBFact>(`/kbs/facts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFact: (id: string) => fetchJSON<void>(`/kbs/facts/${id}`, { method: 'DELETE' }),
  upsertEntity: (data: { kb_id: string; name: string; type?: string; identifier?: string }) =>
    fetchJSON<KBEntity>('/kbs/entities', { method: 'POST', body: JSON.stringify(data) }),
  updateEntity: (id: string, data: Partial<{ name: string; type: string; identifier: string }>) =>
    fetchJSON<KBEntity>(`/kbs/entities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addRelation: (data: { kb_id: string; source_entity_id: string; target_entity_id: string; relation_type: string; description?: string }) =>
    fetchJSON<KBRelation>('/kbs/relations', { method: 'POST', body: JSON.stringify(data) }),
};

