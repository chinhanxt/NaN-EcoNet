import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ExcelBudgetReader } from '../src/excel-budget-reader.js';

describe('ExcelBudgetReader - Real Enterprise Excel & Zero-Mock Verification', () => {
  const realExcelPath = path.resolve(
    __dirname,
    '../../../../data/KeHoach_NganSach_Q3_2026.xlsx'
  );

  it('Local Disk Read: Should load real KeHoach_NganSach_Q3_2026.xlsx with 2 sheets and 5 departments', () => {
    assert.strictEqual(fs.existsSync(realExcelPath), true, 'Real Excel file must exist on disk');

    const workbookData = ExcelBudgetReader.readWorkbook(realExcelPath);

    // 1. Verify sheet names
    assert.ok(workbookData.sheetNames.includes('KeHoach_DoanhThu'));
    assert.ok(workbookData.sheetNames.includes('ChiPhi_NganSach'));

    // 2. Verify SHA-256 checksum
    assert.strictEqual(typeof workbookData.metadata.sha256Checksum, 'string');
    assert.strictEqual(workbookData.metadata.sha256Checksum.length, 64);

    // 3. Verify exactly 5 departments in KeHoach_DoanhThu
    assert.strictEqual(workbookData.revenueTargets.length, 5);
    const codes = workbookData.revenueTargets.map(r => r.dept_code);
    assert.deepStrictEqual(codes.sort(), [
      'B2B-SALES',
      'ENT-TECH',
      'FIN-OPS',
      'MKT-GROWTH',
      'SUP-LOG'
    ].sort());

    // 4. Verify exact mathematical values for B2B-SALES
    const b2b = workbookData.revenueTargets.find(r => r.dept_code === 'B2B-SALES');
    assert.ok(b2b);
    assert.strictEqual(b2b.dept_name, 'B2B Corporate & Key Accounts');
    assert.strictEqual(b2b.month_7_target, 4200000000);
    assert.strictEqual(b2b.month_8_target, 4500000000);
    assert.strictEqual(b2b.month_9_target, 5000000000);
    assert.strictEqual(b2b.q3_target, 13700000000);
    assert.strictEqual(b2b.target_revenue, 5000000000);

    // 5. Verify exact mathematical values for ENT-TECH
    const tech = workbookData.revenueTargets.find(r => r.dept_code === 'ENT-TECH');
    assert.ok(tech);
    assert.strictEqual(tech.dept_name, 'Enterprise Technology & AI Solutions');
    assert.strictEqual(tech.month_7_target, 1500000000);
    assert.strictEqual(tech.month_8_target, 1600000000);
    assert.strictEqual(tech.month_9_target, 1800000000);
    assert.strictEqual(tech.q3_target, 4900000000);
    assert.strictEqual(tech.target_revenue, 1800000000);

    // 6. Verify expense budget sheet ChiPhi_NganSach
    assert.strictEqual(workbookData.expenseBudgets.length, 5);
    const techExpense = workbookData.expenseBudgets.find(e => e.dept_code === 'ENT-TECH');
    assert.ok(techExpense);
    assert.strictEqual(techExpense.month_9_budget, 500000000);
    assert.strictEqual(techExpense.q3_budget, 1430000000);
    assert.strictEqual(techExpense.budgeted_opex, 500000000);
  });

  it('Google Drive In-Memory Buffer: Should parse directly from buffer with identical checksum', () => {
    // Read file into Buffer to simulate a memory stream downloaded from Google Drive API
    const fileBuffer = fs.readFileSync(realExcelPath);
    assert.ok(Buffer.isBuffer(fileBuffer));

    const workbookData = ExcelBudgetReader.readWorkbook(fileBuffer);
    const directChecksum = ExcelBudgetReader.calculateChecksum(realExcelPath);

    assert.strictEqual(workbookData.metadata.sha256Checksum, directChecksum);
    assert.strictEqual(workbookData.revenueTargets.length, 5);
    assert.strictEqual(workbookData.expenseBudgets.length, 5);
  });

  it('Error Handling: Should throw informative error when file does not exist', () => {
    const nonExistentPath = '/tmp/non_existent_budget_2026.xlsx';
    assert.throws(
      () => ExcelBudgetReader.readWorkbook(nonExistentPath),
      /Excel file not found at path/
    );
  });
});
