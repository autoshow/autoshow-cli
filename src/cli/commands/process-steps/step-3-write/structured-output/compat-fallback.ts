import * as l from '~/logger'
import type { LLMTarget, Step3Metadata } from '~/types'
import type { ResolvedStructuredSchema, StructuredRequestOptions } from './types'
import { parseAndValidateStructured } from './validator'
import { buildStructuredInstructionSuffix } from './schema-resolver'

const buildCompatPrompt = (prompt: string, schema: ResolvedStructuredSchema): string => {
  return [
    prompt,
    '',
    'Structured JSON requirements:',
    buildStructuredInstructionSuffix(schema.leafPromptNames),
    'JSON schema:',
    JSON.stringify(schema.jsonSchema, null, 2)
  ].join('\n')
}

export type CompatStructuredResponse = {
  parsedJson: unknown
  rawResponse: string
  metadata: Step3Metadata
}

export const runCompatFallback = async (
  target: LLMTarget,
  prompt: string,
  model: string,
  schema: ResolvedStructuredSchema,
  retryBudget: number
): Promise<CompatStructuredResponse> => {
  const compatPrompt = buildCompatPrompt(prompt, schema)
  const requestOptions: StructuredRequestOptions = {
    schemaName: schema.schemaName,
    schema: schema.jsonSchema,
    strict: false,
    modeHint: 'compat'
  }

  const maxAttempts = retryBudget + 1
  let lastIssue = 'Unknown compat failure'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await target.run(compatPrompt, model, requestOptions)
    const validated = parseAndValidateStructured(schema.schema, response.result)

    if (validated.success) {
      return {
        parsedJson: validated.value,
        rawResponse: response.result,
        metadata: response.metadata
      }
    }

    lastIssue = validated.issue ?? 'Unknown compat validation failure'
    if (attempt < maxAttempts) {
      l.warn(`Structured compat retry ${attempt}/${maxAttempts - 1} for ${target.label}/${model}: ${lastIssue}`)
    }
  }

  throw new Error(`Structured compat mode failed for ${target.label}/${model}: ${lastIssue}`)
}
