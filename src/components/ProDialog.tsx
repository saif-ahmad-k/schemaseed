import { useState } from 'react'
import { DAY_CHECKOUT, YEAR_CHECKOUT, openCheckout } from '../lib/license'
import { useApp } from '../store'
import { Modal } from './Modal'

const freePoints = [
  'One table and 50 rows',
  'JSON, CSV, and SQL inserts',
  'English, Spanish, French, German, and Portuguese',
  'PostgreSQL, MySQL, SQLite, SQL Server, and the compatible engines',
]
const proPoints = [
  'Up to 10,000 rows',
  'Every table, with foreign keys filled from the parent rows',
  'Chinese, Russian, Japanese, and Arabic',
  'Oracle, ClickHouse, Snowflake, BigQuery, and the other expert databases',
  'Chaos mode: empty cells, odd characters, and boundary numbers',
]

export function ProDialog() {
  const tier = useApp((state) => state.tier)
  const plan = useApp((state) => state.plan)
  const expiresAt = useApp((state) => state.expiresAt)
  const licenseEmail = useApp((state) => state.licenseEmail)
  const licenseBusy = useApp((state) => state.licenseBusy)
  const licenseError = useApp((state) => state.licenseError)
  const notice = useApp((state) => state.notice)
  const setProOpen = useApp((state) => state.setProOpen)
  const redeemKey = useApp((state) => state.redeemKey)
  const clearLicense = useApp((state) => state.clearLicense)
  const noteCheckout = useApp((state) => state.noteCheckout)
  const [key, setKey] = useState('')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  async function buy(url: string) {
    if (!url) {
      setCheckoutError('Add the Lemon Squeezy checkout links in .env.local, then restart the app.')
      return
    }
    setCheckoutError(null)
    await openCheckout(url, noteCheckout)
  }

  const ends = expiresAt ? new Date(expiresAt).toLocaleString() : null

  return (
    <Modal title="SchemaSeed Pro" onClose={() => setProOpen(false)}>
      <p className="text-sm text-mist">
        Pro is <span className="font-semibold text-foam">$2 for 24 hours</span> or{' '}
        <span className="font-semibold text-foam">$9 for one year</span>. It unlocks the larger row count, every table and its foreign keys, the extra languages, the expert databases, and chaos mode. After payment, paste the license key from the receipt.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel-2 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-mist">Free</div>
          <ul className="mt-2 space-y-1 text-sm text-foam">
            {freePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-amber/40 bg-amber/10 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber">Pro</div>
          <ul className="mt-2 space-y-1 text-sm text-foam">
            {proPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
      {tier === 'pro' ? (
        <div className="mt-4 rounded-md border border-line px-3 py-2 text-sm text-foam">
          {plan === 'day' ? `24-hour pass is on${ends ? ` until ${ends}` : ''}.` : `One-year pass is on${ends ? ` until ${ends}` : ''}.`}
          {licenseEmail ? ` ${licenseEmail}` : ''}
          <button type="button" onClick={clearLicense} className="mt-2 block text-xs text-mist hover:text-foam">
            Remove this license from the browser
          </button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => void buy(DAY_CHECKOUT)} className="flex-1 rounded-md border border-line px-3 py-2 text-sm text-foam hover:bg-white/5">
            24 hours · $2
          </button>
          <button type="button" onClick={() => void buy(YEAR_CHECKOUT)} className="flex-1 rounded-md bg-amber px-3 py-2 text-sm font-semibold text-[#24180b] hover:bg-[#efb25c]">
            1 year · $9
          </button>
        </div>
      )}
      {(checkoutError || notice) && <p className="mt-3 text-xs text-amber">{checkoutError ?? notice}</p>}
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault()
          void redeemKey(key)
        }}
      >
        <label className="block text-xs text-mist">
          License key
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Paste the key from your receipt"
            spellCheck={false}
            className="mt-1 h-8 w-full rounded-md border border-line bg-ink px-2 font-mono text-sm text-foam"
          />
        </label>
        <button
          type="submit"
          disabled={licenseBusy || key.trim().length < 8}
          className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm text-foam hover:bg-white/5 disabled:opacity-40"
        >
          {licenseBusy ? 'Checking…' : 'Turn Pro on'}
        </button>
        {licenseError && <p className="mt-2 text-xs text-danger">{licenseError}</p>}
      </form>
    </Modal>
  )
}
