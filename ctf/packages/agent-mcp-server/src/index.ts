import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Tool, ServerCapabilities, Resource } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Agent registry - discovered from ctf/agents/
interface AgentMetadata {
  name: string;
  slug: string;
  description: string;
  filePath: string;
  invocationExamples: string[];
}

const server = new Server(
  {
    name: 'agent-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    } as ServerCapabilities,
  }
);

// Discover and parse agent definitions
function discoverAgents(): AgentMetadata[] {
  const agentsDir = path.resolve(__dirname, '../../..', 'agents');
  const agents: AgentMetadata[] = [];

  if (!fs.existsSync(agentsDir)) {
    console.error(`Agents directory not found: ${agentsDir}`);
    return agents;
  }

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.agent.md'));

  files.forEach((file) => {
    const filePath = path.join(agentsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const slug = file.replace('.agent.md', '');
    const name = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Extract description from first h2 or h3
    const descriptionMatch = content.match(/### Purpose\n\n(.*?)(?=\n###|\n##|$)/s);
    const description = descriptionMatch ? descriptionMatch[1].trim().split('\n')[0] : 'Custom agent';

    // Extract invocation examples
    const examplesMatch = content.match(/### Example Tasks\n\n([\s\S]*?)(?=\n###|\n##|$)/);
    const invocationExamples = examplesMatch
      ? examplesMatch[1]
          .split('\n')
          .filter((line) => line.trim().startsWith('-'))
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter((line) => line.length > 0)
      : ['@' + slug + ' [Your task here]'];

    agents.push({
      name,
      slug,
      description,
      filePath,
      invocationExamples,
    });
  });

  return agents;
}

// Initialize agents
const agents = discoverAgents();

// Create resources for each agent
const resources: Resource[] = agents.map((agent) => ({
  uri: `agent://${agent.slug}`,
  name: agent.name,
  description: agent.description,
  mimeType: 'text/markdown',
}));

// Create tools for invoking agents
const tools: Tool[] = agents.map((agent) => ({
  name: `invoke_agent_${agent.slug.replace(/-/g, '_')}`,
  description: `Invoke the ${agent.name} agent: ${agent.description}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      task: {
        type: 'string',
        description: 'The task or prompt to send to the agent',
      },
      context: {
        type: 'string',
        description: 'Optional context or background information for the agent',
      },
    },
    required: ['task'],
  },
}));

// Register resource handler
server.setRequestHandler(
  { method: 'resources/list' },
  async () => ({
    resources,
  })
);

server.setRequestHandler(
  { method: 'resources/read' },
  async (request: any) => {
    const slug = request.params.uri.replace('agent://', '');
    const agent = agents.find((a) => a.slug === slug);

    if (!agent) {
      throw new Error(`Agent not found: ${slug}`);
    }

    const content = fs.readFileSync(agent.filePath, 'utf-8');
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  }
);

// Register tool handlers
server.setRequestHandler(
  { method: 'tools/list' },
  async () => ({
    tools,
  })
);

server.setRequestHandler(
  { method: 'tools/call' },
  async (request: any) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};
    const task = args.task || '';
    const context = args.context || '';

    // Extract agent slug from tool name
    const slug = toolName.replace('invoke_agent_', '').replace(/_/g, '-');
    const agent = agents.find((a) => a.slug === slug);

    if (!agent) {
      throw new Error(`Agent not found: ${slug}`);
    }

    // Return agent invocation instruction
    const fullPrompt = context ? `${context}\n\n${task}` : task;

    return {
      content: [
        {
          type: 'text' as const,
          text: `To invoke @${agent.slug}, use one of these patterns:\n\n${agent.invocationExamples.map((ex) => `@${agent.slug} ${ex}`).join('\n')}\n\nYour task:\n${fullPrompt}`,
        },
      ],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Agent MCP Server started');
