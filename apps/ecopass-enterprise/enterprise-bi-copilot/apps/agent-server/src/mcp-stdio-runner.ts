// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: MCP STDIO RUNNER
// Connects EnterpriseMcpServer to StdioServerTransport for CLI / MCP Clients
// =============================================================================

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { EnterpriseMcpServer } from './enterprise-mcp-server.js';

async function main() {
  const mcpServer = new EnterpriseMcpServer();
  const transport = new StdioServerTransport();

  await mcpServer.getRawServer().connect(transport);
  console.error('[EnterpriseMcpServer] Connected via Stdio transport. Ready for MCP requests.');
}

main().catch((err) => {
  console.error('[EnterpriseMcpServer] Fatal startup error:', err);
  process.exit(1);
});
