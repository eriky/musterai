// File: src/web/components/TacticalTerminal.tsx
import React, { useState } from 'react';
import { Event, Agent, Card, Document } from '../types.js';
import {
  Activity, Filter, RefreshCw, Terminal,
  CreditCard, Bot, FileText, Layout, FolderOpen,
  ArrowRight, Plus, Pencil, Trash2, UserPlus, UserMinus,
  Link2, CheckCircle, Clock, MessageSquare, Database,
} from 'lucide-react';


interface TacticalTerminalProps {
  events: Event[];
  agents: Agent[];
  cards: Card[];
  documents: Document[];
  onRefresh: () => void;
}

// ─── Name resolution helpers ─────────────────────────────────────────────────

function agentName(agents: Agent[], id?: string | null): string {
  if (!id) return 'System';
  const a = agents.find((a) => a.id === id);
  return a ? a.name : `Agent #${id.slice(-6)}`;
}

function cardTitle(cards: Card[], id?: string | null): string {
  if (!id) return 'unknown card';
  const c = cards.find((c) => c.id === id);
  return c ? `"${c.title}"` : `card #${id.slice(-6)}`;
}

function docTitle(documents: Document[], id?: string | null): string {
  if (!id) return 'unknown document';
  const d = documents.find((d) => d.id === id);
  return d ? `"${d.title}"` : `doc #${id.slice(-6)}`;
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

// ─── Event description builder ───────────────────────────────────────────────

function describeEvent(
  evt: Event,
  agents: Agent[],
  cards: Card[],
  documents: Document[],
): { icon: React.ReactNode; text: string } {
  const p: Record<string, any> = evt.payload || {};
  const actor = agentName(agents, evt.actor_id);

  switch (evt.entity_type) {
    case 'card': {
      const card = cardTitle(cards, evt.entity_id);
      switch (evt.action) {
        case 'created':
          return {
            icon: entityIcon('card', Plus),
            text: `${actor} created card ${card}`,
          };
        case 'updated': {
          const parts: string[] = [];
          if (p.title) parts.push(`title → "${p.title}"`);
          if (p.priority) parts.push(`priority → ${p.priority}`);
          if (p.description !== undefined) parts.push('description updated');
          if (p.due_date) parts.push(`due date → ${p.due_date}`);
          const detail = parts.length > 0 ? `: ${parts.join(', ')}` : '';
          return {
            icon: entityIcon('card', Pencil),
            text: `${actor} updated card ${card}${detail}`,
          };
        }
        case 'moved':
          return {
            icon: entityIcon('card', ArrowRight),
            text: `${actor} moved card ${card} to a new column`,
          };
        case 'assigned': {
          const assignee = agentName(agents, p.agent_id);
          return {
            icon: <UserPlus className="w-3.5 h-3.5 cap-text-success" />,
            text: `${actor} assigned ${assignee} to card ${card}`,
          };
        }
        case 'unassigned': {
          const unassignee = agentName(agents, p.agent_id);
          return {
            icon: <UserMinus className="w-3.5 h-3.5 cap-text-danger" />,
            text: `${actor} removed ${unassignee} from card ${card}`,
          };
        }
        case 'document_linked': {
          const doc = docTitle(documents, p.document_id);
          return {
            icon: entityIcon('document', Link2),
            text: `${actor} linked document ${doc} to card ${card}`,
          };
        }
        case 'archived':
          return {
            icon: <Trash2 className="w-3.5 h-3.5 text-neutral-500" />,
            text: `${actor} archived card ${card}`,
          };
        default:
          return {
            icon: entityIcon('card', CreditCard),
            text: `${actor} ${evt.action} card ${card}`,
          };
      }
    }

    case 'document': {
      const doc = docTitle(documents, evt.entity_id);
      switch (evt.action) {
        case 'created':
          return {
            icon: entityIcon('document', Plus),
            text: `${actor} created document ${doc}`,
          };
        case 'updated':
          return {
            icon: entityIcon('document', Pencil),
            text: `${actor} updated document ${doc}${p.change_summary ? ` — "${p.change_summary}"` : ''}`,
          };
        case 'status_changed':
          return {
            icon: <CheckCircle className="w-3.5 h-3.5 cap-text-success" />,
            text: `${actor} set document ${doc} to ${p.status || 'new status'}`,
          };
        default:
          return {
            icon: entityIcon('document', FileText),
            text: `${actor} ${evt.action} document ${doc}`,
          };
      }
    }

    case 'agent': {
      const agentN = p.name || agentName(agents, evt.entity_id);
      switch (evt.action) {
        case 'registered':
          return {
            icon: <UserPlus className="w-3.5 h-3.5 cap-text-success" />,
            text: `${agentN} registered as ${p.role || 'contributor'}`,
          };
        case 'unregistered':
          return {
            icon: <UserMinus className="w-3.5 h-3.5 cap-text-danger" />,
            text: `${agentN} unregistered from project`,
          };
        default:
          return {
            icon: entityIcon('agent', Bot),
            text: `${agentN} ${evt.action}`,
          };
      }
    }

    case 'column': {
      switch (evt.action) {
        case 'created':
          return {
            icon: entityIcon('board', Plus),
            text: `${actor} added column "${p.name || 'Untitled'}" to board`,
          };
        case 'deleted':
          return {
            icon: <Trash2 className="w-3.5 h-3.5 cap-text-danger" />,
            text: `${actor} deleted column "${p.name || `#${evt.entity_id.slice(-6)}`}"`,
          };
        case 'updated':
          return {
            icon: entityIcon('board', Pencil),
            text: `${actor} updated column${p.name ? ` → "${p.name}"` : ''}`,
          };
        default:
          return {
            icon: entityIcon('board', Layout),
            text: `${actor} ${evt.action} column`,
          };
      }
    }

    case 'board':
      return {
        icon: entityIcon('board', Layout),
        text: `${actor} ${evt.action} board${p.name ? ` "${p.name}"` : ''}`,
      };

    case 'project':
      return {
        icon: entityIcon('project', FolderOpen),
        text: `${actor} ${evt.action} project${p.name ? ` "${p.name}"` : ''}`,
      };

    case 'knowledge_base': {
      switch (evt.action) {
        case 'created':
          return {
            icon: entityIcon('knowledge_base', Database),
            text: `${actor} created Knowledge Base "${p.name || 'KB'}"`,
          };
        case 'linked':
          return {
            icon: entityIcon('knowledge_base', Database),
            text: `${actor} linked Knowledge Base to project`,
          };
        case 'fact_added':
          return {
            icon: <FileText className="w-3.5 h-3.5 cap-text-success" />,
            text: `${actor} added gained knowledge "${p.title || 'fact'}"${p.entity_name ? ` → (${p.entity_name})` : ''}`,
          };
        case 'fact_updated':
          return {
            icon: entityIcon('document', Pencil),
            text: `${actor} updated gained knowledge "${p.title || 'fact'}"`,
          };
        case 'fact_deleted':
          return {
            icon: <Trash2 className="w-3.5 h-3.5 cap-text-danger" />,
            text: `${actor} deleted gained knowledge fact`,
          };
        case 'entity_created':
          return {
            icon: entityIcon('board', Plus),
            text: `${actor} created entity node "${p.name || 'node'}" (${p.type || 'entity'})`,
          };
        case 'entity_updated':
          return {
            icon: entityIcon('board', Pencil),
            text: `${actor} updated entity node "${p.name || 'node'}"`,
          };
        case 'relation_added':
          return {
            icon: entityIcon('knowledge_base', Database),
            text: `${actor} linked edge "${p.source_name || 'Node'}" --(${p.relation_type || 'link'})--> "${p.target_name || 'Node'}"`,
          };
        default:
          return {
            icon: entityIcon('knowledge_base', Database),
            text: `${actor} ${evt.action} knowledge base`,
          };
      }
    }

    default:
      return {
        icon: <Activity className="w-3.5 h-3.5 cap-text-muted" />,
        text: `${actor}: ${evt.entity_type} ${evt.action}`,
      };
  }
}

// ─── Entity type badges ───────────────────────────────────────────────────────

/**
 * Which entity-scale swatch each entity type draws from. This is a categorical
 * encoding (see DESIGN_LANGUAGE.md §7 rule 6), so it deliberately does not use
 * the brand/status families: a card is not "brand-coloured" and an agent is not
 * "success-coloured", and both must stay distinguishable under every profile.
 */
const ENTITY_STYLE: Record<string, string> = {
  card: 'cap-entity-card',
  agent: 'cap-entity-agent',
  document: 'cap-entity-document',
  board: 'cap-entity-board',
  column: 'cap-entity-board',
  project: 'cap-entity-project',
  knowledge_base: 'cap-entity-kb',
};

/** Tint a bare icon to the entity it refers to. */
const entityIcon = (type: string, Icon: React.ElementType, className = 'w-3.5 h-3.5') => (
  <Icon className={`${className} cap-entity-icon ${ENTITY_STYLE[type] ?? ''}`} />
);

const ENTITY_BADGES: Record<string, React.ReactNode> = Object.entries({
  card: [CreditCard, 'CARD'],
  agent: [Bot, 'AGENT'],
  document: [FileText, 'DOC'],
  board: [Layout, 'BOARD'],
  column: [Layout, 'COLUMN'],
  project: [FolderOpen, 'PROJECT'],
  knowledge_base: [Database, 'KB'],
} as Record<string, [React.ElementType, string]>).reduce((acc, [type, [Icon, label]]) => {
  acc[type] = (
    <span className={`cap-badge cap-badge-entity ${ENTITY_STYLE[type]} font-mono text-[9px]`}>
      <Icon className="w-2.5 h-2.5" />{label}
    </span>
  );
  return acc;
}, {} as Record<string, React.ReactNode>);


// ─── Component ────────────────────────────────────────────────────────────────

export const TacticalTerminal: React.FC<TacticalTerminalProps> = ({
  events,
  agents,
  cards,
  documents,
  onRefresh,
}) => {
  const [filterEntity, setFilterEntity] = useState<string>('all');

  const filteredEvents = events.filter((e) =>
    filterEntity === 'all' ? true : e.entity_type === filterEntity,
  );

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 font-sans space-y-4">

      {/* Header Bar */}
      <div className="flex-none flex items-center justify-between border-b border-cap-border pb-3">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 cap-text-success animate-pulse" />
          <h2 className="text-base font-bold cap-text-primary uppercase tracking-wide">
            Activity Log
          </h2>
          <span className="text-xs font-mono text-neutral-500 bg-cap-surface border border-cap-border px-2 py-0.5 rounded">
            {filteredEvents.length} events
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="bg-cap-surface border border-cap-border text-neutral-200 text-xs font-mono rounded px-2.5 py-1"
            >
              <option value="all">All</option>
              <option value="card">Cards</option>
              <option value="agent">Agents</option>
              <option value="document">Documents</option>
              <option value="column">Columns</option>
              <option value="board">Boards</option>
              <option value="project">Projects</option>
              <option value="knowledge_base">Knowledge Base</option>
            </select>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 bg-cap-surface hover:bg-neutral-800 cap-text-muted hover:text-success-400 border border-cap-border rounded transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Event Feed (Fills 100% available height!) */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">

        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-cap-surface rounded-lg tactical-border">
            <Terminal className="w-8 h-8 mx-auto mb-3 cap-text-faint opacity-50" />
            <p className="text-sm text-neutral-500 font-sans">No activity logged yet.</p>
            <p className="text-xs cap-text-faint mt-1">Events appear here as agents and users take actions.</p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const { icon, text } = describeEvent(evt, agents, cards, documents);
            const badge = ENTITY_BADGES[evt.entity_type] ?? ENTITY_BADGES['project'];

            return (
              <div
                key={evt.id}
                className="group flex items-start space-x-3 p-3 bg-cap-surface rounded-lg border border-cap-border hover:border-neutral-600 transition-all"
              >
                {/* Icon */}
                <div className="mt-0.5 w-7 h-7 flex items-center justify-center bg-cap-surface rounded-md border border-cap-border flex-shrink-0">
                  {icon}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {badge}
                    <span className="text-xs font-sans cap-text-primary">{text}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {relativeTime(evt.created_at)}
                      <span className="cap-divider w-0.5 h-0.5 rounded-full shrink-0 mx-1" aria-hidden="true" />
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
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
