-- ==============================================================================
-- Enterprise BI Data Warehouse (PostgreSQL 16) - Port 5435
-- Architecture: Domain-Driven Design / Clean Architecture
-- Security: Row Level Security (RLS) & Abstract Syntax Tree (AST) Gatekeeper
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables and views if recreating
DROP VIEW IF EXISTS v_department_performance_q3 CASCADE;
DROP VIEW IF EXISTS v_daily_revenue_trend CASCADE;
DROP VIEW IF EXISTS v_client_revenue_contribution CASCADE;
DROP VIEW IF EXISTS v_monthly_revenue_summary CASCADE;
DROP VIEW IF EXISTS v_accounts_receivable_aging CASCADE;
DROP VIEW IF EXISTS v_product_performance CASCADE;

DROP TABLE IF EXISTS audit_ledger CASCADE;
DROP TABLE IF EXISTS revenue_transactions CASCADE;
DROP TABLE IF EXISTS monthly_budgets CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS products_catalog CASCADE;
DROP TABLE IF EXISTS corporate_clients CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- ------------------------------------------------------------------------------
-- 1. Departments Table
-- ------------------------------------------------------------------------------
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    cost_center VARCHAR(50) NOT NULL,
    head_of_department VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO departments (code, name, cost_center, head_of_department) VALUES
('ENT-TECH', 'Khối Giải Pháp Công Nghệ & AI', 'CC-101', 'Lê Hoàng Long'),
('FIN-OPS', 'Khối Tài Chính & Vận Hành', 'CC-102', 'Nguyễn Văn Thành'),
('B2B-SALES', 'Khối Khách Hàng Doanh Nghiệp (B2B)', 'CC-103', 'Trần Thị Mai Phương'),
('SUP-LOG', 'Khối Chuỗi Cung Ứng & Logistics', 'CC-104', 'Phạm Quốc Hùng'),
('MKT-GROWTH', 'Khối Tăng Trưởng & Tiếp Thị Số', 'CC-105', 'Vũ Thùy Chi');

-- ------------------------------------------------------------------------------
-- 2. Corporate Clients Directory (Master Data)
-- ------------------------------------------------------------------------------
CREATE TABLE corporate_clients (
    id SERIAL PRIMARY KEY,
    client_code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    tax_code VARCHAR(20),
    industry VARCHAR(80) NOT NULL,
    tier VARCHAR(20) CHECK (tier IN ('STRATEGIC', 'ENTERPRISE', 'SME')),
    credit_limit NUMERIC(18, 2) DEFAULT 5000000000.00,
    headquarters VARCHAR(100) DEFAULT 'Hà Nội / TP. Hồ Chí Minh'
);

INSERT INTO corporate_clients (client_code, name, tax_code, industry, tier, credit_limit) VALUES
('CL-VTL', 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)', '0100109106', 'Telecommunications & AI', 'STRATEGIC', 15000000000.00),
('CL-TCB', 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)', '0100230800', 'Banking & Finance', 'STRATEGIC', 12000000000.00),
('CL-FPT', 'Tập đoàn FPT (FPT Software)', '0101248141', 'Software & Cloud', 'STRATEGIC', 10000000000.00),
('CL-VNPT', 'Tập đoàn Bưu chính Viễn thông Việt Nam (VNPT)', '0100684378', 'Telecommunications', 'ENTERPRISE', 8000000000.00),
('CL-SNP', 'Tổng công ty Tân Cảng Sài Gòn (Saigon Newport)', '0301446098', 'Ports & Logistics', 'ENTERPRISE', 6000000000.00),
('CL-MDC', 'Tập đoàn Y tế Medicorp', '0312567890', 'Healthcare & Pharma', 'ENTERPRISE', 4000000000.00),
('CL-NDT', 'Tổng công ty May XNK Nam Định', '0600012345', 'Textile & Garment Export', 'ENTERPRISE', 5000000000.00),
('CL-VIC', 'Tập đoàn Vingroup (VinFast)', '0101245486', 'Automotive & Conglomerate', 'STRATEGIC', 20000000000.00),
('CL-MSN', 'Tập đoàn Masan (WinCommerce)', '0303576603', 'Consumer Goods & Retail', 'STRATEGIC', 14000000000.00),
('CL-HLD', 'Chuỗi Cà phê Highlands Star', '0302827965', 'F&B Retail Chain', 'ENTERPRISE', 4500000000.00),
('CL-VNM', 'Công ty CP Sữa Việt Nam (Vinamilk)', '0300588569', 'Dairy & Nutrition', 'STRATEGIC', 15000000000.00),
('CL-HPG', 'Tập đoàn Hòa Phát', '0900189284', 'Heavy Industry & Steel', 'STRATEGIC', 18000000000.00),
('CL-CMIT', 'Cảng Quốc tế Cái Mép (Gemalink)', '3500852147', 'Maritime Terminal', 'ENTERPRISE', 5000000000.00),
('CL-SCOLD', 'Kho lạnh Thông minh Miền Nam', '0314963258', 'Cold Chain Logistics', 'SME', 2500000000.00),
('CL-EXP247', 'Hãng chuyển phát Nhanh 247', '0311741852', 'Express Delivery', 'ENTERPRISE', 3500000000.00),
('CL-TNAGR', 'Tổng kho Nông sản Tây Nguyên', '6000159357', 'Agriculture Logistics', 'SME', 2000000000.00);

