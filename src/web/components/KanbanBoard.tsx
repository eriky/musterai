// File: src/web/components/KanbanBoard.tsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board, Column, Card, Agent, CardDetails, Document, CardLinkRelationType, CardWorkLinkKind, CardWorkLinkProvider } from '../types.js';
import { Layout, Plus, MessageSquare, X, Tag, UserPlus, Trash2, Edit2, FileText, Link2, Unlink, Check, Copy, Eye, ShieldAlert, CheckCircle2, ArrowRight, GitBranch, GitPullRequest, GitCommit, Workflow, ExternalLink, GripVertical, Layers, Settings } from 'lucide-react';
import { renderMarkdown } from '../markdown.js';
import { api, getLocalProxyToken } from '../api.js';
import {
  CardDateSortOrder,
  DONE_LANE_PAGE_SIZE,
  computeReorderedPosition,
  getLaneCards,
  isDoneLane,
} from '../kanban.js';
import { EditColumnModal } from './Modals.js';
import { DocumentReaderModal } from './DocumentReaderModal.js';
import { PrincipalChip } from './PrincipalChip.js';
import { CardSearch } from './CardSearch.js';
import { User, AuthMe } from '../types.js';


interface KanbanBoardProps {
  boards: Board[];
  board: Board | null;
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  columns: Column[];
  cards: Card[];
  agents: Agent[];
  users: User[];
  currentUser: AuthMe['user'] | null;
  documents: Document[];
  projectId: string | null;
  newCardRequest?: { columnId?: string; token: number } | null;
  openCardRequest?: { cardId: string; token: number } | null;
  onMoveCard: (cardId: string, targetColumnId: string, position?: string) => void;
  onMoveColumn: (columnId: string, position: string) => void;
  onNewCardRequestHandled?: () => void;
  onOpenCardRequestHandled?: () => void;
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
  parent_of: 'Parent of',
  child_of: 'Child of',
};

