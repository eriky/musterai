// File: src/web/App.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Project, Board, Column, Card, Agent, User, AuthMe, Document, Event, ProjectSummary } from './types.js';
import { api, ApiError } from './api.js';
import { Header } from './components/Header.js';
import { AgentGrid } from './components/AgentGrid.js';
import { KanbanBoard } from './components/KanbanBoard.js';
import { DocumentVault } from './components/DocumentVault.js';
import { TacticalTerminal } from './components/TacticalTerminal.js';
import { KnowledgeBaseView } from './components/KnowledgeBase.js';
import { TokensView } from './components/TokensView.js';
import { WorkspaceAdmin } from './components/WorkspaceAdmin.js';
import { ThemeProvider } from './ThemeContext.js';
import {
  NewProjectModal,
  EditProjectModal,
  NewBoardModal,
  NewColumnModal,
  NewAgentModal,
  NewDocModal,
} from './components/Modals.js';

type TabType = 'board' | 'agents' | 'docs' | 'activity' | 'kb' | 'tokens' | 'admin';

// ─── URL Routing Helpers (HTML5 History API — No Hash) ─────────────────────────

function parseLocation(): { projectId: string | null; tab: TabType; docId: string | null; entityId: string | null } {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Expected pattern: /projects/:projectId/:tab, /projects/:projectId/docs/:docId, or /projects/:projectId/kb/:entityId
  if (parts[0] === 'projects' && parts[1]) {
    const projectId = parts[1];
    const rawTab = parts[2];
    const validTabs: TabType[] = ['board', 'agents', 'docs', 'activity', 'kb', 'tokens', 'admin'];
    const tab = validTabs.includes(rawTab as TabType) ? (rawTab as TabType) : 'board';
    const docId = tab === 'docs' && parts[3] ? parts[3] : null;
    const entityId = tab === 'kb' && parts[3] ? parts[3] : null;
    return { projectId, tab, docId, entityId };
  }
  return { projectId: null, tab: 'board', docId: null, entityId: null };
}


function updateLocation(
  projectId: string | null,
  tab: TabType,
  docId?: string | null,
  entityId?: string | null,
  replace = false,
) {
  if (!projectId) return;
  let targetPath = `/projects/${projectId}/${tab}`;
  if (tab === 'docs' && docId) {
    targetPath += `/${docId}`;
  } else if (tab === 'kb' && entityId) {
    targetPath += `/${entityId}`;
  }
  if (window.location.pathname !== targetPath) {
    if (replace) {
      window.history.replaceState(null, '', targetPath);
    } else {
      window.history.pushState(null, '', targetPath);
    }
  }
}

