import { inferKind } from './infer'
import type { ColumnReference, ColumnSchema, ParseResult, SqlKind, TableSchema } from '../types'

const IDENT_WORD = /^[A-Za-z_][\w$]*/

function skipSpace(input: string, index: number) {
  let i = index
  while (i < input.length && /\s/.test(input[i])) i += 1
  return i
}

function readIdent(input: string, start: number): { name: string; next: number } | null {
  let i = skipSpace(input, start)
  const opener = input[i]
  if (!opener) return null
  if (opener === '"' || opener === '`' || opener === '[') {
    const closer = opener === '[' ? ']' : opener
    const end = input.indexOf(closer, i + 1)
    if (end === -1) return null
    return { name: input.slice(i + 1, end), next: end + 1 }
  }
  const match = IDENT_WORD.exec(input.slice(i))
  if (!match) return null
  return { name: match[0], next: i + match[0].length }
}

function readQualifiedName(input: string, start: number) {
  const first = readIdent(input, start)
  if (!first) return null
  if (input[first.next] === '.') {
    const second = readIdent(input, first.next + 1)
    if (second) return { name: second.name, next: second.next }
  }
  return first
}

function stripComments(sql: string) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

function splitTopLevel(body: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let quote: string | null = null
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]
    if (quote) {
      if (char === quote && body[i - 1] !== '\\') quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (char === ',' && depth === 0) {
      parts.push(body.slice(start, i).trim())
      start = i + 1
    }
  }
  const last = body.slice(start).trim()
  if (last) parts.push(last)
  return parts.filter(Boolean)
}

function skipQuoted(sql: string, index: number, quote: string) {
  let i = index + 1
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2
        continue
      }
      return i + 1
    }
    i += 1
  }
  return sql.length
}

function findColumnList(sql: string, start: number) {
  let i = start
  while (i < sql.length) {
    const char = sql[i]
    if (char === "'" || char === '"' || char === '`') {
      i = skipQuoted(sql, i, char)
      continue
    }
    if (char === '(') return i
    if (char === ';') return -1
    i += 1
  }
  return -1
}

