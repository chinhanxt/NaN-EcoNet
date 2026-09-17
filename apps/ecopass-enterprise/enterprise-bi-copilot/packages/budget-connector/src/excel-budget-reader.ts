// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: TYPE-SAFE EXCEL BUDGET READER
// Reads Enterprise Budget Excel from Local Disk or In-Memory Google Drive Download
// Zero-Mock, Type-Safe TypeScript parsing with SHA-256 Audit Integrity
// =============================================================================

import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type {
  BudgetRevenueTarget,
  BudgetExpenseTarget,
  BudgetWorkbookData
} from './types.js';

export class ExcelBudgetReader {
  /**
   * Helper to compute SHA-256 checksum from buffer or file path
   */
  public static calculateChecksum(source: string | Buffer | ArrayBuffer | Uint8Array): string {
    const hash = crypto.createHash('sha256');
    if (typeof source === 'string') {
      if (!fs.existsSync(source)) {
        throw new Error(`[ExcelBudgetReader] Excel file not found at path: ${source}`);
      }
      const fileBuffer = fs.readFileSync(source);
      hash.update(fileBuffer);
    } else if (Buffer.isBuffer(source)) {
      hash.update(source);
    } else if (source instanceof Uint8Array) {
      hash.update(source);
    } else {
      hash.update(Buffer.from(source));
    }
    return hash.digest('hex');
  }

