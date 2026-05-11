#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Discover and parse agents
function discoverAgents() {
  const agentsDir = path.resolve(__dirname, '../../..', 'agents');
  const agents = [];

  if (!fs.existsSync(agentsDir)) {
    console.error(`Agents directory not found: ${agentsDir}`);
    return agents;
  }

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.agent.md'));

  files.forEach((file) => {
    const filePath = path.join(agentsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
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
      invocationExamples,
    });
  });

  return agents;
}

// Initialize
const agents = discoverAgents();

// Create tools
const tools = agents.map((agent) => ({
  name: `invoke_agent_${agent.slug.replace(/-/g, '_')}`,
  description: `Invoke the ${agent.name} agent: ${agent.description}`,
  inputSchema: {
    type: 'object',
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

const server = new Server(
  {
    name: 'agent-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};
  const task = args.task || '';
  const context = args.context || '';

  const slug = toolName.replace('invoke_agent_', '').replace(/_/g, '-');
  const agent = agents.find((a) => a.slug === slug);

  if (!agent) {
    throw new Error(`Agent not found: ${slug}`);
  }

  // Read agent file
  const content = fs.readFileSync(agent.filePath, 'utf-8');
  const fullPrompt = context ? `${context}\n\n${task}` : task;

  return {
    content: [
      {
        type: 'text',
        text: `# Agent: ${agent.name}\n\n${agent.description}\n\n## How to invoke:\n\n@${agent.slug} ${agent.invocationExamples[0]}\n\n## Agent definition:\n\n${content}\n\n## Your request:\n\n${fullPrompt}`,
      },
    ],
  };
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Agent MCP Server started');
