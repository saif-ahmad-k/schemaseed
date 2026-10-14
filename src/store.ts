import { create } from 'zustand'
import { findLicenseKey, type LicenseRecord } from './lib/entitlement'
import { examples, type SchemaExample } from './lib/examples'
import { parseSchema } from './lib/parseSchema'
import { redeemLicense, recheckLicense } from './lib/license'
import { FREE_TABLE_CAP, rowCap } from './lib/plan'
import { runGenerate } from './lib/workerClient'
import { isDataLocale, isProDialect, isProLocale, isSqlDialect, type DataLocale, type SqlDialect } from './lib/options'
import { columnKey, type ExportFormat, type GeneratedTable, type GeneratorKind, type ParseResult, type TableSchema, type Tier } from './types'

const initialSource = examples[0].source
const initialParse = parseSchema(initialSource)

function readSamples(): SchemaExample[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('schemacraft-samples') ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.source !== 'string') return []
      return [{ id: record.id, name: record.name.slice(0, 40), blurb: 'Saved on this browser.', source: record.source, custom: true }]
    })
  } catch {
    return []
  }
}

function writeSamples(samples: SchemaExample[]) {
  try {
    localStorage.setItem('schemacraft-samples', JSON.stringify(samples.map(({ id, name, source }) => ({ id, name, source }))))
  } catch {
    // Private mode can block storage. The sample still applies for this session.
  }
}
const LICENSE_KEY = 'schemacraft-license'

function readLicense(): LicenseRecord | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LICENSE_KEY) ?? 'null') as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const plan = record.plan === 'month' || record.plan === 'year' || record.plan === 'lifetime' ? 'month' : record.plan === 'day' ? 'day' : null
    if (typeof record.key !== 'string' || !plan) return null
    if (record.expiresAt !== null && typeof record.expiresAt !== 'number') return null
    if (record.expiresAt !== null && record.expiresAt <= Date.now()) {
      localStorage.removeItem(LICENSE_KEY)
      return null
    }
    return {
      key: record.key,
      instanceId: typeof record.instanceId === 'string' ? record.instanceId : null,
      plan,
      expiresAt: typeof record.expiresAt === 'number' ? record.expiresAt : null,
      email: typeof record.email === 'string' ? record.email : null,
    }
  } catch {
    return null
  }
}

function writeLicense(record: LicenseRecord | null) {
  try {
    if (!record) localStorage.removeItem(LICENSE_KEY)
    else localStorage.setItem(LICENSE_KEY, JSON.stringify(record))
  } catch {
    // Private mode can block storage. The license still applies for this session.
  }
}

const savedLicense = readLicense()

function tablesForRequest(tables: TableSchema[], tier: Tier, overrides: Record<string, GeneratorKind>) {
  const selected = tier === 'pro' ? tables : tables.slice(0, FREE_TABLE_CAP)
  if (tier === 'pro') return { tables: selected, overrides }
  const nextOverrides = { ...overrides }
  for (const [key, kind] of Object.entries(nextOverrides)) {
    if (kind === 'fk') delete nextOverrides[key]
  }
  return {
    tables: selected.map((table) => ({
      ...table,
      columns: table.columns.map((column) => ({ ...column, references: undefined })),
    })),
    overrides: nextOverrides,
  }
}

interface AppState {
  source: string
  tables: TableSchema[]
  parseWarnings: string[]
  parseError: string | null
  parseMode: ParseResult['mode']
  overrides: Record<string, GeneratorKind>
  rowCount: number
  chaos: boolean
  locale: DataLocale
  dialect: SqlDialect
  format: ExportFormat
  tier: Tier
  plan: 'free' | 'day' | 'month'
  expiresAt: number | null
  licenseEmail: string | null
  licenseBusy: boolean
  licenseError: string | null
  activeTable: string
  generated: GeneratedTable[]
  genWarnings: string[]
  genError: string | null
  generating: boolean
  seed: number | null
  elapsedMs: number | null
  dirty: boolean
  editVersion: number
  notice: string | null
  docsOpen: boolean
  proOpen: boolean
  sampleOpen: boolean
  customSamples: SchemaExample[]
  setSource: (source: string) => void
  loadExample: (id: string) => void
  applySchema: (source: string) => void
  saveSample: (name: string, source: string) => void
  removeSample: (id: string) => void
  setSampleOpen: (open: boolean) => void
  setOverride: (table: string, column: string, kind: GeneratorKind) => void
  clearOverrides: () => void
  setRowCount: (value: number) => void
  toggleChaos: () => void
  setLocale: (locale: DataLocale) => void
  setDialect: (dialect: SqlDialect) => void
  setFormat: (format: ExportFormat) => void
  redeemKey: (key: string) => Promise<void>
  refreshLicense: () => Promise<void>
  clearLicense: () => void
  noteCheckout: (data: unknown) => void
  setActiveTable: (name: string) => void
  setDocsOpen: (open: boolean) => void
  setProOpen: (open: boolean) => void
  generate: () => Promise<void>
}