-- ------------------------------------------------------------------------------
-- 3. Products & Solutions Catalog
-- ------------------------------------------------------------------------------
CREATE TABLE products_catalog (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(30) UNIQUE NOT NULL,
    category VARCHAR(80) NOT NULL,
    product_name VARCHAR(120) NOT NULL,
    unit_price NUMERIC(18, 2) NOT NULL,
    license_model VARCHAR(40) DEFAULT 'Annual Subscription',
    target_margin_pct NUMERIC(5, 2) DEFAULT 70.00
);

INSERT INTO products_catalog (product_code, category, product_name, unit_price, target_margin_pct) VALUES
('PRD-AI-01', 'AI Solutions', 'AI Agent Orchestration Platform', 450000000.00, 75.00),
('PRD-AI-02', 'AI Solutions', 'Custom LLM Copilot License', 680000000.00, 78.00),
('PRD-AI-03', 'AI Solutions', 'MCP Data Connector Hub', 320000000.00, 72.00),
('PRD-AI-04', 'AI Solutions', 'Predictive Route AI', 520000000.00, 74.00),
('PRD-AI-05', 'AI Solutions', 'Clinical LLM Assistant', 410000000.00, 76.00),
('PRD-SEC-01', 'Security', 'Zero-Trust Security Gateway', 350000000.00, 70.00),
('PRD-SEC-02', 'Security', 'AI Infrastructure Audit', 180000000.00, 75.00),
('PRD-ERP-01', 'Cloud ERP', 'Enterprise Cloud ERP SaaS', 1400000000.00, 71.00),
('PRD-ERP-02', 'Cloud ERP', 'Annual ERP SaaS Renewal', 950000000.00, 70.00),
('PRD-ERP-03', 'Cloud ERP', 'Enterprise Analytics Suite', 1150000000.00, 73.00),
('PRD-RET-01', 'Retail & POS', 'Smart Retail Cloud License', 820000000.00, 72.00),
('PRD-RET-02', 'Retail & POS', 'POS Data Integration', 730000000.00, 73.00),
('PRD-LOG-01', 'Logistics IoT', 'Automated Dispatch Hub', 620000000.00, 70.00),
('PRD-LOG-02', 'Logistics IoT', 'Temperature Sensor Telemetry', 480000000.00, 70.00),
('PRD-LOG-03', 'Logistics IoT', 'Dynamic Routing Optimization', 890000000.00, 71.00),
('PRD-LOG-04', 'Logistics IoT', 'Fleet Telematics Subscription', 530000000.00, 70.00);

-- ------------------------------------------------------------------------------
-- 4. Employees Table (RLS Subject Hierarchy)
-- ------------------------------------------------------------------------------
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    department_id INT REFERENCES departments(id),
    title VARCHAR(100) NOT NULL,
    base_salary NUMERIC(18, 2) NOT NULL,
    is_executive BOOLEAN DEFAULT FALSE,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO employees (employee_code, full_name, department_id, title, base_salary, is_executive, email) VALUES
