import type * as v from 'valibot'
import type { Step3Metadata } from '~/types'

export type JsonSchemaObject = Record<string, unknown>

export type StructuredMode = 'native' | 'compat' | 'off'

export type StructuredRequestOptions = {
  schemaName: string
  schema: JsonSchemaObject
  strict: boolean
  modeHint: Exclude<StructuredMode, 'off'>
}

export type StructuredResult = {
  parsed: unknown
  renderedText: string
  structuredMode: Exclude<StructuredMode, 'off'>
  presetNames: string[]
}

export type StructuredRunResult = {
  metadata: Step3Metadata
  renderedText: string
  parsedJson: unknown
}

export type StructuredValidationFailureEnvelope = {
  _raw: string
  _validationError: string
}

export type ValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export type ResolvedStructuredSchema = {
  schemaName: string
  leafPromptNames: string[]
  presetNames: string[]
  schema: ValibotSchema
  jsonSchema: JsonSchemaObject
}

export type ProviderStructuredCapability = {
  nativeStructuredOutput: boolean
  strictMode: boolean
}

export type StructuredValidationResult = {
  success: boolean
  value?: unknown
  issue?: string
}
