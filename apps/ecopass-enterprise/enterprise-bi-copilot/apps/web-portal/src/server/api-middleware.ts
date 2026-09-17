// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: BACKEND API MIDDLEWARE
// Zero-Mock Discipline: Direct Real PostgreSQL with SHA-256 Checksums
// =============================================================================

import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as agentServerModule from '@enterprise/agent-server';
const McpQueryEngine = (agentServerModule as any).McpQueryEngine || (agentServerModule as any).default?.McpQueryEngine;
const CopilotLlmEngine = (agentServerModule as any).CopilotLlmEngine || (agentServerModule as any).default?.CopilotLlmEngine;
const globalEnterpriseMcpServer = (agentServerModule as any).globalEnterpriseMcpServer || (agentServerModule as any).default?.globalEnterpriseMcpServer;
const ENTERPRISE_MCP_TOOLS = (agentServerModule as any).ENTERPRISE_MCP_TOOLS || (agentServerModule as any).default?.ENTERPRISE_MCP_TOOLS;
import type {
  ActorSecurityContext,
  ExecutionRawData,
  DiagnosticErrorEnvelope
} from '@enterprise/shared-types';

export interface ApiQueryRequestBody {
  queryType?: 'trend' | 'departments' | 'transactions' | 'kpis' | 'custom';
  sql?: string;
  securityContext?: Partial<ActorSecurityContext>;
}

const DEFAULT_EXECUTIVE_CONTEXT: ActorSecurityContext = {
  userId: 'USR-CFO-001',
  userEmail: 'cfo@enterprise.vn',
  role: 'executive',
  sessionToken: 'jwt-session-csuite-verified'
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role',
  });
  res.end(JSON.stringify(data));
}

const expressApp = (agentServerModule as any).createApp ? (agentServerModule as any).createApp() : null;

