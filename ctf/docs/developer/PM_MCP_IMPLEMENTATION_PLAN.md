# PM Tool Implementation Plan — MCP Server + Feedback Plugin + VS Code Extension

> **Context**: This plan replaces the originally considered approach of forking VS Code.
> Forking was ruled out because GitHub Copilot validates its host editor — a fork would
> break Copilot entirely. This approach keeps VS Code unmodified and achieves full PM
> capabilities through three composable pieces.

## Architecture

```
VS Code (standard, unmodified)
├── GitHub Copilot (works natively)
├── CTF PM Extension (custom VS Code extension)
│   └── Webview panels: Kanban, Roadmap, Feedback Inbox, CS Triage
└── PM MCP Server (registered in .vscode/mcp.json)
    └── Copilot Chat queries/mutates PM data via MCP tools

CTF App (Neon DB)
├── Existing plugins (Feed, Trust, SocketRelay, etc.)
└── NEW: Feedback Plugin (user-facing)
    └── Ingests: bug reports, feature requests, satisfaction signals
```

---

## Phase 1: Feedback Ingestion Plugin (CTF App)

**Goal**: User-facing feedback collection that flows into the same Neon DB as all other plugin data.

### Database Schema (add to `ctf/schema.sql`)

#### Table: `feedback_items`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | TEXT NOT NULL | Auth-provider user ID of submitter |
| type | TEXT NOT NULL | `bug_report`, `feature_request`, `general`, `satisfaction` |
| title | TEXT NOT NULL | Short summary |
| body | TEXT | Detailed description |
| category | TEXT | Plugin name or area (e.g., `feed`, `trust`, `directory`) |
| priority | TEXT | `critical`, `high`, `medium`, `low` (set during triage) |
| status | TEXT NOT NULL DEFAULT 'new' | `new`, `triaged`, `linked`, `resolved`, `dismissed` |
| metadata | JSONB | Flexible: device info, app version, screenshot URLs |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

#### Table: `feedback_votes`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| feedback_id | UUID FK → feedback_items.id | |
| user_id | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| UNIQUE(feedback_id, user_id) | | One vote per user per item |

### Plugin Contracts (follow existing pattern in `ctf/docs/contracts/`)

Create the following contract files:

- `ctf/docs/contracts/feedback/feedback-command-contract.yaml`
- `ctf/docs/contracts/feedback/feedback-access-policy-contract.yaml`
- `ctf/docs/contracts/feedback/feedback-audit-contract.yaml`

#### Commands

| Command | Auth | Description |
|---------|------|-------------|
| `submitFeedback` | authenticated | User submits feedback from app |
| `listFeedback` | admin | List/filter feedback items |
| `triageFeedback` | admin | Set priority, category, status |
| `voteFeedback` | authenticated | Upvote a feedback item |
| `resolveFeedback` | admin | Mark resolved with resolution note |
| `linkFeedbackToTask` | admin | Link to a PM task (Phase 2) |

### User-Facing Component

- Add feedback form to CTF app (web + Android per parity rules in `105-web-android-feature-parity-rules.mdc`)
- Form fields: type selector, title, body, optional screenshot upload
- Submit calls `submitFeedback` command
- Success confirmation with feedback ID for tracking

### Register Plugin

- Add entry to `ctf/docs/developer/ctf-plugin-feature-inventories/` following existing pattern
- Add audit logging: `insertFeedbackAudit` (follow pattern from unlock/service-credits plugins)

### Verification

- [ ] `CREATE TABLE IF NOT EXISTS feedback_items` + `ALTER TABLE` guards in schema.sql
- [ ] Command contracts pass YAML validation
- [ ] submitFeedback writes to Neon, returns feedback ID
- [ ] listFeedback returns filtered results
- [ ] Audit trail recorded for all mutations

---

## Phase 2: PM Data Layer + MCP Server

**Goal**: PM tables in Neon + an MCP server that lets Copilot Chat read/write PM data.

### Database Schema (add to `ctf/schema.sql`)

#### Table: `pm_tasks`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| status | TEXT NOT NULL DEFAULT 'backlog' | `backlog`, `todo`, `in_progress`, `review`, `done`, `cancelled` |
| priority | TEXT DEFAULT 'medium' | `critical`, `high`, `medium`, `low` |
| labels | TEXT[] | Array of label strings |
| plugin_scope | TEXT | Which plugin this relates to (nullable) |
| milestone_id | UUID FK → pm_milestones.id | nullable |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| completed_at | TIMESTAMPTZ | |

