// =============================================================================
// ECOPASS ENTERPRISE BI COPILOT: MULTI-LAYER SECURITY GUARDRAILS
// Tiered Defense-in-Depth for Text-to-SQL Execution
// =============================================================================

/**
 * Read-Only connection configuration enforcement flag
 */
export const MODE_READONLY: boolean = true;

/**
 * Whitelist of permissible analytics tables.
 * Any reference to tables outside this list (e.g. users, passwords, api_keys, system tables)
 * is strictly blocked before reaching the database engine.
 */
export const TABLE_WHITELIST = [
  'recycling_transactions',
  'epr_compliance_logs',
  'voucher_redemptions',
  'collection_metrics',
  'carbon_offset_summary'
] as const;

export type WhitelistedTable = typeof TABLE_WHITELIST[number];

/**
 * Whitelist of columns permitted for querying for each whitelisted table.
 */
export const COLUMN_WHITELIST: Record<WhitelistedTable, readonly string[]> = {
  recycling_transactions: [
    'id',
    'transaction_id',
    'citizen_id',
    'depot_id',
    'material_type',
    'weight_kg',
    'points_awarded',
    'status',
    'created_at',
    'lat',
    'lng'
  ],
  epr_compliance_logs: [
    'id',
    'log_id',
    'enterprise_id',
    'partner_id',
    'material_category',
    'target_kg',
    'collected_kg',
    'compliance_pct',
    'quarter',
    'year',
    'status',
    'verified_at'
  ],
  voucher_redemptions: [
    'id',
    'redemption_id',
    'voucher_code',
    'citizen_id',
    'brand_id',
    'store_id',
    'discount_amount',
    'status',
    'redeemed_at',
    'burn_tx_hash'
  ],
  collection_metrics: [
    'id',
    'metric_id',
    'route_id',
    'vehicle_id',
    'distance_km',
    'fuel_consumed_liters',
    'stops_completed',
    'duration_minutes',
    'recorded_date',
    'shift_id'
  ],
  carbon_offset_summary: [
    'id',
    'summary_id',
    'period_start',
    'period_end',
    'total_recycled_kg',
    'co2_avoided_kg',
    'trees_equivalent',
    'energy_saved_kwh',
    'created_at'
  ]
};

/**
 * Disallowed DDL and DML keywords regular expression.
 * Blocks any destructive or mutating operation.
 */
export const DISALLOWED_KEYWORDS_REGEX =
  /(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|ATTACH|DETACH)/i;

/**
 * Enforced default and maximum limit bounds
 */
export const DEFAULT_QUERY_LIMIT = 100;
export const MAX_ALLOWED_LIMIT = 500;

/**
 * Rate Limiting specifications: 30 queries per minute per client session
 */
export const RATE_LIMIT_MAX_QUERIES = 30;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

export class SecurityViolationError extends Error {
  public readonly code = 'SECURITY_VIOLATION';
  public readonly rule: string;
  public readonly attemptedQuery: string;

  constructor(message: string, rule: string, attemptedQuery: string) {
    super(`[SecurityViolation: ${rule}] ${message}`);
    this.name = 'SecurityViolationError';
    this.rule = rule;
    this.attemptedQuery = attemptedQuery;
  }
}

export class RateLimitExceededError extends Error {
  public readonly code = 'RATE_LIMIT_EXCEEDED';
  public readonly clientId: string;
  public readonly retryAfterMs: number;

  constructor(message: string, clientId: string, retryAfterMs: number) {
    super(`[RateLimitExceeded] ${message} (retry after ${Math.ceil(retryAfterMs / 1000)}s)`);
    this.name = 'RateLimitExceededError';
    this.clientId = clientId;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface SanitizedQueryOutput {
  sanitizedSql: string;
  enforcedLimit: number;
  tablesReferenced: string[];
  readOnlyMode: boolean;
  rateLimitRemaining: number;
}

/**
 * In-Memory Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    maxRequests: number = RATE_LIMIT_MAX_QUERIES,
    windowMs: number = RATE_LIMIT_WINDOW_MS
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check and record a query request from a clientId.
   * Throws RateLimitExceededError if rate is exceeded.
   */
  public checkLimit(clientId: string): { remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.requests.get(clientId) || [];
    // Retain only requests within the active window
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= this.maxRequests) {
      const oldestInWindow = validTimestamps[0];
      const retryAfterMs = Math.max(0, oldestInWindow + this.windowMs - now);
      throw new RateLimitExceededError(
        `Rate limit exceeded: maximum ${this.maxRequests} queries allowed per minute.`,
        clientId,
        retryAfterMs
      );
    }

    validTimestamps.push(now);
    this.requests.set(clientId, validTimestamps);

    return {
      remaining: this.maxRequests - validTimestamps.length,
      retryAfterMs: 0
    };
  }

