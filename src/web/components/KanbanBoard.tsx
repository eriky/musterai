// File: src/web/components/KanbanBoard.tsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board, Column, Card, Agent, CardDetails, Document, CardLinkRelationType, CardWorkLinkKind, CardWorkLinkProvider } from '../types.js';
import { Layout, Plus, MessageSquare, X, Tag, UserPlus, Trash2, Edit2, FileText, Link2, Unlink, Check, AlertTriangle, Eye, ShieldAlert, CheckCircle2, ArrowRight, GitBranch, Bot, UserRound, GitPullRequest, GitCommit, Workflow, ExternalLink } from 'lucide-react';
import { renderMarkdown } from '../markdown.js';
import { api } from '../api.js';
import {
  CardDateSortOrder,
  DONE_LANE_PAGE_SIZE,
  getLaneCards,
  isDoneLane,
} from '../kanban.js';
import { EditColumnModal } from './Modals.js';
import { DocumentReaderModal } from './DocumentReaderModal.js';


interface KanbanBoardProps {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  agents: Agent[];
  documents: Document[];
  projectId: string | null;
  newCardRequest?: { columnId?: string; token: number } | null;
  onMoveCard: (cardId: string, targetColumnId: string, position?: string) => void;
  onNewCardRequestHandled?: () => void;
  onOpenNewColumn: () => void;
  onDeleteBoard: (boardId: string) => void;
  onOpenDocumentInVault?: (docId: string) => void;
  onRefresh: () => void;
}

const CARD_LINK_RELATION_LABELS: Record<CardLinkRelationType, string> = {
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
};

const CARD_LINK_BADGE_CLASSES: Record<CardLinkRelationType, string> = {
  blocks: 'muster-badge-danger',
  blocked_by: 'muster-badge-warning',
  relates_to: 'muster-badge-info',
  duplicates: 'muster-badge-neutral',
};

const WORK_LINK_KIND_LABELS: Record<CardWorkLinkKind, string> = {
  branch: 'Branches',
  pull_request: 'Pull Requests',
  commit: 'Commits',
  pipeline: 'Pipelines',
};

const WORK_LINK_KIND_ICONS: Record<CardWorkLinkKind, React.ComponentType<{ className?: string }>> = {
  branch: GitBranch,
  pull_request: GitPullRequest,
  commit: GitCommit,
  pipeline: Workflow,
};

const WORK_LINK_KIND_ORDER: CardWorkLinkKind[] = ['branch', 'pull_request', 'commit', 'pipeline'];

