// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: UNIFIED DOMAIN TYPES
// 100% Type-Safe Contracts across UI, Agent Orchestrator, and MCP Tools
// =============================================================================

export type UserRole = 'executive' | 'employee';

export interface ActorSecurityContext {
  userId: string;
  userEmail: string;
  role: UserRole;
  departmentId?: number;
  departmentCode?: string;
  sessionToken: string;
}

export interface ChartMetricDefinition {
  field: string;
  label: string;
  format: 'currency_vnd' | 'percentage' | 'integer' | 'decimal';
  color?: string;
  chartType?: 'bar' | 'line' | 'area';
}

export interface ChartConfig {
  title: string;
  subtitle?: string;
  categoryField: string;
  metrics: ChartMetricDefinition[];
  timeGrain?: 'day' | 'week' | 'month' | 'quarter';
  showLegend?: boolean;
}

export interface ExecutionAuditStamp {
  queryId: string;
  executedAt: string;
  durationMs: number;
  totalRecords: number;
  dataSource: 'postgresql_replica' | 'google_sheets_v4' | 'sqlite_snapshot';
  sha256Checksum: string;
}

export interface ExecutionRawData<T = Record<string, any>> {
  status: 'SUCCESS' | 'EMPTY' | 'FAILED';
  records: T[];
  chartConfig?: ChartConfig;
  audit: ExecutionAuditStamp;
  errorMessage?: string;
  errorCode?: string;
}

export interface DiagnosticErrorEnvelope {
  success: false;
  errorCode: 'SECURITY_VIOLATION' | 'CONNECTION_REFUSED' | 'AUTH_FAILED' | 'QUERY_TIMEOUT' | 'SCHEMA_ERROR' | 'INTERNAL_SERVER_ERROR' | 'INVALID_REQUEST';
  message: string;
  details?: string;
  timestamp: string;
  correlationId: string;
}

export interface DailyRevenueRecord {
  transaction_date: string;
  total_deals: number;
  total_contract_value: string;
  total_discounts: string;
  total_net_revenue: string;
  total_cogs: string;
  total_gross_profit: string;
  gross_margin_pct: string;
}

export interface DepartmentPerformanceRecord {
  dept_code: string;
  dept_name: string;
  actual_revenue: string;
  target_revenue: string;
  variance_amount: string;
  target_achievement_pct: string;
}
