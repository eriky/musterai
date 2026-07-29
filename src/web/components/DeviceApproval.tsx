// File: src/web/components/DeviceApproval.tsx
//
// The `muster login` device-approval screen (MUS-28, RFC 8628). Reachable
// at /device, outside the normal /projects/:id app shell — a signed-in user
// lands here (directly, or after being sent through OIDC login) to approve
// or deny a code a CLI on another machine is polling for.

import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../api.js';
import { AuthMe, DeviceGrantInfo } from '../types.js';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function readUserCodeFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('user_code') || '').toUpperCase();
}

export const DeviceApproval: React.FC = () => {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [userCode, setUserCode] = useState(readUserCodeFromUrl());
  const [grant, setGrant] = useState<DeviceGrantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<'approved' | 'denied' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getMe()
      .then(setMe)
      .catch(() => setMe({ authenticated: false, admitted: false, user: null, role: null, workspace: null, auth_mode: 'enforced' }))
      .finally(() => setLoading(false));
  }, []);

  const lookup = async (code: string) => {
    setError(null);
    try {
      const info = await api.deviceLookup(code);
      setGrant(info);
    } catch (err) {
      setGrant(null);
      setError(err instanceof ApiError ? 'That code is invalid or has expired.' : 'Failed to look up the code.');
    }
  };

  useEffect(() => {
    if (me?.authenticated && userCode) {
      lookup(userCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.authenticated, userCode]);

  const handleApprove = async () => {
    if (!grant) return;
    setSubmitting(true);
    try {
      await api.deviceApprove(grant.user_code);
      setOutcome('approved');
    } catch {
      setError('Failed to approve — the code may have expired. Run "muster login" again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!grant) return;
    setSubmitting(true);
    try {
      await api.deviceDeny(grant.user_code);
      setOutcome('denied');
    } catch {
      setError('Failed to deny the code.');
    } finally {
      setSubmitting(false);
    }
  };

  const signInUrl = `/api/v1/auth/login?redirect_to=${encodeURIComponent(`/device?user_code=${userCode}`)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muster-base muster-text-primary font-sans px-4">
      <div className="muster-dialog w-full max-w-md p-6 space-y-5">
        <div className="flex items-center space-x-2 border-b border-muster-border pb-4">
          <ShieldCheck className="w-6 h-6 muster-accent" />
          <h1 className="text-base font-bold uppercase tracking-wide">Device Login</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 muster-text-muted text-sm">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : outcome === 'approved' ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-10 h-10 muster-text-success mx-auto" />
            <p className="text-sm font-semibold">Approved</p>
            <p className="text-xs muster-text-muted">You can close this tab and return to your terminal.</p>
          </div>
        ) : outcome === 'denied' ? (
          <div className="text-center py-6 space-y-2">
            <XCircle className="w-10 h-10 muster-text-danger mx-auto" />
            <p className="text-sm font-semibold">Denied</p>
            <p className="text-xs muster-text-muted">You can close this tab.</p>
          </div>
        ) : !me?.authenticated ? (
          <div className="space-y-4">
            <p className="text-xs muster-text-muted">Sign in to approve this login.</p>
            <a href={signInUrl} className="muster-btn muster-btn-lg muster-btn-primary w-full justify-center">
              Sign in
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {!userCode || !grant ? (
              <form
                onSubmit={(e) => { e.preventDefault(); lookup(userCode); }}
                className="space-y-3"
              >
                <div>
                  <label className="muster-label uppercase">Code</label>
                  <input
                    type="text"
                    required
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    className="muster-input muster-input-lg font-mono text-center tracking-widest"
                  />
                </div>
                <button type="submit" className="muster-btn muster-btn-lg muster-btn-primary w-full justify-center">
                  Continue
                </button>
              </form>
            ) : (
              <>
                <div className="p-3 bg-muster-base border border-muster-border rounded-md text-xs space-y-1.5">
                  <p className="muster-text-muted">
                    A CLI is requesting a login token for code <span className="font-mono muster-text-primary">{grant.user_code}</span>.
                  </p>
                  <p>
                    You are approving as <span className="font-semibold muster-accent">{grant.principal_display_name}</span>
                    {grant.role_name && <> with role <span className="font-semibold muster-accent">{grant.role_name}</span></>}
                    {grant.workspace_name && <> in workspace <span className="font-semibold muster-accent">{grant.workspace_name}</span></>}.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleDeny}
                    disabled={submitting}
                    className="muster-btn muster-btn-lg muster-btn-secondary flex-1 justify-center"
                  >
                    Deny
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="muster-btn muster-btn-lg muster-btn-primary flex-1 justify-center"
                  >
                    Approve
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="muster-badge muster-badge-danger w-full">
            <ShieldAlert className="w-3.5 h-3.5" /> {error}
          </div>
        )}
      </div>
    </div>
  );
};