  public reset(clientId?: string): void {
    if (clientId) {
      this.requests.delete(clientId);
    } else {
      this.requests.clear();
    }
  }
}

export const globalRateLimiter = new SlidingWindowRateLimiter();

/**
 * Utility to strip SQL string literals and comments to avoid evasion or false positives.
 */
export function stripLiteralsAndComments(rawSql: string): string {
  // Replace string literals '...' (and escaped '') with empty ''
  const withoutStrings = rawSql.replace(/'(?:''|[^'])*'/g, "''");
  // Replace dollar-quoted strings ($tag$...$tag$)
  const withoutDollarQuotes = withoutStrings.replace(/\$([a-zA-Z0-9_]*)\$.*?\$\1\$/gs, "''");
  // Remove block comments /* ... */
  const withoutBlockComments = withoutDollarQuotes.replace(/\/\*.*?\*\//gs, ' ');
  // Remove line comments -- ...
  const withoutLineComments = withoutBlockComments.replace(/--.*$/gm, ' ');

  return withoutLineComments;
}

/**
 * Extract table names referenced in FROM and JOIN clauses.
 */
export function extractReferencedTables(cleanSqlTarget: string): string[] {
  const tables: Set<string> = new Set();
  
  // Match patterns like: FROM table_name, JOIN table_name, INTO table_name, UPDATE table_name
  const fromJoinRegex = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = fromJoinRegex.exec(cleanSqlTarget)) !== null) {
    const rawTable = match[1];
    // Strip schema prefix if present (e.g. public.recycling_transactions -> recycling_transactions)
    const tableName = rawTable.includes('.') ? rawTable.split('.')[1] : rawTable;
    tables.add(tableName.toLowerCase());
  }

  return Array.from(tables);
}

/**
 * Validate and sanitize an incoming SQL query.
 * 
 * Enforces:
 * 1. Read-Only flag assertion (MODE_READONLY = true)
 * 2. Rate limiting (30 queries/minute)
 * 3. Prevention of multiple stacked queries (semicolon injection)
 * 4. Root query validation (must begin with SELECT or WITH)
 * 5. Disallowed DDL/DML keywords regex check
 * 6. Whitelist tables verification (rejects unwhitelisted or sensitive tables)
 * 7. Whitelist columns verification
 * 8. Mandatory LIMIT 100 enforcement (appends LIMIT 100 if omitted, caps excessive limits)
 */