function readStatementTail(sql: string, start: number) {
  let i = start
  let depth = 0
  while (i < sql.length) {
    const char = sql[i]
    if (char === "'" || char === '"' || char === '`') {
      i = skipQuoted(sql, i, char)
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (char === ';' && depth === 0) break
    else if (depth === 0 && /^create\s+(?:temp(?:orary)?\s+)?table\b/i.test(sql.slice(i))) break
    i += 1
  }
  return sql.slice(start, i)
}

function extractCreateBlocks(sql: string) {
  const blocks: Array<{ name: string; body: string; tail: string }> = []
  const matcher = /create\s+(?:temp(?:orary)?\s+)?table\s+(?:if\s+not\s+exists\s+)?/gi
  let match: RegExpExecArray | null
  while ((match = matcher.exec(sql))) {
    const ident = readQualifiedName(sql, match.index + match[0].length)
    if (!ident) continue
    const open = findColumnList(sql, ident.next)
    if (open === -1) continue
    let i = open + 1
    const bodyStart = i
    let depth = 1
    while (i < sql.length && depth > 0) {
      const char = sql[i]
      if (char === "'" || char === '"' || char === '`') {
        i = skipQuoted(sql, i, char)
        continue
      }
      if (char === '(') depth += 1
      else if (char === ')') depth -= 1
      i += 1
    }
    blocks.push({ name: ident.name, body: sql.slice(bodyStart, i - 1), tail: readStatementTail(sql, i) })
    matcher.lastIndex = i
  }
  return blocks
}

function readSqlType(input: string, start: number) {
  let i = skipSpace(input, start)
  const words: string[] = []
  const first = IDENT_WORD.exec(input.slice(i))
  if (!first) return { raw: 'text', next: i }
  words.push(first[0])
  i += first[0].length

  const pull = () => {
    const at = skipSpace(input, i)
    const next = IDENT_WORD.exec(input.slice(at))
    if (!next) return null
    return { word: next[0], next: at + next[0].length }
  }

  const lead = first[0].toLowerCase()
  if (['character', 'char', 'national', 'double', 'timestamp', 'time', 'bit'].includes(lead)) {
    const second = pull()
    if (second && ['varying', 'precision', 'with', 'without'].includes(second.word.toLowerCase())) {
      words.push(second.word)
      i = second.next
      if (second.word.toLowerCase() === 'with' || second.word.toLowerCase() === 'without') {
        const third = pull()
        if (third) {
          words.push(third.word)
          i = third.next
          const fourth = pull()
          if (fourth && fourth.word.toLowerCase() === 'zone') {
            words.push(fourth.word)
            i = fourth.next
          }
        }
      }
    }
  }

  i = skipSpace(input, i)
  if (input[i] === '(') {
    const parenStart = i
    let depth = 0
    for (; i < input.length; i += 1) {
      if (input[i] === '(') depth += 1
      else if (input[i] === ')') {
        depth -= 1
        if (depth === 0) {
          i += 1
          break
        }
      }
    }
    words.push(input.slice(parenStart, i).replace(/\s+/g, ''))
  }

  return { raw: words.join(' '), next: i }
}

function unwrapType(raw: string) {
  let current = raw.trim()
  let nullable = false
  for (let pass = 0; pass < 6; pass += 1) {
    const wrapper = /^(lowcardinality|nullable|simpleaggregatefunction|aggregatefunction)\b/i.exec(current)
    if (!wrapper) break
    const open = current.indexOf('(', wrapper[0].length)
    if (open === -1) break
    const inner = sliceParens(current, open)
    if (inner === null) break
    if (wrapper[1].toLowerCase() === 'nullable') nullable = true
    if (wrapper[1].toLowerCase().includes('aggregate')) {
      const args = splitTopLevel(inner)
      current = (args[args.length - 1] ?? inner).trim()
    } else {
      current = inner.trim()
    }
  }
  return { inner: current, nullable }
}

function classifyType(raw: string): { sqlKind: SqlKind; maxLength?: number; nullableType: boolean } {
  const unwrapped = unwrapType(raw)
  const compact = unwrapped.inner.toLowerCase().replace(/\s+/g, ' ')
  const lengthMatch = unwrapped.inner.match(/\(\s*(\d+)/)
  const length = lengthMatch ? Number(lengthMatch[1]) : undefined
  const kind = (): { sqlKind: SqlKind; maxLength?: number } => {
    if (compact.includes('uuid')) return { sqlKind: 'uuid' }
    if (/(bigserial|bigint|\bint8\b|\bint64\b|\bint128\b|\bint256\b|\buint64\b|\buint128\b|\buint256\b)/.test(compact)) return { sqlKind: 'bigint' }
    if (/tinyint\s*\(\s*1\s*\)/.test(compact)) return { sqlKind: 'bool' }
    if (/(smallint|tinyint|serial|integer|int4|int2|\bint\b|\bint16\b|\bint32\b|\buint8\b|\buint16\b|\buint32\b)/.test(compact)) return { sqlKind: 'int' }
    if (/bool/.test(compact)) return { sqlKind: 'bool' }
    if (/(decimal|numeric|money|double|float|real)/.test(compact)) return { sqlKind: 'decimal' }
    if (/json/.test(compact)) return { sqlKind: 'json' }
    if (compact.startsWith('date') && !compact.includes('time')) return { sqlKind: 'date' }
    if (/(timestamp|datetime)/.test(compact)) return { sqlKind: 'timestamp' }
    return { sqlKind: 'text', maxLength: length && length > 0 ? length : undefined }
  }
  return { ...kind(), nullableType: unwrapped.nullable }
}

function sliceParens(input: string, openIndex: number) {
  let depth = 0
  for (let i = openIndex; i < input.length; i += 1) {
    if (input[i] === '(') depth += 1
    else if (input[i] === ')') {
      depth -= 1
      if (depth === 0) return input.slice(openIndex + 1, i)
    }
  }
  return null
}

function unquoteList(list: string) {
  return list
    .split(',')
    .map((part) => part.trim().replace(/^["`\[]|["`\]]$/g, ''))
    .filter(Boolean)
}

function readEnums(part: string) {
  const match = part.match(/\bcheck\s*\(/i)
  if (!match || match.index === undefined) return undefined
  const inner = sliceParens(part, match.index + match[0].length - 1)
  if (!inner) return undefined
  const list = inner.match(/\bin\s*\(/i)
  if (!list || list.index === undefined) return undefined
  const valuesBody = sliceParens(inner, list.index + list[0].length - 1)
  if (!valuesBody) return undefined
  const values = [...valuesBody.matchAll(/'([^']*)'|"([^"]*)"/g)].map((item) => item[1] ?? item[2]).filter(Boolean)
  return values.length ? values : undefined
}

function readInlineReference(part: string): ColumnReference | undefined {
  const match = part.match(/\breferences\s+/i)
  if (!match || match.index === undefined) return undefined
  const table = readQualifiedName(part, match.index + match[0].length)
  if (!table) return undefined
  const parenAt = skipSpace(part, table.next)
  if (part[parenAt] !== '(') return { table: table.name, column: 'id' }
  const column = readIdent(part, parenAt + 1)
  if (!column) return undefined
  return { table: table.name, column: column.name }
}

function isTableConstraint(part: string) {
  return /^(constraint\b|primary\s+key\b|foreign\s+key\b|unique(\s+key)?\b|check\b|index\b|fulltext\b|spatial\b|key\s*\()/i.test(part.trim())
}

function readConstraintColumns(part: string, keyword: RegExp) {
  const match = part.match(keyword)
  if (!match || match.index === undefined) return []
  const start = part.indexOf('(', match.index)
  if (start === -1) return []
  const inner = sliceParens(part, start)
  if (!inner) return []
  return unquoteList(inner)
}

interface ParsedBody {
  columns: ColumnSchema[]
  warnings: string[]
}

function parseBody(tableName: string, body: string): ParsedBody {
  const warnings: string[] = []
  const columns: ColumnSchema[] = []
  const pendingPk = new Set<string>()
  const pendingFk: ColumnReference[] = []
  const fkColumns: string[] = []

  for (const part of splitTopLevel(body)) {
    if (isTableConstraint(part)) {
      if (/primary\s+key/i.test(part)) {
        for (const name of readConstraintColumns(part, /primary\s+key/i)) pendingPk.add(name.toLowerCase())
      } else if (/foreign\s+key/i.test(part)) {
        const cols = readConstraintColumns(part, /foreign\s+key/i)
        const reference = readInlineReference(part)
        if (cols.length > 1 || (reference && part.slice(part.toLowerCase().lastIndexOf('references')).includes(','))) {
          warnings.push(`${tableName} has a composite foreign key. SchemaSeed links single-column keys only.`)
        } else if (cols[0] && reference) {
          fkColumns.push(cols[0])
          pendingFk.push(reference)
        }
      }
      continue
    }

    const ident = readIdent(part, 0)
    if (!ident) continue
    const typeInfo = readSqlType(part, ident.next)
    const classified = classifyType(typeInfo.raw)
    const enumValues = readEnums(part)
    const references = readInlineReference(part)
    const primaryKey = /\bprimary\s+key\b/i.test(part)
    const notNull = /\bnot\s+null\b/i.test(part) || primaryKey
    const clickhouseColumn = /\bcodec\s*\(/i.test(part) || /\b(lowcardinality|nullable)\s*\(/i.test(typeInfo.raw)
    columns.push({
      name: ident.name,
      rawType: typeInfo.raw,
      sqlKind: classified.sqlKind,
      inferredKind: inferKind(ident.name, classified.sqlKind, Boolean(enumValues?.length)),
      nullable: classified.nullableType || (clickhouseColumn ? false : !notNull),
      primaryKey,
      maxLength: classified.maxLength,
      enumValues,
      references,
    })
  }

  for (const name of pendingPk) {
    const column = columns.find((item) => item.name.toLowerCase() === name)
    if (!column) continue
    column.primaryKey = true
    column.nullable = false
  }

  fkColumns.forEach((name, index) => {
    const column = columns.find((item) => item.name.toLowerCase() === name.toLowerCase())
    if (!column || column.references) return
    column.references = pendingFk[index]
  })

  if (!columns.length) warnings.push(`CREATE TABLE ${tableName} did not contain any columns.`)
  return { columns, warnings }
}

function parseSql(sql: string): ParseResult {
  const blocks = extractCreateBlocks(sql)
  if (!blocks.length) {
    return {
      tables: [],
      warnings: [],
      error: 'Could not read a CREATE TABLE statement from that SQL.',
      mode: 'sql',
    }
  }

  const warnings: string[] = []
  const tables: TableSchema[] = []
  for (const block of blocks) {
    const parsed = parseBody(block.name, block.body)
    const outsideKey = readConstraintColumns(block.tail, /primary\s+key/i)
    const keyColumns = outsideKey.length ? outsideKey : readConstraintColumns(block.tail, /order\s+by/i)
    for (const name of keyColumns) {
      const column = parsed.columns.find((item) => item.name.toLowerCase() === name.toLowerCase())
      if (!column) continue
      column.primaryKey = true
      column.nullable = false
    }
    warnings.push(...parsed.warnings)
    if (parsed.columns.length) tables.push({ name: block.name, columns: parsed.columns })
  }

  const names = new Set(tables.map((table) => table.name.toLowerCase()))
  for (const table of tables) {
    for (const column of table.columns) {
      if (!column.references) continue
      if (!names.has(column.references.table.toLowerCase())) {
        warnings.push(
          `${table.name}.${column.name} references ${column.references.table}, which is not in this schema. Those values will be synthetic.`,
        )
      }
    }
  }

  return {
    tables,
    warnings,
    error: tables.length ? null : 'Could not read a CREATE TABLE statement from that SQL.',
    mode: 'sql',
  }
}

function detectDelimiter(line: string) {
  const commas = (line.match(/,/g) ?? []).length
  const semis = (line.match(/;/g) ?? []).length
  const tabs = (line.match(/\t/g) ?? []).length
  if (tabs > commas && tabs >= semis) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseCsv(source: string): ParseResult {
  const line = source
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean)
  if (!line) return { tables: [], warnings: [], error: null, mode: 'empty' }

  const delimiter = detectDelimiter(line)
  const seen = new Map<string, number>()
  const names = line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  if (!names.length) {
    return { tables: [], warnings: [], error: 'Add a header row with at least one column name.', mode: 'csv' }
  }

  const columns: ColumnSchema[] = names.map((name) => {
    const count = (seen.get(name.toLowerCase()) ?? 0) + 1
    seen.set(name.toLowerCase(), count)
    const unique = count === 1 ? name : `${name}_${count}`
    return {
      name: unique,
      rawType: 'text',
      sqlKind: 'text',
      inferredKind: inferKind(unique, 'text', false),
      nullable: true,
      primaryKey: false,
    }
  })

  const warnings = source.trim().includes('\n') ? ['Only the header row is used. The lines under it are ignored.'] : []
  return { tables: [{ name: 'dataset', columns }], warnings, error: null, mode: 'csv' }
}

export function parseSchema(source: string): ParseResult {
  const trimmed = source.trim()
  if (!trimmed) return { tables: [], warnings: [], error: null, mode: 'empty' }
  const stripped = stripComments(trimmed)
  if (/create\s+table/i.test(stripped)) return parseSql(stripped)
  if (/^\s*(select|insert|update|delete|with)\b/i.test(stripped)) {
    return {
      tables: [],
      warnings: [],
      error: 'Paste CREATE TABLE statements, or a single CSV header row.',
      mode: 'sql',
    }
  }
  return parseCsv(stripped)
}
