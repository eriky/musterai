// File: src/web/api.ts
import { Project, Board, Column, Card, CardDetails, Document, Agent, Event, ProjectSummary, Label } from './types.js';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
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

  // Boards
  getBoards: (projectId: string) => fetchJSON<Board[]>(`/projects/${projectId}/boards`),
  createBoard: (projectId: string, name: string) => fetchJSON<Board>(`/projects/${projectId}/boards`, { method: 'POST', body: JSON.stringify({ name }) }),
  getBoardDetails: (id: string) => fetchJSON<Board & { columns: Column[]; cards: Card[] }>(`/boards/${id}`),

  // Columns
  createColumn: (boardId: string, name: string, wipLimit?: number) => fetchJSON<Column>(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify({ name, wip_limit: wipLimit }) }),
  updateColumn: (id: string, data: Partial<Column>) => fetchJSON<Column>(`/columns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteColumn: (id: string) => fetchJSON<void>(`/columns/${id}`, { method: 'DELETE' }),

  // Cards
  getCards: (boardId: string) => fetchJSON<Card[]>(`/boards/${boardId}/cards`),
  createCard: (columnId: string, data: { title: string; description?: string; priority?: string; labels?: string[]; assignees?: string[] }) =>
    fetchJSON<Card>(`/columns/${columnId}/cards`, { method: 'POST', body: JSON.stringify(data) }),
  getCardDetails: (id: string) => fetchJSON<CardDetails>(`/cards/${id}`),
  updateCard: (id: string, data: Partial<Card>) => fetchJSON<CardDetails>(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  moveCard: (id: string, targetColumnId: string, position?: string) =>
    fetchJSON<CardDetails>(`/cards/${id}/move`, { method: 'PATCH', body: JSON.stringify({ target_column_id: targetColumnId, position }) }),
  assignCard: (cardId: string, agentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/assignees`, { method: 'POST', body: JSON.stringify({ agent_id: agentId }) }),
  addComment: (cardId: string, authorId: string, content: string) => fetchJSON<any>(`/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify({ author_id: authorId, content }) }),
  linkDocument: (cardId: string, documentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/documents`, { method: 'POST', body: JSON.stringify({ document_id: documentId }) }),
  unlinkDocument: (cardId: string, documentId: string) => fetchJSON<CardDetails>(`/cards/${cardId}/documents/${documentId}`, { method: 'DELETE' }),

  // Documents
  getDocuments: (projectId: string) => fetchJSON<Document[]>(`/projects/${projectId}/documents`),
  createDocument: (projectId: string, data: { title: string; content: string; parent_id?: string; author_id?: string }) =>
    fetchJSON<Document>(`/projects/${projectId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  getDocumentDetails: (id: string) => fetchJSON<Document>(`/documents/${id}`),
  updateDocument: (id: string, data: { title?: string; content?: string; change_summary?: string; author_id?: string }) =>
    fetchJSON<Document>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDocumentStatus: (id: string, status: string) => fetchJSON<Document>(`/documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getDocumentHistory: (id: string) => fetchJSON<any[]>(`/documents/${id}/versions`),

  // Agents
  getAgents: () => fetchJSON<Agent[]>(`/agents`),
  registerAgent: (data: { name: string; type: string; role: string; capabilities?: string }) =>
    fetchJSON<Agent>(`/agents`, { method: 'POST', body: JSON.stringify(data) }),
  unregisterAgent: (id: string) => fetchJSON<void>(`/agents/${id}`, { method: 'DELETE' }),
  agentHeartbeat: (id: string) => fetchJSON<Agent>(`/agents/${id}/heartbeat`, { method: 'POST' }),

  // Events
  getEvents: (projectId: string, limit: number = 30) => fetchJSON<Event[]>(`/projects/${projectId}/events?limit=${limit}`),
};
