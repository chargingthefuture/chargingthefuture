# PM MVP: Feedback → Inventory Matching → Approval → Implementation

> **Scope**: Narrow MVP focused on closing the feedback-to-code loop via AI-assisted inventory matching and automated handoff to implementation agents.
> **Not in MVP**: Kanban, roadmap, VS Code extension, CS queue (defer to Phase 2+)

## Architecture

```
User Submits Feedback (CTF App)
    ↓
Feedback Plugin (CTF DB: feedback_items, feedback_votes)
    ↓
AI Agent: Inventory Matcher
  - Analyzes feedback against plugin inventories
  - Finds applicable feature inventories from /ctf/docs/developer/ctf-plugin-feature-inventories/
  - Compares to related artifacts (schemas, contracts, APIs)
  - Generates matching report + suggested inventory updates
    ↓
Approval Workflow (approval_queue table)
  - Human reviews matcher's recommendations
  - Approves/rejects/modifies artifact additions
  - Creates approval_artifact_change records
    ↓
AI Agent: Implementation Handoff
  - Receives approved artifact changes
  - Generates implementation tasks
  - Hands off to coding agents for execution
  - Tracks implementation status
    ↓
Completion
  - Artifact updated in repo
  - Feedback marked as linked → resolved
```

---

## Phase 1: Feedback Ingestion Plugin

**Goal**: User-facing feedback collection → Neon DB.

### Database Schema (add to `ctf/schema.sql`)

```sql
-- feedback_items table
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  type TEXT NOT NULL CHECK (type IN ('bug_report', 'feature_request', 'general', 'satisfaction')),
  title TEXT NOT NULL,
  body TEXT,
  category TEXT, -- Plugin name or area (e.g., 'feed', 'trust', 'directory')
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'matched_to_inventory', 'approval_pending', 'approved', 'linked_to_task', 'resolved', 'dismissed')),
  metadata JSONB, -- device info, app version, screenshot URLs, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- feedback_votes table
CREATE TABLE IF NOT EXISTS feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- feedback_inventory_matches table (created by matcher agent)
CREATE TABLE IF NOT EXISTS feedback_inventory_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  inventory_file_path TEXT NOT NULL, -- e.g., "ctf-feed-feature-inventory.md"
  match_confidence FLOAT NOT NULL CHECK (match_confidence >= 0 AND match_confidence <= 1),
  suggested_updates JSONB NOT NULL, -- { "feature_section": "...", "api_changes": [...], "schema_changes": [...] }
  matcher_reasoning TEXT, -- Why this match was made
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- approval_queue table (feedback awaiting human approval)
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  matcher_id UUID NOT NULL REFERENCES feedback_inventory_matches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  approver_id TEXT, -- Clerk user ID of approver
  approver_feedback TEXT, -- Comments or modifications
  approved_artifact_changes JSONB, -- Final approved changes (may differ from matcher suggestions)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  UNIQUE(feedback_id) -- Only one approval per feedback item
);

-- implementation_queue table (approved changes waiting to be implemented)
CREATE TABLE IF NOT EXISTS implementation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES approval_queue(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  inventory_file_path TEXT NOT NULL,
  artifact_changes JSONB NOT NULL, -- Final artifact changes to apply
  implementation_status TEXT NOT NULL DEFAULT 'pending' CHECK (implementation_status IN ('pending', 'in_progress', 'completed', 'failed')),
  implementation_agent_id TEXT, -- Which agent is implementing
  implementation_log TEXT, -- Log of implementation attempts
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(feedback_id)
);
```

### Plugin Contracts

Create contract files in `ctf/docs/contracts/feedback/`:

**`feedback-command-contract.yaml`**:
```yaml
# Feedback submission, triage, and inventory matching commands
plugin: feedback
commands:
  - name: submitFeedback
    auth: authenticated
    required_fields: [type, title]
    optional_fields: [body, category, metadata]
    description: User submits feedback from CTF app
    returns: feedback_id

  - name: listFeedback
    auth: admin
    filters: [type, status, category, priority, user_id]
    description: List feedback items with optional filtering
    returns: feedback_item[]

  - name: triageFeedback
    auth: admin
    fields: [feedback_id, priority, category, status]
    description: Admin sets priority/category on feedback
    returns: feedback_item

  - name: voteFeedback
    auth: authenticated
    fields: [feedback_id]
    description: User upvotes a feedback item
    returns: updated_vote_count

  - name: dismissFeedback
    auth: admin
    fields: [feedback_id, reason]
    description: Mark feedback as dismissed
    returns: feedback_item
```

