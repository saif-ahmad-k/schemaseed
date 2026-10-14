import { useMemo, useState } from 'react'
import { columnsToDdl } from '../lib/columnsToDdl'
import { parseSchema } from '../lib/parseSchema'
import { useApp } from '../store'
import { Modal } from './Modal'

type SampleMode = 'columns' | 'ddl'

export function SampleDialog() {
  const setSampleOpen = useApp((state) => state.setSampleOpen)
  const applySchema = useApp((state) => state.applySchema)
  const saveSample = useApp((state) => state.saveSample)
  const removeSample = useApp((state) => state.removeSample)
  const customSamples = useApp((state) => state.customSamples)
  const [mode, setMode] = useState<SampleMode>('columns')
  const [name, setName] = useState('')
  const [tableName, setTableName] = useState('customers')
  const [text, setText] = useState('email, full_name, city, created_at')
  const [formError, setFormError] = useState<string | null>(null)

  const draft = useMemo(() => (mode === 'columns' ? columnsToDdl(tableName, text) : { sql: text.trim(), error: null }), [mode, tableName, text])
  const parsed = useMemo(() => (draft.sql ? parseSchema(draft.sql) : null), [draft.sql])
  const problem = draft.error ?? parsed?.error ?? null

  function sourceOrError() {
    if (problem || !draft.sql) {
      setFormError(problem ?? 'Add a schema first.')
      return null
    }
    setFormError(null)
    return draft.sql
  }

  function useSchema() {
    const source = sourceOrError()
    if (source) applySchema(source)
  }

  function save() {
    const source = sourceOrError()
    if (!source) return
    if (!name.trim()) {
      setFormError('Name the sample before saving it.')
      return
    }
    saveSample(name, source)
  }

  return (
    <Modal title="New sample" onClose={() => setSampleOpen(false)}>
      <p className="text-sm text-mist">
        Start from a comma-separated list of column names, or paste a CREATE TABLE statement. Saving keeps the sample on this browser, next to Shop, Blog, and Company.
      </p>
      <div className="mt-4 flex rounded-md border border-line p-0.5">
        <button
          type="button"
          onClick={() => setMode('columns')}
          className={mode === 'columns' ? 'flex-1 rounded bg-white/10 px-2 py-1.5 text-xs font-medium text-foam' : 'flex-1 rounded px-2 py-1.5 text-xs text-mist'}
        >
          Column names
        </button>
        <button
          type="button"
          onClick={() => setMode('ddl')}
          className={mode === 'ddl' ? 'flex-1 rounded bg-white/10 px-2 py-1.5 text-xs font-medium text-foam' : 'flex-1 rounded px-2 py-1.5 text-xs text-mist'}
        >
          CREATE TABLE
        </button>
      </div>
      <label className="mt-3 block text-xs text-mist">
        Sample name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Support tickets"
          className="mt-1 h-8 w-full rounded-md border border-line bg-ink px-2 text-sm text-foam"
        />
      </label>
      {mode === 'columns' && (
        <label className="mt-3 block text-xs text-mist">
          Table name
          <input
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-line bg-ink px-2 font-mono text-sm text-foam"
          />
        </label>
      )}
      <label className="mt-3 block text-xs text-mist">
        {mode === 'columns' ? 'Columns, separated by commas' : 'SQL'}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          placeholder={mode === 'columns' ? 'email, full_name, city' : 'CREATE TABLE tickets (\n  id INTEGER PRIMARY KEY,\n  email VARCHAR(255)\n);'}
          className="mt-1 h-36 w-full resize-y rounded-md border border-line bg-ink p-2 font-mono text-xs leading-relaxed text-foam"
        />
      </label>
      {draft.sql && (
        <pre className="mt-3 max-h-28 overflow-auto rounded-md border border-line bg-ink p-2 font-mono text-[11px] text-mist">{draft.sql}</pre>
      )}
      {(problem || formError) && <p className="mt-2 text-xs text-danger">{formError ?? problem}</p>}
      {parsed && !parsed.error && (
        <p className="mt-2 text-xs text-mist">
          {parsed.tables.length} {parsed.tables.length === 1 ? 'table' : 'tables'} · {parsed.tables.reduce((sum, table) => sum + table.columns.length, 0)} columns
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={useSchema} className="flex-1 rounded-md border border-line px-3 py-2 text-sm text-foam hover:bg-white/5">
          Use this schema
        </button>
        <button type="button" onClick={save} className="flex-1 rounded-md bg-amber px-3 py-2 text-sm font-semibold text-[#24180b] hover:bg-[#efb25c]">
          Save sample
        </button>
      </div>
      {customSamples.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <div className="text-[11px] uppercase tracking-wider text-mist">Saved on this browser</div>
          <ul className="mt-2 space-y-1">
            {customSamples.map((sample) => (
              <li key={sample.id} className="flex items-center gap-2">
                <button type="button" onClick={() => applySchema(sample.source)} className="min-w-0 flex-1 truncate text-left text-sm text-foam hover:underline">
                  {sample.name}
                </button>
                <button type="button" onClick={() => removeSample(sample.id)} className="text-xs text-mist hover:text-danger">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
