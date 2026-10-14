import { dialectStyle, type SqlDialect } from './options'
import type { ExportFormat, GeneratedTable } from '../types'

const RESERVED = new Set([
  'user',
  'order',
  'group',
  'table',
  'default',
  'check',
  'key',
  'select',
  'from',
  'to',
  'constraint',
  'index',
  'references',
])

function quoteIdent(name: string, dialect: SqlDialect) {
  const style = dialectStyle(dialect)
  const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !RESERVED.has(name.toLowerCase())
  if (safe) return name
  if (style.quote === 'bracket') return `[${name.replace(/]/g, ']]')}]`
  if (style.quote === 'backtick') return `\`${name.replace(/`/g, '``')}\``
  return `"${name.replace(/"/g, '""')}"`
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (text === '') return '""'
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function sqlBool(value: boolean, dialect: SqlDialect) {
  const kind = dialectStyle(dialect).bool
  if (kind === 'upper') return value ? 'TRUE' : 'FALSE'
  if (kind === 'lower') return value ? 'true' : 'false'
  return value ? '1' : '0'
}

function temporalLiteral(value: string, dialect: SqlDialect) {
  const style = dialectStyle(dialect).time
  const timestamp = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/)
  const date = value.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (timestamp) {
    const stamp = `${timestamp[1]} ${timestamp[2]}`
    if (style === 'oracle') return `TO_DATE('${stamp}', 'YYYY-MM-DD HH24:MI:SS')`
    if (style === 'typed') return `TIMESTAMP '${stamp}'`
    if (style === 'space') return `'${stamp}'`
  }
  if (date) {
    if (style === 'oracle') return `TO_DATE('${date[1]}', 'YYYY-MM-DD')`
    if (style === 'typed') return `DATE '${date[1]}'`
  }
  return null
}

function sqlString(value: string, dialect: SqlDialect) {
  const temporal = temporalLiteral(value, dialect)
  if (temporal) return temporal
  const escaped = `'${value.replace(/'/g, "''")}'`
  return dialectStyle(dialect).nationalStrings ? `N${escaped}` : escaped
}

function sqlValue(value: unknown, dialect: SqlDialect) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return sqlBool(value, dialect)
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return sqlString(text, dialect)
}

export function toJson(table: GeneratedTable) {
  const rows = table.rows.map((row) => {
    const record: Record<string, unknown> = {}
    for (const column of table.columns) record[column] = row[column] ?? null
    return record
  })
  return JSON.stringify(rows, null, 2)
}

export function toCsv(table: GeneratedTable) {
  const lines = [table.columns.map((column) => csvCell(column)).join(',')]
  for (const row of table.rows) {
    lines.push(table.columns.map((column) => csvCell(row[column])).join(','))
  }
  return lines.join('\n')
}

function insertValues(table: GeneratedTable, dialect: SqlDialect, rows: Record<string, unknown>[]) {
  const header = `INSERT INTO ${quoteIdent(table.name, dialect)} (${table.columns.map((column) => quoteIdent(column, dialect)).join(', ')}) VALUES`
  const values = rows.map((row) => `  (${table.columns.map((column) => sqlValue(row[column], dialect)).join(', ')})`)
  return `${header}\n${values.join(',\n')};`
}

function insertAll(table: GeneratedTable, dialect: SqlDialect, rows: Record<string, unknown>[]) {
  const into = `${quoteIdent(table.name, dialect)} (${table.columns.map((column) => quoteIdent(column, dialect)).join(', ')})`
  const lines = rows.map((row) => `  INTO ${into} VALUES (${table.columns.map((column) => sqlValue(row[column], dialect)).join(', ')})`)
  return `INSERT ALL\n${lines.join('\n')}\nSELECT 1 FROM dual;`
}

export function toSql(tables: GeneratedTable[], dialect: SqlDialect = 'postgres') {
  const batches: string[] = []
  const write = dialectStyle(dialect).insertAll ? insertAll : insertValues
  const size = dialectStyle(dialect).insertAll ? 80 : 200
  for (const table of tables) {
    if (!table.columns.length) continue
    for (let index = 0; index < table.rows.length; index += size) {
      batches.push(write(table, dialect, table.rows.slice(index, index + size)))
    }
  }
  return batches.join('\n\n')
}

export function exportText(format: ExportFormat, tables: GeneratedTable[], activeName: string, dialect: SqlDialect) {
  if (format === 'sql') return toSql(tables, dialect)
  const table = tables.find((item) => item.name === activeName) ?? tables[0]
  if (!table) return ''
  return format === 'csv' ? toCsv(table) : toJson(table)
}

export function exportFilename(format: ExportFormat, activeName: string) {
  if (format === 'sql') return 'schemaseed.sql'
  const base = (activeName || 'data').toLowerCase().replace(/[^\w.-]+/g, '_')
  return `${base}.${format}`
}
