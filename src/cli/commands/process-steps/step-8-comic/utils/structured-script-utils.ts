import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import {
  createOpenAIResponse,
  extractOpenAIResponseText,
} from '~/utils/openai/client'
import {
  geminiGenerateContent,
  type GeminiGenerateContentUsageMetadata,
} from '~/utils/gemini/gemini-rest'
import * as v from 'valibot'
import { l, err, cyan, bold } from './logger'
import {
  CHARACTER_NAMES,
  CHARACTER_REFERENCE_ALIASES,
  STRUCTURED_SCRIPT_JSON_SCHEMA,
  StructuredScriptDataSchema,
} from '../schemas/schemas'
import { getStructuredScriptPath } from './project-paths'
import { getGeminiApiKey } from './gemini-client'
import { calculateGeminiLlmCost } from '../models/gemini-models'
import { isGeminiLlmModel, isOpenAiLlmModel } from '../models/model-registry'
import { getOpenAIClientConfig } from './openai-client'
import { LLM_MODEL_PRICING, openAiLlmSupportsStructuredOutputs } from '../models/openai-models'
import type {
  CharacterAliasPattern,
  CharacterMention,
  CharacterName,
  GeminiLlmModel,
  GenerateStructuredScriptsOptions,
  LlmModel,
  OpenAiLlmModel,
  StructuredScriptBeat,
  StructuredScriptData,
  StructuredScriptSourceSegment,
  StructuredScriptResponseUsage,
  StructuredScriptReviewResponse,
  StructuredScriptReviewResult,
  StructuredScriptRunStats,
} from '../types'








const STRUCTURED_SCRIPT_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  name: STRUCTURED_SCRIPT_JSON_SCHEMA.name,
  schema: STRUCTURED_SCRIPT_JSON_SCHEMA.schema,
  strict: STRUCTURED_SCRIPT_JSON_SCHEMA.strict,
}


const TRANSITION_PATTERNS = [
  /^CUT TO\b/i,
  /^CUT TO BLACK\b/i,
  /^FADE TO\b/i,
  /^FADE OUT\b/i,
  /^SMASH CUT TO\b/i,
  /^DISSOLVE TO\b/i,
  /^TITLE CARD\b/i,
  /^END\b/i,
]

const CHARACTER_ALIAS_PATTERNS: CharacterAliasPattern[] = [
  { pattern: String.raw`\bCAPT(?:AIN)?\.?\s+PEACHES\b`, characters: ['Peaches'] },
  { pattern: String.raw`\bPEACHES\b`, characters: ['Peaches'] },
  { pattern: String.raw`\bCOMMANDER\s+BISHOP\b`, characters: ['Bishop'] },
  { pattern: String.raw`\bBISHOP\b`, characters: ['Bishop'] },
  { pattern: String.raw`\bDUCO\b`, characters: ['Duco'] },
  { pattern: String.raw`\bLIEUTENANT\s+GEEBEE\b`, characters: ['GeeBee'] },
  { pattern: String.raw`\bLT\.?\s+GEEBEE\b`, characters: ['GeeBee'] },
  { pattern: String.raw`\bGEEBEE\b`, characters: ['GeeBee'] },
  { pattern: String.raw`\bENSIGN\s+SEAMUS\b`, characters: ['Seamus'] },
  { pattern: String.raw`\bSEAMUS\b`, characters: ['Seamus'] },
  { pattern: String.raw`\bGULP\s+SHIDDO\b`, characters: ['Gulp'] },
  { pattern: String.raw`\bGULP\b`, characters: ['Gulp'] },
  { pattern: String.raw`\bSPECTER\b`, characters: ['Specter'] },
  { pattern: String.raw`\bPADDY\b`, characters: ['Paddy'] },
  { pattern: String.raw`\bIRONHANDS?\s*#\s*1\b`, characters: ['Ironhand #1'] },
  { pattern: String.raw`\bIRONHANDS?\s*#\s*2\b`, characters: ['Ironhand #2'] },
  { pattern: String.raw`\bIRONHANDS?\s*#\s*3\b`, characters: ['Ironhand #3'] },
  { pattern: String.raw`\bIRONHANDS?\b`, characters: ['Ironhand #1', 'Ironhand #2', 'Ironhand #3'] },
  { pattern: String.raw`\bHR\s+HOLOGRAM\b`, characters: ['HR Hologram'] },
  { pattern: String.raw`\bCHAT\b`, characters: ['HR Hologram'] },
  { pattern: String.raw`\bPODCAST\s+HOST\b`, characters: ['Podcast Host'] },
  { pattern: String.raw`\bBUOY\s*4\s*(?:&|AND)\s*BUOY\s*6\b`, characters: ['Buoy 4 & Buoy 6'] },
  { pattern: String.raw`\bWILHELM\s+SPEAKING\s+VILLAGERS?\b`, characters: ['Wilhelm Speaking Villagers'] },
  { pattern: String.raw`\bVILLAGERS?\b`, characters: ['Wilhelm Speaking Villagers'] },
  { pattern: String.raw`\bGUARDS?\b`, characters: ['Guards'] },
]

