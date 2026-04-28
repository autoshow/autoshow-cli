export const formatCost = (amount: number): string => {
  return `${amount.toFixed(5)}\u00A2`
}

export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`
  }

  const seconds = ms / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = (seconds % 60).toFixed(0)
  return `${minutes}m ${remainder}s`
}
