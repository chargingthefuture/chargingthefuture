---
name: Artifact Implementation
role: Converts approved artifact changes into working code updates
input: Approved artifact changes from approval_queue (via implementation_queue)
output: Updated artifact files + implementation status tracking
agent-type: autonomous
run-interval: "*/10 * * * *"  # Every 10 minutes
tools:
  - pm-mcp-server: getImplementationQueue, setImplementationStatus
  - file-system: read_file, replace_string_in_file, create_file
  - vcs: git_status, git_diff, git_add
  - validation: yaml_validate, sql_lint
---

## Responsibilities

1. **Poll for pending implementations**: Get implementation_queue items with status='pending'
2. **Parse artifact changes**: Extract schema, API, command, and contract changes
3. **Apply schema changes**: UPDATE ctf/schema.sql with new tables/columns
4. **Apply inventory changes**: UPDATE plugin inventory markdown files
5. **Apply contract changes**: UPDATE YAML contract files
6. **Validate changes**: Lint SQL, validate YAML, check syntax
7. **Track status**: Update implementation_queue with results
8. **Mark feedback resolved**: Transition linked feedback to 'resolved'

## Algorithm

### Fetch Pending Implementations
```
items = MCP.getImplementationQueue(status='pending', pageSize=10)
IF items.count == 0:
  RETURN "No pending implementations"

MCP.setImplementationStatus(
  Each item,
  status='in_progress',
  implementationAgentId='artifact-implementation-v1'
)
```

### Apply Changes for Each Item

#### Schema Changes
```
IF artifact_changes.schema_changes:
  1. READ ctf/schema.sql
  2. FOR each schema_change in artifact_changes.schema_changes:
     a. IF change.type == 'ALTER_TABLE':
        - Find table in schema
        - Add new columns after last existing column
        - Include constraints (CHECK, DEFAULT, NOT NULL)
        - Add indexes for performance columns
        
     b. IF change.type == 'CREATE_TABLE':
        - Add new table definition at end of schema
        - Include all columns with types and constraints
        - Include indexes
  
  3. VALIDATE schema.sql:
     - SQL syntax check (psql --dry-run)
     - No duplicate table names
     - Foreign key references exist
     - Index names unique
  
  4. REPLACE in file schema.sql with updated content
  5. LOG: "Applied schema changes to ctf/schema.sql"
```

#### Inventory Changes
```
IF artifact_changes.inventory_changes:
  1. READ inventory_file_path from implementation_queue
  2. READ full inventory markdown
  3. FOR each inventory_change in artifact_changes.inventory_changes:
     a. IF change.type == 'ADD_FEATURE':
        - INSERT new feature section in appropriate location
        - Follow existing markdown structure
        - Update feature/command/API counts in TOC
        
     b. IF change.type == 'UPDATE_FEATURE':
        - Find existing feature section
        - UPDATE description and related fields
        - Keep version/updated_at current
  
  4. UPDATE version number and last-updated timestamp
  5. REPLACE in file with updated inventory markdown
  6. LOG: "Updated inventory: {file_path}"
```

#### Command Contract Changes
```
IF artifact_changes.command_changes:
  1. READ FEEDBACK_PLUGIN_COMMAND_CONTRACTS.yaml
  2. FOR each command_change in artifact_changes.command_changes:
     a. IF change.type == 'ADD_COMMAND':
        - ADD new command entry in contracts list
        - Fill inputSchema, outputSchema, dataAccess
        - Set purpose, retentionClass, idempotency
        
     b. IF change.type == 'UPDATE_COMMAND':
        - FIND existing command by name
        - UPDATE description, input/output schemas
  
  3. VALIDATE YAML syntax
  4. REPLACE in file with updated contract YAML
  5. LOG: "Updated command contracts"
```

#### Access Policy Changes
```
IF artifact_changes.access_policy_changes:
  1. READ FEEDBACK_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml
  2. FOR each policy_change in artifact_changes.access_policy_changes:
     a. ADD or UPDATE access policy rules
     b. Maintain consistency with command contracts
  
  3. VALIDATE YAML
  4. REPLACE in file
  5. LOG: "Updated access policies"
```

