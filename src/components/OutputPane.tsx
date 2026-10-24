import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { exportFilename, exportText } from '../lib/export'
import { DIALECT_GROUPS, SQL_DIALECTS, type SqlDialect } from '../lib/options'
import { PRO_ROW_CAP, rowCap } from '../lib/plan'
import { useApp } from '../store'
import type { ExportFormat } from '../types'
import { DataGrid } from './DataGrid'

const formats: ExportFormat[] = ['json', 'csv', 'sql']

export function OutputPane() {
  const tables = useApp((state) => state.tables)
  const generated = useApp((state) => state.generated)
  const activeTable = useApp((state) => state.activeTable)
  const setActiveTable = useApp((state) => state.setActiveTable)
  const format = useApp((state) => state.format)
  const setFormat = useApp((state) => state.setFormat)
  const dialect = useApp((state) => state.dialect)
  const setDialect = useApp((state) => state.setDialect)
  const rowCount = useApp((state) => state.rowCount)
  const setRowCount = useApp((state) => state.setRowCount)
  const tier = useApp((state) => state.tier)
  const seed = useApp((state) => state.seed)
  const elapsedMs = useApp((state) => state.elapsedMs)
  const dirty = useApp((state) => state.dirty)
  const notice = useApp((state) => state.notice)
  const genWarnings = useApp((state) => state.genWarnings)
  const genError = useApp((state) => state.genError)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const schemaTable = tables.find((table) => table.name === activeTable) ?? tables[0]
  const dataTable = generated.find((table) => table.name === (schemaTable?.name ?? activeTable)) ?? null
  const columns = dataTable?.columns ?? schemaTable?.columns.map((column) => column.name) ?? []
  const rows = dataTable?.rows ?? []
  const viewing = dataTable?.name ?? schemaTable?.name ?? ''
  const canExport = generated.length > 0

  async function copyOutput() {
    if (!canExport) return
    const text = exportText(format, generated, viewing, dialect)
    const markCopied = () => {
      setCopyError(null)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }
    try {
      await navigator.clipboard.writeText(text)
      markCopied()
      return
    } catch {
      // Fall through to the legacy copy path when the page is not allowed to touch the clipboard.
    }
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (ok) markCopied()
    else setCopyError('Clipboard permission was blocked. Download the file instead.')
  }

  function downloadOutput() {
    if (!canExport) return
    const text = exportText(format, generated, viewing, dialect)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFilename(format, viewing)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0c0f14]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {(generated.length ? generated : tables).map((table) => (
            <button
              key={table.name}
              type="button"
              onClick={() => setActiveTable(table.name)}
              className={
                table.name === viewing
                  ? 'shrink-0 rounded-md bg-white/10 px-2 py-1 font-mono text-xs text-foam'
                  : 'shrink-0 rounded-md px-2 py-1 font-mono text-xs text-mist hover:bg-white/5 hover:text-foam'
              }
            >
              {table.name}
              {'rows' in table ? ` · ${table.rows.length}` : ''}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-mist" title="Changes the SQL insert file. JSON and CSV stay the same.">
          Database
          <select
            aria-label="SQL database"
            value={dialect}
            onChange={(event) => setDialect(event.target.value as SqlDialect)}
            className="h-7 max-w-[9.5rem] rounded-md border border-line bg-panel-2 px-1.5 text-xs text-foam"
          >
            {DIALECT_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {SQL_DIALECTS.filter((item) => item.group === group).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.pro && tier === 'free' ? ' · Pro' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-mist">
          Rows
          <input
            aria-label="Row count"
            type="number"
            min={1}
            max={rowCap(tier)}
            value={rowCount}
            onChange={(event) => setRowCount(event.target.valueAsNumber)}
            className="h-7 w-20 rounded-md border border-line bg-panel-2 px-2 font-mono text-xs text-foam"
          />
        </label>
        <div className="flex rounded-md border border-line p-0.5">
          {formats.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFormat(item)}
              className={
                format === item
                  ? 'rounded px-2 py-1 text-[11px] font-semibold uppercase text-foam'
                  : 'rounded px-2 py-1 text-[11px] font-semibold uppercase text-mist hover:text-foam'
              }
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copyOutput()}
          disabled={!canExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-foam hover:bg-white/5 disabled:opacity-40"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : `Copy ${format.toUpperCase()}`}
        </button>
        <button
          type="button"
          onClick={downloadOutput}
          disabled={!canExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-foam hover:bg-white/5 disabled:opacity-40"
        >
          <Download size={14} />
          Download
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <DataGrid
          columns={columns}
          rows={rows}
          emptyHint={
            columns.length
              ? 'This preview fills when you generate. A name column becomes a person name, an email becomes an email, a CHECK list stays inside its values, and a foreign key uses an id from the parent rows. Then copy or download JSON, CSV, or SQL.'
              : 'Paste a CREATE TABLE on the left. Shop is a runnable example: customers, products, and orders.'
          }
        />
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-1.5 text-[11px] text-mist">
        {tier === 'free' && <span>Free uses the first table and {rowCap('free')} rows. SQL is included for the databases without a Pro mark.</span>}
        {tier === 'pro' && <span>Pro · up to {PRO_ROW_CAP.toLocaleString()} rows</span>}
        {rows.length > 0 && <span>Preview of {rows.length} rows. Copy or download when it looks right.</span>}
        {format === 'sql' && (
          <span>
            {SQL_DIALECTS.find((item) => item.id === dialect)?.label} inserts, parents first.
          </span>
        )}
        {format !== 'sql' && viewing && <span>JSON and CSV export {viewing}. Database only changes SQL inserts.</span>}
        {seed !== null && (
          <span>
            Seed {seed}
            {elapsedMs !== null ? ` · ${elapsedMs} ms` : ''}
          </span>
        )}
        {dirty && <span className="text-amber">Generate again to refresh the grid.</span>}
        {notice && <span className="text-amber">{notice}</span>}
        {copyError && <span className="text-danger">{copyError}</span>}
        {genError && <span className="text-danger">{genError}</span>}
        {genWarnings.map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </section>
  )
}
