// File: src/web/components/TacticalTerminal.tsx
import React, { useState } from 'react';
import { Event } from '../types.js';
import {
  Activity, Filter, RefreshCw, Terminal,
  CreditCard, Bot, FileText, Layout, FolderOpen,
  ArrowRight, Plus, Pencil, Trash2, UserPlus, UserMinus,
  Link2, CheckCircle, Clock, MessageSquare, Tag,
} from 'lucide-react';

interface TacticalTerminalProps {
  events: Event[];
  onRefresh: () => void;
}

// Map raw action strings to human-readable sentences & icons
function describeEvent(evt: Event): { icon: React.ReactNode; text: string } {
  const p = evt.payload || {};

  switch (evt.entity_type) {
    case 'card': {
      switch (evt.action) {
        case 'created':
          return {
            icon: <Plus className="w-3.5 h-3.5 text-cyan-400" />,
            text: `Card "${p.title || 'Untitled'}" created in column ${shortId(p.column_id as string)}`,
          };
        case 'updated':
          return {
            icon: <Pencil className="w-3.5 h-3.5 text-blue-400" />,
            text: buildCardUpdateText(p),
          };
        case 'moved':
          return {
            icon: <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />,
            text: `Card moved to new column`,
          };
        case 'assigned':
          return {
            icon: <UserPlus className="w-3.5 h-3.5 text-emerald-400" />,
            text: `Agent assigned to card`,
          };
        case 'unassigned':
          return {
            icon: <UserMinus className="w-3.5 h-3.5 text-rose-400" />,
            text: `Agent removed from card`,
          };
        case 'document_linked':
          return {
            icon: <Link2 className="w-3.5 h-3.5 text-amber-400" />,
            text: `Document linked to card`,
          };
        case 'archived':
          return {
            icon: <Trash2 className="w-3.5 h-3.5 text-zinc-500" />,
            text: `Card archived`,
          };
        default:
          return {
            icon: <CreditCard className="w-3.5 h-3.5 text-cyan-400" />,
            text: `Card ${evt.action}`,
          };
      }
    }

    case 'document': {
      switch (evt.action) {
        case 'created':
          return {
            icon: <Plus className="w-3.5 h-3.5 text-amber-400" />,
            text: `Document "${p.title || 'Untitled'}" created`,
          };
        case 'updated':
          return {
            icon: <Pencil className="w-3.5 h-3.5 text-amber-400" />,
            text: `Document updated${p.change_summary ? ` — "${p.change_summary}"` : ''}`,
          };
        case 'status_changed':
          return {
            icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
            text: `Document status changed to ${p.status || 'unknown'}`,
          };
        default:
          return {
            icon: <FileText className="w-3.5 h-3.5 text-amber-400" />,
            text: `Document ${evt.action}`,
          };
      }
    }

    case 'agent': {
      switch (evt.action) {
        case 'registered':
          return {
            icon: <UserPlus className="w-3.5 h-3.5 text-emerald-400" />,
            text: `Agent "${p.name || shortId(evt.entity_id)}" registered as ${p.role || 'contributor'}`,
          };
        case 'unregistered':
          return {
            icon: <UserMinus className="w-3.5 h-3.5 text-rose-400" />,
            text: `Agent "${p.name || shortId(evt.entity_id)}" unregistered`,
          };
        case 'heartbeat':
          return {
            icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
            text: `Agent heartbeat — still active`,
          };
        default:
          return {
            icon: <Bot className="w-3.5 h-3.5 text-emerald-400" />,
            text: `Agent ${evt.action}`,
          };
      }
    }

    case 'column': {
      switch (evt.action) {
        case 'created':
          return {
            icon: <Plus className="w-3.5 h-3.5 text-indigo-400" />,
            text: `Column "${p.name || 'Untitled'}" added to board`,
          };
        case 'deleted':
          return {
            icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
            text: `Column "${p.name || shortId(evt.entity_id)}" deleted`,
          };
        case 'updated':
          return {
            icon: <Pencil className="w-3.5 h-3.5 text-indigo-400" />,
            text: `Column updated${p.name ? ` → "${p.name}"` : ''}`,
          };
        default:
          return {
            icon: <Layout className="w-3.5 h-3.5 text-indigo-400" />,
            text: `Column ${evt.action}`,
          };
      }
    }

    case 'board': {
      return {
        icon: <Layout className="w-3.5 h-3.5 text-indigo-400" />,
        text: `Board ${evt.action}${p.name ? ` — "${p.name}"` : ''}`,
      };
    }

    case 'project': {
      return {
        icon: <FolderOpen className="w-3.5 h-3.5 text-violet-400" />,
        text: `Project ${evt.action}${p.name ? ` — "${p.name}"` : ''}`,
      };
    }

    default:
      return {
        icon: <Activity className="w-3.5 h-3.5 text-zinc-400" />,
        text: `${evt.entity_type} ${evt.action}`,
      };
  }
}

