const SEPARATOR_WIDTH = 60

export const separator = '\u2500'.repeat(SEPARATOR_WIDTH)

export const formatCost = (amount: number): string => {
  return `${amount.toFixed(5)}\u00A2`
}

export const formatRate = (inputCost: number, outputCost: number): string => {
  return `${inputCost.toFixed(2)}\u00A2/1M input, ${outputCost.toFixed(2)}\u00A2/1M output`
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
