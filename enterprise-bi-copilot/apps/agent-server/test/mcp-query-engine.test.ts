import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { McpQueryEngine } from '../src/mcp-query-engine.js';
import type { ActorSecurityContext, ExecutionRawData, DiagnosticErrorEnvelope } from '@enterprise/shared-types';

describe('McpQueryEngine - Real Database Integration & Zero-Mock Verification', () => {
  const executiveContext: ActorSecurityContext = {
    userId: 'USR-EXEC-001',
    userEmail: 'cfo@enterprise.vn',
    role: 'executive',
    sessionToken: 'jwt-valid-token-cfo'
  };

  const techEmployeeContext: ActorSecurityContext = {
    userId: 'USR-EMP-101',
    userEmail: 'minh.pd@enterprise.vn',
    role: 'employee',
    departmentId: 1, // Enterprise Technology
    departmentCode: 'ENT-TECH',
    sessionToken: 'jwt-valid-token-minh'
  };

  const salesEmployeeContext: ActorSecurityContext = {
    userId: 'USR-EMP-102',
    userEmail: 'ha.vtt@enterprise.vn',
    role: 'employee',
    departmentId: 3, // B2B Sales
    departmentCode: 'B2B-SALES',
    sessionToken: 'jwt-valid-token-ha'
  };

  after(async () => {
    await McpQueryEngine.closePools();
  });

  // Test 1: Sếp truy vấn toàn bộ doanh thu
  it('Executive Query: Should fetch all 16 real September revenue transactions with SHA-256 signature', async () => {
    const result = await McpQueryEngine.executeQuery({
      sql: 'SELECT transaction_date, total_net_revenue, gross_margin_pct FROM v_daily_revenue_trend',
      securityContext: executiveContext
    });

    assert.strictEqual('records' in result, true);
    const data = result as ExecutionRawData;
    assert.strictEqual(data.status, 'SUCCESS');
    assert.strictEqual(data.records.length, 16);
    assert.ok(data.audit.sha256Checksum.length === 64, 'Must have valid 64-character SHA-256 hash');
    assert.strictEqual(data.audit.dataSource, 'postgresql_replica');
  });

  // Test 2: RLS Isolation - Nhân viên Tech chỉ thấy đơn của Tech
  it('Employee RLS Query: Tech employee should only see department 1 transactions (6 records)', async () => {
    const result = await McpQueryEngine.executeQuery({
      sql: 'SELECT transaction_code, client_name, net_revenue FROM revenue_transactions',
      securityContext: techEmployeeContext
    });

    assert.strictEqual('records' in result, true);
    const data = result as ExecutionRawData;
    assert.strictEqual(data.status, 'SUCCESS');
    assert.strictEqual(data.records.length, 6);
    // All returned records must belong to department 1
    assert.ok(data.records.every((r: any) => r.transaction_code.includes('-01') || r.transaction_code.includes('-02') || r.transaction_code.includes('-03') || r.transaction_code.includes('-04') || r.transaction_code.includes('-05') || r.transaction_code.includes('-06')));
  });

  // Test 3: RLS Isolation - Nhân viên Sales chỉ thấy đơn của Sales
  it('Employee RLS Query: Sales employee should only see department 3 transactions (6 records)', async () => {
    const result = await McpQueryEngine.executeQuery({
      sql: 'SELECT transaction_code, client_name, net_revenue FROM revenue_transactions',
      securityContext: salesEmployeeContext
    });

    assert.strictEqual('records' in result, true);
    const data = result as ExecutionRawData;
    assert.strictEqual(data.status, 'SUCCESS');
    assert.strictEqual(data.records.length, 6);
    assert.ok(data.records.some((r: any) => r.client_name === 'Tổng công ty May XNK Nam Định'));
  });

  // Test 4: Chặn câu lệnh phá hoại trước khi chạm tới Database
  it('Security Gatekeeper: Malicious query should be blocked before execution', async () => {
    const result = await McpQueryEngine.executeQuery({
      sql: 'DROP TABLE revenue_transactions; SELECT 1;',
      securityContext: executiveContext
    });

    assert.strictEqual('errorCode' in result, true);
    const err = result as DiagnosticErrorEnvelope;
    assert.strictEqual(err.errorCode, 'SECURITY_VIOLATION');
  });

  // Test 5: Fail-Fast khi mất kết nối (Không bao giờ fallback mock data)
  it('Fail-Fast Principle: Should return transparent CONNECTION_REFUSED diagnostic if DB is unreachable', async () => {
    const result = await McpQueryEngine.executeQuery({
      sql: 'SELECT 1',
      securityContext: executiveContext,
      connectionConfig: {
        host: '127.0.0.1',
        port: 5439, // Non-existent port
        connectionTimeoutMillis: 1000
      }
    });

    assert.strictEqual('errorCode' in result, true);
    const err = result as DiagnosticErrorEnvelope;
    assert.strictEqual(err.errorCode, 'CONNECTION_REFUSED');
    assert.strictEqual(err.success, false);
    assert.match(err.message, /PostgreSQL Execution Failure/);
  });
});
