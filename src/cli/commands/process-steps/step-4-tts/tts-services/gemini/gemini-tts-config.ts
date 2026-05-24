import { CLIUsageError } from '~/utils/error-handler'
import type { GeminiMultiSpeakerConfig, GeminiTtsSelectionOptions, SpeakerVoiceRegistry } from '~/types'

const hasNonEmptyString = (value: string | undefined): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

const normalizeRequiredField = (value: string | undefined, flagName: string): string => {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw CLIUsageError(`Gemini multispeaker TTS requires --${flagName}.`)
  }
  return trimmed
}

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const formatGeminiSpeakerSummary = (config: GeminiMultiSpeakerConfig): string => {
  return `${config.speaker1Name}=${config.speaker1Voice}, ${config.speaker2Name}=${config.speaker2Voice}`
}

export const resolveGeminiMultiSpeakerConfig = (
  options: GeminiTtsSelectionOptions
): GeminiMultiSpeakerConfig | undefined => {
  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  if (geminiModels.length === 0) {
    return undefined
  }

  const rawValues = [
    options.geminiSpeaker1Name,
    options.geminiSpeaker1Voice,
    options.geminiSpeaker2Name,
    options.geminiSpeaker2Voice
  ]
  const hasAnyMultiSpeakerField = rawValues.some(hasNonEmptyString)
  if (!hasAnyMultiSpeakerField) {
    return undefined
  }

  if (hasNonEmptyString(options.geminiVoiceId)) {
    throw CLIUsageError('Gemini multispeaker TTS cannot be combined with --gemini-voice.')
  }

  const config: GeminiMultiSpeakerConfig = {
    speaker1Name: normalizeRequiredField(options.geminiSpeaker1Name, 'gemini-speaker-1-name'),
    speaker1Voice: normalizeRequiredField(options.geminiSpeaker1Voice, 'gemini-speaker-1-voice'),
    speaker2Name: normalizeRequiredField(options.geminiSpeaker2Name, 'gemini-speaker-2-name'),
    speaker2Voice: normalizeRequiredField(options.geminiSpeaker2Voice, 'gemini-speaker-2-voice')
  }

  if (config.speaker1Name.toLowerCase() === config.speaker2Name.toLowerCase()) {
    throw CLIUsageError('Gemini multispeaker TTS requires two distinct speaker names.')
  }

  return config
}

export const validateGeminiMultiSpeakerTranscript = (
  text: string,
  config: GeminiMultiSpeakerConfig
): void => {
  const speakers = [config.speaker1Name, config.speaker2Name]
  for (const speaker of speakers) {
    const pattern = new RegExp(`(^|\\n)\\s*${escapeRegExp(speaker)}\\s*:`, 'm')
    if (!pattern.test(text)) {
      throw CLIUsageError(`Gemini multispeaker TTS requires the input text to include "${speaker}:" labels.`)
    }
  }
}

export const buildGeminiSpeakerVoiceConfigs = (
  registry: SpeakerVoiceRegistry
): Array<{ speaker: string, voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } }> =>
  registry.entries.map((entry) => ({
    speaker: entry.speaker,
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: entry.voice
      }
    }
  }))

export const validateGeminiMultiSpeakerTranscriptFromRegistry = (
  text: string,
  registry: SpeakerVoiceRegistry
): void => {
  for (const entry of registry.entries) {
    const pattern = new RegExp(`(^|\\n)\\s*${escapeRegExp(entry.speaker)}\\s*:`, 'm')
    if (!pattern.test(text)) {
      throw CLIUsageError(`Gemini multispeaker TTS requires the input text to include "${entry.speaker}:" labels.`)
    }
  }
}

export const formatSpeakerRegistrySummary = (registry: SpeakerVoiceRegistry): string =>
  registry.entries.map((e) => `${e.speaker}=${e.voice}`).join(', ')
