export interface LicenseRecord {
  key: string
  instanceId: string | null
  plan: 'day' | 'year'
  expiresAt: number | null
  email: string | null
}

export type LicenseResult = { ok: true; record: LicenseRecord } | { ok: false; invalid: boolean; error: string }

const DAY_MS = 24 * 60 * 60 * 1000
const YEAR_MS = 365 * DAY_MS

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function friendlyError(error: string) {
  if (/not found/i.test(error)) return 'That license key was not found.'
  if (/activation limit/i.test(error)) return 'That license key is already in use on too many browsers.'
  return error
}

function parseTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  return Number.isFinite(parsed) ? parsed : null
}

export function entitlementFromPayload(payload: unknown, now: number, fallbackKey = ''): LicenseResult {
  const body = asRecord(payload)
  if (!body) return { ok: false, invalid: true, error: 'The license service returned an unexpected response.' }
  const error = typeof body.error === 'string' && body.error.trim() ? body.error : null
  if (body.activated === false || body.valid === false) {
    return { ok: false, invalid: true, error: friendlyError(error ?? 'That license key is not valid.') }
  }

  const license = asRecord(body.license_key)
  if (!license) return { ok: false, invalid: true, error: friendlyError(error ?? 'That license key was not found.') }
  const status = typeof license.status === 'string' ? license.status : ''
  if (status === 'disabled' || status === 'expired') {
    return { ok: false, invalid: true, error: 'That license key is expired or turned off.' }
  }

  const expiresAt = parseTime(license.expires_at)
  if (expiresAt !== null && expiresAt <= now) return { ok: false, invalid: true, error: 'That license has ended.' }

  const meta = asRecord(body.meta)
  const variant = typeof meta?.variant_name === 'string' ? meta.variant_name : ''
  const dayNamed = /day|24/i.test(variant)
  const instance = asRecord(body.instance)
  const key = typeof license.key === 'string' && license.key ? license.key : fallbackKey
  if (!key) return { ok: false, invalid: true, error: 'That license key was not found.' }
  const email = typeof meta?.customer_email === 'string' ? meta.customer_email : null
  const instanceId = typeof instance?.id === 'string' ? instance.id : null
  const dayPass = dayNamed || (expiresAt !== null && expiresAt - now <= 2 * DAY_MS)

  if (dayPass) {
    return { ok: true, record: { key, instanceId, plan: 'day', expiresAt: expiresAt ?? now + DAY_MS, email } }
  }

  return { ok: true, record: { key, instanceId, plan: 'year', expiresAt: expiresAt ?? now + YEAR_MS, email } }
}

export function findLicenseKey(value: unknown, depth = 0): string | null {
  if (depth > 6) return null
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(value)) return value
  const record = asRecord(value)
  if (!record) return null
  for (const nested of Object.values(record)) {
    const found = findLicenseKey(nested, depth + 1)
    if (found) return found
  }
  return null
}