// ─── Main App Component ────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const initialNav = parseLocation();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialNav.projectId);
  const [activeTab, setActiveTab] = useState<TabType>(initialNav.tab);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initialNav.docId);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initialNav.entityId);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthMe['user'] | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Modals visibility
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = useState(false);
  const [showRegisterAgentModal, setShowRegisterAgentModal] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newCardRequest, setNewCardRequest] = useState<{ columnId?: string; token: number } | null>(null);
  const newCardTokenRef = useRef(0);

  // Load Projects
  const loadProjects = useCallback(async (selectId?: string) => {
    try {
      const list = await api.getProjects();
      setProjects(list);

      const nav = parseLocation();
      let targetId = selectId || nav.projectId;

      // Validate URL project ID exists in projects list
      if (targetId && !list.some((p) => p.id === targetId)) {
        targetId = null;
      }

      if (!targetId && list.length > 0) {
        targetId = list[0].id;
      }

      if (targetId) {
        setSelectedProjectId(targetId);
        updateLocation(targetId, activeTab, selectedDocId, selectedEntityId, true);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }, [activeTab, selectedDocId, selectedEntityId]);

  // Load Selected Project Data
  const loadProjectData = useCallback(async () => {
    if (!selectedProjectId) return;

    try {
      const [sumData, boardsData, agentsData, usersData, docsData, eventsData] = await Promise.all([
        api.getProjectSummary(selectedProjectId),
        api.getBoards(selectedProjectId),
        api.getAgents(),
        api.getUsers(),
        api.getDocuments(selectedProjectId),
        api.getEvents(selectedProjectId, 40),
      ]);

      setSummary(sumData);
      setAgents(agentsData);
      setUsers(usersData);
      setDocuments(docsData);
      setEvents(eventsData);


      if (boardsData.length > 0) {
        const boardDetails = await api.getBoardDetails(boardsData[0].id);
        setBoard(boardDetails);
        setColumns(boardDetails.columns || []);
        setCards(boardDetails.cards || []);
      } else {
        setBoard(null);
        setColumns([]);
        setCards([]);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Project was deleted — clear selection and reload the list
        setSelectedProjectId(null);
        setSummary(null);
        setBoard(null);
        setColumns([]);
        setCards([]);
        setAgents([]);
        setUsers([]);
        setDocuments([]);
        setEvents([]);
        loadProjects();
      } else {
        console.error('Error loading project data:', err);
      }
    }
  }, [selectedProjectId, loadProjects]);

  // Sync state when selectedProjectId or activeTab or selectedDocId changes
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    updateLocation(projectId, activeTab, selectedDocId, selectedEntityId);
  };

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (selectedProjectId) {
      updateLocation(selectedProjectId, tab, selectedDocId, selectedEntityId);
    }
  };

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    if (selectedProjectId) {
      updateLocation(selectedProjectId, 'docs', docId, null);
    }
  };

  // Handle Browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const { projectId, tab, docId, entityId } = parseLocation();
      if (projectId) {
        setSelectedProjectId(projectId);
      }
      setActiveTab(tab);
      setSelectedDocId(docId);
      setSelectedEntityId(entityId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Who's signed in — drives the header display, comment authorship default,
  // and per-user theme storage. Null in open/local mode (no OIDC session).
  useEffect(() => {
    api.getMe()
      .then((me) => {
        setCurrentUser(me.user);
        setWorkspaceId(me.workspace?.id || null);
      })
      .catch((err) => console.error('Error loading current user:', err));
  }, []);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // Real-Time SSE Event Stream + Polling Fallback Hook
  useEffect(() => {
    if (!selectedProjectId) return;

    // 1. Real-Time SSE EventSource
    const sseUrl = `/api/v1/projects/${selectedProjectId}/events/stream`;
    const eventSource = new EventSource(sseUrl);

    const handleEvent = (e: MessageEvent) => {
      try {
        const newEvt: Event = JSON.parse(e.data);
        setEvents((prev) => [newEvt, ...prev.slice(0, 49)]);
        loadProjectData();
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onmessage = handleEvent;
    eventSource.onerror = (err) => {
      console.warn('SSE connection error, falling back to polling:', err);
    };

    // 2. Continuous 3-second background polling fallback
    const pollInterval = setInterval(() => {
      loadProjectData();
    }, 3000);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [selectedProjectId, loadProjectData]);

  const handleMoveCard = async (cardId: string, targetColumnId: string, position?: string) => {
    try {
      await api.moveCard(cardId, targetColumnId, position);
      loadProjectData();
    } catch (err) {
      console.error('Failed to move card:', err);
    }
  };

  const handleMoveColumn = async (columnId: string, position: string) => {
    try {
      await api.moveColumn(columnId, position);
      loadProjectData();
    } catch (err) {
      console.error('Failed to move column:', err);
    }
  };

  const handleAgentHeartbeat = async (agentId: string) => {
    try {
      await api.agentHeartbeat(agentId);
      loadProjectData();
    } catch (err) {
      console.error('Failed to send heartbeat:', err);
    }
  };

  const handleUnregisterAgent = async (agentId: string) => {
    try {
      await api.unregisterAgent(agentId);
      loadProjectData();
    } catch (err) {
      console.error('Failed to unregister agent:', err);
    }
  };

  const handleOpenNewCardModal = (colId?: string) => {
    newCardTokenRef.current += 1;
    setNewCardRequest({ columnId: colId, token: newCardTokenRef.current });
    if (activeTab !== 'board') {
      handleSelectTab('board');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId);
      const remaining = projects.filter((p) => p.id !== projectId);
      const nextProjectId = remaining.length > 0 ? remaining[0].id : undefined;
      setSelectedProjectId(nextProjectId || null);
      loadProjects(nextProjectId);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await api.deleteBoard(boardId);
      loadProjectData();
    } catch (err) {
      console.error('Failed to delete board:', err);
    }
  };

  return (
    <ThemeProvider userId={currentUser?.id ?? null}>
    <div className="h-screen flex flex-col bg-muster-base muster-text-primary font-sans w-full overflow-hidden">

      {/* Platform Header */}
      <Header
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        onOpenEditProject={() => setShowEditProjectModal(true)}
        summary={summary}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenNewProject={() => setShowNewProjectModal(true)}
        onOpenNewBoard={() => setShowNewBoardModal(true)}
        onOpenRegisterAgent={() => setShowRegisterAgentModal(true)}
        onOpenNewCard={() => handleOpenNewCardModal()}
        onOpenNewDoc={() => setShowNewDocModal(true)}
        currentUser={currentUser}
      />


      {/* Main Full-Width View Area */}
      <main className="flex-1 flex flex-col min-h-0 w-full px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">

        {activeTab === 'agents' && (
          <AgentGrid
            agents={agents}
            users={users}
            cards={cards}
            workspaceId={workspaceId}
            onHeartbeat={handleAgentHeartbeat}
            onUnregisterAgent={handleUnregisterAgent}
            onOpenRegisterAgent={() => setShowRegisterAgentModal(true)}
            onRefresh={loadProjectData}
          />
        )}


        {activeTab === 'board' && (
          <KanbanBoard
            board={board}
            columns={columns}
            cards={cards}
            agents={agents}
            users={users}
            currentUser={currentUser}
            documents={documents}
            projectId={selectedProjectId}
            newCardRequest={newCardRequest}
            onMoveCard={handleMoveCard}
            onMoveColumn={handleMoveColumn}
            onNewCardRequestHandled={() => setNewCardRequest(null)}
            onOpenNewColumn={() => setShowNewColumnModal(true)}
            onDeleteBoard={handleDeleteBoard}
            onOpenDocumentInVault={(docId) => {
              setActiveTab('docs');
              handleSelectDoc(docId);
            }}
            onRefresh={loadProjectData}
          />
        )}


        {activeTab === 'docs' && (
          <DocumentVault
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={handleSelectDoc}
            onOpenNewDoc={() => setShowNewDocModal(true)}
            onRefresh={loadProjectData}
          />
        )}

        {activeTab === 'kb' && (
          <KnowledgeBaseView
            currentProject={projects.find((p) => p.id === selectedProjectId) || null}
            initialEntityId={selectedEntityId}
            onSelectEntity={(entityId) => {
              setSelectedEntityId(entityId);
              if (selectedProjectId) {
                updateLocation(selectedProjectId, 'kb', null, entityId);
              }
            }}
          />
        )}


        {activeTab === 'activity' && (
          <TacticalTerminal
            events={events}
            agents={agents}
            cards={cards}
            documents={documents}
            onRefresh={loadProjectData}
          />
        )}

        {activeTab === 'tokens' && <TokensView />}

        {activeTab === 'admin' && (
          workspaceId
            ? <WorkspaceAdmin workspaceId={workspaceId} currentUser={currentUser} />
            : <div className="text-center py-16 muster-text-muted text-sm">No workspace found yet.</div>
        )}
      </main>


      {/* Modals */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onSuccess={(newId) => {
            handleSelectProject(newId);
            loadProjects(newId);
          }}
        />
      )}

      {showEditProjectModal && selectedProjectId && projects.some((p) => p.id === selectedProjectId) && (
        <EditProjectModal
          project={projects.find((p) => p.id === selectedProjectId)!}
          onClose={() => setShowEditProjectModal(false)}
          onSuccess={() => {
            loadProjects(selectedProjectId);
            loadProjectData();
          }}
        />
      )}

      {showNewBoardModal && selectedProjectId && (
        <NewBoardModal
          projectId={selectedProjectId}
          onClose={() => setShowNewBoardModal(false)}
          onSuccess={loadProjectData}
        />
      )}

      {showNewColumnModal && board && (
        <NewColumnModal
          boardId={board.id}
          onClose={() => setShowNewColumnModal(false)}
          onSuccess={loadProjectData}
        />
      )}

      {showRegisterAgentModal && (
        <NewAgentModal
          onClose={() => setShowRegisterAgentModal(false)}
          onSuccess={loadProjectData}
        />
      )}

      {showNewDocModal && selectedProjectId && (
        <NewDocModal
          projectId={selectedProjectId}
          onClose={() => setShowNewDocModal(false)}
          onSuccess={(newDoc) => {
            if (newDoc && newDoc.id) {
              handleSelectDoc(newDoc.id);
            }
            loadProjectData();
          }}
        />
      )}
    </div>
    </ThemeProvider>
  );
};