export function validateAndSanitizeQuery(
  rawSql: string,
  clientId: string = 'default_session',
  rateLimiter: SlidingWindowRateLimiter = globalRateLimiter
): SanitizedQueryOutput {
  // 1. Verify Read-Only Mode enforcement
  if (!MODE_READONLY) {
    throw new SecurityViolationError(
      'System is not operating in required read-only mode',
      'READONLY_MODE_VIOLATION',
      rawSql
    );
  }

  // 2. Enforce Rate Limiting
  const rateLimitStatus = rateLimiter.checkLimit(clientId);

  if (!rawSql || typeof rawSql !== 'string' || rawSql.trim().length === 0) {
    throw new SecurityViolationError('Empty query is not allowed', 'EMPTY_QUERY', rawSql || '');
  }

  const cleanSql = rawSql.trim();
  const tokenScanTarget = stripLiteralsAndComments(cleanSql);
  const trimmedScan = tokenScanTarget.trim();

  // 3. Multi-statement Semicolon Stacking Detection
  // Semicolons are only permitted at the very end of the string
  const semiColonIndex = trimmedScan.indexOf(';');
  if (semiColonIndex !== -1 && semiColonIndex < trimmedScan.length - 1) {
    throw new SecurityViolationError(
      'Multiple statements (semicolon query stacking) are strictly forbidden',
      'FORBIDDEN_MULTIPLE_STATEMENTS',
      rawSql
    );
  }

  // 4. Root Statement Validation (Must start with SELECT or WITH)
  const upperScan = trimmedScan.toUpperCase();
  const isSelect = upperScan.startsWith('SELECT');
  const isCTE = upperScan.startsWith('WITH');

  if (!isSelect && !isCTE) {
    throw new SecurityViolationError(
      'Only SELECT queries (or WITH Common Table Expressions) are permitted',
      'NON_SELECT_ROOT_STATEMENT',
      rawSql
    );
  }

  // 5. Disallowed DDL/DML Keywords Detection via Regex
  const keywordMatches = tokenScanTarget.match(
    /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|ATTACH|DETACH)\b/i
  );
  if (keywordMatches || DISALLOWED_KEYWORDS_REGEX.test(tokenScanTarget)) {
    const matched = keywordMatches ? keywordMatches[0] : 'DISALLOWED_OPERATION';
    if (keywordMatches) {
      throw new SecurityViolationError(
        `Query contains disallowed DDL/DML keyword: '${matched.toUpperCase()}'`,
        'DISALLOWED_KEYWORD',
        rawSql
      );
    }
  }

  // 6. Whitelist Tables Enforcement
  const referencedTables = extractReferencedTables(tokenScanTarget);
  if (referencedTables.length === 0) {
    throw new SecurityViolationError(
      'Query does not specify a valid target table',
      'NO_TABLE_SPECIFIED',
      rawSql
    );
  }

  for (const table of referencedTables) {
    if (!TABLE_WHITELIST.includes(table as WhitelistedTable)) {
      throw new SecurityViolationError(
        `Table '${table}' is not in the authorized analytics whitelist. Authorized tables: [${TABLE_WHITELIST.join(', ')}]`,
        'UNAUTHORIZED_TABLE',
        rawSql
      );
    }
  }

  // 7. Whitelist Columns Verification
  // Check for any qualified column references like `table.column`
  const qualifiedColRegex = /\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b/g;
  let colMatch: RegExpExecArray | null;
  while ((colMatch = qualifiedColRegex.exec(tokenScanTarget)) !== null) {
    const tbl = colMatch[1].toLowerCase();
    const col = colMatch[2].toLowerCase();
    if (TABLE_WHITELIST.includes(tbl as WhitelistedTable)) {
      const allowedCols = COLUMN_WHITELIST[tbl as WhitelistedTable];
      if (!allowedCols.includes(col)) {
        throw new SecurityViolationError(
          `Column '${col}' is not in the whitelist for table '${tbl}'`,
          'UNAUTHORIZED_COLUMN',
          rawSql
        );
      }
    }
  }

  // 8. Mandatory LIMIT 100 Enforcement
  let sqlWithoutTrailingSemicolon = cleanSql.replace(/;+\s*$/, '');
  let enforcedLimit = DEFAULT_QUERY_LIMIT;

  const limitMatch = tokenScanTarget.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    const requestedLimit = parseInt(limitMatch[1], 10);
    if (requestedLimit > MAX_ALLOWED_LIMIT) {
      sqlWithoutTrailingSemicolon = sqlWithoutTrailingSemicolon.replace(
        new RegExp(`\\bLIMIT\\s+${requestedLimit}\\b`, 'i'),
        `LIMIT ${DEFAULT_QUERY_LIMIT}`
      );
      enforcedLimit = DEFAULT_QUERY_LIMIT;
    } else {
      enforcedLimit = requestedLimit;
    }
  } else {
    // Automatically append LIMIT 100 to unbounded SELECT queries
    sqlWithoutTrailingSemicolon = `${sqlWithoutTrailingSemicolon} LIMIT ${DEFAULT_QUERY_LIMIT}`;
    enforcedLimit = DEFAULT_QUERY_LIMIT;
  }

  return {
    sanitizedSql: sqlWithoutTrailingSemicolon,
    enforcedLimit,
    tablesReferenced: referencedTables,
    readOnlyMode: MODE_READONLY,
    rateLimitRemaining: rateLimitStatus.remaining
  };
}

/**
 * Export connection options for database adapters ensuring read-only guarantees
 */
export function getReadOnlyConnectionConfig() {
  return {
    mode: 'READONLY',
    readOnly: true,
    transactionCommand: 'BEGIN TRANSACTION READ ONLY'
  };
}
