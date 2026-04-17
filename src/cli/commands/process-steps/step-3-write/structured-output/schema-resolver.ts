import { toJsonSchema } from '@valibot/to-json-schema'
import type { ResolvedStructuredSchema, ValibotSchema } from '~/types'
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

  return normalized
}

const normalizeJsonSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
  return normalizeJsonSchemaNode(schema) as Record<string, unknown>
}

const resolveLeafPresetName = (leafPromptName: string, structuredPreset: string | undefined): string => {
  if (structuredPreset && hasStructuredPreset(structuredPreset)) {
    return structuredPreset
  }
  if (hasStructuredPreset(leafPromptName)) {
    return leafPromptName
  }
  return 'freeformEnvelope'
}

const buildFreeformEnvelopeSchema = (): ResolvedStructuredSchema => {
  const schema = getStructuredPresetSchema('freeformEnvelope')
  const jsonSchemaRaw = toJsonSchema(schema, {
    target: 'draft-07',
    errorMode: 'throw'
  }) as Record<string, unknown>

  return {
    schemaName: 'prompt_content',
    leafPromptNames: ['content'],
    presetNames: ['freeformEnvelope'],
    schema,
    jsonSchema: normalizeJsonSchema(jsonSchemaRaw)
  }
}

export const resolveStructuredSchema = async (
  promptNames: string[],
  options: { fallbackToFreeformEnvelope?: boolean } = {}
): Promise<ResolvedStructuredSchema> => {
  if (options.fallbackToFreeformEnvelope && promptNames.length === 0) {
    return buildFreeformEnvelopeSchema()
  }

  const leaves = await collectLeafPrompts(promptNames)
  if (leaves.length === 0) {
    throw new Error('No prompt leaves resolved for structured output')
  }

  const presetNames = leaves.map((leaf) =>
    resolveLeafPresetName(leaf.name, leaf.entry.structuredPreset)
  )

  let schema: ValibotSchema
  let schemaName: string

  if (leaves.length === 1) {
    const singlePreset = presetNames[0]
    schema = getStructuredPresetSchema(singlePreset as string)
    schemaName = sanitizeSchemaName(`prompt_${leaves[0]?.name ?? 'default'}`)
  } else {
    schema = composePromptObjectSchema(
      leaves.map((leaf, index) => ({
        key: leaf.name,
        schema: getStructuredPresetSchema(presetNames[index] as string)
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
    presetNames,
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