#### Table: `pm_milestones`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| target_date | DATE | |
| status | TEXT DEFAULT 'active' | `active`, `completed`, `cancelled` |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

#### Table: `pm_task_links`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| task_id | UUID FK → pm_tasks.id | |
| link_type | TEXT NOT NULL | `feedback`, `code_file`, `commit`, `pr`, `task` |
| link_ref | TEXT NOT NULL | feedback_id, file path, commit SHA, PR number, or task_id |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

### MCP Server Implementation

**Location**: `ctf/packages/pm-mcp-server/`

**Structure**:

```
ctf/packages/pm-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server entry point (stdio transport)
│   ├── tools/
│   │   ├── tasks.ts      # listTasks, createTask, updateTask, getTask
│   │   ├── feedback.ts   # listFeedback, triageFeedback, linkFeedback
│   │   ├── milestones.ts # listMilestones, createMilestone
│   │   └── search.ts     # searchPM (full-text across tasks + feedback)
│   ├── db.ts             # Neon DB connection (reuse existing pattern)
│   └── types.ts          # Shared types
```

**MCP Tools to expose**:

| Tool | Description | Example Copilot prompt |
|------|-------------|----------------------|
| `listTasks` | Filter by status, priority, plugin, milestone | "Show me all high-priority Feed tasks" |
| `createTask` | Create task with optional feedback link | "Create a task for the login bug" |
| `updateTask` | Change status, priority, labels | "Move task X to in_progress" |
| `getTask` | Get full task details + linked items | "What's linked to task X?" |
| `listFeedback` | Filter by type, status, category | "Show unread feedback" |
| `triageFeedback` | Set priority/category on feedback | "Mark this feedback as high priority" |
| `linkFeedbackToTask` | Connect feedback → task | "Link this feedback to task X" |
| `listMilestones` | Show roadmap milestones | "What's on the roadmap?" |
| `createMilestone` | Create milestone with target date | "Create a v2.1 milestone for June" |
| `searchPM` | Full-text search across PM data | "Find anything about socket timeouts" |
| `getBacklogSummary` | Aggregate stats: counts by status, priority | "Give me a backlog summary" |

**Registration** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "ctf-pm": {
      "type": "stdio",
      "command": "node",
      "args": ["ctf/packages/pm-mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "${env:DATABASE_URL}"
      }
    }
  }
}
```

### Verification

- [ ] `pnpm build` succeeds in pm-mcp-server package
- [ ] MCP server starts, registers 11 tools
- [ ] Copilot Chat: "@workspace list all tasks" returns data from Neon
- [ ] Copilot Chat: "Create a task titled 'Fix feed pagination'" creates in DB
- [ ] Copilot Chat: "Link feedback #abc to task #xyz" creates pm_task_links row

---

## Phase 3: VS Code Extension (PM Dashboard)

**Goal**: Visual PM interface inside VS Code — kanban, feedback inbox, roadmap, CS queue.

### Extension Structure

**Location**: `ctf/packages/pm-vscode-extension/`

```
ctf/packages/pm-vscode-extension/
├── package.json          # VS Code extension manifest
├── tsconfig.json
├── src/
│   ├── extension.ts      # Activation, command registration
│   ├── providers/
│   │   ├── kanbanProvider.ts     # Webview for kanban board
│   │   ├── feedbackProvider.ts   # Webview for feedback inbox
│   │   ├── roadmapProvider.ts    # Webview for milestone timeline
│   │   └── csQueueProvider.ts    # Webview for CS triage
│   ├── views/
│   │   ├── taskTreeView.ts       # Sidebar tree: tasks grouped by status
│   │   └── feedbackTreeView.ts   # Sidebar tree: feedback by type
│   ├── api.ts            # HTTP client to CTF backend (or direct Neon)
│   └── types.ts
├── media/
│   ├── kanban.html       # Webview HTML/CSS/JS
│   ├── feedback.html
│   ├── roadmap.html
│   └── cs-queue.html
```

### Features

| Feature | View Type | Description |
|---------|-----------|-------------|
| Kanban Board | Webview panel | Drag-drop columns: Backlog → Todo → In Progress → Review → Done |
| Feedback Inbox | Webview panel | Triage list with priority badges, one-click link-to-task |
| Roadmap | Webview panel | Milestone timeline with task counts per milestone |
| CS Queue | Webview panel | Feedback items needing response, draft reply via Copilot |
| Task Tree | TreeView (sidebar) | Grouped by status, click to open details |
| Feedback Tree | TreeView (sidebar) | Grouped by type, click to expand |
| Deep Links | Command | Click task → opens linked code file at line |

### Commands (registered in package.json `contributes.commands`)

- `ctf-pm.openKanban`
- `ctf-pm.openFeedbackInbox`
- `ctf-pm.openRoadmap`
- `ctf-pm.openCSQueue`
- `ctf-pm.createTask`
- `ctf-pm.linkToCode` — links current editor file/line to a task

### Distribution

- **Solo dev**: package as `.vsix`, sideload into Codespaces devcontainer via `extensions` in devcontainer.json
- **Later**: optionally publish to VS Code Marketplace

### Verification

- [ ] Extension activates in VS Code, registers commands
- [ ] Kanban webview renders tasks from Neon DB
- [ ] Drag-drop updates task status in DB
- [ ] Feedback inbox shows unread count badge
- [ ] Deep link from task opens correct source file
- [ ] Extension works in Codespaces (webview compatible)

---

## Phase 4: CS + Automation Layer

**Goal**: AI-powered triage, response drafting, and feedback-to-task automation.

### Capabilities

| Capability | How it works |
|-----------|-------------|
| Auto-categorize feedback | MCP tool `triageFeedback` called by Copilot with suggested category/priority |
| CS response drafting | Copilot Chat generates response using feedback context + codebase context |
| Feedback → Task promotion | One-click in extension: creates task, links feedback, sets status to `linked` |
| Critical feedback alerts | MCP tool `getBacklogSummary` includes critical item count in daily check |
| Duplicate detection | `searchPM` finds similar feedback items before creating new tasks |

### Copilot Agent Integration

Add a PM-focused agent to `ctf/agents/`:

- File: `ctf/agents/pm-product-owner.agent.md`
- Responsibilities: triage feedback, maintain backlog, update roadmap
- Tools: PM MCP server tools
- Handoff: receives from meta-orchestrator when PM-related questions arise

---

## Implementation Order & Dependencies

```
Phase 1 (Feedback Plugin) ──────────────────────────┐
  No dependencies, can start immediately             │
  Deliverable: feedback tables + commands + UI form   │
                                                      ├── Phase 4 (Automation)