#### Audit Contract Changes
```
IF artifact_changes.audit_contract_changes:
  1. READ FEEDBACK_PLUGIN_AUDIT_CONTRACTS.yaml
  2. FOR each audit_change in artifact_changes.audit_contract_changes:
     a. ADD new audit event types
     b. Update required_fields for new artifacts
  
  3. VALIDATE YAML
  4. REPLACE in file
  5. LOG: "Updated audit contracts"
```

### Validation & Completion
```
1. VALIDATE all changes:
   - SQL syntax passes lint
   - YAML files parse and validate
   - Markdown files are properly formatted
   - Cross-references are valid

2. IF any validation fails:
   MCP.setImplementationStatus(
     implementationId,
     status='failed',
     implementationLog="Validation failed: {error_details}"
   )
   RETURN FAILED

3. IF all validation passes:
   MCP.setImplementationStatus(
     implementationId,
     status='completed',
     implementationLog="Successfully applied all artifact changes"
   )
   
   FEEDBACK linked to this implementation:
     - Transitioned to 'resolved'
     - Marked as successfully implemented

4. GIT commit changes:
   git add ctf/schema.sql ctf/docs/contracts/ ctf/docs/developer/ctf-plugin-feature-inventories/
   git commit -m "feat: implement feedback #{feedbackId} artifact changes"
   
   (Commit message links back to original feedback)
```

## Example: Dark Mode Implementation

### Input from implementation_queue
```json
{
  "id": "...",
  "feedback_id": "550e8400-e29b-41d4-a716-446655440000",
  "inventory_file_path": "ctf-gentlepulse-feature-inventory.md",
  "artifact_changes": {
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
    "inventory_changes": [
      {
        "type": "UPDATE_FEATURE",
        "section": "UI/Styling Features",
        "update": {
          "name": "User Theme Preference",
          "description": "Users can select light, dark, or automatic theme based on system preference"
        }
      }
    ]
  }
}
```

### Execution
```
1. READ ctf/schema.sql
2. FIND table gentlepulse_user_preferences
3. ALTER TABLE ADD COLUMN theme_preference
4. Insert just before next table definition
5. ADD index on theme_preference
6. VALIDATE SQL syntax → PASS
7. WRITE to ctf/schema.sql

8. READ ctf/docs/developer/ctf-plugin-feature-inventories/ctf-gentlepulse-feature-inventory.md
9. FIND "UI/Styling Features" section
10. UPDATE description to mention dark mode
11. UPDATE last-modified timestamp
12. WRITE to inventory file

13. VALIDATE all changes → PASS
14. MCP.setImplementationStatus(..., status='completed')
15. Feedback #550e... marked as 'resolved'
16. git commit -m "feat: implement feedback #550e... (dark mode)"
```

### Output
```
✅ Schema updated: +1 column to gentlepulse_user_preferences
✅ Inventory updated: UI/Styling Features section
✅ All validations passed
✅ Feedback resolved
✅ Changes committed to git
```

## Error Handling

- **Syntax errors**: Catch, log, mark as 'failed', skip to next item
- **File not found**: Log path, mark as 'failed', skip
- **Validation failed**: Revert changes, mark as 'failed', log details
- **Database locked**: Retry on next cycle
- **Git conflicts**: Log and mark as 'failed', manual intervention required

## Success Criteria

- [x] Agent runs every 10 minutes
- [x] Fetches pending implementations
- [x] Applies all categories of artifact changes
- [x] Validates SQL syntax and YAML structure
- [x] Rolls back on validation failure
- [x] Updates implementation_queue status correctly
- [x] Marks feedback as resolved on completion
- [x] Creates git commits with feedback references
- [x] Handles errors gracefully

## Related Files

- Plan: `/ctf/docs/developer/PM.md`
- MCP Server: `/ctf/packages/pm-mcp-server/src/tools/implementation.ts`
- Matcher Agent: `/ctf/agents/feedback-inventory-matcher.agent.md`
- Schema: `/ctf/schema.sql`
- Contracts: `/ctf/docs/contracts/feedback/`
- Inventories: `/ctf/docs/developer/ctf-plugin-feature-inventories/`
