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

const STT_PROVIDER_SELECTION_FLAGS = [
  'whisper',
  'reverb',
  'gcloud-stt',
  'aws-stt',
  'elevenlabs-stt',
  'deepgram-stt',
  'soniox-stt',
  'speechmatics-stt',
  'rev-stt',
  'groq-stt',
  'mistral-stt',
  'assemblyai-stt',
  'gladia-stt'
] as const

const OCR_PROVIDER_SELECTION_FLAGS = [
  'ocrmypdf',
  'paddle-ocr',
  'mistral-ocr',
  'glm-ocr',
  'openai-ocr',
  'anthropic-ocr',
  'gemini-ocr'
] as const

const hasAnyExplicitFlag = (
  explicitFlags: Set<string>,
  flags: readonly string[]
): boolean => flags.some((flag) => explicitFlags.has(flag))

const getSelectedSttTargets = (
  opts: RuntimeOptions,
  explicitFlags: Set<string>
): SttTarget[] | undefined =>
  hasAnyExplicitFlag(explicitFlags, STT_PROVIDER_SELECTION_FLAGS)
    ? collectSttTargets(opts)
    : undefined

const getSelectedOcrTargets = (
  opts: RuntimeOptions,
  explicitFlags: Set<string>
): OcrTarget[] | undefined =>
  hasAnyExplicitFlag(explicitFlags, OCR_PROVIDER_SELECTION_FLAGS)
    ? collectExplicitOcrTargets(opts)
    : undefined

const sttResumeHandler: ResumeHandler = {
  kind: 'stt',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableSttTargetWork(
      target,
      getSelectedSttTargets(opts, explicitFlags),
      {
        youtubeCaptions: opts.youtubeCaptions,
        currentTargets: collectSttTargets(opts)
      }
    ),
  resume: async (target, opts, explicitFlags) =>
    await resumeSttTarget(
      target,
      opts,
      getSelectedSttTargets(opts, explicitFlags)
    )
}

const ocrResumeHandler: ResumeHandler = {
  kind: 'ocr',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableOcrTargetWork(
      target,
      getSelectedOcrTargets(opts, explicitFlags)
    ),
  resume: async (target, opts, explicitFlags) =>
    await resumeOcrTarget(
      target,
      opts,
      getSelectedOcrTargets(opts, explicitFlags)
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
