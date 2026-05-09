import { basename } from 'node:path'
import type {
  PreparedSttMedia,
  PromptSelectionCandidate,
  RuntimeOptions,
  Step2Metadata,
  SttProviderSuccess,
  TranscriptionResult
} from '~/types'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { buildPrompt } from '../../step-3-write/write-utils/prompt-utils'

export const buildProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): string => {
  const provider = metadata.transcriptionService === 'whisper' ? 'whisper.cpp' : metadata.transcriptionService
  const model = metadata.transcriptionService === 'whisper'
    ? basename(metadata.transcriptionModel.split(' | ')[0] ?? metadata.transcriptionModel)
      .replace(/^ggml-/, '')
      .replace(/\.bin$/, '')
    : metadata.transcriptionModel

  return `${provider}/${model}`
}

export const buildTimingProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): string => {
  if (metadata.transcriptionService !== 'whisper') {
    return buildProviderModelLabel(metadata)
  }

  const whisperModelPath = metadata.transcriptionModel.split(' | ')[0] ?? metadata.transcriptionModel
  return `whisper/${basename(whisperModelPath)}`
}

export const buildPromptFile = async (
  outputDir: string,
  metadata: PreparedSttMedia['metadata'],
  transcription: TranscriptionResult,
  slug: string,
  options: Pick<RuntimeOptions, 'prompts' | 'promptMd'> & {
    promptSourceProvider?: string | undefined
    requestedSpeakerCount?: number | undefined
    suppressDiarizationLog?: boolean | undefined
  }
): Promise<void> => {
  const instruction = await resolvePromptNames(options.prompts ?? [], {
    exampleFormat: 'json'
  })
  const promptContent = buildPrompt(metadata, transcription, instruction, slug, {
    promptSourceProvider: options.promptSourceProvider,
    requestedSpeakerCount: options.requestedSpeakerCount,
    suppressDiarizationLog: options.suppressDiarizationLog
  })
  await Bun.write(`${outputDir}/prompt.md`, promptContent)

  if (options.promptMd) {
    const mdInstruction = await resolvePromptNames(options.prompts ?? [], {
      exampleFormat: 'markdown'
    })
    const mdPromptContent = buildPrompt(metadata, transcription, mdInstruction, slug, {
      promptSourceProvider: options.promptSourceProvider,
      requestedSpeakerCount: options.requestedSpeakerCount,
      suppressDiarizationLog: true
    })
    await Bun.write(`${outputDir}/prompt-md.md`, mdPromptContent)
  }
}

export const scorePromptSelectionCandidate = (
  candidate: PromptSelectionCandidate
): number => {
  const hasSpeakerLabels = candidate.result.segments.some((segment) =>
    typeof segment.speaker === 'string' && segment.speaker.length > 0
  )
  const hasRequestedDiarizationHint = candidate.target.diarizationOptions?.speakerCount !== undefined
  const hasDiarizationEnabled = candidate.target.diarizationOptions?.enabled === true
    || hasRequestedDiarizationHint

  return (hasSpeakerLabels ? 2 : 0) + (hasRequestedDiarizationHint ? 2 : 0) + (hasDiarizationEnabled ? 1 : 0)
}

export const selectPrimaryPromptProvider = (
  successes: Array<SttProviderSuccess | undefined>
): SttProviderSuccess | undefined => {
  const candidates = successes
    .map((entry, index) => ({ entry, index }))
    .filter((entry): entry is { entry: PromptSelectionCandidate, index: number } => entry.entry !== undefined)

  if (candidates.length === 0) {
    return undefined
  }

  return candidates
    .sort((left, right) => {
      const scoreDiff = scorePromptSelectionCandidate(right.entry) - scorePromptSelectionCandidate(left.entry)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      return left.index - right.index
    })[0]?.entry
}
