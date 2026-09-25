// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: REAL BUDGET EXCEL GENERATOR
// Generates official enterprise spreadsheet for Q3/2026 budget & targets
// Path: /home/chinhan/enterprise-bi-copilot/data/KeHoach_NganSach_Q3_2026.xlsx
// =============================================================================

import * as XLSX from 'xlsx';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface BudgetGenerationOptions {
  outputPath?: string;
}

export const DEFAULT_EXCEL_PATH = path.resolve(
  __dirname,
  '../../../../data/KeHoach_NganSach_Q3_2026.xlsx'
);

/**
 * 5 Departments matching PostgreSQL schema departments table:
 * 1: ENT-TECH (Enterprise Technology & AI Solutions)
 * 2: FIN-OPS (Financial Operations & Treasury)
 * 3: B2B-SALES (B2B Corporate & Key Accounts)
 * 4: SUP-LOG (Supply Chain & Regional Logistics)
 * 5: MKT-GROWTH (Digital Marketing & Growth)
 */
export const REVENUE_PLAN_DATA = [
  {
    'Mã phòng ban': 'ENT-TECH',
    'Tên phòng ban': 'Enterprise Technology & AI Solutions',
    'Kế hoạch Tháng 7': 1500000000,
    'Kế hoạch Tháng 8': 1600000000,
    'Kế hoạch Tháng 9': 1800000000,
    'Tổng kế hoạch Q3': 4900000000,
    'Ghi chú': 'Mục tiêu triển khai AI Platform, LLM Copilot & dịch vụ tư vấn kỹ thuật'
  },
  {
    'Mã phòng ban': 'FIN-OPS',
    'Tên phòng ban': 'Financial Operations & Treasury',
    'Kế hoạch Tháng 7': 0,
    'Kế hoạch Tháng 8': 0,
    'Kế hoạch Tháng 9': 0,
    'Tổng kế hoạch Q3': 0,
    'Ghi chú': 'Bộ phận hỗ trợ vận hành nội bộ & quản trị tài chính doanh nghiệp'
  },
  {
    'Mã phòng ban': 'B2B-SALES',
    'Tên phòng ban': 'B2B Corporate & Key Accounts',
    'Kế hoạch Tháng 7': 4200000000,
    'Kế hoạch Tháng 8': 4500000000,
    'Kế hoạch Tháng 9': 5000000000,
    'Tổng kế hoạch Q3': 13700000000,
    'Ghi chú': 'Chỉ tiêu doanh số B2B Corporate, hợp đồng ERP SaaS và dịch vụ tích hợp POS'
  },
  {
    'Mã phòng ban': 'SUP-LOG',
    'Tên phòng ban': 'Supply Chain & Regional Logistics',
    'Kế hoạch Tháng 7': 2100000000,
    'Kế hoạch Tháng 8': 2300000000,
    'Kế hoạch Tháng 9': 2500000000,
    'Tổng kế hoạch Q3': 6900000000,
    'Ghi chú': 'Doanh thu dịch vụ cảng biển, chuỗi kho lạnh và logistics khu vực'
  },
  {
    'Mã phòng ban': 'MKT-GROWTH',
    'Tên phòng ban': 'Digital Marketing & Growth',
    'Kế hoạch Tháng 7': 300000000,
    'Kế hoạch Tháng 8': 350000000,
    'Kế hoạch Tháng 9': 400000000,
    'Tổng kế hoạch Q3': 1050000000,
    'Ghi chú': 'Doanh thu phát sinh từ tăng trưởng khách hàng số và affiliate đối tác'
  }
];

