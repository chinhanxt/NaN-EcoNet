"""
Enterprise Security Guardrails Test Suite for MCP Text-to-SQL.
Tests multi-layer defense-in-depth:
1. Whitelist tables verification
2. Whitelist columns verification
3. Regex keyword blocking (DDL/DML: DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, EXEC, ATTACH, DETACH)
4. Semicolon stacking / SQL injection prevention
5. Mandatory LIMIT 100 enforcement
6. Read-Only mode enforcement (MODE_READONLY = true)
7. Rate limiting (30 queries/minute)
8. End-to-end parity with TypeScript security-guardrails.ts via Node.js
"""
import json
import os
import re
import subprocess
import time
import pytest

# =============================================================================
# Python Reference Implementation of Security Guardrails (Matching TS Logic)
# =============================================================================

MODE_READONLY = True

TABLE_WHITELIST = [
    'recycling_transactions',
    'epr_compliance_logs',
    'voucher_redemptions',
    'collection_metrics',
    'carbon_offset_summary'
]

COLUMN_WHITELIST = {
    'recycling_transactions': [
        'id', 'transaction_id', 'citizen_id', 'depot_id', 'material_type',
        'weight_kg', 'points_awarded', 'status', 'created_at', 'lat', 'lng'
    ],
    'epr_compliance_logs': [
        'id', 'log_id', 'enterprise_id', 'partner_id', 'material_category',
        'target_kg', 'collected_kg', 'compliance_pct', 'quarter', 'year',
        'status', 'verified_at'
    ],
    'voucher_redemptions': [
        'id', 'redemption_id', 'voucher_code', 'citizen_id', 'brand_id',
        'store_id', 'discount_amount', 'status', 'redeemed_at', 'burn_tx_hash'
    ],
    'collection_metrics': [
        'id', 'metric_id', 'route_id', 'vehicle_id', 'distance_km',
        'fuel_consumed_liters', 'stops_completed', 'duration_minutes',
        'recorded_date', 'shift_id'
    ],
    'carbon_offset_summary': [
        'id', 'summary_id', 'period_start', 'period_end', 'total_recycled_kg',
        'co2_avoided_kg', 'trees_equivalent', 'energy_saved_kwh', 'created_at'
    ]
}

DISALLOWED_KEYWORDS_REGEX = re.compile(
    r'\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|ATTACH|DETACH)\b',
    re.IGNORECASE
)

DEFAULT_QUERY_LIMIT = 100
MAX_ALLOWED_LIMIT = 500
RATE_LIMIT_MAX_QUERIES = 30
RATE_LIMIT_WINDOW_SECONDS = 60.0


class SecurityViolationError(Exception):
    def __init__(self, message: str, rule: str, attempted_query: str):
        super().__init__(f"[SecurityViolation: {rule}] {message}")
        self.code = "SECURITY_VIOLATION"
        self.rule = rule
        self.attempted_query = attempted_query


class RateLimitExceededError(Exception):
    def __init__(self, message: str, client_id: str, retry_after_s: float):
        super().__init__(f"[RateLimitExceeded] {message} (retry after {retry_after_s:.1f}s)")
        self.code = "RATE_LIMIT_EXCEEDED"
        self.client_id = client_id
        self.retry_after_s = retry_after_s


class PythonRateLimiter:
    def __init__(self, max_requests: int = RATE_LIMIT_MAX_QUERIES, window_s: float = RATE_LIMIT_WINDOW_SECONDS):
        self.max_requests = max_requests
        self.window_s = window_s
        self.requests = {}

    def check_limit(self, client_id: str):
        now = time.time()
        window_start = now - self.window_s
        timestamps = self.requests.get(client_id, [])
        valid_timestamps = [t for t in timestamps if t > window_start]

        if len(valid_timestamps) >= self.max_requests:
            retry_after = max(0.0, valid_timestamps[0] + self.window_s - now)
            raise RateLimitExceededError(
                f"Rate limit exceeded: maximum {self.max_requests} queries allowed per minute.",
                client_id,
                retry_after
            )

        valid_timestamps.append(now)
        self.requests[client_id] = valid_timestamps
        return {
            "remaining": self.max_requests - len(valid_timestamps),
            "retry_after_s": 0.0
        }

    def reset(self, client_id: str = None):
        if client_id:
            self.requests.pop(client_id, None)
        else:
            self.requests.clear()


default_rate_limiter = PythonRateLimiter()


def strip_literals_and_comments(raw_sql: str) -> str:
    # Remove single-quoted string literals
    without_strings = re.sub(r"'(?:''|[^'])*'", "''", raw_sql)
    # Remove block comments
    without_block_comments = re.sub(r"/\*.*?\*/", " ", without_strings, flags=re.DOTALL)
    # Remove line comments
    without_line_comments = re.sub(r"--.*$", " ", without_block_comments, flags=re.MULTILINE)
    return without_line_comments


