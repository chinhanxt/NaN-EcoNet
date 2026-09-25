// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: HTTP API TEST SUITE
// Tests Port 4000 Server, REST/SSE Endpoints, RLS Isolation, AST Security & SHA-256
// =============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import { createApp } from '../src/server.js';
import { McpQueryEngine } from '../src/mcp-query-engine.js';
import type {
  RenderDashboardChartActionPayload,
  DiagnosticErrorEnvelope,
  HealthCheckResponse
} from '../src/types.js';

describe('Enterprise Copilot HTTP API Server Tests', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await McpQueryEngine.closePools();
  });

  // ---------------------------------------------------------------------------
  // 1. Healthcheck Endpoint: GET /api/health
  // ---------------------------------------------------------------------------
  it('Health Check: GET /api/health returns 200 OK and PostgreSQL connection status on port 5435', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const data = (await res.json()) as HealthCheckResponse;
    assert.strictEqual(data.status, 'HEALTHY');
    assert.strictEqual(data.database, 'CONNECTED');
    assert.strictEqual(data.port, 5435);
    assert.ok(data.timestamp);
    assert.strictEqual(data.details?.database, 'enterprise_dwh');
  });

  // ---------------------------------------------------------------------------
  // 2. Executive Query: Sếp gọi API lấy doanh thu (200 OK, 16 records, SHA-256)
  // ---------------------------------------------------------------------------
  it('Executive Revenue Query: "Vẽ biểu đồ doanh thu tháng này" returns 200 OK with 16 real records & SHA-256 signature', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        query: 'Vẽ biểu đồ doanh thu tháng này'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as RenderDashboardChartActionPayload;

    // Action format check
    assert.strictEqual(body.action, 'render_dashboard_chart');
    assert.strictEqual(body.status, 'SUCCESS');
    assert.ok(body.chartConfig, 'Must have chartConfig');
    assert.strictEqual(body.chartConfig.categoryField, 'transaction_date');

    // 16 real records check
    assert.strictEqual(body.records.length, 16, 'Must contain all 16 September transactions');

    // SHA-256 Cryptographic Checksum verification
    const expectedChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(body.records))
      .digest('hex');

    assert.strictEqual(body.audit.sha256Checksum, expectedChecksum);
    assert.strictEqual(body.audit.sha256Checksum.length, 64);
    assert.strictEqual(body.audit.totalRecords, 16);
    assert.strictEqual(body.audit.dataSource, 'postgresql_replica');
  });

  it('Executive Revenue Query Variations: "Biến thiên doanh thu tháng 9" and "Doanh thu theo ngày" map to v_daily_revenue_trend', async () => {
    // Variation 1
    const res1 = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        query: 'Biến thiên doanh thu tháng 9'
      })
    });
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as RenderDashboardChartActionPayload;
    assert.strictEqual(body1.records.length, 16);
    assert.strictEqual(body1.action, 'render_dashboard_chart');

    // Variation 2
    const res2 = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        query: 'Doanh thu theo ngày'
      })
    });
    assert.strictEqual(res2.status, 200);
    const body2 = (await res2.json()) as RenderDashboardChartActionPayload;
    assert.strictEqual(body2.records.length, 16);
    assert.strictEqual(body2.action, 'render_dashboard_chart');
  });

  // ---------------------------------------------------------------------------
  // 3. Department Performance: "Hiệu quả phòng ban", "Báo cáo Q3", "So sánh mục tiêu"
  // ---------------------------------------------------------------------------
  it('Department Performance: Maps to v_department_performance_q3 with Target vs Actual chartConfig', async () => {
    const queries = ['Hiệu quả phòng ban', 'Báo cáo Q3', 'So sánh mục tiêu'];

    for (const query of queries) {
      const res = await fetch(`${baseUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-valid-token-cfo'
        },
        body: JSON.stringify({ query })
      });

      assert.strictEqual(res.status, 200, `Query "${query}" should return 200 OK`);
      const body = (await res.json()) as RenderDashboardChartActionPayload;
      assert.strictEqual(body.action, 'render_dashboard_chart');
      assert.strictEqual(body.chartConfig?.categoryField, 'dept_name');
      assert.strictEqual(body.records.length, 5, 'Should return 5 departments');
      assert.ok(body.audit.sha256Checksum.length === 64);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Employee RLS Isolation: Nhân viên gọi API -> RLS lọc đúng số bản ghi
  // ---------------------------------------------------------------------------
  it('Employee RLS Query: Tech employee (Dept 1) should only receive their 6 department transactions', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-minh'
      },
      body: JSON.stringify({
        sql: 'SELECT transaction_code, client_name, net_revenue FROM revenue_transactions'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as RenderDashboardChartActionPayload;
    assert.strictEqual(body.status, 'SUCCESS');
    assert.strictEqual(body.records.length, 6, 'RLS must isolate exactly 6 records for department 1');

    // SHA-256 Checksum over the isolated recordset
    const expectedChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(body.records))
      .digest('hex');
    assert.strictEqual(body.audit.sha256Checksum, expectedChecksum);
  });

  it('Employee RLS Query: Sales employee (Dept 3) should only receive their 6 department transactions', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-ha'
      },
      body: JSON.stringify({
        sql: 'SELECT transaction_code, client_name, net_revenue FROM revenue_transactions'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as RenderDashboardChartActionPayload;
    assert.strictEqual(body.status, 'SUCCESS');
    assert.strictEqual(body.records.length, 6, 'RLS must isolate exactly 6 records for department 3');
    assert.ok(body.records.some((r: any) => r.client_name === 'Tổng công ty May XNK Nam Định'));
  });

  // ---------------------------------------------------------------------------
  // 5. Malicious Query: Chặn truy vấn độc hại -> 400 Bad Request & SECURITY_VIOLATION
  // ---------------------------------------------------------------------------
  it('Security Gatekeeper: DROP statement stacking returns 400 Bad Request with SECURITY_VIOLATION', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        query: 'DROP TABLE revenue_transactions; SELECT 1;'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as DiagnosticErrorEnvelope;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, 'SECURITY_VIOLATION');
    assert.ok(body.message.includes('Multiple statements') || body.message.includes('DROP'));
  });

  it('Security Gatekeeper: Dangerous system function pg_sleep returns 400 Bad Request with SECURITY_VIOLATION', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        query: 'SELECT * FROM pg_sleep(5);'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as DiagnosticErrorEnvelope;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, 'SECURITY_VIOLATION');
    assert.ok(body.message.includes('pg_sleep'));
  });

  it('Security Gatekeeper: DELETE statement returns 400 Bad Request with SECURITY_VIOLATION', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        query: 'DELETE FROM departments;'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as DiagnosticErrorEnvelope;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, 'SECURITY_VIOLATION');
  });

  // ---------------------------------------------------------------------------
  // 6. Auth Gatekeeper: Từ chối yêu cầu không xác thực
  // ---------------------------------------------------------------------------
  it('Auth Gatekeeper: Unauthenticated query returns 401 Unauthorized with AUTH_FAILED', async () => {
    const res = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'Vẽ biểu đồ doanh thu tháng này'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as DiagnosticErrorEnvelope;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.errorCode, 'AUTH_FAILED');
  });

  // ---------------------------------------------------------------------------
  // 7. CopilotKit Protocol Endpoint: POST & GET /api/copilotkit
  // ---------------------------------------------------------------------------
  it('CopilotKit Protocol: GET /api/copilotkit/info returns CopilotKit runtime metadata & actions', async () => {
    const res = await fetch(`${baseUrl}/api/copilotkit/info`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.version, '1.73.0');
    assert.ok(body.agents?.default);
    assert.ok(body.agents.default.actions.some((a: any) => a.name === 'render_dashboard_chart'));
  });

  it('CopilotKit Protocol: POST /api/copilotkit with single-route info method returns runtime info', async () => {
    const res = await fetch(`${baseUrl}/api/copilotkit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method: 'info' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.version, '1.73.0');
  });

  it('CopilotKit Protocol: POST /api/copilotkit with chat messages dispatches render_dashboard_chart action', async () => {
    const res = await fetch(`${baseUrl}/api/copilotkit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Vẽ biểu đồ doanh thu tháng này'
          }
        ]
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.action, 'render_dashboard_chart');
    assert.strictEqual(body.records.length, 16);
    assert.ok(body.choices?.[0]?.message?.tool_calls?.length > 0);
  });

  it('CopilotKit Protocol: POST /api/copilotkit with SSE streaming returns event stream with render_dashboard_chart', async () => {
    const res = await fetch(`${baseUrl}/api/copilotkit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: 'Bearer jwt-valid-token-cfo'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Biến thiên doanh thu tháng 9'
          }
        ]
      })
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));

    const sseText = await res.text();
    assert.ok(sseText.includes('ACTION_EXECUTION_START'));
    assert.ok(sseText.includes('render_dashboard_chart'));
    assert.ok(sseText.includes('ACTION_EXECUTION_RESULT'));
    assert.ok(sseText.includes('[DONE]'));
  });
});
