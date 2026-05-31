import type { TranscribeEngine } from '~/types'

export type AudioVariant = {
  path: string
  kind: 'compression' | 'speed'
  label: string
  bitrateKbps?: number | undefined
  speedMultiplier?: number | undefined
}

export type SttServiceSpec = {
  service: TranscribeEngine
  model: string
  envVar: string | undefined
}

export type VariantTranscription = {
  variant: AudioVariant
  service: string
  model: string
  text: string
  processingTimeMs: number
  error?: string | undefined
}

export type BenchmarkAttemptStatus = 'started' | 'success' | 'error'

export type BenchmarkAttemptRecord = {
  kind: 'benchmark-attempt'
  schemaVersion: 1
  status: BenchmarkAttemptStatus
  variant: {
    kind: 'compression' | 'speed'
    label: string
    bitrateKbps?: number | undefined
    speedMultiplier?: number | undefined
  }
  service: string
  model: string
  processingTimeMs?: number | undefined
  error?: string | undefined
}

export type WerScore = {
  wer: number
  substitutions: number
  deletions: number
  insertions: number
  referenceWordCount: number
}

export type BenchmarkScoreEntry = {
  variant: {
    kind: 'compression' | 'speed'
    label: string
    bitrateKbps?: number | undefined
    speedMultiplier?: number | undefined
  }
  service: string
  model: string
  wer: number
  substitutions: number
  deletions: number
  insertions: number
  referenceWordCount: number
  processingTimeMs: number
  error?: string | undefined
}

export type BenchmarkReport = {
  timestamp: string
  sourceAudio: string
  referenceService: string
  referenceModel: string
  referenceWordCount: number
  variants: BenchmarkAttemptRecord['variant'][]
  services: {
    service: string
    model: string
  }[]
  attempts: {
    total: number
    succeeded: number
    failed: number
  }
  errors: {
    variant: BenchmarkAttemptRecord['variant']
    service: string
    model: string
    processingTimeMs: number
    error: string
  }[]
  compressionResults: BenchmarkScoreEntry[]
  speedResults: BenchmarkScoreEntry[]
  summary: {
    bestCompressionThreshold: {
      service: string
      model: string
      minBitrateKbps: number
      werAtThreshold: number
    } | null
    bestSpeedThreshold: {
      service: string
      model: string
      maxSpeed: number
      werAtThreshold: number
    } | null
    serviceRankings: {
      service: string
      model: string
      averageWer: number
    }[]
  }
}

export type BenchmarkFlags = {
  tts?: boolean | undefined
  image?: boolean | undefined
  video?: boolean | undefined
  bitrates: string
  speeds: string
  'stt-services'?: string | undefined
  'reference-stt': string
  'skip-compression': boolean
  'skip-speed': boolean
  'output-dir'?: string | undefined
  'tts-input-text'?: string | undefined
  'tts-mode'?: string | undefined
  'tts-roundtrip-dir'?: string | undefined
  'tts-metric-fixtures'?: string | undefined
  'tts-audio-judge-model'?: string | undefined
  'tts-content-type'?: string | undefined
  'tts-keep-temp'?: boolean | undefined
  'image-judge-model'?: string | undefined
  'video-judge-model'?: string | undefined
}
