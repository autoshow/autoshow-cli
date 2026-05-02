import { basename } from 'node:path'
import type { TtsOptions } from '~/types'

export type TtsDialogueFormat = 'screenplay' | 'labeled'

export type DialogueTurn = {
  speaker: string
  text: string
}

export type SpeakerRefAudio = {
  speaker: string
  normalizedSpeaker: string
  refAudioPath: string
}

export type SpeakerRefAudioRegistry = {
  entries: SpeakerRefAudio[]
  bySpeaker: Map<string, SpeakerRefAudio>
}

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

const normalizeSpeaker = (speaker: string): string =>
  speaker.trim().replace(/\s+/g, ' ').toUpperCase()

const normalizeDialogueWhitespace = (text: string): string =>
  text.trim().replace(/\s+/g, ' ')

const isSceneOrTransitionLine = (line: string): boolean => {
  return /^(?:SCENE|ACT)\b/i.test(line)
    || /^(?:INT|EXT|EST|INT\/EXT|I\/E)\.?\b/i.test(line)
    || /^(?:CUT TO|FADE IN|FADE OUT|DISSOLVE TO)\b/i.test(line)
}

const sortedSpeakerEntries = (registry: SpeakerRefAudioRegistry): SpeakerRefAudio[] =>
  [...registry.entries].sort((a, b) => b.normalizedSpeaker.length - a.normalizedSpeaker.length)

export const stripLeadingParentheticals = (text: string): string =>
  text.replace(/^(?:\s*\([^)]*\)\s*)+/, '').trim()

export const parseSpeakerRefAudioMappings = (
  values: readonly string[] | undefined
): SpeakerRefAudioRegistry => {
  const entries: SpeakerRefAudio[] = []
  const bySpeaker = new Map<string, SpeakerRefAudio>()

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

    const entry = { speaker, normalizedSpeaker, refAudioPath }
    bySpeaker.set(normalizedSpeaker, entry)
    entries.push(entry)
  }

  return { entries, bySpeaker }
}

export const isDialogueTtsRequested = (options: TtsOptions): boolean =>
  options.ttsDialogueFormat !== undefined || (options.ttsSpeakerRefAudios?.length ?? 0) > 0

export const resolveDialogueFormat = (options: TtsOptions): TtsDialogueFormat => {
  if (options.ttsDialogueFormat === 'screenplay' || options.ttsDialogueFormat === 'labeled') {
    return options.ttsDialogueFormat
  }

  throw new Error('Dialogue TTS requires --tts-dialogue-format screenplay|labeled.')
}

const getSpeakerCue = (
  line: string,
  registry: SpeakerRefAudioRegistry
): SpeakerRefAudio | undefined => {
  const normalizedLine = normalizeSpeaker(line)
  return registry.bySpeaker.get(normalizedLine)
}

const startsWithSpeakerAction = (
  line: string,
  registry: SpeakerRefAudioRegistry
): boolean => {
  const upperLine = line.toUpperCase()
  for (const speaker of sortedSpeakerEntries(registry)) {
    if (!upperLine.startsWith(speaker.normalizedSpeaker)) {
      continue
    }

    const rest = line.slice(speaker.speaker.length)
    if (/^\s*['’]s\b/i.test(rest)) {
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
  registry: SpeakerRefAudioRegistry
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
  registry: SpeakerRefAudioRegistry
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
  registry: SpeakerRefAudioRegistry
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
      throw new Error(`No --tts-speaker-ref-audio mapping found for speaker ${rawSpeaker}.`)
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
  registry: SpeakerRefAudioRegistry
): DialogueTurn[] => {
  const turns: DialogueTurn[] = []
  const lines = text.split(/\r?\n/)
  let currentSpeaker: SpeakerRefAudio | undefined
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
  registry: SpeakerRefAudioRegistry
): DialogueNormalization => {
  if (registry.entries.length === 0) {
    throw new Error('Dialogue TTS requires at least one --tts-speaker-ref-audio SPEAKER=path mapping.')
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
  const registry = parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)
  return normalizeDialogueText(text, resolveDialogueFormat(options), registry)
}

export const formatSpeakerRefAudioSummary = (
  registry: SpeakerRefAudioRegistry
): string =>
  registry.entries
    .map((entry) => `${entry.speaker}=ref_audio:${basename(entry.refAudioPath)}`)
    .join(', ')

export const getSpeakerRefAudio = (
  registry: SpeakerRefAudioRegistry,
  speaker: string
): SpeakerRefAudio => {
  const entry = registry.bySpeaker.get(normalizeSpeaker(speaker))
  if (!entry) {
    throw new Error(`No --tts-speaker-ref-audio mapping found for speaker ${speaker}.`)
  }
  return entry
}
