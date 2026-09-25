// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: HTTP/REST & SSE API SERVER (PORT 4000)
// =============================================================================

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { McpQueryEngine } from './mcp-query-engine.js';
import { IntentQueryPlanner } from './intent-planner.js';
import { AuthResolver } from './auth.js';
import { handleCopilotKit } from './copilot-handler.js';
import { globalEnterpriseMcpServer, ENTERPRISE_MCP_TOOLS } from './enterprise-mcp-server.js';
import { createOmnichannelRouter } from './omnichannel-router.js';
import path from 'node:path';
import fs from 'node:fs';
import { EnterpriseDiagramEngine } from '@enterprise/diagram-engine';
import { CopilotLlmEngine } from './llm-provider.js';
import type {
  ExecutionRawData,
  RenderDashboardChartActionPayload,
  HealthCheckResponse,
  DiagnosticErrorEnvelope
} from './types.js';

export function createApp(): express.Express {
  const app = express();

  // 1. CORS Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-Role, X-Department-Id, X-Department-Code, X-User-Id, X-User-Email, x-copilotcloud-public-api-key'
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // 2. Body Parser Middleware
  app.use(express.json({ limit: '10mb' }));

  // 3. Endpoint: GET /api/health
  app.get('/api/health', async (_req: Request, res: Response) => {
    const health = await McpQueryEngine.healthCheck();
    if (health.healthy) {
      const response: HealthCheckResponse = {
        status: 'HEALTHY',
        database: 'CONNECTED',
        port: health.port,
        timestamp: new Date().toISOString(),
        details: {
          database: health.database || 'enterprise_dwh',
          version: health.version,
          host: process.env.PGHOST || '127.0.0.1'
        }
      };
      res.status(200).json(response);
    } else {
      const response: HealthCheckResponse = {
        status: 'UNHEALTHY',
        database: 'DISCONNECTED',
        port: health.port,
        timestamp: new Date().toISOString(),
        error: health.error
      };
      res.status(503).json(response);
    }
  });

  // 4. Endpoint: POST /api/query
  app.post('/api/query', async (req: Request, res: Response) => {
    const correlationId = `REQ-${Date.now()}`;

    // A. Authentication & Identity Verification
    const auth = AuthResolver.resolve(req.headers as any, req.body);
    if (!auth.authenticated || !auth.context) {
      const errorResponse: DiagnosticErrorEnvelope = {
        success: false,
        errorCode: 'AUTH_FAILED',
        message: auth.error || 'Authentication required: Missing or invalid Bearer token / role',
        timestamp: new Date().toISOString(),
        correlationId
      };
      res.status(401).json(errorResponse);
      return;
    }

    // B. Query Extraction
    const rawQuery = req.body?.query || req.body?.sql;
    if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      const errorResponse: DiagnosticErrorEnvelope = {
        success: false,
        errorCode: 'SECURITY_VIOLATION',
        message: 'Empty query is strictly forbidden',
        timestamp: new Date().toISOString(),
        correlationId
      };
      res.status(400).json(errorResponse);
      return;
    }

    // C. Intent & Query Planning
    const plan = IntentQueryPlanner.plan(rawQuery, auth.context);

    // D. Direct Execution via McpQueryEngine (Protected by AST Security & RLS)
    const result = await McpQueryEngine.executeQuery({
      sql: plan.plannedSql,
      securityContext: auth.context,
      chartConfig: plan.chartConfig
    });

    // E. Error Gatekeeper (Fail-Fast)
    if ('success' in result && result.success === false) {
      const errorResult = result as DiagnosticErrorEnvelope;
      if (errorResult.errorCode === 'SECURITY_VIOLATION') {
        res.status(400).json(errorResult);
        return;
      }
      if (errorResult.errorCode === 'CONNECTION_REFUSED') {
        res.status(503).json(errorResult);
        return;
      }
      res.status(400).json(errorResult);
      return;
    }

    // F. Format Action render_dashboard_chart Output Payload
    const rawData = result as ExecutionRawData;
    const actionPayload: RenderDashboardChartActionPayload = {
      action: 'render_dashboard_chart',
      chartConfig: rawData.chartConfig || plan.chartConfig,
      records: rawData.records,
      audit: rawData.audit,
      status: rawData.status,
      data: rawData
    };

    res.status(200).json(actionPayload);
  });

  // 5. Endpoint: POST & GET /api/copilotkit
  app.use('/api/copilotkit', async (req: Request, res: Response) => {
    await handleCopilotKit(req, res);
  });

  // 6. Endpoint: GET /api/mcp/tools (MCP Protocol Specification)
  app.get('/api/mcp/tools', async (_req: Request, res: Response) => {
    res.status(200).json({
      protocol: 'modelcontextprotocol',
      version: '1.0.0',
      server: 'enterprise-bi-mcp-server',
      tools: ENTERPRISE_MCP_TOOLS
    });
  });

  // 7. Endpoint: POST /api/mcp/call (Execute MCP Tool)
  app.post('/api/mcp/call', async (req: Request, res: Response) => {
    const { name, arguments: args } = req.body || {};
    if (!name) {
      res.status(400).json({ error: 'Missing tool name' });
      return;
    }
    try {
      const result = await globalEnterpriseMcpServer.executeToolCall(name, args || {});
      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Endpoint: GET /api/mcp/status (MCP Server Health)
  app.get('/api/mcp/status', async (_req: Request, res: Response) => {
    const health = await McpQueryEngine.healthCheck();
    res.status(200).json({
      status: health.healthy ? 'CONNECTED' : 'DEGRADED',
      protocol: 'mcp-v1',
      toolsCount: ENTERPRISE_MCP_TOOLS.length,
      tools: ENTERPRISE_MCP_TOOLS.map(t => t.name),
      database: {
        status: health.healthy ? 'UP' : 'DOWN',
        port: health.port || 5435
      },
      excelConnector: {
        status: 'READY',
        file: '/home/chinhan/enterprise-bi-copilot/data/KeHoach_NganSach_Q3_2026.xlsx'
      }
    });
  });

  // 6. Omnichannel & Human-in-the-loop Ingress Gateway
  const llmEngine = new CopilotLlmEngine();
  app.use('/api/omnichannel', createOmnichannelRouter(llmEngine));

  // 7. Static Storage for Enterprise Diagrams
  const storageCandidates = [
    path.resolve('/home/chinhan/enterprise-bi-copilot/apps/agent-server/storage/diagrams'),
    path.resolve(process.cwd(), 'apps/agent-server/storage/diagrams'),
    path.resolve(process.cwd(), 'storage/diagrams')
  ];
  const storageDir = storageCandidates.find(d => fs.existsSync(d)) || storageCandidates[0];
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  app.use('/diagrams', express.static(storageDir));

  // 8. Diagram Engine Endpoints
  app.get('/api/diagrams/templates', async (_req: Request, res: Response) => {
    const templates = await EnterpriseDiagramEngine.listTemplates();
    res.status(200).json({ templates });
  });

  app.get('/api/diagrams/categories', async (_req: Request, res: Response) => {
    const categories = await EnterpriseDiagramEngine.listCategories();
    res.status(200).json({ categories });
  });

  app.get('/api/diagrams/health', async (_req: Request, res: Response) => {
    const health = await EnterpriseDiagramEngine.health();
    res.status(200).json(health);
  });

  app.post('/api/diagrams/detect-intent', async (req: Request, res: Response) => {
    const { prompt, template_id, aspect_ratio } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }
    const result = await EnterpriseDiagramEngine.detectIntent(prompt, template_id, aspect_ratio);
    res.status(result.success ? 200 : 500).json(result);
  });

  app.post('/api/diagrams/generate', async (req: Request, res: Response) => {
    const { prompt, template_id, aspect_ratio } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }
    const result = await EnterpriseDiagramEngine.generateDiagram({
      prompt,
      template_id,
      aspect_ratio
    });
    res.status(result.success ? 200 : 500).json(result);
  });

  return app;
}

export function startServer(port: number = parseInt(process.env.PORT || '4000', 10)) {
  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`[Enterprise Copilot Server] Listening on http://localhost:${port}`);
    console.log(`  - Healthcheck : http://localhost:${port}/api/health`);
    console.log(`  - Query Engine: http://localhost:${port}/api/query`);
    console.log(`  - CopilotKit  : http://localhost:${port}/api/copilotkit`);
    console.log(`  - Omnichannel : http://localhost:${port}/api/omnichannel`);

    // Quét sạch ngay các session rác mồ côi từ CLI khi khởi động
    EnterpriseDiagramEngine.autoPurgeSessions().catch(() => {});
  });

  // Chạy ngầm định kỳ mỗi 30 giây để quét sạch mọi session rác / tạm thời
  const sweepInterval = setInterval(() => {
    EnterpriseDiagramEngine.autoPurgeSessions().catch(() => {});
  }, 30000);

  const shutdown = async () => {
    console.log('\n[Enterprise Copilot Server] Shutting down gracefully...');
    clearInterval(sweepInterval);
    server.close();
    await McpQueryEngine.closePools();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Auto-start server if executed directly
const isDirectExecution =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server.ts'));

if (isDirectExecution) {
  startServer();
}
