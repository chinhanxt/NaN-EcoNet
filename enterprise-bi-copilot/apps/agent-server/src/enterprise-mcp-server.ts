// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: MODEL CONTEXT PROTOCOL (MCP) SERVER
// Step 3: Official ModelContextProtocol Server with Zero-Mock Data Tools
// Spec: Model Context Protocol v1.x (@modelcontextprotocol/sdk)
// =============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { McpQueryEngine } from './mcp-query-engine.js';
import { ExcelBudgetReader, VarianceAnalyzer } from '@enterprise/budget-connector';
import type { ActorSecurityContext, ExecutionRawData, DiagnosticErrorEnvelope } from '@enterprise/shared-types';

export const ENTERPRISE_MCP_TOOLS: Tool[] = [
  {
    name: 'query_enterprise_dwh',
    description: 'Executes read-only SQL queries against real PostgreSQL 16 Data Warehouse (port 5435), protected by 3-tier AST Security Interceptor and Row-Level Security. Returns verified records with SHA-256 integrity checksum.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Read-only SQL statement (SELECT or WITH only, max 1 statement, no DDL/DML)'
        },
        role: {
          type: 'string',
          enum: ['executive', 'employee'],
          description: 'Actor role for Row-Level Security session',
          default: 'executive'
        },
        departmentId: {
          type: 'string',
          description: 'Optional department UUID for employee role scoping'
        }
      },
      required: ['sql']
    }
  },
  {
    name: 'inspect_database_schema',
    description: 'Inspects live PostgreSQL database catalog: lists all available enterprise tables, views, and columns in the Data Warehouse (enterprise_dwh).',
    inputSchema: {
      type: 'object',
      properties: {
        schemaName: {
          type: 'string',
          description: 'Schema name to inspect (default: public)',
          default: 'public'
        }
      }
    }
  },
  {
    name: 'analyze_budget_variance',
    description: 'Reads corporate Excel workbook (KeHoach_NganSach_Q3_2026.xlsx) and reconciles against PostgreSQL actual revenues for Q3/2026 to compute mathematical variance and achievement percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        quarter: {
          type: 'string',
          description: 'Fiscal quarter to reconcile (e.g. Q3_2026)',
          default: 'Q3_2026'
        },
        filePath: {
          type: 'string',
          description: 'Absolute path to the Excel budget file',
          default: '/home/chinhan/enterprise-bi-copilot/data/KeHoach_NganSach_Q3_2026.xlsx'
        }
      }
    }
  },
  {
    name: 'get_executive_kpis',
    description: 'Calculates high-level executive macro KPIs (Total Closed Deals, Total Net Revenue, Gross Profit, Average Gross Margin %, Target Revenue) directly from live PostgreSQL.',
    inputSchema: {
      type: 'object',
      properties: {
        fiscalMonth: {
          type: 'number',
          description: 'Fiscal month (default: 9 for September)',
          default: 9
        },
        fiscalYear: {
          type: 'number',
          description: 'Fiscal year (default: 2026)',
          default: 2026
        }
      }
    }
  }
];

