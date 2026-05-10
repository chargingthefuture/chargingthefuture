# AGENTS.md

Agent context for the ChargingTheFuture monorepo. Read this before making any changes.
For detailed rules, see `.github/instructions/`.

---

## Monorepo Layout

```
chargingthefuture/          ← repo root
├── ctf/                    ← main product (Next.js web + React Native mobile)
│   ├── packages/
│   │   ├── web/            ← Next.js app (@ctf/web) — deployed to Railway
│   │   ├── mobile/         ← React Native / Expo app (@ctf/mobile)
│   │   ├── shared/         ← shared types, contracts, utilities
│   │   ├── pm-mcp-server/  ← project management MCP server
│   │   ├── plugin-education/
│   │   ├── economic-models/
│   │   └── eol/
│   ├── scripts/            ← operational helpers (migrations, audits, seeds)
│   ├── docs/               ← architecture docs, quota impact notes, setup guides
│   ├── railway.toml        ← Railway build/start config (rooted at ctf/)
│   └── package.json        ← workspace root (pnpm)
├── landing-page/           ← marketing landing page
├── waitlist-landing-page/  ← waitlist page
├── wiki-site/              ← wiki/blog
├── .ona/
│   └── automations.yaml    ← Ona tasks and services
├── .devcontainer/
│   └── devcontainer.json   ← dev container config
├── .github/
│   ├── instructions/       ← agent rules (100–203 series)
│   └── workflows/          ← GitHub Actions CI/CD
└── AGENTS.md               ← this file
```

**Package manager:** `pnpm` everywhere. Use `pnpm --filter @ctf/web` to scope commands.

**Do not** create app code outside `ctf/packages/*`. Scripts go in `ctf/scripts/`.

---

## Three Deployment Environments

No local dev. All environments are cloud-hosted.

| Environment | Frontend | Backend | Secret prefix |
|---|---|---|---|
| Staging Railway | Railway | Railway | `RAILWAY_STAGING_*` |
| Production Railway | Railway | Railway | `RAILWAY_PROD_*` |

**Canonical env contract:** `ctf/packages/web/.env.local.example`
Do not rename, remove, or restructure variables without explicit user approval.

---

## Secrets — Infisical is the single source of truth

All secrets are stored in the self-hosted Infisical instance on Railway.
Only three bootstrap secrets live outside Infisical:

| Where | Secrets |
|---|---|
| Ona project secrets | `INFISICAL_TOKEN`, `INFISICAL_PROJECT_ID`, `GITHUB_TOKEN` |
| GitHub Actions secrets | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_URL` |

**To use secrets in a task or script:**
```bash
infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
  <your command>
```

See `ctf/docs/infisical-migration-guide.md` for full setup and `ctf/docs/ona-secrets-inventory.md` for the Ona-specific model.

---

## Railway CLI

Railway CLI is pre-installed in this Ona environment via the `setup` task.

**Always `cd ctf/` before running Railway commands** — `railway.toml` is there.

```bash
cd /workspaces/chargingthefuture/ctf

railway status          # check connected project/environment
railway logs --tail 200 # fetch recent deployment logs
railway up --ci         # trigger a deployment
```

`RAILWAY_TOKEN` must be set as an Ona project secret. If it's missing, commands will fail.
See `ctf/docs/ona-secrets-inventory.md` for the full secret list and setup instructions.

---

## Ona Tasks (`.ona/automations.yaml`)

Run tasks with:
```bash
gitpod automations task start <task-id>
```

| Task ID | Purpose |
|---|---|
| `railway-debug` | Fetch Railway logs → `/tmp/railway-debug.log`, print error summary |
| `railway-redeploy` | Run `railway up --ci` from `ctf/` |
| `setup` | Install CLIs and system libs (runs on environment start) |
| `install` | Install all pnpm dependencies (runs on environment start) |

---

## When a Railway Deploy Fails

1. CI opens a GitHub issue labeled `railway-failure` with the job URL
2. Run `railway-debug` task to fetch logs
3. Read `/tmp/railway-debug.log` to diagnose
4. Fix the code, commit to a `fix/railway-auto-*` branch, push
5. The push triggers `deploy-backend-railway.yml` automatically

For autonomous recovery, use the Ona Automation documented in `ctf/docs/ona-automation-setup.md`.

---

## Key Rules (pointers to full detail)

| Topic | Rule file |
|---|---|
| Environment variables | `123-environment-configuration-rules.mdc` |
| Deployment topology | `111-deployment-topology-rules.mdc` |
| CI gates | `119-github-actions-ci-rules.mdc` |
| Monorepo layout | `101-monorepo-layout-rules.mdc` |
| Schema drift | `122-schema-drift-predeployment-rules.mdc` |
| Plugin architecture | `112-platform-architecture-rules.mdc` |
| Auth (Clerk) | `107-integration-stack-rules.mdc` |
| File size limits | `116-file-size-and-modularity-rules.mdc` |
| Agent cost/readability | `117-agent-readability-and-cost-rules.mdc` |

All rule files are in `.github/instructions/`. The index is `copilot-instructions.md`.

---

## Commit Conventions

Follow the existing commit style (Conventional Commits). Check recent history:
```bash
git log --oneline -10
```

Co-author line required on agent commits:
```
Co-authored-by: Ona <no-reply@ona.com>
```
