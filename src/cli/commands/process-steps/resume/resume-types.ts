import type { RuntimeOptions } from '~/types'

export type ResumeTargetKind = 'stt' | 'ocr' | 'extract'
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
