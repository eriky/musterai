// File: src/web/components/TacticalTerminal.tsx
import React, { useState } from 'react';
import { Event } from '../types.js';
import { Activity, Filter, RefreshCw, Terminal } from 'lucide-react';

interface TacticalTerminalProps {
  events: Event[];
  onRefresh: () => void;
}

export const TacticalTerminal: React.FC<TacticalTerminalProps> = ({ events, onRefresh }) => {
  const [filterEntity, setFilterEntity] = useState<string>('all');

  const filteredEvents = events.filter((e) => {
    if (filterEntity === 'all') return true;
    return e.entity_type === filterEntity;
  });

  const getEntityTag = (type: Event['entity_type']) => {
    switch (type) {
      case 'card':
        return <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-700/50 rounded">CARD</span>;
      case 'agent':
        return <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/50 rounded">AGENT</span>;
      case 'document':
        return <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-700/50 rounded">DOC</span>;
      case 'board':
      case 'column':
        return <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded">BOARD</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium bg-zinc-900 text-zinc-400 border border-zinc-700 rounded">SYS</span>;
    }
  };

  return (
    <div className="space-y-4 font-sans">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-command-border pb-3">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wide">
            Real-Time Activity Log
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="bg-command-card border border-command-border text-zinc-200 text-xs font-mono rounded px-2.5 py-1"
            >
              <option value="all">All Entities</option>
              <option value="card">Cards</option>
              <option value="agent">Agents</option>
              <option value="document">Documents</option>
              <option value="board">Boards & Columns</option>
            </select>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 bg-command-card hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-command-border rounded transition-colors cursor-pointer"
            title="Refresh Feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Activity Log Feed */}
      <div className="bg-command-surface rounded-xl p-4 tactical-border font-mono text-xs max-h-[700px] overflow-y-auto space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-command-border/60 text-[10px] text-zinc-500">
          <span>REAL-TIME SSE STREAM</span>
          <span>{filteredEvents.length} EVENTS</span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 font-sans">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No activity logged yet.</p>
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-3 bg-command-card rounded border border-command-border hover:border-emerald-500/40 transition-all flex flex-col space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-500 text-[10px]">
                    [{new Date(evt.created_at).toLocaleTimeString()}]
                  </span>
                  {getEntityTag(evt.entity_type)}
                  <span className="font-bold text-zinc-200 group-hover:text-emerald-300 uppercase">
                    {evt.action}
                  </span>
                  <span className="text-zinc-500 text-[10px]">
                    ID: #{evt.entity_id.substring(evt.entity_id.length - 8)}
                  </span>
                </div>

                {evt.actor_id && (
                  <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    Actor: #{evt.actor_id.substring(evt.actor_id.length - 6)}
                  </span>
                )}
              </div>

              {evt.payload && (
                <div className="text-[11px] text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-900 overflow-x-auto">
                  <pre className="text-emerald-400/90 font-mono text-[10px]">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};