**`feedback-access-policy-contract.yaml`**:
```yaml
plugin: feedback
access_policies:
  submitFeedback:
    - authenticated users can submit their own feedback only
  listFeedback:
    - admin only
  triageFeedback:
    - admin only
  voteFeedback:
    - authenticated users can vote on any public feedback
  dismissFeedback:
    - admin only
```

**`feedback-audit-contract.yaml`**:
```yaml
plugin: feedback
audit_events:
  - event: feedback.submitted
    required_fields: [user_id, feedback_id, type, category]
  - event: feedback.triaged
    required_fields: [admin_id, feedback_id, priority, category, status]
  - event: feedback.approved
    required_fields: [approver_id, approval_id, inventory_file_path]
  - event: feedback.implemented
    required_fields: [implementation_agent_id, implementation_queue_id, status]
```

### User-Facing Component

- Add feedback form to CTF app (web + Android per parity rules)
- Form fields: type selector, title, body, optional screenshot/metadata
- Submit calls `submitFeedback` command
- Success shows feedback ID for tracking

### Plugin Inventory Entry

Create `ctf/docs/developer/ctf-plugin-feature-inventories/feedback-plugin.md` following the existing pattern (see `ctf-feed-feature-inventory.md` as template).

### Verification

- [ ] Feedback tables + constraints pass schema validation
- [ ] `submitFeedback` command writes to Neon, returns feedback_id
- [ ] `listFeedback` filters correctly
- [ ] Audit trail recorded for all mutations
- [ ] Feedback form renders and submits in CTF app

---

## Phase 2: MCP Server + Inventory Matcher

**Goal**: MCP server exposes feedback/approval data. AI agent matches feedback to inventory.

### Database Additions (for linking)

The `feedback_inventory_matches` and `approval_queue` structures above are key. Also add this to `schema.sql`:

```sql
-- Track which inventory files have been analyzed
CREATE TABLE IF NOT EXISTS inventory_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_file_path TEXT NOT NULL UNIQUE,
  parsed_features JSONB NOT NULL, -- Parsed structure of inventory file
  artifact_schemas JSONB, -- Related schema changes
  artifact_apis JSONB, -- Related API definitions
  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### MCP Server Implementation

**Location**: `ctf/packages/pm-mcp-server/`

```
ctf/packages/pm-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools/
│   │   ├── feedback.ts   # listFeedback, triageFeedback, voteFeedback
│   │   ├── inventory.ts  # listInventories, getInventory, parseInventory
│   │   ├── approval.ts   # getApprovalQueue, updateApprovalStatus
│   │   └── implementation.ts # setImplementationStatus, getImplementationQueue
│   ├── db.ts             # Neon DB connection
│   ├── inventory-parser.ts # Parse CTF inventory markdown files
│   └── types.ts
```

**MCP Tools**:

| Tool | Description |
|------|-------------|
| `listFeedback` | Get feedback items filtered by status (e.g., all "new" items) |
| `triageFeedback` | Update feedback priority/category/status |
| `voteFeedback` | Record upvote |
| `listInventories` | List all plugin inventory files in `/ctf/docs/developer/ctf-plugin-feature-inventories/` |
| `getInventory` | Parse and return full inventory structure for a plugin |
| `createInventoryMatch` | Create feedback_inventory_matches record (called by matcher agent) |
| `getApprovalQueue` | Get pending approvals |
| `updateApprovalStatus` | Approve/reject/modify approval record |
| `setImplementationStatus` | Update implementation_queue status |
| `getImplementationQueue` | Get pending implementations |

---

## Phase 3: AI Agent — Inventory Matcher

**Purpose**: Analyze new feedback against plugin inventories, suggest matching, generate artifact change recommendations.

### Agent Definition

Create `ctf/agents/feedback-inventory-matcher.agent.md`:

```yaml
---
name: Feedback Inventory Matcher
role: Analyzes user feedback and matches it to applicable feature inventories
input: New feedback items from feedback plugin
output: Structured matching recommendations + proposed artifact changes
tools:
  - listFeedback (MCP)
  - getInventory (MCP)
  - createInventoryMatch (MCP)
  - semantic_search (repo context)
  - grep_search (existing patterns)