let parseTimer = 0

function applyParse(source: string) {
  const parsed = parseSchema(source)
  const current = useApp.getState()
  const active = parsed.tables.some((table) => table.name === current.activeTable)
    ? current.activeTable
    : parsed.tables[0]?.name ?? ''
  useApp.setState({
    tables: parsed.tables,
    parseWarnings: parsed.warnings,
    parseError: parsed.error,
    parseMode: parsed.mode,
    activeTable: active,
    dirty: current.generated.length > 0,
    editVersion: current.editVersion + 1,
  })
}

export const useApp = create<AppState>((set, get) => ({
  source: initialSource,
  tables: initialParse.tables,
  parseWarnings: initialParse.warnings,
  parseError: initialParse.error,
  parseMode: initialParse.mode,
  overrides: {},
  rowCount: 50,
  chaos: false,
  locale: 'en',
  dialect: 'postgres',
  format: 'json',
  tier: savedLicense ? 'pro' : 'free',
  plan: savedLicense?.plan ?? 'free',
  expiresAt: savedLicense?.expiresAt ?? null,
  licenseEmail: savedLicense?.email ?? null,
  licenseBusy: false,
  licenseError: null,
  activeTable: initialParse.tables[0]?.name ?? '',
  generated: [],
  genWarnings: [],
  genError: null,
  generating: false,
  seed: null,
  elapsedMs: null,
  dirty: false,
  editVersion: 0,
  notice: null,
  docsOpen: false,
  proOpen: false,
  sampleOpen: false,
  customSamples: readSamples(),

  setSource: (source) => {
    set({ source })
    window.clearTimeout(parseTimer)
    parseTimer = window.setTimeout(() => applyParse(source), 160)
  },

  loadExample: (id) => {
    const example = examples.find((item) => item.id === id) ?? get().customSamples.find((item) => item.id === id)
    if (!example) return
    window.clearTimeout(parseTimer)
    set({ source: example.source, overrides: {} })
    applyParse(example.source)
  },

  applySchema: (source) => {
    window.clearTimeout(parseTimer)
    set({ source, overrides: {}, sampleOpen: false })
    applyParse(source)
  },

  saveSample: (name, source) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed || !source.trim()) return
    const existing = get().customSamples.find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
    const sample: SchemaExample = {
      id: existing?.id ?? `custom-${Date.now()}`,
      name: trimmed,
      blurb: 'Saved on this browser.',
      source,
      custom: true,
    }
    const customSamples = [sample, ...get().customSamples.filter((item) => item.id !== sample.id)]
    writeSamples(customSamples)
    window.clearTimeout(parseTimer)
    set({ customSamples, source, overrides: {}, sampleOpen: false })
    applyParse(source)
  },

  removeSample: (id) => {
    const customSamples = get().customSamples.filter((item) => item.id !== id)
    writeSamples(customSamples)
    set({ customSamples })
  },

  setSampleOpen: (open) => set({ sampleOpen: open }),

  setOverride: (table, column, kind) => {
    const key = columnKey(table, column)
    set({
      overrides: { ...get().overrides, [key]: kind },
      dirty: get().generated.length > 0,
      editVersion: get().editVersion + 1,
    })
  },

  clearOverrides: () => {
    set({
      overrides: {},
      dirty: get().generated.length > 0,
      editVersion: get().editVersion + 1,
    })
  },

  setRowCount: (value) => {
    const cap = rowCap(get().tier)
    const next = Math.min(cap, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)))
    set({
      rowCount: next,
      notice: get().tier === 'free' && value > cap ? `Free tier stops at ${cap} rows.` : null,
      dirty: get().generated.length > 0,
      editVersion: get().editVersion + 1,
    })
  },

  toggleChaos: () => {
    if (get().tier === 'free') {
      set({ proOpen: true })
      return
    }
    set({
      chaos: !get().chaos,
      dirty: get().generated.length > 0,
      editVersion: get().editVersion + 1,
    })
  },

  setLocale: (locale) => {
    if (!isDataLocale(locale) || locale === get().locale) return
    if (isProLocale(locale) && get().tier !== 'pro') {
      set({ proOpen: true, notice: null })
      return
    }
    set({
      locale,
      dirty: get().generated.length > 0,
      editVersion: get().editVersion + 1,
    })
  },

  setDialect: (dialect) => {
    if (!isSqlDialect(dialect)) return
    if (isProDialect(dialect) && get().tier !== 'pro') {
      set({ proOpen: true, notice: null })
      return
    }
    set({ dialect })
  },

  setFormat: (format) => set({ format }),

  redeemKey: async (key) => {
    set({ licenseBusy: true, licenseError: null })
    const result = await redeemLicense(key)
    if (!result.ok) {
      set({ licenseBusy: false, licenseError: result.error })
      return
    }
    writeLicense(result.record)
    set({
      licenseBusy: false,
      licenseError: null,
      tier: 'pro',
      plan: result.record.plan,
      expiresAt: result.record.expiresAt,
      licenseEmail: result.record.email,
      proOpen: false,
      notice: result.record.plan === 'day' ? 'Pro is on for 24 hours.' : 'Pro is on for one month.',
    })
  },

  refreshLicense: async () => {
    const saved = readLicense()
    if (!saved) {
      if (get().tier === 'pro') get().clearLicense()
      return
    }
    const result = await recheckLicense(saved)
    if (result.ok) {
      const record = { ...result.record, instanceId: result.record.instanceId ?? saved.instanceId }
      writeLicense(record)
      set({ tier: 'pro', plan: record.plan, expiresAt: record.expiresAt, licenseEmail: record.email })
      return
    }
    if (result.invalid) get().clearLicense()
  },

  clearLicense: () => {
    writeLicense(null)
    const state = get()
    const locale = isProLocale(state.locale) ? 'en' : state.locale
    const dialect = isProDialect(state.dialect) ? 'postgres' : state.dialect
    set({
      tier: 'free',
      plan: 'free',
      expiresAt: null,
      licenseEmail: null,
      licenseError: null,
      locale,
      dialect,
      chaos: false,
      rowCount: Math.min(state.rowCount, rowCap('free')),
      dirty: state.generated.length > 0 && locale !== state.locale,
      editVersion: locale !== state.locale ? state.editVersion + 1 : state.editVersion,
      notice: null,
    })
  },

  noteCheckout: (data) => {
    const key = findLicenseKey(data)
    set({ proOpen: true, notice: null })
    if (key) {
      void get().redeemKey(key)
      return
    }
    set({ licenseError: null, notice: 'Payment completed. Paste the license key from the receipt.' })
  },

  setActiveTable: (name) => set({ activeTable: name }),
  setDocsOpen: (open) => set({ docsOpen: open }),
  setProOpen: (open) => set({ proOpen: open }),

  generate: async () => {
    const state = get()
    if (state.generating) return
    if (!state.tables.length) {
      set({ genError: state.parseError ?? 'Add a CREATE TABLE statement or a CSV header first.' })
      return
    }
    const version = state.editVersion
    const planned = tablesForRequest(state.tables, state.tier, state.overrides)
    const rowCount = Math.min(state.rowCount, rowCap(state.tier))
    set({ generating: true, genError: null, notice: null })
    try {
      const result = await runGenerate({
        tables: planned.tables,
        overrides: planned.overrides,
        rowCount,
        chaos: state.tier === 'pro' && state.chaos,
        locale: state.locale,
        seed: Math.floor(Math.random() * 1_000_000_000),
      })
      const latest = get()
      const active = result.tables.some((table) => table.name === latest.activeTable)
        ? latest.activeTable
        : result.tables[0]?.name ?? latest.activeTable
      set({
        generating: false,
        generated: result.tables,
        genWarnings: result.warnings,
        seed: result.seed,
        elapsedMs: result.elapsedMs,
        activeTable: active,
        dirty: latest.editVersion !== version,
      })
    } catch (error) {
      set({
        generating: false,
        genError: error instanceof Error ? error.message : 'Could not generate rows.',
      })
    }
  },
}))
