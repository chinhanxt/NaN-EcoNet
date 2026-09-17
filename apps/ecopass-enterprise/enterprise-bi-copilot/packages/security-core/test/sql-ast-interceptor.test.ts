import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SqlSecurityInterceptor, SecurityViolationError } from '../src/sql-ast-interceptor.js';

describe('SqlSecurityInterceptor - Enterprise Read-Only Security Guard', () => {
  // Test 1: Valid Analytical Queries
  it('should ALLOW valid SELECT query and enforce LIMIT 1000 if not present', () => {
    const query = 'SELECT transaction_date, total_net_revenue FROM v_daily_revenue_trend';
    const result = SqlSecurityInterceptor.validateAndSanitize(query);
    assert.strictEqual(result.enforcedLimit, 1000);
    assert.match(result.sanitizedSql, /LIMIT 1000/);
    assert.strictEqual(result.isCTE, false);
  });

  it('should ALLOW valid SELECT query with custom LIMIT <= 1000', () => {
    const query = 'SELECT * FROM departments LIMIT 5;';
    const result = SqlSecurityInterceptor.validateAndSanitize(query);
    assert.strictEqual(result.enforcedLimit, 5);
    assert.match(result.sanitizedSql, /LIMIT 5/);
  });

  it('should CAP user LIMIT if it exceeds MAX_ALLOWED_LIMIT (1000)', () => {
    const query = 'SELECT * FROM revenue_transactions LIMIT 50000;';
    const result = SqlSecurityInterceptor.validateAndSanitize(query);
    assert.strictEqual(result.enforcedLimit, 1000);
    assert.match(result.sanitizedSql, /LIMIT 1000/);
  });

  it('should ALLOW valid Common Table Expression (CTE / WITH clause)', () => {
    const query = `
      WITH dept_rev AS (
        SELECT department_id, SUM(net_revenue) as rev 
        FROM revenue_transactions 
        GROUP BY department_id
      )
      SELECT d.name, r.rev 
      FROM departments d 
      JOIN dept_rev r ON d.id = r.department_id
    `;
    const result = SqlSecurityInterceptor.validateAndSanitize(query);
    assert.strictEqual(result.isCTE, true);
    assert.match(result.sanitizedSql, /LIMIT 1000/);
  });

  it('should ALLOW legitimate string literals containing SQL keywords without false positives', () => {
    const query = "SELECT * FROM departments WHERE name = 'DROP TABLE TEST' AND code != 'DELETE'";
    const result = SqlSecurityInterceptor.validateAndSanitize(query);
    assert.match(result.sanitizedSql, /WHERE name = 'DROP TABLE TEST'/);
  });

  // Test 2: Attack Vectors & Destructive Commands
  it('should BLOCK multi-statement stacking injection (semicolon attack)', () => {
    const query = 'SELECT * FROM departments; DROP TABLE revenue_transactions;';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError && err.rule === 'FORBIDDEN_MULTIPLE_STATEMENTS'
    );
  });

  it('should BLOCK DROP statements', () => {
    const query = 'DROP TABLE revenue_transactions;';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK DELETE statements', () => {
    const query = 'DELETE FROM employees WHERE id = 1';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK UPDATE statements', () => {
    const query = 'UPDATE employees SET base_salary = 999999999 WHERE id = 1';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK INSERT statements', () => {
    const query = "INSERT INTO departments (code, name) VALUES ('HACK', 'Hacked')";
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK TRUNCATE statements', () => {
    const query = 'TRUNCATE TABLE monthly_budgets';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK ALTER TABLE statements', () => {
    const query = 'ALTER TABLE employees ADD COLUMN backdoor text';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK GRANT/REVOKE privilege escalation', () => {
    const query = 'GRANT ALL PRIVILEGES ON DATABASE enterprise_dwh TO dept_employee_reader';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError
    );
  });

  it('should BLOCK dangerous system function pg_sleep (DoS attack)', () => {
    const query = 'SELECT transaction_date, pg_sleep(10) FROM revenue_transactions';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError && err.rule === 'FORBIDDEN_SYSTEM_FUNCTION'
    );
  });

  it('should BLOCK dangerous file exfiltration pg_read_file', () => {
    const query = "SELECT pg_read_file('/etc/passwd')";
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError && err.rule === 'FORBIDDEN_SYSTEM_FUNCTION'
    );
  });

  it('should BLOCK pg_terminate_backend attack', () => {
    const query = 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity';
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize(query),
      (err: any) => err instanceof SecurityViolationError && err.rule === 'FORBIDDEN_SYSTEM_FUNCTION'
    );
  });

  it('should BLOCK empty or whitespace queries', () => {
    assert.throws(
      () => SqlSecurityInterceptor.validateAndSanitize('   '),
      (err: any) => err instanceof SecurityViolationError && err.rule === 'EMPTY_QUERY'
    );
  });
});
