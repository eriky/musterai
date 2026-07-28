// File: src/web/components/PrincipalChip.tsx
//
// Shared "who did this" chip for cards, comments and the activity feed.
// Distinguishes a human User from an AI Agent via the categorical entity
// scale (DESIGN_LANGUAGE.md §5) — this is *kind*, not *status*, so it must
// never borrow a semantic (success/warning/danger) colour family.

import React from 'react';
import { Bot, UserRound } from 'lucide-react';

export interface PrincipalChipProps {
  name: string;
  kind: 'user' | 'agent';
  /** Agent liveness only — always omitted/null for a human. */
  status?: 'active' | 'idle' | 'offline' | null;
  className?: string;
}

export const PrincipalChip: React.FC<PrincipalChipProps> = ({ name, kind, status, className = '' }) => {
  const entityClass = kind === 'agent' ? 'muster-entity-agent' : 'muster-entity-user';
  const Icon = kind === 'agent' ? Bot : UserRound;

  return (
    <span
      className={`muster-chip muster-badge-entity ${entityClass} max-w-full ${className}`}
      title={kind === 'agent' ? `${name} — ${status || 'offline'}` : name}
    >
      {kind === 'agent' && status === 'active' && (
        <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-success-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
        </span>
      )}
      <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
};
