import type { RuntimeOptions, OcrTarget, SttTarget } from '~/types'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import {
  hasResumableOcrTargetWork,
  resumeOcrTarget
} from '~/cli/commands/process-steps/step-2-ocr/resume'
import {
  hasResumableSttTargetWork,
  resumeSttTarget
} from '~/cli/commands/process-steps/step-2-stt/resume'
import type { ResumeHandler, ResumeTarget, ResumeTargetKind } from './resume-types'

const EXPLICIT_STEP2_SELECTION_FILTER = {
  includeOrigins: ['explicit', 'all-shortcut']
} as const

const getSelectedSttTargets = (
  opts: RuntimeOptions
): SttTarget[] | undefined => {
  const targets = collectSttTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const getSelectedOcrTargets = (
  opts: RuntimeOptions
): OcrTarget[] | undefined => {
  const targets = collectExplicitOcrTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const sttResumeHandler: ResumeHandler = {
  kind: 'stt',
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableSttTargetWork(
      target,
      getSelectedSttTargets(opts),
      {
        youtubeCaptions: opts.youtubeCaptions,
        currentTargets: collectSttTargets(opts)
      }
    ),
  resume: async (target, opts, _explicitFlags) =>
    await resumeSttTarget(
      target,
      opts,
      getSelectedSttTargets(opts)
    )
}

const ocrResumeHandler: ResumeHandler = {
  kind: 'ocr',
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableOcrTargetWork(
      target,
      getSelectedOcrTargets(opts)
    ),
  resume: async (target, opts, _explicitFlags) =>
    await resumeOcrTarget(
      target,
      opts,
      getSelectedOcrTargets(opts)
    )
}

const RESUME_HANDLERS: Readonly<Record<ResumeTargetKind, ResumeHandler>> = {
  stt: sttResumeHandler,
  ocr: ocrResumeHandler
}

export const getResumeHandler = (
  kind: ResumeTarget['kind']
): ResumeHandler | undefined => RESUME_HANDLERS[kind]

export const getResumeHandlers = (): ResumeHandler[] => Object.values(RESUME_HANDLERS)
