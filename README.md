# Charging the Future

World's first psyop-free economy.

## Overview

This repository contains the v3 rewrite of the Charging the Future platform — a full-stack application for building psyop-resistant economic systems. It includes:

- **Web App** — Next.js frontend for the core user experience
- **Mobile App** — React Native (Expo) Android client with feature parity to web
- **Ledger** — Formance-backed ledger for ServiceCredits (non-fiat internal credits)
- **Agents** — AI-powered MCP servers for autonomous build, deployment, and operational workflows
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
│   ├── ollama/                 # Local LLM inference
├── scripts/                    # Utilities: seeding, backups, schema migration
├── agents/                     # AI agent definitions (.agent.md files)
├── schema.sql                  # PostgreSQL schema (CREATE TABLE + ALTER TABLE)
├── render.yaml                 # Render Blueprint (production infrastructure)
├── pnpm-workspace.yaml         # pnpm monorepo configuration
```

## Getting Started (Development)

### Prerequisites

- **Node.js 24+** (or use Codespaces)
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
   CLERK_SECRET_KEY=your_clerk_key
   STREAM_CHAT_API_KEY=your_stream_key
   # See ctf/docs/developer/README.md for full list
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

- **[Render](https://render.com)** — All services (web, workers, ledger, LLM inference)
- **[Infisical](https://infisical.com)** (self-hosted on Railway) — Single source of truth for secrets
- **[Neon](https://neon.tech)** — PostgreSQL database with connection pooling
- **Private GitHub repo** — Formance ledger backups (stored as Release assets)

See `render.yaml` for service definitions and `ctf/docs/developer/` for runbooks.

## Key Documents

| Document | Purpose |
|---|---|
| [`ctf/docs/spec.md`](ctf/docs/spec.md) | Archived v2 architecture (for reference) |
| [`ctf/docs/developer/README.md`](ctf/docs/developer/README.md) | Developer guide (setup, API, plugin system) |
| [`ctf/docs/developer/FORMANCE.md`](ctf/docs/developer/FORMANCE.md) | Formance ledger runtime contract and bootstrap |
| [`ctf/docs/developer/FORMANCE_BACKUP_RUNBOOK.md`](ctf/docs/developer/FORMANCE_BACKUP_RUNBOOK.md) | Backup/restore procedures |
| [`ctf/docs/contracts/`](ctf/docs/contracts/) | Plugin command contracts, access policies, audit schema |
| [`ctf/AGENTS.md`](ctf/AGENTS.md) | Agent framework and MCP setup |
| [`ctf/README.md`](ctf/README.md) | CTF monorepo overview |

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
- **Pre-commit hooks** (Husky) — runs tsc + linting
- **CI workflow** (`.github/workflows/ci.yml`) — full test suite, schema drift checks, dependency audit

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

**Last updated:** August 2026 | v3