const WORK_LINK_PROVIDER_LABELS: Record<CardWorkLinkProvider, string> = {
  forgejo: 'Forgejo',
  github: 'GitHub',
  gitlab: 'GitLab',
  other: 'Other',
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  board,
  columns,
  cards,
  agents,
  documents,
  projectId,
  newCardRequest,
  onMoveCard,
  onNewCardRequestHandled,
  onOpenNewColumn,
  onDeleteBoard,
  onOpenDocumentInVault,
  onRefresh,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [readerDocument, setReaderDocument] = useState<Document | null>(null);
  const [commentText, setCommentText] = useState('');
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');
  const [assignAgentId, setAssignAgentId] = useState<string>('');
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const [linkDocumentId, setLinkDocumentId] = useState<string>('');
  const [linkCardRelationType, setLinkCardRelationType] = useState<CardLinkRelationType>('relates_to');
  const [linkCardQuery, setLinkCardQuery] = useState('');
  const [linkCardResults, setLinkCardResults] = useState<Card[]>([]);
  const [isSearchingLinkCards, setIsSearchingLinkCards] = useState(false);
  const [workLinkKind, setWorkLinkKind] = useState<CardWorkLinkKind>('branch');
  const [workLinkProvider, setWorkLinkProvider] = useState<CardWorkLinkProvider>('forgejo');
  const [workLinkUrl, setWorkLinkUrl] = useState('');
  const [workLinkRef, setWorkLinkRef] = useState('');
  const [workLinkError, setWorkLinkError] = useState<string | null>(null);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState('');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editCardTitle, setEditCardTitle] = useState('');
  const [editCardDescription, setEditCardDescription] = useState('');
  const [editCardPriority, setEditCardPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [editCardStatus, setEditCardStatus] = useState<'active' | 'blocked' | 'in_review'>('active');
  const [editCardBlockedReason, setEditCardBlockedReason] = useState<string>('');

  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardColumnId, setNewCardColumnId] = useState('');
  const [cardDateSortOrder, setCardDateSortOrder] = useState<CardDateSortOrder>('newest');
  const [doneVisibleLimits, setDoneVisibleLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    setDoneVisibleLimits({});
  }, [board?.id, cardDateSortOrder]);

  useEffect(() => {
    if (!projectId || !selectedCardId || !linkCardQuery.trim()) {
      setLinkCardResults([]);
      return;
    }
    setIsSearchingLinkCards(true);
    const handle = setTimeout(async () => {
      try {
        const results = await api.searchCards(projectId, linkCardQuery.trim(), selectedCardId);
        setLinkCardResults(results);
      } catch (err) {
        console.error('Failed to search cards:', err);
      } finally {
        setIsSearchingLinkCards(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [linkCardQuery, projectId, selectedCardId]);

  useEffect(() => {
    if (!newCardRequest) return;
    handleOpenNewCardForm(newCardRequest.columnId);
    onNewCardRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCardRequest]);

  const handleRenameBoard = async () => {
    if (!board || !boardNameInput.trim()) return;
    try {
      await api.updateBoard(board.id, boardNameInput.trim());
      setIsEditingBoardName(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to rename board');
    }
  };

  const handleDeleteCard = async (cardId: string, cardTitle: string) => {
    if (!confirm(`Are you sure you want to delete task "${cardTitle}"?`)) return;
    try {
      await api.deleteCard(cardId);
      if (selectedCardId === cardId) {
        setSelectedCardId(null);
        setCardDetails(null);
        setIsEditingCard(false);
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete card');
    }
  };


  const closeCardModal = () => {
    setSelectedCardId(null);
    setCardDetails(null);
    setIsEditingCard(false);
    setIsCreatingCard(false);
    setNewCardColumnId('');
  };

  const handleOpenNewCardForm = (columnId?: string) => {
    const targetColumnId = columnId || columns[0]?.id || '';
    setSelectedCardId(null);
    setCardDetails(null);
    setIsCreatingCard(true);
    setNewCardColumnId(targetColumnId);
    setEditCardTitle('');
    setEditCardDescription('');
    setEditCardPriority('medium');
    setEditCardStatus('active');
    setEditCardBlockedReason('');
    setIsEditingCard(true);
    setLinkCardQuery('');
    setLinkCardResults([]);
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardColumnId || !editCardTitle.trim()) return;
    try {
      const created = await api.createCard(newCardColumnId, {
        title: editCardTitle.trim(),
        description: editCardDescription,
        priority: editCardPriority,
        status: editCardStatus,
        blocked_reason: editCardStatus !== 'active' ? editCardBlockedReason.trim() : null,
      });
      onRefresh();
      await handleOpenCard(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create card');
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    onMoveCard(draggableId, destination.droppableId);
  };

  const handleOpenCard = async (cardId: string, editMode = false) => {
    setSelectedCardId(cardId);
    setIsCreatingCard(false);
    setNewCardColumnId('');
    try {
      const details = await api.getCardDetails(cardId);
      setCardDetails(details);
      setEditCardTitle(details.title);
      setEditCardDescription(details.description || '');
      setEditCardPriority(details.priority);
      setEditCardStatus(details.status || 'active');
      setEditCardBlockedReason(details.blocked_reason || '');
      setIsEditingCard(editMode);
      setLinkCardQuery('');
      setLinkCardResults([]);
      setWorkLinkUrl('');
      setWorkLinkRef('');
      setWorkLinkError(null);
    } catch (err) {
      console.error('Failed to load card details:', err);
    }
  };

  const handleStartEditingCard = () => {
    if (!cardDetails) return;
    setEditCardTitle(cardDetails.title);
    setEditCardDescription(cardDetails.description || '');
    setEditCardPriority(cardDetails.priority);
    setEditCardStatus(cardDetails.status || 'active');
    setEditCardBlockedReason(cardDetails.blocked_reason || '');
    setIsEditingCard(true);
  };

  const handleSaveCard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cardDetails || !editCardTitle.trim()) return;

    try {
      const updated = await api.updateCard(cardDetails.id, {
        title: editCardTitle.trim(),
        description: editCardDescription,
        priority: editCardPriority,
        status: editCardStatus,
        blocked_reason: editCardStatus !== 'active' ? editCardBlockedReason.trim() : null,
      });
      setCardDetails(updated);
      setIsEditingCard(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update card text');
    }
  };

  const handleUpdateCardStatus = async (status: 'active' | 'blocked' | 'in_review', blocked_reason?: string | null) => {
    if (!cardDetails) return;
    try {
      const updated = await api.updateCard(cardDetails.id, {
        status,
        blocked_reason: status !== 'active' ? (blocked_reason ?? cardDetails.blocked_reason) : null,
      });
      setCardDetails(updated);
      setEditCardStatus(updated.status);
      setEditCardBlockedReason(updated.blocked_reason || '');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update card status');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || !commentText.trim() || !selectedAuthorId) return;

    try {
      await api.addComment(selectedCardId, selectedAuthorId, commentText);
      setCommentText('');
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleAssignAgent = async () => {
    if (!selectedCardId || !assignAgentId) return;
    try {
      await api.assignCard(selectedCardId, assignAgentId);
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
      setAssignAgentId('');
      onRefresh();
    } catch (err) {
      console.error('Failed to assign agent:', err);
    }
  };

  const handleUnassignAgent = async (agentId: string) => {
    if (!selectedCardId) return;
    setRemovingAgentId(agentId);
    try {
      const updated = await api.unassignCard(selectedCardId, agentId);
      setCardDetails(updated);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove assignee');
    } finally {
      setRemovingAgentId(null);
    }
  };

  const handleLinkDocument = async () => {
    if (!selectedCardId || !linkDocumentId) return;
    try {
      await api.linkDocument(selectedCardId, linkDocumentId);
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
      setLinkDocumentId('');
    } catch (err) {
      console.error('Failed to link document:', err);
    }
  };

  const handleUnlinkDocument = async (documentId: string) => {
    if (!selectedCardId) return;
    try {
      await api.unlinkDocument(selectedCardId, documentId);
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
    } catch (err) {
      console.error('Failed to unlink document:', err);
    }
  };

  const handleLinkCard = async (targetCardId: string) => {
    if (!selectedCardId) return;
    try {
      const updated = await api.linkCard(selectedCardId, targetCardId, linkCardRelationType);
      setCardDetails(updated);
      setLinkCardQuery('');
      setLinkCardResults([]);
    } catch (err: any) {
      alert(err.message || 'Failed to link card');
    }
  };

  const handleUnlinkCard = async (linkId: string) => {
    if (!selectedCardId) return;
    try {
      const updated = await api.unlinkCard(selectedCardId, linkId);
      setCardDetails(updated);
    } catch (err) {
      console.error('Failed to unlink card:', err);
    }
  };

  const handleAddWorkLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || !workLinkUrl.trim()) return;
    setWorkLinkError(null);
    try {
      const updated = await api.addWorkLink(selectedCardId, {
        kind: workLinkKind,
        provider: workLinkProvider,
        url: workLinkUrl.trim(),
        external_ref: workLinkRef.trim() || undefined,
      });
      setCardDetails(updated);
      setWorkLinkUrl('');
      setWorkLinkRef('');
    } catch (err: any) {
      setWorkLinkError(err.message || 'Failed to add work link');
    }
  };

  const handleRemoveWorkLink = async (linkId: string) => {
    if (!selectedCardId) return;
    try {
      const updated = await api.removeWorkLink(selectedCardId, linkId);
      setCardDetails(updated);
    } catch (err) {
      console.error('Failed to remove work link:', err);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Are you sure you want to delete this column? (Column must be empty)')) return;
    try {
      await api.deleteColumn(columnId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete column');
    }
  };

  const getPriorityBadge = (priority: Card['priority']) => {
    switch (priority) {
      case 'critical':
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-danger-950 muster-text-danger border border-danger-600/50 rounded">CRITICAL</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-warning-950 muster-text-warning border border-warning-600/50 rounded">HIGH</span>;
      case 'medium':
        // `info`, not `brand`: priority is a severity scale, and the other
        // four steps are profile-independent. On `brand` this step alone
        // changed hue per profile — reading as "success" under Emerald.
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-info-950 muster-text-info border border-info-600/40 rounded">MEDIUM</span>;
      case 'low':
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-neutral-900 muster-text-muted border border-neutral-700 rounded">LOW</span>;
    }
  };

  if (!board) {
    return (
      <div className="text-center py-16 bg-muster-surface rounded-lg tactical-border">
        <Layout className="w-12 h-12 muster-text-faint mx-auto mb-3" />
        <h3 className="text-sm font-sans muster-text-secondary font-semibold">No Board Available</h3>
        <p className="text-xs font-sans text-neutral-500 mt-1">Select or create a board to manage cards.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-4">
      
      {/* Board Controls */}
      <div className="flex-none flex items-center justify-between border-b border-muster-border pb-3">
        {isEditingBoardName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameBoard();
            }}
            className="flex items-center space-x-2"
          >
            <Layout className="w-5 h-5 muster-accent" />
            <span className="text-base font-sans font-bold muster-text-muted uppercase tracking-wide">
              Board:
            </span>
            <input
              type="text"
              autoFocus
              value={boardNameInput}
              onChange={(e) => setBoardNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditingBoardName(false);
              }}
              className="bg-muster-surface border border-brand-500 muster-text-primary text-sm font-sans font-bold px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={!boardNameInput.trim()}
              className="p-1.5 hover:bg-brand-950 muster-accent hover:text-brand-300 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Save Board Name"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingBoardName(false)}
              className="p-1.5 hover:bg-neutral-800 muster-text-muted hover:text-neutral-200 rounded transition-colors cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center space-x-2">
            <Layout className="w-5 h-5 muster-accent" />
            <h2 className="text-base font-sans font-bold muster-text-primary uppercase tracking-wide">
              Board: {board.name}
            </h2>
            <button
              onClick={() => {
                setBoardNameInput(board.name);
                setIsEditingBoardName(true);
              }}
              className="p-1 hover:bg-neutral-800 text-neutral-500 hover:text-brand-400 rounded transition-colors cursor-pointer"
              title="Rename Board"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2">
            <span className="text-xs font-semibold muster-text-muted">Sort cards</span>
            <select
              value={cardDateSortOrder}
              onChange={(event) => setCardDateSortOrder(event.target.value as CardDateSortOrder)}
              className="muster-input w-auto"
              aria-label="Sort cards by last updated date"
            >
              <option value="newest">Updated: newest first</option>
              <option value="oldest">Updated: oldest first</option>
            </select>
          </label>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete board "${board.name}"?\n\nThis will permanently delete all columns and cards on this board.`)) {
                onDeleteBoard(board.id);
              }
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-semibold bg-danger-950/80 hover:bg-danger-900 text-danger-300 border border-danger-500/40 transition-all cursor-pointer"
            title="Delete Board"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Board
          </button>

          <button
            onClick={onOpenNewColumn}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Column
          </button>
        </div>
      </div>

      {/* Kanban Drag and Drop Context (Stretches 100% height!) */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex space-x-4 overflow-x-auto min-h-0 h-full pb-2">
          {columns.map((column) => {
            const doneVisibleLimit = doneVisibleLimits[column.id] ?? DONE_LANE_PAGE_SIZE;
            const {
              all: columnCards,
              visible: visibleColumnCards,
              hiddenCount,
            } = getLaneCards(
              cards,
              column.id,
              column.name,
              cardDateSortOrder,
              doneVisibleLimit
            );
            const isAtWipLimit = column.wip_limit !== null && columnCards.length >= column.wip_limit;
            const isExceededWip = column.wip_limit !== null && columnCards.length > column.wip_limit;

            return (
              <div
                key={column.id}
                className="w-80 flex-shrink-0 bg-muster-surface rounded-xl tactical-border flex flex-col h-full min-h-0"
              >

                {/* Column Header */}
                <div className={`p-3.5 border-b flex items-center justify-between ${
                  isExceededWip ? 'bg-danger-950/40 border-danger-500/50 text-danger-300' :
                  isAtWipLimit ? 'bg-warning-950/40 border-warning-500/50 text-warning-300' :
                  'border-muster-border text-neutral-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-sans text-xs font-bold tracking-wide uppercase">{column.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 muster-text-secondary border border-neutral-700">
                      {columnCards.length}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {column.wip_limit !== null && (
                      <span className={`text-[10px] font-mono font-semibold ${isExceededWip ? 'muster-text-danger' : isAtWipLimit ? 'muster-text-warning' : 'text-neutral-500'}`}>
                        WIP Limit: {column.wip_limit}
                      </span>
                    )}

                    <button
                      onClick={() => handleOpenNewCardForm(column.id)}
                      className="p-1 hover:bg-neutral-800 muster-text-muted hover:text-brand-400 rounded transition-colors cursor-pointer"
                      title="Add card to column"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setEditingColumn(column)}
                      className="p-1 hover:bg-neutral-800 text-neutral-500 hover:text-brand-400 rounded transition-colors cursor-pointer"
                      title="Edit column settings"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteColumn(column.id)}
                      className="p-1 hover:bg-neutral-800 text-neutral-500 hover:text-danger-400 rounded transition-colors cursor-pointer"
                      title="Delete column"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 flex-1 overflow-y-auto space-y-3 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-brand-950/20' : ''
                      }`}
                    >
                      {visibleColumnCards.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => handleOpenCard(card.id)}
                              className={`p-3.5 bg-muster-surface rounded-lg border transition-all cursor-pointer group ${
                                dragSnapshot.isDragging
                                  ? 'border-brand-500 shadow-lg scale-102 z-50'
                                  : 'border-muster-border hover:border-brand-500/40 hover:bg-neutral-900/90'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-[10px] text-neutral-500 group-hover:text-brand-400">
                                  {card.key}
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  {getPriorityBadge(card.priority)}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenCard(card.id, true);
                                    }}
                                    className="muster-btn muster-btn-icon muster-btn-ghost"
                                    title="Edit Task"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCard(card.id, card.title);
                                    }}
                                    className="muster-btn muster-btn-icon muster-btn-ghost-danger"
                                    title="Delete Card"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>


                              {/* Card Status Banner / Badge */}
                              {(card.status === 'blocked' || card.status === 'in_review') && (
                                <div className="mb-2">
                                  {card.status === 'blocked' && (
                                    <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-danger-950/80 text-danger-300 border border-danger-500/50 text-[11px] font-medium">
                                      <AlertTriangle className="w-3.5 h-3.5 muster-text-danger flex-shrink-0" />
                                      <span className="truncate">{card.blocked_reason ? `Blocked: ${card.blocked_reason}` : 'Blocked'}</span>
                                    </div>
                                  )}
                                  {card.status === 'in_review' && (
                                    <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-warning-950/80 text-warning-300 border border-warning-500/50 text-[11px] font-medium">
                                      <Eye className="w-3.5 h-3.5 muster-text-warning flex-shrink-0" />
                                      <span className="truncate">{card.blocked_reason || 'Waiting for Human Review'}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <h4 className="text-xs font-sans font-semibold muster-text-primary group-hover:text-brand-200 line-clamp-2 mb-2">
                                {card.title}
                              </h4>

                              {card.description && (
                                <p className="text-[11px] font-sans muster-text-muted line-clamp-2 mb-3">
                                  {card.description}
                                </p>
                              )}

                              {card.assignees && card.assignees.length > 0 && (
                                <div
                                  className="flex flex-wrap gap-1 mb-2"
                                  aria-label={`Assigned to ${card.assignees.map(agent => `${agent.name} (${agent.status})`).join(', ')}`}
                                >
                                  {card.assignees.map((agent) => (
                                    <span
                                      key={agent.id}
                                      className="muster-chip max-w-full"
                                      title={`Assigned to ${agent.name} — ${agent.status}`}
                                      data-agent-status={agent.status}
                                    >
                                      {agent.status === 'active' && (
                                        <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                                          <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-success-400 opacity-75" />
                                          <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
                                        </span>
                                      )}
                                      {agent.type === 'ai_agent' ? (
                                        <Bot className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                      ) : (
                                        <UserRound className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                      )}
                                      <span className="truncate">{agent.name}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-muster-border/50 text-[10px] font-mono text-neutral-500">
                                <span>Updated {new Date(card.updated_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {isDoneLane(column.name) && columnCards.length > DONE_LANE_PAGE_SIZE && (
                        <div className="muster-panel p-3 space-y-2 text-center">
                          <p className="text-[10px] font-mono muster-text-muted">
                            Showing {visibleColumnCards.length} of {columnCards.length} cards
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            {hiddenCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDoneVisibleLimits((current) => ({
                                    ...current,
                                    [column.id]: doneVisibleLimit + DONE_LANE_PAGE_SIZE,
                                  }));
                                }}
                                className="muster-btn muster-btn-soft"
                              >
                                Show {Math.min(DONE_LANE_PAGE_SIZE, hiddenCount)} more
                              </button>
                            )}
                            {doneVisibleLimit > DONE_LANE_PAGE_SIZE && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDoneVisibleLimits((current) => ({
                                    ...current,
                                    [column.id]: DONE_LANE_PAGE_SIZE,
                                  }));
                                }}
                                className="muster-btn muster-btn-ghost"
                              >
                                Show fewer
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>

              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Card Detail Modal */}
      {(cardDetails || isCreatingCard) && (
        <div
          className="muster-scrim"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeCardModal();
            }
          }}
          onClick={closeCardModal}
        >
          <div
            className="muster-dialog w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="p-4 border-b border-muster-border flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-wrap">
                {cardDetails ? (
                  <>
                    <span className="font-mono text-xs muster-accent font-bold">{cardDetails.key}</span>
                    {getPriorityBadge(cardDetails.priority)}
                    {cardDetails.status === 'blocked' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-danger-950/80 text-danger-300 border border-danger-500/50 flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1 muster-text-danger" /> Blocked
                      </span>
                    )}
                    {cardDetails.status === 'in_review' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-warning-950/80 text-warning-300 border border-warning-500/50 flex items-center">
                        <Eye className="w-3 h-3 mr-1 muster-text-warning" /> Human Review
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-mono text-xs muster-accent font-bold flex items-center">
                    <Plus className="w-3.5 h-3.5 mr-1" /> New Card
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {cardDetails && (
                  <>
                    <button
                      onClick={handleStartEditingCard}
                      className="inline-flex items-center px-2.5 py-1 bg-brand-950/80 hover:bg-brand-900 text-brand-300 border border-brand-500/40 rounded text-xs font-semibold transition-all cursor-pointer"
                      title="Edit Task Text & Properties"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Task
                    </button>
                    <button
                      onClick={() => handleDeleteCard(cardDetails.id, cardDetails.title)}
                      className="inline-flex items-center px-2.5 py-1 bg-danger-950/80 hover:bg-danger-900 text-danger-300 border border-danger-500/40 rounded text-xs font-semibold transition-all cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Task
                    </button>
                  </>
                )}
                <button
                  onClick={closeCardModal}
                  className="p-1 muster-text-muted hover:text-neutral-100 rounded cursor-pointer"
                  title="Close Task"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>


            <div className="p-5 overflow-y-auto space-y-5 flex-1 font-sans">

              {/* Prominent Card Status Banners */}
              {cardDetails && cardDetails.status === 'blocked' && !isEditingCard && (
                <div className="p-3 bg-danger-950/70 border border-danger-500/60 rounded-lg flex items-center justify-between text-xs text-danger-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 muster-text-danger flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider muster-text-danger">Card Blocked:</span>{' '}
                      <span className="font-medium">{cardDetails.blocked_reason || 'Requires resolution before proceeding.'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpdateCardStatus('active', null)}
                    className="ml-3 px-2.5 py-1 bg-success-950 hover:bg-success-900 text-success-300 border border-success-500/50 rounded text-xs font-semibold cursor-pointer transition-colors flex-shrink-0"
                  >
                    Unblock Card
                  </button>
                </div>
              )}

              {cardDetails && cardDetails.status === 'in_review' && !isEditingCard && (
                <div className="p-3 bg-warning-950/70 border border-warning-500/60 rounded-lg flex items-center justify-between text-xs text-warning-200">
                  <div className="flex items-start space-x-2">
                    <Eye className="w-4 h-4 muster-text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider muster-text-warning">Waiting for Human Review:</span>{' '}
                      <span className="font-medium">{cardDetails.blocked_reason || 'Pending operator review and signoff.'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpdateCardStatus('active', null)}
                    className="ml-3 px-2.5 py-1 bg-success-950 hover:bg-success-900 text-success-300 border border-success-500/50 rounded text-xs font-semibold cursor-pointer transition-colors flex-shrink-0"
                  >
                    Approve / Activate
                  </button>
                </div>
              )}

              {isEditingCard ? (
                <form onSubmit={isCreatingCard ? handleCreateCard : handleSaveCard} className="space-y-3 bg-muster-surface p-4 rounded-lg border border-brand-500/40">
                  {isCreatingCard && (
                    <div>
                      <label className="muster-label">Column</label>
                      <select
                        value={newCardColumnId}
                        onChange={(e) => setNewCardColumnId(e.target.value)}
                        className="w-full bg-muster-base border border-muster-border muster-text-primary text-xs rounded p-2"
                      >
                        {columns.map((col) => (
                          <option key={col.id} value={col.id}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="muster-label">Task Title</label>
                    <input
                      type="text"
                      required
                      value={editCardTitle}
                      onChange={(e) => setEditCardTitle(e.target.value)}
                      className="w-full bg-muster-base border border-muster-border muster-text-primary font-sans font-semibold text-xs rounded p-2 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="muster-label">Priority</label>
                      <select
                        value={editCardPriority}
                        onChange={(e) => setEditCardPriority(e.target.value as any)}
                        className="w-full bg-muster-base border border-muster-border muster-text-primary text-xs rounded p-2"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="muster-label">Card Status</label>
                      <select
                        value={editCardStatus}
                        onChange={(e) => setEditCardStatus(e.target.value as any)}
                        className="w-full bg-muster-base border border-muster-border muster-text-primary text-xs rounded p-2"
                      >
                        <option value="active">Active (Normal)</option>
                        <option value="in_review">In Review (Waiting for Human)</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                  </div>

                  {editCardStatus !== 'active' && (
                    <div>
                      <label className="muster-label">
                        {editCardStatus === 'blocked' ? 'Blocked Reason' : 'Review Reason / Note'}
                      </label>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editCardBlockedReason}
                          onChange={(e) => setEditCardBlockedReason(e.target.value)}
                          placeholder={editCardStatus === 'blocked' ? 'e.g. Requires human review' : 'e.g. Waiting on operator signoff'}
                          className="muster-input"
                        />
                        <div className="flex flex-wrap gap-1">
                          {['Requires Human Review', 'Waiting on Dependency', 'Environment Issue', 'Waiting on Input'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditCardBlockedReason(preset)}
                              className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] muster-text-secondary rounded border border-neutral-700 transition-colors cursor-pointer"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="muster-label">Description (Markdown)</label>
                    <textarea
                      rows={5}
                      value={editCardDescription}
                      onChange={(e) => setEditCardDescription(e.target.value)}
                      placeholder="Task description (markdown supported)..."
                      className="w-full bg-muster-base border border-muster-border muster-text-primary font-sans text-xs rounded p-2.5 focus:border-brand-500 focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={isCreatingCard ? closeCardModal : () => setIsEditingCard(false)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 muster-text-secondary rounded text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!editCardTitle.trim() || (isCreatingCard && !newCardColumnId)}
                      className="muster-btn muster-btn-lg muster-btn-primary"
                    >
                      {isCreatingCard ? 'Create Card' : 'Save Task'}
                    </button>
                  </div>
                </form>
              ) : cardDetails && (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold muster-text-primary">{cardDetails.title}</h3>
                    <div className="flex items-center space-x-2">
                      {/* Direct status switcher pill */}
                      <select
                        value={cardDetails.status || 'active'}
                        onChange={(e) => handleUpdateCardStatus(e.target.value as any)}
                        className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1"
                      >
                        <option value="active">🟢 Active</option>
                        <option value="in_review">👁️ Waiting for Human Review</option>
                        <option value="blocked">⛔ Blocked</option>
                      </select>
                      <button
                        onClick={handleStartEditingCard}
                        className="p-1 text-neutral-500 hover:text-brand-400 transition-colors cursor-pointer"
                        title="Edit Title & Description"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    className="markdown-render text-xs muster-text-secondary mt-2 bg-muster-surface p-3 rounded-lg border border-muster-border leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(cardDetails.description, 'No description provided.') }}
                  />
                </div>
              )}

              {cardDetails && (
              <>
              {/* Assignees & Assign Control */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold muster-text-muted uppercase mb-2">Assignees</h4>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {cardDetails.assignees.length > 0 ? (
                      cardDetails.assignees.map((agent) => (
                        <span key={agent.id} className="muster-chip">
                          <span>🤖 {agent.name}</span>
                          <button
                            type="button"
                            onClick={() => handleUnassignAgent(agent.id)}
                            disabled={removingAgentId === agent.id}
                            className="muster-btn muster-btn-icon muster-btn-ghost-danger p-0.5"
                            title={`Remove ${agent.name} from card`}
                            aria-label={`Remove ${agent.name} from card`}
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-500 italic">Unassigned</span>
                    )}
                  </div>

                  <div className="flex space-x-1.5">
                    <select
                      value={assignAgentId}
                      onChange={(e) => setAssignAgentId(e.target.value)}
                      className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1 flex-1"
                    >
                      <option value="">Select Agent...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignAgent}
                      disabled={!assignAgentId}
                      className="muster-btn muster-btn-primary"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold muster-text-muted uppercase mb-2">Labels</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {cardDetails.labels.length > 0 ? (
                      cardDetails.labels.map((label) => (
                        <span key={label.id} className="px-2 py-1 bg-neutral-900 text-neutral-200 border border-neutral-700 text-xs rounded">
                          🏷️ {label.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-500 italic">No labels</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Documents */}
              <div>
                <h4 className="text-xs font-bold muster-text-secondary uppercase mb-3 flex items-center justify-between">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1.5 muster-text-warning" />
                    Linked Documents ({(cardDetails.linked_documents || []).length})
                  </span>
                  <span className="text-[10px] text-neutral-500 font-normal">Click document to read</span>
                </h4>

                <div className="space-y-2 mb-3">
                  {(cardDetails.linked_documents || []).length > 0 ? (
                    cardDetails.linked_documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setReaderDocument(doc)}
                        className="flex items-center justify-between bg-muster-surface p-2.5 rounded-lg border border-warning-500/20 hover:border-warning-500/60 hover:bg-neutral-900/90 group cursor-pointer transition-all"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 muster-text-warning flex-shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-sans text-neutral-200 group-hover:text-warning-300 truncate font-semibold">
                            {doc.title}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded flex-shrink-0 ${
                            doc.status === 'approved' ? 'bg-success-950 muster-text-success border border-success-600/40' :
                            doc.status === 'in_review' ? 'bg-warning-950 muster-text-warning border border-warning-600/40' :
                            'bg-neutral-900 muster-text-muted border border-neutral-700'
                          }`}>{doc.status}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-[11px] muster-text-warning font-medium opacity-80 group-hover:opacity-100 flex items-center">
                            Read <Eye className="w-3 h-3 ml-1" />
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkDocument(doc.id);
                            }}
                            className="muster-btn muster-btn-icon muster-btn-ghost-danger opacity-0 group-hover:opacity-100"
                            title="Unlink document"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No documents linked to this card.</p>
                  )}
                </div>

                {/* Attach document picker */}
                {documents.length > 0 && (
                  <div className="flex space-x-1.5">
                    <select
                      value={linkDocumentId}
                      onChange={(e) => setLinkDocumentId(e.target.value)}
                      className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1 flex-1"
                    >
                      <option value="">Link a document...</option>
                      {documents
                        .filter((d) => !(cardDetails.linked_documents || []).some((ld) => ld.id === d.id))
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.title}</option>
                        ))}
                    </select>
                    <button
                      onClick={handleLinkDocument}
                      disabled={!linkDocumentId}
                      className="muster-btn muster-btn-primary"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Link</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Linked Cards */}
              <div>
                <h4 className="text-xs font-bold muster-text-secondary uppercase mb-3 flex items-center">
                  <GitBranch className="w-4 h-4 mr-1.5 muster-text-info" />
                  Linked Cards ({(cardDetails.linked_cards || []).length})
                </h4>

                <div className="space-y-2 mb-3">
                  {(cardDetails.linked_cards || []).length > 0 ? (
                    cardDetails.linked_cards.map((link) => (
                      <div
                        key={link.id}
                        onClick={() => handleOpenCard(link.card.id)}
                        className="flex items-center justify-between bg-muster-surface p-2.5 rounded-lg border border-info-500/20 hover:border-info-500/60 hover:bg-neutral-900/90 group cursor-pointer transition-all"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className={`muster-badge ${CARD_LINK_BADGE_CLASSES[link.relation_type]} flex-shrink-0`}>
                            {CARD_LINK_RELATION_LABELS[link.relation_type]}
                          </span>
                          <span className="text-xs font-sans text-neutral-200 group-hover:text-info-300 truncate font-semibold">
                            {link.card.title}
                          </span>
                          {link.card.archived ? (
                            <span className="muster-badge muster-badge-neutral flex-shrink-0">archived</span>
                          ) : null}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlinkCard(link.id);
                          }}
                          className="muster-btn muster-btn-icon muster-btn-ghost-danger opacity-0 group-hover:opacity-100 flex-shrink-0"
                          title="Unlink card"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No linked cards.</p>
                  )}
                </div>

                {/* Relation type + card title search */}
                <div className="flex space-x-1.5">
                  <select
                    value={linkCardRelationType}
                    onChange={(e) => setLinkCardRelationType(e.target.value as CardLinkRelationType)}
                    className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1 flex-shrink-0"
                  >
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked by</option>
                    <option value="relates_to">Relates to</option>
                    <option value="duplicates">Duplicates</option>
                  </select>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={linkCardQuery}
                      onChange={(e) => setLinkCardQuery(e.target.value)}
                      placeholder="Search cards by title..."
                      className="w-full bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1"
                    />
                    {linkCardQuery.trim() && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-muster-surface border border-muster-border rounded-lg shadow-lg">
                        {isSearchingLinkCards ? (
                          <div className="px-2.5 py-2 text-xs text-neutral-500 italic">Searching...</div>
                        ) : linkCardResults.length > 0 ? (
                          linkCardResults.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleLinkCard(c.id)}
                              className="px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-info-950/60 hover:text-info-300 cursor-pointer truncate"
                            >
                              {c.title}
                            </div>
                          ))
                        ) : (
                          <div className="px-2.5 py-2 text-xs text-neutral-500 italic">No matching cards</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Work Links */}
              <div>
                <h4 className="text-xs font-bold muster-text-secondary uppercase mb-3 flex items-center">
                  <GitCommit className="w-4 h-4 mr-1.5 muster-text-success" />
                  Work Links ({(cardDetails.work_links || []).length})
                </h4>

                <div className="space-y-3 mb-3">
                  {(cardDetails.work_links || []).length > 0 ? (
                    WORK_LINK_KIND_ORDER.filter((kind) =>
                      (cardDetails.work_links || []).some((l) => l.kind === kind)
                    ).map((kind) => {
                      const KindIcon = WORK_LINK_KIND_ICONS[kind];
                      const links = (cardDetails.work_links || []).filter((l) => l.kind === kind);
                      return (
                        <div key={kind}>
                          <div className="text-[10px] font-semibold muster-text-muted uppercase mb-1.5">
                            {WORK_LINK_KIND_LABELS[kind]}
                          </div>
                          <div className="space-y-2">
                            {links.map((link) => (
                              <div
                                key={link.id}
                                className="flex items-center justify-between bg-muster-surface p-2.5 rounded-lg border border-success-500/20 hover:border-success-500/60 hover:bg-neutral-900/90 group transition-all"
                              >
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 min-w-0 flex-1"
                                >
                                  <KindIcon className="w-3.5 h-3.5 muster-text-success flex-shrink-0 group-hover:scale-110 transition-transform" />
                                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded flex-shrink-0 bg-neutral-900 muster-text-muted border border-neutral-700">
                                    {WORK_LINK_PROVIDER_LABELS[link.provider]}
                                  </span>
                                  <span className="text-xs font-mono text-neutral-200 group-hover:text-success-300 truncate">
                                    {link.external_ref || link.title || link.url}
                                  </span>
                                  <ExternalLink className="w-3 h-3 muster-text-muted flex-shrink-0 opacity-0 group-hover:opacity-100" />
                                </a>
                                <button
                                  onClick={() => handleRemoveWorkLink(link.id)}
                                  className="muster-btn muster-btn-icon muster-btn-ghost-danger opacity-0 group-hover:opacity-100 flex-shrink-0"
                                  title="Remove work link"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No work linked to this card yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddWorkLink} className="space-y-1.5">
                  <div className="flex space-x-1.5">
                    <select
                      value={workLinkKind}
                      onChange={(e) => setWorkLinkKind(e.target.value as CardWorkLinkKind)}
                      className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1 flex-shrink-0"
                    >
                      <option value="branch">Branch</option>
                      <option value="pull_request">Pull Request</option>
                      <option value="commit">Commit</option>
                      <option value="pipeline">Pipeline</option>
                    </select>
                    <select
                      value={workLinkProvider}
                      onChange={(e) => setWorkLinkProvider(e.target.value as CardWorkLinkProvider)}
                      className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1 flex-shrink-0"
                    >
                      <option value="forgejo">Forgejo</option>
                      <option value="github">GitHub</option>
                      <option value="gitlab">GitLab</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      value={workLinkRef}
                      onChange={(e) => setWorkLinkRef(e.target.value)}
                      placeholder="Ref (feat/x, #42, 98bb52e)"
                      className="w-32 bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      value={workLinkUrl}
                      onChange={(e) => setWorkLinkUrl(e.target.value)}
                      placeholder="https://forgejo.example/org/repo/pulls/42"
                      className="flex-1 bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2 py-1"
                    />
                    <button
                      type="submit"
                      disabled={!workLinkUrl.trim()}
                      className="muster-btn muster-btn-primary"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Attach</span>
                    </button>
                  </div>
                  {workLinkError && (
                    <p className="text-[11px] muster-text-danger">{workLinkError}</p>
                  )}
                </form>
              </div>

              {/* Comments Section */}
              <div>
                <h4 className="text-xs font-bold muster-text-secondary uppercase mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 muster-accent" />
                  Comments ({cardDetails.comments.length})
                </h4>

                <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                  {cardDetails.comments.map((c) => (
                    <div key={c.id} className="bg-muster-surface p-3 rounded-lg border border-muster-border space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] muster-text-muted">
                        <span className="muster-accent font-semibold">{c.author_name || 'Agent/User'}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <div
                        className="markdown-render text-xs text-neutral-200 leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(c.content) }}
                      />
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex flex-col space-y-2">
                  <div className="flex space-x-2">
                    <select
                      value={selectedAuthorId}
                      onChange={(e) => setSelectedAuthorId(e.target.value)}
                      className="bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-2.5 py-1.5"
                    >
                      <option value="">Select Author...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex space-x-2 items-start">
                    <textarea
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add comment (Markdown supported)..."
                      className="flex-1 bg-muster-surface border border-muster-border text-neutral-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-brand-500 resize-y"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || !selectedAuthorId}
                      className="muster-btn muster-btn-lg muster-btn-primary"
                    >
                      Comment
                    </button>
                  </div>
                </form>

              </div>
              </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Document Reader Modal */}
      {readerDocument && (
        <DocumentReaderModal
          document={readerDocument}
          onClose={() => setReaderDocument(null)}
          onOpenInVault={onOpenDocumentInVault}
        />
      )}

      {/* Edit Column Modal */}
      {editingColumn && (
        <EditColumnModal
          column={editingColumn}
          onClose={() => setEditingColumn(null)}
          onSuccess={onRefresh}
        />
      )}

    </div>
  );
};
