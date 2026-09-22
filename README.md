# Charging the Future

World's first psyop-free economy.

## Overview

This repository contains v3 of the Charging the Future app — a full-stack application for building psyop-resistant economic systems. It includes:

- **Web App** — Next.js frontend for the core user experience
- **Mobile App** — React Native (Expo) Android client, narrowed to sign-in, Chyme, bug reporting, and settings; every other feature is served by the installable web app
- **Ledger** — Formance-backed ledger for ServiceCredits (non-fiat internal credits)
- **Agents** — agent role files and an MCP server for build, deployment, and operational workflows
- **Schema** — PostgreSQL schema migrations and audit trails

**Credits are not money.** ServiceCredits and every in-app credit are a non-fiat internal credits
unit — not money, not a currency, not a security, and never redeemable or withdrawable for cash or
any fiat value. The project makes no financial, investment, or monetary-value claims; any wording
in this repository that implies otherwise is an error. The statement of record is
[`ctf/docs/DISCLAIMER.md`](ctf/docs/DISCLAIMER.md).

## Architecture

The codebase is organized as a **monorepo** (pnpm workspaces) under `/ctf`:

```
ctf/
├── packages/
│   ├── web/                    # Next.js app (React, tRPC, Clerk auth)
│   ├── mobile/                 # React Native app (Expo, EAS)
│   ├── shared/                 # Shared TypeScript library
│   ├── agent-mcp-server/       # Agentic MCP server (stdio transport)
│   ├── economic-models/        # Economic modeling utilities
│   ├── education/              # Educational content & materials
│   ├── eol/                    # End-of-life/deprecation tooling
├── ops/
│   ├── formance/               # Formance ledger Docker configs
│   ├── infisical/              # Secrets management Docker configs
│   ├── route-weather/          # Plain-text weather service
├── config/                     # Checked-in config the CI gates read (plugin parity, allowlists)
├── db/migrations/              # Post-schema migrations
├── docs/                       # Contracts, plugin feature inventories, developer runbooks
├── scripts/                    # Utilities: seeding, backups, schema migration, CI gates
├── agents/                     # AI agent definitions (.agent.md files)
├── schema.sql                  # PostgreSQL schema (CREATE TABLE + ALTER TABLE)
├── pnpm-workspace.yaml         # pnpm monorepo configuration
```

`render.yaml` (the Render Blueprint for production) sits at the repository root, next to the
agent instructions in `CLAUDE.md` and the rule modules under `.claude/rules/`.

## Getting Started (Development)

### Prerequisites

- **Node.js 22** (what CI runs; or use Codespaces)
- **pnpm 9.12+**
- **PostgreSQL** (for local schema testing)
- **Docker** (for Formance, Infisical, Ollama)

### Quick Start

1. **Clone and install:**
   ```bash
   git clone https://github.com/chargingthefuture/chargingthefuture
   cd chargingthefuture
   pnpm install
   ```

2. **Set up environment:**
   Create a `.env.local` file in `ctf/packages/web/` with required secrets:
   ```bash
   DATABASE_URL=postgresql://user:pass@localhost/ctf
   NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY=your_clerk_publishable_key
   AUTH_SECRET_KEY=your_clerk_secret_key
   STREAM_API_KEY=your_stream_key
   # Auth keys are provider-neutral names (read by ctf/packages/web/lib/auth/provider-env.ts).
   # Production secrets live in Infisical — see .claude/rules/123-environment-configuration-rules.mdc
   ```

3. **Apply schema and run dev server:**
   ```bash
   cd ctf
   psql "$DATABASE_URL" -f schema.sql
   pnpm --filter @ctf/web run dev
   ```

4. **Open http://localhost:3000**

## GitHub Codespaces

For a zero-setup experience, use GitHub Codespaces:

1. Click **Code** → **Codespaces** → **Create codespace on main**
2. Wait for container startup (~2 min in fast mode)
3. `pnpm --filter @ctf/web run dev` starts the dev server
4. Web and mobile development available immediately

See `.devcontainer/README.md` for fast-mode options and database setup.

## Infrastructure (Production)

Production deployment uses:

