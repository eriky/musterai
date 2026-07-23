import React, { useState } from 'react';
import { Card, AgentRegistration } from '../types';
import { X, Send, UserPlus, Tag, MessageSquare, AlertTriangle, Clock, UserCheck, Trash2 } from 'lucide-react';
import { addComment, assignCard, deleteCard, unassignCard, updateCard } from '../api';

interface CardModalProps {
  card: Card;
  agents: AgentRegistration[];
  onClose: () => void;
  onRefresh: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({ card, agents, onClose, onRefresh }) => {
  const [commentText, setCommentText] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [assignAgentId, setAssignAgentId] = useState('');
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [priority, setPriority] = useState(card.priority);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddComment = async () => {
    if (!commentText.trim() || agents.length === 0) return;
    const authorId = selectedAgent || agents[0].id;
    await addComment(card.id, authorId, commentText.trim());
    setCommentText('');
    onRefresh();
  };

  const handleAssign = async (agentId: string) => {
    if (!agentId) return;
    try {
      await assignCard(card.id, agentId);
      setAssignAgentId('');
      onRefresh();
    } catch (err) {
      console.error('Failed to assign agent:', err);
      alert('Failed to assign agent to card');
    }
  };

  const handleUnassign = async (agentId: string) => {
    try {
      await unassignCard(card.id, agentId);
      onRefresh();
    } catch (err) {
      console.error('Failed to unassign agent:', err);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      await updateCard(card.id, {
        title,
        description,
        priority: priority as any,
      });
      setIsSaving(false);
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to save card:', err);
      setIsSaving(false);
      alert('Failed to save task card changes');
    }
  };

  const handleDeleteCard = async () => {
    if (window.confirm(`Are you sure you want to remove task card "${card.title}"?`)) {
      try {
        await deleteCard(card.id);
        onRefresh();
        onClose();
      } catch (err) {
        console.error('Failed to remove card:', err);
        alert('Failed to remove task card');
      }
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      className="animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge badge-${priority}`}>{priority}</span>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Task Details</span>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Title Input */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              style={{ fontSize: '1.1rem', fontWeight: 700 }}
            />
          </div>

          {/* Controls Row */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="input-field"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Assign Agent</label>
              <select
                value={assignAgentId}
                onChange={(e) => {
                  setAssignAgentId(e.target.value);
                  handleAssign(e.target.value);
                }}
                className="input-field"
              >
                <option value="">+ Assign Agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assigned Agents List */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Assigned Agents</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {(!card.assignees || card.assignees.length === 0) ? (
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>No agents assigned to this task card yet.</span>
              ) : (
                card.assignees.map((asg) => {
                  const matchingAgent = agents.find((a) => a.id === asg.agent_id);
                  const name = matchingAgent ? matchingAgent.name : asg.agent_id;
                  return (
                    <span key={asg.agent_id} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      background: 'rgba(99, 102, 241, 0.18)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      color: '#c7d2fe',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                    }}>
                      <UserCheck size={14} color="#818cf8" />
                      {name}
                      <button
                        onClick={() => handleUnassign(asg.agent_id)}
                        style={{ background: 'none', border: 'none', color: '#fda4af', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px', marginLeft: '2px' }}
                        title="Unassign Agent"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Description & Execution Plan</label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Comments Section */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={16} color="#6366f1" /> Comment Thread ({card.comments?.length || 0})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
              {(!card.comments || card.comments.length === 0) ? (
                <p style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>No comments yet.</p>
              ) : (
                card.comments.map((c) => {
                  const authorName = c.author_id === 'system' || !c.author_id
                    ? 'System'
                    : (agents.find((a) => a.id === c.author_id)?.name || c.author_id);
                  return (
                    <div key={c.id} style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#94a3b8', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#a5b4fc' }}>{authorName}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '0.86rem', color: '#f8fafc' }}>{c.content}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Comment Bar */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="input-field"
                style={{ width: '160px', height: '36px', fontSize: '0.8rem' }}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                className="input-field"
                style={{ height: '36px', fontSize: '0.86rem' }}
              />
              <button onClick={handleAddComment} className="btn btn-primary btn-sm" style={{ height: '36px', padding: '0 14px' }}>
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          <button onClick={handleDeleteCard} className="btn btn-secondary btn-sm" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <Trash2 size={14} /> Remove Card
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
            <button onClick={handleSaveChanges} disabled={isSaving} className="btn btn-primary btn-sm">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
