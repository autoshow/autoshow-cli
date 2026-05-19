import * as v from 'valibot'
import { toJsonSchema } from '@valibot/to-json-schema'
import type { ResolvedLeafPrompt, ResolvedStructuredSchema, ValibotSchema } from '~/types'
import { collectLeafPrompts } from '~/prompts/prompt-loader'
import { composePromptObjectSchema, getStructuredPresetSchema, hasStructuredPreset } from './preset-registry'

const sanitizeSchemaName = (name: string): string => {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  return sanitized.length > 0 ? sanitized : 'structured_output'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const includesObjectType = (typeValue: unknown): boolean => {
  if (typeValue === 'object') return true
  return Array.isArray(typeValue) && typeValue.some((entry) => entry === 'object')
}

const normalizeJsonSchemaNode = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map((entry) => normalizeJsonSchemaNode(entry))
  }

  if (!isRecord(node)) {
    return node
  }

  const normalized = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, normalizeJsonSchemaNode(value)])
  ) as Record<string, unknown>

  if ('$schema' in normalized) {
    delete normalized['$schema']
  }

  const looksLikeObjectSchema = includesObjectType(normalized['type']) || isRecord(normalized['properties'])
  if (looksLikeObjectSchema && !('additionalProperties' in normalized)) {
    normalized['additionalProperties'] = false
  }

  if (typeof normalized['minItems'] === 'number' && normalized['minItems'] > 1) {
    normalized['minItems'] = 1
  }
  if ('maxItems' in normalized) {
    delete normalized['maxItems']
  }

  return normalized
}

const normalizeJsonSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
  return normalizeJsonSchemaNode(schema) as Record<string, unknown>
}

const FREEFORM_CONTENT_SCHEMA = v.object({ content: v.pipe(v.string(), v.minLength(1)) })

const resolveLeafPresetName = (leafPromptName: string, structuredPreset: string | undefined): string | null => {
  if (structuredPreset && hasStructuredPreset(structuredPreset)) {
    return structuredPreset
  }
  if (hasStructuredPreset(leafPromptName)) {
    return leafPromptName
  }
  return null
}

const buildFreeformEnvelopeSchema = (): ResolvedStructuredSchema => {
  const jsonSchemaRaw = toJsonSchema(FREEFORM_CONTENT_SCHEMA, {
    target: 'draft-07',
    errorMode: 'throw'
  }) as Record<string, unknown>

  return {
    schemaName: 'prompt_content',
    leafPromptNames: ['content'],
    presetNames: [],
    schema: FREEFORM_CONTENT_SCHEMA,
    jsonSchema: normalizeJsonSchema(jsonSchemaRaw)
  }
}

export const resolveStructuredSchema = async (
  promptNames: string[],
  options: { fallbackToFreeformEnvelope?: boolean | undefined; extraLeaves?: ResolvedLeafPrompt[] | undefined } = {}
): Promise<ResolvedStructuredSchema> => {
  if (options.fallbackToFreeformEnvelope && promptNames.length === 0 && (!options.extraLeaves || options.extraLeaves.length === 0)) {
    return buildFreeformEnvelopeSchema()
  }

  const registryLeaves = await collectLeafPrompts(promptNames)
  const leaves = [...registryLeaves, ...(options.extraLeaves ?? [])]
  if (leaves.length === 0) {
    throw new Error('No prompt leaves resolved for structured output')
  }

  const presetNames = leaves.map((leaf) =>
    resolveLeafPresetName(leaf.name, leaf.entry.structuredPreset)
  )

  const getSchemaForPreset = (presetName: string | null): ValibotSchema =>
    presetName ? getStructuredPresetSchema(presetName) : FREEFORM_CONTENT_SCHEMA

  let schema: ValibotSchema
  let schemaName: string

  if (leaves.length === 1) {
    schema = getSchemaForPreset(presetNames[0] as string | null)
    schemaName = sanitizeSchemaName(`prompt_${leaves[0]?.name ?? 'default'}`)
  } else {
    schema = composePromptObjectSchema(
      leaves.map((leaf, index) => ({
        key: leaf.name,
        schema: getSchemaForPreset(presetNames[index] as string | null)
      }))
    )
    schemaName = sanitizeSchemaName(`prompts_${leaves.map((leaf) => leaf.name).join('_')}`)
  }

  const jsonSchemaRaw = toJsonSchema(schema, {
    target: 'draft-07',
    errorMode: 'throw'
  }) as Record<string, unknown>

  return {
    schemaName,
    leafPromptNames: leaves.map((leaf) => leaf.name),
    presetNames: presetNames.filter((name): name is string => name !== null),
    schema,
    jsonSchema: normalizeJsonSchema(jsonSchemaRaw)
  }
}

export const buildStructuredInstructionSuffix = (leafPromptNames: string[]): string => {
  const schemaGuidance = '- Return only valid JSON. Do not wrap JSON in markdown code fences.'

  if (leafPromptNames.length <= 1) {
    return `${schemaGuidance}\n- The output must match the provided JSON schema exactly.`
  }

  return [
    schemaGuidance,
    '- The output must be a single JSON object keyed by prompt name.',
    `- Required top-level keys: ${leafPromptNames.join(', ')}.`
  ].join('\n')
}
