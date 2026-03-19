export type SampleSupportLevel = 'current' | 'planned'

export type SampleFixtureEntry = {
  path: string
  format: string
  supportLevel: SampleSupportLevel
  validity: 'valid' | 'invalid'
  requiredTools: string[]
  verified: boolean
  invalidReason?: string
}

export type SampleSkippedEntry = {
  path: string
  reason: string
  requiredTools: string[]
}

export type SampleManifestSummary = {
  total: number
  generated: number
  skipped: number
  verified: number
}

export type SampleManifest = {
  schemaVersion: number
  generatedAt: string
  mode: 'full' | 'partial'
  fixtures: SampleFixtureEntry[]
  skipped: SampleSkippedEntry[]
  summary: SampleManifestSummary
}
