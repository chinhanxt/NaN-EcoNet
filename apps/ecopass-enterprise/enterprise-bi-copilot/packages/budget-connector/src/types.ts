// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: BUDGET CONNECTOR & VARIANCE TYPES
// 100% Type-Safe Data Contracts for Budgeting, Excel Reading & Variance Analysis
// =============================================================================

export type VarianceStatus = 'EXCEEDED' | 'ON_TRACK' | 'AT_RISK';

/**
 * Budget target row for revenue parsed from KeHoach_DoanhThu sheet
 */
export interface BudgetRevenueTarget {
  dept_code: string;
  dept_name: string;
  month_7_target: number;
  month_8_target: number;
  month_9_target: number;
  q3_target: number;
  target_revenue: number; // default target for current analysis period (e.g. month 9 or Q3)
  notes?: string;
}

/**
 * Budget expense row parsed from ChiPhi_NganSach sheet
 */
export interface BudgetExpenseTarget {
  dept_code: string;
  dept_name: string;
  expense_category: string;
  month_7_budget: number;
  month_8_budget: number;
  month_9_budget: number;
  q3_budget: number;
  budgeted_opex: number; // default opex for current analysis period
  notes?: string;
}

/**
 * Full parsed workbook data containing both revenue and expense targets
 */
export interface BudgetWorkbookData {
  fileName: string;
  sheetNames: string[];
  revenueTargets: BudgetRevenueTarget[];
  expenseBudgets: BudgetExpenseTarget[];
  metadata: {
    readAt: string;
    sha256Checksum: string;
    totalRevenueRows: number;
    totalExpenseRows: number;
  };
}

/**
 * Department actual performance row retrieved from PostgreSQL (v_department_performance_q3)
 */
export interface DepartmentActualPerformance {
  dept_code: string;
  dept_name: string;
  actual_revenue: number;
}

/**
 * Variance result for a single department
 */
export interface DepartmentVarianceResult {
  dept_code: string;
  dept_name: string;
  actual_revenue: number;
  target_revenue: number;
  variance_amount: number;
  achievement_pct: number;
  status: VarianceStatus;
}

/**
 * Full Variance Analysis Report across all departments
 */
export interface VarianceReport {
  target_period: string;
  total_actual_revenue: number;
  total_target_revenue: number;
  total_variance_amount: number;
  overall_achievement_pct: number;
  overall_status: VarianceStatus;
  department_count: number;
  exceeded_count: number;
  on_track_count: number;
  at_risk_count: number;
  departments: DepartmentVarianceResult[];
  audit: {
    generated_at: string;
    excel_checksum?: string;
    data_source: 'live_postgresql_and_excel' | 'in_memory_calculation';
  };
}

/**
 * Options for configuring variance analysis calculation
 */
export interface VarianceAnalysisOptions {
  targetPeriod?: string;
  targetField?: 'month_7_target' | 'month_8_target' | 'month_9_target' | 'q3_target' | 'target_revenue';
}
