// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: ZERO-MOCK DATA API SERVICE
// Direct Integration with PostgreSQL Analytical Views & Audit Verification
// =============================================================================

import type {
  ExecutionRawData,
  DiagnosticErrorEnvelope,
  ActorSecurityContext,
  DailyTrendRow,
  DepartmentRow,
  TransactionRow,
  KpiSummaryData
} from '../types';

export class ApiError extends Error {
  public errorCode: string;
  public details?: string;
  public correlationId?: string;
  public timestamp?: string;

  constructor(envelope: Partial<DiagnosticErrorEnvelope>) {
    super(envelope.message || 'Lỗi truy vấn cơ sở dữ liệu Enterprise DWH');
    this.name = 'ApiError';
    this.errorCode = envelope.errorCode || 'UNKNOWN_ERROR';
    this.details = envelope.details;
    this.correlationId = envelope.correlationId;
    this.timestamp = envelope.timestamp;
  }
}

export async function executeQuery<T = any>(params: {
  queryType?: 'trend' | 'departments' | 'transactions' | 'kpis' | 'custom';
  sql?: string;
  securityContext?: Partial<ActorSecurityContext>;
}): Promise<ExecutionRawData<T>> {
  const response = await fetch('/api/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok || (data && data.success === false) || data.status === 'FAILED') {
    // Fail-fast principle: Throw transparent technical error, NO MOCK FALLBACK!
    throw new ApiError({
      errorCode: data.errorCode || (response.status === 503 ? 'CONNECTION_REFUSED' : 'QUERY_FAILED'),
      message: data.message || `HTTP ${response.status}: Failed to execute query`,
      details: data.details,
      correlationId: data.correlationId || data.audit?.queryId,
      timestamp: data.timestamp || new Date().toISOString()
    });
  }

  return data as ExecutionRawData<T>;
}

export async function fetchDailyRevenueTrend(): Promise<ExecutionRawData<DailyTrendRow>> {
  return executeQuery<DailyTrendRow>({ queryType: 'trend' });
}

export async function fetchDepartmentPerformance(): Promise<ExecutionRawData<DepartmentRow>> {
  return executeQuery<DepartmentRow>({ queryType: 'departments' });
}

export async function fetchTransactions(): Promise<ExecutionRawData<TransactionRow>> {
  return executeQuery<TransactionRow>({ queryType: 'transactions' });
}

export async function fetchKpiSummary(): Promise<{
  data: KpiSummaryData;
  audit: ExecutionRawData['audit'];
}> {
  const res = await executeQuery<any>({ queryType: 'kpis' });
  const row = res.records[0] || {};

  const totalNetRevenue = parseFloat(row.total_net_revenue || '0');
  const totalDeals = parseInt(row.total_deals || '0', 10);
  const avgGrossMarginPct = parseFloat(row.avg_gross_margin_pct || '0');
  const targetRevenue = parseFloat(row.target_revenue || '0');
  const targetAchievementPct = targetRevenue > 0
    ? parseFloat(((totalNetRevenue / targetRevenue) * 100).toFixed(2))
    : 0;

  const totalContractValue = parseFloat(row.total_contract_value || '0');
  const totalDiscounts = parseFloat(row.total_discounts || '0');
  const totalCogs = parseFloat(row.total_cogs || '0');
  const totalGrossProfit = parseFloat(row.total_gross_profit || '0');

  return {
    data: {
      totalNetRevenue,
      totalDeals,
      avgGrossMarginPct,
      targetRevenue,
      targetAchievementPct,
      totalContractValue,
      totalDiscounts,
      totalCogs,
      totalGrossProfit
    },
    audit: res.audit
  };
}

export async function checkBackendHealth(): Promise<{
  status: 'UP' | 'DOWN';
  database?: string;
  dataSource?: string;
  port?: string | number;
  timestamp?: string;
  error?: any;
}> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { status: 'DOWN', error: `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return { status: 'DOWN', error: err.message };
  }
}
