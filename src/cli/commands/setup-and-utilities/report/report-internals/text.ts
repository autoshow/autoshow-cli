const WORD_PATTERN = /[A-Za-z0-9]+(?:[/'’-][A-Za-z0-9]+)*/g

export const normalizeText = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')

export const tokenizeWords = (text: string): string[] =>
  [...normalizeText(text).matchAll(WORD_PATTERN)].map((match) => match[0].toLowerCase())

export const tokenizeSurfaceWords = (text: string): string[] =>
  [...normalizeText(text).matchAll(WORD_PATTERN)].map((match) => match[0])

export const buildNgramCounts = (words: string[], size: number): Map<string, number> => {
  const counts = new Map<string, number>()
  if (words.length === 0) {
    return counts
  }

  if (words.length < size) {
    counts.set(words.join(' '), 1)
    return counts
  }

  for (let index = 0; index <= words.length - size; index += 1) {
    const gram = words.slice(index, index + size).join(' ')
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }

  return counts
}

export const computeDiceCoefficient = (left: Map<string, number>, right: Map<string, number>): number => {
  if (left.size === 0 && right.size === 0) {
    return 1
  }
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let overlap = 0
  let leftTotal = 0
  let rightTotal = 0

  for (const value of left.values()) {
    leftTotal += value
  }
  for (const value of right.values()) {
    rightTotal += value
  }

  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left]
  for (const [key, value] of smaller) {
    overlap += Math.min(value, larger.get(key) ?? 0)
  }

  return (2 * overlap) / (leftTotal + rightTotal)
}

export const computeWordSimilarity = (leftWords: string[], rightWords: string[]): number => {
  if (leftWords.length === 0 && rightWords.length === 0) {
    return 1
  }
  if (leftWords.length === 0 || rightWords.length === 0) {
    return 0
  }

  const gramSize = Math.min(leftWords.length, rightWords.length) >= 2 ? 2 : 1
  const gramScore = computeDiceCoefficient(
    buildNgramCounts(leftWords, gramSize),
    buildNgramCounts(rightWords, gramSize)
  )
  const lengthPenalty = 1 - Math.min(1, Math.abs(leftWords.length - rightWords.length) / Math.max(leftWords.length, rightWords.length))
  return (gramScore * 0.8) + (lengthPenalty * 0.2)
}
