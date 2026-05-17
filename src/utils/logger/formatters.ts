export const formatCost = (amount: number): string => {
  return `${amount.toFixed(3)}\u00A2`
}

export const formatEstimatedCost = (amount: number): string => {
  if (amount === 0) {
    return 'free'
  }

  if (amount > 0 && amount < 0.01) {
    return '<0.01\u00A2'
  }

  if (amount < 100) {
    return `${amount.toFixed(2)}\u00A2`
  }

  return `$${(amount / 100).toFixed(2)}`
}

export const formatEstimatedCostWithExactCents = (amount: number): string =>
  `${formatEstimatedCost(amount)} (${formatCost(amount)})`

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
