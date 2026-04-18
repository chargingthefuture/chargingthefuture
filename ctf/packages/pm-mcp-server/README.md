# PM MCP Server

## Purpose
Implements the MCP server for feedback→plugin inventory matching, consumed by autonomous agents.

## MCP Tools (APIs)
| Tool                    | Arguments (required/optional) | Description                                 |
|-------------------------|-------------------------------|---------------------------------------------|
| `listFeedback`          | status?                       | List feedback items by status               |
| `triageFeedback`        | feedbackId, triageResult      | Triage a feedback item                      |
| `createInventoryMatch`  | feedbackId, pluginId          | Propose a plugin match for feedback         |
| `getApprovalQueue`      | none                          | List matches pending approval               |
| `approveMatch`          | matchId                       | Approve a proposed match                    |
| `rejectMatch`           | matchId, reason?              | Reject a proposed match                     |
| `getImplementationQueue`| none                          | List matches ready for implementation       |
| `setImplementationStatus`| matchId, status              | Update implementation status                |
## API Schema and Types

All request/response payloads for MCP tools are defined in [src/types.ts](src/types.ts). Below are the key types and valid enum values for each tool. Example payloads are provided for clarity.

### Common Types

- **FeedbackItem**
    - `status`: `"new" | "triaged" | "matched_to_inventory" | "approval_pending" | "approved" | "linked_to_task" | "resolved" | "dismissed"`
    - `priority`: `"critical" | "high" | "medium" | "low"`
    - `type`: `"bug_report" | "feature_request" | "general" | "satisfaction"`
- **ApprovalQueueItem**
    - `status`: `"pending" | "approved" | "rejected" | "modified"`
- **ImplementationQueueItem**
    - `implementation_status`: `"pending" | "in_progress" | "completed" | "failed"`

### Tool Schemas & Example Payloads

#### listFeedback
**Request:**
```json
{
    "status": "triaged" // optional, see FeedbackItem.status
}
```
**Response:**
```json
{
    "items": [FeedbackItem],
    "totalCount": 42
}
```

#### triageFeedback
**Request:**
```json
{
    "feedbackId": "string",
    "priority": "high", // optional
    "category": "string", // optional
    "status": "triaged" // optional, see FeedbackItem.status
}
```
**Response:**
```json
FeedbackItem
```

#### createInventoryMatch
**Request:**
```json
{
    "feedbackId": "string",
    "inventoryFilePath": "string",
    "matchConfidence": 0.95,
    "suggestedUpdates": {},
    "matcherReasoning": "string" // optional
}
```
**Response:**
```json
{
    "matchId": "string",
    "feedbackId": "string"
}
```

#### getApprovalQueue
**Request:**
```json
{
    "status": "pending" // optional, see ApprovalQueueItem.status
}
```
**Response:**
```json
{
    "items": [ApprovalQueueItem],
    "totalCount": 10
}
```

#### approveMatch
**Request:**
```json
{
    "approvalId": "string",
    "approverId": "string",
    "approverFeedback": "string", // optional
    "approvedArtifactChanges": {} // optional
}
```
**Response:**
```json
{
    "approvalId": "string",
    "status": "approved",
    "approvedAt": "2026-04-18T12:00:00Z"
}
```

#### rejectMatch
**Request:**
```json
{
    "approvalId": "string",
    "approverId": "string",
    "rejectionReason": "string"
}
```
**Response:**
```json
{
    "approvalId": "string",
    "status": "rejected"
}
```

#### getImplementationQueue
**Request:**
```json
{
    "status": "pending" // optional, see ImplementationQueueItem.implementation_status
}
```
**Response:**
```json
{
    "items": [ImplementationQueueItem],
    "totalCount": 5
}
```

#### setImplementationStatus
**Request:**
```json
{
    "implementationId": "string",
    "newStatus": "in_progress", // see ImplementationQueueItem.implementation_status
    "implementationAgentId": "string", // optional
    "implementationLog": "string" // optional
}
```
**Response:**
```json
{
    "implementationId": "string",
    "status": "in_progress",
    "feedbackStatus": "linked_to_task",
    "completedAt": null
}
```

For authoritative schemas, see [src/types.ts](src/types.ts).

## Feedback State Machine
```
new → triaged → matched_to_inventory → approval_pending → linked_to_task → resolved
         ↘ dismissed
```

## Agent Integration
- Invoked by `feedback-inventory-matcher.agent.md` and `artifact-implementation.agent.md` via stdio.

## Database
- PostgreSQL, configured via `DATABASE_URL` environment variable.
- Example connection string:
    ```
    postgresql://user:password@localhost:5432/dbname
    ```

## Build & Run

Before running the server, you must build the project to produce `dist/index.js`.

### Required Environment Variables
- `DATABASE_URL` (see example above)

### Build
```sh
pnpm run build
```

### Run
```sh
node dist/index.js
```