const CARD_LINK_BADGE_CLASSES: Record<CardLinkRelationType, string> = {
  blocks: 'muster-badge-danger',
  blocked_by: 'muster-badge-warning',
  relates_to: 'muster-badge-info',
  duplicates: 'muster-badge-neutral',
  parent_of: 'muster-badge-accent',
  child_of: 'muster-badge-accent',
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
  boards,
  board,
  selectedBoardId,
  onSelectBoard,
  columns,
  cards,
  agents,
  users,
  currentUser,
  documents,
  projectId,
  newCardRequest,
  openCardRequest,
  onMoveCard,
  onMoveColumn,
  onNewCardRequestHandled,
  onOpenCardRequestHandled,
  onOpenNewColumn,
  onDeleteBoard,
  onOpenDocumentInVault,
  onRefresh,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [copiedKeyCardId, setCopiedKeyCardId] = useState<string | null>(null);
  const [readerDocument, setReaderDocument] = useState<Document | null>(null);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
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
  const [showBoardSettingsModal, setShowBoardSettingsModal] = useState(false);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editCardTitle, setEditCardTitle] = useState('');
  const [editCardDescription, setEditCardDescription] = useState('');
  const [editCardPriority, setEditCardPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [editCardIsEpic, setEditCardIsEpic] = useState(false);
  const [editCardColumnId, setEditCardColumnId] = useState('');

  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardColumnId, setNewCardColumnId] = useState('');
  const [cardDateSortOrder, setCardDateSortOrder] = useState<CardDateSortOrder>('newest');
  const [doneVisibleLimits, setDoneVisibleLimits] = useState<Record<string, number>>({});
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [focusedColumnIdx, setFocusedColumnIdx] = useState<number>(0);

  useEffect(() => {
    if (!selectedAuthorId) {
      const defaultId = users[0]?.id || agents[0]?.id || '';
      if (defaultId) setSelectedAuthorId(defaultId);
    }
  }, [users, agents, selectedAuthorId]);

  const closeCardModal = () => {
    setSelectedCardId(null);
    setCardDetails(null);
    setIsEditingCard(false);
    setIsCreatingCard(false);
    setNewCardColumnId('');
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  // Global Escape key handler for Card Details Modal, Board Settings Modal, and Edit Column Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBoardSettingsModal) {
          setShowBoardSettingsModal(false);
        } else if (editingColumn) {
          setEditingColumn(null);
        } else if (cardDetails || isCreatingCard) {
          closeCardModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBoardSettingsModal, editingColumn, cardDetails, isCreatingCard, closeCardModal]);

  // Keyboard navigation across columns and cards
  useEffect(() => {
    const handleBoardKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          (activeElement as HTMLElement).isContentEditable);

      if (isTyping || cardDetails || isCreatingCard || showBoardSettingsModal || editingColumn) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
        return;
      }

      if (columns.length === 0) return;

      // Map columns to their exact visually rendered cards in order
      const colCardsMap: Record<string, Card[]> = {};
      columns.forEach((col) => {
        const doneLimit = doneVisibleLimits[col.id] ?? DONE_LANE_PAGE_SIZE;
        colCardsMap[col.id] = getLaneCards(cards, col.id, col.name, cardDateSortOrder, doneLimit).visible;
      });

      // Determine current active column and card index
      let activeColIdx = Math.min(Math.max(0, focusedColumnIdx), columns.length - 1);
      let activeCardIdx = -1;

      if (focusedCardId) {
        for (let i = 0; i < columns.length; i++) {
          const cList = colCardsMap[columns[i].id] || [];
          const idx = cList.findIndex((c) => c.id === focusedCardId);
          if (idx !== -1) {
            activeColIdx = i;
            activeCardIdx = idx;
            break;
          }
        }
      }

      const activeCol = columns[activeColIdx];
      const activeColCards = colCardsMap[activeCol.id] || [];

      const focusCard = (cardId: string) => {
        setFocusedCardId(cardId);
        requestAnimationFrame(() => {
          const cardEl = document.getElementById(`kanban-card-${cardId}`);
          if (cardEl) {
            cardEl.focus();
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        });
      };

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          const targetColIdx = Math.min(columns.length - 1, activeColIdx + 1);
          setFocusedColumnIdx(targetColIdx);
          const targetCol = columns[targetColIdx];
          const targetCards = colCardsMap[targetCol.id] || [];
          
          if (targetCards.length > 0) {
            const targetCardIdx = activeCardIdx >= 0 ? Math.min(activeCardIdx, targetCards.length - 1) : 0;
            focusCard(targetCards[targetCardIdx].id);
          } else {
            setFocusedCardId(null);
            document.getElementById(`kanban-column-${targetCol.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          const targetColIdx = Math.max(0, activeColIdx - 1);
          setFocusedColumnIdx(targetColIdx);
          const targetCol = columns[targetColIdx];
          const targetCards = colCardsMap[targetCol.id] || [];
          
          if (targetCards.length > 0) {
            const targetCardIdx = activeCardIdx >= 0 ? Math.min(activeCardIdx, targetCards.length - 1) : 0;
            focusCard(targetCards[targetCardIdx].id);
          } else {
            setFocusedCardId(null);
            document.getElementById(`kanban-column-${targetCol.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            let nextCardIdx = 0;
            if (activeCardIdx >= 0) {
              nextCardIdx = Math.min(activeColCards.length - 1, activeCardIdx + 1);
            }
            focusCard(activeColCards[nextCardIdx].id);
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            let prevCardIdx = activeColCards.length - 1;
            if (activeCardIdx >= 0) {
              prevCardIdx = Math.max(0, activeCardIdx - 1);
            }
            focusCard(activeColCards[prevCardIdx].id);
          }
          break;
        }

        case 'PageDown': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            let nextCardIdx = 0;
            if (activeCardIdx >= 0) {
              nextCardIdx = Math.min(activeColCards.length - 1, activeCardIdx + 5);
            }
            focusCard(activeColCards[nextCardIdx].id);
          }
          break;
        }

        case 'PageUp': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            let prevCardIdx = activeColCards.length - 1;
            if (activeCardIdx >= 0) {
              prevCardIdx = Math.max(0, activeCardIdx - 5);
            }
            focusCard(activeColCards[prevCardIdx].id);
          }
          break;
        }

        case 'Home': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            focusCard(activeColCards[0].id);
          }
          break;
        }

        case 'End': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            focusCard(activeColCards[activeColCards.length - 1].id);
          }
          break;
        }

        case 'Enter': {
          if (focusedCardId) {
            e.preventDefault();
            handleOpenCard(focusedCardId);
          }
          break;
        }

        case 'n':
        case 'N':
        case 'c':
        case 'C': {
          e.preventDefault();
          handleOpenNewCardForm(activeCol.id);
          break;
        }

        case 'Delete':
        case 'Backspace': {
          if (focusedCardId) {
            e.preventDefault();
            const focusedCard = cards.find((c) => c.id === focusedCardId);
            if (focusedCard) {
              handleDeleteCard(focusedCard.id, focusedCard.title);
              setFocusedCardId(null);
            }
          }
          break;
        }

        case 'Escape': {
          setFocusedCardId(null);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleBoardKeyDown);
    return () => window.removeEventListener('keydown', handleBoardKeyDown);
  }, [columns, cards, focusedCardId, focusedColumnIdx, cardDateSortOrder, doneVisibleLimits, cardDetails, isCreatingCard, showBoardSettingsModal, editingColumn]);

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

  useEffect(() => {
    if (!openCardRequest) return;
    handleOpenCard(openCardRequest.cardId);
    onOpenCardRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCardRequest]);

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


  const handleOpenNewCardForm = (columnId?: string) => {
    const targetColumnId = columnId || columns[0]?.id || '';
    setSelectedCardId(null);
    setCardDetails(null);
    setIsCreatingCard(true);
    setNewCardColumnId(targetColumnId);
    setEditCardTitle('');
    setEditCardDescription('');
    setEditCardPriority('medium');
    setEditCardIsEpic(false);
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
        is_epic: editCardIsEpic,
      });
      onRefresh();
      await handleOpenCard(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create card');
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'COLUMN') {
      onMoveColumn(draggableId, computeReorderedPosition(columns, source.index, destination.index));
      return;
    }

    onMoveCard(draggableId, destination.droppableId);
  };

  const handleCopyKey = (key: string, cardId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedKeyCardId(cardId);
    setTimeout(() => setCopiedKeyCardId(current => (current === cardId ? null : current)), 1500);
  };

  const handleOpenCard = async (cardId: string, editMode = false) => {
    setSelectedCardId(cardId);
    setIsCreatingCard(false);
    setNewCardColumnId('');
    setEditingCommentId(null);
    setEditingCommentText('');
    try {
      const details = await api.getCardDetails(cardId);
      setCardDetails(details);
      setEditCardTitle(details.title);
      setEditCardDescription(details.description || '');
      setEditCardPriority(details.priority);
      setEditCardIsEpic(!!details.is_epic);
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
    setEditCardIsEpic(!!cardDetails.is_epic);
    setEditCardColumnId(cardDetails.column_id);
    setIsEditingCard(true);
  };

  const handleSaveCard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cardDetails || !editCardTitle.trim()) return;

    try {
      if (editCardColumnId && editCardColumnId !== cardDetails.column_id) {
        await onMoveCard(cardDetails.id, editCardColumnId);
      }
      const updated = await api.updateCard(cardDetails.id, {
        title: editCardTitle.trim(),
        description: editCardDescription,
        priority: editCardPriority,
        is_epic: editCardIsEpic ? 1 : 0,
      });
      setCardDetails({ ...updated, column_id: editCardColumnId || updated.column_id });
      setIsEditingCard(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update card text');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorId = currentUser?.id || selectedAuthorId || users[0]?.id || agents[0]?.id || getLocalProxyToken() || 'open-user';
    if (!selectedCardId || !commentText.trim()) return;

    try {
      await api.addComment(selectedCardId, authorId, commentText);
      setCommentText('');
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const canManageComment = (comment: CardDetails['comments'][number]) => {
    if (currentUser?.id === comment.author_id) return true;
    if (!currentUser && selectedAuthorId === comment.author_id) return true;
    return false;
  };

  const handleStartEditingComment = (comment: CardDetails['comments'][number]) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleCancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveComment = async (commentId: string) => {
    if (!selectedCardId || !editingCommentText.trim()) return;
    setSavingCommentId(commentId);
    try {
      await api.updateComment(selectedCardId, commentId, editingCommentText.trim());
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
      handleCancelEditingComment();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update comment');
    } finally {
      setSavingCommentId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedCardId || !window.confirm('Delete this comment?')) return;
    setSavingCommentId(commentId);
    try {
      await api.deleteComment(selectedCardId, commentId);
      const updated = await api.getCardDetails(selectedCardId);
      setCardDetails(updated);
      if (editingCommentId === commentId) handleCancelEditingComment();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    } finally {
      setSavingCommentId(null);
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

  const handleOpenLinkedDocument = async (documentId: string) => {
    // linked_documents only carries a summary (no content) so cards stay cheap
    // to fetch on every mutation — the reader needs the full body on demand.
    setLoadingDocumentId(documentId);
    try {
      const full = await api.getDocumentDetails(documentId);
      setReaderDocument(full);
    } catch (err) {
      console.error('Failed to load document:', err);
    } finally {
      setLoadingDocumentId(null);
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

  const handleUnlinkCard = async (linkId: string, otherCardTitle: string) => {
    if (!selectedCardId) return;
    if (!confirm(`Remove the link to "${otherCardTitle}"? This does not delete the card, only the relationship.`)) return;
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
        return <span className="px-1.5 py-0.5 text-[10px] font-sans font-bold bg-danger-950 muster-text-danger border border-danger-600/50 rounded">CRITICAL</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 text-[10px] font-sans font-bold bg-warning-950 muster-text-warning border border-warning-600/50 rounded">HIGH</span>;
      case 'medium':
        // `info`, not `brand`: priority is a severity scale, and the other
        // four steps are profile-independent. On `brand` this step alone
        // changed hue per profile — reading as "success" under Emerald.
        return <span className="px-1.5 py-0.5 text-[10px] font-sans font-medium bg-info-950 muster-text-info border border-info-600/40 rounded">MEDIUM</span>;
      case 'low':
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-sans font-medium bg-neutral-900 muster-text-muted border border-neutral-700 rounded">LOW</span>;
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
      
      {/* Compact Board Controls */}
      <div className="flex-none flex items-center justify-between border-b border-muster-border pb-2.5 pt-0.5 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Layout className="w-4 h-4 muster-accent shrink-0" />
          <span className="text-xs font-sans font-bold muster-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">
            Board
          </span>
          <select
            id="board-selector"
            value={selectedBoardId ?? board.id}
            onChange={(event) => onSelectBoard(event.target.value)}
            className="muster-input w-auto text-xs sm:text-sm font-semibold py-1 px-2 cursor-pointer max-w-[180px] sm:max-w-[260px] truncate"
            aria-label="Select board"
          >
            {boards.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setBoardNameInput(board.name);
              setShowBoardSettingsModal(true);
            }}
            className="muster-btn muster-btn-icon muster-btn-ghost"
            title="Board Settings (Rename, Add Column, Delete Board)"
            aria-label="Board settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <CardSearch
            cards={cards}
            placeholder="Search card..."
            onSelectCard={(card) => handleOpenCard(card.id)}
            className="w-36 sm:w-56"
          />

          <label className="flex items-center space-x-1.5">
            <span className="text-xs font-sans font-medium muster-text-muted shrink-0 hidden sm:inline">Sort</span>
            <select
              value={cardDateSortOrder}
              onChange={(event) => setCardDateSortOrder(event.target.value as CardDateSortOrder)}
              className="muster-input w-auto text-xs py-1 px-2 cursor-pointer font-sans"
              aria-label="Sort cards by last updated date"
            >
              <option value="newest">Updated: newest first</option>
              <option value="oldest">Updated: oldest first</option>
            </select>
          </label>
        </div>
      </div>

      {/* Mobile Column Quick Switcher */}
      {columns.length > 0 && (
        <div className="flex md:hidden items-center space-x-1.5 overflow-x-auto no-scrollbar pb-2 shrink-0">
          {columns.map((col) => {
            const count = cards.filter((c) => c.column_id === col.id && !c.archived).length;
            return (
              <button
                key={col.id}
                onClick={() => {
                  const el = document.getElementById(`kanban-column-${col.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
                className={`muster-chip shrink-0 text-xs font-sans py-1 px-2.5 flex items-center gap-1.5 cursor-pointer ${
                  focusedColumnIdx === columns.findIndex((c) => c.id === col.id)
                    ? 'border-brand-500 bg-brand-950/40 text-brand-300 font-semibold ring-1 ring-brand-500/50'
                    : 'hover:border-brand-500/50'
                }`}
              >
                <span>{col.name}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-900 muster-text-muted font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Kanban Drag and Drop Context (Stretches 100% height!) */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board-columns" type="COLUMN" direction="horizontal">
          {(columnsProvided) => (
        <div
          ref={columnsProvided.innerRef}
          {...columnsProvided.droppableProps}
          className="flex-1 flex space-x-3 sm:space-x-4 overflow-x-auto min-h-0 h-full pb-2 snap-x snap-mandatory"
        >
          {columns.map((column, columnIndex) => {
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
              <Draggable key={column.id} draggableId={column.id} index={columnIndex}>
                {(columnDragProvided, columnDragSnapshot) => (
              <div
                id={`kanban-column-${column.id}`}
                ref={columnDragProvided.innerRef}
                {...columnDragProvided.draggableProps}
                className={`w-[85vw] max-w-[340px] md:w-80 flex-shrink-0 snap-center bg-muster-surface rounded-xl tactical-border flex flex-col h-full min-h-0 ${
                  columnDragSnapshot.isDragging
                    ? 'shadow-lg ring-1 ring-brand-500/60'
                    : focusedColumnIdx === columnIndex
                    ? 'ring-2 ring-brand-500/60 border-brand-500/80 bg-brand-950/20 shadow-xl'
                    : ''
                }`}
              >

                {/* Column Header */}
                <div className={`p-3.5 border-b flex items-center justify-between rounded-t-xl ${
                  focusedColumnIdx === columnIndex ? 'bg-brand-950/40 border-brand-500/40' :
                  isExceededWip ? 'bg-danger-950/40 border-danger-500/50 text-danger-300' :
                  isAtWipLimit ? 'bg-warning-950/40 border-warning-500/50 text-warning-300' :
                  'border-muster-border muster-text-primary'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span
                      {...columnDragProvided.dragHandleProps}
                      className="cursor-grab active:cursor-grabbing muster-text-muted hover:muster-text-primary -ml-1 flex-shrink-0"
                      title="Drag to reorder column"
                      aria-label={`Drag to reorder ${column.name} column`}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-sans text-xs font-bold tracking-wide uppercase">{column.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muster-surface-hover muster-text-secondary border border-muster-border">
                      {columnCards.length}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {column.wip_limit !== null && (
                      <span
                        title="WIP limit"
                        className={`text-[10px] font-mono font-semibold ${isExceededWip ? 'muster-text-danger' : isAtWipLimit ? 'muster-text-warning' : 'muster-text-muted'}`}
                      >
                        {columnCards.length}/{column.wip_limit}
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
                      className="p-1 hover:bg-neutral-800 muster-text-muted hover:text-brand-400 rounded transition-colors cursor-pointer"
                      title="Edit column settings"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
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
                              id={`kanban-card-${card.id}`}
                              ref={dragProvided.innerRef}
                              tabIndex={focusedCardId === card.id ? 0 : -1}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => {
                                setFocusedCardId(card.id);
                                handleOpenCard(card.id);
                              }}
                              className={`p-3.5 rounded-lg border transition-all cursor-pointer group ${
                                focusedCardId === card.id
                                  ? 'ring-2 ring-brand-500 bg-brand-950/30 border-brand-500 shadow-xl scale-[1.01]'
                                  : dragSnapshot.isDragging
                                  ? 'bg-muster-surface border-brand-500 shadow-lg scale-102 z-50'
                                  : card.is_epic
                                  ? 'bg-brand-950/20 border-brand-500/50 hover:border-brand-500/80 hover:bg-brand-950/30'
                                  : 'bg-muster-surface border-muster-border hover:border-brand-500/40 hover:bg-neutral-900/90'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <button
                                  onClick={(e) => handleCopyKey(card.key, card.id, e)}
                                  className="flex items-center space-x-1 font-mono text-[10px] text-neutral-500 hover:text-brand-400 group-hover:text-brand-400"
                                  title="Copy card key"
                                >
                                  {copiedKeyCardId === card.id ? (
                                    <Check className="w-2.5 h-2.5" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                  <span>{card.key}</span>
                                </button>
                                <div className="flex items-center space-x-1.5">
                                  {!!card.is_epic && (
                                    <span className="muster-badge muster-badge-accent flex items-center" title="Epic — a container for related work">
                                      <Layers className="w-3 h-3 mr-1" aria-hidden="true" />
                                      EPIC
                                    </span>
                                  )}
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
                                  aria-label={`Assigned to ${card.assignees.map(agent => agent.status ? `${agent.name} (${agent.status})` : agent.name).join(', ')}`}
                                >
                                  {card.assignees.map((agent) => (
                                    <PrincipalChip key={agent.id} name={agent.name} kind={agent.kind} status={agent.status} />
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-muster-border/50 text-[10px] font-sans text-neutral-500 gap-1">
                                <span>Updated {new Date(card.updated_at).toLocaleDateString()}</span>
                                <select
                                  value={column.id}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    const targetColId = e.target.value;
                                    if (targetColId && targetColId !== column.id) {
                                      await onMoveCard(card.id, targetColId);
                                    }
                                  }}
                                  className="bg-transparent muster-text-muted hover:muster-text-primary text-[10px] focus:outline-none cursor-pointer font-sans rounded px-1 py-0.5 border border-transparent hover:border-muster-border"
                                  title="Quick move to lane"
                                  aria-label={`Move ${card.title} to another lane`}
                                >
                                  {columns.map((col) => (
                                    <option key={col.id} value={col.id} className="bg-muster-surface muster-text-primary font-sans">
                                      → {col.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {isDoneLane(column.name) && columnCards.length > DONE_LANE_PAGE_SIZE && (
                        <div className="muster-panel p-3 space-y-2 text-center">
                          <p className="text-[10px] font-sans muster-text-muted">
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
                )}
              </Draggable>
            );
          })}
          {columnsProvided.placeholder}
        </div>
          )}
        </Droppable>
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
            className="muster-dialog w-full max-w-2xl max-h-[85vh] flex flex-col overflow-x-hidden min-w-0"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="p-4 border-b border-muster-border flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-wrap">
                {cardDetails ? (
                  <>
                    <button
                      onClick={(e) => handleCopyKey(cardDetails.key, cardDetails.id, e)}
                      className="flex items-center space-x-1 font-mono text-xs muster-accent font-bold hover:opacity-75"
                      title="Copy card key"
                    >
                      <span>{cardDetails.key}</span>
                      {copiedKeyCardId === cardDetails.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <div className="flex items-center space-x-1 text-xs muster-badge muster-badge-neutral border border-muster-border py-0.5 px-1.5">
                      <Layout className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />
                      <select
                        value={cardDetails.column_id}
                        onChange={async (e) => {
                          const targetColId = e.target.value;
                          if (targetColId && targetColId !== cardDetails.column_id) {
                            await onMoveCard(cardDetails.id, targetColId);
                            setCardDetails((prev) => (prev ? { ...prev, column_id: targetColId } : null));
                          }
                        }}
                        className="bg-transparent muster-text-primary text-xs focus:outline-none cursor-pointer font-sans"
                        title="Change card column / lane"
                      >
                        {columns.map((col) => (
                          <option key={col.id} value={col.id} className="bg-muster-surface muster-text-primary font-sans">
                            {col.name} {col.is_terminal ? '(Done)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!!cardDetails.is_epic && (
                      <span className="muster-badge muster-badge-accent flex items-center" title="Epic — a container for related work">
                        <Layers className="w-3 h-3 mr-1" aria-hidden="true" />
                        EPIC
                      </span>
                    )}
                    {cardDetails.epic_progress && (
                      <span
                        className="muster-badge muster-badge-neutral"
                        title={`${cardDetails.epic_progress.done} of ${cardDetails.epic_progress.total} child cards in a terminal column`}
                      >
                        {cardDetails.epic_progress.done}/{cardDetails.epic_progress.total}
                      </span>
                    )}
                    {getPriorityBadge(cardDetails.priority)}
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
                  className="p-1 muster-text-muted hover:muster-text-primary rounded cursor-pointer"
                  title="Close Task"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>


            <div className="p-5 overflow-y-auto space-y-5 flex-1 font-sans">

              {isEditingCard ? (
                <form onSubmit={isCreatingCard ? handleCreateCard : handleSaveCard} className="space-y-3 bg-muster-surface p-4 rounded-lg border border-brand-500/40">
                  <div>
                    <label className="muster-label">Column / State</label>
                    <select
                      value={isCreatingCard ? newCardColumnId : editCardColumnId}
                      onChange={(e) => isCreatingCard ? setNewCardColumnId(e.target.value) : setEditCardColumnId(e.target.value)}
                      className="w-full bg-muster-base border border-muster-border muster-text-primary text-xs rounded p-2"
                    >
                      {columns.map((col) => (
                        <option key={col.id} value={col.id}>{col.name} {col.is_terminal ? '(Done)' : ''}</option>
                      ))}
                    </select>
                  </div>

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

                  <div className="grid grid-cols-1 gap-3">
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
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editCardIsEpic}
                      onChange={(e) => setEditCardIsEpic(e.target.checked)}
                      className="rounded border-muster-border bg-muster-base text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
                    />
                    <span className="muster-label !mb-0 flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-1 muster-accent" />
                      Epic — a container for related work
                    </span>
                  </label>

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
                        <span key={agent.id} className="inline-flex items-center gap-1">
                          <PrincipalChip name={agent.name} kind={agent.kind} status={agent.status} />
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
                      className="muster-input text-xs py-1 flex-1"
                    >
                      <option value="">Assign to...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.display_name}</option>
                      ))}
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
                        <span key={label.id} className="px-2 py-1 bg-muster-surface-hover muster-text-primary border border-muster-border text-xs rounded">
                          🏷️ {label.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs muster-text-muted italic">No labels</span>
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
                  <span className="text-[10px] muster-text-muted font-normal">Click document to read</span>
                </h4>

                <div className="space-y-2 mb-3">
                  {(cardDetails.linked_documents || []).length > 0 ? (
                    cardDetails.linked_documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => handleOpenLinkedDocument(doc.id)}
                        aria-busy={loadingDocumentId === doc.id}
                        className="flex items-center justify-between bg-muster-surface p-2.5 rounded-lg border border-warning-500/20 hover:border-warning-500/60 hover:bg-muster-surface-hover group cursor-pointer transition-all"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 muster-text-warning flex-shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-sans muster-text-primary group-hover:text-warning-300 truncate font-semibold">
                            {doc.title}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded flex-shrink-0 ${
                            doc.status === 'approved' ? 'bg-success-950 muster-text-success border border-success-600/40' :
                            doc.status === 'in_review' ? 'bg-warning-950 muster-text-warning border border-warning-600/40' :
                            'bg-muster-surface-hover muster-text-muted border border-muster-border'
                          }`}>{doc.status}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-[11px] muster-text-warning font-medium opacity-80 group-hover:opacity-100 flex items-center">
                            {loadingDocumentId === doc.id ? 'Loading…' : (<>Read <Eye className="w-3 h-3 ml-1" /></>)}
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
                    <p className="text-xs muster-text-muted italic">No documents linked to this card.</p>
                  )}
                </div>

                {/* Attach document picker */}
                {documents.length > 0 && (
                  <div className="flex space-x-1.5">
                    <select
                      value={linkDocumentId}
                      onChange={(e) => setLinkDocumentId(e.target.value)}
                      className="muster-input text-xs py-1 flex-1"
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
                        className="flex items-center justify-between bg-muster-surface p-2.5 rounded-lg border border-info-500/20 hover:border-info-500/60 hover:bg-muster-surface-hover group cursor-pointer transition-all"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className={`muster-badge ${CARD_LINK_BADGE_CLASSES[link.relation_type]} flex-shrink-0`}>
                            {CARD_LINK_RELATION_LABELS[link.relation_type]}
                          </span>
                          <span className="font-mono text-[10px] muster-text-muted group-hover:text-info-400 flex-shrink-0">
                            {link.card.key}
                          </span>
                          <span className="text-xs font-sans muster-text-primary group-hover:text-info-300 truncate font-semibold">
                            {link.card.title}
                          </span>
                          {link.card.archived ? (
                            <span className="muster-badge muster-badge-neutral flex-shrink-0">archived</span>
                          ) : null}
                        </div>
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <span className="muster-badge muster-badge-neutral flex-shrink-0" title="Current lane">
                            {link.card.column_name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkCard(link.id, link.card.title);
                            }}
                            className="muster-btn muster-btn-icon muster-btn-ghost-danger opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Unlink card"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs muster-text-muted italic">No linked cards.</p>
                  )}
                </div>

                {/* Relation type + card title search with keyboard navigation */}
                <div className="flex flex-col sm:flex-row gap-1.5 min-w-0">
                  <select
                    value={linkCardRelationType}
                    onChange={(e) => setLinkCardRelationType(e.target.value as CardLinkRelationType)}
                    className="muster-input text-xs py-1 w-full sm:w-36 shrink-0"
                  >
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked by</option>
                    <option value="relates_to">Relates to</option>
                    <option value="duplicates">Duplicates</option>
                    <option value="parent_of">Parent of</option>
                    <option value="child_of">Child of</option>
                  </select>
                  <CardSearch
                    cards={cards}
                    excludeCardId={cardDetails.id}
                    placeholder="Search cards to link..."
                    onSelectCard={(card) => handleLinkCard(card.id)}
                    className="flex-1 min-w-0"
                  />
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
                                className="flex items-center justify-between bg-muster-surface p-2.5 rounded-lg border border-success-500/20 hover:border-success-500/60 hover:bg-muster-surface-hover group transition-all min-w-0 gap-2"
                              >
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden"
                                >
                                  <KindIcon className="w-3.5 h-3.5 muster-text-success flex-shrink-0 group-hover:scale-110 transition-transform" />
                                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded flex-shrink-0 bg-muster-surface-hover muster-text-muted border border-muster-border">
                                    {WORK_LINK_PROVIDER_LABELS[link.provider]}
                                  </span>
                                  <span className="text-xs font-mono muster-text-primary group-hover:text-success-300 truncate min-w-0">
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
                    <p className="text-xs muster-text-muted italic">No work linked to this card yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddWorkLink} className="space-y-1.5 min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    <select
                      value={workLinkKind}
                      onChange={(e) => setWorkLinkKind(e.target.value as CardWorkLinkKind)}
                      className="muster-input text-xs py-1 w-full"
                    >
                      <option value="branch">Branch</option>
                      <option value="pull_request">Pull Request</option>
                      <option value="commit">Commit</option>
                      <option value="pipeline">Pipeline</option>
                    </select>
                    <select
                      value={workLinkProvider}
                      onChange={(e) => setWorkLinkProvider(e.target.value as CardWorkLinkProvider)}
                      className="muster-input text-xs py-1 w-full"
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
                      className="muster-input text-xs py-1 w-full col-span-2 sm:col-span-1"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <input
                      type="text"
                      value={workLinkUrl}
                      onChange={(e) => setWorkLinkUrl(e.target.value)}
                      placeholder="https://forgejo.example/org/repo/pulls/42"
                      className="muster-input text-xs py-1 min-w-0 flex-1"
                    />
                    <button
                      type="submit"
                      disabled={!workLinkUrl.trim()}
                      className="muster-btn muster-btn-primary shrink-0"
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

                <div className="space-y-3 mb-4">
                  {cardDetails.comments.map((c) => (
                    <div key={c.id} className="bg-muster-surface p-3 rounded-lg border border-muster-border space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] muster-text-muted">
                        <div className="flex items-center gap-2 min-w-0">
                          <PrincipalChip name={c.author_name || 'Unknown'} kind={c.author_kind || 'agent'} />
                          <span>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        {canManageComment(c) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="muster-btn muster-btn-icon muster-btn-ghost"
                              title="Edit comment"
                              aria-label="Edit comment"
                              disabled={savingCommentId === c.id}
                              onClick={() => handleStartEditingComment(c)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              className="muster-btn muster-btn-icon muster-btn-ghost-danger"
                              title="Delete comment"
                              aria-label="Delete comment"
                              disabled={savingCommentId === c.id}
                              onClick={() => handleDeleteComment(c.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); void handleSaveComment(c.id); }} className="space-y-2">
                          <textarea
                            autoFocus
                            rows={3}
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            aria-label="Edit comment"
                            className="muster-input text-xs p-3 leading-relaxed w-full resize-y"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="muster-btn muster-btn-secondary"
                              aria-label="Cancel comment edit"
                              onClick={handleCancelEditingComment}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="muster-btn muster-btn-primary"
                              aria-label="Save comment"
                              disabled={!editingCommentText.trim() || savingCommentId === c.id}
                            >
                              {savingCommentId === c.id ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div
                          className="markdown-render text-xs muster-text-primary leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(c.content) }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex flex-col space-y-2">
                  {currentUser ? (
                    <div className="flex items-center space-x-1.5 text-[11px] muster-text-muted">
                      <span>Commenting as</span>
                      <PrincipalChip name={currentUser.display_name} kind="user" />
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <select
                        value={selectedAuthorId}
                        onChange={(e) => setSelectedAuthorId(e.target.value)}
                        className="muster-input text-xs py-1.5 px-2.5"
                      >
                        <option value="">Select Author...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.display_name}</option>
                        ))}
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex space-x-2 items-start">
                    <textarea
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add comment (Markdown supported)..."
                      className="muster-input text-xs p-3 leading-relaxed flex-1 resize-y"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
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

      {/* Board Settings Modal (Rename, Add Column, Delete Board) */}
      {showBoardSettingsModal && (
        <div className="muster-scrim" onClick={() => setShowBoardSettingsModal(false)}>
          <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-muster-border pb-3">
              <h3 className="text-sm font-bold muster-text-primary flex items-center">
                <Settings className="w-4 h-4 mr-2 muster-accent" /> Board Settings
              </h3>
              <button onClick={() => setShowBoardSettingsModal(false)} className="muster-btn muster-btn-icon muster-btn-ghost">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rename Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRenameBoard();
                setShowBoardSettingsModal(false);
              }}
              className="space-y-2"
            >
              <label className="muster-label">Rename Board</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={boardNameInput}
                  onChange={(e) => setBoardNameInput(e.target.value)}
                  placeholder="Board name"
                  className="muster-input flex-1"
                />
                <button
                  type="submit"
                  disabled={!boardNameInput.trim() || boardNameInput === board.name}
                  className="muster-btn muster-btn-primary"
                >
                  Save
                </button>
              </div>
            </form>

            <div className="border-t border-muster-border/60 pt-3 space-y-2">
              <label className="muster-label">Board Actions</label>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => {
                    setShowBoardSettingsModal(false);
                    onOpenNewColumn();
                  }}
                  className="muster-btn muster-btn-secondary justify-start text-xs py-2"
                >
                  <Plus className="w-4 h-4 mr-1.5 muster-accent" /> Add New Column
                </button>

                <button
                  onClick={() => {
                    setShowBoardSettingsModal(false);
                    if (confirm(`Are you sure you want to delete board "${board.name}"?\n\nThis will permanently delete all columns and cards on this board.`)) {
                      onDeleteBoard(board.id);
                    }
                  }}
                  className="muster-btn muster-btn-danger-soft justify-start text-xs py-2"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Delete Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Column Modal */}
      {editingColumn && (
        <EditColumnModal
          column={editingColumn}
          onClose={() => setEditingColumn(null)}
          onSuccess={() => {
            setEditingColumn(null);
            onRefresh();
          }}
          onDelete={(colId) => handleDeleteColumn(colId)}
        />
      )}

    </div>
  );
};