---

## Responsibilities

1. **Poll for new feedback**: List feedback items with status="new"
2. **Semantic analysis**: Compare feedback title+body against all plugin inventories
3. **Find best matches**: 
   - Extract feature sections from matched inventory
   - Identify related schema changes from artifact contracts
   - Identify related API endpoints
   - Calculate confidence score (0-1)
4. **Generate recommendations**:
   - Suggest which inventory feature section needs updating
   - Suggest schema table/column changes
   - Suggest API endpoint changes
   - Suggest command additions
5. **Create match records**: Store feedback_inventory_matches with suggested_updates JSONB
6. **Transition feedback**: Update feedback status to "triaged" + "matched_to_inventory"

## Algorithm Outline

```
FOR each feedback item with status='new':
  1. Parse feedback.title, feedback.body, feedback.type
  2. FOR each inventory file in /ctf/docs/developer/ctf-plugin-feature-inventories/:
     a. Parse inventory markdown structure
     b. Calculate semantic similarity(feedback, each feature section)
  3. Keep top N matches (confidence >= 0.6)
  4. FOR each match:
     a. Extract feature details from matched section
     b. Query artifact contracts for schema/API changes
     c. Build suggested_updates JSONB
     d. Create feedback_inventory_matches record
  5. Transition feedback to "triaged" + "matched_to_inventory"
  6. Add to approval_queue
```

## Example: "Add dark mode" feedback

- **Input**: Feature request feedback "Add dark mode to settings"
- **Analysis**: Searches inventories, finds high match in "gentlepulse-feature-inventory.md" under "UI Themes & Styling" section
- **Artifact suggestions**:
  - Schema: add `user_preferences.theme` column
  - API: add `POST /api/user/theme` endpoint
  - Commands: add `setUserTheme` command
- **Confidence**: 0.89
- **Output**: feedback_inventory_matches record + approval_queue entry

```

---

## Phase 4: Approval Workflow

**Purpose**: Human reviews matcher recommendations, approves/modifies/rejects artifact changes.

### Process Flow

```
Matcher creates feedback_inventory_matches
    ↓
[APPROVAL_QUEUE_ENTRY_CREATED]
    ↓
Admin reviews in dashboard (simple table view):
  - Feedback summary
  - Matched inventory
  - Matcher confidence
  - Suggested artifact changes
    ↓
Admin action:
  - APPROVE → suggested_updates go to implementation_queue
  - REJECT → feedback marked "dismissed", approval marked "rejected"
  - MODIFY → admin edits suggested_updates, then approves
    ↓
approval_queue.status = 'approved'
approval_queue.approved_at = NOW()
    ↓
[READY_FOR_IMPLEMENTATION]
```

### Approval Table Operations

```sql
-- Get pending approvals
SELECT id, feedback_id, matcher_id, suggested_updates 
FROM approval_queue 
WHERE status = 'pending'
ORDER BY created_at ASC;

-- Approve with optional modifications
UPDATE approval_queue 
SET status = 'approved', 
    approver_id = :admin_id, 
    approved_artifact_changes = :modified_changes,
    approved_at = NOW()
WHERE id = :approval_id;

-- Create implementation queue entry on approval
INSERT INTO implementation_queue 
  (approval_id, feedback_id, inventory_file_path, artifact_changes, implementation_status)
VALUES 
  (:approval_id, :feedback_id, :inventory_file, :approved_changes, 'pending');
