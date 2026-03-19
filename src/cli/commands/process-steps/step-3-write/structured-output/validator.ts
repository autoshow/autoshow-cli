import * as v from 'valibot'
import type { StructuredValidationResult, ValibotSchema } from './types'

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

export const parseAndValidateStructured = (
  schema: ValibotSchema,
  rawText: string
): StructuredValidationResult => {
  const parsed = parseJsonFromText(rawText)
  if (!parsed.success) {
    return parsed
  }

  const validation = v.safeParse(schema, parsed.value)
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
