import React from 'react';
import { GitBranch, GitPullRequest, GitCommit, Workflow } from 'lucide-react';
import { CardLinkRelationType, CardWorkLinkKind, CardWorkLinkProvider } from '../types.js';

export const CARD_LINK_RELATION_LABELS: Record<CardLinkRelationType, string> = {
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
  parent_of: 'Parent of',
  child_of: 'Child of',
};

export const CARD_LINK_BADGE_CLASSES: Record<CardLinkRelationType, string> = {
  blocks: 'muster-badge-danger',
  blocked_by: 'muster-badge-warning',
  relates_to: 'muster-badge-info',
  duplicates: 'muster-badge-neutral',
  parent_of: 'muster-badge-accent',
  child_of: 'muster-badge-accent',
};

export const WORK_LINK_KIND_LABELS: Record<CardWorkLinkKind, string> = {
  branch: 'Branches',
  pull_request: 'Pull Requests',
  commit: 'Commits',
  pipeline: 'Pipelines',
};

export const WORK_LINK_KIND_ICONS: Record<CardWorkLinkKind, React.ComponentType<{ className?: string }>> = {
  branch: GitBranch,
  pull_request: GitPullRequest,
  commit: GitCommit,
  pipeline: Workflow,
};

export const WORK_LINK_KIND_ORDER: CardWorkLinkKind[] = ['branch', 'pull_request', 'commit', 'pipeline'];

export const WORK_LINK_PROVIDER_LABELS: Record<CardWorkLinkProvider, string> = {
  forgejo: 'Forgejo',
  github: 'GitHub',
  gitlab: 'GitLab',
  other: 'Other',
};

export const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  critical: 'muster-badge-danger',
  high: 'muster-badge-warning',
  medium: 'muster-badge-info',
  low: 'muster-badge-neutral',
};
