// File: src/shared/permissions.ts
//
// Permission catalog — the fixed set of verbs defined in source.
// Every permission check in the codebase references this catalog by string.
// The catalog is the single source of truth; roles are composed from it.

/** Every permission verb in the system. */
export const ALL_PERMISSIONS = [
  'workspace.admin',
  'member.invite',
  'member.manage',
  'role.manage',
  'project.create',
  'project.update',
  'project.delete',
  'board.manage',
  'label.manage',
  'card.create',
  'card.update',
  'card.move',
  'card.delete',
  'card.archive',
  'card.claim',
  'card.assign_self',
  'card.assign_others',
  'comment.create',
  'comment.update',
  'comment.delete',
  'doc.create',
  'doc.update',
  'doc.delete',
  'doc.submit_review',
  'doc.approve',
  'kb.read',
  'kb.write',
  'agent.register',
  'agent.manage_others',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Set-of-strings helpers that keep the role definitions readable. */
function all(): string[] {
  return [...ALL_PERMISSIONS];
}

function perm(...names: Permission[]): string[] {
  return [...names];
}

function except(excluded: Permission[]): string[] {
  return ALL_PERMISSIONS.filter(p => !excluded.includes(p));
}

// ============================================================
// Preset role definitions — seeded into every new workspace.
// ============================================================

export interface PresetRole {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  rank: number;
}

export const PRESET_ROLES: PresetRole[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full control over the workspace and all resources',
    permissions: all(),
    is_system: true,
    rank: 100,
  },
  {
    key: 'architect',
    name: 'Architect',
    description: 'Can approve design docs, manage boards and roles',
    permissions: except(['member.manage', 'workspace.admin']),
    is_system: true,
    rank: 80,
  },
  {
    key: 'senior_engineer',
    name: 'Senior Engineer',
    description: 'Full card control, doc creation, agent registration — but cannot approve docs or manage boards',
    permissions: except(['doc.approve', 'board.manage', 'member.invite', 'member.manage', 'role.manage', 'workspace.admin']),
    is_system: true,
    rank: 60,
  },
  {
    key: 'junior_engineer',
    name: 'Junior Engineer',
    description: 'Can work on assigned cards, create/submit docs, register agents — cannot delete, assign others, or approve',
    permissions: [
      'card.create', 'card.update', 'card.move', 'card.assign_self',
      'card.claim', 'comment.create', 'comment.update', 'comment.delete',
      'doc.create', 'doc.submit_review',
      'kb.read', 'kb.write', 'agent.register',
    ],
    is_system: true,
    rank: 40,
  },
  {
    key: 'tester',
    name: 'Tester',
    description: 'Create bug-report cards, update/move cards, comment, KB access',
    permissions: [
      'card.create', 'card.update', 'card.move',
      'comment.create', 'comment.update', 'comment.delete', 'kb.read', 'kb.write',
    ],
    is_system: true,
    rank: 20,
  },
  {
    key: 'observer',
    name: 'Observer',
    description: 'Read-only access to the workspace',
    permissions: ['kb.read'],
    is_system: true,
    rank: 10,
  },
];

/**
 * Effective permissions for an agent, computed as the intersection of
 * the agent's role permissions and the operator's role permissions.
 * An agent can never exceed the human who runs it.
 */
export function effectivePermissions(
  agentRolePermissions: string[],
  operatorRolePermissions: string[],
): string[] {
  const opSet = new Set(operatorRolePermissions);
  return agentRolePermissions.filter(p => opSet.has(p));
}

/**
 * Validate that a set of permission strings only contains known verbs.
 * Throws if any unknown permission is found.
 */
export function validatePermissions(perms: string[]): void {
  const valid = new Set(ALL_PERMISSIONS);
  for (const p of perms) {
    if (!valid.has(p as Permission)) {
      throw new Error(`Unknown permission: "${p}". Valid permissions are: ${ALL_PERMISSIONS.join(', ')}`);
    }
  }
}