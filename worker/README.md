# m3care Worker

Serves two things:

| Route | Method | Purpose |
|---|---|---|
| `/api/plan` | `GET` | Read the plan document from D1. No auth. |
| `/api/plan` | `PUT` | Replace the plan document. Requires `Authorization: Bearer $PLAN_TOKEN`. |
| `/*` | `POST` | Anthropic API proxy for Chemical Lookup. Unchanged. |

## Why this exists

The plan used to live in `public/wash-plan.json`, written through the GitHub
Contents API. That meant:

- base64 round-trips on every save — asymmetric `atob`/`btoa` silently doubled
  every non-ASCII character per save, growing the file 106 KB -> 1.15 MB over 12
  saves until it hit GitHub's 1 MiB inline limit and all writes started failing
- SHA conflict retries and a global promise queue
- up to 60s of polling to confirm a write had landed
- a full CI build and Pages deploy per checkbox tap

D1 removes all of it. A save is one `UPDATE`, applied immediately.

## Safeguards

- **Corruption guard** — `PUT` rejects a payload more than 1.5x the stored size
  with HTTP 409. Override with `?force=1` when the growth is genuine (e.g. the
  initial seed). This is the check that would have caught the base64 bug on the
  first save instead of the twelfth.
- **Optimistic concurrency** — send `If-Match: <updated_at>` to get a 412 if the
  plan changed since you read it. Optional; omit for last-write-wins.
- **CORS** — origin allowlist, not `*`. Production Pages origin plus localhost
  for `npm run dev`.

## First-time setup

```bash
cd worker
npx wrangler login

# 1. Create the database
npx wrangler d1 create m3care
#    -> copy the printed database_id into wrangler.toml,
#       replacing REPLACE_WITH_D1_DATABASE_ID

# 2. Create the table and load the current plan (~105 KB)
npx wrangler d1 execute m3care --remote --file=./schema-and-seed.sql

# 3. Secrets
npx wrangler secret put ANTHROPIC_API_KEY   # same value as the existing Worker
npx wrangler secret put PLAN_TOKEN          # any long random string; you'll
                                            # paste this into the app's Settings tab

# 4. Deploy
npx wrangler deploy
```

Verify:

```bash
curl -s https://m3care-anthropic-proxy.andy-lambert05.workers.dev/api/plan | head -c 200
```

## Day-to-day

```bash
npx wrangler deploy                       # ship changes
npx wrangler tail                         # live logs
npx wrangler d1 execute m3care --remote --command "SELECT length(data), updated_at FROM plan"
```

## Backup

The plan no longer lives in git, so it is no longer backed up by git.

```bash
npx wrangler d1 execute m3care --remote --command "SELECT data FROM plan WHERE id=1" --json \
  | jq -r '.[0].results[0].data' > backup-$(date +%F).json
```

Worth running occasionally, or as a scheduled GitHub Action.