export function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Forward omnichannel and diagram endpoints to active agent-server or local expressApp
    if (pathname.startsWith('/api/omnichannel') || pathname.startsWith('/api/diagrams')) {
      try {
        const targetUrl = `http://127.0.0.1:4000${req.url}`;
        const method = req.method || 'GET';
        const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : undefined;
        const fRes = await fetch(targetUrl, {
          method,
          headers: {
            'Content-Type': (req.headers['content-type'] as string) || 'application/json',
            ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
          },
          body
        });
        const fData = await fRes.text();
        res.writeHead(fRes.status, {
          'Content-Type': fRes.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(fData);
        return;
      } catch {
        if (expressApp) {
          expressApp(req, res);
          return;
        }
      }
    }

    // Forward /diagrams static requests or serve directly from storage
    if (pathname.startsWith('/diagrams/')) {
      const filename = path.basename(pathname);
      const candidates = [
        path.resolve('/home/chinhan/enterprise-bi-copilot/apps/agent-server/storage/diagrams', filename),
        path.resolve(process.cwd(), '../agent-server/storage/diagrams', filename),
        path.resolve(process.cwd(), 'apps/agent-server/storage/diagrams', filename),
        path.resolve(process.cwd(), 'storage/diagrams', filename)
      ];
      const filePath = candidates.find(p => fs.existsSync(p));
      if (filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
        const fileStream = fs.createReadStream(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        fileStream.pipe(res);
        return;
      }
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role',
      });
      res.end();
      return;
    }

    // Health check endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      try {
        const ping = await McpQueryEngine.executeQuery({
          sql: 'SELECT 1 as ping',
          securityContext: DEFAULT_EXECUTIVE_CONTEXT
        });
        if ('records' in ping) {
          return sendJson(res, 200, {
            status: 'UP',
            database: 'connected',
            dataSource: 'postgresql_replica',
            port: process.env.PGPORT || 5435,
            timestamp: new Date().toISOString()
          });
        } else {
          return sendJson(res, 503, {
            status: 'DOWN',
            error: ping
          });
        }
      } catch (err: any) {
        return sendJson(res, 503, {
          status: 'DOWN',
          error: err.message
        });
      }
    }

    // MCP Protocol Endpoints (Model Context Protocol v1.x)
    if (pathname === '/api/mcp/tools' && req.method === 'GET') {
      return sendJson(res, 200, {
        protocol: 'modelcontextprotocol',
        version: '1.0.0',
        server: 'enterprise-bi-mcp-server',
        tools: ENTERPRISE_MCP_TOOLS || []
      });
    }

    if (pathname === '/api/mcp/status' && req.method === 'GET') {
      try {
        const ping = await McpQueryEngine.executeQuery({
          sql: 'SELECT 1 as ping',
          securityContext: DEFAULT_EXECUTIVE_CONTEXT
        });
        const isUp = 'records' in ping;
        return sendJson(res, 200, {
          status: isUp ? 'CONNECTED' : 'DEGRADED',
          protocol: 'mcp-v1',
          toolsCount: (ENTERPRISE_MCP_TOOLS || []).length,
          tools: (ENTERPRISE_MCP_TOOLS || []).map((t: any) => t.name),
          database: {
            status: isUp ? 'UP' : 'DOWN',
            port: process.env.PGPORT || 5435
          },
          excelConnector: {
            status: 'READY',
            file: '/home/chinhan/enterprise-bi-copilot/data/KeHoach_NganSach_Q3_2026.xlsx'
          }
        });
      } catch (err: any) {
        return sendJson(res, 500, { status: 'ERROR', error: err.message });
      }
    }

    if (pathname === '/api/mcp/schema' && req.method === 'GET') {
      try {
        if (globalEnterpriseMcpServer) {
          const schema = await globalEnterpriseMcpServer.inspectSchema('public');
          return sendJson(res, 200, { status: 'SUCCESS', schema });
        }
        return sendJson(res, 503, { error: 'MCP Server not initialized' });
      } catch (err: any) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    if (pathname === '/api/mcp/call' && req.method === 'POST') {
      try {
        const rawBody = await readBody(req);
        const { name, arguments: args } = rawBody ? JSON.parse(rawBody) : {};
        if (!name) {
          return sendJson(res, 400, { error: 'Missing tool name' });
        }
        if (globalEnterpriseMcpServer) {
          const result = await globalEnterpriseMcpServer.executeToolCall(name, args || {});
          return sendJson(res, 200, result);
        }
        return sendJson(res, 503, { error: 'MCP Server not initialized' });
      } catch (err: any) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // Zero-Mock Query Engine endpoint
    if (pathname === '/api/query' && req.method === 'POST') {
      try {
        const rawBody = await readBody(req);
        const parsed: ApiQueryRequestBody = rawBody ? JSON.parse(rawBody) : {};
        
        const securityContext: ActorSecurityContext = {
          ...DEFAULT_EXECUTIVE_CONTEXT,
          ...(parsed.securityContext || {})
        };

        let sql = '';
        if (parsed.queryType === 'trend') {
          sql = `
            SELECT 
              transaction_date, 
              total_deals, 
              total_contract_value, 
              total_discounts, 
              total_net_revenue, 
              total_cogs, 
              total_gross_profit, 
              gross_margin_pct 
            FROM v_daily_revenue_trend 
            ORDER BY transaction_date ASC;
          `;
        } else if (parsed.queryType === 'departments') {
          sql = `
            SELECT 
              dept_code, 
              dept_name, 
              actual_revenue, 
              target_revenue, 
              variance_amount, 
              target_achievement_pct 
            FROM v_department_performance_q3 
            ORDER BY actual_revenue DESC;
          `;
        } else if (parsed.queryType === 'transactions') {
          sql = `
            SELECT 
              t.id, 
              t.transaction_code, 
              t.transaction_date, 
              d.name as department_name,
              d.code as department_code,
              t.client_name, 
              t.product_category, 
              t.contract_value, 
              t.discount_amount, 
              t.net_revenue, 
              t.cogs_amount, 
              t.gross_profit, 
              t.payment_status 
            FROM revenue_transactions t
            LEFT JOIN departments d ON t.department_id = d.id
            ORDER BY t.transaction_date DESC;
          `;
        } else if (parsed.queryType === 'kpis') {
          sql = `
            SELECT 
              COUNT(t.id) as total_deals,
              SUM(t.contract_value) as total_contract_value,
              SUM(t.discount_amount) as total_discounts,
              SUM(t.net_revenue) as total_net_revenue,
              SUM(t.cogs_amount) as total_cogs,
              SUM(t.gross_profit) as total_gross_profit,
              ROUND((SUM(t.gross_profit) / NULLIF(SUM(t.net_revenue), 0) * 100), 2) as avg_gross_margin_pct,
              (SELECT COALESCE(SUM(target_revenue), 0) FROM monthly_budgets WHERE fiscal_year = 2026 AND fiscal_month = 9) as target_revenue
            FROM revenue_transactions t
            WHERE t.payment_status IN ('PAID', 'PENDING') AND EXTRACT(MONTH FROM t.transaction_date) = 9;
          `;
        } else if (parsed.sql) {
          sql = parsed.sql;
        } else {
          return sendJson(res, 400, {
            success: false,
            errorCode: 'INVALID_REQUEST',
            message: 'queryType or sql parameter is required',
            timestamp: new Date().toISOString(),
            correlationId: `ERR-${Date.now()}`
          });
        }

        // Execute query through deterministic Zero-Mock McpQueryEngine
        const queryResult = await McpQueryEngine.executeQuery({
          sql,
          securityContext
        });

        // If technical error occurred (e.g. CONNECTION_REFUSED, SECURITY_VIOLATION):
        if ('errorCode' in queryResult) {
          // Send transparent technical failure envelope, no mock data fallback!
          return sendJson(res, 503, queryResult);
        }

        return sendJson(res, 200, queryResult);
      } catch (err: any) {
        return sendJson(res, 500, {
          success: false,
          errorCode: 'INTERNAL_SERVER_ERROR',
          message: err.message,
          timestamp: new Date().toISOString(),
          correlationId: `SYS-${Date.now()}`
        } as DiagnosticErrorEnvelope);
      }
    }

    // CopilotKit Runtime Endpoint for executive intelligence
    if (pathname.startsWith('/api/copilotkit')) {
      if (req.method === 'GET' || pathname === '/api/copilotkit/info') {
        return sendJson(res, 200, {
          version: '1.73.0',
          runtime: 'enterprise-copilot-runtime',
          agents: {
            default: {
              name: 'Enterprise Executive Copilot',
              description: 'Executive BI Copilot powered by Deterministic McpQueryEngine and AST Security Interceptor',
              actions: [
                {
                  name: 'render_dashboard_chart',
                  description: 'Renders executive BI charts with cryptographic SHA-256 integrity guarantee',
                  parameters: [
                    { name: 'chartConfig', type: 'object', description: 'Chart visual layout and metrics' },
                    { name: 'records', type: 'object[]', description: 'Raw verified records signed by SHA-256' }
                  ]
                }
              ]
            }
          },
          threadEndpoints: {
            list: false,
            inspect: false,
            mutations: false,
            realtimeMetadata: false
          }
        });
      }

      try {
        const rawBody = await readBody(req);
        const body = rawBody ? JSON.parse(rawBody) : {};

        if (body.method === 'info') {
          return sendJson(res, 200, {
            version: '1.73.0',
            runtime: 'enterprise-copilot-runtime',
            agents: {
              default: {
                name: 'Enterprise Executive Copilot',
                description: 'Executive BI Copilot',
                actions: []
              }
            },
            threadEndpoints: {
              list: false,
              inspect: false,
              mutations: false,
              realtimeMetadata: false
            }
          });
        }
        if (body.method === 'threads/list' || body.method === 'threads' || body.method?.startsWith('threads')) {
          return sendJson(res, 200, { threads: [] });
        }
        if (body.method === 'agent/connect') {
          return sendJson(res, 200, { status: 'connected', threadId: body.body?.threadId || 'thread-default' });
        }
        if (body.method === 'agent/stop') {
          return sendJson(res, 200, { status: 'stopped' });
        }

        // In CopilotKit protocol, parse user request messages
        const messages = body.messages || body.body?.messages || [];
        const lastMessage = messages[messages.length - 1];
        const userPrompt = typeof lastMessage?.content === 'string'
          ? lastMessage.content
          : (body.query || body.prompt || body.message || 'Vẽ biểu đồ doanh thu tháng này');

        // Real neural LLM inference & tool execution
        const decision = await CopilotLlmEngine.decideAction(userPrompt);
        const execution = await CopilotLlmEngine.executeAction(decision, DEFAULT_EXECUTIVE_CONTEXT, userPrompt);

        const actionPayload = execution.actionPayload;
        const toolCalls = actionPayload ? [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'render_dashboard_chart',
              arguments: JSON.stringify({
                chartConfig: actionPayload.chartConfig,
                records: actionPayload.records,
                audit: actionPayload.audit,
                varianceData: (actionPayload as any).varianceData
              })
            }
          }
        ] : undefined;

        // Return CopilotKit compatible response
        return sendJson(res, 200, {
          ...(actionPayload || {}),
          uiType: actionPayload?.uiType || (actionPayload?.records?.length ? 'chart' : 'text'),
          reply: execution.reply,
          choices: [
            {
              message: {
                role: 'assistant',
                content: execution.reply,
                ...(toolCalls ? { tool_calls: toolCalls } : {})
              }
            }
          ]
        });
      } catch (err: any) {
        return sendJson(res, 500, {
          error: err.message
        });
      }
    }

    next();
  };
}
