import React, { useEffect, useState } from 'react';
import { Agent, Card } from '../types.js';
import { Bot, Clock, RefreshCw, UserPlus, Trash2, Key, Copy, Check, ShieldCheck, Edit3, Pencil, X, Save } from 'lucide-react';
import { api } from '../api.js';

function getOwnerName(agents: Agent[], ownerId?: string | null): string | null {
  if (!ownerId) return null;
  const owner = agents.find(a => a.id === ownerId);
  return owner ? owner.name : null;
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
  const [secretToken, setSecretToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit Modal State
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editName, setEditName] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string>('');
  const [editRole, setEditRole] = useState<'owner' | 'contributor' | 'observer'>('contributor');
  const [editCapabilities, setEditCapabilities] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'idle' | 'offline'>('active');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.getHumanSecretToken()
      .then((res) => setSecretToken(res.secret_token))
      .catch((err) => console.error('Failed to load human secret token:', err));
  }, []);

  const handleCopySecret = () => {
    if (!secretToken) return;
    navigator.clipboard.writeText(secretToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditOwnerId(agent.owner_id || '');
    setEditRole(agent.role);
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
        owner_id: editOwnerId || null,
        role: editRole,
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
          <span className="cap-badge cap-badge-success">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-ping"></span>
            Active
          </span>
        );
      case 'idle':
        return (
          <span className="cap-badge cap-badge-warning">
            <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5"></span>
            Idle
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="cap-badge cap-badge-neutral">
            <span className="w-2 h-2 rounded-full bg-zinc-600 mr-1.5"></span>
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

  const humanAgents = agents.filter(a => a.type === 'human');

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-6">
      
      {/* Human Owner Secret Token Banner */}
      <div className="flex-none bg-command-surface border border-command-border rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-lg text-amber-400 mt-0.5">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Human Owner Secret Token</h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-700/50 rounded">SECURITY</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Provide this secret token to your AI agents (Claude, Cursor, Antigravity). Agents pass this secret token during <code className="text-amber-300 font-mono bg-zinc-900 px-1 py-0.5 rounded">register_agent</code> to link ownership to you and re-bind their session across runs.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-command-card border border-command-border p-1.5 rounded-lg w-full md:w-auto justify-between md:justify-start">
          <code className="text-xs font-mono font-bold text-amber-300 px-2 tracking-wider">
            {secretToken || 'Loading secret token...'}
          </code>
          <button
            onClick={handleCopySecret}
            disabled={!secretToken}
            className="cap-btn cap-btn-primary"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Token</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Agents Header */}
      <div className="flex-none flex items-center justify-between border-b border-command-border pb-4">
        <div>
          <h2 className="text-lg font-sans font-bold text-zinc-100 flex items-center">
            <Bot className="w-5 h-5 mr-2 text-cyan-400" />
            Registered Agents & Operators
          </h2>
          <p className="text-xs font-sans text-zinc-400 mt-0.5">
            Registered AI agents and human users available for card assignments
          </p>
        </div>
        <button
          onClick={onOpenRegisterAgent}
          className="cap-btn cap-btn-primary"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add User
        </button>
      </div>

      {/* Grid of Agents */}
      {agents.length === 0 ? (
        <div className="text-center py-16 bg-command-surface rounded-lg tactical-border">
          <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-sans text-zinc-300 font-semibold">No Agents Registered</h3>
          <p className="text-xs font-sans text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Register your first human user or connect AI agents via MCP.
          </p>
          <button
            onClick={onOpenRegisterAgent}
            className="cap-btn cap-btn-lg cap-btn-primary"
          >
            Add User
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">

          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-command-surface rounded-lg p-5 tactical-border hover:border-cyan-500/40 transition-all group relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Top Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-cyan-400 group-hover:border-cyan-500/50 transition-colors">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-sans font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors">
                        {agent.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] font-sans text-zinc-400 capitalize">{agent.type.replace('_', ' ')}</span>
                        <span className="cap-divider w-1 h-1 rounded-full shrink-0" aria-hidden="true" />
                        <span className="text-[11px] font-sans text-cyan-400 font-medium capitalize">{agent.role}</span>
                        {agent.type === 'ai_agent' && agent.owner_id && (
                          <>
                            <span className="cap-divider w-1 h-1 rounded-full shrink-0" aria-hidden="true" />
                            <span className="inline-flex items-center text-[10px] font-mono font-medium text-amber-400">
                              <ShieldCheck className="w-3 h-3 mr-0.5" /> Owned by {getOwnerName(agents, agent.owner_id) || 'Human Owner'}
                            </span>
                          </>
                        )}
                    </div>
                  </div>
                </div>

                {getStatusBadge(agent.status)}

                </div>

                {/* Capabilities */}
                <div className="mt-4 pt-3 border-t border-command-border/60">
                  <div className="text-[11px] font-sans text-zinc-400 mb-1.5 font-medium">Capabilities:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities && agent.capabilities.length > 0 ? (
                      agent.capabilities.map((cap, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-zinc-900 text-zinc-300 text-xs font-sans rounded border border-zinc-800">
                          {cap}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-sans text-zinc-500 italic">General</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="mt-4 pt-3 border-t border-command-border/60 flex items-center justify-between text-xs font-sans text-zinc-400">
                <div className="flex items-center text-zinc-400">
                  <Clock className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                  <span>Last seen: {formatLastSeen(agent.last_seen_at)}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenEdit(agent)}
                    title="Edit Agent & Owner Assignment"
                    className="cap-btn cap-btn-secondary font-mono"
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </button>

                  <button
                    onClick={() => onHeartbeat(agent.id)}
                    title="Send Heartbeat"
                    className="cap-btn cap-btn-secondary font-mono"
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
                    className="cap-btn cap-btn-icon cap-btn-ghost-danger"
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
        <div className="cap-scrim">
          <div className="cap-dialog w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-command-border pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wide">Edit Agent Attributes</h3>
              </div>
              <button
                onClick={() => setEditingAgent(null)}
                className="cap-btn cap-btn-icon cap-btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="cap-label uppercase">Agent Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="cap-input cap-input-lg"
                  placeholder="e.g. Claude 3.7 Sonnet"
                />
              </div>

              {editingAgent.type === 'ai_agent' && (
                <div>
                  <label className="cap-label uppercase">Assigned Human Owner</label>
                  <select
                    value={editOwnerId}
                    onChange={(e) => setEditOwnerId(e.target.value)}
                    className="cap-input font-mono cursor-pointer"
                  >
                    <option value="">No Assigned Human Owner</option>
                    {humanAgents.map((h) => (
                      <option key={h.id} value={h.id} className="bg-command-card text-zinc-200">
                        {h.name} ({h.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-500 mt-1">Select which human operator owns and directs this AI agent.</p>
                </div>
              )}


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="cap-label uppercase">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="cap-input font-mono cursor-pointer"
                  >
                    <option value="owner">Owner</option>
                    <option value="contributor">Contributor</option>
                    <option value="observer">Observer</option>
                  </select>
                </div>

                <div>
                  <label className="cap-label uppercase">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="cap-input font-mono cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="cap-label uppercase">Capabilities (Comma Separated)</label>
                <input
                  type="text"
                  value={editCapabilities}
                  onChange={(e) => setEditCapabilities(e.target.value)}
                  className="cap-input font-mono"
                  placeholder="code, testing, architecture, review"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-command-border">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="cap-btn cap-btn-lg cap-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="cap-btn cap-btn-lg cap-btn-primary"
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

