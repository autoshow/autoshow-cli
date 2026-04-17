import type { TtsConfigField } from '~/types'
import * as l from '~/logger'

export const logTtsConfig = (provider: string, fields: readonly TtsConfigField[]): void => {
  for (const field of fields) {
    if (field.value !== undefined) {
      l.info(`${provider} TTS ${field.label}: ${field.value}`)
    }
  }
}
