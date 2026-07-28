# Deploying Muster on a Public Host

Muster ships two very different postures, and picking the wrong one is the
single most consequential deployment mistake:

- **Solo, localhost.** `muster serve` with no configuration. `MUSTER_AUTH_MODE`
  defaults to `open` — every request is trusted, there is no login, and that
  is correct for a single operator on their own machine.
- **Shared, public host.** Anyone who can reach the port can act as whoever
  they can authenticate as, and eventually someone hostile will try. This
  document is about that case.

**`MUSTER_AUTH_MODE` defaults to `enforced` the moment `MUSTER_HOST` is
anything other than `localhost`/`127.0.0.1`.** You do not need to set it by
hand for a public deployment — but you do need to do everything else below.
Security that requires a deliberate action to turn on does not get turned on.

## Do not publish port 3000 directly

`docker-compose.yml`'s default `ports: ["3000:3000"]` is a getting-started
convenience, not a deployment topology. Muster's own HTTP server has no TLS
support and no public-facing hardening beyond what's described in this
document — it is designed to sit behind a reverse proxy that terminates TLS,
not to be the public-facing edge itself.

**Correct topology:**

```
Internet → reverse proxy (TLS termination, port 443) → Muster (port 3000, loopback only)
```

Change `docker-compose.yml` to bind Muster to loopback only:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

or drop the `ports:` mapping entirely and put the reverse proxy in the same
Docker network, reaching Muster by its service name.

## Reverse proxy

### Caddy (recommended — automatic TLS via Let's Encrypt)

```caddyfile
muster.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

That's the whole config. Caddy obtains and renews the certificate itself.
Restart Caddy after changes; no separate certbot step.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name muster.example.com;

    ssl_certificate     /etc/letsencrypt/live/muster.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/muster.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE (the live board updates) and MCP Streamable HTTP both need a
        # long-lived, unbuffered connection — the two settings below are not
        # optional for either to work.
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}

server {
    listen 80;
    server_name muster.example.com;
    return 301 https://$host$request_uri;
}
```

Obtain the certificate with `certbot --nginx -d muster.example.com` (or your
existing ACME tooling) before starting nginx with this config.

## Environment variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MUSTER_PORT` | `3000` | HTTP listen port. Bind to loopback via the reverse proxy, not by changing this. |
| `MUSTER_HOST` | `localhost` | Advisory only — used to pick the `open`/`enforced` default and for the startup banner. The server always binds `0.0.0.0`; use your firewall or Docker's port mapping to actually restrict reachability. |
| `MUSTER_AUTH_MODE` | derived from `MUSTER_HOST` | `open` or `enforced`. Set explicitly to remove any ambiguity in a deployment script. |
| `MUSTER_DB_PATH` | `data/muster.db` | SQLite database file path. |
| `MUSTER_DB_TYPE` | `sqlite` | Database backend — `sqlite` or `postgres` (see the PostgreSQL adapter). |
| `MUSTER_ATTACHMENTS_DIR` | `data/attachments` | Local storage for uploaded attachments. |
| `MUSTER_PUBLIC_URL` | `http://localhost:<port>` | **Required for a public deployment.** The externally-reachable HTTPS origin — OIDC redirect URIs, CORS's allowed origin, the MCP protected-resource metadata's `resource`, and the Device Authorization Grant's `verification_uri` are all derived from this. It must exactly match what's in the browser's address bar, including scheme. |
| `MUSTER_OIDC_ISSUER` | — | The OIDC provider's issuer URL (Authentik, Keycloak, Okta, Auth0, Google, GitHub via an OIDC-compatible proxy, etc). Discovery is fetched from `${issuer}/.well-known/openid-configuration`. |
| `MUSTER_OIDC_CLIENT_ID` | — | OAuth client ID registered with the provider. |
| `MUSTER_OIDC_CLIENT_SECRET` | — | OAuth client secret. Keep this out of version control and shell history — pass it via your deployment platform's secret store. |
| `MUSTER_BOOTSTRAP_OWNER_SUBJECT` | — | The OIDC `sub` claim to pin as workspace owner in advance, bypassing invitation admission. Optional — the first person to sign in becomes owner automatically if this is unset. |

OIDC is required for a public deployment: without it, `/auth/login` returns
`503 oidc_not_configured` and nobody can sign in at all.

## Backing up and restoring the SQLite database

Muster runs SQLite in WAL mode, so a plain file copy of `muster.db` while the
server is running can miss data still sitting in the `-wal` file.

**Backup (server running):**

```bash
sqlite3 data/muster.db ".backup data/muster-backup-$(date +%Y%m%d).db"
```

`.backup` is a proper SQLite API call, not a file copy — it's safe against a
concurrently-running server.

**Backup (server stopped):** a plain copy of `muster.db`, `muster.db-wal`, and
`muster.db-shm` (if present) is safe once the process has exited cleanly.

**Restore:**

```bash
# Stop Muster first.
cp data/muster-backup-20260101.db data/muster.db
rm -f data/muster.db-wal data/muster.db-shm   # avoid replaying a stale WAL
# Start Muster.
```

**Docker Compose:** the `muster-data` named volume holds the whole `data/`
directory. Back it up with:

```bash
docker run --rm -v muster_muster-data:/data -v "$(pwd)":/backup \
  alpine tar czf /backup/muster-data-backup.tar.gz -C /data .
```

## What's already handled for you

These are implemented in the server itself — nothing to configure beyond the
environment variables above:

- **CORS** is restricted to `MUSTER_PUBLIC_URL`; no other origin can read API
  responses with credentials attached.
- **Security headers** (HSTS when served over HTTPS, `X-Content-Type-Options`,
  `Referrer-Policy`, a CSP scoped to the SPA's actual external resources).
- **Rate limiting** on the OAuth/device-grant endpoints, `/mcp`, and failed
  bearer-token attempts, all returning `429` with `Retry-After`.
- **Request body limits** — `5MB` per request, with a tighter per-field cap on
  document/card content specifically.
- **Audit log** of every privileged action (role changes, membership,
  tokens, invitations, document approvals, project deletion), visible under
  Admin → Audit Log to workspace admins.

## Checklist before going live

- [ ] `MUSTER_PUBLIC_URL` set to the exact HTTPS origin end users will use.
- [ ] `MUSTER_OIDC_*` configured and a test login completes end-to-end.
- [ ] Reverse proxy terminates TLS; Muster itself is not reachable except
      through it (loopback bind or Docker network isolation).
- [ ] `docker-compose.yml`'s `ports:` mapping does not expose 3000 to `0.0.0.0`.
- [ ] A backup of `data/` (or the `muster-data` volume) is scheduled.
- [ ] `MUSTER_BOOTSTRAP_OWNER_SUBJECT` set, or you're prepared to be the very
      first person to sign in.
