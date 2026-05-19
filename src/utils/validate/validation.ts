import * as v from 'valibot'
import * as l from '~/utils/logger'
import { AppError } from '~/utils/error-handler'

const formatValidationIssues = (issues: { nested?: unknown }): string => {
  const nested = issues.nested
  if (nested === undefined) {
    return 'unknown validation error'
  }

  if (typeof nested === 'string') {
    return nested
  }

  return JSON.stringify(nested)
}

export const validateData = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  data: unknown,
  context: string
): v.InferOutput<T> => {
  const result = v.safeParse(schema, data)

  if (!result.success) {
    l.error(`Validation failed for ${context}`)
    throw new AppError(`Invalid data structure for ${context}: ${formatValidationIssues(v.flatten(result.issues))}`, {
      kind: 'validation',
      metadata: {
        context,
        issues: v.flatten(result.issues)
      }
    })
  }

  return result.output
}

export const validateDataSafe = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  data: unknown
): v.InferOutput<T> | null => {
  const result = v.safeParse(schema, data)

  if (!result.success) {
    return null
  }

  return result.output
}

export const validateJson = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  jsonString: string,
  context: string
): v.InferOutput<T> => {
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonString)
  } catch (error) {
    l.error(`JSON parsing failed for ${context}`, error)
    throw new AppError(`Invalid JSON for ${context}`, {
      kind: 'validation',
      cause: error instanceof Error ? error : new Error(String(error)),
      metadata: {
        context,
        rawResponse: jsonString
      }
    })
  }

  return validateData(schema, parsed, context)
}
