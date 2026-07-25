// File: src/web/components/KanbanBoard.tsx
import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board, Column, Card, Agent, CardDetails, Document } from '../types.js';
import { Layout, Plus, MessageSquare, X, Tag, UserPlus, Trash2, Edit2, FileText, Link2, Unlink, Check, AlertTriangle, Eye, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { marked } from 'marked';
import { api } from '../api.js';
import { EditColumnModal } from './Modals.js';
import { DocumentReaderModal } from './DocumentReaderModal.js';


interface KanbanBoardProps {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  agents: Agent[];
  documents: Document[];
  onMoveCard: (cardId: string, targetColumnId: string, position?: string) => void;
  onOpenNewCard: (columnId?: string) => void;
  onOpenNewColumn: () => void;
  onDeleteBoard: (boardId: string) => void;
  onOpenDocumentInVault?: (docId: string) => void;
  onRefresh: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  board,
  columns,
  cards,
  agents,
  documents,
  onMoveCard,
  onOpenNewCard,
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
  const [linkDocumentId, setLinkDocumentId] = useState<string>('');
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState('');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editCardTitle, setEditCardTitle] = useState('');
  const [editCardDescription, setEditCardDescription] = useState('');
  const [editCardPriority, setEditCardPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [editCardStatus, setEditCardStatus] = useState<'active' | 'blocked' | 'in_review'>('active');
  const [editCardBlockedReason, setEditCardBlockedReason] = useState<string>('');

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


  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    onMoveCard(draggableId, destination.droppableId);
  };

  const handleOpenCard = async (cardId: string, editMode = false) => {
    setSelectedCardId(cardId);
    try {
      const details = await api.getCardDetails(cardId);
      setCardDetails(details);
      setEditCardTitle(details.title);
      setEditCardDescription(details.description || '');
      setEditCardPriority(details.priority);
      setEditCardStatus(details.status || 'active');
      setEditCardBlockedReason(details.blocked_reason || '');
      setIsEditingCard(editMode);
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
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-danger-950 cap-text-danger border border-danger-600/50 rounded">CRITICAL</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-warning-950 cap-text-warning border border-warning-600/50 rounded">HIGH</span>;
      case 'medium':
        // `info`, not `brand`: priority is a severity scale, and the other
        // four steps are profile-independent. On `brand` this step alone
        // changed hue per profile — reading as "success" under Emerald.
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-info-950 cap-text-info border border-info-600/40 rounded">MEDIUM</span>;
      case 'low':
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-neutral-900 cap-text-muted border border-neutral-700 rounded">LOW</span>;
    }
  };

  if (!board) {
    return (
      <div className="text-center py-16 bg-cap-surface rounded-lg tactical-border">
        <Layout className="w-12 h-12 cap-text-faint mx-auto mb-3" />
        <h3 className="text-sm font-sans cap-text-secondary font-semibold">No Board Available</h3>
        <p className="text-xs font-sans text-neutral-500 mt-1">Select or create a board to manage cards.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-4">
      
      {/* Board Controls */}
      <div className="flex-none flex items-center justify-between border-b border-cap-border pb-3">
        {isEditingBoardName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameBoard();
            }}
            className="flex items-center space-x-2"
          >
            <Layout className="w-5 h-5 cap-accent" />
            <span className="text-base font-sans font-bold cap-text-muted uppercase tracking-wide">
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
              className="bg-cap-surface border border-brand-500 cap-text-primary text-sm font-sans font-bold px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={!boardNameInput.trim()}
              className="p-1.5 hover:bg-brand-950 cap-accent hover:text-brand-300 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Save Board Name"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingBoardName(false)}
              className="p-1.5 hover:bg-neutral-800 cap-text-muted hover:text-neutral-200 rounded transition-colors cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center space-x-2">
            <Layout className="w-5 h-5 cap-accent" />
            <h2 className="text-base font-sans font-bold cap-text-primary uppercase tracking-wide">
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


          <button
            onClick={() => onOpenNewCard()}
            className="cap-btn cap-btn-primary"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
          </button>
        </div>
      </div>

      {/* Kanban Drag and Drop Context (Stretches 100% height!) */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex space-x-4 overflow-x-auto min-h-0 h-full pb-2">
          {columns.map((column) => {
            const columnCards = cards.filter(c => c.column_id === column.id && !c.archived);
            const isAtWipLimit = column.wip_limit !== null && columnCards.length >= column.wip_limit;
            const isExceededWip = column.wip_limit !== null && columnCards.length > column.wip_limit;

            return (
              <div
                key={column.id}
                className="w-80 flex-shrink-0 bg-cap-surface rounded-xl tactical-border flex flex-col h-full min-h-0"
              >

                {/* Column Header */}
                <div className={`p-3.5 border-b flex items-center justify-between ${
                  isExceededWip ? 'bg-danger-950/40 border-danger-500/50 text-danger-300' :
                  isAtWipLimit ? 'bg-warning-950/40 border-warning-500/50 text-warning-300' :
                  'border-cap-border text-neutral-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-sans text-xs font-bold tracking-wide uppercase">{column.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 cap-text-secondary border border-neutral-700">
                      {columnCards.length}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {column.wip_limit !== null && (
                      <span className={`text-[10px] font-mono font-semibold ${isExceededWip ? 'cap-text-danger' : isAtWipLimit ? 'cap-text-warning' : 'text-neutral-500'}`}>
                        WIP Limit: {column.wip_limit}
                      </span>
                    )}

                    <button
                      onClick={() => onOpenNewCard(column.id)}
                      className="p-1 hover:bg-neutral-800 cap-text-muted hover:text-brand-400 rounded transition-colors cursor-pointer"
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
                      {columnCards.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => handleOpenCard(card.id)}
                              className={`p-3.5 bg-cap-surface rounded-lg border transition-all cursor-pointer group ${
                                dragSnapshot.isDragging
                                  ? 'border-brand-500 shadow-lg scale-102 z-50'
                                  : 'border-cap-border hover:border-brand-500/40 hover:bg-neutral-900/90'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-[10px] text-neutral-500 group-hover:text-brand-400">
                                  #{card.id.substring(card.id.length - 6)}
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  {getPriorityBadge(card.priority)}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenCard(card.id, true);
                                    }}
                                    className="cap-btn cap-btn-icon cap-btn-ghost"
                                    title="Edit Task"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCard(card.id, card.title);
                                    }}
                                    className="cap-btn cap-btn-icon cap-btn-ghost-danger"
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
                                      <AlertTriangle className="w-3.5 h-3.5 cap-text-danger flex-shrink-0" />
                                      <span className="truncate">{card.blocked_reason ? `Blocked: ${card.blocked_reason}` : 'Blocked'}</span>
                                    </div>
                                  )}
                                  {card.status === 'in_review' && (
                                    <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-warning-950/80 text-warning-300 border border-warning-500/50 text-[11px] font-medium">
                                      <Eye className="w-3.5 h-3.5 cap-text-warning flex-shrink-0" />
                                      <span className="truncate">{card.blocked_reason || 'Waiting for Human Review'}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <h4 className="text-xs font-sans font-semibold cap-text-primary group-hover:text-brand-200 line-clamp-2 mb-2">
                                {card.title}
                              </h4>

                              {card.description && (
                                <p className="text-[11px] font-sans cap-text-muted line-clamp-2 mb-3">
                                  {card.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-cap-border/50 text-[10px] font-mono text-neutral-500">
                                <span>Updated {new Date(card.updated_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Card Detail Modal */}
      {selectedCardId && cardDetails && (
        <div
          className="cap-scrim"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSelectedCardId(null);
              setCardDetails(null);
              setIsEditingCard(false);
            }
          }}
          onClick={() => { setSelectedCardId(null); setCardDetails(null); setIsEditingCard(false); }}
        >
          <div
            className="cap-dialog w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="p-4 border-b border-cap-border flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-mono text-xs cap-accent font-bold">Card #{cardDetails.id}</span>
                {getPriorityBadge(cardDetails.priority)}
                {cardDetails.status === 'blocked' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-danger-950/80 text-danger-300 border border-danger-500/50 flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1 cap-text-danger" /> Blocked
                  </span>
                )}
                {cardDetails.status === 'in_review' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-warning-950/80 text-warning-300 border border-warning-500/50 flex items-center">
                    <Eye className="w-3 h-3 mr-1 cap-text-warning" /> Human Review
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
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
                <button
                  onClick={() => { setSelectedCardId(null); setCardDetails(null); setIsEditingCard(false); }}
                  className="p-1 cap-text-muted hover:text-neutral-100 rounded cursor-pointer"
                  title="Close Task"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>


            <div className="p-5 overflow-y-auto space-y-5 flex-1 font-sans">
              
              {/* Prominent Card Status Banners */}
              {cardDetails.status === 'blocked' && !isEditingCard && (
                <div className="p-3 bg-danger-950/70 border border-danger-500/60 rounded-lg flex items-center justify-between text-xs text-danger-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 cap-text-danger flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider cap-text-danger">Card Blocked:</span>{' '}
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

              {cardDetails.status === 'in_review' && !isEditingCard && (
                <div className="p-3 bg-warning-950/70 border border-warning-500/60 rounded-lg flex items-center justify-between text-xs text-warning-200">
                  <div className="flex items-start space-x-2">
                    <Eye className="w-4 h-4 cap-text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider cap-text-warning">Waiting for Human Review:</span>{' '}
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
                <form onSubmit={handleSaveCard} className="space-y-3 bg-cap-surface p-4 rounded-lg border border-brand-500/40">
                  <div>
                    <label className="cap-label">Task Title</label>
                    <input
                      type="text"
                      required
                      value={editCardTitle}
                      onChange={(e) => setEditCardTitle(e.target.value)}
                      className="w-full bg-cap-base border border-cap-border cap-text-primary font-sans font-semibold text-xs rounded p-2 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="cap-label">Priority</label>
                      <select
                        value={editCardPriority}
                        onChange={(e) => setEditCardPriority(e.target.value as any)}
                        className="w-full bg-cap-base border border-cap-border cap-text-primary text-xs rounded p-2"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="cap-label">Card Status</label>
                      <select
                        value={editCardStatus}
                        onChange={(e) => setEditCardStatus(e.target.value as any)}
                        className="w-full bg-cap-base border border-cap-border cap-text-primary text-xs rounded p-2"
                      >
                        <option value="active">Active (Normal)</option>
                        <option value="in_review">In Review (Waiting for Human)</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                  </div>

                  {editCardStatus !== 'active' && (
                    <div>
                      <label className="cap-label">
                        {editCardStatus === 'blocked' ? 'Blocked Reason' : 'Review Reason / Note'}
                      </label>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editCardBlockedReason}
                          onChange={(e) => setEditCardBlockedReason(e.target.value)}
                          placeholder={editCardStatus === 'blocked' ? 'e.g. Requires human review' : 'e.g. Waiting on operator signoff'}
                          className="cap-input"
                        />
                        <div className="flex flex-wrap gap-1">
                          {['Requires Human Review', 'Waiting on Dependency', 'Environment Issue', 'Waiting on Input'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditCardBlockedReason(preset)}
                              className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] cap-text-secondary rounded border border-neutral-700 transition-colors cursor-pointer"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="cap-label">Description (Markdown)</label>
                    <textarea
                      rows={5}
                      value={editCardDescription}
                      onChange={(e) => setEditCardDescription(e.target.value)}
                      placeholder="Task description (markdown supported)..."
                      className="w-full bg-cap-base border border-cap-border cap-text-primary font-sans text-xs rounded p-2.5 focus:border-brand-500 focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingCard(false)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 cap-text-secondary rounded text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!editCardTitle.trim()}
                      className="cap-btn cap-btn-lg cap-btn-primary"
                    >
                      Save Task
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold cap-text-primary">{cardDetails.title}</h3>
                    <div className="flex items-center space-x-2">
                      {/* Direct status switcher pill */}
                      <select
                        value={cardDetails.status || 'active'}
                        onChange={(e) => handleUpdateCardStatus(e.target.value as any)}
                        className="bg-cap-surface border border-cap-border text-neutral-200 text-xs rounded px-2 py-1"
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
                    className="markdown-render text-xs cap-text-secondary mt-2 bg-cap-surface p-3 rounded-lg border border-cap-border leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: marked.parse(cardDetails.description || 'No description provided.') as string }}
                  />
                </div>
              )}

              {/* Assignees & Assign Control */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold cap-text-muted uppercase mb-2">Assignees</h4>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {cardDetails.assignees.length > 0 ? (
                      cardDetails.assignees.map((agent) => (
                        <span key={agent.id} className="px-2 py-1 bg-brand-950/60 text-brand-300 border border-brand-500/30 text-xs font-mono rounded">
                          🤖 {agent.name}
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
                      className="bg-cap-surface border border-cap-border text-neutral-200 text-xs rounded px-2 py-1 flex-1"
                    >
                      <option value="">Select Agent...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignAgent}
                      disabled={!assignAgentId}
                      className="cap-btn cap-btn-primary"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold cap-text-muted uppercase mb-2">Labels</h4>
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
                <h4 className="text-xs font-bold cap-text-secondary uppercase mb-3 flex items-center justify-between">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1.5 cap-text-warning" />
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
                        className="flex items-center justify-between bg-cap-surface p-2.5 rounded-lg border border-warning-500/20 hover:border-warning-500/60 hover:bg-neutral-900/90 group cursor-pointer transition-all"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 cap-text-warning flex-shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-sans text-neutral-200 group-hover:text-warning-300 truncate font-semibold">
                            {doc.title}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded flex-shrink-0 ${
                            doc.status === 'approved' ? 'bg-success-950 cap-text-success border border-success-600/40' :
                            doc.status === 'in_review' ? 'bg-warning-950 cap-text-warning border border-warning-600/40' :
                            'bg-neutral-900 cap-text-muted border border-neutral-700'
                          }`}>{doc.status}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-[11px] cap-text-warning font-medium opacity-80 group-hover:opacity-100 flex items-center">
                            Read <Eye className="w-3 h-3 ml-1" />
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkDocument(doc.id);
                            }}
                            className="cap-btn cap-btn-icon cap-btn-ghost-danger opacity-0 group-hover:opacity-100"
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
                      className="bg-cap-surface border border-cap-border text-neutral-200 text-xs rounded px-2 py-1 flex-1"
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
                      className="cap-btn cap-btn-primary"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Link</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div>
                <h4 className="text-xs font-bold cap-text-secondary uppercase mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 cap-accent" />
                  Comments ({cardDetails.comments.length})
                </h4>

                <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                  {cardDetails.comments.map((c) => (
                    <div key={c.id} className="bg-cap-surface p-3 rounded-lg border border-cap-border space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] cap-text-muted">
                        <span className="cap-accent font-semibold">{c.author_name || 'Agent/User'}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <div
                        className="markdown-render text-xs text-neutral-200 leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
                        dangerouslySetInnerHTML={{ __html: marked.parse(c.content || '') as string }}
                      />
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment} className="flex flex-col space-y-2">
                  <div className="flex space-x-2">
                    <select
                      value={selectedAuthorId}
                      onChange={(e) => setSelectedAuthorId(e.target.value)}
                      className="bg-cap-surface border border-cap-border text-neutral-200 text-xs rounded px-2.5 py-1.5"
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
                      className="flex-1 bg-cap-surface border border-cap-border text-neutral-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-brand-500 resize-y"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || !selectedAuthorId}
                      className="cap-btn cap-btn-lg cap-btn-primary"
                    >
                      Comment
                    </button>
                  </div>
                </form>

              </div>
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
