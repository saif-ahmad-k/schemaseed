import { columnsToDdl } from '../src/lib/columnsToDdl'
import { entitlementFromPayload, findLicenseKey } from '../src/lib/entitlement'
import { toCsv, toSql } from '../src/lib/export'
import { examples } from '../src/lib/examples'
import { generateDataset } from '../src/lib/generate'
import { parseSchema } from '../src/lib/parseSchema'
import type { GenerateRequest } from '../src/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const shop = parseSchema(examples[0].source)
assert(shop.tables.length === 3, 'ecommerce should parse 3 tables')
const orders = shop.tables.find((table) => table.name === 'orders')
const userId = orders?.columns.find((column) => column.name === 'user_id')
assert(userId?.references?.table === 'users' && userId.references.column === 'id', 'orders.user_id should reference users.id')
const status = shop.tables.find((table) => table.name === 'products')?.columns.find((column) => column.name === 'status')
assert(status?.enumValues?.join(',') === 'draft,active,archived', 'status check constraint should become an enum')

const blog = parseSchema(examples[1].source)
assert(blog.tables[0].columns[0].sqlKind === 'uuid', 'author id should be uuid')
assert(blog.tables[1].columns.find((column) => column.name === 'author_id')?.references?.table === 'authors', 'post author fk')

const csv = parseSchema(examples[3].source)
assert(csv.mode === 'csv' && csv.tables[0].columns.length === 6, 'csv header should become six columns')
assert(csv.tables[0].columns[0].inferredKind === 'email', 'email header should infer email')

const commented = parseSchema(`-- note
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR(255) -- contact
);`)
assert(commented.tables[0]?.columns.length === 2, 'comments should be ignored')

const dialect = parseSchema(`CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  display_name CHARACTER VARYING(40) NOT NULL,
  balance NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN
);`)
const display = dialect.tables[0].columns.find((column) => column.name === 'display_name')
assert(display?.maxLength === 40, 'character varying length')
assert(dialect.tables[0].columns.find((column) => column.name === 'created_at')?.sqlKind === 'timestamp', 'timestamptz')
assert(dialect.tables[0].columns.find((column) => column.name === 'balance')?.sqlKind === 'decimal', 'numeric')

const clickhouseDdl = parseSchema(`CREATE TABLE IF NOT EXISTS pipm_etl.P60M_ERI_2G_BSC_AOIP_hot_local on cluster 'pipm'
(
  \`DATETIME\`           DateTime CODEC(ZSTD(1)),
  \`SOURCE\`             LowCardinality(String) CODEC(ZSTD(9)),
  \`NODEID\`             Int64 CODEC(ZSTD(1)),
  \`COLLINTERVAL\`       UInt16 CODEC(ZSTD(1)),
  \`INSERT_DATETIME\`    DateTime DEFAULT now() CODEC(ZSTD(1)),
  \`AGGRTD_ROW_COUNT\`   Nullable(Int64) CODEC(ZSTD(1)),
  \`SUSPECT\`            LowCardinality(Nullable(String)) CODEC(ZSTD(9)),
  \`CODECCHATT\`         Nullable(Float64) COMMENT 'Total number of attempts to change to incompatible Codec' CODEC(ZSTD(1))
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/pipm/{layer}-{shard}/pipm_etl/P60M_ERI_2G_BSC_AOIP_hot_local',
                                      '{replica}',
                                      \`INSERT_DATETIME\`)
PARTITION BY toStartOfDay(\`DATETIME\`)
PRIMARY KEY (\`DATETIME\`,\`SOURCE\`)
ORDER BY (\`DATETIME\`,\`SOURCE\`)
SETTINGS min_bytes_for_wide_part='1024G';`)
assert(clickhouseDdl.error === null && clickhouseDdl.tables.length === 1, 'clickhouse create table should parse')
assert(clickhouseDdl.tables[0]?.name === 'P60M_ERI_2G_BSC_AOIP_hot_local', 'clickhouse table name should drop the database')
const chColumns = clickhouseDdl.tables[0]?.columns ?? []
assert(chColumns.length === 8, 'clickhouse columns should ignore engine and settings')
const chDatetime = chColumns.find((column) => column.name === 'DATETIME')
assert(chDatetime?.sqlKind === 'timestamp' && chDatetime.primaryKey && !chDatetime.nullable, 'clickhouse datetime primary key')
assert(chColumns.find((column) => column.name === 'NODEID')?.sqlKind === 'bigint', 'clickhouse int64')
assert(chColumns.find((column) => column.name === 'COLLINTERVAL')?.sqlKind === 'int', 'clickhouse uint16')
assert(chColumns.find((column) => column.name === 'AGGRTD_ROW_COUNT')?.nullable, 'clickhouse nullable int')
assert(chColumns.find((column) => column.name === 'SUSPECT')?.nullable && chColumns.find((column) => column.name === 'SUSPECT')?.sqlKind === 'text', 'nested nullable string')
assert(chColumns.find((column) => column.name === 'CODECCHATT')?.sqlKind === 'decimal', 'clickhouse float64 with a comment')

