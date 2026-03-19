import * as v from 'valibot'
import * as l from '~/logger'

export const validateData = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  data: unknown,
  context: string
): v.InferOutput<T> => {
  const result = v.safeParse(schema, data)

  if (!result.success) {
    l.error(`Validation failed for ${context}`)
    throw new Error(`Invalid data structure for ${context}: ${v.flatten(result.issues).nested}`)
  }

  return result.output
}

export const validateDataSafe = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  data: unknown,
  _context: string
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
    throw new Error(`Invalid JSON for ${context}`)
  }

  return validateData(schema, parsed, context)
}
