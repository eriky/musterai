import React, { useState, useEffect, useCallback } from 'react';
import { User, Agent, AuditRecord } from '../../types.js';
import { api, ApiError } from '../../api.js';
import { ScrollText, RefreshCw } from 'lucide-react';
import { PrincipalChip } from '../PrincipalChip.js';

interface AuditLogPanelProps {
  workspaceId: string;
  users: User[];
  agents: Agent[];
  onError: (msg: string) => void;
}

export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({ workspaceId, users, agents, onError }) => {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const actorName = (id: string | null, kind: string | null) => {
    if (!id) return 'System';
    if (kind === 'user') return users.find((u) => u.id === id)?.display_name || `User ${id.slice(-6)}`;
    return agents.find((a) => a.id === id)?.name || `Agent ${id.slice(-6)}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLog(workspaceId, actionFilter ? { action: actionFilter } : {});
      setRecords(data);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to load the audit log');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, actionFilter, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = Array.from(new Set(records.map((r) => r.action))).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs muster-text-muted">
          Privileged actions only — role changes, membership, tokens, invitations, document approvals, project deletion. Never writable directly;
          every row is a side effect of the action it records.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="muster-input text-xs py-1 cursor-pointer"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button onClick={load} className="muster-btn muster-btn-icon muster-btn-ghost" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 muster-text-muted text-sm">Loading…</div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 bg-muster-surface rounded-lg tactical-border">
          <ScrollText className="w-12 h-12 muster-text-faint mx-auto mb-3" />
          <h3 className="text-sm font-sans muster-text-secondary font-semibold">No Audit Records Yet</h3>
        </div>
      ) : (
        <div className="w-full overflow-x-auto no-scrollbar">
          <table className="w-full text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-muster-border muster-text-muted uppercase text-[10px] tracking-wide">
                <th className="text-left py-2 pr-4 font-semibold">When</th>
                <th className="text-left py-2 pr-4 font-semibold">Actor</th>
                <th className="text-left py-2 pr-4 font-semibold">Action</th>
                <th className="text-left py-2 pr-4 font-semibold">Target</th>
                <th className="text-left py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-muster-border/40">
                  <td className="py-2 pr-4 muster-text-muted whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <PrincipalChip name={actorName(r.actor_id, r.actor_kind)} kind={r.actor_kind === 'agent' ? 'agent' : 'user'} />
                  </td>
                  <td className="py-2 pr-4 font-mono muster-accent">{r.action}</td>
                  <td className="py-2 pr-4 muster-text-secondary">
                    {r.target_type ? `${r.target_type}${r.target_id ? ` · ${r.target_id.slice(-8)}` : ''}` : '—'}
                  </td>
                  <td className="py-2 muster-text-muted font-mono text-[10px] max-w-xs truncate" title={r.payload ? JSON.stringify(r.payload) : ''}>
                    {r.payload ? JSON.stringify(r.payload) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
