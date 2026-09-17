import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { VarianceAnalyzer } from '../src/variance-analyzer.js';

describe('End-to-End Integration - Real PostgreSQL & Real Excel (Zero-Mock)', () => {
  const realExcelPath = path.resolve(
    __dirname,
    '../../../../data/KeHoach_NganSach_Q3_2026.xlsx'
  );

  it('Zero-Mock Integration: Should query v_department_performance_q3 and compare against real Excel targets', async () => {
    assert.strictEqual(fs.existsSync(realExcelPath), true, 'Excel file must exist');

    const report = await VarianceAnalyzer.analyzeFromDatabaseAndExcel({
      excelSource: realExcelPath,
      targetField: 'month_9_target',
      targetPeriod: 'September 2026 (Month 9 / Q3 2026)'
    });

    // 1. Audit check
    assert.strictEqual(report.audit.data_source, 'live_postgresql_and_excel');
    assert.strictEqual(typeof report.audit.excel_checksum, 'string');
    assert.strictEqual(report.audit.excel_checksum!.length, 64);

    // 2. Department count check
    assert.strictEqual(report.department_count, 5);

    // 3. Department 1: B2B-SALES
    const b2b = report.departments.find(d => d.dept_code === 'B2B-SALES');
    assert.ok(b2b, 'B2B-SALES department must be present');
    assert.strictEqual(b2b.actual_revenue, 5445000000);
    assert.strictEqual(b2b.target_revenue, 5000000000);
    assert.strictEqual(b2b.variance_amount, 445000000);
    assert.strictEqual(b2b.achievement_pct, 108.90);
    assert.strictEqual(b2b.status, 'EXCEEDED');

    // 4. Department 2: ENT-TECH
    const tech = report.departments.find(d => d.dept_code === 'ENT-TECH');
    assert.ok(tech, 'ENT-TECH department must be present');
    assert.strictEqual(tech.actual_revenue, 2475000000);
    assert.strictEqual(tech.target_revenue, 1800000000);
    assert.strictEqual(tech.variance_amount, 675000000);
    assert.strictEqual(tech.achievement_pct, 137.50);
    assert.strictEqual(tech.status, 'EXCEEDED');

    // 5. Department 3: SUP-LOG
    const log = report.departments.find(d => d.dept_code === 'SUP-LOG');
    assert.ok(log, 'SUP-LOG department must be present');
    assert.strictEqual(log.actual_revenue, 2420000000);
    assert.strictEqual(log.target_revenue, 2500000000);
    assert.strictEqual(log.variance_amount, -80000000);
    assert.strictEqual(log.achievement_pct, 96.80);
    assert.strictEqual(log.status, 'ON_TRACK');

    // 6. Department 4: MKT-GROWTH
    const mkt = report.departments.find(d => d.dept_code === 'MKT-GROWTH');
    assert.ok(mkt, 'MKT-GROWTH department must be present');
    assert.strictEqual(mkt.actual_revenue, 0);
    assert.strictEqual(mkt.target_revenue, 400000000);
    assert.strictEqual(mkt.variance_amount, -400000000);
    assert.strictEqual(mkt.achievement_pct, 0.00);
    assert.strictEqual(mkt.status, 'AT_RISK');

    // 7. Department 5: FIN-OPS
    const fin = report.departments.find(d => d.dept_code === 'FIN-OPS');
    assert.ok(fin, 'FIN-OPS department must be present');
    assert.strictEqual(fin.actual_revenue, 0);
    assert.strictEqual(fin.target_revenue, 0);
    assert.strictEqual(fin.variance_amount, 0);
    assert.strictEqual(fin.achievement_pct, 100.00);
    assert.strictEqual(fin.status, 'ON_TRACK');

    // 8. Overall totals
    assert.strictEqual(report.total_actual_revenue, 10340000000);
    assert.strictEqual(report.total_target_revenue, 9700000000);
    assert.strictEqual(report.total_variance_amount, 640000000);
    assert.strictEqual(report.overall_achievement_pct, 106.60);
    assert.strictEqual(report.overall_status, 'EXCEEDED');

    assert.strictEqual(report.exceeded_count, 2);
    assert.strictEqual(report.on_track_count, 2);
    assert.strictEqual(report.at_risk_count, 1);
  });

  it('Buffer-based Live Analysis: Should process in-memory buffer download from Postgres', async () => {
    const fileBuffer = fs.readFileSync(realExcelPath);

    const report = await VarianceAnalyzer.analyzeFromDatabaseAndExcel({
      excelSource: fileBuffer,
      targetField: 'month_9_target'
    });

    assert.strictEqual(report.department_count, 5);
    assert.strictEqual(report.total_actual_revenue, 10340000000);
    assert.strictEqual(report.overall_status, 'EXCEEDED');
  });
});