function buildCardUpdateText(p: Record<string, any>): string {
  const parts: string[] = [];
  if (p.title) parts.push(`title → "${p.title}"`);
  if (p.priority) parts.push(`priority → ${p.priority}`);
  if (p.description !== undefined) parts.push('description updated');
  if (p.due_date) parts.push(`due date → ${p.due_date}`);
  return parts.length > 0 ? `Card updated: ${parts.join(', ')}` : 'Card updated';
}

function shortId(id?: string): string {
  if (!id) return '—';
  return `#${id.substring(id.length - 6)}`;
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(isoDate).toLocaleDateString();
}

const ENTITY_BADGES: Record<string, React.ReactNode> = {
  card: (
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-700/50 rounded">
      <CreditCard className="w-2.5 h-2.5" /><span>CARD</span>
    </span>
  ),
  agent: (
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/50 rounded">
      <Bot className="w-2.5 h-2.5" /><span>AGENT</span>
    </span>
  ),
  document: (
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-700/50 rounded">
      <FileText className="w-2.5 h-2.5" /><span>DOC</span>
    </span>
  ),
  board: (
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded">
      <Layout className="w-2.5 h-2.5" /><span>BOARD</span>
    </span>
  ),
  column: (
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded">
      <Layout className="w-2.5 h-2.5" /><span>COLUMN</span>
    </span>
  ),
  project: (
    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-violet-950 text-violet-400 border border-violet-700/50 rounded">
      <FolderOpen className="w-2.5 h-2.5" /><span>PROJECT</span>
    </span>
  ),
};

export const TacticalTerminal: React.FC<TacticalTerminalProps> = ({ events, onRefresh }) => {
  const [filterEntity, setFilterEntity] = useState<string>('all');

  const filteredEvents = events.filter((e) => {
    if (filterEntity === 'all') return true;
    return e.entity_type === filterEntity;
  });

  return (
    <div className="space-y-4 font-sans">

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-command-border pb-3">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wide">
            Activity Log
          </h2>
          <span className="text-xs font-mono text-zinc-500 bg-command-card border border-command-border px-2 py-0.5 rounded">
            {filteredEvents.length} events
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="bg-command-card border border-command-border text-zinc-200 text-xs font-mono rounded px-2.5 py-1"
            >
              <option value="all">All</option>
              <option value="card">Cards</option>
              <option value="agent">Agents</option>
              <option value="document">Documents</option>
              <option value="column">Columns</option>
              <option value="board">Boards</option>
              <option value="project">Projects</option>
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

      {/* Event Feed */}
      <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-command-surface rounded-xl tactical-border">
            <Terminal className="w-8 h-8 mx-auto mb-3 text-zinc-600 opacity-50" />
            <p className="text-sm text-zinc-500 font-sans">No activity logged yet.</p>
            <p className="text-xs text-zinc-600 mt-1">Events appear here as agents and users take actions.</p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const { icon, text } = describeEvent(evt);
            const badge = ENTITY_BADGES[evt.entity_type] ?? ENTITY_BADGES['project'];

            return (
              <div
                key={evt.id}
                className="group flex items-start space-x-3 p-3 bg-command-surface rounded-lg border border-command-border hover:border-zinc-600 transition-all"
              >
                {/* Icon */}
                <div className="mt-0.5 w-7 h-7 flex items-center justify-center bg-command-card rounded-md border border-command-border flex-shrink-0">
                  {icon}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    {badge}
                    <span className="text-xs font-sans text-zinc-100">{text}</span>
                  </div>

                  <div className="flex items-center space-x-3 mt-1.5">
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center space-x-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{relativeTime(evt.created_at)}</span>
                      <span className="text-zinc-700 mx-1">·</span>
                      <span>{new Date(evt.created_at).toLocaleTimeString()}</span>
                    </span>

                    <span className="text-[10px] font-mono text-zinc-600">
                      {evt.entity_type}/{shortId(evt.entity_id)}
                    </span>

                    {evt.actor_id && (
                      <span className="text-[10px] font-mono text-cyan-500/80">
                        by agent {shortId(evt.actor_id)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