('EMP-001', 'Nguyen Van Thanh', 2, 'Chief Financial Officer (CFO)', 120000000.00, TRUE, 'thanh.nv@enterprise.vn'),
('EMP-002', 'Le Hoang Long', 1, 'Chief Technology Officer (CTO)', 115000000.00, TRUE, 'long.lh@enterprise.vn'),
('EMP-003', 'Tran Thi Mai Phuong', 3, 'Chief Commercial Officer (CCO)', 110000000.00, TRUE, 'phuong.ttm@enterprise.vn'),
('EMP-101', 'Tran Van Minh', 1, 'Principal AI Software Engineer', 65000000.00, FALSE, 'minh.tv@enterprise.vn'),
('EMP-102', 'Vo Thi Thu Ha', 3, 'Senior B2B Account Manager', 48000000.00, FALSE, 'ha.vtt@enterprise.vn'),
('EMP-103', 'Dang Tuan Kiet', 4, 'Logistics IoT Supervisor', 35000000.00, FALSE, 'kiet.dt@enterprise.vn'),
('EMP-104', 'Hoang My Linh', 5, 'Performance Marketing Lead', 40000000.00, FALSE, 'linh.hm@enterprise.vn'),
('EMP-105', 'Bui Quang Huy', 2, 'Senior Financial Analyst', 45000000.00, FALSE, 'huy.bq@enterprise.vn'),
('EMP-106', 'Phan Thanh Tung', 1, 'Data Engineer & Lakehouse Architect', 55000000.00, FALSE, 'tung.pt@enterprise.vn'),
('EMP-107', 'Doan Ngoc Anh', 3, 'Key Account Executive', 42000000.00, FALSE, 'anh.dn@enterprise.vn');

-- ------------------------------------------------------------------------------
-- 5. Monthly Budgets & Targets (Kế hoạch kinh doanh Q3/2026 - Tháng 7, 8, 9)
-- ------------------------------------------------------------------------------
CREATE TABLE monthly_budgets (
    id SERIAL PRIMARY KEY,
    fiscal_year INT NOT NULL,
    fiscal_month INT NOT NULL,
    department_id INT REFERENCES departments(id),
    target_revenue NUMERIC(18, 2) NOT NULL,
    budgeted_opex NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unq_budget_period UNIQUE (fiscal_year, fiscal_month, department_id)
);

-- Kế hoạch Q3 2026 cho 5 phòng ban
INSERT INTO monthly_budgets (fiscal_year, fiscal_month, department_id, target_revenue, budgeted_opex) VALUES
-- Tháng 7/2026
(2026, 7, 1, 1500000000.00, 450000000.00), -- ENT-TECH
(2026, 7, 2, 1100000000.00, 320000000.00), -- FIN-OPS
(2026, 7, 3, 4200000000.00, 800000000.00), -- B2B-SALES
(2026, 7, 4, 2100000000.00, 600000000.00), -- SUP-LOG
(2026, 7, 5, 1600000000.00, 480000000.00), -- MKT-GROWTH

-- Tháng 8/2026
(2026, 8, 1, 1600000000.00, 480000000.00), -- ENT-TECH
(2026, 8, 2, 1200000000.00, 340000000.00), -- FIN-OPS
(2026, 8, 3, 4500000000.00, 850000000.00), -- B2B-SALES
(2026, 8, 4, 2300000000.00, 620000000.00), -- SUP-LOG
(2026, 8, 5, 1800000000.00, 510000000.00), -- MKT-GROWTH

-- Tháng 9/2026 (Khớp nối toán học 100% với KeHoach_NganSach_Q3_2026.xlsx)
(2026, 9, 1, 1800000000.00, 500000000.00), -- ENT-TECH (Kế hoạch 1.8 tỷ)
(2026, 9, 2, 0.00, 360000000.00),          -- FIN-OPS (Kế hoạch 0 đ, chi phí hoạt động 360 triệu)
(2026, 9, 3, 5000000000.00, 920000000.00), -- B2B-SALES (Kế hoạch 5.0 tỷ)
(2026, 9, 4, 2500000000.00, 650000000.00), -- SUP-LOG (Kế hoạch 2.5 tỷ)
(2026, 9, 5, 400000000.00, 550000000.00);  -- MKT-GROWTH (Kế hoạch 400 triệu, kiểm tra rủi ro AT_RISK)

