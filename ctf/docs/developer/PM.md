# PM Tooling — Feedback to Implementation

Single reference for the PM/feedback system: the AI-assisted pipeline that turns
user feedback into approved artifact changes and automated implementation.
Authoritative schema lives in `ctf/schema.sql`; contracts in
`ctf/docs/contracts/feedback/`. This doc covers the design, status, and how to
operate it.

## Status

| Capability | State |
|---|---|
| Feedback ingestion → Neon | Built |
| MCP server (`ctf/packages/pm-mcp-server/`) | Built |
| Inventory-matcher agent | Built |
| Approval workflow | Built |
| Implementation-handoff agent | Built |
| VS Code extension (Kanban/Roadmap/Inbox) | Deferred |
| PM data layer (`pm_tasks`/`pm_milestones`) | Deferred |
| CS triage queue + advanced reporting | Deferred |

## Pipeline

```
User submits feedback (CTF app)
  → feedback_items (status='new')
  → Inventory-Matcher agent (every 15 min): semantic match vs plugin inventories,
    confidence score, suggested_updates (schema/API/command) → feedback_inventory_matches
  → approval_queue (status='pending')
  → Admin approves / rejects / modifies
      approve → implementation_queue (status='pending')
      reject  → feedback 'dismissed'
  → Implementation agent (every 10 min): applies schema/inventory/contract changes,
    validates, commits with feedback reference
  → feedback 'resolved'
```

## Data Model

Defined in `ctf/schema.sql` (authoritative). Tables:

- `feedback_items` — user feedback; status enum `new → triaged → matched_to_inventory → approval_pending → approved → linked_to_task → resolved` (or `dismissed`).
- `feedback_votes` — upvotes (unique per user+feedback).
- `feedback_inventory_matches` — matcher output: `inventory_file_path`, `match_confidence` (0–1), `suggested_updates` JSONB, reasoning.
- `approval_queue` — human approval (unique per feedback): status, approver, `approved_artifact_changes` JSONB.
- `implementation_queue` — approved changes to apply (unique per feedback): `artifact_changes` JSONB, status, log.
- `inventory_analysis_cache` — parsed inventory structure for the matcher.

## MCP Server

`ctf/packages/pm-mcp-server/` — stdio transport, Neon SDK. Tools: `listFeedback`,
`triageFeedback`, `voteFeedback`, `listInventories`, `getInventory`,
`createInventoryMatch`, `getApprovalQueue`, `updateApprovalStatus` /
`approveMatch` / `rejectMatch`, `getImplementationQueue`, `setImplementationStatus`.

## Agents

- `ctf/agents/feedback-inventory-matcher.agent.md` — polls `status='new'`, semantic-searches `ctf/docs/developer/ctf-plugin-feature-inventories/`, scores matches (keep confidence ≥ 0.6), writes match + approval records, transitions feedback to `triaged`/`matched_to_inventory`.
- `ctf/agents/artifact-implementation.agent.md` — polls `implementation_queue` `status='pending'`, applies schema/inventory/contract changes, validates SQL/YAML, commits, marks feedback `resolved`.

## Activation

1. Build the server: `pnpm -C ctf/packages/pm-mcp-server install && pnpm -C ctf/packages/pm-mcp-server build`.
2. Register it (local AI client), e.g. in `.vscode/mcp.json`:
   ```json
   { "servers": { "ctf-pm": { "type": "stdio", "command": "node",
     "args": ["ctf/packages/pm-mcp-server/dist/index.js"],
     "env": { "DATABASE_URL": "${env:DATABASE_URL}" } } } }
   ```
3. Add the feedback form to the CTF app (web + Android per parity rules) calling `submitFeedback`.
4. Build the admin approval surface over `approval_queue` (approve/reject/modify → `approveMatch`/`rejectMatch`).
5. Monitor matcher (15 min) and implementation (10 min) agent runs and the `implementation_queue` for failures.

## Deferred / Future Phases

Preserved from the original broad plan (not in the current MVP):

- **PM data layer** — `pm_tasks`, `pm_milestones`, `pm_task_links` tables for roadmap/kanban tracking, with MCP tools to manage them.
- **VS Code extension** — PM dashboard: Feedback Inbox, Kanban board, Roadmap view; distributed as a `.vsix`.
- **CS + automation layer** — customer-support triage queue, Copilot-agent integration for auto-drafting responses, advanced reporting.

## Related

- Schema: `ctf/schema.sql`
- Contracts: `ctf/docs/contracts/feedback/`
- MCP server: `ctf/packages/pm-mcp-server/`
- Agents: `ctf/agents/feedback-inventory-matcher.agent.md`, `ctf/agents/artifact-implementation.agent.md`
