import React, { useEffect, useState } from 'react';
import { Agent, Card } from '../types.js';
import { Bot, Clock, RefreshCw, UserPlus, Trash2, Key, Copy, Check, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';

interface AgentGridProps {
  agents: Agent[];
  cards: Card[];
  onHeartbeat: (agentId: string) => void;
  onUnregisterAgent: (agentId: string) => void;
  onOpenRegisterAgent: () => void;
}

export const AgentGrid: React.FC<AgentGridProps> = ({
  agents,
  cards,
  onHeartbeat,
  onUnregisterAgent,
  onOpenRegisterAgent,
}) => {
  const [secretToken, setSecretToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const getStatusBadge = (status: Agent['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-ping"></span>
            Active
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium bg-amber-950/80 text-amber-400 border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5"></span>
            Idle
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium bg-zinc-900 text-zinc-500 border border-zinc-700">
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

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-6">
      
      {/* Human Owner Secret Token Banner */}
      <div className="flex-none bg-command-surface border border-command-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
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
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded-md text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
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
          className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-sans font-semibold bg-emerald-600 hover:bg-emerald-500 text-zinc-950 transition-all cursor-pointer shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Register Agent
        </button>
      </div>


      {/* Grid of Agents (Stretches 100% height!) */}
      {agents.length === 0 ? (
        <div className="text-center py-16 bg-command-surface rounded-xl tactical-border">
          <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-sans text-zinc-300 font-semibold">No Agents Registered</h3>
          <p className="text-xs font-sans text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Register your first AI agent or human operator to enable card assignment.
          </p>
          <button
            onClick={onOpenRegisterAgent}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-sans font-bold rounded-md cursor-pointer"
          >
            Register Agent
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">

          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-command-surface rounded-xl p-5 tactical-border hover:border-cyan-500/40 transition-all group relative overflow-hidden"
            >
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
                      <span className="text-zinc-700">•</span>
                      <span className="text-[11px] font-sans text-cyan-400 font-medium capitalize">{agent.role}</span>
                      {agent.owner_id && (
                        <>
                          <span className="text-zinc-700">•</span>
                          <span className="inline-flex items-center text-[10px] font-mono font-medium text-amber-400">
                            <ShieldCheck className="w-3 h-3 mr-0.5" /> Owned
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

              {/* Bottom Row */}
              <div className="mt-4 pt-3 border-t border-command-border/60 flex items-center justify-between text-xs font-sans text-zinc-400">
                <div className="flex items-center text-zinc-400">
                  <Clock className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                  <span>Last seen: {formatLastSeen(agent.last_seen_at)}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => onHeartbeat(agent.id)}
                    title="Send Heartbeat"
                    className="inline-flex items-center px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-cyan-400 border border-zinc-700 hover:border-cyan-500/50 rounded text-xs transition-all cursor-pointer font-mono"
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
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/50 rounded text-xs transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
