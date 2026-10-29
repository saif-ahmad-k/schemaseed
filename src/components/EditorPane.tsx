import { sql } from '@codemirror/lang-sql'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night'
import CodeMirror from '@uiw/react-codemirror'
import { Loader2, Play, Plus, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { examples } from '../lib/examples'
import { effectiveKind, GENERATOR_OPTIONS } from '../lib/infer'
import { DATA_LOCALES, type DataLocale } from '../lib/options'
import { useApp } from '../store'
import { columnKey, type GeneratorKind } from '../types'

const editorExtensions = [
  sql(),
  keymap.of([
    {
      key: 'Mod-Enter',
      preventDefault: true,
      run: () => {
        void useApp.getState().generate()
        return true
      },
    },
  ]),
  placeholder('CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  email VARCHAR(255)\n);'),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ spellcheck: 'false', 'aria-label': 'Schema editor' }),
  EditorView.theme({
    '&': { backgroundColor: 'transparent', fontSize: '13px' },
    '.cm-gutters': { backgroundColor: 'transparent', color: '#6d7585', border: 'none' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-content': { padding: '8px 0 16px' },
  }),
]

export function EditorPane() {
  const source = useApp((state) => state.source)
  const tables = useApp((state) => state.tables)
  const overrides = useApp((state) => state.overrides)
  const parseError = useApp((state) => state.parseError)
  const parseWarnings = useApp((state) => state.parseWarnings)
  const chaos = useApp((state) => state.chaos)
  const locale = useApp((state) => state.locale)
  const setLocale = useApp((state) => state.setLocale)
  const generating = useApp((state) => state.generating)
  const setSource = useApp((state) => state.setSource)
  const loadExample = useApp((state) => state.loadExample)
  const setOverride = useApp((state) => state.setOverride)
  const clearOverrides = useApp((state) => state.clearOverrides)
  const toggleChaos = useApp((state) => state.toggleChaos)
  const generate = useApp((state) => state.generate)
  const customSamples = useApp((state) => state.customSamples)
  const setSampleOpen = useApp((state) => state.setSampleOpen)

  const samples = [...examples, ...customSamples]
  const columnCount = tables.reduce((sum, table) => sum + table.columns.length, 0)
  const activeExample = samples.find((example) => source.trim() === example.source.trim())
  const shortcut = useMemo(
    () => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘↵' : 'Ctrl+Enter'),
    [],
  )

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0e1117]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-mist">Samples</div>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {samples.map((example) => {
            const active = source.trim() === example.source.trim()
            return (
              <button
                key={example.id}
                type="button"
                title={example.blurb}
                onClick={() => loadExample(example.id)}
                className={
                  active
                    ? 'shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs text-foam'
                    : 'shrink-0 rounded-md px-2 py-1 text-xs text-mist hover:bg-white/5 hover:text-foam'
                }
              >
                {example.name}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSampleOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-amber hover:bg-amber/10"
          >
            <Plus size={12} />
            New
          </button>
        </div>
      </div>
      <p className="border-b border-line px-3 py-1.5 text-[11px] leading-relaxed text-mist">
        {activeExample
          ? activeExample.blurb
          : 'The buttons above load example tables. They are sample schemas, not separate tools.'}
      </p>

      <div className="schema-editor min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={source}
          height="100%"
          theme={tokyoNight}
          extensions={editorExtensions}
          basicSetup={{ foldGutter: false, dropCursor: false }}
          onChange={setSource}
        />
      </div>

      <div className="max-h-40 shrink-0 overflow-auto border-t border-line lg:max-h-56">
        {tables.length === 0 ? (
          <p className="px-3 py-3 text-xs text-mist">Paste a CREATE TABLE statement or a CSV header.</p>
        ) : (
          <div className="px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wider text-mist">
                {tables.length} {tables.length === 1 ? 'table' : 'tables'} · {columnCount} columns
              </p>
              {Object.keys(overrides).length > 0 && (
                <button type="button" onClick={clearOverrides} className="text-[11px] text-amber hover:underline">
                  Reset generators
                </button>
              )}
            </div>
            <div className="space-y-3">
              {tables.map((table) => (
                <div key={table.name}>
                  <div className="mb-1 font-mono text-xs text-foam">{table.name}</div>
                  <div className="space-y-1">
                    {table.columns.map((column) => {
                      const kind = effectiveKind(column, overrides[columnKey(table.name, column.name)])
                      return (
                        <div key={column.name} className="grid grid-cols-[minmax(0,1fr)_148px] items-center gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-mono text-[12px] text-foam">{column.name}</span>
                              {column.primaryKey && <span className="text-[10px] font-semibold text-amber">PK</span>}
                              {!column.nullable && !column.primaryKey && (
                                <span className="text-[10px] text-mist">required</span>
                              )}
                            </div>
                            <div className="truncate font-mono text-[10px] text-mist">
                              {column.rawType}
                              {column.references ? ` → ${column.references.table}.${column.references.column}` : ''}
                            </div>
                          </div>
                          <select
                            aria-label={`Generator for ${table.name}.${column.name}`}
                            value={kind}
                            onChange={(event) => setOverride(table.name, column.name, event.target.value as GeneratorKind)}
                            className="h-7 rounded-md border border-line bg-panel-2 px-1.5 text-[11px] text-foam"
                          >
                            {GENERATOR_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(parseError || parseWarnings.length > 0) && (
        <div className="space-y-1 border-t border-line px-3 py-2 text-xs" role={parseError ? 'alert' : 'status'}>
          {parseError && <p className="text-danger">{parseError}</p>}
          {parseWarnings.map((warning) => (
            <p key={warning} className="text-mist">
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <label className="flex items-center gap-1.5 text-xs text-mist">
          Language
          <select
            aria-label="Data language"
            title="Names, cities, companies, and sentences use this language. Ids, emails, and CHECK lists stay as written."
            value={locale}
            onChange={(event) => setLocale(event.target.value as DataLocale)}
            className="h-8 rounded-md border border-line bg-panel-2 px-1.5 text-xs text-foam"
          >
            {DATA_LOCALES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={chaos}
          onClick={toggleChaos}
          className={
            chaos
              ? 'inline-flex items-center gap-1.5 rounded-md bg-amber/15 px-2.5 py-2 text-xs font-medium text-amber'
              : 'inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-2 text-xs text-mist hover:text-foam'
          }
        >
          <Zap size={14} />
          Chaos {chaos ? 'on' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || tables.length === 0}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-amber px-3 py-2 text-sm font-semibold text-[#24180b] hover:bg-[#efb25c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {generating ? 'Generating' : 'Generate data'}
          <span className="hidden text-[10px] font-medium opacity-70 sm:inline">{shortcut}</span>
        </button>
      </div>
    </section>
  )
}