-- ------------------------------------------------------------------------------
-- 6. Revenue Transactions (Dữ liệu thực tế phát sinh - Hóa đơn & Hợp đồng)
-- ------------------------------------------------------------------------------
CREATE TABLE revenue_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code VARCHAR(40) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    department_id INT REFERENCES departments(id),
    client_name VARCHAR(150) NOT NULL,
    product_category VARCHAR(80) NOT NULL,
    contract_value NUMERIC(18, 2) NOT NULL,
    discount_amount NUMERIC(18, 2) DEFAULT 0,
    net_revenue NUMERIC(18, 2) GENERATED ALWAYS AS (contract_value - discount_amount) STORED,
    cogs_amount NUMERIC(18, 2) NOT NULL,
    gross_profit NUMERIC(18, 2) GENERATED ALWAYS AS (contract_value - discount_amount - cogs_amount) STORED,
    payment_status VARCHAR(30) CHECK (payment_status IN ('PAID', 'PENDING', 'OVERDUE', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast time-series analytical queries
CREATE INDEX idx_rev_date ON revenue_transactions(transaction_date);
CREATE INDEX idx_rev_dept_date ON revenue_transactions(department_id, transaction_date);
CREATE INDEX idx_rev_status ON revenue_transactions(payment_status);

-- Seed 16 Real Enterprise Transactions (September 2026)
-- Exact reconciliation:
-- Dept 1: 2,475,000,000 | Dept 3: 5,445,000,000 | Dept 4: 2,420,000,000 | Dept 2: 0 | Dept 5: 0
-- Total Actual = 10,340,000,000 VND vs Target = 9,700,000,000 VND (106.60% Exceeded)
INSERT INTO revenue_transactions (transaction_code, transaction_date, department_id, client_name, product_category, contract_value, discount_amount, cogs_amount, payment_status)
VALUES
-- Dept 1: ENT-TECH (6 transactions, Net = 2,475,000,000 | Target = 1,800,000,000 | +37.5% EXCEEDED)
('TX-2026-0901-01', '2026-09-01', 1, 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)', 'AI Agent Orchestration Platform', 450000000.00, 20000000.00, 110000000.00, 'PAID'),
('TX-2026-0903-02', '2026-09-03', 1, 'Ngân hàng TMCP Kỹ Thương (Techcombank)', 'Custom LLM Copilot License', 680000000.00, 30000000.00, 150000000.00, 'PAID'),
('TX-2026-0907-03', '2026-09-07', 1, 'Tập đoàn FPT (FPT Software)', 'MCP Data Connector Hub', 320000000.00, 0.00, 85000000.00, 'PAID'),
('TX-2026-0911-04', '2026-09-11', 1, 'Tập đoàn Bưu chính Viễn thông Việt Nam (VNPT)', 'AI Infrastructure Audit', 180000000.00, 10000000.00, 45000000.00, 'PAID'),
('TX-2026-0915-05', '2026-09-15', 1, 'Tổng công ty Tân Cảng Sài Gòn (Saigon Newport)', 'Predictive Route AI', 520000000.00, 25000000.00, 130000000.00, 'PAID'),
('TX-2026-0918-06', '2026-09-18', 1, 'Tập đoàn Y tế Medicorp', 'Clinical LLM Assistant', 410000000.00, 0.00, 95000000.00, 'PENDING'),

-- Dept 3: B2B-SALES (6 transactions, Net = 5,445,000,000 | Target = 5,000,000,000 | +8.9% EXCEEDED)
('TX-2026-0902-07', '2026-09-02', 3, 'Tổng công ty May XNK Nam Định', 'Annual ERP SaaS Renewal', 950000000.00, 50000000.00, 280000000.00, 'PAID'),
('TX-2026-0905-08', '2026-09-05', 3, 'Tập đoàn Vingroup (VinFast)', 'Corporate Cloud Package', 1400000000.00, 70000000.00, 400000000.00, 'PAID'),
('TX-2026-0909-09', '2026-09-09', 3, 'Tập đoàn Masan (WinCommerce)', 'Smart Retail Cloud License', 820000000.00, 40000000.00, 220000000.00, 'PAID'),
('TX-2026-0912-10', '2026-09-12', 3, 'Chuỗi Cà phê Highlands Star', 'POS Data Integration', 730000000.00, 35000000.00, 190000000.00, 'PAID'),
('TX-2026-0916-11', '2026-09-16', 3, 'Công ty CP Sữa Việt Nam (Vinamilk)', 'Enterprise Analytics Suite', 1150000000.00, 50000000.00, 310000000.00, 'PAID'),
('TX-2026-0919-12', '2026-09-19', 3, 'Tập đoàn Hòa Phát', 'Supply Chain Visibility Module', 640000000.00, 0.00, 175000000.00, 'PAID'),

-- Dept 4: SUP-LOG (4 transactions, Net = 2,420,000,000 | Target = 2,500,000,000 | 96.8% ON TRACK)
('TX-2026-0904-13', '2026-09-04', 4, 'Cảng Quốc tế Cái Mép (Gemalink)', 'Automated Dispatch Hub', 620000000.00, 20000000.00, 180000000.00, 'PAID'),
('TX-2026-0908-14', '2026-09-08', 4, 'Kho lạnh Thông minh Miền Nam', 'Temperature Sensor Telemetry', 480000000.00, 15000000.00, 140000000.00, 'PAID'),
('TX-2026-0914-15', '2026-09-14', 4, 'Hãng chuyển phát Nhanh 247', 'Dynamic Routing Optimization', 890000000.00, 45000000.00, 260000000.00, 'PAID'),
('TX-2026-0917-16', '2026-09-17', 4, 'Tổng kho Nông sản Tây Nguyên', 'Fleet Telematics Subscription', 530000000.00, 20000000.00, 155000000.00, 'PAID');

-- ------------------------------------------------------------------------------
-- 7. Audit Ledger Table (SOX 404 & IFRS-15 Compliance)
-- ------------------------------------------------------------------------------
CREATE TABLE audit_ledger (
    id SERIAL PRIMARY KEY,
    audit_code VARCHAR(50) UNIQUE NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    actor_email VARCHAR(100) NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    records_impacted INT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

INSERT INTO audit_ledger (audit_code, action_type, actor_email, sha256_checksum, records_impacted, metadata) VALUES
('AUD-20260901-01', 'FINANCIAL_INGESTION', 'long.lh@enterprise.vn', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 6, '{"source": "ERP Ingress", "status": "VERIFIED"}'),
('AUD-20260915-02', 'BUDGET_RECONCILIATION', 'thanh.nv@enterprise.vn', 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e', 16, '{"variance_rate": "+6.6%", "reconciled_with": "KeHoach_NganSach_Q3_2026.xlsx"}');

-- ------------------------------------------------------------------------------
-- 8. Analytical Views for C-Suite Boardroom & Visual Charts
-- ------------------------------------------------------------------------------

-- View 1: Biến thiên doanh thu theo ngày Tháng 9/2026 (Daily Revenue & Margin Trend)
CREATE OR REPLACE VIEW v_daily_revenue_trend AS
SELECT 
    t.transaction_date,
    COUNT(t.id) AS total_deals,
    SUM(t.contract_value) AS total_contract_value,
    SUM(t.discount_amount) AS total_discounts,
    SUM(t.net_revenue) AS total_net_revenue,
    SUM(t.cogs_amount) AS total_cogs,
    SUM(t.gross_profit) AS total_gross_profit,
    ROUND((SUM(t.gross_profit) / NULLIF(SUM(t.net_revenue), 0) * 100), 2) AS gross_margin_pct
FROM revenue_transactions t
WHERE t.payment_status IN ('PAID', 'PENDING')
  AND EXTRACT(MONTH FROM t.transaction_date) = 9
GROUP BY t.transaction_date
ORDER BY t.transaction_date ASC;

-- View 2: Hiệu quả phòng ban Q3/2026 (Tháng 9 Target vs Actual)
CREATE OR REPLACE VIEW v_department_performance_q3 AS
SELECT 
    d.code AS dept_code,
    d.name AS dept_name,
    COALESCE(SUM(t.net_revenue), 0) AS actual_revenue,
    COALESCE(MAX(b.target_revenue), 0) AS target_revenue,
    ROUND((COALESCE(SUM(t.net_revenue), 0) - COALESCE(MAX(b.target_revenue), 0)), 2) AS variance_amount,
    ROUND((COALESCE(SUM(t.net_revenue), 0) / NULLIF(MAX(b.target_revenue), 0) * 100), 2) AS target_achievement_pct
FROM departments d
LEFT JOIN revenue_transactions t ON d.id = t.department_id AND EXTRACT(MONTH FROM t.transaction_date) = 9 AND t.payment_status IN ('PAID', 'PENDING')
LEFT JOIN monthly_budgets b ON d.id = b.department_id AND b.fiscal_year = 2026 AND b.fiscal_month = 9
GROUP BY d.id, d.code, d.name
ORDER BY actual_revenue DESC;

-- View 3: Đóng góp doanh thu theo đối tác khách hàng (Top Client Contribution)
CREATE OR REPLACE VIEW v_client_revenue_contribution AS
SELECT 
    t.client_name,
    COUNT(t.id) AS deal_count,
    SUM(t.net_revenue) AS total_revenue,
    SUM(t.gross_profit) AS total_profit,
    ROUND(SUM(t.net_revenue) / (SELECT SUM(net_revenue) FROM revenue_transactions WHERE payment_status IN ('PAID', 'PENDING')) * 100, 2) AS contribution_pct
FROM revenue_transactions t
WHERE t.payment_status IN ('PAID', 'PENDING')
GROUP BY t.client_name
ORDER BY total_revenue DESC;

-- View 4: Phân tích cơ cấu và biên lợi nhuận theo danh mục sản phẩm
CREATE OR REPLACE VIEW v_product_performance AS
SELECT 
    t.product_category,
    COUNT(t.id) AS deal_count,
    SUM(t.net_revenue) AS category_revenue,
    SUM(t.gross_profit) AS category_profit,
    ROUND((SUM(t.gross_profit) / NULLIF(SUM(t.net_revenue), 0) * 100), 2) AS profit_margin_pct
FROM revenue_transactions t
WHERE t.payment_status IN ('PAID', 'PENDING')
GROUP BY t.product_category
ORDER BY category_revenue DESC;

-- View 5: Phân tích tuổi nợ công nợ khách hàng (Accounts Receivable Aging)
CREATE OR REPLACE VIEW v_accounts_receivable_aging AS
SELECT 
    t.client_name,
    d.name AS department_name,
    t.payment_status,
    COUNT(t.id) AS total_invoices,
    SUM(t.net_revenue) AS total_receivable_vnd,
    MAX(t.transaction_date) AS latest_transaction_date,
    CASE 
        WHEN t.payment_status = 'PAID' THEN 'Đã thu tiền'
        WHEN t.payment_status = 'PENDING' THEN 'Đang trong hạn'
        WHEN t.payment_status = 'OVERDUE' THEN 'Quá hạn thu hồi'
        ELSE 'Khác'
    END AS aging_bucket
FROM revenue_transactions t
JOIN departments d ON t.department_id = d.id
GROUP BY t.client_name, d.name, t.payment_status
ORDER BY total_receivable_vnd DESC;

-- ------------------------------------------------------------------------------
-- 9. Enterprise Row-Level Security (RLS) Setup
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'executive_reader') THEN
        CREATE ROLE executive_reader WITH LOGIN PASSWORD 'ExecReaderSecret2026!';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dept_employee_reader') THEN
        CREATE ROLE dept_employee_reader WITH LOGIN PASSWORD 'DeptReaderSecret2026!';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'enterprise_app') THEN
        CREATE ROLE enterprise_app WITH LOGIN PASSWORD 'AppSecretSecure2026!';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dwh_readonly') THEN
        CREATE ROLE dwh_readonly WITH LOGIN PASSWORD 'ReadOnlyDwhPass2026!';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO executive_reader, dept_employee_reader, enterprise_app, dwh_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO executive_reader, dept_employee_reader, enterprise_app, dwh_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO executive_reader, dept_employee_reader, enterprise_app, dwh_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO executive_reader, dept_employee_reader, enterprise_app, dwh_readonly;

ALTER TABLE revenue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dept_isolation_policy ON revenue_transactions;
CREATE POLICY dept_isolation_policy ON revenue_transactions
    FOR SELECT
    TO dept_employee_reader
    USING (
        department_id = NULLIF(CURRENT_SETTING('app.current_department_id', true), '')::INT
    );

DROP POLICY IF EXISTS executive_full_access_policy ON revenue_transactions;
CREATE POLICY executive_full_access_policy ON revenue_transactions
    FOR ALL
    TO executive_reader, postgres, enterprise_app
    USING (true);