const CHARACTER_NAME_SET = new Set<string>(CHARACTER_NAMES)
const CHARACTER_ALIAS_GUIDANCE = Object.entries(CHARACTER_REFERENCE_ALIASES)
  .map(([alias, character]) => `${alias} -> ${character}`)
  .join(', ')

const formatCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

const calculateOpenAiCost = (model: OpenAiLlmModel, usage: StructuredScriptResponseUsage): number => {
  const pricing = LLM_MODEL_PRICING[model]
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
  const uncachedInputTokens = usage.input_tokens - cachedTokens

  return (
    (uncachedInputTokens / 1_000_000) * pricing.input +
    (cachedTokens / 1_000_000) * pricing.cachedInput +
    (usage.output_tokens / 1_000_000) * pricing.output
  )
}

const calculateCost = (model: LlmModel, usage: StructuredScriptResponseUsage): number => {
  if (isOpenAiLlmModel(model)) {
    return calculateOpenAiCost(model, usage)
  }

  if (isGeminiLlmModel(model)) {
    return calculateGeminiLlmCost(model, usage)
  }

  throw new Error(`Unsupported LLM model "${model}"`)
}

const normalizeGeminiUsage = (
  usageMetadata: GeminiGenerateContentUsageMetadata | undefined
): StructuredScriptResponseUsage | undefined => {
  if (!usageMetadata) {
    return undefined
  }

  const inputTokens = usageMetadata.promptTokenCount ?? 0
  const reasoningTokens = usageMetadata.thoughtsTokenCount ?? 0
  const outputTokens = (usageMetadata.candidatesTokenCount ?? 0) + reasoningTokens
  const totalTokens = usageMetadata.totalTokenCount
    ?? inputTokens + outputTokens + (usageMetadata.toolUsePromptTokenCount ?? 0)

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    input_tokens_details: {
      cached_tokens: usageMetadata.cachedContentTokenCount ?? 0,
    },
    ...(reasoningTokens > 0
      ? {
          output_tokens_details: {
            reasoning_tokens: reasoningTokens,
          },
        }
      : {}),
  }
}

const extractJsonPayload = (content: string): string => {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Model response was empty')
  }

  const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedJsonMatch?.[1]) {
    return fencedJsonMatch[1].trim()
  }

  const firstBraceIndex = trimmed.indexOf('{')
  const lastBraceIndex = trimmed.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmed.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return trimmed
}

