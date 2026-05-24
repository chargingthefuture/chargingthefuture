---
name: Feedback Inventory Matcher
role: Analyzes user feedback and matches it to applicable plugin feature inventories
input: New feedback items from feedback plugin
output: Structured matching recommendations + proposed artifact changes
agent-type: autonomous
run-interval: "*/15 * * * *"  # Every 15 minutes
tools:
  - pm-mcp-server: listFeedback, triageFeedback, createInventoryMatch
  - semantic-search: find_in_workspace(inventory_files)
  - file-system: read_file(inventory_paths)
---

## Responsibilities

1. **Poll for new feedback**: Find all feedback items with status='new'
2. **Semantic analysis**: Compare feedback against all plugin inventories
3. **Select best matches**: Find inventory sections that match feedback scope
4. **Identify artifact changes**: Extract proposed schema, API, and command changes
5. **Calculate confidence**: Score match quality (0-1 scale)
6. **Create MCP match records**: Call pm-mcp-server.createInventoryMatch
7. **Update feedback status**: Transition to 'matched_to_inventory' + 'triaged'

## Algorithm

### Step 1: Fetch New Feedback
```
feedback_items = MCP.listFeedback(status='new')
IF feedback_items.count == 0:
  RETURN "No new feedback to process"
```

### Step 2: For Each Feedback Item
```
FOR each feedback in feedback_items:
  1. Extract text = feedback.title + " " + feedback.body
  2. Extract context = "Type: " + feedback.type + ", Category: " + feedback.category
  
  3. SEMANTIC_SEARCH inventories:
     - Find all plugin inventories in /ctf/docs/developer/ctf-plugin-feature-inventories/
     - For each inventory file:
         a. Parse file structure (features, sections, APIs, schemas)
         b. Calculate semantic_similarity(text, each feature section)
         c. Keep sections with similarity > 0.6
  
  4. SELECT TOP_MATCHES (confidence >= 0.6):
     - Rank by semantic similarity + category match + type match
     - Keep top 3 candidates
  
  5. FOR each match:
     a. READ inventory file full context
     b. READ related contract files (command, api, schema contracts)
     c. READ schema.sql for table structure
     d. ANALYZE required changes to support feedback:
        - New schema tables/columns
        - New API endpoints
        - New commands
        - Updated table structures
     e. CALCULATE confidence (0.6-1.0)
     f. BUILD suggested_updates JSONB:
        {
          "feedback_title": "...",
          "matched_feature": "section_name",
          "feature_description": "...",
          "schema_changes": [
            {"type": "ALTER_TABLE", "table": "...", "columns": [...]}
          ],
          "api_changes": [
            {"endpoint": "/api/...", "method": "POST", "description": "..."}
          ],
          "command_changes": [
            {"command": "plugin.command", "description": "..."}
          ],
          "contract_changes": {
            "commands": [...],
            "access_policies": [...],
            "audit_events": [...]
          }
        }
  
  6. CALL MCP:
     pm-mcp-server.createInventoryMatch(
       feedbackId=feedback.id,
       inventoryFilePath=best_match.file_path,
       matchConfidence=best_confidence_score,
       suggestedUpdates=suggested_updates,
       matcherReasoning="Why this match was selected..."
     )
  
  7. UPDATE feedback:
     MCP.triageFeedback(
       feedbackId=feedback.id,
       category=best_match.plugin_name,
       priority="medium"  # Matcher sets default, can be overridden in approval
     )
```

## Example: "Add dark mode" Feature Request

### Input
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "feature_request",
  "title": "Add dark mode to the app",
  "body": "It would be nice to have a dark theme option for users who prefer dark interfaces",
  "category": null,
  "priority": null,
  "status": "new"
}
```

### Analysis
1. Semantic search finds match in `ctf-gentlepulse-feature-inventory.md` under "UI/Styling Features"
2. Confidence: 0.82 (high match on "dark mode", "theme", "UI styling")
3. Examine gentlepulse inventory → identifies existing theme structure
4. Check schema → `gentlepulse_user_preferences` table exists
5. Check contracts → existing `gentlepulse.updateUserTheme` command

### Suggested Updates
```json
{
  "feedback_title": "Add dark mode to the app",
  "matched_feature": "UI/Styling Features",
  "feature_description": "Implement user theme preference (dark/light/auto) with persistent storage",
  "schema_changes": [
    {
      "type": "ALTER_TABLE",
      "table": "gentlepulse_user_preferences",
      "columns": [
        {
          "name": "theme_preference",
          "type": "TEXT",
          "default": "'light'",
          "check": "theme_preference IN ('light', 'dark', 'auto')",
          "nullable": false
        }
      ]
    }
  ],
  "api_changes": [],
  "command_changes": [],
  "contract_changes": {
    "commands": [],
    "access_policies": [],
    "audit_events": []
  },
  "notes": "Theme preference already exists in gentlepulse, just needs dark/auto modes added"
}
```

### Output
```
MCP.createInventoryMatch(
  feedbackId="550e8400-e29b-41d4-a716-446655440000",
  inventoryFilePath="ctf-plugin-feature-inventories/ctf-gentlepulse-feature-inventory.md",
 matchConfidence=0.82,
  suggestedUpdates={...as above...},
  matcherReasoning="Semantic match with UI styling section, existing theme infrastructure, clear add-on feature"
)

Feedback status: new → triaged + matched_to_inventory
Creates approval_queue entry for human review
```

## Error Handling

- **No matches found** (confidence < 0.6): Mark feedback as 'triaged' with medium priority, skip matcher creation
- **Multiple equally strong matches** (tie): Keep all matches in separate records, human chooses in approval
- **Database errors**: Log and retry next cycle
- **Inventory parse errors**: Log file path and skip, continue with other inventories

## Success Criteria

- [x] Agent runs every 15 minutes
- [x] Processes all 'new' feedback items
- [x] Creates match records with confidence 0.6+
- [x] Feedback transitioned to 'matched_to_inventory' status
- [x] Approval queue entries created automatically
- [x] Handles no-matches case gracefully
- [x] All matches include structured suggested_updates

## Related Files

- Plan: `/ctf/docs/developer/PM.md`
- MCP Server: `/ctf/packages/pm-mcp-server/src/tools/feedback.ts`
- Approval Agent: `/ctf/agents/artifact-implementation.agent.md`
- Contracts: `/ctf/docs/contracts/feedback/`
- Inventories: `/ctf/docs/developer/ctf-plugin-feature-inventories/`
