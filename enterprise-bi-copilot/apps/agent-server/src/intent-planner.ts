// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: INTENT & QUERY PLANNER
// Deterministic Natural Language to Analytical SQL & Chart Configuration
// =============================================================================

import type {
  ActorSecurityContext,
  ChartConfig,
  PlannedQuery,
  IntentType
} from './types.js';

export const DAILY_REVENUE_CHART_CONFIG: ChartConfig = {
  title: 'Biến thiên doanh thu & Biên lợi nhuận gộp Tháng 9/2026',
  subtitle: 'Dữ liệu thời gian thực theo ngày từ PostgreSQL Enterprise DWH',
  categoryField: 'transaction_date',
  timeGrain: 'day',
  showLegend: true,
  metrics: [
    {
      field: 'total_net_revenue',
      label: 'Doanh thu thuần (VND)',
      format: 'currency_vnd',
      color: '#2563EB',
      chartType: 'area'
    },
    {
      field: 'gross_margin_pct',
      label: 'Biên lợi nhuận gộp (%)',
      format: 'percentage',
      color: '#10B981',
      chartType: 'line'
    },
    {
      field: 'total_deals',
      label: 'Số lượng deals',
      format: 'integer',
      color: '#F59E0B',
      chartType: 'bar'
    }
  ]
};

export const DEPARTMENT_PERFORMANCE_CHART_CONFIG: ChartConfig = {
  title: 'Hiệu quả hoạt động các phòng ban - Q3/2026',
  subtitle: 'Đối soát Doanh thu thực tế so với Mục tiêu kế hoạch (Target vs Actual)',
  categoryField: 'dept_name',
  timeGrain: 'quarter',
  showLegend: true,
  metrics: [
    {
      field: 'actual_revenue',
      label: 'Doanh thu thực tế (VND)',
      format: 'currency_vnd',
      color: '#2563EB',
      chartType: 'bar'
    },
    {
      field: 'target_revenue',
      label: 'Mục tiêu kế hoạch (VND)',
      format: 'currency_vnd',
      color: '#9CA3AF',
      chartType: 'bar'
    },
    {
      field: 'target_achievement_pct',
      label: '% Hoàn thành mục tiêu',
      format: 'percentage',
      color: '#F59E0B',
      chartType: 'line'
    }
  ]
};

export const TRANSACTIONS_CHART_CONFIG: ChartConfig = {
  title: 'Chi tiết giao dịch doanh thu',
  subtitle: 'Danh sách hóa đơn & hợp đồng (Áp dụng chính sách RLS)',
  categoryField: 'transaction_code',
  showLegend: false,
  metrics: [
    {
      field: 'net_revenue',
      label: 'Doanh thu thuần (VND)',
      format: 'currency_vnd',
      color: '#2563EB',
      chartType: 'bar'
    }
  ]
};

const DAILY_REVENUE_SQL = `SELECT transaction_date, total_deals, total_contract_value, total_discounts, total_net_revenue, total_cogs, total_gross_profit, gross_margin_pct FROM v_daily_revenue_trend ORDER BY transaction_date ASC;`;

const DEPARTMENT_PERFORMANCE_SQL = `SELECT dept_code, dept_name, actual_revenue, target_revenue, variance_amount, target_achievement_pct FROM v_department_performance_q3 ORDER BY actual_revenue DESC;`;

const TRANSACTIONS_SQL = `SELECT transaction_code, transaction_date, client_name, product_category, contract_value, discount_amount, net_revenue, cogs_amount, gross_profit, payment_status FROM revenue_transactions ORDER BY transaction_date DESC;`;

export class IntentQueryPlanner {
  /**
   * Normalize Vietnamese and English text for intent matching:
   * Strips accents, lowers case, removes punctuation.
   */
  public static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  /**
   * Determine if input is raw SQL (starts with SELECT, WITH, or malicious keywords)
   */
  public static isRawSql(text: string): boolean {
    const trimmed = text.trim();
    const upper = trimmed.toUpperCase();
    return (
      upper.startsWith('SELECT') ||
      upper.startsWith('WITH') ||
      upper.startsWith('DROP') ||
      upper.startsWith('DELETE') ||
      upper.startsWith('UPDATE') ||
      upper.startsWith('INSERT') ||
      upper.startsWith('ALTER') ||
      upper.startsWith('TRUNCATE') ||
      upper.includes(';')
    );
  }

