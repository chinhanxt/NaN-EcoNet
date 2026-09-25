import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VarianceAnalyzer } from '../src/variance-analyzer.js';
import type { BudgetRevenueTarget, DepartmentActualPerformance } from '../src/types.js';

describe('VarianceAnalyzer - Mathematical Precision & Threshold Verification', () => {
  it('Precision Test: variance_amount = actual - target with exact rounding', () => {
    const res1 = VarianceAnalyzer.calculateDepartmentVariance(
      'ENT-TECH',
      'Technology',
      2475000000.00,
      1800000000.00
    );
    assert.strictEqual(res1.variance_amount, 675000000.00);

    const res2 = VarianceAnalyzer.calculateDepartmentVariance(
      'SUP-LOG',
      'Supply Chain',
      2420000000.00,
      2500000000.00
    );
    assert.strictEqual(res2.variance_amount, -80000000.00);
  });

  it('Precision Test: achievement_pct = (actual / target) * 100 with exact 2-decimal rounding', () => {
    // 5,445,000,000 / 5,000,000,000 * 100 = 108.9
    const resB2B = VarianceAnalyzer.calculateDepartmentVariance(
      'B2B-SALES',
      'B2B Corporate',
      5445000000.00,
      5000000000.00
    );
    assert.strictEqual(resB2B.achievement_pct, 108.90);
    assert.strictEqual(resB2B.status, 'EXCEEDED');

    // 2,475,000,000 / 1,800,000,000 * 100 = 137.5
    const resTech = VarianceAnalyzer.calculateDepartmentVariance(
      'ENT-TECH',
      'Technology',
      2475000000.00,
      1800000000.00
    );
    assert.strictEqual(resTech.achievement_pct, 137.50);
    assert.strictEqual(resTech.status, 'EXCEEDED');

    // 2,420,000,000 / 2,500,000,000 * 100 = 96.8
    const resLog = VarianceAnalyzer.calculateDepartmentVariance(
      'SUP-LOG',
      'Logistics',
      2420000000.00,
      2500000000.00
    );
    assert.strictEqual(resLog.achievement_pct, 96.80);
    assert.strictEqual(resLog.status, 'ON_TRACK');

    // 0 / 400,000,000 * 100 = 0
    const resMkt = VarianceAnalyzer.calculateDepartmentVariance(
      'MKT-GROWTH',
      'Marketing',
      0,
      400000000.00
    );
    assert.strictEqual(resMkt.achievement_pct, 0.00);
    assert.strictEqual(resMkt.status, 'AT_RISK');
  });

  it('Boundary Thresholds: Strictly tests >100% (EXCEEDED), 80%-100% (ON_TRACK), <80% (AT_RISK)', () => {
    // 100.01% -> EXCEEDED
    assert.strictEqual(VarianceAnalyzer.determineStatus(100.01), 'EXCEEDED');
    assert.strictEqual(VarianceAnalyzer.determineStatus(150), 'EXCEEDED');

    // Exactly 100.00% -> ON_TRACK
    assert.strictEqual(VarianceAnalyzer.determineStatus(100.00), 'ON_TRACK');

    // 90.00% -> ON_TRACK
    assert.strictEqual(VarianceAnalyzer.determineStatus(90.00), 'ON_TRACK');

    // Exactly 80.00% -> ON_TRACK
    assert.strictEqual(VarianceAnalyzer.determineStatus(80.00), 'ON_TRACK');

    // 79.99% -> AT_RISK
    assert.strictEqual(VarianceAnalyzer.determineStatus(79.99), 'AT_RISK');

    // 0% -> AT_RISK
    assert.strictEqual(VarianceAnalyzer.determineStatus(0), 'AT_RISK');
  });

  it('Edge Cases: Target = 0 handling without NaN or Infinity crashes', () => {
    // Both target = 0 and actual = 0 -> on track (100% met target of 0)
    const resZero = VarianceAnalyzer.calculateDepartmentVariance('FIN-OPS', 'Finance', 0, 0);
    assert.strictEqual(resZero.variance_amount, 0);
    assert.strictEqual(resZero.achievement_pct, 100.00);
    assert.strictEqual(resZero.status, 'ON_TRACK');

    // Target = 0, actual = 100M -> exceeded
    const resBonus = VarianceAnalyzer.calculateDepartmentVariance('FIN-OPS', 'Finance', 100000000, 0);
    assert.strictEqual(resBonus.variance_amount, 100000000);
    assert.strictEqual(resBonus.status, 'EXCEEDED');
  });

  it('Batch Aggregation: Correct total actual, target, variance and overall status', () => {
    const actuals: DepartmentActualPerformance[] = [
      { dept_code: 'B2B-SALES', dept_name: 'B2B Sales', actual_revenue: 5445000000 },
      { dept_code: 'ENT-TECH', dept_name: 'Technology', actual_revenue: 2475000000 },
      { dept_code: 'SUP-LOG', dept_name: 'Logistics', actual_revenue: 2420000000 },
      { dept_code: 'MKT-GROWTH', dept_name: 'Marketing', actual_revenue: 0 },
      { dept_code: 'FIN-OPS', dept_name: 'Finance', actual_revenue: 0 }
    ];

    const targets: BudgetRevenueTarget[] = [
      { dept_code: 'B2B-SALES', dept_name: 'B2B Sales', month_7_target: 0, month_8_target: 0, month_9_target: 5000000000, q3_target: 13700000000, target_revenue: 5000000000 },
      { dept_code: 'ENT-TECH', dept_name: 'Technology', month_7_target: 0, month_8_target: 0, month_9_target: 1800000000, q3_target: 4900000000, target_revenue: 1800000000 },
      { dept_code: 'SUP-LOG', dept_name: 'Logistics', month_7_target: 0, month_8_target: 0, month_9_target: 2500000000, q3_target: 6900000000, target_revenue: 2500000000 },
      { dept_code: 'MKT-GROWTH', dept_name: 'Marketing', month_7_target: 0, month_8_target: 0, month_9_target: 400000000, q3_target: 1050000000, target_revenue: 400000000 },
      { dept_code: 'FIN-OPS', dept_name: 'Finance', month_7_target: 0, month_8_target: 0, month_9_target: 0, q3_target: 0, target_revenue: 0 }
    ];

    const report = VarianceAnalyzer.computeVariance(actuals, targets, { targetField: 'month_9_target' });

    assert.strictEqual(report.department_count, 5);
    assert.strictEqual(report.total_actual_revenue, 10340000000);
    assert.strictEqual(report.total_target_revenue, 9700000000);
    assert.strictEqual(report.total_variance_amount, 640000000);
    assert.strictEqual(report.overall_achievement_pct, 106.60);
    assert.strictEqual(report.overall_status, 'EXCEEDED');
    assert.strictEqual(report.exceeded_count, 2);
    assert.strictEqual(report.on_track_count, 2);
    assert.strictEqual(report.at_risk_count, 1);
  });
});
