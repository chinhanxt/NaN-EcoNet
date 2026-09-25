// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: AGENT SERVER TYPES
// =============================================================================

import type {
  ActorSecurityContext,
  ExecutionRawData,
  ExecutionAuditStamp,
  ChartConfig,
  DiagnosticErrorEnvelope,
  UserRole
} from '@enterprise/shared-types';

export * from '@enterprise/shared-types';

export type IntentType =
  | 'DAILY_REVENUE_TREND'
  | 'DEPARTMENT_PERFORMANCE_Q3'
  | 'REVENUE_TRANSACTIONS'
  | 'CUSTOM_SQL'
  | 'UNKNOWN';

export interface PlannedQuery {
  intent: IntentType;
  plannedSql: string;
  chartConfig?: ChartConfig;
  description: string;
  confidence: number;
}

export interface RenderDashboardChartActionPayload<T = any> {
  action: 'render_dashboard_chart';
  chartConfig?: ChartConfig;
  records: T[];
  audit: ExecutionAuditStamp;
  status: 'SUCCESS' | 'EMPTY' | 'FAILED';
  data: ExecutionRawData<T>;
}

export interface QueryRequestBody {
  query?: string;
  sql?: string;
  queryType?: 'trend' | 'departments' | 'transactions' | 'kpis' | 'custom';
  role?: UserRole;
  departmentId?: number;
  departmentCode?: string;
  token?: string;
  sessionToken?: string;
  userId?: string;
  userEmail?: string;
  securityContext?: Partial<ActorSecurityContext>;
}

export interface HealthCheckResponse {
  status: 'HEALTHY' | 'UNHEALTHY';
  database: 'CONNECTED' | 'DISCONNECTED';
  port: number;
  timestamp: string;
  details?: {
    database: string;
    version?: string;
    host?: string;
  };
  error?: string;
}
