import * as v from 'valibot'
import type { StructuredValidationContext, StructuredValidationResult, ValibotSchema } from '~/types'
import { isSongLyricsPreset } from './preset-registry'

const stripMarkdownCodeFence = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, '')
  return withoutStart.replace(/\s*```$/, '').trim()
}

const parseJsonFromText = (raw: string): StructuredValidationResult => {
  const direct = stripMarkdownCodeFence(raw)

  try {
    return { success: true, value: JSON.parse(direct) }
  } catch {
  }

  const start = direct.indexOf('{')
  const end = direct.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const jsonCandidate = direct.slice(start, end + 1)
    try {
      return { success: true, value: JSON.parse(jsonCandidate) }
    } catch {
    }
  }

  return {
    success: false,
    issue: 'Response was not valid JSON'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeSongLyricsValue = (
  value: unknown,
  title: string
): unknown => {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    title
  }
}

const normalizeStructuredValue = (
  value: unknown,
  context: StructuredValidationContext | undefined
): unknown => {
  const title = context?.songLyricsTitle?.trim()
  if (!context || !title) {
    return value
  }

  if (context.leafPromptNames.length <= 1) {
    const preset = context.presetNames[0]
    return preset && isSongLyricsPreset(preset)
      ? normalizeSongLyricsValue(value, title)
      : value
  }

  if (!isRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = { ...value }
  for (const [index, promptName] of context.leafPromptNames.entries()) {
    const preset = context.presetNames[index]
    if (!preset || !isSongLyricsPreset(preset)) {
      continue
    }

    normalized[promptName] = normalizeSongLyricsValue(normalized[promptName], title)
  }

  return normalized
}

export const parseAndValidateStructured = (
  schema: ValibotSchema,
  rawText: string,
  context?: StructuredValidationContext
): StructuredValidationResult => {
  const parsed = parseJsonFromText(rawText)
  if (!parsed.success) {
    return parsed
  }

  const normalizedValue = normalizeStructuredValue(parsed.value, context)
  const validation = v.safeParse(schema, normalizedValue)
  if (!validation.success) {
    const flattened = v.flatten(validation.issues)
    return {
      success: false,
      issue: JSON.stringify(flattened)
    }
  }

  return {
    success: true,
    value: validation.output
  }
}
