// File: src/web/components/KanbanBoard.tsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board, Column, Card, Agent, CardDetails, Document, CardLinkRelationType, CardWorkLinkKind, CardWorkLinkProvider, User, AuthMe } from '../types.js';
import { Layout, Plus, Trash2, Edit2, CheckCircle2, ArrowRight, Settings, Layers, X, ChevronDown } from 'lucide-react';
import { api, getLocalProxyToken } from '../api.js';
import {
  CardDateSortOrder,
  DONE_LANE_PAGE_SIZE,
  computeReorderedPosition,
  getLaneCards,
} from '../kanban.js';
import { EditColumnModal } from './Modals.js';
import { DocumentReaderModal } from './DocumentReaderModal.js';
import { CardSearch } from './CardSearch.js';
import { KanbanColumn } from './kanban/KanbanColumn.js';
import { CardDetailDrawer } from './kanban/CardDetailDrawer.js';

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
  onOpenNewBoard?: () => void;
  onDeleteBoard: (boardId: string) => void;
  onOpenDocumentInVault?: (docId: string) => void;
  onRefresh: () => void;
}

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
  onOpenNewBoard,
  onDeleteBoard,
  onOpenDocumentInVault,
  onRefresh,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [copiedKeyCardId, setCopiedKeyCardId] = useState<string | null>(null);
  const [readerDocument, setReaderDocument] = useState<Document | null>(null);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
  const [showBoardSettingsModal, setShowBoardSettingsModal] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState('');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);

  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
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

  const closeCardModal = () => {
    setSelectedCardId(null);
    setCardDetails(null);
    setIsEditingCard(false);
    setIsCreatingCard(false);
    setNewCardColumnId('');
  };

  // Global Escape key handler
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
  }, [showBoardSettingsModal, editingColumn, cardDetails, isCreatingCard]);

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
          const nextColIdx = Math.min(columns.length - 1, activeColIdx + 1);
          setFocusedColumnIdx(nextColIdx);
          const nextCol = columns[nextColIdx];
          const nextColCards = colCardsMap[nextCol.id] || [];
          if (nextColCards.length > 0) {
            focusCard(nextColCards[Math.min(activeCardIdx >= 0 ? activeCardIdx : 0, nextColCards.length - 1)].id);
          } else {
            setFocusedCardId(null);
            document.getElementById(`kanban-column-${nextCol.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          const prevColIdx = Math.max(0, activeColIdx - 1);
          setFocusedColumnIdx(prevColIdx);
          const prevCol = columns[prevColIdx];
          const prevColCards = colCardsMap[prevCol.id] || [];
          if (prevColCards.length > 0) {
            focusCard(prevColCards[Math.min(activeCardIdx >= 0 ? activeCardIdx : 0, prevColCards.length - 1)].id);
          } else {
            setFocusedCardId(null);
            document.getElementById(`kanban-column-${prevCol.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            const nextIdx = activeCardIdx >= 0 ? Math.min(activeColCards.length - 1, activeCardIdx + 1) : 0;
            focusCard(activeColCards[nextIdx].id);
          }
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            const prevIdx = activeCardIdx >= 0 ? Math.max(0, activeCardIdx - 1) : activeColCards.length - 1;
            focusCard(activeColCards[prevIdx].id);
          }
          break;
        }

        case 'PageDown': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            const nextIdx = activeCardIdx >= 0 ? Math.min(activeColCards.length - 1, activeCardIdx + 5) : 0;
            focusCard(activeColCards[nextIdx].id);
          }
          break;
        }

        case 'PageUp': {
          e.preventDefault();
          if (activeColCards.length > 0) {
            const prevIdx = activeCardIdx >= 0 ? Math.max(0, activeCardIdx - 5) : activeColCards.length - 1;
            focusCard(activeColCards[prevIdx].id);
          }
          break;
        }

        case 'Home': {
          e.preventDefault();
          if (activeColCards.length > 0) focusCard(activeColCards[0].id);
          break;
        }

        case 'End': {
          e.preventDefault();
          if (activeColCards.length > 0) focusCard(activeColCards[activeColCards.length - 1].id);
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

  // Handle external new card requests
  useEffect(() => {
    if (newCardRequest && newCardRequest.token > 0) {
      handleOpenNewCardForm(newCardRequest.columnId);
      onNewCardRequestHandled?.();
    }
  }, [newCardRequest, onNewCardRequestHandled]);

  // Handle external open card requests
  useEffect(() => {
    if (openCardRequest && openCardRequest.token > 0 && openCardRequest.cardId) {
      setFocusedCardId(openCardRequest.cardId);
      handleOpenCard(openCardRequest.cardId);
      onOpenCardRequestHandled?.();
    }
  }, [openCardRequest, onOpenCardRequestHandled]);

  const handleOpenCard = async (cardId: string, isEdit = false) => {
    setSelectedCardId(cardId);
    setIsCreatingCard(false);
    setIsEditingCard(isEdit);
    try {
      const details = await api.getCardDetails(cardId);
      setCardDetails(details);
      if (isEdit) {
        setEditCardTitle(details.title);
        setEditCardDescription(details.description || '');
        setEditCardPriority(details.priority);
        setEditCardIsEpic(!!details.is_epic);
        setEditCardColumnId(details.column_id);
      }
    } catch (err) {
      console.error('Failed to load card details:', err);
    }
  };

  const handleOpenNewCardForm = (colId?: string) => {
    const targetColId = colId || columns[0]?.id;
    if (!targetColId) return;

    setSelectedCardId(null);
    setCardDetails(null);
    setIsCreatingCard(true);
    setIsEditingCard(true);
    setNewCardColumnId(targetColId);
    setEditCardTitle('');
    setEditCardDescription('');
    setEditCardPriority('medium');
    setEditCardIsEpic(false);
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

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardDetails || !editCardTitle.trim()) return;

    try {
      const updated = await api.updateCard(cardDetails.id, {
        title: editCardTitle.trim(),
        description: editCardDescription.trim() || undefined,
        priority: editCardPriority,
        is_epic: editCardIsEpic ? 1 : 0,
        column_id: editCardColumnId !== cardDetails.column_id ? editCardColumnId : undefined,
      });

      setCardDetails((prev) => (prev ? { ...prev, ...updated } : null));
      setIsEditingCard(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to update card:', err);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCardTitle.trim() || !newCardColumnId) return;

    try {
      const newCard = await api.createCard(newCardColumnId, {
        title: editCardTitle.trim(),
        description: editCardDescription.trim() || undefined,
        priority: editCardPriority,
        is_epic: editCardIsEpic,
      });

      closeCardModal();
      onRefresh();
      handleOpenCard(newCard.id);
    } catch (err) {
      console.error('Failed to create card:', err);
    }
  };

  const handleDeleteCard = async (cardId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete card "${title}"?`)) return;

    try {
      await api.deleteCard(cardId);
      closeCardModal();
      onRefresh();
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  const handleCopyKey = (key: string, cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedKeyCardId(cardId);
    setTimeout(() => setCopiedKeyCardId(null), 2000);
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!cardDetails) return;
    try {
      await api.assignCard(cardDetails.id, agentId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to assign agent:', err);
    }
  };

  const handleUnassignAgent = async (agentId: string) => {
    if (!cardDetails) return;
    try {
      await api.unassignCard(cardDetails.id, agentId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to unassign agent:', err);
    }
  };

  const handleLinkDocument = async (docId: string) => {
    if (!cardDetails) return;
    try {
      await api.linkDocument(cardDetails.id, docId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to link document:', err);
    }
  };

  const handleUnlinkDocument = async (docId: string) => {
    if (!cardDetails) return;
    try {
      await api.unlinkDocument(cardDetails.id, docId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to unlink document:', err);
    }
  };

  const handleOpenLinkedDocument = async (docId: string) => {
    setLoadingDocumentId(docId);
    try {
      const fullDoc = await api.getDocumentDetails(docId);
      setReaderDocument(fullDoc);
    } catch (err) {
      console.error('Failed to load document content:', err);
    } finally {
      setLoadingDocumentId(null);
    }
  };

  const handleLinkCard = async (targetCardId: string, relationType: CardLinkRelationType) => {
    if (!cardDetails) return;
    try {
      await api.linkCard(cardDetails.id, targetCardId, relationType);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to link card:', err);
    }
  };

  const handleUnlinkCard = async (linkId: string) => {
    if (!cardDetails) return;
    try {
      await api.unlinkCard(cardDetails.id, linkId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to unlink card:', err);
    }
  };

  const handleAddWorkLink = async (data: { kind: CardWorkLinkKind; provider: CardWorkLinkProvider; url: string; external_ref?: string }) => {
    if (!cardDetails) return;
    await api.addWorkLink(cardDetails.id, data);
    const updated = await api.getCardDetails(cardDetails.id);
    setCardDetails(updated);
    onRefresh();
  };

  const handleRemoveWorkLink = async (linkId: string) => {
    if (!cardDetails) return;
    try {
      await api.removeWorkLink(cardDetails.id, linkId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to remove work link:', err);
    }
  };

  const handleAddComment = async (authorId: string, content: string) => {
    if (!cardDetails) return;
    try {
      await api.addComment(cardDetails.id, authorId, content);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    if (!cardDetails) return;
    try {
      await api.updateComment(cardDetails.id, commentId, content);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!cardDetails) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.deleteComment(cardDetails.id, commentId);
      const updated = await api.getCardDetails(cardDetails.id);
      setCardDetails(updated);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleRenameBoard = async () => {
    if (!board || !boardNameInput.trim()) return;
    try {
      await api.updateBoard(board.id, boardNameInput.trim());
      setIsEditingBoardName(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to rename board:', err);
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    try {
      await api.deleteColumn(colId);
      setEditingColumn(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete column:', err);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'COLUMN') {
      const newPos = computeReorderedPosition(
        columns,
        source.index,
        destination.index
      );
      onMoveColumn(draggableId, newPos);
      return;
    }

    const targetColCards = cards.filter((c) => c.column_id === destination.droppableId);
    const newPos = computeReorderedPosition(
      targetColCards,
      source.droppableId === destination.droppableId ? source.index : targetColCards.length,
      destination.index
    );

    onMoveCard(draggableId, destination.droppableId, newPos);
  };

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 muster-text-muted text-sm font-sans">
        Select a board to view tasks.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 font-sans space-y-4">
      {/* Board Header Bar */}
      <div className="flex-none flex items-center justify-between border-b border-muster-border pb-3 gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <Layout className="w-5 h-5 muster-accent shrink-0" />
          {isEditingBoardName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRenameBoard();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={boardNameInput}
                onChange={(e) => setBoardNameInput(e.target.value)}
                className="muster-input text-sm py-1 font-bold"
                autoFocus
              />
              <button type="submit" className="muster-btn muster-btn-primary py-1 px-2.5 text-xs">
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBoardName(false)}
                className="muster-btn muster-btn-secondary py-1 px-2.5 text-xs"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center space-x-1 min-w-0">
              <div className="relative flex items-center min-w-0">
                <select
                  value={selectedBoardId || board.id}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_BOARD__') {
                      onOpenNewBoard?.();
                    } else {
                      onSelectBoard(e.target.value);
                    }
                  }}
                  className="muster-input text-base font-bold py-1 pl-2 pr-7 bg-transparent hover:bg-muster-surface-hover border-transparent hover:border-muster-border rounded-lg cursor-pointer font-sans muster-text-primary focus:ring-1 focus:ring-brand-500 appearance-none max-w-[200px] sm:max-w-[320px] truncate"
                  aria-label="Select board"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id} className="bg-muster-surface text-xs font-semibold py-1">
                      {b.name}
                    </option>
                  ))}
                  {onOpenNewBoard && (
                    <option value="__NEW_BOARD__" className="bg-muster-surface text-xs font-semibold py-1 muster-accent font-bold">
                      + Create New Board...
                    </option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 muster-text-muted absolute right-1.5 pointer-events-none" />
              </div>

              <button
                onClick={() => {
                  setBoardNameInput(board.name);
                  setShowBoardSettingsModal(true);
                }}
                className="p-1 muster-text-muted hover:muster-text-primary rounded transition-colors shrink-0"
                title="Board Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button onClick={() => handleOpenNewCardForm()} className="muster-btn muster-btn-primary shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Card
          </button>

          <CardSearch
            cards={cards}
            placeholder="Search card..."
            onSelectCard={(card) => handleOpenCard(card.id)}
            className="w-44 sm:w-72 md:w-80 shrink-0"
          />

          <label className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs font-sans font-medium muster-text-muted shrink-0 hidden sm:inline">Sort</span>
            <select
              value={cardDateSortOrder}
              onChange={(e) => setCardDateSortOrder(e.target.value as CardDateSortOrder)}
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
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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

      {/* Main Board Columns Area */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board-columns" type="COLUMN" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 flex space-x-4 overflow-x-auto pb-4 min-h-0 select-none"
            >
              {columns.map((column, colIdx) => {
                const doneLimit = doneVisibleLimits[column.id] ?? DONE_LANE_PAGE_SIZE;
                const { all: colCards, visible: visibleCards } = getLaneCards(
                  cards,
                  column.id,
                  column.name,
                  cardDateSortOrder,
                  doneLimit
                );

                return (
                  <Draggable key={column.id} draggableId={column.id} index={colIdx}>
                    {(colDragProvided) => (
                      <KanbanColumn
                        column={column}
                        columnIndex={colIdx}
                        allColumns={columns}
                        columnCards={colCards}
                        visibleColumnCards={visibleCards}
                        focusedColumnIdx={focusedColumnIdx}
                        focusedCardId={focusedCardId}
                        copiedKeyCardId={copiedKeyCardId}
                        doneVisibleLimit={doneLimit}
                        columnDragProvided={colDragProvided}
                        onOpenNewCardForm={handleOpenNewCardForm}
                        onEditColumnSettings={setEditingColumn}
                        onFocusCard={setFocusedCardId}
                        onOpenCard={handleOpenCard}
                        onCopyKey={handleCopyKey}
                        onDeleteCard={handleDeleteCard}
                        onMoveCard={async (cId, tId) => onMoveCard(cId, tId)}
                        onSetDoneVisibleLimit={(cId, limit) =>
                          setDoneVisibleLimits((curr) => ({ ...curr, [cId]: limit }))
                        }
                      />
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Card Details / Drawer Modal */}
      {(cardDetails || isCreatingCard) && (
        <CardDetailDrawer
          cardDetails={cardDetails}
          columns={columns}
          allCards={cards}
          users={users}
          agents={agents}
          documents={documents}
          currentUser={currentUser}
          copiedKeyCardId={copiedKeyCardId}
          isEditingCard={isEditingCard}
          isCreatingCard={isCreatingCard}
          editCardTitle={editCardTitle}
          editCardDescription={editCardDescription}
          editCardPriority={editCardPriority}
          editCardIsEpic={editCardIsEpic}
          editCardColumnId={editCardColumnId}
          newCardColumnId={newCardColumnId}
          loadingDocumentId={loadingDocumentId}
          onClose={closeCardModal}
          onCopyKey={handleCopyKey}
          onMoveCard={async (cId, tId) => {
            onMoveCard(cId, tId);
            setCardDetails((prev) => (prev ? { ...prev, column_id: tId } : null));
          }}
          onStartEditingCard={handleStartEditingCard}
          onDeleteCard={handleDeleteCard}
          onSaveCard={handleSaveCard}
          onCreateCard={handleCreateCard}
          setEditCardTitle={setEditCardTitle}
          setEditCardDescription={setEditCardDescription}
          setEditCardPriority={setEditCardPriority}
          setEditCardIsEpic={setEditCardIsEpic}
          setEditCardColumnId={setEditCardColumnId}
          setNewCardColumnId={setNewCardColumnId}
          setIsEditingCard={setIsEditingCard}
          onAssignAgent={handleAssignAgent}
          onUnassignAgent={handleUnassignAgent}
          onOpenLinkedDocument={handleOpenLinkedDocument}
          onLinkDocument={handleLinkDocument}
          onUnlinkDocument={handleUnlinkDocument}
          onLinkCard={handleLinkCard}
          onUnlinkCard={(lId, _title) => handleUnlinkCard(lId)}
          onAddWorkLink={handleAddWorkLink}
          onRemoveWorkLink={handleRemoveWorkLink}
          onOpenCard={handleOpenCard}
          onAddComment={handleAddComment}
          onUpdateComment={handleUpdateComment}
          onDeleteComment={handleDeleteComment}
        />
      )}

      {/* Document Reader Modal */}
      {readerDocument && (
        <DocumentReaderModal
          document={readerDocument}
          onClose={() => setReaderDocument(null)}
          onOpenInVault={onOpenDocumentInVault}
        />
      )}

      {/* Board Settings Modal */}
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
                    if (
                      confirm(
                        `Are you sure you want to delete board "${board.name}"?\n\nThis will permanently delete all columns and cards on this board.`
                      )
                    ) {
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
