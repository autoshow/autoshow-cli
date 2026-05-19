import type { TtsConfigField } from '~/types'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'

export const logTtsConfig = (provider: string, fields: readonly TtsConfigField[]): void => {
  const rows = fields
    .filter((field) => field.value !== undefined)
    .map((field) => ({
      setting: field.label,
      value: String(field.value)
    }))

  if (rows.length === 0) {
    return
  }

  l.write('info', `${provider} TTS Config`, {
    category: 'tts',
    humanTable: createHumanTable(rows, ['setting', 'value'])
  })
}