- **[Render](https://render.com)** — The web app and the route-weather service, pulling images that GitHub Actions builds
- **[Railway](https://railway.com)** — The Formance ledger and its Postgres, Infisical, and Unleash (feature flags)
- **[Infisical](https://infisical.com)** (self-hosted on Railway) — Single source of truth for secrets
- **[Neon](https://neon.tech)** — PostgreSQL database with connection pooling
- **[RunPod](https://www.runpod.io)** — Serverless GPU endpoint for the Ollama model; its worker image lives in the `runpod` repository
- **Private GitHub repo** (`backups`) — Formance ledger backups (stored as Release assets)

See `render.yaml` for service definitions and `ctf/docs/developer/` for runbooks.

## Key Documents

| Document | Purpose |
|---|---|
| [`ctf/docs/spec.md`](ctf/docs/spec.md) | Archived v2 architecture (for reference) |
| [`ctf/docs/developer/README.md`](ctf/docs/developer/README.md) | Developer guide (setup, API, plugin system) |
| [`ctf/docs/developer/FORMANCE.md`](ctf/docs/developer/FORMANCE.md) | Formance ledger runtime contract, bootstrap, and backup/restore |
| [`ctf/docs/contracts/`](ctf/docs/contracts/) | Plugin command contracts, access policies, audit schema |
| [`ctf/docs/developer/ctf-plugin-feature-inventories/`](ctf/docs/developer/ctf-plugin-feature-inventories/) | One feature inventory per plugin — what each part of the app does today |
| [`ctf/agents/README.md`](ctf/agents/README.md) | Agent role files and MCP setup |
| [`ctf/README.md`](ctf/README.md) | CTF monorepo overview |
| [`CLAUDE.md`](CLAUDE.md) | Agent instructions: layout, secrets policy, branch and PR conventions, rule modules |

## Contributing

**This project does not accept outside code contributions.** Pull requests from outside the core
team are closed unread. That is not about the quality of the offer — it is about who uses this app.

The people here are survivors of organized stalking and trafficking. For them, a defect in this
codebase is not an inconvenience: a leaked location, an exposed identity, a message reaching the
wrong person, or an account someone else can reach is a physical-safety event. Every line that ships
is written and reviewed by people who understand that threat model and who are accountable for it.
Accepting code from someone outside that circle — however well-intentioned — introduces a path we
cannot vouch for, and it is the members who would carry the consequence, not us.

There is a second reason, and it is the more serious one. Targeting operations actively try to place
people inside the communities they target. An open contribution path is a standing invitation to do
exactly that. Refusing outside code removes that route entirely rather than relying on catching it.

**Please also read this if you are thinking of helping in any other capacity.** If you are not
targeted yourself, taking part in this project can put you in real danger: people who step in from
the outside get noticed, are approached and asked to take part in trafficking, and those who refuse
have been killed or have become targets themselves. Nobody here is asking you to carry that risk on
our behalf.

**The repository is public to be read, audited, and verified, not to be built on.** Reading the code,
checking the claims made in the docs, and reporting a security problem you find are all welcome —
see [Support](#support) for where to send a report. Members of the app report bugs in-app, which
routes to a private triage repository.

### Code Quality

All commits run through:

- **TypeScript** type checking (tsc)
- **EOF format validation** (all files end with exactly one newline)
- **Git hooks** (Husky, in `ctf/.husky/`) — pre-commit runs the typecheck; pre-push runs the web build
- **CI workflow** (`.github/workflows/ci.yml`) — full test suite, schema drift checks, inventory drift checks, dependency audit
- **PR conventions** — a Conventional Commit title and a `Parity Status:` line in the description; see `CLAUDE.md`

To prepare a PR:

```bash
cd ctf
pnpm typecheck              # TypeScript validation
pnpm --filter @ctf/web run build  # Full Next.js build
bash scripts/check-eof-format.sh  # EOF validation
```

## License

[License information to be added]

## Support

- **Members:** report bugs from inside the app — reports route to a private triage repository so no
  member's words end up on a public issue.
- **Security problems found by reading the code:** open a GitHub issue describing the problem. Do not
  include any member's data, and do not open a pull request with a fix — see
  [Contributing](#contributing).
- **Documentation:** See `ctf/docs/developer/` and inline code comments.

---

**Last updated:** September 2026 | v3
