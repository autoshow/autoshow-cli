import type { WerScore } from './benchmark-types'

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

export const computeWER = (reference: string, hypothesis: string): WerScore => {
  const refWords = normalizeText(reference).split(' ').filter(Boolean)
  const hypWords = normalizeText(hypothesis).split(' ').filter(Boolean)

  const n = refWords.length
  const m = hypWords.length

  if (n === 0) {
    return { wer: m > 0 ? 1 : 0, substitutions: 0, deletions: 0, insertions: m, referenceWordCount: 0 }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  const ops: Array<Array<'none' | 'sub' | 'del' | 'ins' | 'match'>> =
    Array.from({ length: n + 1 }, () => new Array<'none' | 'sub' | 'del' | 'ins' | 'match'>(m + 1).fill('none'))

  for (let i = 0; i <= n; i++) {
    dp[i]![0] = i
    if (i > 0) ops[i]![0] = 'del'
  }
  for (let j = 0; j <= m; j++) {
    dp[0]![j] = j
    if (j > 0) ops[0]![j] = 'ins'
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!
        ops[i]![j] = 'match'
      } else {
        const sub = dp[i - 1]![j - 1]!
        const del = dp[i - 1]![j]!
        const ins = dp[i]![j - 1]!
        const min = Math.min(sub, del, ins)

        dp[i]![j] = min + 1
        if (min === sub) ops[i]![j] = 'sub'
        else if (min === del) ops[i]![j] = 'del'
        else ops[i]![j] = 'ins'
      }
    }
  }

  let substitutions = 0
  let deletions = 0
  let insertions = 0
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const op = ops[i]![j]!
    if (op === 'match') { i--; j-- }
    else if (op === 'sub') { substitutions++; i--; j-- }
    else if (op === 'del') { deletions++; i-- }
    else { insertions++; j-- }
  }

  return {
    wer: (substitutions + deletions + insertions) / n,
    substitutions,
    deletions,
    insertions,
    referenceWordCount: n
  }
}
