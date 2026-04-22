import type { ProcessCommand, RuntimeOptions } from '~/types'
import { canonicalizeProcessCommand } from '../process-command-kinds'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-ocr/ocr-targets'
import { resolveResumeOcrBatchDir, resumeOcrMissingFromBatchDir } from '~/cli/commands/process-steps/step-2-ocr/resume'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { resolveResumeSttBatchDir, resumeSttMissingFromBatchDir } from '~/cli/commands/process-steps/step-2-stt/resume'

export type ResumeAdapter = {
  command: 'stt' | 'ocr'
  resolveBatchDir: (
    batchDirInput: string | undefined,
    opts: RuntimeOptions,
    explicitFlags: Set<string>
  ) => Promise<string>
  resume: (
    batchDir: string,
    opts: RuntimeOptions,
    explicitFlags: Set<string>
  ) => Promise<void>
}

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

const sttResumeAdapter: ResumeAdapter = {
  command: 'stt',
  resolveBatchDir: async (batchDirInput, opts, explicitFlags) => {
    const selectedTargets = STT_PROVIDER_SELECTION_FLAGS.some((flag) => explicitFlags.has(flag))
      ? collectSttTargets(opts)
      : undefined
    return await resolveResumeSttBatchDir(batchDirInput, selectedTargets, {
      youtubeCaptions: opts.youtubeCaptions,
      currentTargets: collectSttTargets(opts)
    })
  },
  resume: async (batchDir, opts, explicitFlags) => {
    const selectedTargets = STT_PROVIDER_SELECTION_FLAGS.some((flag) => explicitFlags.has(flag))
      ? collectSttTargets(opts)
      : undefined
    await resumeSttMissingFromBatchDir(batchDir, opts, selectedTargets)
  }
}

const ocrResumeAdapter: ResumeAdapter = {
  command: 'ocr',
  resolveBatchDir: async (batchDirInput, opts, explicitFlags) => {
    const selectedTargets = OCR_PROVIDER_SELECTION_FLAGS.some((flag) => explicitFlags.has(flag))
      ? collectExplicitOcrTargets(opts)
      : undefined
    return await resolveResumeOcrBatchDir(batchDirInput, selectedTargets)
  },
  resume: async (batchDir, opts, explicitFlags) => {
    const selectedTargets = OCR_PROVIDER_SELECTION_FLAGS.some((flag) => explicitFlags.has(flag))
      ? collectExplicitOcrTargets(opts)
      : undefined
    await resumeOcrMissingFromBatchDir(batchDir, opts, selectedTargets)
  }
}

export const getResumeAdapter = (
  command: ProcessCommand
): ResumeAdapter | undefined => {
  const canonical = canonicalizeProcessCommand(command)
  if (canonical === 'stt') {
    return sttResumeAdapter
  }
  if (canonical === 'ocr') {
    return ocrResumeAdapter
  }
  return undefined
}