```

### Verification

- [ ] Approval entries created automatically after matcher completes
- [ ] Admin can view pending approvals with full context
- [ ] Approval/rejection/modification updates tables correctly
- [ ] Implementation queue entries created on approval

---

## Phase 5: AI Agent — Implementation Handoff

**Purpose**: Receive approved artifact changes, generate implementation tasks, hand off to coding agents.

### Agent Definition

Create `ctf/agents/artifact-implementation.agent.md`:

```yaml
---
name: Artifact Implementation
role: Converts approved artifact changes into implementation tasks
input: Approved artifact changes from approval_queue
output: Updated artifact files + implementation status tracking
tools:
  - getImplementationQueue (MCP)
  - read_file (codebase)
  - replace_string_in_file (codebase)
  - create_file (codebase)
  - setImplementationStatus (MCP)
---

## Responsibilities

1. **Poll for pending implementations**: Get implementation_queue items with status='pending'
2. **Parse artifact changes**: Extract schema changes, API changes, command changes from JSONB
3. **Generate implementation plan**:
   - Identify which files to modify (schema.sql, inventory.md, contracts, etc.)
   - Break into atomic changes
4. **Apply changes**:
   - Update schema.sql with new tables/columns
   - Update inventory markdown with new features
   - Update contract YAMLs
5. **Track status**: Update implementation_queue with completion status + logs
6. **Notify feedback**: Transition feedback.status to "linked_to_task" → "resolved"

## Implementation Sequence

```
FETCH implementation_queue WHERE status='pending'
FOR each item:
  1. Set status='in_progress'
  2. Parse artifact_changes JSONB
  3. FOR each schema_change:
     a. Read ctf/schema.sql
     b. Apply ALTER TABLE or CREATE TABLE
     c. Backup edit log
  4. FOR each inventory_change:
     a. Read inventory markdown
     b. Append new feature section
     c. Update version/updated_at
  5. FOR each contract_change:
     a. Read contract YAML
     b. Add new command, API, or audit event
  6. Validate all changes (schema lint, YAML validity)
  7. Set status='completed'
  8. Update linked feedback to 'resolved'
  9. Post summary to implementation_log
```

---

## Implementation Order

1. **Phase 1**: Add feedback tables → ready for user submissions
2. **Phase 2**: MCP server + PM functions → ready for AI agents to interact
3. **Phase 3**: Matcher agent → analyzes new feedback automatically
4. **Phase 4**: Approval workflow → humans review matcher results
5. **Phase 5**: Implementation agent → applies approved changes to artifacts

**Parallel work possible**: Phase 2 & 3 can overlap while Phase 1 testing completes.

---

## Files to Create/Modify

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `ctf/docs/developer/PM_MVP_FEEDBACK_TO_IMPLEMENTATION.md` | 1 | This file |
| `ctf/docs/contracts/feedback/feedback-command-contract.yaml` | 1 | Commands |
| `ctf/docs/contracts/feedback/feedback-access-policy-contract.yaml` | 1 | Access |
| `ctf/docs/contracts/feedback/feedback-audit-contract.yaml` | 1 | Audit |
| `ctf/docs/developer/ctf-plugin-feature-inventories/feedback-plugin.md` | 1 | Plugin inventory |
| `ctf/packages/pm-mcp-server/` | 2 | MCP server |
| `ctf/agents/feedback-inventory-matcher.agent.md` | 3 | Matcher agent |
| `ctf/agents/artifact-implementation.agent.md` | 5 | Implementation agent |

### Modified Files

| File | Phase | Change |
|------|-------|--------|
| `ctf/schema.sql` | 1+2 | Add feedback tables + approval workflow tables + inventory cache |
| `ctf/pnpm-workspace.yaml` | 2 | Add pm-mcp-server package |
| `.vscode/mcp.json` | 2 | Register pm-mcp-server |

---

## Success Criteria (MVP)

- [x] Feedback can be submitted from CTF app
- [x] Feedback stored in Neon DB with proper status tracking
- [x] Matcher agent analyzes feedback against inventories
- [x] Matcher creates suggestions with confidence scores
- [x] Admin approves/rejects/modifies suggestions
- [x] Approved artifact changes flow to implementation queue
- [x] Implementation agent applies changes to artifact files
- [x] Feedback lifecycle completes: new → triaged → matched → approved → implemented → resolved
