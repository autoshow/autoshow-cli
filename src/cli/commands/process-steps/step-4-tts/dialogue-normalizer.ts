import { basename } from 'node:path'
import type { TtsOptions, SpeakerVoiceMapping, SpeakerVoiceRegistry } from '~/types'

export type TtsDialogueFormat = 'screenplay' | 'labeled'

export type DialogueTurn = {
  speaker: string
  text: string
}

export type SpeakerRefAudio = SpeakerVoiceMapping
export type SpeakerRefAudioRegistry = SpeakerVoiceRegistry

export type DialogueNormalization = {
  turns: DialogueTurn[]
  normalizedText: string
  spokenCharacterCount: number
}

const ACTION_VERBS = new Set([
  'freezes',
  'sits',
  'stands',
  'leans',
  'rests',
  'rubs',
  'lowers',
  'stares',
  'turns',
  'walks',
  'runs',
  'looks',
  'nods',
  'shakes',
  'pauses',
  'smiles',
  'frowns',
  'laughs',
  'sighs',
  'waves',
  'points',
  'glances',
  'continues'
])

const REF_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.webm', '.mp4'])

const normalizeSpeaker = (speaker: string): string =>
  speaker.trim().replace(/\s+/g, ' ').toUpperCase()

const normalizeDialogueWhitespace = (text: string): string =>
  text.trim().replace(/\s+/g, ' ')

const isSceneOrTransitionLine = (line: string): boolean => {
  return /^(?:SCENE|ACT)\b/i.test(line)
    || /^(?:INT|EXT|EST|INT\/EXT|I\/E)\.?\b/i.test(line)
    || /^(?:CUT TO|FADE IN|FADE OUT|DISSOLVE TO)\b/i.test(line)
}

const sortedSpeakerEntries = (registry: SpeakerVoiceRegistry): SpeakerVoiceMapping[] =>
  [...registry.entries].sort((a, b) => b.normalizedSpeaker.length - a.normalizedSpeaker.length)

export const stripLeadingParentheticals = (text: string): string =>
  text.replace(/^(?:\s*\([^)]*\)\s*)+/, '').trim()

export const detectVoiceKind = (value: string): 'id' | 'ref-audio' => {
  if (value.includes('/') || value.includes('\\')) return 'ref-audio'
  const dotIndex = value.lastIndexOf('.')
  if (dotIndex > 0) {
    const ext = value.slice(dotIndex).toLowerCase()
    if (REF_AUDIO_EXTENSIONS.has(ext)) return 'ref-audio'
  }
  return 'id'
}

export const parseSpeakerVoiceMappings = (
  values: readonly string[] | undefined
): SpeakerVoiceRegistry => {
  const entries: SpeakerVoiceMapping[] = []
  const bySpeaker = new Map<string, SpeakerVoiceMapping>()

  for (const raw of values ?? []) {
    const idx = raw.indexOf('=')
    if (idx <= 0 || idx === raw.length - 1) {
      throw new Error(`Invalid --tts-speaker value "${raw}". Expected SPEAKER=VOICE.`)
    }

    const speaker = raw.slice(0, idx).trim()
    const voice = raw.slice(idx + 1).trim()
    if (!speaker || !voice) {
      throw new Error(`Invalid --tts-speaker value "${raw}". Expected SPEAKER=VOICE.`)
    }

    const normalizedSpeaker = normalizeSpeaker(speaker)
    if (bySpeaker.has(normalizedSpeaker)) {
      throw new Error(`Duplicate --tts-speaker mapping for speaker ${speaker}.`)
    }

    const voiceKind = detectVoiceKind(voice)
    const entry: SpeakerVoiceMapping = { speaker, normalizedSpeaker, voice, voiceKind }
    bySpeaker.set(normalizedSpeaker, entry)
    entries.push(entry)
  }

  return { entries, bySpeaker }
}

