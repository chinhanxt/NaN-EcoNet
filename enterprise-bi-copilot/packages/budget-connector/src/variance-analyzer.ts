// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: VARIANCE ANALYZER MODULE
// Computes Exact Variance Analysis between Real PostgreSQL Actuals & Excel Targets
// Zero-Mock, 100% Mathematical Precision (achievement_pct, variance_amount, status)
// =============================================================================

import pg from 'pg';
import { ExcelBudgetReader } from './excel-budget-reader.js';
import type {
  BudgetRevenueTarget,
  DepartmentActualPerformance,
  DepartmentVarianceResult,
  VarianceReport,
  VarianceStatus,
  VarianceAnalysisOptions
} from './types.js';

export class VarianceAnalyzer {
  /**
   * Safe 2-decimal rounding preventing JavaScript floating point inaccuracies
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Determine variance status based on achievement percentage:
   * - 'EXCEEDED' (> 100%)
   * - 'ON_TRACK' (80% - 100%)
   * - 'AT_RISK' (< 80%)
   */
  public static determineStatus(achievementPct: number): VarianceStatus {
    if (achievementPct > 100) {
      return 'EXCEEDED';
    }
    if (achievementPct >= 80 && achievementPct <= 100) {
      return 'ON_TRACK';
    }
    return 'AT_RISK';
  }

  /**
   * Calculate single department variance item
   */
  public static calculateDepartmentVariance(
    deptCode: string,
    deptName: string,
    actualRevenue: number,
    targetRevenue: number
  ): DepartmentVarianceResult {
    const varianceAmount = this.round2(actualRevenue - targetRevenue);

    let achievementPct: number;
    let status: VarianceStatus;

    if (targetRevenue > 0) {
      achievementPct = this.round2((actualRevenue / targetRevenue) * 100);
      status = this.determineStatus(achievementPct);
    } else if (targetRevenue === 0) {
      // If no revenue target was assigned:
      // - If actual revenue earned > 0, it exceeds expectation (EXCEEDED)
      // - If actual revenue is 0, it completely satisfies the 0 target (100% - ON_TRACK)
      // - If negative, it is at risk
      if (actualRevenue > 0) {
        achievementPct = 100.00;
        status = 'EXCEEDED';
      } else if (actualRevenue === 0) {
        achievementPct = 100.00;
        status = 'ON_TRACK';
      } else {
        achievementPct = 0.00;
        status = 'AT_RISK';
      }
    } else {
      achievementPct = 0.00;
      status = 'AT_RISK';
    }

    return {
      dept_code: deptCode,
      dept_name: deptName,
      actual_revenue: actualRevenue,
      target_revenue: targetRevenue,
      variance_amount: varianceAmount,
      achievement_pct: achievementPct,
      status
    };
  }

  /**
   * Pure in-memory computation: Compares actual performance records against budget targets
   */
  public static computeVariance(
    actuals: DepartmentActualPerformance[],
    targets: BudgetRevenueTarget[],
    options?: VarianceAnalysisOptions
  ): VarianceReport {
    const targetField = options?.targetField || 'target_revenue';
    const targetPeriod = options?.targetPeriod || 'September 2026 / Q3 2026';

    const actualMap = new Map<string, DepartmentActualPerformance>();
    for (const act of actuals) {
      actualMap.set(act.dept_code.trim().toUpperCase(), act);
    }

    const targetMap = new Map<string, BudgetRevenueTarget>();
    for (const tgt of targets) {
      targetMap.set(tgt.dept_code.trim().toUpperCase(), tgt);
    }

    // Combine all unique department codes
    const allCodes = Array.from(new Set([...actualMap.keys(), ...targetMap.keys()]));

    const departmentResults: DepartmentVarianceResult[] = [];
    let totalActual = 0;
    let totalTarget = 0;

    let exceededCount = 0;
    let onTrackCount = 0;
    let atRiskCount = 0;

    for (const code of allCodes) {
      const act = actualMap.get(code);
      const tgt = targetMap.get(code);

      const deptCode = code;
      const deptName = tgt?.dept_name || act?.dept_name || code;
      const actualRev = act ? this.round2(Number(act.actual_revenue)) : 0;

      let targetRev = 0;
      if (tgt) {
        if (targetField === 'month_7_target') targetRev = tgt.month_7_target;
        else if (targetField === 'month_8_target') targetRev = tgt.month_8_target;
        else if (targetField === 'month_9_target') targetRev = tgt.month_9_target;
        else if (targetField === 'q3_target') targetRev = tgt.q3_target;
        else targetRev = tgt.target_revenue;
      }
      targetRev = this.round2(targetRev);

      const result = this.calculateDepartmentVariance(deptCode, deptName, actualRev, targetRev);

      totalActual += actualRev;
      totalTarget += targetRev;

      if (result.status === 'EXCEEDED') exceededCount++;
      else if (result.status === 'ON_TRACK') onTrackCount++;
      else atRiskCount++;

      departmentResults.push(result);
    }

    // Sort by actual revenue descending
    departmentResults.sort((a, b) => b.actual_revenue - a.actual_revenue);

    totalActual = this.round2(totalActual);
    totalTarget = this.round2(totalTarget);
    const totalVariance = this.round2(totalActual - totalTarget);

    let overallAchievementPct: number;
    if (totalTarget > 0) {
      overallAchievementPct = this.round2((totalActual / totalTarget) * 100);
    } else {
      overallAchievementPct = totalActual >= 0 ? 100.00 : 0.00;
    }

    const overallStatus = this.determineStatus(overallAchievementPct);

    return {
      target_period: targetPeriod,
      total_actual_revenue: totalActual,
      total_target_revenue: totalTarget,
      total_variance_amount: totalVariance,
      overall_achievement_pct: overallAchievementPct,
      overall_status: overallStatus,
      department_count: departmentResults.length,
      exceeded_count: exceededCount,
      on_track_count: onTrackCount,
      at_risk_count: atRiskCount,
      departments: departmentResults,
      audit: {
        generated_at: new Date().toISOString(),
        data_source: 'in_memory_calculation'
      }
    };
  }

