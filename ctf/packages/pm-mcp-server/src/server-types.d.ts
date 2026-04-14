// This file is a stub for the type signature of Server.setRequestHandler from @modelcontextprotocol/sdk/server/index.js
// Please update this file with the actual type signature if available from the SDK.

export type ToolRequest = {
  name: string;
  arguments: Record<string, any>;
};

export type ToolCallHandler = (request: { params: ToolRequest }) => Promise<any>;

export class Server {
  setRequestHandler(type: string, handler: ToolCallHandler): void {}
}
