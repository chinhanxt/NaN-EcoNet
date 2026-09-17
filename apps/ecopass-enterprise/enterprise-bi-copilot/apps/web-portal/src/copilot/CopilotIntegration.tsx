// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: COPILOTKIT INTEGRATION
// Standard CopilotKitProvider with useCopilotReadable and useCopilotAction Hooks
// =============================================================================

import React from 'react';
import { CopilotKit, useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import type {
  UserRole,
  KpiSummaryData,
  ChartRenderOptions
} from '../types';

export interface CopilotKitProviderProps {
  children: React.ReactNode;
  runtimeUrl?: string;
}

/**
 * Standard CopilotKitProvider wrapper for C-Suite Copilot UI
 */
export const CopilotKitProvider: React.FC<CopilotKitProviderProps> = ({
  children,
  runtimeUrl = '/api/copilotkit'
}) => {
  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
      {children}
    </CopilotKit>
  );
};

export interface ExecutiveCopilotHooksProps {
  fiscalPeriod?: string;
  role: UserRole;
  scenario?: string;
  kpiData: KpiSummaryData | null;
  chartOptions: ChartRenderOptions;
  onUpdateChart: (options: ChartRenderOptions) => void;
}

/**
 * Executive Copilot Component registering useCopilotReadable and useCopilotAction
 */
export const ExecutiveCopilotBridge: React.FC<ExecutiveCopilotHooksProps> = ({
  fiscalPeriod = 'Tháng 9/2026',
  role,
  scenario = 'Actual',
  kpiData,
  chartOptions,
  onUpdateChart
}) => {
  // Hook 1: useCopilotReadable - Cung cấp context màn hình hiện tại
  useCopilotReadable({
    description: 'Bối cảnh màn hình điều hành tài chính C-Suite hiện tại (Zero-Mock Verified)',
    value: {
      fiscalPeriod,
      role: role === 'executive' ? 'Executive (CFO/CEO - Toàn quyền)' : 'Department Employee (Phân quyền RLS)',
      scenario,
      database: 'enterprise_dwh',
      dataSource: 'postgresql_replica:5435',
      currentChartMode: chartOptions.chartType,
      currentMetricHighlight: chartOptions.metricHighlight,
      kpis: kpiData ? {
        totalNetRevenueVND: kpiData.totalNetRevenue,
        totalDeals: kpiData.totalDeals,
        avgGrossMarginPct: kpiData.avgGrossMarginPct,
        targetRevenueVND: kpiData.targetRevenue,
        targetAchievementPct: kpiData.targetAchievementPct,
        totalDiscountsVND: kpiData.totalDiscounts,
        totalCogsVND: kpiData.totalCogs,
        totalGrossProfitVND: kpiData.totalGrossProfit,
      } : 'Loading...'
    }
  });

  // Hook 2: useCopilotAction - Action render_dashboard_chart để AI tự động vẽ lại Canvas
  useCopilotAction({
    name: 'render_dashboard_chart',
    description: 'Tự động cập nhật dữ liệu và vẽ lại Canvas điều hành theo chỉ thị của Sếp (chuyển đổi biểu đồ kết hợp cột + đường, lọc phòng ban, hoặc phân tích biên lợi nhuận).',
    parameters: [
      {
        name: 'chartType',
        type: 'string',
        description: "Loại biểu đồ hiển thị: 'combination' (Cột kết hợp Đường), 'bar' (Chỉ Cột), hoặc 'line' (Chỉ Đường)",
        required: false,
      },
      {
        name: 'metricHighlight',
        type: 'string',
        description: "Chỉ số trọng tâm: 'all' (Tất cả), 'revenue' (Doanh thu), 'margin' (Biên lợi nhuận), 'deals' (Số hợp đồng), hoặc 'department' (Phòng ban)",
        required: false,
      },
      {
        name: 'filterDepartment',
        type: 'string',
        description: "Mã phòng ban cần phân tích chi tiết (VD: 'ENT-TECH', 'B2B-SALES', 'SUP-LOG', hoặc 'ALL')",
        required: false,
      },
      {
        name: 'dateRange',
        type: 'string',
        description: "Khoảng thời gian trong tháng 9/2026, ví dụ 'full_month'",
        required: false,
      }
    ],
    handler: async ({ chartType, metricHighlight, filterDepartment, dateRange }) => {
      const newOptions: ChartRenderOptions = {
        chartType: (chartType as any) || 'combination',
        metricHighlight: (metricHighlight as any) || 'all',
        filterDepartment,
        dateRange,
        timestamp: new Date().toISOString()
      };
      onUpdateChart(newOptions);
      return `Đã thực thi thành công action render_dashboard_chart: Vẽ lại Canvas dạng ${newOptions.chartType}, trọng tâm ${newOptions.metricHighlight}.`;
    }
  });

  return null;
};
