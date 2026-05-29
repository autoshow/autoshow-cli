import * as v from 'valibot'
import { validateDataSafe } from '~/utils/validate/validation'

const ElevenLabsErrorSchema = v.object({
  detail: v.optional(v.union([
    v.string(),
    v.object({
      message: v.optional(v.string(), undefined)
    })
  ]), undefined),
  message: v.optional(v.string(), undefined),
  error: v.optional(v.string(), undefined)
})

export const readElevenLabsError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  if (!raw.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const validated = validateDataSafe(ElevenLabsErrorSchema, parsed)
    if (!validated) {
      return raw
    }

    if (typeof validated.detail === 'string' && validated.detail.trim().length > 0) {
      return validated.detail
    }
    if (validated.detail && typeof validated.detail === 'object' && typeof validated.detail.message === 'string') {
      return validated.detail.message
    }
    if (typeof validated.message === 'string' && validated.message.trim().length > 0) {
      return validated.message
    }
    if (typeof validated.error === 'string' && validated.error.trim().length > 0) {
      return validated.error
    }

    return raw
  } catch {
    return raw
  }
}