def extract_referenced_tables(clean_sql_target: str) -> list:
    from_join_regex = re.compile(r'\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)', re.IGNORECASE)
    tables = set()
    for match in from_join_regex.finditer(clean_sql_target):
        raw_table = match.group(1)
        table_name = raw_table.split('.')[1] if '.' in raw_table else raw_table
        tables.add(table_name.lower())
    return sorted(list(tables))


def validate_and_sanitize_query(
    raw_sql: str,
    client_id: str = "default_session",
    rate_limiter: PythonRateLimiter = default_rate_limiter,
    enforce_readonly: bool = MODE_READONLY
) -> dict:
    if not enforce_readonly:
        raise SecurityViolationError(
            "System is not operating in required read-only mode",
            "READONLY_MODE_VIOLATION",
            raw_sql
        )

    rate_status = rate_limiter.check_limit(client_id)

    if not raw_sql or not raw_sql.strip():
        raise SecurityViolationError("Empty query is not allowed", "EMPTY_QUERY", raw_sql or "")

    clean_sql = raw_sql.strip()
    token_scan_target = strip_literals_and_comments(clean_sql)
    trimmed_scan = token_scan_target.strip()

    # Multi-statement semicolon check
    semi_colon_idx = trimmed_scan.find(';')
    if semi_colon_idx != -1 and semi_colon_idx < len(trimmed_scan) - 1:
        raise SecurityViolationError(
            "Multiple statements (semicolon query stacking) are strictly forbidden",
            "FORBIDDEN_MULTIPLE_STATEMENTS",
            raw_sql
        )

    # Root statement check
    upper_scan = trimmed_scan.upper()
    is_select = upper_scan.startswith("SELECT")
    is_cte = upper_scan.startswith("WITH")
    if not is_select and not is_cte:
        raise SecurityViolationError(
            "Only SELECT queries (or WITH Common Table Expressions) are permitted",
            "NON_SELECT_ROOT_STATEMENT",
            raw_sql
        )

    # Disallowed DDL/DML Keywords check
    keyword_match = DISALLOWED_KEYWORDS_REGEX.search(token_scan_target)
    if keyword_match:
        matched_kw = keyword_match.group(1).upper()
        raise SecurityViolationError(
            f"Query contains disallowed DDL/DML keyword: '{matched_kw}'",
            "DISALLOWED_KEYWORD",
            raw_sql
        )

    # Whitelist tables check
    tables = extract_referenced_tables(token_scan_target)
    if not tables:
        raise SecurityViolationError(
            "Query does not specify a valid target table",
            "NO_TABLE_SPECIFIED",
            raw_sql
        )

    for tbl in tables:
        if tbl not in TABLE_WHITELIST:
            raise SecurityViolationError(
                f"Table '{tbl}' is not in the authorized analytics whitelist. Authorized tables: [{', '.join(TABLE_WHITELIST)}]",
                "UNAUTHORIZED_TABLE",
                raw_sql
            )

    # Whitelist columns check (for table.column patterns)
    col_regex = re.compile(r'\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b')
    for match in col_regex.finditer(token_scan_target):
        tbl = match.group(1).lower()
        col = match.group(2).lower()
        if tbl in TABLE_WHITELIST:
            allowed_cols = COLUMN_WHITELIST.get(tbl, [])
            if col not in allowed_cols:
                raise SecurityViolationError(
                    f"Column '{col}' is not in the whitelist for table '{tbl}'",
                    "UNAUTHORIZED_COLUMN",
                    raw_sql
                )

    # Mandatory LIMIT 100 enforcement
    sql_without_trailing_semi = re.sub(r';+\s*$', '', clean_sql)
    limit_match = re.search(r'\bLIMIT\s+(\d+)', token_scan_target, re.IGNORECASE)
    if limit_match:
        requested_limit = int(limit_match.group(1))
        if requested_limit > MAX_ALLOWED_LIMIT:
            sql_without_trailing_semi = re.sub(
                rf'\bLIMIT\s+{requested_limit}\b',
                f"LIMIT {DEFAULT_QUERY_LIMIT}",
                sql_without_trailing_semi,
                flags=re.IGNORECASE
            )
            enforced_limit = DEFAULT_QUERY_LIMIT
        else:
            enforced_limit = requested_limit
    else:
        sql_without_trailing_semi = f"{sql_without_trailing_semi} LIMIT {DEFAULT_QUERY_LIMIT}"
        enforced_limit = DEFAULT_QUERY_LIMIT

    return {
        "sanitized_sql": sql_without_trailing_semi,
        "enforced_limit": enforced_limit,
        "tables_referenced": tables,
        "read_only_mode": True,
        "rate_limit_remaining": rate_status["remaining"]
    }


