import type { DataLocale } from './lib/options'

export const SQL_KINDS = ['uuid', 'int', 'bigint', 'bool', 'decimal', 'timestamp', 'date', 'json', 'text'] as const
export type SqlKind = (typeof SQL_KINDS)[number]

export const GENERATOR_KINDS = [
  'fk',
  'uuid',
  'int',
  'bigint',
  'decimal',
  'price',
  'bool',
  'email',
  'name',
  'firstName',
  'lastName',
  'username',
  'phone',
  'company',
  'title',
  'sentence',
  'paragraph',
  'word',
  'slug',
  'status',
  'city',
  'region',
  'country',
  'address',
  'zip',
  'url',
  'ip',
  'date',
  'timestamp',
  'json',
  'password',
] as const

export type GeneratorKind = (typeof GENERATOR_KINDS)[number]

export interface ColumnReference {
  table: string
  column: string
}

export interface ColumnSchema {
  name: string
  rawType: string
  sqlKind: SqlKind
  inferredKind: GeneratorKind
  nullable: boolean
  primaryKey: boolean
  maxLength?: number
  enumValues?: string[]
  references?: ColumnReference
}

export interface TableSchema {
  name: string
  columns: ColumnSchema[]
}

export interface ParseResult {
  tables: TableSchema[]
  warnings: string[]
  error: string | null
  mode: 'sql' | 'csv' | 'empty'
}

export interface GeneratedTable {
  name: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface GenerateRequest {
  id: number
  tables: TableSchema[]
  overrides: Record<string, GeneratorKind>
  rowCount: number
  chaos: boolean
  seed: number
  locale: DataLocale
}

export interface GenerateResult {
  id: number
  ok: true
  tables: GeneratedTable[]
  warnings: string[]
  seed: number
  elapsedMs: number
}

export interface GenerateFailure {
  id: number
  ok: false
  error: string
}

export type WorkerResponse = GenerateResult | GenerateFailure

export type ExportFormat = 'json' | 'csv' | 'sql'
export type Tier = 'pro' | 'free'

export function columnKey(table: string, column: string) {
  return `${table}::${column}`
}
