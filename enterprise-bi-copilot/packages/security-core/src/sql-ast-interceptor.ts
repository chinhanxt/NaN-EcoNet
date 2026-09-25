// =============================================================================
// ENTERPRISE EXECUTIVE COPILOT: SQL AST & READ-ONLY SECURITY INTERCEPTOR
// Tier 3 Defense: Prevents all DDL/DML, Stacking Injections, and System Exploits
// =============================================================================

export class SecurityViolationError extends Error {
  public readonly code = 'SECURITY_VIOLATION';
  constructor(message: string, public readonly rule: string, public readonly attemptedQuery: string) {
    super(`[SecurityViolation: ${rule}] ${message}`);
    this.name = 'SecurityViolationError';
  }
}

export interface SanitizedQueryOutput {
  sanitizedSql: string;
  enforcedLimit: number;
  isCTE: boolean;
}

const FORBIDDEN_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'COPY',
  'REINDEX',
  'VACUUM',
  'CLUSTER',
  'EXPLAIN ANALYZE',
  'LOCK',
  'CALL',
  'DO'
];

const DANGEROUS_FUNCTIONS = [
  'pg_read_file',
  'pg_write_file',
  'pg_read_binary_file',
  'pg_write_binary_file',
  'pg_sleep',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_ls_dir',
  'query_to_xml',
  'dblink',
  'system',
  'lo_import',
  'lo_export'
];

export class SqlSecurityInterceptor {
  private static readonly MAX_ALLOWED_LIMIT = 1000;

  /**
   * Remove SQL comments and string literals to accurately scan tokens
   */
  private static stripLiteralsAndComments(rawSql: string): string {
    // Replace single-quoted string literals with empty placeholder ''
    const withoutStrings = rawSql.replace(/'(?:''|[^'])*'/g, "''");
    // Replace dollar-quoted strings ($tag$...$tag$)
    const withoutDollarQuotes = withoutStrings.replace(/\$([a-zA-Z0-9_]*)\$.*?\$\1\$/gs, "''");
    // Remove multi-line comments /* ... */
    const withoutBlockComments = withoutDollarQuotes.replace(/\/\*.*?\*\//gs, ' ');
    // Remove single-line comments -- ...
    const withoutLineComments = withoutBlockComments.replace(/--.*$/gm, ' ');

    return withoutLineComments;
  }

  /**
   * Inspect and sanitize incoming SQL query
   * Throws SecurityViolationError if any violation is caught
   */
  public static validateAndSanitize(rawSql: string): SanitizedQueryOutput {
    if (!rawSql || typeof rawSql !== 'string' || rawSql.trim().length === 0) {
      throw new SecurityViolationError('Empty query is not allowed', 'EMPTY_QUERY', rawSql);
    }

    const cleanSql = rawSql.trim();
    const tokenScanTarget = this.stripLiteralsAndComments(cleanSql);

    // 1. Check for Multiple Statements (Semicolons)
    // Semicolon is only allowed at the very end of the statement
    const trimmedScan = tokenScanTarget.trim();
    const semiColonIndex = trimmedScan.indexOf(';');
    if (semiColonIndex !== -1 && semiColonIndex < trimmedScan.length - 1) {
      throw new SecurityViolationError(
        'Multiple statements (semicolon query stacking) are strictly forbidden',
        'FORBIDDEN_MULTIPLE_STATEMENTS',
        rawSql
      );
    }

    // 2. Validate Root Statement Type (Must start with SELECT or WITH)
    const upperClean = tokenScanTarget.toUpperCase().trim();
    const isSelect = upperClean.startsWith('SELECT');
    const isCTE = upperClean.startsWith('WITH');

    if (!isSelect && !isCTE) {
      throw new SecurityViolationError(
        'Only SELECT or WITH (CTE) queries are permitted for execution',
        'NON_SELECT_ROOT_STATEMENT',
        rawSql
      );
    }

    // 3. Scan for Forbidden DDL/DML Keywords
    for (const keyword of FORBIDDEN_KEYWORDS) {
      // Use regex word boundary to avoid false positives (e.g., 'created_at' matching 'CREATE')
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(tokenScanTarget)) {
        throw new SecurityViolationError(
          `Query contains forbidden destructive keyword: ${keyword}`,
          'FORBIDDEN_KEYWORD',
          rawSql
        );
      }
    }

    // 4. Scan for Dangerous System Functions
    for (const func of DANGEROUS_FUNCTIONS) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'i');
      if (regex.test(tokenScanTarget)) {
        throw new SecurityViolationError(
          `Query attempts to call unauthorized system function: ${func}`,
          'FORBIDDEN_SYSTEM_FUNCTION',
          rawSql
        );
      }
    }

    // 5. Enforce Max Limit
    let sqlWithoutTrailingSemicolon = cleanSql.replace(/;+\s*$/, '');
    let enforcedLimit = this.MAX_ALLOWED_LIMIT;

    const limitMatch = tokenScanTarget.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const userLimit = parseInt(limitMatch[1], 10);
      if (userLimit > this.MAX_ALLOWED_LIMIT) {
        // Replace user limit with max allowed limit
        sqlWithoutTrailingSemicolon = sqlWithoutTrailingSemicolon.replace(
          new RegExp(`\\bLIMIT\\s+${userLimit}\\b`, 'i'),
          `LIMIT ${this.MAX_ALLOWED_LIMIT}`
        );
        enforcedLimit = this.MAX_ALLOWED_LIMIT;
      } else {
        enforcedLimit = userLimit;
      }
    } else {
      // Append LIMIT 1000 if not specified
      sqlWithoutTrailingSemicolon = `${sqlWithoutTrailingSemicolon} LIMIT ${this.MAX_ALLOWED_LIMIT}`;
    }

    return {
      sanitizedSql: sqlWithoutTrailingSemicolon,
      enforcedLimit,
      isCTE
    };
  }
}