const mysql = parseSchema('CREATE TABLE `users` (`id` INT PRIMARY KEY, `email` VARCHAR(255));')
assert(mysql.tables[0].name === 'users' && mysql.tables[0].columns[1].name === 'email', 'mysql backticks')

const tableFk = parseSchema(`CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);`)
assert(tableFk.tables[1].columns[1].references?.table === 'users', 'table-level foreign key')

const rejected = parseSchema('SELECT * FROM users;')
assert(rejected.error?.includes('CREATE TABLE'), 'select statements should be rejected')

const request: GenerateRequest = {
  id: 1,
  tables: shop.tables,
  overrides: {},
  rowCount: 40,
  chaos: false,
  seed: 7,
  locale: 'en',
}
const generated = generateDataset(request)
const users = generated.tables.find((table) => table.name === 'users')
const products = generated.tables.find((table) => table.name === 'products')
const orderRows = generated.tables.find((table) => table.name === 'orders')
assert(users && products && orderRows, 'all three tables generated')
assert(generated.tables.map((table) => table.name).join(',') === 'users,products,orders', 'parents are generated first')
const userIds = new Set(users.rows.map((row) => row.id))
const productIds = new Set(products.rows.map((row) => row.id))
for (const row of orderRows.rows) {
  assert(userIds.has(row.user_id), `user_id ${String(row.user_id)} is not a users.id`)
  assert(row.product_id === null || productIds.has(row.product_id), 'product_id should be null or a real product')
}
for (const row of products.rows) {
  assert(['draft', 'active', 'archived'].includes(String(row.status)), 'status should come from the check list')
}
assert(String(users.rows[0].email).includes('@'), 'email should look like an email')

const blogRows = generateDataset({
  id: 2,
  tables: blog.tables,
  overrides: {},
  rowCount: 15,
  chaos: false,
  seed: 3,
  locale: 'en',
})
const authorIds = new Set(blogRows.tables[0].rows.map((row) => row.id))
for (const row of blogRows.tables[1].rows) {
  assert(authorIds.has(row.author_id), 'author_id should come from authors.id')
  assert(String(row.author_id).includes('-'), 'uuid foreign key')
}

const sql = toSql([
  {
    name: 'users',
    columns: ['id', 'email'],
    rows: [
      { id: 1, email: "O'Hara" },
      { id: 2, email: null },
    ],
  },
])
assert(sql.includes("'O''Hara'") && sql.includes('NULL'), 'sql values should be escaped')
assert(toCsv({ name: 't', columns: ['a', 'b'], rows: [{ a: null, b: '' }] }) === 'a,b\n,""', 'csv null and empty string differ')

const chaotic = generateDataset({ ...request, id: 3, rowCount: 400, chaos: true, seed: 11 })
const exotic = chaotic.tables.some((table) =>
  table.rows.some((row) =>
    Object.values(row).some((value) => typeof value === 'string' && (value.includes('🚀') || value.includes('DROP TABLE') || value.includes('김'))),
  ),
)
assert(exotic, 'chaos mode should inject edge-case strings')

const chaosUsers = new Set(chaotic.tables.find((table) => table.name === 'users')!.rows.map((row) => row.id))
for (const row of chaotic.tables.find((table) => table.name === 'orders')!.rows) {
  assert(chaosUsers.has(row.user_id), 'not-null foreign keys survive chaos')
}

