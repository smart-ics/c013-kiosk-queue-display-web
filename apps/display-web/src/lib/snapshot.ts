import type { CurrentLoketDisplayItem } from '@aq/shared-types'

export function filterSnapshotByLoketIds(
  items: CurrentLoketDisplayItem[],
  loketIds: string[],
): CurrentLoketDisplayItem[] {
  const allowed = new Set(loketIds)
  return items.filter((item) => allowed.has(item.loketKey))
}

export function shouldRefreshForHint(
  hintLoketKey: string | null,
  configuredLoketIds: string[],
): boolean {
  if (hintLoketKey === null || hintLoketKey === '') return true
  return configuredLoketIds.includes(hintLoketKey)
}
