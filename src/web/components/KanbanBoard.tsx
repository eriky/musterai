import React, { useState } from 'react';
import { Board, Column, Card, AgentRegistration } from '../types';
import { Plus, Filter, MessageSquare, AlertCircle, Clock, UserCheck, Tag } from 'lucide-react';

interface KanbanBoardProps {
  boards: Board[];
  activeBoard: Board | null;
  onSelectBoard: (board: Board) => void;
  onOpenCreateBoard: () => void;
  onOpenCreateCard: (columnId: string) => void;
  onOpenCardDetails: (card: Card) => void;
  onMoveCard: (cardId: string, targetColumnId: string) => void;
  agents: AgentRegistration[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  boards,
  activeBoard,
  onSelectBoard,
  onOpenCreateBoard,
  onOpenCreateCard,
  onOpenCardDetails,
  onMoveCard,
  agents,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const columns: Column[] = activeBoard?.columns || [];

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('cardId', cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) {
      onMoveCard(cardId, columnId);
    }
  };

  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
      {/* Board Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={activeBoard?.id || ''}
            onChange={(e) => {
              const b = boards.find((item) => item.id === e.target.value);
              if (b) onSelectBoard(b);
            }}
            className="input-field"
            style={{ width: '220px', fontWeight: 600 }}
          >
            {boards.length === 0 && <option value="">No boards available</option>}
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button onClick={onOpenCreateBoard} className="btn btn-secondary btn-sm">
            <Plus size={14} /> New Board
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ width: '200px', height: '34px', fontSize: '0.82rem' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#94a3b8" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input-field"
              style={{ width: '130px', height: '34px', fontSize: '0.82rem' }}
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      {columns.length === 0 ? (
        <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#64748b' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '12px' }}>No columns found on this board.</p>
          <button onClick={onOpenCreateBoard} className="btn btn-primary btn-sm">
            <Plus size={14} /> Add Board Columns
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '16px',
          flex: 1,
          overflowX: 'auto',
          paddingBottom: '12px',
        }}>
          {columns.map((col) => {
            const rawCards = col.cards || [];
            const filteredCards = rawCards.filter((card) => {
              if (priorityFilter !== 'all' && card.priority !== priorityFilter) return false;
              if (searchQuery && !card.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
              return true;
            });

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  width: '320px',
                  minWidth: '300px',
                  background: 'rgba(17, 24, 39, 0.65)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                      {col.name}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#94a3b8',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 600,
                    }}>
                      {filteredCards.length}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenCreateCard(col.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px' }}
                    title="Add task card"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Column Card Container */}
                <div style={{
                  padding: '12px',
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  {filteredCards.length === 0 ? (
                    <div style={{
                      border: '2px dashed rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      color: '#475569',
                      fontSize: '0.8rem',
                    }}>
                      Drop cards here
                    </div>
                  ) : (
                    filteredCards.map((card) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        onClick={() => onOpenCardDetails(card)}
                        style={{
                          background: 'rgba(31, 41, 55, 0.85)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'grab',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        }}
                      >
                        {/* Priority Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className={`badge badge-${card.priority}`}>
                            {card.priority}
                          </span>
                          {card.comments && card.comments.length > 0 && (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MessageSquare size={12} /> {card.comments.length}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px', lineHeight: 1.3 }}>
                          {card.title}
                        </h4>

                        {/* Description Snippet */}
                        {card.description && (
                          <p style={{
                            fontSize: '0.78rem',
                            color: '#94a3b8',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '10px',
                          }}>
                            {card.description}
                          </p>
                        )}

                        {/* Card Footer Meta */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          fontSize: '0.74rem',
                          color: '#64748b',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {new Date(card.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>

                          {card.assignees && card.assignees.length > 0 ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a5b4fc', fontSize: '0.74rem' }}>
                              <UserCheck size={12} />
                              {agents.find((a) => a.id === card.assignees![0].agent_id)?.name || 'Assigned'}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.72rem' }}>Unassigned</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
