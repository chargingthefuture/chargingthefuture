# 🚀 Agent Setup: Quick Start

Your agents are now **universally invocable** across Claude Code, GitHub Copilot, and ona.

## What Changed

✅ Created Agent MCP Server (`ctf/packages/agent-mcp-server/`)
✅ Registered in `.vscode/mcp.json`
✅ All agents in `ctf/agents/` are now discoverable

## Setup (3 Steps)

### 1. Build the Agent MCP Server

```bash
cd ctf/packages/agent-mcp-server
pnpm build
```

**Expected output**: `dist/index.js` created

### 2. Verify Registration

Check `.vscode/mcp.json` has:
```json
"agent-mcp-server": {
  "type": "stdio",
  "command": "node",
  "args": ["${workspaceFolder}/ctf/packages/agent-mcp-server/dist/index.js"]
}
```

✅ It's already there if you see it.

### 3. Restart Your Tool

- **Claude Code**: Exit and reopen
- **GitHub Copilot**: Reload VS Code (`Cmd+Shift+P` → "Reload Window")
- **ona**: Restart if it connects to VS Code

## How to Use

### **Invoke Any Agent**

```
@design Implement the latest Replit mockups with pixel-perfect accuracy
@compliance-safety Validate compliance for this change
@testing-release Run all tests before merge
```

**Pattern**: `@[agent-slug] [your task]`

### **List All Agents**

```
/help agents
```

Or look at `ctf/agents/HOW-TO-USE-AGENTS.md` for detailed invocation examples.

### **Run Full Team Review**

```
@meta-orchestrator Run full team review on this PR
```

This invokes multiple agents (design, security, testing, etc.) automatically.

## Troubleshooting

**Agents not showing?**
1. `cd ctf/packages/agent-mcp-server && pnpm build`
2. Restart your tool
3. Check `dist/index.js` exists

**"Agent not found"?**
- Verify agent file exists: `ctf/agents/[agent-name].agent.md`
- Rebuild: `pnpm build` in agent-mcp-server/

**"MCP not registered"?**
- Check `.vscode/mcp.json` has agent-mcp-server entry
- Verify path: `${workspaceFolder}/ctf/packages/agent-mcp-server/dist/index.js`

## Next Steps

- Read `ctf/agents/AGENT-MCP-SETUP.md` for detailed documentation
- See `ctf/agents/HOW-TO-USE-AGENTS.md` for all agent invocation patterns
- Try: `@design Pull the latest design changes from the Replit submodule`

## Architecture

```
Agent Definition Files (.agent.md)
         ↓
Agent MCP Server (discovers + registers)
         ↓
MCP Registry (.vscode/mcp.json)
         ↓
Claude Code / Copilot / ona (invoke via @agent-name)
```

**Why MCP?** It's a universal standard that works across all AI tools — no tool-specific setup needed.

---

For detailed usage, see: `ctf/agents/AGENT-MCP-SETUP.md` and `ctf/agents/HOW-TO-USE-AGENTS.md`
