import React, { useEffect, useState } from 'react';
import { Agent, Card } from '../types.js';
import { Bot, Clock, RefreshCw, UserPlus, Trash2, ShieldCheck, Edit3, Pencil, X, Save } from 'lucide-react';
import { api } from '../api.js';

function getOperatorName(agents: Agent[], operatorUserId?: string | null): string | null {
  if (!operatorUserId) return null;
  const op = agents.find(a => a.id === operatorUserId);
  return op ? op.name : null;
}

interface AgentGridProps {
  agents: Agent[];
  cards: Card[];
  onHeartbeat: (agentId: string) => void;
  onUnregisterAgent: (agentId: string) => void;
  onOpenRegisterAgent: () => void;
  onRefresh?: () => void;
}

export const AgentGrid: React.FC<AgentGridProps> = ({
  agents,
  cards,
  onHeartbeat,
  onUnregisterAgent,
  onOpenRegisterAgent,
  onRefresh,
}) => {
  // Edit Modal State
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editName, setEditName] = useState('');
  const [editOperatorId, setEditOperatorId] = useState<string>('');
  const [editCapabilities, setEditCapabilities] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'idle' | 'offline'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditOperatorId(agent.operator_user_id || '');
    setEditCapabilities(agent.capabilities ? agent.capabilities.join(', ') : '');
    setEditStatus(agent.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    setIsSaving(true);
    try {
      await api.updateAgent(editingAgent.id, {
        name: editName,
        operator_user_id: editOperatorId || null,
        capabilities: editCapabilities,
        status: editStatus,
      });
      setEditingAgent(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to update agent:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="muster-badge muster-badge-success">
            <span className="w-2 h-2 rounded-full bg-success-400 mr-1.5 animate-ping"></span>
            Active
          </span>
        );
      case 'idle':
        return (
          <span className="muster-badge muster-badge-warning">
            <span className="w-2 h-2 rounded-full bg-warning-400 mr-1.5"></span>
            Idle
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="muster-badge muster-badge-neutral">
            <span className="w-2 h-2 rounded-full bg-neutral-600 mr-1.5"></span>
            Offline
          </span>
        );
    }
  };

  const formatLastSeen = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-6">

      {/* Agents Header */}
      <div className="flex-none flex items-center justify-between border-b border-muster-border pb-4">
        <div>
          <h2 className="text-lg font-sans font-bold muster-text-primary flex items-center">
            <Bot className="w-5 h-5 mr-2 muster-accent" />
            Registered Agents
          </h2>
          <p className="text-xs font-sans muster-text-muted mt-0.5">
            AI agents registered on the platform
          </p>
        </div>
        <button
          onClick={onOpenRegisterAgent}
          className="muster-btn muster-btn-primary"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Register Agent
        </button>
      </div>

      {/* Grid of Agents */}
      {agents.length === 0 ? (
        <div className="text-center py-16 bg-muster-surface rounded-lg tactical-border">
          <Bot className="w-12 h-12 muster-text-faint mx-auto mb-3" />
          <h3 className="text-sm font-sans muster-text-secondary font-semibold">No Agents Registered</h3>
          <p className="text-xs font-sans text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            Connect AI agents via MCP.
          </p>
          <button
            onClick={onOpenRegisterAgent}
            className="muster-btn muster-btn-lg muster-btn-primary"
          >
            Register Agent
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">

          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-muster-surface rounded-lg p-5 tactical-border hover:border-brand-500/40 transition-all group relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Top Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center muster-accent group-hover:border-brand-500/50 transition-colors">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-sans font-bold muster-text-primary group-hover:text-brand-300 transition-colors">
                        {agent.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] font-sans muster-text-muted capitalize">Agent</span>
                        {agent.operator_user_id && (
                          <>
                            <span className="muster-divider w-1 h-1 rounded-full shrink-0" aria-hidden="true" />
                            <span className="inline-flex items-center text-[10px] font-mono font-medium muster-text-warning">
                              <ShieldCheck className="w-3 h-3 mr-0.5" /> Op by {getOperatorName(agents, agent.operator_user_id) || 'Unknown'}
                            </span>
                          </>
                        )}
                    </div>
                  </div>
                </div>

                {getStatusBadge(agent.status)}

                </div>

                {/* Capabilities */}
                <div className="mt-4 pt-3 border-t border-muster-border/60">
                  <div className="text-[11px] font-sans muster-text-muted mb-1.5 font-medium">Capabilities:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities && agent.capabilities.length > 0 ? (
                      agent.capabilities.map((muster, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-neutral-900 muster-text-secondary text-xs font-sans rounded border border-neutral-800">
                          {muster}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-sans text-neutral-500 italic">General</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="mt-4 pt-3 border-t border-muster-border/60 flex items-center justify-between text-xs font-sans muster-text-muted">
                <div className="flex items-center muster-text-muted">
                  <Clock className="w-3.5 h-3.5 mr-1 text-neutral-500" />
                  <span>Last seen: {formatLastSeen(agent.last_seen_at)}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenEdit(agent)}
                    title="Edit Agent Attributes"
                    className="muster-btn muster-btn-secondary font-mono"
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </button>

                  <button
                    onClick={() => onHeartbeat(agent.id)}
                    title="Send Heartbeat"
                    className="muster-btn muster-btn-secondary font-mono"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Ping
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to remove agent "${agent.name}"?`)) {
                        onUnregisterAgent(agent.id);
                      }
                    }}
                    title="Remove / Unregister Agent"
                    className="muster-btn muster-btn-icon muster-btn-ghost-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="muster-scrim">
          <div className="muster-dialog w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-muster-border pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 muster-text-warning" />
                <h3 className="text-base font-bold muster-text-primary uppercase tracking-wide">Edit Agent Attributes</h3>
              </div>
              <button
                onClick={() => setEditingAgent(null)}
                className="muster-btn muster-btn-icon muster-btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="muster-label uppercase">Agent Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="muster-input muster-input-lg"
                  placeholder="e.g. Claude 3.7 Sonnet"
                />
              </div>

              <div>
                <label className="muster-label uppercase">Operator User ID</label>
                <input
                  type="text"
                  value={editOperatorId}
                  onChange={(e) => setEditOperatorId(e.target.value)}
                  className="muster-input font-mono"
                  placeholder="Principal ID of the human operator"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Principal ID of the human operator who owns this agent.</p>
              </div>

              <div>
                <label className="muster-label uppercase">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="muster-input font-mono cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="idle">Idle</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div>
                <label className="muster-label uppercase">Capabilities (Comma Separated)</label>
                <input
                  type="text"
                  value={editCapabilities}
                  onChange={(e) => setEditCapabilities(e.target.value)}
                  className="muster-input font-mono"
                  placeholder="code, testing, architecture, review"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-muster-border">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="muster-btn muster-btn-lg muster-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="muster-btn muster-btn-lg muster-btn-primary"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSaving ? 'Saving...' : 'Save Agent Attributes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};