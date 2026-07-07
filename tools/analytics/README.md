# Analytics tooling (Umami)

LaserKerf.io traffic is tracked by a self-hosted Umami fork at
`analytics.mjmiller.cloud` (tag lives in `apps/web/index.html`). That fork can't
issue API keys, so programmatic access authenticates with username/password and
caches the returned JWT, re-logging-in when it expires.

## Setup (one time)

```bash
cp tools/analytics/.env.example tools/analytics/.env   # gitignored
# edit tools/analytics/.env → set UMAMI_USERNAME and UMAMI_PASSWORD
node tools/analytics/umami.mjs refresh                 # logs in, writes the token file
```

## Commands

| Command | What it does |
|---|---|
| `node tools/analytics/umami.mjs refresh` | Force a fresh login → writes the token JSON (`UMAMI_TOKEN_FILE`). |
| `node tools/analytics/umami.mjs check` | Is the cached token still valid? (exit 0/1) |
| `node tools/analytics/umami.mjs token` | Print a valid token, auto-refreshing if the cached one is dead. |

## Reuse in scripts

```js
import { getToken } from './tools/analytics/umami.mjs';
const token = await getToken(); // valid token, refreshed on demand
// fetch(`${base}/api/websites/${id}/stats?...`, { headers: { Authorization: `Bearer ${token}` } })
```

Secrets (`.env`, the token JSON) are gitignored / kept outside the repo. The
token is an admin JWT — rotate it if it was ever exposed.
