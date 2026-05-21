export type VoiceQualityScoreInput = {
  key: string
  score: number | null
  weight: number
}

export type VoiceQualityAggregate = {
  score: number | null
  availableWeight: number
  totalWeight: number
  missingKeys: string[]
}

export type VoiceQualityRankable = {
  providerKey: string
  humanSpeechScore: number | null
  naturalnessScore: number | null
  speechQualityScore: number | null
  scoreCoverage?: {
    humanSpeech?: { availableWeight: number; totalWeight: number }
  }
}

export type VoiceQualityRanked<T extends VoiceQualityRankable> = T & {
  rank: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const clampPercentScore = (value: number): number => clamp(value, 0, 100)

export const mosToPercentScore = (mos: number | null | undefined): number | null => {
  if (typeof mos !== 'number' || !Number.isFinite(mos)) {
    return null
  }
  return clampPercentScore(((mos - 1) / 4) * 100)
}

export const aggregateWeightedScore = (
  components: VoiceQualityScoreInput[]
): VoiceQualityAggregate => {
  let weightedScore = 0
  let availableWeight = 0
  let totalWeight = 0
  const missingKeys: string[] = []

  for (const component of components) {
    totalWeight += component.weight
    if (typeof component.score === 'number' && Number.isFinite(component.score)) {
      weightedScore += clampPercentScore(component.score) * component.weight
      availableWeight += component.weight
    } else {
      missingKeys.push(component.key)
    }
  }

  return {
    score: availableWeight > 0 ? weightedScore / availableWeight : null,
    availableWeight,
    totalWeight,
    missingKeys
  }
}

const coverageRatio = (provider: VoiceQualityRankable): number => {
  const cov = provider.scoreCoverage?.humanSpeech
  if (!cov || cov.totalWeight === 0) return 0
  return cov.availableWeight / cov.totalWeight
}

export const rankVoiceQualityProviders = <T extends VoiceQualityRankable>(
  providers: T[]
): Array<VoiceQualityRanked<T>> =>
  [...providers]
    .sort((left, right) => {
      const leftHuman = left.humanSpeechScore ?? Number.NEGATIVE_INFINITY
      const rightHuman = right.humanSpeechScore ?? Number.NEGATIVE_INFINITY
      if (leftHuman !== rightHuman) {
        return rightHuman - leftHuman
      }

      const leftNaturalness = left.naturalnessScore ?? Number.NEGATIVE_INFINITY
      const rightNaturalness = right.naturalnessScore ?? Number.NEGATIVE_INFINITY
      if (leftNaturalness !== rightNaturalness) {
        return rightNaturalness - leftNaturalness
      }

      const leftQuality = left.speechQualityScore ?? Number.NEGATIVE_INFINITY
      const rightQuality = right.speechQualityScore ?? Number.NEGATIVE_INFINITY
      if (leftQuality !== rightQuality) {
        return rightQuality - leftQuality
      }

      const leftCoverage = coverageRatio(left)
      const rightCoverage = coverageRatio(right)
      if (leftCoverage !== rightCoverage) {
        return rightCoverage - leftCoverage
      }

      return left.providerKey.localeCompare(right.providerKey)
    })
    .map((provider, index) => ({ ...provider, rank: index + 1 }))
