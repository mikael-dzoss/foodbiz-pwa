import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_MIGRATIONS_DIR = "supabase/migrations";
const DEFAULT_TYPES_PATH = "src/lib/supabase/database.types.ts";

/**
 * Strips SQL line (`-- ...`) and block (`/* ... *\/`) comments while preserving string literals.
 * @param {string} sql
 * @returns {string}
 */
export function stripSqlComments(sql) {
  return sql.replace(/'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\//g, (match) =>
    match.startsWith("'") ? match : " ",
  );
}

/**
 * Splits a comma-separated SQL clause at top-level commas (outside parentheses and string literals).
 * @param {string} input
 * @returns {string[]}
 */
export function splitTopLevelCommas(input) {
  const parts = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") {
      if (inSingleQuote && input[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (!inSingleQuote) {
      if (ch === "(") depth++;
      else if (ch === ")" && depth > 0) depth--;
      else if (ch === "," && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Removes balanced parenthesized expressions (`(...)`) and string literals from a modifier string
 * so `check (col is not null)` does not falsely match column-level `not null`.
 * @param {string} input
 * @returns {string}
 */
function stripParensAndStrings(input) {
  let out = "";
  let depth = 0;
  let inSingleQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") {
      if (inSingleQuote && input[i + 1] === "'") {
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (inSingleQuote) continue;
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/**
 * Extracts a balanced parenthesized block starting at the first `(` at or after `startIndex`.
 * @param {string} source
 * @param {number} startIndex
 * @returns {{ content: string, endIndex: number } | null}
 */
function extractParenBlock(source, startIndex) {
  const openIdx = source.indexOf("(", startIndex);
  if (openIdx === -1) return null;
  let depth = 0;
  let inSingleQuote = false;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "'") {
      if (inSingleQuote && source[i + 1] === "'") {
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (!inSingleQuote) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          return { content: source.slice(openIdx + 1, i), endIndex: i };
        }
      }
    }
  }
  return null;
}

/**
 * Maps a PostgreSQL type expression to its TypeScript representation.
 * @param {string} rawType
 * @param {Record<string, string[]>} enums
 * @returns {string}
 */
export function mapSqlTypeToTs(rawType, enums) {
  const cleaned = rawType.trim().replace(/^public\./i, "");
  if (cleaned.endsWith("[]")) {
    const base = mapSqlTypeToTs(cleaned.slice(0, -2), enums);
    return `${base}[]`;
  }
  const lower = cleaned
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  if (Object.hasOwn(enums, lower)) {
    return `Database["public"]["Enums"]["${lower}"]`;
  }
  switch (lower) {
    case "uuid":
    case "text":
    case "varchar":
    case "char":
    case "character varying":
    case "date":
    case "time":
    case "timetz":
    case "timestamptz":
    case "timestamp":
    case "timestamp with time zone":
    case "timestamp without time zone":
      return "string";
    case "integer":
    case "int":
    case "int4":
    case "smallint":
    case "int2":
    case "bigint":
    case "int8":
    case "numeric":
    case "decimal":
    case "double precision":
    case "float8":
    case "real":
    case "float4":
      return "number";
    case "boolean":
    case "bool":
      return "boolean";
    case "jsonb":
    case "json":
      return "Json";
    case "void":
      return "undefined";
    default:
      return "unknown";
  }
}

/**
 * Parses SQL DDL into structured enums, tables, and public RPC functions.
 * @param {string} rawSql
 */
export function parseSqlSchema(rawSql) {
  const sql = stripSqlComments(rawSql);
  /** @type {Record<string, string[]>} */
  const enums = {};
  /** @type {Record<string, { columns: Array<{ name: string, tsType: string, notNull: boolean, hasDefault: boolean }>, relationships: Array<{ foreignKeyName: string, columns: string[], isOneToOne: boolean, referencedRelation: string, referencedColumns: string[] }> }>} */
  const tables = {};
  /** @type {Record<string, { args: Array<{ name: string, tsType: string, optional: boolean }>, returns: string }>} */
  const functions = {};

  // 1. Parse ENUMs
  const enumRegex =
    /create\s+type\s+(?:public\.)?([a-zA-Z0-9_]+)\s+as\s+enum\s*\(([\s\S]*?)\)\s*;/gi;
  for (const match of sql.matchAll(enumRegex)) {
    const name = match[1].toLowerCase();
    const values = [...match[2].matchAll(/'((?:''|[^'])*)'/g)].map((m) => m[1].replace(/''/g, "'"));
    enums[name] = values;
  }

  // 2. Parse TABLEs
  const tableHeaderRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  for (const match of sql.matchAll(tableHeaderRegex)) {
    const tableName = match[1].toLowerCase();
    const parenPos = match.index + match[0].length - 1;
    const block = extractParenBlock(sql, parenPos);
    if (!block) continue;

    const entries = splitTopLevelCommas(block.content);
    const uniqueSingleColumns = new Set();
    /** @type {Array<{ colName: string, refTable: string, refCol: string }>} */
    const foreignKeys = [];
    /** @type {Array<{ name: string, tsType: string, notNull: boolean, hasDefault: boolean }>} */
    const columns = [];

    for (const entry of entries) {
      const normalized = entry.trim().replace(/\s+/g, " ");
      if (/^(?:constraint\s+[a-zA-Z0-9_]+\s+)?unique\s*\(/i.test(normalized)) {
        const uBlock = extractParenBlock(normalized, normalized.toLowerCase().indexOf("unique"));
        if (uBlock) {
          const uCols = splitTopLevelCommas(uBlock.content);
          if (uCols.length === 1) {
            uniqueSingleColumns.add(uCols[0].trim().toLowerCase());
          }
        }
        continue;
      }
      if (/^(?:constraint|primary\s+key|check|foreign\s+key)\b/i.test(normalized)) {
        continue;
      }

      const colMatch = /^([a-zA-Z0-9_]+)\s+([\s\S]+)$/.exec(entry.trim());
      if (!colMatch) continue;
      const colName = colMatch[1].toLowerCase();
      const rest = colMatch[2].trim();

      const typeMatch =
        /^(double\s+precision|timestamp\s+with(?:out)?\s+time\s+zone|character\s+varying|[a-zA-Z0-9_.]+(?:\s*\([^)]*\))?(?:\[\])?)/i.exec(
          rest,
        );
      if (!typeMatch) continue;
      const rawType = typeMatch[1];
      const modifiersRaw = rest.slice(typeMatch[0].length);
      const modifiersTop = stripParensAndStrings(modifiersRaw).toLowerCase();

      const isPrimaryKey = /\bprimary\s+key\b/.test(modifiersTop);
      const isNotNull = isPrimaryKey || /\bnot\s+null\b/.test(modifiersTop);
      const hasDefault = /\bdefault\b/.test(modifiersTop);
      if (/\bunique\b/.test(modifiersTop)) {
        uniqueSingleColumns.add(colName);
      }

      const fkMatch = /\breferences\s+([a-zA-Z0-9_.]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i.exec(
        modifiersRaw,
      );
      if (fkMatch) {
        const refTable = fkMatch[1];
        const refCol = fkMatch[2].toLowerCase();
        if (!/^auth\./i.test(refTable)) {
          foreignKeys.push({
            colName,
            refTable: refTable.replace(/^public\./i, "").toLowerCase(),
            refCol,
          });
        }
      }

      columns.push({
        name: colName,
        tsType: mapSqlTypeToTs(rawType, enums),
        notNull: isNotNull,
        hasDefault,
      });
    }

    const relationships = foreignKeys.map((fk) => ({
      foreignKeyName: `${tableName}_${fk.colName}_fkey`,
      columns: [fk.colName],
      isOneToOne: uniqueSingleColumns.has(fk.colName),
      referencedRelation: fk.refTable,
      referencedColumns: [fk.refCol],
    }));

    tables[tableName] = { columns, relationships };
  }

  // 3. Parse public RPC FUNCTIONs (excluding trigger functions and non-public schemas)
  const fnRegex =
    /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_.]+)\s*\(([\s\S]*?)\)\s*returns\s+([\s\S]*?)(?:\blanguage\b|\bsecurity\b|\bset\b|\bas\b)/gi;
  for (const match of sql.matchAll(fnRegex)) {
    const rawName = match[1];
    if (rawName.includes(".") && !/^public\./i.test(rawName)) {
      continue;
    }
    const fnName = rawName.replace(/^public\./i, "").toLowerCase();
    const argsRaw = match[2].trim();
    const returnsRaw = match[3].trim();

    if (/^trigger\b/i.test(returnsRaw)) {
      continue;
    }

    const args = argsRaw
      ? splitTopLevelCommas(argsRaw).map((arg) => {
          const cleanedArg = arg.trim().replace(/^(?:in|out|inout)\s+/i, "");
          const parts = /^([a-zA-Z0-9_]+)\s+([\s\S]+)$/.exec(cleanedArg);
          if (!parts) {
            return { name: "arg", tsType: "unknown", optional: false };
          }
          const argName = parts[1];
          const typeAndDefault = parts[2];
          const hasDefault = /\bdefault\b/i.test(typeAndDefault) || typeAndDefault.includes("=");
          const rawType = typeAndDefault.split(/\bdefault\b|=/i)[0].trim();
          return {
            name: argName,
            tsType: mapSqlTypeToTs(rawType, enums),
            optional: hasDefault,
          };
        })
      : [];

    let returnsTs = "unknown";
    if (/^table\s*\(/i.test(returnsRaw)) {
      const tBlock = extractParenBlock(returnsRaw, 0);
      if (tBlock) {
        const cols = splitTopLevelCommas(tBlock.content).map((col) => {
          const m = /^([a-zA-Z0-9_]+)\s+([\s\S]+)$/.exec(col.trim());
          return m ? `${m[1]}: ${mapSqlTypeToTs(m[2], enums)};` : "";
        });
        returnsTs = `{\n          ${cols.filter(Boolean).join("\n          ")}\n        }[]`;
      }
    } else {
      returnsTs = mapSqlTypeToTs(returnsRaw, enums);
    }

    functions[fnName] = { args, returns: returnsTs };
  }

  return { enums, tables, functions };
}

/**
 * Generates formatted TypeScript `Database` definition from SQL migration source.
 * @param {string} rawSql
 * @returns {string}
 */
export function generateTypesFromSql(rawSql) {
  const { enums, tables, functions } = parseSqlSchema(rawSql);
  const lines = [
    "// AUTO-GENERATED by `npm run db:types` from `supabase/migrations/*.sql` — DO NOT EDIT MANUALLY.",
    "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
    "",
    "export type Database = {",
    "  public: {",
    "    Tables: {",
  ];

  for (const [tableName, table] of Object.entries(tables)) {
    lines.push(`      ${tableName}: {`);
    lines.push("        Row: {");
    for (const col of table.columns) {
      const typeStr = col.notNull ? col.tsType : `${col.tsType} | null`;
      lines.push(`          ${col.name}: ${typeStr};`);
    }
    lines.push("        };");

    lines.push("        Insert: {");
    for (const col of table.columns) {
      const optional = !col.notNull || col.hasDefault ? "?" : "";
      const typeStr = col.notNull ? col.tsType : `${col.tsType} | null`;
      lines.push(`          ${col.name}${optional}: ${typeStr};`);
    }
    lines.push("        };");

    lines.push("        Update: {");
    for (const col of table.columns) {
      const typeStr = col.notNull ? col.tsType : `${col.tsType} | null`;
      lines.push(`          ${col.name}?: ${typeStr};`);
    }
    lines.push("        };");

    if (table.relationships.length === 0) {
      lines.push("        Relationships: [];");
    } else {
      lines.push("        Relationships: [");
      for (const rel of table.relationships) {
        lines.push("          {");
        lines.push(`            foreignKeyName: "${rel.foreignKeyName}";`);
        lines.push(`            columns: [${rel.columns.map((c) => `"${c}"`).join(", ")}];`);
        lines.push(`            isOneToOne: ${rel.isOneToOne};`);
        lines.push(`            referencedRelation: "${rel.referencedRelation}";`);
        lines.push(
          `            referencedColumns: [${rel.referencedColumns.map((c) => `"${c}"`).join(", ")}];`,
        );
        lines.push("          },");
      }
      lines.push("        ];");
    }
    lines.push("      };");
  }

  lines.push("    };");
  lines.push("    Views: {");
  lines.push("      [_ in never]: never;");
  lines.push("    };");

  const fnEntries = Object.entries(functions);
  if (fnEntries.length === 0) {
    lines.push("    Functions: {");
    lines.push("      [_ in never]: never;");
    lines.push("    };");
  } else {
    lines.push("    Functions: {");
    for (const [fnName, fn] of fnEntries) {
      lines.push(`      ${fnName}: {`);
      if (fn.args.length === 0) {
        lines.push("        Args: Record<PropertyKey, never>;");
      } else {
        lines.push("        Args: {");
        for (const arg of fn.args) {
          lines.push(`          ${arg.name}${arg.optional ? "?" : ""}: ${arg.tsType};`);
        }
        lines.push("        };");
      }
      lines.push(`        Returns: ${fn.returns};`);
      lines.push("      };");
    }
    lines.push("    };");
  }

  lines.push("    Enums: {");
  for (const [enumName, values] of Object.entries(enums)) {
    const union = values.map((v) => `"${v}"`).join(" | ");
    const singleLine = `      ${enumName}: ${union};`;
    if (singleLine.length <= 100) {
      lines.push(singleLine);
    } else {
      lines.push(`      ${enumName}:`);
      for (const v of values) {
        lines.push(`        | "${v}"`);
      }
      lines[lines.length - 1] += ";";
    }
  }
  lines.push("    };");
  lines.push("    CompositeTypes: {");
  lines.push("      [_ in never]: never;");
  lines.push("    };");
  lines.push("  };");
  lines.push("};");
  lines.push("");
  lines.push(
    'export type Tables<T extends keyof Database["public"]["Tables"]> =',
    '  Database["public"]["Tables"][T]["Row"];',
    "",
    'export type TablesInsert<T extends keyof Database["public"]["Tables"]> =',
    '  Database["public"]["Tables"][T]["Insert"];',
    "",
    'export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =',
    '  Database["public"]["Tables"][T]["Update"];',
    "",
    'export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];',
    "",
  );

  return lines.join("\n");
}

/**
 * Reads all `.sql` files in `migrationsDir` in lexicographical order and generates `Database` types.
 * @param {string} [migrationsDir]
 * @returns {string}
 */
export function generateTypesFromMigrations(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(`No .sql migrations found in ${migrationsDir}`);
  }
  const combinedSql = files
    .map((file) => readFileSync(resolve(migrationsDir, file), "utf8"))
    .join("\n\n");
  return generateTypesFromSql(combinedSql);
}

/**
 * Checks whether the generated database types match the committed file.
 * @param {{ migrationsDir?: string, typesPath?: string, currentContent?: string }} [options]
 * @returns {{ inSync: boolean, expected: string, message: string }}
 */
export function checkDatabaseTypes(options = {}) {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const typesPath = options.typesPath ?? DEFAULT_TYPES_PATH;
  const expected = generateTypesFromMigrations(migrationsDir);
  const current =
    options.currentContent ?? (existsSync(typesPath) ? readFileSync(typesPath, "utf8") : "");

  if (current === expected) {
    return {
      inSync: true,
      expected,
      message: "Database types are up to date with supabase/migrations.",
    };
  }
  return {
    inSync: false,
    expected,
    message:
      "Database types drift detected: src/lib/supabase/database.types.ts is out of date with supabase/migrations. Run `npm run db:types` and commit the updated file.",
  };
}

if (process.argv[1]?.endsWith("db-types.mjs")) {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    const result = checkDatabaseTypes();
    if (!result.inSync) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
  } else if (args.includes("--from-local-db")) {
    const output = execFileSync("npx", ["supabase", "gen", "types", "typescript", "--local"], {
      encoding: "utf8",
    });
    writeFileSync(DEFAULT_TYPES_PATH, output);
    console.log(`Generated ${DEFAULT_TYPES_PATH} from local Supabase container.`);
  } else {
    const output = generateTypesFromMigrations();
    writeFileSync(DEFAULT_TYPES_PATH, output);
    console.log(`Generated ${DEFAULT_TYPES_PATH} from ${DEFAULT_MIGRATIONS_DIR}.`);
  }
}
