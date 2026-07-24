// File: src/web/App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Project, Board, Column, Card, Agent, Document, Event, ProjectSummary } from './types.js';
import { api, ApiError } from './api.js';
import { Header } from './components/Header.js';
import { AgentGrid } from './components/AgentGrid.js';
import { KanbanBoard } from './components/KanbanBoard.js';
import { DocumentVault } from './components/DocumentVault.js';
import { TacticalTerminal } from './components/TacticalTerminal.js';
import {
  NewProjectModal,
  NewBoardModal,
  NewColumnModal,
  NewAgentModal,
  NewCardModal,
  NewDocModal,
} from './components/Modals.js';

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [activeTab, setActiveTab] = useState<'agents' | 'board' | 'docs' | 'activity'>('board');

  // Modals visibility
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showNewColumnModal, setShowNewColumnModal] = useState(false);
  const [showRegisterAgentModal, setShowRegisterAgentModal] = useState(false);
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>(undefined);

  // Load Projects
  const loadProjects = useCallback(async (selectId?: string) => {
    try {
      const list = await api.getProjects();
      setProjects(list);
      if (selectId) {
        setSelectedProjectId(selectId);
      } else if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }, [selectedProjectId]);

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

  return (
    <div className="min-h-screen flex flex-col bg-command-bg text-zinc-100 font-sans w-full">
      
      {/* Platform Header */}
      <Header
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        summary={summary}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewProject={() => setShowNewProjectModal(true)}
        onOpenNewBoard={() => setShowNewBoardModal(true)}
        onOpenRegisterAgent={() => setShowRegisterAgentModal(true)}
        onOpenNewCard={() => handleOpenNewCardModal()}
        onOpenNewDoc={() => setShowNewDocModal(true)}
      />

      {/* Main Full-Width View Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'agents' && (
          <AgentGrid
            agents={agents}
            cards={cards}
            onHeartbeat={handleAgentHeartbeat}
            onUnregisterAgent={handleUnregisterAgent}
            onOpenRegisterAgent={() => setShowRegisterAgentModal(true)}
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
            onRefresh={loadProjectData}
          />
        )}

        {activeTab === 'docs' && (
          <DocumentVault
            documents={documents}
            onOpenNewDoc={() => setShowNewDocModal(true)}
            onRefresh={loadProjectData}
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
          onSuccess={(newId) => loadProjects(newId)}
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
          onSuccess={loadProjectData}
        />
      )}

    </div>
  );
};
