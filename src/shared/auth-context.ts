// File: src/shared/auth-context.ts
//
// AuthContext is resolved once per request in middleware and threaded through
// both the REST and MCP entry points. Under MUSTER_AUTH_MODE=open it is a
// permissive stub so local development stays zero-config.
//
// Permissions is an empty stub here — the shape is what matters. Full
// permission enforcement lands in MUS-21/MUS-22.

export type PrincipalKind = 'user' | 'agent';

export interface PrincipalRef {
  kind: PrincipalKind;
  id: string;
}

export interface AuthContext {
  /** Resolved principal — null when unauthenticated in open mode. */
  principal: PrincipalRef | null;
  /** The workspace this request acts within, if known. */
  workspace_id: string | null;
  /** Stub — empty set until MUS-21 defines the permission catalog. */
  permissions: string[];
  /** True when the request carries operator-override authority. */
  is_operator_override: boolean;
}

/**
 * Default AuthContext used under MUSTER_AUTH_MODE=open.
 * Everything is permitted — no principal, no restrictions.
 */
export const OPEN_AUTH_CONTEXT: AuthContext = {
  principal: null,
  workspace_id: null,
  permissions: [],
  is_operator_override: false,
};