  /**
   * Fetch actual department performance directly from PostgreSQL view v_department_performance_q3
   */
  public static async fetchActualsFromPostgres(
    customPoolOrConfig?: pg.Pool | pg.PoolConfig
  ): Promise<DepartmentActualPerformance[]> {
    let pool: pg.Pool;
    let shouldClosePool = false;

    if (customPoolOrConfig && 'query' in customPoolOrConfig) {
      pool = customPoolOrConfig as pg.Pool;
    } else {
      const defaultHost = process.env.PGHOST || '127.0.0.1';
      const defaultPort = parseInt(process.env.PGPORT || '5435', 10);
      const defaultDatabase = process.env.PGDATABASE || 'enterprise_dwh';
      const user = process.env.PGUSER_EXEC || 'executive_reader';
      const password = process.env.PGPASSWORD_EXEC || 'ExecReaderSecret2026!';

      pool = new pg.Pool({
        host: defaultHost,
        port: defaultPort,
        database: defaultDatabase,
        user,
        password,
        max: 5,
        idleTimeoutMillis: 5000,
        ...(customPoolOrConfig as pg.PoolConfig || {})
      });
      shouldClosePool = true;
    }

    try {
      const query = `
        SELECT 
          dept_code, 
          dept_name, 
          actual_revenue 
        FROM v_department_performance_q3 
        ORDER BY actual_revenue DESC;
      `;
      const res = await pool.query(query);

      return res.rows.map((row: any) => ({
        dept_code: String(row.dept_code),
        dept_name: String(row.dept_name),
        actual_revenue: parseFloat(row.actual_revenue) || 0
      }));
    } finally {
      if (shouldClosePool) {
        await pool.end();
      }
    }
  }

  /**
   * End-to-end integration: reads real Excel budget file and queries real PostgreSQL view v_department_performance_q3
   */
  public static async analyzeFromDatabaseAndExcel(options: {
    excelSource: string | Buffer | ArrayBuffer | Uint8Array;
    poolOrConfig?: pg.Pool | pg.PoolConfig;
    targetField?: 'month_7_target' | 'month_8_target' | 'month_9_target' | 'q3_target' | 'target_revenue';
    targetPeriod?: string;
  }): Promise<VarianceReport> {
    const { excelSource, poolOrConfig, targetField = 'month_9_target', targetPeriod } = options;

    // 1. Read real Excel targets
    const revenueTargets = ExcelBudgetReader.readRevenueTargets(excelSource);
    const checksum = ExcelBudgetReader.calculateChecksum(excelSource);

    // 2. Fetch real actuals from PostgreSQL view v_department_performance_q3
    const actuals = await this.fetchActualsFromPostgres(poolOrConfig);

    // 3. Compute variance
    const report = this.computeVariance(actuals, revenueTargets, {
      targetField,
      targetPeriod: targetPeriod || 'September 2026 (Month 9 / Q3)'
    });

    report.audit = {
      generated_at: new Date().toISOString(),
      excel_checksum: checksum,
      data_source: 'live_postgresql_and_excel'
    };

    return report;
  }
}
