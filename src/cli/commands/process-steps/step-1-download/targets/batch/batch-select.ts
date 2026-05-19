import type { BatchItem, BatchOptions } from '~/types'

export const selectBatchItems = (items: BatchItem[], opts: BatchOptions): BatchItem[] => {
  const withDate: { item: BatchItem; ts: number }[] = []
  const withoutDate: BatchItem[] = []

  for (const item of items) {
    const ts = item.publishedAt ? Date.parse(item.publishedAt) : NaN
    if (Number.isFinite(ts)) {
      withDate.push({ item, ts })
    } else {
      withoutDate.push(item)
    }
  }

  withDate.sort((a, b) => a.ts - b.ts)

  const dated = opts.order === 'oldest'
    ? withDate.map(x => x.item)
    : withDate.map(x => x.item).reverse()

  const ordered = [...dated, ...withoutDate]

  if (opts.all) return ordered
  return ordered.slice(0, Math.max(1, opts.limit))
}