Phase 2 (MCP Server) ───────────────────────────────┤   Depends on 1 + 2
  Depends on Phase 1 tables for feedback tools        │
  Can start schema work in parallel with Phase 1      │
  Deliverable: MCP server + PM tables                 │
                                                      │
Phase 3 (VS Code Extension) ─────────────────────────┘
  Depends on Phase 2 (reads from same DB/API)
  Deliverable: visual dashboard in VS Code
```

**Parallel work possible**:

- Phase 1 feedback UI + Phase 2 PM schema can develop simultaneously
- Phase 3 webview HTML/CSS can be scaffolded while Phase 2 tools are built

---

## Files to Create or Modify

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `ctf/docs/contracts/feedback/feedback-command-contract.yaml` | 1 | Command contract |
| `ctf/docs/contracts/feedback/feedback-access-policy-contract.yaml` | 1 | Access policy |
| `ctf/docs/contracts/feedback/feedback-audit-contract.yaml` | 1 | Audit contract |
| `ctf/docs/developer/ctf-plugin-feature-inventories/feedback-plugin.md` | 1 | Plugin inventory |
| `ctf/packages/pm-mcp-server/` (entire package) | 2 | MCP server |
| `ctf/packages/pm-vscode-extension/` (entire package) | 3 | VS Code extension |
| `ctf/agents/pm-product-owner.agent.md` | 4 | Copilot agent def |

### Modified Files

| File | Phase | Change |
|------|-------|--------|
| `ctf/schema.sql` | 1+2 | Add feedback_items, feedback_votes, pm_tasks, pm_milestones, pm_task_links |
| `ctf/pnpm-workspace.yaml` | 2 | Add pm-mcp-server package |
| `.vscode/mcp.json` | 2 | Register ctf-pm MCP server |
| `.vscode/copilot-agents.json` | 4 | Add PM agent to orchestration |
| `.devcontainer/devcontainer.json` | 3 | Add PM extension to Codespaces |

---

## Key Decisions

- **Data store**: Neon DB (consistent with all existing CTF plugins)
- **MCP transport**: stdio (local, simplest for solo dev; upgrade to HTTP later if needed)
- **Extension distribution**: VSIX sideload into devcontainer (no marketplace needed initially)
- **Feedback auth**: Authenticated (tied to canonical auth-provider user ID), with optional anonymous mode
- **Schema convention**: follows CTF's CREATE TABLE IF NOT EXISTS + ALTER TABLE IF EXISTS pattern
