// File: src/web/App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Project, Board, Column, Card, Agent, Document, Event, ProjectSummary } from './types.js';
import { api, ApiError } from './api.js';
import { Header } from './components/Header.js';
import { AgentGrid } from './components/AgentGrid.js';
import { KanbanBoard } from './components/KanbanBoard.js';
import { DocumentVault } from './components/DocumentVault.js';
import { TacticalTerminal } from './components/TacticalTerminal.js';
import { KnowledgeBaseView } from './components/KnowledgeBase.js';
import { ThemeProvider } from './ThemeContext.js';
import {
  NewProjectModal,
  EditProjectModal,
  NewBoardModal,
  NewColumnModal,
  NewAgentModal,
  NewCardModal,
  NewDocModal,
} from './components/Modals.js';

type TabType = 'board' | 'agents' | 'docs' | 'activity' | 'kb';

// ─── URL Routing Helpers (HTML5 History API — No Hash) ─────────────────────────

function parseLocation(): { projectId: string | null; tab: TabType; docId: string | null; entityId: string | null } {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Expected pattern: /projects/:projectId/:tab, /projects/:projectId/docs/:docId, or /projects/:projectId/kb/:entityId
  if (parts[0] === 'projects' && parts[1]) {
    const projectId = parts[1];
    const rawTab = parts[2];
    const validTabs: TabType[] = ['board', 'agents', 'docs', 'activity', 'kb'];
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Modals visibility
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = useState(false);
  const [showRegisterAgentModal, setShowRegisterAgentModal] = useState(false);
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>(undefined);

  const [selectedHumanId, setSelectedHumanId] = useState<string | null>(api.getActiveHumanId());

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
      const [sumData, boardsData, agentsData, docsData, eventsData] = await Promise.all([
        api.getProjectSummary(selectedProjectId),
        api.getBoards(selectedProjectId),
        api.getAgents(),
        api.getDocuments(selectedProjectId),
        api.getEvents(selectedProjectId, 40),
      ]);

      setSummary(sumData);
      setAgents(agentsData);
      setDocuments(docsData);
      setEvents(eventsData);

      // Auto-select human operator if not selected yet
      const humanAgents = agentsData.filter(a => a.type === 'human');
      const activeId = api.getActiveHumanId();
      if ((!activeId || !humanAgents.some(h => h.id === activeId)) && humanAgents.length > 0) {
        setSelectedHumanId(humanAgents[0].id);
        api.setActiveHumanId(humanAgents[0].id);
      }


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
    setTargetColumnId(colId);
    setShowNewCardModal(true);
  };

  const handleSelectHuman = (id: string) => {
    setSelectedHumanId(id);
    api.setActiveHumanId(id);
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
    <ThemeProvider userId={selectedHumanId}>
    <div className="h-screen flex flex-col bg-cap-base cap-text-primary font-sans w-full overflow-hidden">
      
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
        agents={agents}
        selectedHumanId={selectedHumanId}
        onSelectHuman={handleSelectHuman}
      />


      {/* Main Full-Width View Area */}
      <main className="flex-1 flex flex-col min-h-0 w-full px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">

        {activeTab === 'agents' && (
          <AgentGrid
            agents={agents}
            cards={cards}
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
            documents={documents}
            onMoveCard={handleMoveCard}
            onOpenNewCard={handleOpenNewCardModal}
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

      {showNewCardModal && (
        <NewCardModal
          columns={columns}
          defaultColumnId={targetColumnId}
          onClose={() => setShowNewCardModal(false)}
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
