import { GENERATOR_KINDS, type ColumnSchema, type GeneratorKind, type SqlKind } from '../types'

export const GENERATOR_LABELS: Record<GeneratorKind, string> = {
  fk: 'Foreign key',
  uuid: 'UUID',
  int: 'Integer',
  bigint: 'Big integer',
  decimal: 'Decimal',
  price: 'Price',
  bool: 'Boolean',
  email: 'Email',
  name: 'Full name',
  firstName: 'First name',
  lastName: 'Last name',
  username: 'Username',
  phone: 'Phone',
  company: 'Company',
  title: 'Title',
  sentence: 'Sentence',
  paragraph: 'Paragraph',
  word: 'Word',
  slug: 'Slug',
  status: 'Status',
  city: 'City',
  region: 'Region',
  country: 'Country',
  address: 'Address',
  zip: 'Postal code',
  url: 'URL',
  ip: 'IP address',
  date: 'Date',
  timestamp: 'Timestamp',
  json: 'JSON',
  password: 'Password',
}

export const GENERATOR_OPTIONS = GENERATOR_KINDS.map((id) => ({
  id,
  label: GENERATOR_LABELS[id],
}))

const TEXT_KINDS = new Set<GeneratorKind>([
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
  'password',
  'date',
  'timestamp',
])

const NUMERIC_KINDS = new Set<GeneratorKind>(['price', 'int', 'bigint', 'decimal'])

const NAME_RULES: Array<{ test: RegExp; kind: GeneratorKind }> = [
  { test: /email/, kind: 'email' },
  { test: /(^|_)first_name$/, kind: 'firstName' },
  { test: /(^|_)last_name$/, kind: 'lastName' },
  { test: /(^|_)full_name$/, kind: 'name' },
  { test: /(^|_)user_name$|(^|_)username$/, kind: 'username' },
  { test: /company|organisation|organization|(^|_)org$/, kind: 'company' },
  { test: /(^|_)name$/, kind: 'name' },
  { test: /phone|mobile|(^|_)tel$/, kind: 'phone' },
  { test: /avatar|image|photo|thumbnail|picture/, kind: 'url' },
  { test: /(^|_)url$|website|(^|_)link$/, kind: 'url' },
  { test: /(^|_)city$/, kind: 'city' },
  { test: /(^|_)country$|(^|_)nation$/, kind: 'country' },
  { test: /(^|_)state$|(^|_)region$/, kind: 'region' },
  { test: /address|street/, kind: 'address' },
  { test: /zip|postal/, kind: 'zip' },
  { test: /(^|_)slug$/, kind: 'slug' },
  { test: /(^|_)ip$|(^|_)ipv4$|(^|_)ip_address$/, kind: 'ip' },
  { test: /password|passwd/, kind: 'password' },
  { test: /(^|_)title$|(^|_)subject$|(^|_)headline$/, kind: 'title' },
  { test: /description|summary|(^|_)bio$|(^|_)about$|(^|_)body$|(^|_)content$|(^|_)comment$|(^|_)message$|(^|_)notes?$/, kind: 'paragraph' },
  { test: /(^|_)status$|(^|_)role$|(^|_)plan$/, kind: 'status' },
  { test: /price|amount|cost|(^|_)total$|balance|salary|revenue/, kind: 'price' },
  { test: /created_at|updated_at|deleted_at|(^|_)timestamp$|_at$/, kind: 'timestamp' },
  { test: /(^|_)date$|(^|_)birthday$|(^|_)dob$/, kind: 'date' },
]

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[\s-]+/g, '_')
}

function inferFromName(name: string): GeneratorKind | null {
  const normalized = normalizeName(name)
  for (const rule of NAME_RULES) {
    if (rule.test.test(normalized)) return rule.kind
  }
  return null
}

function compatible(kind: GeneratorKind, sqlKind: SqlKind) {
  if (sqlKind === 'text') return TEXT_KINDS.has(kind)
  if (sqlKind === 'int' || sqlKind === 'bigint' || sqlKind === 'decimal') return NUMERIC_KINDS.has(kind)
  if (sqlKind === 'timestamp' || sqlKind === 'date') return kind === 'timestamp' || kind === 'date'
  return false
}

export function inferKind(name: string, sqlKind: SqlKind, hasEnum: boolean): GeneratorKind {
  if (hasEnum) return 'status'
  if (sqlKind === 'bool') return 'bool'
  if (sqlKind === 'json') return 'json'
  if (sqlKind === 'uuid') return 'uuid'

  const named = inferFromName(name)
  if (named && compatible(named, sqlKind)) return named

  switch (sqlKind) {
    case 'timestamp':
      return 'timestamp'
    case 'date':
      return 'date'
    case 'decimal':
      return 'decimal'
    case 'bigint':
      return 'bigint'
    case 'int':
      return 'int'
    default:
      return 'word'
  }
}

export function effectiveKind(column: ColumnSchema, override?: GeneratorKind): GeneratorKind {
  if (override) return override
  if (column.references) return 'fk'
  return column.inferredKind
}