  /**
   * Safe numeric conversion handling strings with commas, dots, currency symbols
   */
  private static parseNumber(value: unknown): number {
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
      // Remove spaces, currency signs (₫, VND, $, etc.), commas
      const cleaned = value.replace(/[₫đVND$€\s,]/gi, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  /**
   * Convert any supported binary source to Buffer
   */
  public static toBuffer(source: Buffer | ArrayBuffer | Uint8Array): Buffer {
    if (Buffer.isBuffer(source)) {
      return source;
    }
    if (source instanceof Uint8Array) {
      return Buffer.from(source.buffer, source.byteOffset, source.byteLength);
    }
    return Buffer.from(source);
  }

  /**
   * Load XLSX workbook from local file path or in-memory download buffer
   */
  private static loadWorkbook(
    source: string | Buffer | ArrayBuffer | Uint8Array
  ): { workbook: XLSX.WorkBook; fileName: string; checksum: string } {
    if (typeof source === 'string' && !fs.existsSync(source)) {
      throw new Error(`[ExcelBudgetReader] Excel file not found at path: ${source}`);
    }

    const checksum = this.calculateChecksum(source);
    let workbook: XLSX.WorkBook;
    let fileName = 'in-memory-download.xlsx';

    if (typeof source === 'string') {
      workbook = XLSX.readFile(source);
      fileName = source.split('/').pop() || source;
    } else {
      const buffer = this.toBuffer(source);
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    return { workbook, fileName, checksum };
  }

  /**
   * Find matching sheet name with case-insensitive fallback
   */
  private static findSheetName(workbook: XLSX.WorkBook, candidates: string[]): string | null {
    const normalizedSheets = workbook.SheetNames.map(s => ({
      original: s,
      normalized: s.toLowerCase().replace(/[\s_\-]/g, '')
    }));

    for (const cand of candidates) {
      const normCand = cand.toLowerCase().replace(/[\s_\-]/g, '');
      const match = normalizedSheets.find(s => s.normalized === normCand);
      if (match) {
        return match.original;
      }
    }
    return null;
  }

  /**
   * Read and parse complete budget workbook (both KeHoach_DoanhThu and ChiPhi_NganSach)
   */
  public static readWorkbook(
    source: string | Buffer | ArrayBuffer | Uint8Array
  ): BudgetWorkbookData {
    const { workbook, fileName, checksum } = this.loadWorkbook(source);

    const revenueTargets = this.parseRevenueSheet(workbook);
    const expenseBudgets = this.parseExpenseSheet(workbook);

    return {
      fileName,
      sheetNames: workbook.SheetNames,
      revenueTargets,
      expenseBudgets,
      metadata: {
        readAt: new Date().toISOString(),
        sha256Checksum: checksum,
        totalRevenueRows: revenueTargets.length,
        totalExpenseRows: expenseBudgets.length
      }
    };
  }

  /**
   * Read only the revenue targets from KeHoach_DoanhThu sheet
   */
  public static readRevenueTargets(
    source: string | Buffer | ArrayBuffer | Uint8Array
  ): BudgetRevenueTarget[] {
    const { workbook } = this.loadWorkbook(source);
    return this.parseRevenueSheet(workbook);
  }

  /**
   * Read only the expense budgets from ChiPhi_NganSach sheet
   */
  public static readExpenseBudgets(
    source: string | Buffer | ArrayBuffer | Uint8Array
  ): BudgetExpenseTarget[] {
    const { workbook } = this.loadWorkbook(source);
    return this.parseExpenseSheet(workbook);
  }

  /**
   * Internal parser for KeHoach_DoanhThu sheet
   */
  private static parseRevenueSheet(workbook: XLSX.WorkBook): BudgetRevenueTarget[] {
    const sheetName = this.findSheetName(workbook, [
      'KeHoach_DoanhThu',
      'KeHoachDoanhThu',
      'Ke_Hoach_Doanh_Thu',
      'RevenuePlan',
      'Revenue_Plan',
      'RevenueTargets'
    ]);

    if (!sheetName) {
      throw new Error(
        `[ExcelBudgetReader] Required sheet 'KeHoach_DoanhThu' not found. Available sheets: [${workbook.SheetNames.join(', ')}]`
      );
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    const results: BudgetRevenueTarget[] = [];

    for (const row of rawRows) {
      // Find department code
      const deptCode = String(
        row['Mã phòng ban'] ||
        row['dept_code'] ||
        row['department_code'] ||
        row['Mã PB'] ||
        row['Code'] ||
        ''
      ).trim();

      if (!deptCode) {
        continue; // Skip empty row
      }

      const deptName = String(
        row['Tên phòng ban'] ||
        row['dept_name'] ||
        row['department_name'] ||
        row['Tên PB'] ||
        row['Name'] ||
        deptCode
      ).trim();

      const m7 = this.parseNumber(
        row['Kế hoạch Tháng 7'] ??
        row['month_7_target'] ??
        row['Tháng 7'] ??
        row['T7'] ??
        0
      );

      const m8 = this.parseNumber(
        row['Kế hoạch Tháng 8'] ??
        row['month_8_target'] ??
        row['Tháng 8'] ??
        row['T8'] ??
        0
      );

      const m9 = this.parseNumber(
        row['Kế hoạch Tháng 9'] ??
        row['month_9_target'] ??
        row['Tháng 9'] ??
        row['T9'] ??
        0
      );

      const q3 = this.parseNumber(
        row['Tổng kế hoạch Q3'] ??
        row['q3_target'] ??
        row['Q3'] ??
        (m7 + m8 + m9)
      );

      // Default target revenue for monthly variance (Month 9 / September 2026)
      const targetRevenue = m9 > 0 ? m9 : (q3 > 0 ? q3 : 0);

      const notes = row['Ghi chú'] ? String(row['Ghi chú']).trim() : undefined;

      results.push({
        dept_code: deptCode,
        dept_name: deptName,
        month_7_target: m7,
        month_8_target: m8,
        month_9_target: m9,
        q3_target: q3,
        target_revenue: targetRevenue,
        notes
      });
    }

    return results;
  }

  /**
   * Internal parser for ChiPhi_NganSach sheet
   */
  private static parseExpenseSheet(workbook: XLSX.WorkBook): BudgetExpenseTarget[] {
    const sheetName = this.findSheetName(workbook, [
      'ChiPhi_NganSach',
      'ChiPhiNganSach',
      'Chi_Phi_Ngan_Sach',
      'ExpenseBudget',
      'Expense_Budget',
      'OpexBudget'
    ]);

    if (!sheetName) {
      throw new Error(
        `[ExcelBudgetReader] Required sheet 'ChiPhi_NganSach' not found. Available sheets: [${workbook.SheetNames.join(', ')}]`
      );
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    const results: BudgetExpenseTarget[] = [];

    for (const row of rawRows) {
      const deptCode = String(
        row['Mã phòng ban'] ||
        row['dept_code'] ||
        row['department_code'] ||
        row['Mã PB'] ||
        row['Code'] ||
        ''
      ).trim();

      if (!deptCode) {
        continue;
      }

      const deptName = String(
        row['Tên phòng ban'] ||
        row['dept_name'] ||
        row['department_name'] ||
        row['Tên PB'] ||
        row['Name'] ||
        deptCode
      ).trim();

      const category = String(
        row['Hạng mục chi phí'] ||
        row['expense_category'] ||
        row['category'] ||
        'Chi phí hoạt động chung'
      ).trim();

      const m7 = this.parseNumber(
        row['Ngân sách Tháng 7'] ??
        row['month_7_budget'] ??
        row['Tháng 7'] ??
        row['T7'] ??
        0
      );

      const m8 = this.parseNumber(
        row['Ngân sách Tháng 8'] ??
        row['month_8_budget'] ??
        row['Tháng 8'] ??
        row['T8'] ??
        0
      );

      const m9 = this.parseNumber(
        row['Ngân sách Tháng 9'] ??
        row['month_9_budget'] ??
        row['Tháng 9'] ??
        row['T9'] ??
        0
      );

      const q3 = this.parseNumber(
        row['Tổng ngân sách Q3'] ??
        row['q3_budget'] ??
        row['Q3'] ??
        (m7 + m8 + m9)
      );

      const budgetedOpex = m9 > 0 ? m9 : (q3 > 0 ? q3 : 0);
      const notes = row['Ghi chú'] ? String(row['Ghi chú']).trim() : undefined;

      results.push({
        dept_code: deptCode,
        dept_name: deptName,
        expense_category: category,
        month_7_budget: m7,
        month_8_budget: m8,
        month_9_budget: m9,
        q3_budget: q3,
        budgeted_opex: budgetedOpex,
        notes
      });
    }

    return results;
  }
}