# =============================================================================
# Pytest Test Cases
# =============================================================================

@pytest.fixture(autouse=True)
def reset_limiter():
    default_rate_limiter.reset()


def test_valid_select_on_whitelisted_table():
    """Test 1: Permitted standard SELECT queries on whitelisted table."""
    query = "SELECT id, weight_kg, material_type FROM recycling_transactions WHERE weight_kg > 5.0"
    res = validate_and_sanitize_query(query)

    assert res["enforced_limit"] == 100
    assert "LIMIT 100" in res["sanitized_sql"]
    assert res["tables_referenced"] == ["recycling_transactions"]
    assert res["read_only_mode"] is True


def test_block_drop_table():
    """Test 2: Block DROP TABLE statement."""
    drop_queries = [
        "DROP TABLE recycling_transactions",
        "drop table epr_compliance_logs;",
        "DROP DATABASE enterprise_dwh;"
    ]
    for q in drop_queries:
        with pytest.raises(SecurityViolationError) as exc_info:
            validate_and_sanitize_query(q)
        assert exc_info.value.code == "SECURITY_VIOLATION"
        assert exc_info.value.rule in ["NON_SELECT_ROOT_STATEMENT", "DISALLOWED_KEYWORD"]


def test_block_sql_injection_stacking():
    """Test 3: Block SQL Injection and semicolon query stacking."""
    injection_queries = [
        "' OR 1=1; DROP TABLE users; --",
        "SELECT * FROM recycling_transactions; DROP TABLE users;",
        "SELECT * FROM recycling_transactions WHERE id = '1'; DELETE FROM epr_compliance_logs;",
        "SELECT * FROM collection_metrics; TRUNCATE TABLE collection_metrics;"
    ]
    for q in injection_queries:
        with pytest.raises(SecurityViolationError) as exc_info:
            validate_and_sanitize_query(q)
        assert exc_info.value.code == "SECURITY_VIOLATION"


def test_block_sensitive_non_whitelisted_tables():
    """Test 4: Block queries targeting sensitive or system tables outside the whitelist."""
    unauthorized_queries = [
        "SELECT * FROM users",
        "SELECT username, password_hash FROM auth_credentials",
        "SELECT * FROM system_config WHERE key = 'api_secret'",
        "SELECT * FROM sqlite_master",
        "SELECT * FROM pg_catalog.pg_tables",
        "SELECT * FROM information_schema.tables"
    ]
    for q in unauthorized_queries:
        with pytest.raises(SecurityViolationError) as exc_info:
            validate_and_sanitize_query(q)
        assert exc_info.value.code == "SECURITY_VIOLATION"
        assert exc_info.value.rule in ["UNAUTHORIZED_TABLE", "DISALLOWED_KEYWORD"]


def test_mandatory_limit_100_unbounded():
    """Test 5: Automatically enforce LIMIT 100 on unbounded SELECT queries and cap excessive limits."""
    # Unbounded query gets LIMIT 100 appended
    unbounded = "SELECT id, weight_kg FROM recycling_transactions"
    res1 = validate_and_sanitize_query(unbounded)
    assert res1["sanitized_sql"].endswith("LIMIT 100")
    assert res1["enforced_limit"] == 100

    # Query with acceptable LIMIT 50 keeps LIMIT 50
    bounded_small = "SELECT id, weight_kg FROM recycling_transactions LIMIT 50"
    res2 = validate_and_sanitize_query(bounded_small)
    assert res2["enforced_limit"] == 50
    assert "LIMIT 50" in res2["sanitized_sql"]

    # Query with excessive LIMIT 1000 is clamped back to default 100
    excessive_limit = "SELECT id, weight_kg FROM recycling_transactions LIMIT 1000"
    res3 = validate_and_sanitize_query(excessive_limit)
    assert res3["enforced_limit"] == 100
    assert "LIMIT 100" in res3["sanitized_sql"]


