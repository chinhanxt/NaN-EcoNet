// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: MCP SERVER TEST SUITE
// Verifies Model Context Protocol v1.x Implementation (Step 3)
// =============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { EnterpriseMcpServer, ENTERPRISE_MCP_TOOLS } from '../src/enterprise-mcp-server.js';
import { McpQueryEngine } from '../src/mcp-query-engine.js';

describe('🏛️ Model Context Protocol (MCP) Server - Step 3 Tests', () => {
  let mcpServer: EnterpriseMcpServer;

  before(() => {
    mcpServer = new EnterpriseMcpServer();
  });

  after(async () => {
    await McpQueryEngine.closePools();
  });

  it('1. Should register and list all 4 Enterprise MCP tools', () => {
    assert.strictEqual(ENTERPRISE_MCP_TOOLS.length, 4);
    const toolNames = ENTERPRISE_MCP_TOOLS.map(t => t.name);
    assert.ok(toolNames.includes('query_enterprise_dwh'), 'Must have query_enterprise_dwh');
    assert.ok(toolNames.includes('inspect_database_schema'), 'Must have inspect_database_schema');
    assert.ok(toolNames.includes('analyze_budget_variance'), 'Must have analyze_budget_variance');
    assert.ok(toolNames.includes('get_executive_kpis'), 'Must have get_executive_kpis');
  });

  it('2. Should execute inspect_database_schema and return real tables & views from PostgreSQL 16', async () => {
    const result = await mcpServer.executeToolCall('inspect_database_schema', { schemaName: 'public' });
    assert.ok(!result.isError, 'Tool call should succeed');
    assert.ok(result.content && result.content.length > 0);

    const payload = JSON.parse(result.content[0].text);
    assert.strictEqual(payload.status, 'SUCCESS');
    assert.ok(Array.isArray(payload.tablesAndViews));

    const tableNames = payload.tablesAndViews.map((t: any) => t.name);
    assert.ok(tableNames.includes('revenue_transactions'), 'Should contain revenue_transactions table');
    assert.ok(tableNames.includes('departments'), 'Should contain departments table');
    assert.ok(tableNames.includes('v_daily_revenue_trend'), 'Should contain v_daily_revenue_trend view');
    assert.ok(tableNames.includes('v_department_performance_q3'), 'Should contain v_department_performance_q3 view');

    // Verify columns of revenue_transactions
    const revTable = payload.tablesAndViews.find((t: any) => t.name === 'revenue_transactions');
    assert.ok(revTable.columns.length >= 8);
    const colNames = revTable.columns.map((c: any) => c.column);
    assert.ok(colNames.includes('transaction_code'));
    assert.ok(colNames.includes('net_revenue'));
  });

  it('3. Should execute query_enterprise_dwh and return real data with SHA-256 Checksum', async () => {
    const result = await mcpServer.executeToolCall('query_enterprise_dwh', {
      sql: 'SELECT transaction_code, net_revenue, client_name FROM revenue_transactions ORDER BY net_revenue DESC LIMIT 5;',
      role: 'executive'
    });

    assert.ok(!result.isError, 'Query should succeed');
    const payload = JSON.parse(result.content[0].text);
    assert.strictEqual(payload.status, 'SUCCESS');
    assert.strictEqual(payload.rowCount, 5);
    assert.ok(payload.audit.sha256Checksum, 'Must have cryptographic SHA-256 hash');
    assert.strictEqual(payload.audit.sha256Checksum.length, 64);
  });

  it('4. Should block dangerous SQL injection attempts in query_enterprise_dwh via AST Interceptor', async () => {
    const malicious = await mcpServer.executeToolCall('query_enterprise_dwh', {
      sql: 'DROP TABLE revenue_transactions;',
      role: 'executive'
    });

    assert.strictEqual(malicious.isError, true);
    const payload = JSON.parse(malicious.content[0].text);
    assert.strictEqual(payload.status, 'SECURITY_OR_DATABASE_ERROR');
    assert.strictEqual(payload.errorCode, 'SECURITY_VIOLATION');
  });

  it('5. Should execute analyze_budget_variance and reconcile Excel vs PostgreSQL', async () => {
    const result = await mcpServer.executeToolCall('analyze_budget_variance', {
      quarter: 'Q3_2026'
    });

    assert.ok(!result.isError, 'Variance analysis should succeed');
    const payload = JSON.parse(result.content[0].text);
    assert.strictEqual(payload.status, 'SUCCESS');
    assert.strictEqual(payload.report.departments.length, 5);
    assert.strictEqual(payload.report.total_actual_revenue, 10340000000);
    assert.strictEqual(payload.report.total_target_revenue, 9700000000);
    assert.strictEqual(payload.report.overall_achievement_pct, 106.6);
  });

  it('6. Should execute get_executive_kpis and return real macro metrics', async () => {
    const result = await mcpServer.executeToolCall('get_executive_kpis', {
      fiscalMonth: 9,
      fiscalYear: 2026
    });

    assert.ok(!result.isError, 'KPI calculation should succeed');
    const payload = JSON.parse(result.content[0].text);
    assert.strictEqual(payload.status, 'SUCCESS');
    assert.strictEqual(payload.kpis.totalDeals, 16);
    assert.strictEqual(payload.kpis.totalNetRevenue, 10340000000);
    assert.strictEqual(payload.kpis.averageGrossMarginPct, 71.71);
    assert.strictEqual(payload.kpis.status, 'EXCEEDED');
  });
});
