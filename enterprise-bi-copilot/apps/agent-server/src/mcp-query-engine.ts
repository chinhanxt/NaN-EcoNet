// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: DETERMINISTIC MCP QUERY ENGINE
// Connects to Real PostgreSQL, Applies RLS, Signs Data with SHA-256 (Zero-Mock)
// =============================================================================

import pg from 'pg';
import crypto from 'node:crypto';
import { SqlSecurityInterceptor } from '@enterprise/security-core';
import type {
  ActorSecurityContext,
  ExecutionRawData,
  DiagnosticErrorEnvelope,
  ChartConfig
} from '@enterprise/shared-types';

export interface QueryExecutionOptions {
  sql: string;
  securityContext: ActorSecurityContext;
  chartConfig?: ChartConfig;
  connectionConfig?: pg.PoolConfig;
}

export class McpQueryEngine {
  private static executivePool: pg.Pool | null = null;
  private static employeePool: pg.Pool | null = null;

  public static getPool(role: 'executive' | 'employee', customConfig?: pg.PoolConfig): pg.Pool {
    const defaultHost = process.env.PGHOST || '127.0.0.1';
    const defaultPort = parseInt(process.env.PGPORT || '5435', 10);
    const defaultDatabase = process.env.PGDATABASE || 'enterprise_dwh';

    if (customConfig) {
      return new pg.Pool({
        host: defaultHost,
        port: defaultPort,
        database: defaultDatabase,
        user: role === 'executive' 
          ? (process.env.PGUSER_EXEC || 'executive_reader')
          : (process.env.PGUSER_EMP || 'dept_employee_reader'),
        password: role === 'executive'
          ? (process.env.PGPASSWORD_EXEC || 'ExecReaderSecret2026!')
          : (process.env.PGPASSWORD_EMP || 'DeptReaderSecret2026!'),
        max: 5,
        idleTimeoutMillis: 5000,
        ...customConfig
      });
    }

    if (role === 'executive') {
      if (!this.executivePool) {
        this.executivePool = new pg.Pool({
          host: defaultHost,
          port: defaultPort,
          database: defaultDatabase,
          user: process.env.PGUSER_EXEC || 'executive_reader',
          password: process.env.PGPASSWORD_EXEC || 'ExecReaderSecret2026!',
          max: 10,
          idleTimeoutMillis: 30000
        });
      }
      return this.executivePool;
    } else {
      if (!this.employeePool) {
        this.employeePool = new pg.Pool({
          host: defaultHost,
          port: defaultPort,
          database: defaultDatabase,
          user: process.env.PGUSER_EMP || 'dept_employee_reader',
          password: process.env.PGPASSWORD_EMP || 'DeptReaderSecret2026!',
          max: 10,
          idleTimeoutMillis: 30000
        });
      }
      return this.employeePool;
    }
  }

  /**
   * Execute real query with deterministic SHA-256 integrity and RLS session isolation
   */
  public static async executeQuery<T = any>(
    options: QueryExecutionOptions
  ): Promise<ExecutionRawData<T> | DiagnosticErrorEnvelope> {
    const startTime = Date.now();
    const queryId = `QRY-${crypto.randomUUID().slice(0, 8)}`;
    const { sql, securityContext, chartConfig, connectionConfig } = options;

    // 1. Tier 3 AST Security Filter
    let sanitizedSql: string;
    try {
      const sanitized = SqlSecurityInterceptor.validateAndSanitize(sql);
      sanitizedSql = sanitized.sanitizedSql;
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'SECURITY_VIOLATION',
        message: err.message,
        timestamp: new Date().toISOString(),
        correlationId: queryId
      };
    }

    // 2. Obtain Role-Specific Connection Pool
    const pool = this.getPool(securityContext.role, connectionConfig);
    let client: pg.PoolClient | null = null;

    try {
      client = await pool.connect();

      // 3. Begin Read-Only Transaction with RLS Context
      await client.query('BEGIN TRANSACTION READ ONLY');

      if (securityContext.role === 'employee' && securityContext.departmentId) {
        // Enforce Row-Level Security Department Context
        await client.query(`SET LOCAL app.current_department_id = '${securityContext.departmentId}'`);
      }

      // 4. Execute Real Query
      const queryResult = await client.query(sanitizedSql);
      await client.query('COMMIT');

      const durationMs = Date.now() - startTime;
      const records = (queryResult.rows || []) as T[];

      // 5. Compute SHA-256 Checksum of the exact recordset
      const rawRecordsJson = JSON.stringify(records);
      const sha256Checksum = crypto.createHash('sha256').update(rawRecordsJson).digest('hex');

      return {
        status: records.length > 0 ? 'SUCCESS' : 'EMPTY',
        records,
        chartConfig,
        audit: {
          queryId,
          executedAt: new Date().toISOString(),
          durationMs,
          totalRecords: records.length,
          dataSource: 'postgresql_replica',
          sha256Checksum
        }
      };
    } catch (dbError: any) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
      }

      // 6. Fail-Fast: Return exact diagnostic error (ZERO MOCK FALLBACK)
      return {
        success: false,
        errorCode: dbError.code === 'ECONNREFUSED' ? 'CONNECTION_REFUSED' : 'SCHEMA_ERROR',
        message: `[PostgreSQL Execution Failure] ${dbError.message}`,
        details: dbError.detail || dbError.hint,
        timestamp: new Date().toISOString(),
        correlationId: queryId
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Health check for PostgreSQL database connection (Port 5435)
   */
  public static async healthCheck(customConfig?: pg.PoolConfig): Promise<{
    healthy: boolean;
    database?: string;
    version?: string;
    port: number;
    error?: string;
  }> {
    const port = parseInt(process.env.PGPORT || '5435', 10);
    const pool = this.getPool('executive', customConfig);
    let client: pg.PoolClient | null = null;
    try {
      client = await pool.connect();
      const res = await client.query('SELECT 1 AS alive, current_database() AS db, version() AS version');
      return {
        healthy: true,
        database: res.rows[0]?.db || 'enterprise_dwh',
        version: res.rows[0]?.version,
        port
      };
    } catch (err: any) {
      return {
        healthy: false,
        port,
        error: err.message
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  public static async closePools(): Promise<void> {
    if (this.executivePool) {
      await this.executivePool.end();
      this.executivePool = null;
    }
    if (this.employeePool) {
      await this.employeePool.end();
      this.employeePool = null;
    }
  }
}