const parseStructuredScriptReviewResponse = (
  content: string,
  options: { lenient: boolean }
): unknown => {
  return JSON.parse(options.lenient ? extractJsonPayload(content) : content)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const formatOpenAIResponseError = (error: unknown): string => {
  if (isRecord(error)) {
    const code = typeof error['code'] === 'string' ? error['code'] : 'error'
    const message = typeof error['message'] === 'string' ? error['message'] : JSON.stringify(error)
    return `${code}: ${message}`
  }

  return String(error)
}

const deleteNullProperty = (value: Record<string, unknown>, key: string): void => {
  if (value[key] === null) {
    delete value[key]
  }
}

const stripStructuredScriptNullableOptionals = (data: unknown): unknown => {
  if (!isRecord(data)) {
    return data
  }

  const document = data['document']
  if (isRecord(document)) {
    deleteNullProperty(document, 'label')

    if (Array.isArray(document['metadata'])) {
      for (const entry of document['metadata']) {
        if (isRecord(entry)) {
          deleteNullProperty(entry, 'value')
        }
      }
    }
  }

  const scene = data['scene']
  if (isRecord(scene)) {
    deleteNullProperty(scene, 'section')

    const location = scene['location']
    if (isRecord(location)) {
      deleteNullProperty(location, 'type')
      deleteNullProperty(location, 'place')
    }
  }

  const beats = data['beats']
  if (Array.isArray(beats)) {
    for (const beat of beats) {
      if (isRecord(beat)) {
        deleteNullProperty(beat, 'speaker')
        deleteNullProperty(beat, 'speakerLabel')
        deleteNullProperty(beat, 'delivery')
      }
    }
  }

  const sourceSegments = data['sourceSegments']
  if (Array.isArray(sourceSegments)) {
    for (const sourceSegment of sourceSegments) {
      if (isRecord(sourceSegment)) {
        deleteNullProperty(sourceSegment, 'rawMarkdown')
        deleteNullProperty(sourceSegment, 'beatIndex')
        deleteNullProperty(sourceSegment, 'speaker')
        deleteNullProperty(sourceSegment, 'speakerLabel')
        deleteNullProperty(sourceSegment, 'delivery')
      }
    }
  }

  return data
}

const normalizeLineEndings = (content: string): string => content.replace(/\r\n/g, '\n')

const normalizeBlockText = (block: string): string => {
  return block
    .split('\n')
    .map(line => line.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const splitIntoBlocks = (body: string): string[] => {
  return body
    .split(/\n\s*\n/g)
    .map(block => block.trim())
    .filter(block => block.length > 0 && block !== '---')
}

const expandScriptBlocks = (blocks: string[]): string[] => {
  return blocks.flatMap(block => {
    const lines = block
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (lines.length <= 1 || !extractSingleBoldLine(lines[0] ?? '')) {
      return [block]
    }

    const expanded: string[] = [lines[0]!]
    let buffer: string[] = []

    for (const line of lines.slice(1)) {
      if (extractSingleBoldLine(line) || isParentheticalBlock(line)) {
        if (buffer.length > 0) {
          expanded.push(buffer.join('\n'))
          buffer = []
        }

        expanded.push(line)
        continue
      }

      buffer.push(line)
    }

    if (buffer.length > 0) {
      expanded.push(buffer.join('\n'))
    }

    return expanded
  })
}

const extractSingleBoldLine = (block: string): string | null => {
  const match = block.trim().match(/^\*\*(.+?)\*\*$/)
  return match?.[1]?.trim() ?? null
}

const isParentheticalBlock = (block: string): boolean => {
  return /^\((?:[\s\S]+)\)$/.test(block.trim())
}

const isPanelNoteBlock = (block: string): boolean => {
  return /^\[[\s\S]+\]$/.test(block.trim())
}

const trimPanelNote = (block: string): string => {
  return block.trim().replace(/^\[/, '').replace(/\]$/, '').trim()
}

const trimParenthetical = (block: string): string => {
  return block.trim().replace(/^\(/, '').replace(/\)$/, '').trim()
}

const isTransitionText = (text: string): boolean => {
  return TRANSITION_PATTERNS.some(pattern => pattern.test(text.trim()))
}

const uniqueCharacters = (characters: CharacterName[]): CharacterName[] => {
  const seen = new Set<CharacterName>()
  const unique: CharacterName[] = []

  for (const character of characters) {
    if (seen.has(character)) {
      continue
    }

    seen.add(character)
    unique.push(character)
  }

  return unique
}

const uniqueMentions = (mentions: CharacterMention[]): CharacterMention[] => {
  const seen = new Set<string>()
  const unique: CharacterMention[] = []

  for (const mention of mentions) {
    const key = `${mention.raw}::${mention.characters.join('|')}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(mention)
  }

  return unique
}

const detectCharacterMentions = (text: string): CharacterMention[] => {
  const occupiedRanges: Array<{ start: number; end: number }> = []
  const matches: Array<CharacterMention & { start: number }> = []

  for (const alias of CHARACTER_ALIAS_PATTERNS) {
    const regex = new RegExp(alias.pattern, 'gi')
    let match: RegExpExecArray | null

    match = regex.exec(text)
    while (match) {
      const raw = match[0]
      const start = match.index
      const end = start + raw.length
      const overlaps = occupiedRanges.some(range => start < range.end && end > range.start)

      if (!overlaps) {
        occupiedRanges.push({ start, end })
        matches.push({
          start,
          raw,
          characters: alias.characters,
        })
      }

      match = regex.exec(text)
    }
  }

  return uniqueMentions(
    matches
      .sort((left, right) => left.start - right.start)
      .map(({ start: _start, ...mention }) => mention)
  )
}

const getCharactersFromMentions = (mentions: CharacterMention[]): CharacterName[] => {
  return uniqueCharacters(mentions.flatMap(mention => mention.characters))
}

const parseHeading = (
  heading: string,
  options: { stripWrappingQuotes?: boolean } = {}
): { heading: string; label?: string; title: string } => {
  const normalizedHeading = heading.trim()
  const [labelPart, ...titleParts] = normalizedHeading.split(':')
  const hasDelimitedTitle = titleParts.length > 0
  const rawTitle = hasDelimitedTitle ? titleParts.join(':').trim() : normalizedHeading
  const title = options.stripWrappingQuotes
    ? rawTitle.replace(/^["']/, '').replace(/["']$/, '')
    : rawTitle

  return {
    heading: normalizedHeading,
    ...(hasDelimitedTitle ? { label: (labelPart ?? normalizedHeading).trim() } : {}),
    title,
  }
}

const parseMetadataEntry = (raw: string): StructuredScriptData['document']['metadata'][number] => {
  if (raw.includes(':')) {
    const [label, ...rest] = raw.split(':')
    const value = rest.join(':').trim()
    return {
      label: (label ?? raw).trim(),
      ...(value ? { value } : {}),
      raw,
    }
  }

  if (raw.includes(' - ')) {
    const [label, ...rest] = raw.split(' - ')
    const value = rest.join(' - ').trim()
    return {
      label: (label ?? raw).trim(),
      ...(value ? { value } : {}),
      raw,
    }
  }

  return {
    label: raw,
    raw,
  }
}

const parseLocation = (raw: string): StructuredScriptData['scene']['location'] => {
  const match = raw.match(/^(INT|EXT|INT\/EXT|EXT\/INT)\.?\s+(.*)$/i)

  if (!match?.[1] || !match[2]) {
    return { raw }
  }

  return {
    raw,
    type: match[1].toUpperCase().replace(/\./g, ''),
    place: match[2].trim(),
  }
}

const normalizeSpeakerLabelForMatching = (label: string): string => {
  return label
    .trim()
    .replace(/\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'D|INUED)?|ON COMMS?)\)\s*$/i, '')
    .trim()
}

const detectSpeakerLabelCharacters = (label: string): CharacterName[] => {
  const normalizedLabel = normalizeSpeakerLabelForMatching(label)
  if (!normalizedLabel) {
    return []
  }

  for (const alias of CHARACTER_ALIAS_PATTERNS) {
    const regex = new RegExp(`^${alias.pattern}$`, 'i')
    if (regex.test(normalizedLabel)) {
      return uniqueCharacters(alias.characters)
    }
  }

  return []
}

const LOCATION_HINT_PATTERN = /\b(?:USS|INT|EXT|BRIDGE|BAY|DECK|CORRIDOR|HALL|OFFICE|QUARTERS|ROOM|LAB|ENGINE|FABRICATION|CARGO|AIRLOCK|HULL|SHUTTLE|SHIP|STATION|PLANET|SURFACE|COLONY|VILLAGE|SQUARE|CENTER|CENTRE|DOCK|PORT|WARD|MESS|GALLEY|TRANSPORT|ARRAY)\b/i

const isSceneLocationLine = (raw: string): boolean => {
  if (detectSpeakerLabelCharacters(raw).length > 0 || isTransitionText(raw)) {
    return false
  }

  const parsed = parseLocation(raw)
  return Boolean(parsed.place) || LOCATION_HINT_PATTERN.test(raw)
}

const resolveFallbackSceneLocation = (
  metadata: StructuredScriptData['document']['metadata'],
  sceneTitle: string
): string => {
  const locationEntry = metadata.find(entry => {
    return isSceneLocationLine(entry.value ?? entry.raw)
  })
  const fallbackEntry = locationEntry ?? metadata[0]

  return fallbackEntry?.value ?? fallbackEntry?.raw ?? sceneTitle
}

const extractLeadingDelivery = (text: string): { text: string; delivery?: string } => {
  const match = text.match(/^\(([^)]+)\)\s+([\s\S]+)$/)
  if (!match?.[1] || !match[2]) {
    return { text }
  }

  return {
    delivery: match[1].trim(),
    text: match[2].trim(),
  }
}

const buildBeat = (
  index: number,
  options: Omit<StructuredScriptBeat, 'index'>
): StructuredScriptBeat => {
  return {
    index,
    ...options,
  }
}

const SOURCE_SEGMENT_TEXT_TARGET_LENGTH = 320

const formatSourceSegmentId = (
  beatIndex: number,
  partIndex: number,
  partCount: number
): string => {
  const beatLabel = String(beatIndex).padStart(4, '0')
  if (partCount === 1) {
    return `beat-${beatLabel}`
  }

  return `beat-${beatLabel}-${String(partIndex).padStart(2, '0')}`
}

const splitSentenceUnits = (text: string): string[] => {
  const matches = Array.from(text.matchAll(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g))
    .map(match => match[0].trim())
    .filter(match => match.length > 0)

  if (matches.length <= 1) {
    return [text]
  }

  const reconstructed = matches.join(' ').replace(/\s+/g, ' ').trim()
  return reconstructed === text ? matches : [text]
}

const splitSourceSegmentText = (
  beat: StructuredScriptBeat
): string[] => {
  if (beat.type === 'dialogue' || beat.text.length <= SOURCE_SEGMENT_TEXT_TARGET_LENGTH) {
    return [beat.text]
  }

  const sentenceUnits = splitSentenceUnits(beat.text)
  if (sentenceUnits.length <= 1) {
    return [beat.text]
  }

  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentenceUnits) {
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence
    if (candidate.length <= SOURCE_SEGMENT_TEXT_TARGET_LENGTH || !currentChunk) {
      currentChunk = candidate
      continue
    }

    chunks.push(currentChunk)
    currentChunk = sentence
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  const reconstructed = chunks.join(' ').replace(/\s+/g, ' ').trim()
  return reconstructed === beat.text ? chunks : [beat.text]
}

const buildSourceSegmentRawMarkdown = (
  beat: StructuredScriptBeat,
  text: string
): string => {
  if (beat.type === 'dialogue') {
    return [
      ...(beat.speakerLabel ? [`**${beat.speakerLabel}**`] : []),
      ...(beat.delivery ? [`(${beat.delivery})`] : []),
      text,
    ].join('\n')
  }

  if (beat.type === 'panel-note') {
    return `[${text}]`
  }

  return text
}

const buildSourceSegmentsFromBeats = (
  beats: StructuredScriptBeat[]
): StructuredScriptSourceSegment[] => {
  return beats.flatMap(beat => {
    const parts = splitSourceSegmentText(beat)

    return parts.map((text, index) => ({
      id: formatSourceSegmentId(beat.index, index + 1, parts.length),
      type: beat.type,
      text,
      rawMarkdown: buildSourceSegmentRawMarkdown(beat, text),
      beatIndex: beat.index,
      ...(beat.speaker ? { speaker: beat.speaker } : {}),
      ...(beat.speakerLabel ? { speakerLabel: beat.speakerLabel } : {}),
      ...(beat.delivery ? { delivery: beat.delivery } : {}),
    }))
  })
}

const formatStructuredScriptReviewPrompt = (
  sourceMarkdown: string,
  provisional: StructuredScriptData
): string => {
  return [
    'Review the structured script JSON against the original markdown script and correct any mistakes.',
    '',
    'Requirements:',
    '- Return only JSON that matches the provided schema.',
    '- Preserve exact dialogue and scene text from the markdown script.',
    '- Do not invent metadata, beats, characters, locations, or transitions that are not present.',
    '- Use only these beat types: narration, dialogue, direction, transition, panel-note.',
    '- Use `panel-note` for bracketed staging or panel layout notes from the script (e.g. "[Wide shot: ...]", "[3-4 panels showing...]"). Preserve the text exactly, without the outer brackets.',
    '- Keep parenthetical delivery notes attached to the following dialogue in `delivery` when they describe line delivery.',
    '- Use a `direction` beat for standalone parenthetical interruptions like `(beat)` when they sit between dialogue lines.',
    '- Keep `speakerLabel` as the original bold label from the script and `speaker` as the canonical character name when it is unambiguous.',
    '- Keep `rawMentions` limited to exact character mentions present in each beat text.',
    '- Keep `sourceSegments` as deterministic source coverage records; do not paraphrase or omit source segment text.',
    '- Keep beat indexes sequential starting at 1.',
    '- Keep `scriptSlug` and `sourceFile` aligned to the source file shown below.',
    `- Resolve character aliases to canonical names: ${CHARACTER_ALIAS_GUIDANCE}.`,
    '',
    `Allowed canonical character names: ${CHARACTER_NAMES.join(', ')}`,
    '',
    'Original script markdown:',
    '```md',
    sourceMarkdown.trim(),
    '```',
    '',
    'Current structured script JSON:',
    '```json',
    JSON.stringify(provisional, null, 2),
    '```',
  ].join('\n')
}

const createStructuredScriptReviewOpenAI = async (
  content: string,
  model: OpenAiLlmModel
): Promise<StructuredScriptReviewResult> => {
  const config = getOpenAIClientConfig()
  const usesStructuredOutputs = openAiLlmSupportsStructuredOutputs(model)
  const request: Record<string, unknown> = {
    model,
    input: content,
    stream: false,
    instructions: usesStructuredOutputs
      ? 'Return only the reviewed structured script JSON.'
      : 'Return only valid JSON that matches the requested structured script schema. Do not include markdown fences or commentary.',
    ...(usesStructuredOutputs ? { text: { format: STRUCTURED_SCRIPT_RESPONSE_FORMAT } } : {}),
  }

  const response = await createOpenAIResponse(config, request)
  if (response.error) {
    throw new Error(formatOpenAIResponseError(response.error))
  }

  const text = (extractOpenAIResponseText(response) ?? '').trim()
  if (!text) {
    const incompleteReason = response.incomplete_details
      ? ` (${JSON.stringify(response.incomplete_details)})`
      : ''
    throw new Error(`Empty response from ${model}${incompleteReason}`)
  }

  return {
    response: {
      model: response.model ?? model,
      text,
      ...(response.id ? { requestId: response.id } : {}),
      ...(response.usage ? { usage: response.usage as StructuredScriptResponseUsage } : {}),
      ...(response.status ? { status: response.status } : {}),
    },
    usesStructuredOutputs,
  }
}

const createStructuredScriptReviewGemini = async (
  content: string,
  model: GeminiLlmModel
): Promise<StructuredScriptReviewResult> => {
  const apiKey = getGeminiApiKey()
  const response = await geminiGenerateContent(apiKey, {
    model,
    contents: content,
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: STRUCTURED_SCRIPT_JSON_SCHEMA.schema,
    },
    systemInstruction: 'Return only the reviewed structured script JSON.',
  })

  const text = response.text?.trim()
  if (!text) {
    const blockedReason = response.promptFeedback?.blockReason
      ? ` (${response.promptFeedback.blockReason})`
      : ''
    throw new Error(`Empty response from ${model}${blockedReason}`)
  }

  const usage = normalizeGeminiUsage(response.usageMetadata)

  return {
    response: {
      model: response.modelVersion ?? model,
      text,
      ...(response.responseId ? { requestId: response.responseId } : {}),
      ...(usage ? { usage } : {}),
    },
    usesStructuredOutputs: true,
  }
}

const createStructuredScriptReview = async (
  content: string,
  model: LlmModel
): Promise<StructuredScriptReviewResult> => {
  if (isOpenAiLlmModel(model)) {
    return createStructuredScriptReviewOpenAI(content, model)
  }

  if (isGeminiLlmModel(model)) {
    return createStructuredScriptReviewGemini(content, model)
  }

  throw new Error(`Unsupported LLM model "${model}"`)
}

const inferStandaloneDirectionSpeakerContext = (
  beats: StructuredScriptBeat[],
  index: number
): { speaker?: CharacterName; speakerLabel?: string } => {
  const previousBeat = beats[index - 1]
  const nextBeat = beats[index + 1]

  if (
    previousBeat?.type === 'dialogue'
    && nextBeat?.type === 'dialogue'
    && previousBeat.speaker
    && nextBeat.speaker
    && previousBeat.speaker === nextBeat.speaker
  ) {
    return {
      speaker: previousBeat.speaker,
      ...(previousBeat.speakerLabel
        ? { speakerLabel: previousBeat.speakerLabel }
        : nextBeat.speakerLabel
          ? { speakerLabel: nextBeat.speakerLabel }
          : {}),
    }
  }

  return {}
}

const canonicalizeBeat = (
  beat: StructuredScriptBeat,
  beats: StructuredScriptBeat[],
  index: number
): StructuredScriptBeat => {
  if (beat.type !== 'direction' || !isParentheticalBlock(beat.text)) {
    return beat
  }

  const inferredSpeaker = beat.speaker
    ? {
        speaker: beat.speaker,
        ...(beat.speakerLabel ? { speakerLabel: beat.speakerLabel } : {}),
      }
    : inferStandaloneDirectionSpeakerContext(beats, index)

  return {
    ...beat,
    text: trimParenthetical(beat.text),
    ...inferredSpeaker,
  }
}

export const normalizeStructuredScriptData = (
  data: StructuredScriptData,
  options: { scriptSlug: string; sourceFile: string; sourceSegments?: StructuredScriptSourceSegment[] }
): StructuredScriptData => {
  const beats = data.beats.map((beat, index) => {
    const canonicalBeat = canonicalizeBeat(beat, data.beats, index)
    const rawMentions = canonicalBeat.rawMentions.map(mention => ({
      ...mention,
      characters: uniqueCharacters(mention.characters),
    }))

    const characters = uniqueCharacters([
      ...canonicalBeat.characters,
      ...rawMentions.flatMap(mention => mention.characters),
      ...(canonicalBeat.speaker ? [canonicalBeat.speaker] : []),
    ])

    return {
      ...canonicalBeat,
      index: index + 1,
      characters,
      rawMentions,
    }
  })

  const characters = uniqueCharacters(
    beats.flatMap(beat => [
      ...beat.characters,
      ...beat.rawMentions.flatMap(mention => mention.characters),
      ...(beat.speaker ? [beat.speaker] : []),
    ])
  )

  return {
    ...data,
    scriptSlug: options.scriptSlug,
    sourceFile: options.sourceFile,
    characters,
    beats,
    sourceSegments: options.sourceSegments ?? buildSourceSegmentsFromBeats(beats),
  }
}

const reviewStructuredScriptWithLlm = async (
  sourceMarkdown: string,
  provisional: StructuredScriptData,
  model: LlmModel
): Promise<{ structuredScript: StructuredScriptData; response: StructuredScriptReviewResponse; durationMs: number }> => {
  const prompt = formatStructuredScriptReviewPrompt(sourceMarkdown, provisional)
  const requestStart = Date.now()
  const reviewResult = await createStructuredScriptReview(prompt, model)
  const durationMs = Date.now() - requestStart

  const parsed = stripStructuredScriptNullableOptionals(
    parseStructuredScriptReviewResponse(reviewResult.response.text, {
      lenient: !reviewResult.usesStructuredOutputs,
    })
  )

  const normalized = normalizeStructuredScriptData(
    v.parse(StructuredScriptDataSchema, parsed),
    {
      scriptSlug: provisional.scriptSlug,
      sourceFile: provisional.sourceFile,
      sourceSegments: provisional.sourceSegments,
    }
  )

  return {
    structuredScript: v.parse(StructuredScriptDataSchema, normalized),
    response: reviewResult.response,
    durationMs,
  }
}

export const parseScriptMarkdownToStructuredData = (
  content: string,
  scriptPath: string
): StructuredScriptData => {
  const scriptFile = basename(scriptPath)
  const normalized = normalizeLineEndings(content).trim()
  const lines = normalized.split('\n')
  const titleIndex = lines.findIndex(line => line.trim().startsWith('# '))

  if (titleIndex < 0) {
    throw new Error(`Script "${scriptFile}" is missing a top-level "# " heading`)
  }

  const sceneHeadingIndex = lines.findIndex((line, index) => index > titleIndex && line.trim().startsWith('## '))
  if (sceneHeadingIndex < 0) {
    throw new Error(`Script "${scriptFile}" is missing a scene heading`)
  }

  const documentHeading = parseHeading(lines[titleIndex]!.trim().replace(/^#\s+/, ''))
  const sceneHeading = parseHeading(
    lines[sceneHeadingIndex]!.trim().replace(/^##\s+/, ''),
    { stripWrappingQuotes: true }
  )

  const metadata = lines
    .slice(titleIndex + 1, sceneHeadingIndex)
    .map(line => line.trim())
    .filter(line => line.length > 0 && line !== '---')
    .map(extractSingleBoldLine)
    .filter((line): line is string => line !== null)
    .map(parseMetadataEntry)

  const firstBodyLineIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim()
    return index > sceneHeadingIndex && trimmed.length > 0 && trimmed !== '---'
  })
  const bodyStartIndex = firstBodyLineIndex < 0 ? lines.length : firstBodyLineIndex
  const firstBodyLine = firstBodyLineIndex < 0 ? '' : lines[firstBodyLineIndex]?.trim() ?? ''
  const firstBodyBoldLine = extractSingleBoldLine(firstBodyLine)
  const hasSceneLocalLocation = firstBodyBoldLine !== null && isSceneLocationLine(firstBodyBoldLine)
  const locationRaw = hasSceneLocalLocation && firstBodyBoldLine
    ? firstBodyBoldLine
    : resolveFallbackSceneLocation(metadata, sceneHeading.title)
  const body = lines
    .slice(hasSceneLocalLocation ? bodyStartIndex + 1 : bodyStartIndex)
    .join('\n')
    .trim()
  const blocks = expandScriptBlocks(splitIntoBlocks(body))
  const beats: StructuredScriptBeat[] = []
  const allCharacters: CharacterName[] = []

  let activeSpeakerLabel: string | null = null
  let activeSpeakerCharacters: CharacterName[] = []
  let pendingDelivery: string | null = null
  let hasDialogueInCurrentTurn = false
  let continueDialogueAfterDirection = false

  const resetSpeakerTurn = (): void => {
    activeSpeakerLabel = null
    activeSpeakerCharacters = []
    pendingDelivery = null
    hasDialogueInCurrentTurn = false
    continueDialogueAfterDirection = false
  }

  const nextBeatIndex = (): number => beats.length + 1

  const registerCharacters = (characters: CharacterName[]): void => {
    for (const character of characters) {
      if (!CHARACTER_NAME_SET.has(character)) {
        continue
      }

      allCharacters.push(character)
    }
  }

  for (const block of blocks) {
    const boldLine = extractSingleBoldLine(block)
    if (boldLine) {
      const mentions = detectCharacterMentions(boldLine)
      const characters = getCharactersFromMentions(mentions)
      const speakerCharacters = detectSpeakerLabelCharacters(boldLine)

      if (isTransitionText(boldLine)) {
        beats.push(buildBeat(nextBeatIndex(), {
          type: 'transition',
          text: boldLine,
          characters,
          rawMentions: mentions,
        }))
        registerCharacters(characters)
        resetSpeakerTurn()
        continue
      }

      if (speakerCharacters.length > 0) {
        activeSpeakerLabel = boldLine
        activeSpeakerCharacters = speakerCharacters
        pendingDelivery = null
        hasDialogueInCurrentTurn = false
        continueDialogueAfterDirection = false
        continue
      }

      beats.push(buildBeat(nextBeatIndex(), {
        type: 'direction',
        text: boldLine,
        characters,
        rawMentions: mentions,
      }))
      registerCharacters(characters)
      resetSpeakerTurn()
      continue
    }

    if (isPanelNoteBlock(block)) {
      const text = trimPanelNote(block)
      const mentions = detectCharacterMentions(text)
      const characters = getCharactersFromMentions(mentions)
      beats.push(buildBeat(nextBeatIndex(), {
        type: 'panel-note',
        text,
        characters,
        rawMentions: mentions,
      }))
      registerCharacters(characters)
      resetSpeakerTurn()
      continue
    }

    if (isParentheticalBlock(block)) {
      const text = trimParenthetical(block)
      const mentions = detectCharacterMentions(text)
      const characters = uniqueCharacters([
        ...activeSpeakerCharacters,
        ...getCharactersFromMentions(mentions),
      ])

      if (activeSpeakerLabel && !hasDialogueInCurrentTurn && !pendingDelivery) {
        pendingDelivery = text
        continue
      }

      beats.push(buildBeat(nextBeatIndex(), {
        type: 'direction',
        text,
        characters,
        rawMentions: mentions,
        ...(activeSpeakerCharacters.length === 1 ? { speaker: activeSpeakerCharacters[0] } : {}),
        ...(activeSpeakerLabel ? { speakerLabel: activeSpeakerLabel } : {}),
      }))
      registerCharacters(characters)

      if (activeSpeakerLabel) {
        continueDialogueAfterDirection = true
      } else {
        resetSpeakerTurn()
      }

      continue
    }

    const text = normalizeBlockText(block)

    if (activeSpeakerLabel && (!hasDialogueInCurrentTurn || continueDialogueAfterDirection)) {
      const dialogue = extractLeadingDelivery(text)
      const mentions = detectCharacterMentions(dialogue.text)
      const mentionedCharacters = getCharactersFromMentions(mentions)
      const delivery = pendingDelivery ?? dialogue.delivery
      const characters = uniqueCharacters([
        ...activeSpeakerCharacters,
        ...mentionedCharacters,
      ])

      beats.push(buildBeat(nextBeatIndex(), {
        type: 'dialogue',
        text: dialogue.text,
        characters,
        rawMentions: mentions,
        ...(activeSpeakerCharacters.length === 1 ? { speaker: activeSpeakerCharacters[0] } : {}),
        ...(activeSpeakerLabel ? { speakerLabel: activeSpeakerLabel } : {}),
        ...(delivery ? { delivery } : {}),
      }))
      registerCharacters(characters)
      hasDialogueInCurrentTurn = true
      pendingDelivery = null
      continueDialogueAfterDirection = false
      continue
    }

    const mentions = detectCharacterMentions(text)
    const mentionedCharacters = getCharactersFromMentions(mentions)
    const type = isTransitionText(text) ? 'transition' : 'narration'
    beats.push(buildBeat(nextBeatIndex(), {
      type,
      text,
      characters: mentionedCharacters,
      rawMentions: mentions,
    }))
    registerCharacters(mentionedCharacters)
    resetSpeakerTurn()
  }

  const normalizedBeats = beats.map((beat, index) => ({
    ...beat,
    index: index + 1,
  }))

  return v.parse(StructuredScriptDataSchema, {
    scriptSlug: basename(scriptFile, '.md'),
    sourceFile: scriptPath,
    document: {
      heading: documentHeading.heading,
      ...(documentHeading.label ? { label: documentHeading.label } : {}),
      title: documentHeading.title,
      metadata,
    },
    scene: {
      heading: sceneHeading.heading,
      ...(sceneHeading.label ? { section: sceneHeading.label } : {}),
      title: sceneHeading.title,
      location: parseLocation(locationRaw),
    },
    characters: uniqueCharacters(allCharacters),
    beats: normalizedBeats,
    sourceSegments: buildSourceSegmentsFromBeats(normalizedBeats),
  })
}

export const generateStructuredScript = async (
  scriptPath: string,
  sceneSlug: string,
  options: GenerateStructuredScriptsOptions = {}
): Promise<StructuredScriptRunStats> => {
  l(`Generating structured script JSON from ${basename(scriptPath)}${options.llmModel ? ` with ${options.llmModel} review` : ''}`)

  const stats: StructuredScriptRunStats = {
    filesProcessed: 0,
    llmReviews: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalDurationMs: 0,
  }

  try {
    const content = await Bun.file(scriptPath).text()

    if (!content.trim()) {
      l.dim(`Skipping empty file: ${basename(scriptPath)}`)
      return stats
    }

    let structuredScript = parseScriptMarkdownToStructuredData(content, scriptPath)

    if (options.llmModel) {
      l.dim(`Reviewing with ${options.llmModel}: ${basename(scriptPath)}`)

      const review = await reviewStructuredScriptWithLlm(content, structuredScript, options.llmModel)
      const usage = review.response.usage
      l.dim(`  Model:            ${review.response.model}`)
      if (review.response.requestId) {
        l.dim(`  Response ID:      ${review.response.requestId}`)
      }
      if (review.response.status) {
        l.dim(`  Status:           ${review.response.status}`)
      }
      if (usage) {
        const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
        const cost = calculateCost(options.llmModel, usage)

        l.dim(`  Input tokens:     ${usage.input_tokens.toLocaleString()}${cachedTokens > 0 ? ` (${cachedTokens.toLocaleString()} cached)` : ''}`)
        l.dim(`  Output tokens:    ${usage.output_tokens.toLocaleString()}`)
        l.dim(`  Total tokens:     ${usage.total_tokens.toLocaleString()}`)
        l.dim(`  Cost:             ${formatCost(cost)}`)
        l.dim(`  Duration:         ${(review.durationMs / 1000).toFixed(2)}s`)

        const reasoningTokens = usage.output_tokens_details?.reasoning_tokens
        if (reasoningTokens && reasoningTokens > 0) {
          l.dim(`  Reasoning tokens: ${reasoningTokens.toLocaleString()}`)
        }

        stats.totalInputTokens += usage.input_tokens
        stats.totalOutputTokens += usage.output_tokens
        stats.totalCachedTokens += cachedTokens
        stats.totalCost += cost
      } else {
        l.dim(`  Duration:         ${(review.durationMs / 1000).toFixed(2)}s (no usage data returned)`)
      }

      stats.llmReviews++
      stats.totalDurationMs += review.durationMs
      structuredScript = review.structuredScript
    }

    const outputPath = getStructuredScriptPath(sceneSlug)
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, JSON.stringify(structuredScript, null, 2))
    stats.filesProcessed++
    l.dim(`${options.llmModel ? 'Structured + reviewed' : 'Structured'}: ${basename(scriptPath)}`)

    l('')
    l.success(`Structured script file generated: ${stats.filesProcessed}`)

    if (stats.llmReviews > 0) {
      l('')
      l(`${cyan('━'.repeat(50))}`)
      l(bold('LLM Review Summary'))
      l(`${cyan('━'.repeat(50))}`)
      l.dim(`  Files reviewed:     ${stats.llmReviews.toLocaleString()}`)
      l.dim(`  Total input tokens: ${stats.totalInputTokens.toLocaleString()}${stats.totalCachedTokens > 0 ? ` (${stats.totalCachedTokens.toLocaleString()} cached)` : ''}`)
      l.dim(`  Total output tokens: ${stats.totalOutputTokens.toLocaleString()}`)
      l.dim(`  Total tokens:       ${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}`)
      l.dim(`  Total cost:         ${formatCost(stats.totalCost)}`)
      l.dim(`  Total LLM time:     ${(stats.totalDurationMs / 1000).toFixed(2)}s`)
    }
  } catch (error) {
    if (v.isValiError(error)) {
      err(`Invalid structured script output for ${basename(scriptPath)}`)
      err(error)
    } else {
      err(`Failed to process ${basename(scriptPath)}:`, error instanceof Error ? error.message : String(error))
    }
    throw error
  }

  return stats
}