export const parseSpeakerRefAudioMappings = (
  values: readonly string[] | undefined
): SpeakerVoiceRegistry => {
  const entries: SpeakerVoiceMapping[] = []
  const bySpeaker = new Map<string, SpeakerVoiceMapping>()

  for (const raw of values ?? []) {
    const idx = raw.indexOf('=')
    if (idx <= 0 || idx === raw.length - 1) {
      throw new Error(`Invalid --tts-speaker-ref-audio value "${raw}". Expected SPEAKER=path.`)
    }

    const speaker = raw.slice(0, idx).trim()
    const refAudioPath = raw.slice(idx + 1).trim()
    if (!speaker || !refAudioPath) {
      throw new Error(`Invalid --tts-speaker-ref-audio value "${raw}". Expected SPEAKER=path.`)
    }

    const normalizedSpeaker = normalizeSpeaker(speaker)
    if (bySpeaker.has(normalizedSpeaker)) {
      throw new Error(`Duplicate --tts-speaker-ref-audio mapping for speaker ${speaker}.`)
    }

    const entry: SpeakerVoiceMapping = {
      speaker,
      normalizedSpeaker,
      voice: refAudioPath,
      voiceKind: 'ref-audio'
    }
    bySpeaker.set(normalizedSpeaker, entry)
    entries.push(entry)
  }

  return { entries, bySpeaker }
}

export const isMultiSpeakerRequested = (options: TtsOptions): boolean =>
  (options.ttsSpeakers?.length ?? 0) > 0
  || options.ttsDialogueFormat !== undefined
  || (options.ttsSpeakerRefAudios?.length ?? 0) > 0

export const isDialogueTtsRequested = isMultiSpeakerRequested

export const resolveDialogueFormat = (options: TtsOptions): TtsDialogueFormat => {
  if (options.ttsDialogueFormat === 'screenplay' || options.ttsDialogueFormat === 'labeled') {
    return options.ttsDialogueFormat
  }

  throw new Error('Dialogue TTS requires --tts-dialogue-format screenplay|labeled.')
}

const getSpeakerCue = (
  line: string,
  registry: SpeakerVoiceRegistry
): SpeakerVoiceMapping | undefined => {
  const normalizedLine = normalizeSpeaker(line)
  return registry.bySpeaker.get(normalizedLine)
}

const startsWithSpeakerAction = (
  line: string,
  registry: SpeakerVoiceRegistry
): boolean => {
  const upperLine = line.toUpperCase()
  for (const speaker of sortedSpeakerEntries(registry)) {
    if (!upperLine.startsWith(speaker.normalizedSpeaker)) {
      continue
    }

    const rest = line.slice(speaker.speaker.length)
    if (/^\s*['']s\b/i.test(rest)) {
      return true
    }
    if (/^\s+[a-z]/.test(rest)) {
      return true
    }
  }

  return false
}

const isLikelyScreenplayActionLine = (
  line: string,
  registry: SpeakerVoiceRegistry
): boolean =>
  isSceneOrTransitionLine(line) || startsWithSpeakerAction(line, registry)

const isLikelyInlineDialogueText = (text: string): boolean => {
  const firstWord = text.match(/^([A-Za-z]+)/)?.[1]?.toLowerCase()
  if (firstWord && ACTION_VERBS.has(firstWord)) {
    return false
  }
  return true
}

const parseInlineScreenplayDialogue = (
  line: string,
  registry: SpeakerVoiceRegistry
): DialogueTurn | undefined => {
  const upperLine = line.toUpperCase()
  for (const speaker of sortedSpeakerEntries(registry)) {
    if (!upperLine.startsWith(speaker.normalizedSpeaker)) {
      continue
    }

    const rest = line.slice(speaker.speaker.length)
    if (rest.length === 0) {
      continue
    }

    const boundary = rest[0]
    if (boundary !== ':' && boundary !== ' ' && boundary !== '\t') {
      continue
    }

    const candidate = boundary === ':' ? rest.slice(1).trim() : rest.trim()
    const text = stripLeadingParentheticals(candidate)
    if (!text || !isLikelyInlineDialogueText(text)) {
      continue
    }

    return {
      speaker: speaker.speaker,
      text: normalizeDialogueWhitespace(text)
    }
  }

  return undefined
}

