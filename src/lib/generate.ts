import { faker as fakerAr } from '@faker-js/faker/locale/ar'
import { faker as fakerDe } from '@faker-js/faker/locale/de'
import { faker as fakerEn } from '@faker-js/faker/locale/en'
import { faker as fakerEs } from '@faker-js/faker/locale/es'
import { faker as fakerFr } from '@faker-js/faker/locale/fr'
import { faker as fakerJa } from '@faker-js/faker/locale/ja'
import { faker as fakerPt } from '@faker-js/faker/locale/pt_BR'
import { faker as fakerRu } from '@faker-js/faker/locale/ru'
import { faker as fakerZh } from '@faker-js/faker/locale/zh_CN'
import { effectiveKind } from './infer'
import { STATUS_WORDS, type DataLocale } from './options'
import { PRO_ROW_CAP } from './plan'
import type { ColumnSchema, GenerateRequest, GeneratedTable, GeneratorKind, TableSchema } from '../types'

const FAKERS: Record<DataLocale, typeof fakerEn> = {
  en: fakerEn,
  es: fakerEs,
  zh_CN: fakerZh,
  ru: fakerRu,
  fr: fakerFr,
  de: fakerDe,
  pt_BR: fakerPt,
  ja: fakerJa,
  ar: fakerAr,
}

let faker = fakerEn

const CHAOS_STRINGS = ['김민준', 'José Álvarez', 'Data 🚀', "'; DROP TABLE users;--", '', '<>&"\'', 'a'.repeat(180)]

function orderTables(tables: TableSchema[]) {
  const byName = new Map(tables.map((table) => [table.name.toLowerCase(), table]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: TableSchema[] = []
  let cyclic = false

  const visit = (name: string) => {
    const key = name.toLowerCase()
    if (visited.has(key)) return
    if (visiting.has(key)) {
      cyclic = true
      return
    }
    const table = byName.get(key)
    if (!table) return
    visiting.add(key)
    for (const column of table.columns) {
      const parent = column.references?.table
      if (!parent || parent.toLowerCase() === key) continue
      visit(parent)
    }
    visiting.delete(key)
    visited.add(key)
    ordered.push(table)
  }

  for (const table of tables) visit(table.name)
  return { ordered, cyclic }
}

function fit(value: string, maxLength?: number) {
  if (!maxLength || value.length <= maxLength) return value
  return value.slice(0, maxLength)
}

function makeScalar(kind: GeneratorKind, column: ColumnSchema, index: number): unknown {
  if (column.enumValues?.length && kind === 'status') {
    return faker.helpers.arrayElement(column.enumValues)
  }

  switch (kind) {
    case 'uuid':
      return faker.string.uuid()
    case 'int':
      return column.primaryKey ? index + 1 : faker.number.int({ min: 0, max: 10_000 })
    case 'bigint':
      return column.primaryKey ? index + 1 : faker.number.int({ min: 1, max: 1_000_000_000 })
    case 'decimal':
      return faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })
    case 'price':
      return faker.number.float({ min: 4, max: 480, fractionDigits: 2 })
    case 'bool':
      return faker.datatype.boolean()
    case 'email':
      return fit(faker.internet.email(), column.maxLength)
    case 'name':
      return fit(faker.person.fullName(), column.maxLength)
    case 'firstName':
      return fit(faker.person.firstName(), column.maxLength)
    case 'lastName':
      return fit(faker.person.lastName(), column.maxLength)
    case 'username':
      return fit(faker.internet.username(), column.maxLength)
    case 'phone':
      return fit(faker.phone.number(), column.maxLength)
    case 'company':
      return fit(faker.company.name(), column.maxLength)
    case 'title':
      return fit(faker.lorem.words({ min: 2, max: 5 }), column.maxLength)
    case 'sentence':
      return fit(faker.lorem.sentence(), column.maxLength)
    case 'paragraph':
      return fit(
        /body|content/i.test(column.name) ? faker.lorem.paragraphs({ min: 1, max: 2 }, '\n\n') : faker.lorem.paragraph(),
        column.maxLength,
      )
    case 'slug': {
      const slug = faker.helpers.slugify(faker.lorem.words({ min: 2, max: 4 })).toLowerCase().replace(/^-+|-+$/g, '')
      return fit(slug || `row-${index + 1}`, column.maxLength)
    }
    case 'status':
      return fit(faker.helpers.arrayElement(STATUS_WORDS[currentLocale]), column.maxLength)
    case 'city':
      return fit(faker.location.city(), column.maxLength)
    case 'region':
      return fit(faker.location.state(), column.maxLength)
    case 'country':
      return fit(faker.location.country(), column.maxLength)
    case 'address':
      return fit(faker.location.streetAddress(), column.maxLength)
    case 'zip':
      return fit(faker.location.zipCode(), column.maxLength)
    case 'url':
      return fit(faker.internet.url(), column.maxLength)
    case 'ip':
      return faker.internet.ip()
    case 'date':
      return faker.date.past({ years: 2 }).toISOString().slice(0, 10)
    case 'timestamp':
      return faker.date.recent({ days: 120 }).toISOString()
    case 'json':
      return { note: faker.lorem.words(3), qty: faker.number.int({ min: 1, max: 5 }) }
    case 'password':
      return fit(faker.internet.password(), column.maxLength)
    case 'word':
      return fit(faker.lorem.word(), column.maxLength)
    case 'fk':
      return column.sqlKind === 'uuid' ? faker.string.uuid() : index + 1
  }
}

