export const DATA_LOCALES = [
  { id: 'en', label: 'English', pro: false },
  { id: 'es', label: 'Spanish', pro: false },
  { id: 'fr', label: 'French', pro: false },
  { id: 'de', label: 'German', pro: false },
  { id: 'pt_BR', label: 'Portuguese', pro: false },
  { id: 'zh_CN', label: 'Chinese', pro: true },
  { id: 'ru', label: 'Russian', pro: true },
  { id: 'ja', label: 'Japanese', pro: true },
  { id: 'ar', label: 'Arabic', pro: true },
] as const

export type DataLocale = (typeof DATA_LOCALES)[number]['id']

export interface DialectStyle {
  quote: 'double' | 'backtick' | 'bracket'
  bool: 'upper' | 'lower' | 'bit'
  nationalStrings: boolean
  time: 'iso' | 'space' | 'oracle' | 'typed'
  insertAll: boolean
}

const postgres: DialectStyle = { quote: 'double', bool: 'upper', nationalStrings: false, time: 'iso', insertAll: false }
const mysql: DialectStyle = { quote: 'backtick', bool: 'bit', nationalStrings: false, time: 'space', insertAll: false }
const mssql: DialectStyle = { quote: 'bracket', bool: 'bit', nationalStrings: true, time: 'space', insertAll: false }
const oracle: DialectStyle = { quote: 'double', bool: 'bit', nationalStrings: true, time: 'oracle', insertAll: true }
const warehouse: DialectStyle = { quote: 'double', bool: 'upper', nationalStrings: false, time: 'space', insertAll: false }
const google: DialectStyle = { quote: 'backtick', bool: 'upper', nationalStrings: false, time: 'space', insertAll: false }
const spark: DialectStyle = { quote: 'backtick', bool: 'lower', nationalStrings: false, time: 'space', insertAll: false }
const trino: DialectStyle = { quote: 'double', bool: 'lower', nationalStrings: false, time: 'typed', insertAll: false }
const clickhouse: DialectStyle = { quote: 'backtick', bool: 'lower', nationalStrings: false, time: 'space', insertAll: false }

export const SQL_DIALECTS = [
  { id: 'postgres', label: 'PostgreSQL', group: 'Relational', pro: false, style: postgres },
  { id: 'mysql', label: 'MySQL', group: 'Relational', pro: false, style: mysql },
  { id: 'mariadb', label: 'MariaDB', group: 'Relational', pro: false, style: mysql },
  { id: 'mssql', label: 'SQL Server', group: 'Relational', pro: false, style: mssql },
  { id: 'azuresql', label: 'Azure SQL', group: 'Relational', pro: false, style: mssql },
  { id: 'sqlite', label: 'SQLite', group: 'Relational', pro: false, style: { quote: 'double', bool: 'bit', nationalStrings: false, time: 'iso', insertAll: false } },
  { id: 'cockroach', label: 'CockroachDB', group: 'Relational', pro: false, style: postgres },
  { id: 'yugabyte', label: 'YugabyteDB', group: 'Relational', pro: false, style: postgres },
  { id: 'tidb', label: 'TiDB', group: 'Relational', pro: false, style: mysql },
  { id: 'singlestore', label: 'SingleStore', group: 'Relational', pro: false, style: mysql },
  { id: 'oracle', label: 'Oracle', group: 'Relational', pro: true, style: oracle },
  { id: 'db2', label: 'IBM Db2', group: 'Relational', pro: true, style: { quote: 'double', bool: 'bit', nationalStrings: false, time: 'space', insertAll: false } },
  { id: 'firebird', label: 'Firebird', group: 'Relational', pro: true, style: { quote: 'double', bool: 'bit', nationalStrings: false, time: 'space', insertAll: false } },
  { id: 'snowflake', label: 'Snowflake', group: 'Warehouses', pro: true, style: warehouse },
  { id: 'bigquery', label: 'BigQuery', group: 'Warehouses', pro: true, style: google },
  { id: 'redshift', label: 'Amazon Redshift', group: 'Warehouses', pro: true, style: warehouse },
  { id: 'databricks', label: 'Databricks', group: 'Warehouses', pro: true, style: spark },
  { id: 'synapse', label: 'Azure Synapse', group: 'Warehouses', pro: true, style: mssql },
  { id: 'teradata', label: 'Teradata', group: 'Warehouses', pro: true, style: { quote: 'double', bool: 'bit', nationalStrings: false, time: 'typed', insertAll: false } },
  { id: 'vertica', label: 'Vertica', group: 'Warehouses', pro: true, style: warehouse },
  { id: 'spanner', label: 'Cloud Spanner', group: 'Warehouses', pro: true, style: google },
  { id: 'clickhouse', label: 'ClickHouse', group: 'Analytics', pro: true, style: clickhouse },
  { id: 'duckdb', label: 'DuckDB', group: 'Analytics', pro: true, style: postgres },
  { id: 'hive', label: 'Apache Hive', group: 'Analytics', pro: true, style: spark },
  { id: 'spark', label: 'Spark SQL', group: 'Analytics', pro: true, style: spark },
  { id: 'trino', label: 'Trino', group: 'Analytics', pro: true, style: trino },
  { id: 'presto', label: 'Presto', group: 'Analytics', pro: true, style: trino },
  { id: 'athena', label: 'Amazon Athena', group: 'Analytics', pro: true, style: trino },
] as const

export type SqlDialect = (typeof SQL_DIALECTS)[number]['id']

export const DIALECT_GROUPS = ['Relational', 'Warehouses', 'Analytics'] as const

export function dialectStyle(id: SqlDialect): DialectStyle {
  return SQL_DIALECTS.find((item) => item.id === id)?.style ?? postgres
}

export const STATUS_WORDS: Record<DataLocale, string[]> = {
  en: ['active', 'pending', 'archived', 'trial', 'paused'],
  es: ['activo', 'pendiente', 'archivado', 'prueba', 'pausado'],
  zh_CN: ['启用', '待处理', '已归档', '试用', '已暂停'],
  ru: ['активен', 'ожидание', 'архив', 'пробный', 'пауза'],
  fr: ['actif', 'en attente', 'archivé', 'essai', 'en pause'],
  de: ['aktiv', 'ausstehend', 'archiviert', 'test', 'pausiert'],
  pt_BR: ['ativo', 'pendente', 'arquivado', 'teste', 'pausado'],
  ja: ['有効', '保留', 'アーカイブ', '試用', '停止'],
  ar: ['نشط', 'قيد الانتظار', 'مؤرشف', 'تجريبي', 'متوقف'],
}

export function isProLocale(id: DataLocale) {
  return DATA_LOCALES.find((item) => item.id === id)?.pro === true
}

export function isProDialect(id: SqlDialect) {
  return SQL_DIALECTS.find((item) => item.id === id)?.pro === true
}

export function isDataLocale(value: string): value is DataLocale {
  return DATA_LOCALES.some((item) => item.id === value)
}

export function isSqlDialect(value: string): value is SqlDialect {
  return SQL_DIALECTS.some((item) => item.id === value)
}
