// File: src/web/components/KanbanBoard.tsx
import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Board, Column, Card, Agent, CardDetails, Document } from '../types.js';
import { Layout, Plus, MessageSquare, X, Tag, UserPlus, Trash2, Edit2, FileText, Link2, Unlink } from 'lucide-react';
import { marked } from 'marked';
import { api } from '../api.js';


interface KanbanBoardProps {
  board: Board | null;
  columns: Column[];
  cards: Card[];
  agents: Agent[];
  documents: Document[];
  onMoveCard: (cardId: string, targetColumnId: string, position?: string) => void;
  onOpenNewCard: (columnId?: string) => void;
  onOpenNewColumn: () => void;
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
  onRefresh,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [commentText, setCommentText] = useState('');
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');
  const [assignAgentId, setAssignAgentId] = useState<string>('');
  const [linkDocumentId, setLinkDocumentId] = useState<string>('');

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    onMoveCard(draggableId, destination.droppableId);
  };

  const handleOpenCard = async (cardId: string) => {
    setSelectedCardId(cardId);
    try {
      const details = await api.getCardDetails(cardId);
      setCardDetails(details);
    } catch (err) {
      console.error('Failed to load card details:', err);
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
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-950 text-rose-400 border border-rose-600/50 rounded">CRITICAL</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-600/50 rounded">HIGH</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-cyan-950 text-cyan-400 border border-cyan-600/40 rounded">MEDIUM</span>;
      case 'low':
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-zinc-900 text-zinc-400 border border-zinc-700 rounded">LOW</span>;
    }
  };

  if (!board) {
    return (
      <div className="text-center py-16 bg-command-surface rounded-xl tactical-border">
        <Layout className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-sm font-sans text-zinc-300 font-semibold">No Board Available</h3>
        <p className="text-xs font-sans text-zinc-500 mt-1">Select or create a board to manage cards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Board Controls */}
      <div className="flex items-center justify-between border-b border-command-border pb-3">
        <div className="flex items-center space-x-3">
          <Layout className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-sans font-bold text-zinc-100 uppercase tracking-wide">
            Board: {board.name}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenNewColumn}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Column
          </button>

          <button
            onClick={() => onOpenNewCard()}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-semibold bg-cyan-600 hover:bg-cyan-500 text-zinc-950 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
          </button>
        </div>
      </div>

      {/* Kanban Drag and Drop Context */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex space-x-4 overflow-x-auto pb-6 pt-1 min-h-[600px]">
          {columns.map((column) => {
            const columnCards = cards.filter(c => c.column_id === column.id && !c.archived);
            const isAtWipLimit = column.wip_limit !== null && columnCards.length >= column.wip_limit;
            const isExceededWip = column.wip_limit !== null && columnCards.length > column.wip_limit;

            return (
              <div
                key={column.id}
                className="w-80 flex-shrink-0 bg-command-surface rounded-xl tactical-border flex flex-col max-h-[750px]"
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b flex items-center justify-between ${
                  isExceededWip ? 'bg-rose-950/40 border-rose-500/50 text-rose-300' :
                  isAtWipLimit ? 'bg-amber-950/40 border-amber-500/50 text-amber-300' :
                  'border-command-border text-zinc-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-sans text-xs font-bold tracking-wide uppercase">{column.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-700">
                      {columnCards.length}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {column.wip_limit !== null && (
                      <span className={`text-[10px] font-mono font-semibold ${isExceededWip ? 'text-rose-400' : isAtWipLimit ? 'text-amber-400' : 'text-zinc-500'}`}>
                        WIP Limit: {column.wip_limit}
                      </span>
                    )}

                    <button
                      onClick={() => onOpenNewCard(column.id)}
                      className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 rounded transition-colors cursor-pointer"
                      title="Add card to column"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteColumn(column.id)}
                      className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
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
                        snapshot.isDraggingOver ? 'bg-cyan-950/20' : ''
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
                              className={`p-3.5 bg-command-card rounded-lg border transition-all cursor-pointer group ${
                                dragSnapshot.isDragging
                                  ? 'border-cyan-500 shadow-lg scale-102 z-50'
                                  : 'border-command-border hover:border-cyan-500/40 hover:bg-zinc-900/90'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-[10px] text-zinc-500 group-hover:text-cyan-400">
                                  #{card.id.substring(card.id.length - 6)}
                                </span>
                                {getPriorityBadge(card.priority)}
                              </div>

                              <h4 className="text-xs font-sans font-semibold text-zinc-100 group-hover:text-cyan-200 line-clamp-2 mb-2">
                                {card.title}
                              </h4>

                              {card.description && (
                                <p className="text-[11px] font-sans text-zinc-400 line-clamp-2 mb-3">
                                  {card.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-command-border/50 text-[10px] font-mono text-zinc-500">
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setSelectedCardId(null); setCardDetails(null); }}
        >
          <div
            className="bg-command-surface border border-cyan-500/40 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="p-4 border-b border-command-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-cyan-400 font-bold">Card #{cardDetails.id}</span>
                {getPriorityBadge(cardDetails.priority)}
              </div>
              <button
                onClick={() => { setSelectedCardId(null); setCardDetails(null); }}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1 font-sans">
              <div>
                <h3 className="text-base font-bold text-zinc-100">{cardDetails.title}</h3>
                <div
                  className="markdown-render text-xs text-zinc-300 mt-2 bg-command-card p-3 rounded-lg border border-command-border leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: marked.parse(cardDetails.description || 'No description provided.') as string }}
                />
              </div>

              {/* Assignees & Assign Control */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Assignees</h4>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {cardDetails.assignees.length > 0 ? (
                      cardDetails.assignees.map((agent) => (
                        <span key={agent.id} className="px-2 py-1 bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 text-xs font-mono rounded">
                          🤖 {agent.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500 italic">Unassigned</span>
                    )}
                  </div>

                  <div className="flex space-x-1.5">
                    <select
                      value={assignAgentId}
                      onChange={(e) => setAssignAgentId(e.target.value)}
                      className="bg-command-card border border-command-border text-zinc-200 text-xs rounded px-2 py-1 flex-1"
                    >
                      <option value="">Select Agent...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignAgent}
                      disabled={!assignAgentId}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 text-zinc-950 text-xs font-bold rounded cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Labels</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {cardDetails.labels.length > 0 ? (
                      cardDetails.labels.map((label) => (
                        <span key={label.id} className="px-2 py-1 bg-zinc-900 text-zinc-200 border border-zinc-700 text-xs rounded">
                          🏷️ {label.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No labels</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Documents */}
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-amber-400" />
                  Linked Documents ({(cardDetails.linked_documents || []).length})
                </h4>

                <div className="space-y-2 mb-3">
                  {(cardDetails.linked_documents || []).length > 0 ? (
                    cardDetails.linked_documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-command-card p-2.5 rounded-lg border border-amber-500/20 group">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span className="text-xs font-sans text-zinc-200 truncate">{doc.title}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded flex-shrink-0 ${
                            doc.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40' :
                            doc.status === 'in_review' ? 'bg-amber-950 text-amber-400 border border-amber-600/40' :
                            'bg-zinc-900 text-zinc-400 border border-zinc-700'
                          }`}>{doc.status}</span>
                        </div>
                        <button
                          onClick={() => handleUnlinkDocument(doc.id)}
                          className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100"
                          title="Unlink document"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No documents linked to this card.</p>
                  )}
                </div>

                {/* Attach document picker */}
                {documents.length > 0 && (
                  <div className="flex space-x-1.5">
                    <select
                      value={linkDocumentId}
                      onChange={(e) => setLinkDocumentId(e.target.value)}
                      className="bg-command-card border border-command-border text-zinc-200 text-xs rounded px-2 py-1 flex-1"
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
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-zinc-950 text-xs font-bold rounded cursor-pointer flex items-center space-x-1"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Link</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 text-cyan-400" />
                  Comments ({cardDetails.comments.length})
                </h4>

                <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                  {cardDetails.comments.map((c) => (
                    <div key={c.id} className="bg-command-card p-3 rounded-lg border border-command-border space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="text-cyan-400 font-semibold">{c.author_name || 'Agent/User'}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <div
                        className="markdown-render text-xs text-zinc-200 leading-relaxed overflow-x-auto [&>p:last-child]:mb-0"
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
                      className="bg-command-card border border-command-border text-zinc-200 text-xs rounded px-2.5 py-1.5"
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
                      className="flex-1 bg-command-card border border-command-border text-zinc-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-cyan-500 resize-y"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || !selectedAuthorId}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 text-zinc-950 text-xs font-bold rounded cursor-pointer"
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

    </div>
  );
};
