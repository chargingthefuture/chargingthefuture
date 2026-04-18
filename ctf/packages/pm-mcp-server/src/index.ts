import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Tool, TextContent, ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { initializeDb, closeDb } from './db.js';
import * as feedbackTools from './tools/feedback.js';
import * as implementationTools from './tools/implementation.js';

type ToolRequest = {
  name: string;
  arguments: Record<string, any>;
};

const server = new Server(
  {
    name: 'pm-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    } as ServerCapabilities,
  }
);

// Define MCP Tools
const tools: Tool[] = [
  {
    name: 'listFeedback',
    description: 'List feedback items with optional filtering by status, type, category, or priority',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['new', 'triaged', 'matched_to_inventory', 'approval_pending', 'approved', 'linked_to_task', 'resolved', 'dismissed'],
          description: 'Filter by status',
        },
        type: {
          type: 'string',
          enum: ['bug_report', 'feature_request', 'general', 'satisfaction'],
          description: 'Filter by feedback type',
        },
        category: {
          type: 'string',
          description: 'Filter by category (plugin name)',
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Filter by priority',
        },
        page: {
          type: 'number',
          description: 'Page number (default 1)',
        },
        pageSize: {
          type: 'number',
          description: 'Items per page (default 20)',
        },
      },
    },
  },
  {
    name: 'triageFeedback',
    description: 'Update feedback priority, category, and status',
    inputSchema: {
      type: 'object' as const,
      properties: {
        feedbackId: {
          type: 'string',
          description: 'UUID of feedback item',
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        category: {
          type: 'string',
        },
        status: {
          type: 'string',
          enum: ['triaged', 'matched_to_inventory', 'approval_pending', 'approved', 'linked_to_task', 'resolved', 'dismissed'],
        },
      },
      required: ['feedbackId'],
    },
  },
  {
    name: 'createInventoryMatch',
    description: 'Create a match between feedback and a plugin inventory (called by matcher agent)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        feedbackId: {
          type: 'string',
          description: 'UUID of feedback item',
        },
        inventoryFilePath: {
          type: 'string',
          description: 'Path to inventory file (e.g., ctf-feed-feature-inventory.md)',
        },
        matchConfidence: {
          type: 'number',
          description: 'Confidence score 0-1',
        },
        suggestedUpdates: {
          type: 'object',
          description: 'Proposed artifact changes',
        },
        matcherReasoning: {
          type: 'string',
          description: 'Why this match was made',
        },
      },
      required: ['feedbackId', 'inventoryFilePath', 'matchConfidence', 'suggestedUpdates'],
    },
  },
  {
    name: 'getApprovalQueue',
    description: 'Get pending approvals awaiting human review',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'modified'],
        },
        page: {
          type: 'number',
        },
        pageSize: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'approveMatch',
    description: 'Approve a feedback-to-inventory match and proposed artifact changes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        approvalId: {
          type: 'string',
          description: 'UUID of approval queue entry',
        },
        approverId: {
          type: 'string',
          description: 'Auth provider user ID of approver',
        },
        approverFeedback: {
          type: 'string',
          description: 'Optional feedback from approver',
        },
        approvedArtifactChanges: {
          type: 'object',
          description: 'If different from suggested, modified artifact changes',
        },
      },
      required: ['approvalId', 'approverId'],
    },
  },
  {
    name: 'rejectMatch',
    description: 'Reject a feedback-to-inventory match proposal',
    inputSchema: {
      type: 'object' as const,
      properties: {
        approvalId: {
          type: 'string',
        },
        approverId: {
          type: 'string',
        },
        rejectionReason: {
          type: 'string',
        },
      },
      required: ['approvalId', 'approverId', 'rejectionReason'],
    },
  },
  {
    name: 'getImplementationQueue',
    description: 'Get pending implementations awaiting code agent execution',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
        },
        page: {
          type: 'number',
        },
        pageSize: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'setImplementationStatus',
    description: 'Update implementation status with logs (called by implementation agent)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        implementationId: {
          type: 'string',
        },
        status: {
          type: 'string',
          enum: ['in_progress', 'completed', 'failed'],
        },
        implementationAgentId: {
          type: 'string',
        },
        implementationLog: {
          type: 'string',
        },
      },
      required: ['implementationId', 'status'],
    },
  },
];

// Register tools

// Use the correct string key for the handler registration
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  interface RpcRequestParams {
    name: string;
    arguments?: Record<string, unknown>;
  }
  const params = request.params as RpcRequestParams;
  const { name, arguments: args = {} } = params;

  try {
    let result:
      | Awaited<ReturnType<typeof feedbackTools.listFeedback>>
      | Awaited<ReturnType<typeof feedbackTools.triageFeedback>>
      | Awaited<ReturnType<typeof feedbackTools.createInventoryMatch>>
      | Awaited<ReturnType<typeof feedbackTools.getApprovalQueue>>
      | Awaited<ReturnType<typeof feedbackTools.approveMatch>>
      | Awaited<ReturnType<typeof feedbackTools.rejectMatch>>
      | Awaited<ReturnType<typeof implementationTools.getImplementationQueue>>
      | Awaited<ReturnType<typeof implementationTools.setImplementationStatus>>;

    switch (name) {
      case 'listFeedback':
        result = await feedbackTools.listFeedback(
          args.status,
          args.type,
          args.category,
          args.priority,
          args.page || 1,
          args.pageSize || 20
        );
        break;

      case 'triageFeedback':
        result = await feedbackTools.triageFeedback(
          args.feedbackId,
          args.priority,
          args.category,
          args.status
        );
        break;

      case 'createInventoryMatch':
        result = await feedbackTools.createInventoryMatch(
          args.feedbackId,
          args.inventoryFilePath,
          args.matchConfidence,
          args.suggestedUpdates,
          args.matcherReasoning
        );
        break;

      case 'getApprovalQueue':
        result = await feedbackTools.getApprovalQueue(
          args.status,
          args.page || 1,
          args.pageSize || 20
        );
        break;

      case 'approveMatch':
        result = await feedbackTools.approveMatch(
          args.approvalId,
          args.approverId,
          args.approverFeedback,
          args.approvedArtifactChanges
        );
        break;

      case 'rejectMatch':
        result = await feedbackTools.rejectMatch(
          args.approvalId,
          args.approverId,
          args.rejectionReason
        );
        break;

      case 'getImplementationQueue':
        result = await implementationTools.getImplementationQueue(
          args.status,
          args.page || 1,
          args.pageSize || 20
        );
        break;

      case 'setImplementationStatus':
        result = await implementationTools.setImplementationStatus(
          args.implementationId,
          args.status,
          args.implementationAgentId,
          args.implementationLog
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// List tools

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

async function main() {
  try {
    await initializeDb();
    console.error('[PM MCP] Database initialized');

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[PM MCP] Server started and listening on stdio');
  } catch (error) {
    console.error('[PM MCP] Fatal error:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});

main();
