// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: FRONTEND DOMAIN TYPES
// =============================================================================

export * from '@enterprise/shared-types';

export interface KpiSummaryData {
  totalNetRevenue: number;
  totalDeals: number;
  avgGrossMarginPct: number;
  targetRevenue: number;
  targetAchievementPct: number;
  totalContractValue: number;
  totalDiscounts: number;
  totalCogs: number;
  totalGrossProfit: number;
}

export interface DepartmentRow {
  dept_code: string;
  dept_name: string;
  actual_revenue: string;
  target_revenue: string;
  variance_amount: string;
  target_achievement_pct: string | null;
}

export interface TransactionRow {
  id: string;
  transaction_code: string;
  transaction_date: string;
  department_name?: string;
  department_code?: string;
  client_name: string;
  product_category: string;
  contract_value: string;
  discount_amount: string;
  net_revenue: string;
  cogs_amount: string;
  gross_profit: string;
  payment_status: 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
}

export interface DailyTrendRow {
  transaction_date: string;
  total_deals: number | string;
  total_contract_value: string;
  total_discounts: string;
  total_net_revenue: string;
  total_cogs: string;
  total_gross_profit: string;
  gross_margin_pct: string;
}

export interface ChartRenderOptions {
  chartType: 'combination' | 'bar' | 'line';
  metricHighlight: 'all' | 'revenue' | 'margin' | 'deals' | 'department';
  filterDepartment?: string;
  dateRange?: string;
  timestamp?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot' | 'system';
  content: string;
  timestamp: string;
  toolAction?: {
    name: string;
    status: 'executing' | 'completed' | 'failed';
    summary?: string;
  };
  auditStamp?: {
    queryId: string;
    sha256Checksum: string;
    durationMs: number;
  };
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