export const EXPENSE_BUDGET_DATA = [
  {
    'Mã phòng ban': 'ENT-TECH',
    'Tên phòng ban': 'Enterprise Technology & AI Solutions',
    'Hạng mục chi phí': 'Chi phí R&D, hạ tầng Cloud GPU & Bản quyền phần mềm',
    'Ngân sách Tháng 7': 450000000,
    'Ngân sách Tháng 8': 480000000,
    'Ngân sách Tháng 9': 500000000,
    'Tổng ngân sách Q3': 1430000000,
    'Ghi chú': 'Thuê cụm GPU A100/H100 và API subscription cho bộ phận kỹ thuật'
  },
  {
    'Mã phòng ban': 'FIN-OPS',
    'Tên phòng ban': 'Financial Operations & Treasury',
    'Hạng mục chi phí': 'Chi phí quản lý tài chính, kiểm toán & dịch vụ pháp lý',
    'Ngân sách Tháng 7': 300000000,
    'Ngân sách Tháng 8': 320000000,
    'Ngân sách Tháng 9': 350000000,
    'Tổng ngân sách Q3': 970000000,
    'Ghi chú': 'Phí kiểm toán độc lập và chi phí duy trì tài khoản ngân hàng'
  },
  {
    'Mã phòng ban': 'B2B-SALES',
    'Tên phòng ban': 'B2B Corporate & Key Accounts',
    'Hạng mục chi phí': 'Chi phí hoa hồng bán hàng, tiếp khách & xúc tiến đối tác',
    'Ngân sách Tháng 7': 800000000,
    'Ngân sách Tháng 8': 850000000,
    'Ngân sách Tháng 9': 920000000,
    'Tổng ngân sách Q3': 2570000000,
    'Ghi chú': 'Ngân sách đẩy mạnh chiến dịch chốt hợp đồng lớn cuối quý 3'
  },
  {
    'Mã phòng ban': 'SUP-LOG',
    'Tên phòng ban': 'Supply Chain & Regional Logistics',
    'Hạng mục chi phí': 'Chi phí vận hành kho bãi, bảo trì xe và nhiên liệu',
    'Ngân sách Tháng 7': 600000000,
    'Ngân sách Tháng 8': 620000000,
    'Ngân sách Tháng 9': 650000000,
    'Tổng ngân sách Q3': 1870000000,
    'Ghi chú': 'Chi phí xăng dầu, trạm trung chuyển Cái Mép và kho bãi Miền Nam'
  },
  {
    'Mã phòng ban': 'MKT-GROWTH',
    'Tên phòng ban': 'Digital Marketing & Growth',
    'Hạng mục chi phí': 'Chi phí Performance Ads, KOLs & hội thảo xúc tiến thị trường',
    'Ngân sách Tháng 7': 350000000,
    'Ngân sách Tháng 8': 380000000,
    'Ngân sách Tháng 9': 400000000,
    'Tổng ngân sách Q3': 1130000000,
    'Ghi chú': 'Ngân sách quảng cáo đa kênh Google/Facebook/LinkedIn cho doanh nghiệp'
  }
];

/**
 * Generate real enterprise Excel file with KeHoach_DoanhThu and ChiPhi_NganSach sheets
 */
export function generateEnterpriseBudgetExcel(outputPath: string = DEFAULT_EXCEL_PATH): string {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const workbook = XLSX.utils.book_new();

  // 1. Sheet KeHoach_DoanhThu
  const revenueWorksheet = XLSX.utils.json_to_sheet(REVENUE_PLAN_DATA);
  // Auto-fit column widths
  revenueWorksheet['!cols'] = [
    { wch: 15 }, // Mã phòng ban
    { wch: 40 }, // Tên phòng ban
    { wch: 20 }, // Tháng 7
    { wch: 20 }, // Tháng 8
    { wch: 20 }, // Tháng 9
    { wch: 22 }, // Tổng Q3
    { wch: 70 }  // Ghi chú
  ];
  XLSX.utils.book_append_sheet(workbook, revenueWorksheet, 'KeHoach_DoanhThu');

  // 2. Sheet ChiPhi_NganSach
  const expenseWorksheet = XLSX.utils.json_to_sheet(EXPENSE_BUDGET_DATA);
  expenseWorksheet['!cols'] = [
    { wch: 15 }, // Mã phòng ban
    { wch: 40 }, // Tên phòng ban
    { wch: 55 }, // Hạng mục chi phí
    { wch: 20 }, // Ngân sách T7
    { wch: 20 }, // Ngân sách T8
    { wch: 20 }, // Ngân sách T9
    { wch: 22 }, // Tổng Q3
    { wch: 65 }  // Ghi chú
  ];
  XLSX.utils.book_append_sheet(workbook, expenseWorksheet, 'ChiPhi_NganSach');

  // Write file
  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('generate-budget-excel.js')) {
  const targetPath = process.argv[2] || DEFAULT_EXCEL_PATH;
  console.log(`[ExcelGenerator] Generating real budget workbook at: ${targetPath}`);
  const created = generateEnterpriseBudgetExcel(targetPath);
  console.log(`[ExcelGenerator] Successfully generated: ${created}`);
}
