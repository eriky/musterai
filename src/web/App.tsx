import React, { useState, useEffect } from 'react';
import { Project, Board, Document, AgentRegistration, CAPEvent, Card } from './types';
import {
  fetchProjects, fetchProjectSummary, fetchBoards, fetchBoardDetails,
  fetchDocuments, fetchAgents, fetchEvents, subscribeEvents, moveCard, fetchCardDetails
} from './api';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { CardModal } from './components/CardModal';
import { DocumentHub } from './components/DocumentHub';
import { ActivityFeed } from './components/ActivityFeed';
import { AgentsHub } from './components/AgentsHub';
import {
  CreateProjectModal, CreateBoardModal, CreateCardModal,
  CreateDocumentModal, RegisterAgentModal
} from './components/Modals';

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectSummary, setProjectSummary] = useState<Project | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'board' | 'documents' | 'activity' | 'agents'>('dashboard');

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [agents, setAgents] = useState<AgentRegistration[]>([]);
  const [events, setEvents] = useState<CAPEvent[]>([]);

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isSseConnected, setIsSseConnected] = useState(false);

  // Modal States
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState<string | null>(null); // columnId
  const [showDocModal, setShowDocModal] = useState(false);
  const [showRegisterAgentModal, setShowRegisterAgentModal] = useState(false);

  // Load initial projects
  const loadProjects = async () => {
    try {
      const list = await fetchProjects();
      setProjects(list);
      if (list.length > 0 && !activeProject) {
        setActiveProject(list[0]);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // URL Hash Sync Helper
  const updateHash = (tab: string, boardId?: string | null, cardId?: string | null) => {
    if (cardId) {
      window.location.hash = `#/cards/${cardId}`;
    } else if (tab === 'board' && boardId) {
      window.location.hash = `#/boards/${boardId}`;
    } else {
      window.location.hash = `/#/${tab}`;
    }
  };

  // Sync state from URL hash
  const parseAndApplyHash = async () => {
    const hash = window.location.hash || '#/dashboard';
    const parts = hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'dashboard';
    const routeId = parts[1];

    if (route === 'dashboard') {
      setActiveTab('dashboard');
      setSelectedCard(null);
    } else if (route === 'board' || route === 'boards') {
      setActiveTab('board');
      setSelectedCard(null);
      if (routeId) {
        try {
          const b = await fetchBoardDetails(routeId);
          setActiveBoard(b);
        } catch (_) {}
      }
    } else if (route === 'card' || route === 'cards') {
      setActiveTab('board');
      if (routeId) {
        try {
          const c = await fetchCardDetails(routeId);
          setSelectedCard(c);
        } catch (_) {}
      }
    } else if (['documents', 'activity', 'agents'].includes(route)) {
      setActiveTab(route as any);
      setSelectedCard(null);
    }
  };

  // Strip /index.html from URL pathname for clean URLs
  useEffect(() => {
    if (window.location.pathname.endsWith('/index.html')) {
      const cleanPath = window.location.pathname.replace(/\/index\.html$/, '') || '/';
      window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
    }
  }, []);

  // Listen to browser Back/Forward & URL Hash changes
  useEffect(() => {
    const handleHashChange = () => {
      parseAndApplyHash();
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Load project workspace data whenever active project changes
  const refreshProjectData = async () => {
    if (!activeProject) return;
    try {
      const [sum, bList, dList, aList, eList] = await Promise.all([
        fetchProjectSummary(activeProject.id).catch(() => null),
        fetchBoards(activeProject.id),
        fetchDocuments(activeProject.id),
        fetchAgents(activeProject.id),
        fetchEvents(activeProject.id),
      ]);

      if (sum) setProjectSummary(sum);
      setBoards(bList);
      setDocuments(dList);
      setAgents(aList);
      setEvents(eList);

      if (bList.length > 0) {
        const targetBoardId = activeBoard && bList.some(b => b.id === activeBoard.id)
          ? activeBoard.id
          : bList[0].id;
        const fullBoard = await fetchBoardDetails(targetBoardId);
        setActiveBoard(fullBoard);
      } else {
        setActiveBoard(null);
      }

      // Apply initial hash route if set
      await parseAndApplyHash();
    } catch (err) {
      console.error('Error loading project data:', err);
    }
  };

  useEffect(() => {
    refreshProjectData();
  }, [activeProject]);

  // Subscribe to SSE event stream for live updates without page refresh
  useEffect(() => {
    if (!activeProject) return;
    setIsSseConnected(true);

    const unsubscribe = subscribeEvents(activeProject.id, (newEvent) => {
      setEvents((prev) => [newEvent, ...prev]);
      refreshProjectData();
      if (selectedCard && (newEvent.entity_type === 'card' || newEvent.entity_type === 'comment')) {
        fetchCardDetails(selectedCard.id).then(setSelectedCard).catch(console.error);
      }
    });

    return () => {
      setIsSseConnected(false);
      unsubscribe();
    };
  }, [activeProject, selectedCard]);

  const handleTabChange = (tab: 'dashboard' | 'board' | 'documents' | 'activity' | 'agents') => {
    setActiveTab(tab);
    setSelectedCard(null);
    updateHash(tab, activeBoard?.id, null);
  };

  const handleSelectBoard = async (board: Board) => {
    try {
      const fullBoard = await fetchBoardDetails(board.id);
      setActiveBoard(fullBoard);
      updateHash('board', board.id, null);
    } catch (err) {
      console.error('Error selecting board:', err);
    }
  };

  const handleMoveCard = async (cardId: string, targetColumnId: string) => {
    try {
      await moveCard(cardId, targetColumnId);
      if (activeBoard) {
        const fullBoard = await fetchBoardDetails(activeBoard.id);
        setActiveBoard(fullBoard);
      }
    } catch (err) {
      console.error('Error moving card:', err);
    }
  };

  const handleOpenCardDetails = async (card: Card) => {
    try {
      const fullCard = await fetchCardDetails(card.id);
      setSelectedCard(fullCard);
      updateHash('board', activeBoard?.id, card.id);
    } catch (_) {
      setSelectedCard(card);
      updateHash('board', activeBoard?.id, card.id);
    }
  };

  const handleCloseCardModal = () => {
    setSelectedCard(null);
    updateHash(activeTab, activeBoard?.id, null);
  };

  const handleRefreshCardModal = async () => {
    if (selectedCard) {
      const fullCard = await fetchCardDetails(selectedCard.id);
      setSelectedCard(fullCard);
      refreshProjectData();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Bar */}
      <Header
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => setActiveProject(p)}
        onOpenNewProject={() => setShowProjectModal(true)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isSseConnected={isSseConnected}
      />

      {/* Main Workspace Body */}
      <main style={{ flex: 1 }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            project={activeProject}
            summary={projectSummary}
            agents={agents}
            events={events}
            boards={boards}
            documents={documents}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenNewCard={() => {
              if (activeBoard?.columns && activeBoard.columns.length > 0) {
                setShowCardModal(activeBoard.columns[0].id);
              } else {
                setActiveTab('board');
              }
            }}
            onOpenNewDoc={() => setShowDocModal(true)}
            onOpenRegisterAgent={() => setShowRegisterAgentModal(true)}
          />
        )}

        {activeTab === 'board' && (
          <KanbanBoard
            boards={boards}
            activeBoard={activeBoard}
            onSelectBoard={handleSelectBoard}
            onOpenCreateBoard={() => setShowBoardModal(true)}
            onOpenCreateCard={(colId) => setShowCardModal(colId)}
            onOpenCardDetails={handleOpenCardDetails}
            onMoveCard={handleMoveCard}
            agents={agents}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentHub
            documents={documents}
            agents={agents}
            onOpenCreateDoc={() => setShowDocModal(true)}
            onRefresh={refreshProjectData}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityFeed events={events} agents={agents} />
        )}

        {activeTab === 'agents' && (
          <AgentsHub
            agents={agents}
            onOpenRegisterAgent={() => setShowRegisterAgentModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      {showProjectModal && (
        <CreateProjectModal
          onClose={() => setShowProjectModal(false)}
          onRefresh={loadProjects}
        />
      )}

      {showBoardModal && activeProject && (
        <CreateBoardModal
          projectId={activeProject.id}
          onClose={() => setShowBoardModal(false)}
          onRefresh={refreshProjectData}
        />
      )}

      {showCardModal && (
        <CreateCardModal
          columnId={showCardModal}
          onClose={() => setShowCardModal(null)}
          onRefresh={refreshProjectData}
        />
      )}

      {showDocModal && activeProject && (
        <CreateDocumentModal
          projectId={activeProject.id}
          onClose={() => setShowDocModal(false)}
          onRefresh={refreshProjectData}
        />
      )}

      {showRegisterAgentModal && activeProject && (
        <RegisterAgentModal
          projectId={activeProject.id}
          onClose={() => setShowRegisterAgentModal(false)}
          onRefresh={refreshProjectData}
        />
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          agents={agents}
          onClose={handleCloseCardModal}
          onRefresh={handleRefreshCardModal}
        />
      )}
    </div>
  );
};