function chaosValue(value: unknown, column: ColumnSchema): unknown {
  if (column.primaryKey) return value
  if (faker.number.float({ min: 0, max: 1 }) > 0.05) return value
  if (column.references) return column.nullable ? null : value
  if (column.nullable && faker.datatype.boolean()) return null
  if (typeof value === 'number') {
    if (column.sqlKind === 'decimal') return faker.helpers.arrayElement([0, -1, 99999999.99, 0.0001])
    return faker.helpers.arrayElement([0, -1, 2_147_483_647])
  }
  if (typeof value === 'string') return fit(faker.helpers.arrayElement(CHAOS_STRINGS), column.maxLength)
  return value
}

function poolKey(table: string, column: string) {
  return `${table.toLowerCase()}::${column.toLowerCase()}`
}

let currentLocale: DataLocale = 'en'

export function generateDataset(request: GenerateRequest) {
  const started = performance.now()
  const rowCount = Math.min(PRO_ROW_CAP, Math.max(1, Math.floor(request.rowCount)))
  currentLocale = request.locale ?? 'en'
  faker = FAKERS[currentLocale] ?? fakerEn
  faker.seed(request.seed)

  const { ordered, cyclic } = orderTables(request.tables)
  const warnings: string[] = []
  if (cyclic) warnings.push('These tables reference each other in a cycle. Some foreign keys may be synthetic.')

  const pools = new Map<string, unknown[]>()
  const warned = new Set<string>()
  const tables: GeneratedTable[] = []

  for (const table of ordered) {
    const pkColumns = table.columns.filter((column) => column.primaryKey)
    for (const column of pkColumns) {
      const kind = effectiveKind(column, request.overrides[`${table.name}::${column.name}`])
      const values = Array.from({ length: rowCount }, (_, index) => makeScalar(kind === 'fk' ? column.inferredKind : kind, { ...column, primaryKey: true }, index))
      pools.set(poolKey(table.name, column.name), values)
    }

    const rows: Record<string, unknown>[] = []
    for (let index = 0; index < rowCount; index += 1) {
      const row: Record<string, unknown> = {}
      for (const column of table.columns) {
        const kind = effectiveKind(column, request.overrides[`${table.name}::${column.name}`])
        let value: unknown
        if (column.primaryKey) {
          value = pools.get(poolKey(table.name, column.name))?.[index]
        } else if (kind === 'fk' && column.references) {
          value = takeForeignKey(column, table.name, pools, warned, warnings)
          if (request.chaos) value = chaosValue(value, column)
        } else {
          value = makeScalar(kind, column, index)
          if (request.chaos) value = chaosValue(value, column)
        }
        row[column.name] = value ?? null
        if (!column.primaryKey) {
          const key = poolKey(table.name, column.name)
          const bucket = pools.get(key) ?? []
          bucket.push(row[column.name])
          pools.set(key, bucket)
        }
      }
      rows.push(row)
    }

    tables.push({
      name: table.name,
      columns: table.columns.map((column) => column.name),
      rows,
    })
  }

  return {
    tables,
    warnings,
    seed: request.seed,
    elapsedMs: Math.round(performance.now() - started),
  }
}

function takeForeignKey(
  column: ColumnSchema,
  tableName: string,
  pools: Map<string, unknown[]>,
  warned: Set<string>,
  warnings: string[],
) {
  const reference = column.references
  if (!reference) return null
  const usable = (pools.get(poolKey(reference.table, reference.column)) ?? []).filter((value) => value !== null && value !== undefined)
  if (!usable.length) {
    const key = `${tableName}.${column.name}`
    if (!warned.has(key)) {
      warned.add(key)
      warnings.push(`${key} has no parent rows in ${reference.table}.${reference.column}, so those values are synthetic.`)
    }
    return column.sqlKind === 'uuid' ? faker.string.uuid() : faker.number.int({ min: 1, max: 1_000_000 })
  }
  return faker.helpers.arrayElement(usable)
}
