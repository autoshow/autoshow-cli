export const processWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<void>
): Promise<void> => {
  if (concurrency <= 1) {
    for (const item of items) {
      await processor(item)
    }
    return
  }

  const queue = [...items]
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift()!
        await processor(item)
      }
    }
  )
  await Promise.all(workers)
}