const normalizeLabeledDialogue = (
  text: string,
  registry: SpeakerVoiceRegistry
): DialogueTurn[] => {
  const turns: DialogueTurn[] = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (!line) {
      continue
    }

    const match = line.match(/^([^:]+):\s*(.+)$/)
    if (!match) {
      throw new Error(`Invalid labeled dialogue line ${i + 1}. Expected SPEAKER: text.`)
    }

    const rawSpeaker = match[1]?.trim() ?? ''
    const speaker = registry.bySpeaker.get(normalizeSpeaker(rawSpeaker))
    if (!speaker) {
      throw new Error(`No --tts-speaker mapping found for speaker ${rawSpeaker}.`)
    }

    const turnText = normalizeDialogueWhitespace(match[2] ?? '')
    if (!turnText) {
      throw new Error(`Invalid labeled dialogue line ${i + 1}. Dialogue text is empty.`)
    }

    turns.push({
      speaker: speaker.speaker,
      text: turnText
    })
  }

  return turns
}

const normalizeScreenplayDialogue = (
  text: string,
  registry: SpeakerVoiceRegistry
): DialogueTurn[] => {
  const turns: DialogueTurn[] = []
  const lines = text.split(/\r?\n/)
  let currentSpeaker: SpeakerVoiceMapping | undefined
  let currentText: string[] = []

  const flush = (): void => {
    if (currentSpeaker && currentText.length > 0) {
      turns.push({
        speaker: currentSpeaker.speaker,
        text: normalizeDialogueWhitespace(currentText.join(' '))
      })
    }
    currentSpeaker = undefined
    currentText = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }

    if (isSceneOrTransitionLine(line)) {
      flush()
      continue
    }

    const cue = getSpeakerCue(line, registry)
    if (cue) {
      flush()
      currentSpeaker = cue
      continue
    }

    const inline = parseInlineScreenplayDialogue(line, registry)
    if (inline) {
      flush()
      turns.push(inline)
      continue
    }

    if (!currentSpeaker) {
      continue
    }

    if (isLikelyScreenplayActionLine(line, registry)) {
      flush()
      continue
    }

    const dialogue = stripLeadingParentheticals(line)
    if (dialogue) {
      currentText.push(dialogue)
    }
  }

  flush()
  return turns
}

export const formatDialogueTurns = (turns: readonly DialogueTurn[]): string =>
  turns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')

export const normalizeDialogueText = (
  text: string,
  format: TtsDialogueFormat,
  registry: SpeakerVoiceRegistry
): DialogueNormalization => {
  if (registry.entries.length === 0) {
    throw new Error('Multi-speaker TTS requires at least one --tts-speaker SPEAKER=VOICE mapping.')
  }

  const turns = format === 'screenplay'
    ? normalizeScreenplayDialogue(text, registry)
    : normalizeLabeledDialogue(text, registry)

  if (turns.length === 0) {
    throw new Error('Dialogue TTS found no dialogue turns for the configured speakers.')
  }

  const normalizedText = formatDialogueTurns(turns)
  return {
    turns,
    normalizedText,
    spokenCharacterCount: turns.reduce((sum, turn) => sum + turn.text.length, 0)
  }
}

export const normalizeDialogueFromOptions = (
  text: string,
  options: TtsOptions
): DialogueNormalization => {
  const registry = (options.ttsSpeakers?.length ?? 0) > 0
    ? parseSpeakerVoiceMappings(options.ttsSpeakers)
    : parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)
  return normalizeDialogueText(text, resolveDialogueFormat(options), registry)
}

export const formatSpeakerVoiceSummary = (
  registry: SpeakerVoiceRegistry
): string =>
  registry.entries
    .map((entry) => entry.voiceKind === 'ref-audio'
      ? `${entry.speaker}=ref_audio:${basename(entry.voice)}`
      : `${entry.speaker}=${entry.voice}`)
    .join(', ')

export const formatSpeakerRefAudioSummary = formatSpeakerVoiceSummary

export const getSpeakerVoice = (
  registry: SpeakerVoiceRegistry,
  speaker: string
): SpeakerVoiceMapping => {
  const entry = registry.bySpeaker.get(normalizeSpeaker(speaker))
  if (!entry) {
    throw new Error(`No --tts-speaker mapping found for speaker ${speaker}.`)
  }
  return entry
}

export const getSpeakerRefAudio = getSpeakerVoice
