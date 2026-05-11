#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AgentMetadata {
  name: string;
  slug: string;
  description: string;
  filePath: string;
  content: string;
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
    },
  }
);

async function discoverAgents(): Promise<AgentMetadata[]> {
  const agentsDir = path.resolve(__dirname, '../../..', 'agents');
  const agents: AgentMetadata[] = [];

  if (!fs.existsSync(agentsDir)) {
    console.error(`Agents directory not found: ${agentsDir}`);
    return agents;
  }

  const files = (await fs.promises.readdir(agentsDir)).filter((f) => f.endsWith('.agent.md'));

  for (const file of files) {
    const filePath = path.join(agentsDir, file);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const slug = file.replace('.agent.md', '');
    const name = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const descriptionMatch = content.match(/### Purpose\n\n(.*?)(?=\n###|\n##|$)/s);
    const description = descriptionMatch ? descriptionMatch[1].trim().split('\n')[0] : 'Custom agent';

    const examplesMatch = content.match(/### Example Tasks\n\n([\s\S]*?)(?=\n###|\n##|$)/);
    const invocationExamples = examplesMatch
      ? examplesMatch[1]
          .split('\n')
          .filter((line) => line.trim().startsWith('-'))
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter((line) => line.length > 0)
      : ['[Your task here]'];

    agents.push({
      name,
      slug,
      description,
      filePath,
      content,
      invocationExamples,
    });
  }

  return agents;
}

// Initialize agents
let agents: AgentMetadata[] = [];

// Create tools
function getTools() {
  return agents.map((agent) => ({
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
          description: 'Optional context or background information',
        },
      },
      required: ['task'],
    },
  }));
}

// Create resources
function getResources() {
  return agents.map((agent) => ({
    uri: `agent://${agent.slug}`,
    name: agent.name,
    description: agent.description,
    mimeType: 'text/markdown' as const,
  }));
}

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: getResources(),
}));

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const slug = request.params.uri.replace('agent://', '');
  const agent = agents.find((a) => a.slug === slug);

  if (!agent) {
    throw new Error(`Agent not found: ${slug}`);
  }

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: 'text/markdown' as const,
        text: agent.content,
      },
    ],
  };
});

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getTools(),
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = (request.params.arguments as { task?: string; context?: string }) || {};
  const task = args.task || '';
  const context = args.context || '';

  const slug = toolName.replace('invoke_agent_', '').replace(/_/g, '-');
  const agent = agents.find((a) => a.slug === slug);

  if (!agent) {
    throw new Error(`Agent not found: ${slug}`);
  }

  const fullPrompt = context ? `${context}\n\n${task}` : task;

  return {
    content: [
      {
        type: 'text' as const,
        text: `# Agent: ${agent.name}\n\n${agent.description}\n\n## How to invoke:\n\n@${agent.slug} ${agent.invocationExamples[0]}\n\n## Agent definition:\n\n${agent.content}\n\n## Your request:\n\n${fullPrompt}`,
      },
    ],
  };
});

// Start server
async function main() {
  agents = await discoverAgents();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start agent MCP server:', error);
  process.exit(1);
});
