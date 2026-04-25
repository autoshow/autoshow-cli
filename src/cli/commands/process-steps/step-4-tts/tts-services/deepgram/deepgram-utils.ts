import * as v from 'valibot'
import { validateDataSafe } from '~/utils/validate/validation'

const DeepgramErrorSchema = v.object({
  err_code: v.optional(v.string(), undefined),
  err_msg: v.optional(v.string(), undefined),
  message: v.optional(v.string(), undefined),
  error: v.optional(v.union([
    v.string(),
    v.object({
      message: v.optional(v.string(), undefined)
    })
  ]), undefined)
})

export const readDeepgramError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  if (!raw.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const validated = validateDataSafe(DeepgramErrorSchema, parsed, 'Deepgram TTS error response')
    if (!validated) {
      return raw
    }

    if (typeof validated.err_msg === 'string' && validated.err_msg.trim().length > 0) {
      return validated.err_msg
    }
    if (typeof validated.message === 'string' && validated.message.trim().length > 0) {
      return validated.message
    }
    if (typeof validated.error === 'string' && validated.error.trim().length > 0) {
      return validated.error
    }
    if (
      typeof validated.error === 'object'
      && validated.error !== null
      && typeof validated.error.message === 'string'
      && validated.error.message.trim().length > 0
    ) {
      return validated.error.message
    }
    if (typeof validated.err_code === 'string' && validated.err_code.trim().length > 0) {
      return validated.err_code
    }
    return raw
  } catch {
    return raw
  }
}
