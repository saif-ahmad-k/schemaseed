import { Modal } from './Modal'
import { useApp } from '../store'

export function DocsDialog() {
  const setDocsOpen = useApp((state) => state.setDocsOpen)

  return (
    <Modal title="How SchemaSeed works" onClose={() => setDocsOpen(false)}>
      <div className="space-y-4 text-sm leading-relaxed text-mist">
        <p>Paste one or more CREATE TABLE statements, or a single CSV header row. The schema stays in this browser.</p>
        <p>
          Shop, Blog, and Company are sample schemas. New opens a window where you can type comma-separated column names or a CREATE TABLE statement, then save that sample in this browser.
        </p>
        <p>
          Language changes names, cities, companies, and sentences. English, Spanish, French, German, and Portuguese are
          free. Chinese, Russian, Japanese, and Arabic are Pro. Ids, emails, and values locked by a CHECK list stay as
          written in the schema.
        </p>
        <p>
          Database picks the insert syntax. PostgreSQL, MySQL, MariaDB, SQLite, and SQL Server are free. Oracle,
          ClickHouse, Snowflake, BigQuery, and the other expert engines are Pro. JSON and CSV stay the same. SQL Server
          and Oracle prefix text with N. Oracle uses INSERT ALL. ClickHouse, Snowflake, and BigQuery write datetimes as{' '}
          <span className="font-mono text-xs text-foam">YYYY-MM-DD HH:MM:SS</span>.
        </p>
        <p>
          Column names and SQL types pick a generator. <span className="text-foam">email</span> becomes an email,{' '}
          <span className="text-foam">created_at</span> becomes a timestamp, and a CHECK list such as{' '}
          <span className="font-mono text-xs text-foam">IN ('draft', 'active')</span> is used as the only allowed values.
          You can override any column before generating.
        </p>
        <p>
          Foreign keys are filled from the parent rows. <span className="font-mono text-xs text-foam">orders.user_id</span>{' '}
          only uses ids that exist on <span className="font-mono text-xs text-foam">users</span>, and the SQL export
          inserts parents first.
        </p>
        <p>
          Chaos rewrites about 5% of cells: empty strings, nulls where the column allows them, boundary numbers, and
          characters that usually break a layout. Primary keys stay valid. Nullable foreign keys may become null.
        </p>
        <p>JSON and CSV export the table you are viewing. SQL export writes every generated table. Ctrl+Enter, or ⌘+Enter, generates again.</p>
      </div>
    </Modal>
  )
}
