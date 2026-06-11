# Cloudflare deployment

One `wrangler deploy` from this directory ships the whole platform:

- the **Worker** serves `frontend/dist` as static assets (SPA fallback,
  immutable caching for `/assets/*` via `frontend/public/_headers` — the same
  policy `frontend/nginx.conf` applies in the compose stack);
- `/api/*` is routed by [`src/worker.ts`](src/worker.ts) to a **Cloudflare
  Container** built from [`backend/Dockerfile`](../backend/Dockerfile) with the
  repo root as build context (the backend is a uv workspace member that needs
  `core/`). All requests go to a single container instance because SQLite
  allows one writer (`max_instances: 1` + singleton routing).

CI/CD: every push to `main` runs the full CI gate and then deploys
(`.github/workflows/deploy.yml`). Pull requests only validate
(`npm run typecheck` + `npm run validate` in the `wrangler` CI job — no
Docker or credentials needed).

## One-time setup

1. **Workers Paid plan** ($5/mo) on the Cloudflare account — Containers are
   not available on the free plan.
2. **API token** (dash.cloudflare.com → My Profile → API Tokens → Create
   Token): account-scoped permissions **Workers Scripts: Edit**,
   **Cloudflare Containers: Edit**, **Workers Tail: Read** (optional, for
   `wrangler tail`). Verify the token with a manual deploy before trusting CI.
3. **GitHub repository secrets** (Settings → Secrets and variables → Actions;
   repository secrets, not environment secrets — the workflow does not declare
   an environment):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID` (dash → Workers & Pages → right sidebar)
4. **Repository variable** (optional, recommended): `WORKERS_DEV_HOST` =
   `travel-risk-platform.<subdomain>.workers.dev`. When set, the deploy
   workflow smoke-tests `/api/health` with retries after each deploy — this
   catches broken images and warms the container through its first-deploy
   provisioning window (during which `/api` returns 503 for a few minutes).

## Commands (run in this directory)

| Command | What it does |
|---|---|
| `npm run typecheck` | `wrangler types` + `tsc --noEmit` on the Worker |
| `npm run validate` | Full config check + Worker bundle, no Docker/auth/upload |
| `npm run deploy` | Build frontend first (`cd ../frontend && npm run build`); needs Docker running and `wrangler login` (or the env vars above) |
| `npm run dev` | Local Worker + container (needs Docker) |

## Data durability (important)

Container disk is **ephemeral**. The SQLite database resets when the
instance sleeps after idle (`sleepAfter = "30m"` in `src/worker.ts`), on every
deploy, and on Cloudflare host maintenance. That is acceptable for the demo —
the dataset reloads in one click ("Load demo dataset") — but not for durable
data. For persistence, keep using the compose stack (named volume) or migrate
storage to D1/Durable Objects.

Billing note: a running container accrues vCPU/memory/disk charges beyond the
included monthly allotment; raising `sleepAfter` keeps demo data alive longer
at higher cost.
