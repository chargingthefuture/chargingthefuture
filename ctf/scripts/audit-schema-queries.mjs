#!/usr/bin/env node
/**
 * audit-schema-queries.mjs
 *
 * One-time bulk schema-drift detector.
 * Parses ctf/schema.sql to extract every CREATE TABLE and its columns,
 * then scans ctf/packages/web/ for SQL query strings and cross-references
 * table and column usage.
 *
 * Usage: node ctf/scripts/audit-schema-queries.mjs
 * Exit code = number of missing tables (0 = clean).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const SCHEMA_PATH = join(ROOT, 'ctf/schema.sql');
const WEB_DIR = join(ROOT, 'ctf/packages/web');

// ── 1. Parse schema.sql ──────────────────────────────────────────────

function parseSchema(sql) {
  /** @type {Map<string, Set<string>>} tableName → Set of column names */
  const tables = new Map();

  // Match CREATE TABLE IF NOT EXISTS <name> ( ... );
  const createRe =
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\S+)\s*\(([\s\S]*?)\);/gi;
  let m;
  while ((m = createRe.exec(sql)) !== null) {
    const tableName = m[1].replace(/"/g, '').toLowerCase();
    const body = m[2];
    if (!tables.has(tableName)) tables.set(tableName, new Set());
    const cols = tables.get(tableName);

    // Each line that looks like a column definition (starts with identifier, followed by type)
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      // Skip constraints, indexes, PRIMARY KEY/UNIQUE/CHECK/FOREIGN KEY lines
      if (
        /^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT|CREATE\s|--)/i.test(trimmed) ||
        trimmed === '' ||
        trimmed === ')'
      )
        continue;
      const colMatch = trimmed.match(/^"?([a-z_][a-z0-9_]*)"?\s+/i);
      if (colMatch) {
        cols.add(colMatch[1].toLowerCase());
      }
    }
  }

  // Also pick up ALTER TABLE ... ADD COLUMN IF NOT EXISTS <col>
  // Handles both individual statements and comma-separated blocks:
  //   ALTER TABLE t ADD COLUMN IF NOT EXISTS c1 TYPE,
  //     ADD COLUMN IF NOT EXISTS c2 TYPE;
  const alterBlockRe =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)\s+((?:ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?)(?:;|\n\n))/gi;
  while ((m = alterBlockRe.exec(sql)) !== null) {
    const tableName = m[1].replace(/"/g, '').toLowerCase();
    if (!tables.has(tableName)) tables.set(tableName, new Set());
    const cols = tables.get(tableName);
    // Extract each ADD COLUMN within the block
    const colRe = /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"?([a-z_][a-z0-9_]*)"?/gi;
    let cm;
    while ((cm = colRe.exec(m[2])) !== null) {
      cols.add(cm[1].toLowerCase());
    }
  }
  // Also handle single-line ALTER TABLE ... ADD COLUMN (non-block)
  const alterSingleRe =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"?([a-z_][a-z0-9_]*)"?/gi;
  while ((m = alterSingleRe.exec(sql)) !== null) {
    const tableName = m[1].replace(/"/g, '').toLowerCase();
    const colName = m[2].toLowerCase();
    if (!tables.has(tableName)) tables.set(tableName, new Set());
    tables.get(tableName).add(colName);
  }

  return tables;
}

// ── 2. Recursively collect .ts / .tsx files ───────────────────────────

function walkDir(dir, ext = ['.ts', '.tsx']) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...walkDir(full, ext));
    } else if (ext.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

// ── 2b. Strip comments (preserve string/template literals + line numbers) ──

/**
 * Removes JS/TS line (`//`) and block (`/* *\/`) comments from source so that
 * comment prose (e.g. "...overrides from scoring_config") is never mistaken for
 * a SQL query. String and template literals are preserved verbatim, and removed
 * comment characters are replaced with spaces so reported line numbers stay
 * accurate. Template literals are treated as opaque (their SQL content is kept).
 */
function stripComments(source) {
  const NORMAL = 0, LINE = 1, BLOCK = 2, SQ = 3, DQ = 4, TPL = 5;
  let state = NORMAL;
  let out = '';
  const n = source.length;
  for (let i = 0; i < n; i++) {
    const c = source[i];
    const next = i + 1 < n ? source[i + 1] : '';
    if (state === NORMAL) {
      if (c === '/' && next === '/') { state = LINE; out += '  '; i++; continue; }
      if (c === '/' && next === '*') { state = BLOCK; out += '  '; i++; continue; }
      if (c === "'") { state = SQ; out += c; continue; }
      if (c === '"') { state = DQ; out += c; continue; }
      if (c === '`') { state = TPL; out += c; continue; }
      out += c;
      continue;
    }
    if (state === LINE) {
      if (c === '\n') { state = NORMAL; out += c; } else { out += ' '; }
      continue;
    }
    if (state === BLOCK) {
      if (c === '*' && next === '/') { state = NORMAL; out += '  '; i++; continue; }
      out += c === '\n' ? '\n' : ' ';
      continue;
    }
    // String / template literal states: copy verbatim, honoring escapes.
    if (c === '\\') {
      out += c;
      if (i + 1 < n) out += source[i + 1];
      i++;
      continue;
    }
    out += c;
    if (state === SQ && c === "'") state = NORMAL;
    else if (state === DQ && c === '"') state = NORMAL;
    else if (state === TPL && c === '`') state = NORMAL;
  }
  return out;
}

// ── 3. Extract SQL table references from source files ─────────────────

/**
 * Extracts table names from SQL template literals in TypeScript source.
 * Only looks inside template literals or string literals that contain SQL keywords.
 * Returns array of { table, file, line, snippet }
 */
function extractTableRefs(filePath, source) {
  const refs = [];

  // SQL keywords / noise that look like table names but aren't
  const IGNORE = new Set([
    'select', 'from', 'where', 'and', 'or', 'not', 'null', 'true', 'false',
    'set', 'values', 'returning', 'on', 'as', 'in', 'is', 'by', 'order',
    'group', 'having', 'limit', 'offset', 'case', 'when', 'then', 'else',
    'end', 'exists', 'between', 'like', 'ilike', 'cast', 'coalesce',
    'conflict', 'nothing', 'do', 'update', 'default', 'now', 'count',
    'sum', 'max', 'min', 'avg', 'distinct', 'inner', 'outer', 'left',
    'right', 'cross', 'lateral', 'unnest', 'jsonb_build_object',
    'json_build_object', 'json_agg', 'jsonb_agg', 'array_agg',
    'gen_random_uuid', 'to_jsonb', 'row_number', 'over', 'partition',
    'extract', 'epoch', 'interval', 'current_timestamp', 'table',
    'index', 'constraint', 'primary', 'key', 'references', 'cascade',
    'check', 'unique', 'foreign', 'create', 'alter', 'drop', 'add',
    'column', 'type', 'boolean', 'text', 'integer', 'bigint', 'uuid',
    'timestamptz', 'timestamp', 'date', 'jsonb', 'json', 'serial',
    'varchar', 'numeric', 'real', 'float', 'double', 'smallint',
    'with', 'recursive', 'cte', 'pg_advisory_xact_lock',
  ]);

  // Extract template literals and regular strings that look like SQL
  const sqlBlockRe = /`([\s\S]*?)`|'([\s\S]*?)'/g;
  let blockMatch;
  while ((blockMatch = sqlBlockRe.exec(source)) !== null) {
    const block = blockMatch[1] ?? blockMatch[2] ?? '';
    // Only process blocks that contain SQL DML/DDL keywords
    if (!/\b(SELECT|INSERT|UPDATE|DELETE|FROM|JOIN)\b/i.test(block)) continue;

    const blockStartLine =
      source.substring(0, blockMatch.index).split('\n').length;

    // Collect CTE names defined in this block (WITH <name> AS (...))
    const cteNames = new Set();
    const cteRe = /\bWITH\s+([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;
    let cteM;
    while ((cteM = cteRe.exec(block)) !== null) {
      cteNames.add(cteM[1].toLowerCase());
    }
    // Also handle comma-separated CTEs: , <name> AS (
    const cteCommaRe = /,\s*([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;
    while ((cteM = cteCommaRe.exec(block)) !== null) {
      cteNames.add(cteM[1].toLowerCase());
    }

    // Patterns that reference table names in SQL
    const patterns = [
      /\bFROM\s+([a-z_][a-z0-9_]*)\b/gi,
      /\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)\b/gi,
      /\bUPDATE\s+([a-z_][a-z0-9_]*)\b/gi,
      /\bDELETE\s+FROM\s+([a-z_][a-z0-9_]*)\b/gi,
      /\bJOIN\s+([a-z_][a-z0-9_]*)\b/gi,
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let pm;
      while ((pm = pattern.exec(block)) !== null) {
        const table = pm[1].toLowerCase();
        if (IGNORE.has(table)) continue;
        if (table.startsWith('$')) continue;
        // Skip CTEs (they are query-local "tables", not real DB tables)
        if (cteNames.has(table)) continue;
        // Must be at least 3 chars (skip noise like "id", "pg")
        if (table.length < 3) continue;
        // Single-word names without underscores must be in a known-tables set
        // (all real tables in this codebase are multi-word snake_case except 'announcements')
        const KNOWN_SINGLE_WORD_TABLES = new Set(['announcements']);
        if (!table.includes('_') && !KNOWN_SINGLE_WORD_TABLES.has(table)) continue;
        const lineOffset = block.substring(0, pm.index).split('\n').length - 1;
        refs.push({
          table,
          file: filePath,
          line: blockStartLine + lineOffset,
          snippet: pm[0].trim().substring(0, 120),
        });
      }
    }
  }

  return refs;
}

/**
 * Extract column references from SELECT statements.
 * Returns array of { table, column, file, line }
 */
function extractColumnRefs(filePath, source) {
  const refs = [];
  // Look for multi-line SQL template literals
  const templateRe = /`([^`]*(?:SELECT|INSERT|UPDATE)[^`]*)`/gis;
  let tm;
  while ((tm = templateRe.exec(source)) !== null) {
    const sql = tm[0];
    const startLine =
      source.substring(0, tm.index).split('\n').length;

    // Find FROM <table> pairs and SELECT columns for that block
    const fromMatch = sql.match(
      /\bFROM\s+([a-z_][a-z0-9_]*)\b/i,
    );
    const updateMatch = sql.match(
      /\bUPDATE\s+([a-z_][a-z0-9_]*)\b/i,
    );
    const insertMatch = sql.match(
      /\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)\b/i,
    );

    const tableName = (
      fromMatch?.[1] ||
      updateMatch?.[1] ||
      insertMatch?.[1] ||
      ''
    ).toLowerCase();
    if (!tableName) continue;

    // Extract column names from SELECT clause
    const selectMatch = sql.match(/\bSELECT\s+([\s\S]*?)\bFROM\b/i);
    if (selectMatch) {
      const selectBody = selectMatch[1];
      // Split by comma, extract column names
      for (const part of selectBody.split(',')) {
        const cleaned = part.trim();
        // Handle aliased columns: col AS alias
        const colPart = cleaned.split(/\s+(?:AS|as)\s+/)[0].trim();
        // Strip PostgreSQL type casts (e.g., ::text, ::date::text)
        const colNoCast = colPart.replace(/::[a-z]+/gi, '').trim();
        // Simple column name (not expression)
        const simpleCol = colNoCast.match(/^"?([a-z_][a-z0-9_]*)"?$/i);
        if (simpleCol) {
          refs.push({
            table: tableName,
            column: simpleCol[1].toLowerCase(),
            file: filePath,
            line: startLine,
          });
        }
        // table.column reference (also strip casts)
        const qualCol = colNoCast.match(
          /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/i,
        );
        if (qualCol) {
          refs.push({
            table: qualCol[1].toLowerCase(),
            column: qualCol[2].toLowerCase(),
            file: filePath,
            line: startLine,
          });
        }
      }
    }

    // Extract column names from INSERT (...) VALUES/SELECT
    // Always associate INSERT columns with the INSERT target table
    const insertColsMatch = sql.match(
      /\bINSERT\s+INTO\s+\S+\s*\(([\s\S]*?)\)\s*(?:VALUES|SELECT)/i,
    );
    if (insertColsMatch && insertMatch) {
      const insertTable = insertMatch[1].toLowerCase();
      for (const part of insertColsMatch[1].split(',')) {
        const col = part.trim().replace(/"/g, '').toLowerCase();
        if (col && /^[a-z_][a-z0-9_]*$/.test(col)) {
          refs.push({
            table: insertTable,
            column: col,
            file: filePath,
            line: startLine,
          });
        }
      }
    }

    // Extract column names from UPDATE SET col = ...
    const setMatch = sql.match(
      /\bSET\s+([\s\S]*?)(?:\bWHERE\b|\bRETURNING\b|$)/i,
    );
    if (setMatch && updateMatch) {
      for (const part of setMatch[1].split(',')) {
        const eqMatch = part.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s*=/i);
        if (eqMatch) {
          refs.push({
            table: tableName,
            column: eqMatch[1].toLowerCase(),
            file: filePath,
            line: startLine,
          });
        }
      }
    }

    // Extract columns from RETURNING clause
    const returningMatch = sql.match(
      /\bRETURNING\s+([\s\S]*?)(?:`|$)/i,
    );
    if (returningMatch && tableName) {
      for (const part of returningMatch[1].split(',')) {
        const cleaned = part.trim();
        const rColPart = cleaned.split(/\s+(?:AS|as)\s+/)[0].trim();
        const rColNoCast = rColPart.replace(/::[a-z]+/gi, '').trim();
        const rSimpleCol = rColNoCast.match(/^"?([a-z_][a-z0-9_]*)"?$/i);
        if (rSimpleCol) {
          refs.push({
            table: tableName,
            column: rSimpleCol[1].toLowerCase(),
            file: filePath,
            line: startLine,
          });
        }
      }
    }
  }

  return refs;
}

// ── 4. Main ──────────────────────────────────────────────────────────

const schemaSql = readFileSync(SCHEMA_PATH, 'utf8');
const schema = parseSchema(schemaSql);

console.log('=== Schema Audit: Tables in ctf/schema.sql ===\n');
console.log(`Found ${schema.size} tables in schema.sql\n`);

const files = walkDir(WEB_DIR);
console.log(`Scanning ${files.length} .ts/.tsx files in ctf/packages/web/\n`);

// Collect all table references
/** @type {Map<string, Array<{file:string,line:number,snippet:string}>>} */
const tableUsage = new Map();
/** @type {Array<{table:string,column:string,file:string,line:number}>} */
const allColumnRefs = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const code = stripComments(src);
  const refs = extractTableRefs(f, code);
  for (const r of refs) {
    if (!tableUsage.has(r.table)) tableUsage.set(r.table, []);
    tableUsage.get(r.table).push({
      file: relative(ROOT, r.file),
      line: r.line,
      snippet: r.snippet,
    });
  }
  const colRefs = extractColumnRefs(f, code);
  allColumnRefs.push(...colRefs);
}

// ── 5. Report: Missing Tables ────────────────────────────────────────

const missingTables = [];
const presentTables = [];

for (const [table, locations] of tableUsage) {
  if (!schema.has(table)) {
    missingTables.push({ table, locations });
  } else {
    presentTables.push(table);
  }
}

// Deduplicate locations by table
missingTables.sort((a, b) => a.table.localeCompare(b.table));

console.log('──────────────────────────────────────────────');
console.log('MISSING TABLES (queried in code but NOT in schema.sql)');
console.log('──────────────────────────────────────────────\n');

if (missingTables.length === 0) {
  console.log('  ✅ No missing tables found.\n');
} else {
  for (const { table, locations } of missingTables) {
    // Deduplicate by file
    const uniqueFiles = [...new Set(locations.map((l) => l.file))];
    console.log(`  ❌ ${table}`);
    for (const uf of uniqueFiles) {
      const linesInFile = locations
        .filter((l) => l.file === uf)
        .map((l) => l.line);
      const uniqueLines = [...new Set(linesInFile)].sort((a, b) => a - b);
      console.log(`     └─ ${uf}:${uniqueLines.join(',')}`);
    }
    console.log('');
  }
}

// ── 6. Report: Missing Columns ───────────────────────────────────────

console.log('──────────────────────────────────────────────');
console.log('MISSING COLUMNS (referenced in code but NOT in schema.sql table definition)');
console.log('──────────────────────────────────────────────\n');

// SQL meta-columns to ignore
const META_COLS = new Set([
  '*', 'now', 'count', 'sum', 'max', 'min', 'avg', 'coalesce',
  'gen_random_uuid', 'current_timestamp', 'extract', 'epoch',
  'row_number', 'jsonb_build_object', 'json_build_object',
  'array_agg', 'json_agg', 'jsonb_agg', 'to_jsonb', 'unnest',
  'excluded', 'true', 'false', 'null', 'case', 'when', 'then',
]);

/** @type {Map<string, Map<string, Set<string>>>} table → column → Set<file:line> */
const missingCols = new Map();

for (const ref of allColumnRefs) {
  if (META_COLS.has(ref.column)) continue;
  if (!schema.has(ref.table)) continue; // already reported as missing table
  const tableCols = schema.get(ref.table);
  if (tableCols && !tableCols.has(ref.column)) {
    if (!missingCols.has(ref.table)) missingCols.set(ref.table, new Map());
    const tblMap = missingCols.get(ref.table);
    if (!tblMap.has(ref.column)) tblMap.set(ref.column, new Set());
    tblMap.get(ref.column).add(`${relative(ROOT, ref.file)}:${ref.line}`);
  }
}

let missingColCount = 0;
if (missingCols.size === 0) {
  console.log('  ✅ No missing columns found.\n');
} else {
  for (const [table, cols] of [...missingCols.entries()].sort()) {
    for (const [col, locations] of [...cols.entries()].sort()) {
      missingColCount++;
      console.log(`  ❌ ${table}.${col}`);
      for (const loc of locations) {
        console.log(`     └─ ${loc}`);
      }
      console.log('');
    }
  }
}

// ── 7. Summary ───────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════');
console.log('SUMMARY');
console.log('══════════════════════════════════════════════');
console.log(`  Tables in schema.sql:      ${schema.size}`);
console.log(`  Tables queried in code:    ${tableUsage.size}`);
console.log(`  Missing tables:            ${missingTables.length}`);
console.log(`  Missing columns:           ${missingColCount}`);
console.log(`  Total issues:              ${missingTables.length + missingColCount}`);
console.log('');

if (missingTables.length + missingColCount > 0) {
  console.log('⚠️  Schema drift detected. Fix schema.sql before deploying.\n');
  process.exit(1);
} else {
  console.log('✅ No schema drift detected.\n');
  process.exit(0);
}