export class EnterpriseMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'enterprise-bi-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.registerHandlers();
  }

  public getRawServer(): Server {
    return this.server;
  }

  private registerHandlers(): void {
    // 1. List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: ENTERPRISE_MCP_TOOLS
      };
    });

    // 2. Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.executeToolCall(name, args || {});
    });

    // 3. List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'schema://dwh/catalog',
            name: 'PostgreSQL Enterprise Data Warehouse Schema',
            description: 'Live schema catalog of all tables and views in enterprise_dwh',
            mimeType: 'application/json'
          },
          {
            uri: 'excel://budget/q3-2026',
            name: 'Q3 2026 Corporate Budget Plan',
            description: 'Corporate budget spreadsheet targets from KeHoach_NganSach_Q3_2026.xlsx',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // 4. Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      if (uri === 'schema://dwh/catalog') {
        const schema = await this.inspectSchema();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(schema, null, 2)
            }
          ]
        };
      }
      if (uri === 'excel://budget/q3-2026') {
        const budgetFilePath = '/home/chinhan/enterprise-bi-copilot/data/KeHoach_NganSach_Q3_2026.xlsx';
        const workbook = ExcelBudgetReader.readWorkbook(budgetFilePath);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(workbook, null, 2)
            }
          ]
        };
      }
      throw new Error(`Resource not found: ${uri}`);
    });

    // 5. List Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'csuite_financial_review',
            description: 'Structured C-Suite quarterly financial evaluation prompt',
            arguments: [
              {
                name: 'focusArea',
                description: 'Specific focus area (revenue, margin, departments, variance)',
                required: false
              }
            ]
          }
        ]
      };
    });

    // 6. Get Prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (request.params.name === 'csuite_financial_review') {
        const focus = request.params.arguments?.focusArea || 'all';
        return {
          description: 'C-Suite Financial Review Prompt',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Kính gửi Cố vấn Tài chính AI: Vui lòng phân tích toàn diện hiệu quả tài chính doanh nghiệp với trọng tâm là [${focus}]. Hãy truy vấn dữ liệu thực tế từ MCP PostgreSQL và đối soát với kế hoạch ngân sách Excel để đưa ra khuyến nghị điều hành.`
              }
            }
          ]
        };
      }
      throw new Error(`Prompt not found: ${request.params.name}`);
    });
  }

  /**
   * Internal tool execution engine with Zero-Mock guarantees
   */
  public async executeToolCall(name: string, args: Record<string, any>): Promise<any> {
    const defaultExecutiveContext: ActorSecurityContext = {
      userId: 'USR-MCP-EXEC-001',
      userEmail: 'cfo@enterprise.vn',
      role: (args.role as any) || 'executive',
      departmentId: args.departmentId,
      sessionToken: 'jwt-mcp-session-verified'
    };

    switch (name) {
      case 'query_enterprise_dwh': {
        const sql = String(args.sql || '');
        if (!sql) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Error: Parameter "sql" is required.' }]
          };
        }

        const queryResult = await McpQueryEngine.executeQuery({
          sql,
          securityContext: defaultExecutiveContext
        });

        if ('errorCode' in queryResult) {
          const err = queryResult as DiagnosticErrorEnvelope;
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'SECURITY_OR_DATABASE_ERROR',
                  errorCode: err.errorCode,
                  message: err.message,
                  correlationId: err.correlationId
                }, null, 2)
              }
            ]
          };
        }

        const rawData = queryResult as ExecutionRawData;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'SUCCESS',
                rowCount: rawData.records.length,
                records: rawData.records,
                audit: rawData.audit
              }, null, 2)
            }
          ]
        };
      }

      case 'inspect_database_schema': {
        const schema = await this.inspectSchema(args.schemaName || 'public');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'SUCCESS',
                schema: args.schemaName || 'public',
                tablesAndViews: schema
              }, null, 2)
            }
          ]
        };
      }

      case 'analyze_budget_variance': {
        try {
          const filePath = args.filePath || '/home/chinhan/enterprise-bi-copilot/data/KeHoach_NganSach_Q3_2026.xlsx';
          const workbook = ExcelBudgetReader.readWorkbook(filePath);

          const dbResult = await McpQueryEngine.executeQuery({
            sql: 'SELECT dept_code, dept_name, actual_revenue FROM v_department_performance_q3 ORDER BY actual_revenue DESC;',
            securityContext: defaultExecutiveContext
          });

          if ('errorCode' in dbResult) {
            throw new Error((dbResult as DiagnosticErrorEnvelope).message);
          }

          const rawData = dbResult as ExecutionRawData;
          const actuals = rawData.records.map((r: any) => ({
            dept_code: r.dept_code,
            dept_name: r.dept_name,
            actual_revenue: Number(r.actual_revenue)
          }));

          const varianceReport = VarianceAnalyzer.computeVariance(actuals, workbook.revenueTargets);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'SUCCESS',
                  report: varianceReport,
                  audit: rawData.audit
                }, null, 2)
              }
            ]
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Variance Analysis Error: ${err.message}` }]
          };
        }
      }

      case 'get_executive_kpis': {
        const fiscalMonth = Number(args.fiscalMonth) || 9;
        const fiscalYear = Number(args.fiscalYear) || 2026;

        const kpiSql = `
          SELECT 
            COUNT(t.id) as total_deals,
            SUM(t.contract_value) as total_contract_value,
            SUM(t.discount_amount) as total_discounts,
            SUM(t.net_revenue) as total_net_revenue,
            SUM(t.cogs_amount) as total_cogs,
            SUM(t.gross_profit) as total_gross_profit,
            ROUND((SUM(t.gross_profit) / NULLIF(SUM(t.net_revenue), 0) * 100), 2) as avg_gross_margin_pct,
            (SELECT COALESCE(SUM(target_revenue), 0) FROM monthly_budgets WHERE fiscal_year = ${fiscalYear} AND fiscal_month = ${fiscalMonth}) as target_revenue
          FROM revenue_transactions t
          WHERE t.payment_status IN ('PAID', 'PENDING') AND EXTRACT(MONTH FROM t.transaction_date) = ${fiscalMonth};
        `;

        const dbResult = await McpQueryEngine.executeQuery({
          sql: kpiSql,
          securityContext: defaultExecutiveContext
        });

        if ('errorCode' in dbResult) {
          const err = dbResult as DiagnosticErrorEnvelope;
          return {
            isError: true,
            content: [{ type: 'text', text: `KPI Query Error: ${err.message}` }]
          };
        }

        const rawData = dbResult as ExecutionRawData;
        const kpi = rawData.records[0] || {};
        const actualRev = Number(kpi.total_net_revenue || 0);
        const targetRev = Number(kpi.target_revenue || 0);
        const achievementPct = targetRev > 0 ? Number(((actualRev / targetRev) * 100).toFixed(2)) : 0;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'SUCCESS',
                fiscalPeriod: `Month ${fiscalMonth}/${fiscalYear}`,
                kpis: {
                  totalDeals: Number(kpi.total_deals || 0),
                  totalContractValue: Number(kpi.total_contract_value || 0),
                  totalNetRevenue: actualRev,
                  totalGrossProfit: Number(kpi.total_gross_profit || 0),
                  averageGrossMarginPct: Number(kpi.avg_gross_margin_pct || 0),
                  targetRevenue: targetRev,
                  targetAchievementPct: achievementPct,
                  status: achievementPct >= 100 ? 'EXCEEDED' : (achievementPct >= 80 ? 'ON_TRACK' : 'AT_RISK')
                },
                audit: rawData.audit
              }, null, 2)
            }
          ]
        };
      }

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown MCP tool: ${name}` }]
        };
    }
  }

  /**
   * Introspect real database catalog from PostgreSQL information_schema
   */
  public async inspectSchema(schemaName: string = 'public'): Promise<any[]> {
    const defaultExecutiveContext: ActorSecurityContext = {
      userId: 'USR-SCHEMA-INSPECTOR',
      userEmail: 'cfo@enterprise.vn',
      role: 'executive',
      sessionToken: 'jwt-schema-inspector'
    };

    const sql = `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = '${schemaName}'
      ORDER BY table_type, table_name;
    `;

    const tablesResult = await McpQueryEngine.executeQuery({
      sql,
      securityContext: defaultExecutiveContext
    });

    if ('errorCode' in tablesResult) {
      throw new Error((tablesResult as DiagnosticErrorEnvelope).message);
    }

    const tables = (tablesResult as ExecutionRawData).records;

    const columnsSql = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = '${schemaName}'
      ORDER BY table_name, ordinal_position;
    `;

    const columnsResult = await McpQueryEngine.executeQuery({
      sql: columnsSql,
      securityContext: defaultExecutiveContext
    });

    const columns = 'records' in columnsResult ? (columnsResult as ExecutionRawData).records : [];

    return tables.map((t: any) => {
      const tableCols = columns.filter((c: any) => c.table_name === t.table_name);
      return {
        name: t.table_name,
        type: t.table_type,
        columns: tableCols.map((c: any) => ({
          column: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES'
        }))
      };
    });
  }
}

// Global Singleton Instance for In-Process MCP Engine
export const globalEnterpriseMcpServer = new EnterpriseMcpServer();