def test_block_ddl_and_dml_operations():
    """Test 6: Verify blocking of all harmful DDL/DML keywords."""
    mutations = [
        "INSERT INTO recycling_transactions (id, weight_kg) VALUES ('tx-1', 20.0)",
        "UPDATE recycling_transactions SET weight_kg = 0.0 WHERE id = 'tx-1'",
        "DELETE FROM voucher_redemptions WHERE id = 'vrd-1'",
        "ALTER TABLE recycling_transactions ADD COLUMN backdoor TEXT",
        "TRUNCATE TABLE epr_compliance_logs",
        "GRANT ALL PRIVILEGES ON DATABASE enterprise TO public",
        "REVOKE SELECT ON recycling_transactions FROM analyst",
        "EXEC sp_executesql 'SELECT 1'",
        "ATTACH DATABASE '/tmp/pwn.db' AS pwn",
        "DETACH DATABASE pwn"
    ]
    for stmt in mutations:
        with pytest.raises(SecurityViolationError) as exc_info:
            validate_and_sanitize_query(stmt)
        assert exc_info.value.code == "SECURITY_VIOLATION"


def test_whitelist_columns_enforcement():
    """Test 7: Verify column whitelist validation on table.column references."""
    # Valid columns pass
    valid_query = "SELECT recycling_transactions.id, recycling_transactions.weight_kg FROM recycling_transactions"
    res = validate_and_sanitize_query(valid_query)
    assert res["tables_referenced"] == ["recycling_transactions"]

    # Invalid column on whitelisted table fails
    invalid_col_query = "SELECT recycling_transactions.secret_salary FROM recycling_transactions"
    with pytest.raises(SecurityViolationError) as exc_info:
        validate_and_sanitize_query(invalid_col_query)
    assert exc_info.value.rule == "UNAUTHORIZED_COLUMN"


def test_readonly_mode_assertion():
    """Test 8: Verify MODE_READONLY check."""
    assert MODE_READONLY is True
    # If read-only mode is deactivated, system rejects queries
    with pytest.raises(SecurityViolationError) as exc_info:
        validate_and_sanitize_query(
            "SELECT * FROM recycling_transactions",
            enforce_readonly=False
        )
    assert exc_info.value.rule == "READONLY_MODE_VIOLATION"


def test_rate_limiting_30_queries_per_minute():
    """Test 9: Enforce rate limiting of 30 queries per minute."""
    client = "analyst_session_01"
    limiter = PythonRateLimiter(max_requests=30, window_s=60.0)

    # First 30 queries succeed
    for i in range(30):
        res = validate_and_sanitize_query(
            "SELECT id FROM recycling_transactions",
            client_id=client,
            rate_limiter=limiter
        )
        assert res["rate_limit_remaining"] == 29 - i

    # 31st query must raise RateLimitExceededError
    with pytest.raises(RateLimitExceededError) as exc_info:
        validate_and_sanitize_query(
            "SELECT id FROM recycling_transactions",
            client_id=client,
            rate_limiter=limiter
        )
    assert exc_info.value.code == "RATE_LIMIT_EXCEEDED"
    assert exc_info.value.client_id == client


def test_node_typescript_guardrails_parity():
    """Test 10: End-to-end integration test executing the actual security-guardrails.ts via Node.js."""
    ts_file = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../apps/ecopass-enterprise/enterprise-bi-copilot/src/security-guardrails.ts"
        )
    )
    assert os.path.exists(ts_file), f"TypeScript file not found: {ts_file}"

    runner_script = f"""
    import {{
      validateAndSanitizeQuery,
      TABLE_WHITELIST,
      MODE_READONLY,
      SecurityViolationError,
      RateLimitExceededError
    }} from 'file://{ts_file}';

    const tests = [
      () => {{
        // Test valid select
        const r = validateAndSanitizeQuery('SELECT id, weight_kg FROM recycling_transactions');
        if (!r.sanitizedSql.includes('LIMIT 100')) throw new Error('Unbounded query did not get LIMIT 100');
        if (r.enforcedLimit !== 100) throw new Error('Limit not 100');
      }},
      () => {{
        // Test DROP table block
        try {{
          validateAndSanitizeQuery('DROP TABLE recycling_transactions');
          throw new Error('DROP TABLE was not blocked');
        }} catch (e) {{
          if (e.code !== 'SECURITY_VIOLATION') throw e;
        }}
      }},
      () => {{
        // Test unauthorized table
        try {{
          validateAndSanitizeQuery('SELECT * FROM users');
          throw new Error('Unauthorized table users was not blocked');
        }} catch (e) {{
          if (e.code !== 'SECURITY_VIOLATION') throw e;
        }}
      }},
      () => {{
        // Test injection
        try {{
          validateAndSanitizeQuery("' OR 1=1; DROP TABLE users; --");
          throw new Error('Injection was not blocked');
        }} catch (e) {{
          if (e.code !== 'SECURITY_VIOLATION') throw e;
        }}
      }}
    ];

    for (const t of tests) {{
      t();
    }}
    console.log(JSON.stringify({{ success: true, count: tests.length }}));
    """

    res = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", runner_script],
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Node execution failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    assert '"success":true' in res.stdout
