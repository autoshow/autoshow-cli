import * as l from '~/logger'

type TtsConfigField = {
  label: string
  value: string | number | undefined
}

export const logTtsConfig = (provider: string, fields: readonly TtsConfigField[]): void => {
  for (const field of fields) {
    if (field.value !== undefined) {
      l.info(`${provider} TTS ${field.label}: ${field.value}`)
    }
  }
}
