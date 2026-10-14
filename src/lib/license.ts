import { entitlementFromPayload, type LicenseRecord, type LicenseResult } from './entitlement'

export const DAY_CHECKOUT = import.meta.env.VITE_LEMON_DAY_URL?.trim() ?? ''
export const MONTH_CHECKOUT = import.meta.env.VITE_LEMON_MONTH_URL?.trim() ?? ''

interface LemonEvent {
  event: string
  data?: unknown
}

interface LemonApi {
  Setup: (options: { eventHandler: (event: LemonEvent) => void }) => void
  Url?: { Open?: (url: string) => void }
}

declare global {
  interface Window {
    createLemonSqueezy?: () => void
    LemonSqueezy?: LemonApi
  }
}

async function postLicense(action: 'validate' | 'activate', fields: Record<string, string>) {
  const response = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  })
  const body: unknown = await response.json().catch(() => null)
  return body
}

export async function redeemLicense(key: string): Promise<LicenseResult> {
  const trimmed = key.trim()
  if (trimmed.length < 8) return { ok: false, invalid: true, error: 'Paste the license key from your receipt.' }
  try {
    const validated = entitlementFromPayload(await postLicense('validate', { license_key: trimmed }), Date.now(), trimmed)
    if (!validated.ok) {
      return entitlementFromPayload(
        await postLicense('activate', { license_key: trimmed, instance_name: 'SchemaSeed' }),
        Date.now(),
        trimmed,
      )
    }
    if (validated.record.instanceId) return validated
    const activated = entitlementFromPayload(
      await postLicense('activate', { license_key: trimmed, instance_name: 'SchemaSeed' }),
      Date.now(),
      trimmed,
    )
    return activated.ok ? activated : validated
  } catch {
    return { ok: false, invalid: false, error: 'Could not reach the license service. Check your connection and try again.' }
  }
}

export async function recheckLicense(record: LicenseRecord): Promise<LicenseResult> {
  try {
    const fields: Record<string, string> = { license_key: record.key }
    if (record.instanceId) fields.instance_id = record.instanceId
    return entitlementFromPayload(await postLicense('validate', fields), Date.now(), record.key)
  } catch {
    return { ok: false, invalid: false, error: 'Could not reach the license service. Check your connection and try again.' }
  }
}

let lemonReady: Promise<void> | null = null

function loadLemon() {
  if (window.LemonSqueezy) return Promise.resolve()
  lemonReady ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://app.lemonsqueezy.com/js/lemon.js'
    script.async = true
    script.onload = () => {
      window.createLemonSqueezy?.()
      resolve()
    }
    script.onerror = () => reject(new Error('Lemon Squeezy did not load.'))
    document.head.appendChild(script)
  })
  return lemonReady
}

export async function openCheckout(url: string, onSuccess: (data: unknown) => void) {
  const destination = new URL(url)
  destination.searchParams.set('embed', '1')
  const back = new URL(window.location.href)
  back.searchParams.set('checkout', 'done')
  destination.searchParams.set('checkout[success_url]', back.toString())
  try {
    await loadLemon()
    window.LemonSqueezy?.Setup({
      eventHandler: (event) => {
        if (event.event === 'Checkout.Success') onSuccess(event.data)
      },
    })
    if (window.LemonSqueezy?.Url?.Open) {
      window.LemonSqueezy.Url.Open(destination.toString())
      return
    }
  } catch {
    // The hosted checkout still works in a new tab when the overlay script is blocked.
  }
  window.open(destination.toString(), '_blank', 'noopener')
}
