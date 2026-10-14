export const FREE_ROW_CAP = 50
export const PRO_ROW_CAP = 10_000
export const FREE_TABLE_CAP = 1

export function rowCap(tier: 'pro' | 'free') {
  return tier === 'pro' ? PRO_ROW_CAP : FREE_ROW_CAP
}
