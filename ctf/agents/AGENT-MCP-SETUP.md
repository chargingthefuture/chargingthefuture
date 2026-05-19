# Agent MCP Server Setup (Universal Solution)

## Overview

Your agents are now discoverable and invocable across **Claude Code**, **GitHub Copilot**, and **ona** via the unified **Agent MCP Server**.

**What changed:**
- Agent definitions in `ctf/agents/*.agent.md` are now registered as MCP resources
- Each agent is exposed as an invocable tool via the MCP protocol
- Works universally across all AI tools that support MCP (no tool-specific configuration needed)

---

## Architecture

```
ctf/agents/*.agent.md          ← Agent definition files (markdown)
         ↓
ctf/packages/agent-mcp-server/ ← MCP server that discovers + registers agents
         ↓
.vscode/mcp.json               ← VS Code MCP registry (finds the server)
         ↓
Claude Code / Copilot / ona    ← Invoke agents via @agent-name syntax
```

---

## Setup Instructions

### 1. **Build the Agent MCP Server**

```bash
cd ctf/packages/agent-mcp-server
pnpm install
pnpm build
```

**Output**: Compiled server at `ctf/packages/agent-mcp-server/dist/index.js`

### 2. **Verify MCP Registration**

Check that `.vscode/mcp.json` includes:

```json
{
  "servers": {
    "agent-mcp-server": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/ctf/packages/agent-mcp-server/dist/index.js"]
    }
  }
}
```

### 3. **Restart Your IDE / AI Tool**

After build + MCP registration, restart:
- **Claude Code**: Exit and reopen
- **GitHub Copilot**: Reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window")
- **ona**: Restart the tool if it connects to VS Code

### 4. **Verify Discovery**

Test that agents are discoverable:

#### In Claude Code:
```bash
/help agents
```

Or just start typing `@` and look for agent suggestions.

#### In GitHub Copilot:
Mention `@` in a comment or prompt — Copilot should suggest agents.

#### In ona:
Check the agent registry or docs for how ona discovers MCP resources.

---

## How to Invoke Agents

### **Pattern 1: Direct Agent Invocation**

```
@design Implement the latest Replit mockups with pixel-perfect accuracy in [component name]
```

**Breakdown:**
- `@design` — Agent slug from `design.agent.md`
- `Implement the latest...` — Your task (matches agent's capabilities)

### **Pattern 2: Via Claude Code Skill**

If the agent is registered as a Skill in Claude Code:

```
/design Implement the latest Replit mockups with pixel-perfect accuracy in [component name]
```

### **Pattern 3: Full Team Review (Orchestrator)**

Invoke multiple agents at once via Meta-Orchestrator:

```
@meta-orchestrator Run full team review on this PR
```

---

## Available Agents

All agents in `ctf/agents/*.agent.md` are automatically discovered. Current list:

| Agent | Slug | Purpose |
|-------|------|---------|
| Meta Orchestrator | `meta-orchestrator` | Full team review before merge/deploy |
| Architecture Coding | `architecture-coding` | Code quality and maintainability |
| Brand Voice | `brand-voice` | UI copy and documentation compliance |
| Compliance Safety | `compliance-safety` | Legal and safety validation |
| **Design & Mockups** | **`design`** | Pixel-perfect UI implementation |
| Deployment Topology | `deployment-topology` | Deployment configuration |
| Environment Auth | `environment-auth` | Secrets and environment setup |
| Metrics Data Integrity | `metrics-data-integrity` | Metric changes and economic data correctness |
| Monorepo Boundary | `monorepo-boundary` | Cross-boundary violations |
| Observability Incident | `observability-incident` | Error monitoring and incidents |
| Plugin Lifecycle | `plugin-lifecycle` | Feature and plugin management |
| Security Dependency | `security-dependency` | Vulnerability scanning |
| Testing Release | `testing-release` | Test execution and CI/CD |

For detailed invocation examples, see `HOW-TO-USE-AGENTS.md` or read the agent file directly: `ctf/agents/[agent-name].agent.md`

---

## Troubleshooting

### **Agents Not Showing Up**

1. **Build not complete?**
   ```bash
   cd ctf/packages/agent-mcp-server
   pnpm build
   ```

2. **MCP not registered?**
   - Verify `.vscode/mcp.json` has the agent-mcp-server entry
   - Check file exists: `ctf/packages/agent-mcp-server/dist/index.js`

3. **IDE cache?**
   - Restart your tool completely (exit + reopen)
   - Clear any AI tool caches if available

### **"Agent Not Found" Error**

- Check agent file exists: `ctf/agents/[agent-slug].agent.md`
- Verify filename matches the agent slug (e.g., `design.agent.md` for `@design`)
- Run discovery again: rebuild agent-mcp-server

### **Tool-Specific Issues**

**Claude Code:**
- Use `/help agents` to list available agents
- Check Claude Code settings → MCP servers are enabled

**GitHub Copilot:**
- Ensure VS Code MCP integration is enabled (Copilot settings)
- Try reloading VS Code

**ona:**
- Check ona documentation for MCP resource discovery
- May need to configure MCP server URL separately in ona config

---

## Adding New Agents

To add a new agent to the registry:

1. **Create agent definition file:**
   ```bash
   touch ctf/agents/my-agent.agent.md
   ```

2. **Use this template:**
   ```markdown
   ## My Agent Name

   ### Purpose
   Brief description of what this agent does.

   ### Responsibilities
   - Bullet list of responsibilities
   - More details here

   ### Example Tasks
   - Example task 1
   - Example task 2
   - Example task 3
   ```

3. **Rebuild the MCP server:**
   ```bash
   cd ctf/packages/agent-mcp-server
   pnpm build
   ```

4. **Restart your IDE**

5. **Invoke the new agent:**
   ```
   @my-agent Your task here
   ```

The MCP server automatically discovers new agent files on rebuild.

---

## Integration with CI/CD

The agent-mcp-server build is part of your standard build process:

```bash
pnpm -r build
```

This ensures agents stay in sync across environments (local, CI, Codespaces, etc.).

---

## Why MCP?

The Model Context Protocol (MCP) is a **universal standard** for AI tool integration:

✅ Works with Claude Code
✅ Works with GitHub Copilot
✅ Works with ona (if MCP-compliant)
✅ Works with any future AI tools that support MCP
✅ No tool-specific configuration needed
✅ Version-controlled (agents defined in git)
✅ Discoverable at runtime (no manual registry updates)

This approach ensures you have **one source of truth** for your agents, no matter which tool you use.

---

## Reference

- **Agent MCP Server**: `ctf/packages/agent-mcp-server/`
- **MCP Registry**: `.vscode/mcp.json`
- **Agent Definitions**: `ctf/agents/*.agent.md`
- **MCP Spec**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Usage Guide**: `ctf/agents/HOW-TO-USE-AGENTS.md`
