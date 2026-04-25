import type { RuntimeOptions } from '~/types'

export type ResumeItemSummary = {
  item: string
  status: string
  outputDir: string
  providers: string | string[]
  detail?: string
}

export type ResumeTotals = {
  full: number
  incomplete: number
  failed: number
}

export type ResumeTargetKind = 'stt' | 'ocr' | 'extract' | 'tts' | 'image' | 'video' | 'music'
export type ResumeTargetScope = 'single' | 'batch'

export type ResumeTarget = {
  kind: ResumeTargetKind
  scope: ResumeTargetScope
  dir: string
  manifestPath: string
}

export type ResumeHandler = {
  kind: ResumeTargetKind
  hasResumableWork: (
    target: ResumeTarget,
    opts: RuntimeOptions,
    explicitFlags: Set<string>
  ) => Promise<boolean>
  resume: (
    target: ResumeTarget,
    opts: RuntimeOptions,
    explicitFlags: Set<string>
  ) => Promise<void>
}
