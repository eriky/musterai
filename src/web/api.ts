import {
  Project, Board, Column, Card, Label, Document, DocumentVersion, AgentRegistration, CAPEvent, Comment
} from './types';

const API_BASE = '/api';

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function createProject(data: { name: string; description?: string }): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function fetchProjectSummary(id: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${id}/summary`);
  if (!res.ok) throw new Error('Failed to fetch project summary');
  return res.json();
}

export async function fetchBoards(projectId: string): Promise<Board[]> {
  const res = await fetch(`${API_BASE}/boards?projectId=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch boards');
  return res.json();
}

export async function createBoard(data: { project_id: string; name: string }): Promise<Board> {
  const res = await fetch(`${API_BASE}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create board');
  return res.json();
}

export async function fetchBoardDetails(boardId: string): Promise<Board> {
  const res = await fetch(`${API_BASE}/boards/${boardId}`);
  if (!res.ok) throw new Error('Failed to fetch board details');
  return res.json();
}

export async function createColumn(data: { board_id: string; name: string; position?: string; wip_limit?: number | null }): Promise<Column> {
  const res = await fetch(`${API_BASE}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create column');
  return res.json();
}

export async function fetchCards(filters?: { column_id?: string; board_id?: string }): Promise<Card[]> {
  const params = new URLSearchParams();
  if (filters?.column_id) params.append('columnId', filters.column_id);
  if (filters?.board_id) params.append('boardId', filters.board_id);
  const res = await fetch(`${API_BASE}/cards?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
}

export async function fetchCardDetails(cardId: string): Promise<Card> {
  const res = await fetch(`${API_BASE}/cards/${cardId}`);
  if (!res.ok) throw new Error('Failed to fetch card details');
  return res.json();
}

export async function createCard(data: { column_id: string; title: string; description?: string; priority?: string }): Promise<Card> {
  const res = await fetch(`${API_BASE}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create card');
  return res.json();
}

export async function moveCard(cardId: string, targetColumnId: string, position?: string): Promise<Card> {
  const res = await fetch(`${API_BASE}/cards/${cardId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_column_id: targetColumnId, position }),
  });
  if (!res.ok) throw new Error('Failed to move card');
  return res.json();
}

export async function updateCard(cardId: string, data: Partial<Card>): Promise<Card> {
  const res = await fetch(`${API_BASE}/cards/${cardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update card');
  return res.json();
}

export async function addComment(cardId: string, authorId: string, content: string): Promise<Comment> {
  const res = await fetch(`${API_BASE}/cards/${cardId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author_id: authorId, content }),
  });
  if (!res.ok) throw new Error('Failed to add comment');
  return res.json();
}

export async function assignCard(cardId: string, agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cards/${cardId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!res.ok) throw new Error('Failed to assign card');
}

export async function unassignCard(cardId: string, agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cards/${cardId}/unassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!res.ok) throw new Error('Failed to unassign card');
}

export async function fetchDocuments(projectId: string): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/documents?projectId=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function createDocument(data: { project_id: string; title: string; content: string; author_id: string; parent_id?: string }): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create document');
  return res.json();
}

export async function updateDocument(id: string, data: { title?: string; content?: string; author_id?: string; change_summary?: string }): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update document');
  return res.json();
}

export async function fetchDocumentHistory(id: string): Promise<DocumentVersion[]> {
  const res = await fetch(`${API_BASE}/documents/${id}/history`);
  if (!res.ok) throw new Error('Failed to fetch document history');
  return res.json();
}

export async function fetchAgents(projectId: string): Promise<AgentRegistration[]> {
  const res = await fetch(`${API_BASE}/agents?projectId=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function registerAgent(data: { project_id: string; name: string; type: 'ai_agent' | 'human'; role: 'owner' | 'contributor' | 'observer'; capabilities: string }): Promise<AgentRegistration> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to register agent');
  return res.json();
}

export async function fetchEvents(projectId: string): Promise<CAPEvent[]> {
  const res = await fetch(`${API_BASE}/events?projectId=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export function subscribeEvents(projectId: string, onEvent: (evt: CAPEvent) => void): () => void {
  const eventSource = new EventSource(`${API_BASE}/events/stream?projectId=${projectId}`);
  eventSource.onmessage = (event) => {
    try {
      const parsed: CAPEvent = JSON.parse(event.data);
      onEvent(parsed);
    } catch (err) {
      console.error('Error parsing SSE event:', err);
    }
  };
  return () => {
    eventSource.close();
  };
}
