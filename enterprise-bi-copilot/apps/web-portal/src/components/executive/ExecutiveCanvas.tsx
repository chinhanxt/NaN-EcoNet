import React from 'react';
import {
  KpiHeaderStrip,
} from './KpiHeaderStrip';
import { RevenueEChart } from './RevenueEChart';
import { DepartmentDrilldownTable } from './DepartmentDrilldownTable';
import { ZeroMockContainer } from '../common/ZeroMockContainer';
import type {
  KpiSummaryData,
  DailyTrendRow,
  DepartmentRow,
  TransactionRow,
  ChartRenderOptions,
  ExecutionAuditStamp
} from '../../types';
import type { ApiError } from '../../services/api';

interface ExecutiveCanvasProps {
  // KPI Data & State
  kpiData: KpiSummaryData | null;
  kpiLoading: boolean;
  kpiError: Error | ApiError | null;
  kpiAudit?: ExecutionAuditStamp;

  // Trend Data & State
  trendData: DailyTrendRow[];
  trendLoading: boolean;
  trendError: Error | ApiError | null;
  trendAudit?: ExecutionAuditStamp;

  // Department & Transaction Data & State
  deptData: DepartmentRow[];
  deptLoading: boolean;
  deptError: Error | ApiError | null;
  deptAudit?: ExecutionAuditStamp;

  transactionData: TransactionRow[];

  // Chart Rendering Options
  chartOptions: ChartRenderOptions;
  onChartOptionsChange: (opts: ChartRenderOptions) => void;

  // Actions
  onRetryAll: () => void;
}

export const ExecutiveCanvas: React.FC<ExecutiveCanvasProps> = ({
  kpiData,
  kpiLoading,
  kpiError,
  kpiAudit,

  trendData,
  trendLoading,
  trendError,
  trendAudit,

  deptData,
  deptLoading,
  deptError,
  deptAudit,

  transactionData,

  chartOptions,
  onChartOptionsChange,
  onRetryAll
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* 1. KPI Header Strip inside ZeroMockContainer */}
      <ZeroMockContainer
        loading={kpiLoading}
        error={kpiError}
        audit={kpiAudit}
        onRetry={onRetryAll}
        shimmerType="kpi"
        title="CHỈ SỐ TÀI CHÍNH CỐT LÕI (CORE KPIS - Q3/2026)"
        subtitle="Tổng hợp từ 100% hóa đơn và ngân sách thực tế trong hệ thống DWH"
      >
        <KpiHeaderStrip data={kpiData} />
      </ZeroMockContainer>

      {/* 2. Main ECharts Chart inside ZeroMockContainer */}
      <ZeroMockContainer
        loading={trendLoading}
        error={trendError}
        audit={trendAudit}
        onRetry={onRetryAll}
        shimmerType="chart"
      >
        <RevenueEChart
          data={trendData}
          renderOptions={chartOptions}
          onFilterChange={onChartOptionsChange}
        />
      </ZeroMockContainer>

      {/* 3. Department & Contract Drill-Down Table inside ZeroMockContainer */}
      <ZeroMockContainer
        loading={deptLoading}
        error={deptError}
        audit={deptAudit}
        onRetry={onRetryAll}
        shimmerType="table"
      >
        <DepartmentDrilldownTable
          departmentData={deptData}
          transactionData={transactionData}
        />
      </ZeroMockContainer>
    </div>
  );
};