  /**
   * Parse and plan query based on user intent and security context
   */
  public static plan(input: string, securityContext?: ActorSecurityContext): PlannedQuery {
    if (!input || input.trim().length === 0) {
      return {
        intent: 'UNKNOWN',
        plannedSql: '',
        description: 'Empty query',
        confidence: 0
      };
    }

    const trimmedInput = input.trim();

    // 1. Direct SQL Handling
    if (this.isRawSql(trimmedInput)) {
      const lowerSql = trimmedInput.toLowerCase();
      let chartConfig: ChartConfig | undefined;

      if (lowerSql.includes('v_daily_revenue_trend')) {
        chartConfig = DAILY_REVENUE_CHART_CONFIG;
      } else if (lowerSql.includes('v_department_performance_q3')) {
        chartConfig = DEPARTMENT_PERFORMANCE_CHART_CONFIG;
      } else if (lowerSql.includes('revenue_transactions')) {
        chartConfig = TRANSACTIONS_CHART_CONFIG;
      }

      return {
        intent: 'CUSTOM_SQL',
        plannedSql: trimmedInput,
        chartConfig,
        description: 'Direct SQL execution (Protected by AST Security Interceptor)',
        confidence: 1.0
      };
    }

    const normalized = this.normalizeText(trimmedInput);

    // 2. Intent 1: Department Performance Q3
    // Triggers: "Hiệu quả phòng ban", "Báo cáo Q3", "So sánh mục tiêu", "KPI phòng ban", "Kế hoạch kinh doanh"
    const isDeptPerformance =
      normalized.includes('hieu qua phong ban') ||
      normalized.includes('bao cao q3') ||
      normalized.includes('so sanh muc tieu') ||
      normalized.includes('kpi phong ban') ||
      normalized.includes('tien do muc tieu') ||
      normalized.includes('ty le dat muc tieu') ||
      normalized.includes('ke hoach kinh doanh') ||
      normalized.includes('department performance') ||
      normalized.includes('q3 report') ||
      normalized.includes('target comparison') ||
      (normalized.includes('phong ban') && (normalized.includes('muc tieu') || normalized.includes('hieu qua') || normalized.includes('target') || normalized.includes('kpi'))) ||
      ((normalized.includes('q3') || normalized.includes('quy 3')) && (normalized.includes('bao cao') || normalized.includes('doanh thu') || normalized.includes('muc tieu') || normalized.includes('hieu qua')));

    if (isDeptPerformance) {
      return {
        intent: 'DEPARTMENT_PERFORMANCE_Q3',
        plannedSql: DEPARTMENT_PERFORMANCE_SQL,
        chartConfig: DEPARTMENT_PERFORMANCE_CHART_CONFIG,
        description: 'Hiệu quả phòng ban Q3/2026 - So sánh Doanh thu thực tế vs Mục tiêu',
        confidence: 0.98
      };
    }

    // 3. Intent 2: Daily Revenue Trend
    // Triggers: "Vẽ biểu đồ doanh thu tháng này", "Biến thiên doanh thu tháng 9", "Doanh thu theo ngày", "Xu hướng doanh thu"
    const isDailyRevenueTrend =
      normalized.includes('bieu do doanh thu') ||
      normalized.includes('doanh thu thang nay') ||
      normalized.includes('bien thien doanh thu') ||
      normalized.includes('doanh thu theo ngay') ||
      normalized.includes('xu huong doanh thu') ||
      normalized.includes('doanh thu thang 9') ||
      normalized.includes('doanh thu hang ngay') ||
      normalized.includes('daily revenue') ||
      normalized.includes('revenue trend') ||
      normalized.includes('september revenue') ||
      normalized.includes('revenue by day') ||
      (normalized.includes('doanh thu') && (normalized.includes('ngay') || normalized.includes('thang') || normalized.includes('trend') || normalized.includes('bien thien') || normalized.includes('bieu do') || normalized.includes('chart'))) ||
      normalized.includes('doanh thu') ||
      normalized.includes('revenue');

    if (isDailyRevenueTrend) {
      return {
        intent: 'DAILY_REVENUE_TREND',
        plannedSql: DAILY_REVENUE_SQL,
        chartConfig: DAILY_REVENUE_CHART_CONFIG,
        description: 'Biến thiên doanh thu và biên lợi nhuận gộp theo ngày tháng 9/2026',
        confidence: 0.98
      };
    }

    // 4. Intent 3: Transactions & Invoices Detail
    // Triggers: "Giao dịch", "Đơn hàng", "Hợp đồng", "Hóa đơn", "Transactions"
    const isTransactions =
      normalized.includes('giao dich') ||
      normalized.includes('hop dong') ||
      normalized.includes('don hang') ||
      normalized.includes('hoa don') ||
      normalized.includes('transaction') ||
      normalized.includes('invoice');

    if (isTransactions) {
      return {
        intent: 'REVENUE_TRANSACTIONS',
        plannedSql: TRANSACTIONS_SQL,
        chartConfig: TRANSACTIONS_CHART_CONFIG,
        description: 'Chi tiết danh sách hợp đồng & hóa đơn phát sinh',
        confidence: 0.95
      };
    }

    // 5. Fallback: Default to Daily Revenue Trend for Executive Copilot
    return {
      intent: 'DAILY_REVENUE_TREND',
      plannedSql: DAILY_REVENUE_SQL,
      chartConfig: DAILY_REVENUE_CHART_CONFIG,
      description: 'Mặc định: Phân tích xu hướng doanh thu tháng 9/2026',
      confidence: 0.8
    };
  }
}