const chinese = generateDataset({ ...request, id: 4, locale: 'zh_CN', seed: 4, rowCount: 8, chaos: false })
assert(
  chinese.tables[0].rows.some((row) => /[\u4e00-\u9fff]/.test(String(row.full_name))),
  'chinese locale should produce chinese names',
)
const spanish = generateDataset({ ...request, id: 5, locale: 'es', seed: 4, rowCount: 8, chaos: false })
assert(spanish.tables[0].rows[0].full_name !== chinese.tables[0].rows[0].full_name, 'locale should change names')

const mssql = toSql(
  [
    {
      name: 'order',
      columns: ['id', 'active', 'full_name', 'created_at'],
      rows: [{ id: 1, active: true, full_name: '李娜', created_at: '2026-10-14T12:00:00.000Z' }],
    },
  ],
  'mssql',
)
assert(mssql.includes('[order]'), 'sql server should bracket a reserved name')
assert(mssql.includes("N'李娜'"), 'sql server should prefix unicode strings')
assert(mssql.includes('2026-10-14 12:00:00'), 'sql server should write a datetime without T')
assert(mssql.includes(', 1, N'), 'sql server should write booleans as 1 or 0')

const clickhouse = toSql(
  [
    {
      name: 'events',
      columns: ['created_at', 'ok'],
      rows: [{ created_at: '2026-10-14T12:00:00.000Z', ok: true }],
    },
  ],
  'clickhouse',
)
assert(clickhouse.includes("'2026-10-14 12:00:00'"), 'clickhouse datetime')
assert(clickhouse.includes('true'), 'clickhouse boolean')
assert(toSql([{ name: 't', columns: ['ok'], rows: [{ ok: false }] }], 'postgres').includes('FALSE'), 'postgres boolean')

const ddl = columnsToDdl('tickets', 'email, full name, city')
assert(ddl.sql.includes('CREATE TABLE tickets'), 'column names should become a table')
assert(ddl.sql.includes('"full name"'), 'column names with spaces should be quoted')

const oracle = toSql(
  [
    {
      name: 'orders',
      columns: ['id', 'created_at', 'active'],
      rows: [{ id: 1, created_at: '2026-10-14T12:00:00.000Z', active: true }],
    },
  ],
  'oracle',
)
assert(oracle.startsWith('INSERT ALL'), 'oracle should use insert all')
assert(oracle.includes("TO_DATE('2026-10-14 12:00:00'"), 'oracle should wrap timestamps')
assert(oracle.includes('SELECT 1 FROM dual;'), 'oracle should close with dual')

const mysqlSql = toSql(
  [
    {
      name: 't',
      columns: ['order', 'ok'],
      rows: [{ order: 'a', ok: true }],
    },
  ],
  'mysql',
)
assert(mysqlSql.includes('`order`'), 'mysql should backtick a reserved name')
assert(mysqlSql.includes(', 1)'), 'mysql should write booleans as 1 or 0')

const dayPass = entitlementFromPayload(
  {
    valid: true,
    license_key: { status: 'active', key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', expires_at: null },
    meta: { variant_name: '24 hours', customer_email: 'a@b.c' },
    instance: { id: 'inst' },
  },
  1_000,
)
assert(dayPass.ok && dayPass.record.plan === 'day' && dayPass.record.expiresAt === 1_000 + 86_400_000, 'day pass lasts 24 hours')

const yearPass = entitlementFromPayload(
  {
    valid: true,
    license_key: { status: 'active', key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', expires_at: null },
    meta: { variant_name: '1 year' },
  },
  1_000,
)
assert(yearPass.ok && yearPass.record.plan === 'year' && yearPass.record.expiresAt === 1_000 + 365 * 86_400_000, 'year pass lasts 365 days')

const ended = entitlementFromPayload(
  {
    valid: true,
    license_key: { status: 'active', key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', expires_at: '2020-01-01 00:00:00' },
  },
  Date.now(),
)
assert(!ended.ok, 'expired pass should be rejected')
if (!ended.ok) assert(ended.error.includes('ended'), 'expired pass explains that it ended')

assert(
  findLicenseKey({ order: { license_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } }) === 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'checkout success should reveal a license key',
)

console.log('probe ok')
