import { basename } from 'node:path'

export const REVERB_ASR_MODEL_ID = 'reverb_asr_v1'

const REVERB_ASR_MODEL_TOKEN_PATTERN = /(?:^|[/\\\s|])reverb_asr_v1(?:\.pt)?(?:$|[/\\\s|])/

export const resolveReverbModelLabel = (model: string): string => {
  const trimmed = model.trim()
  const primary = trimmed.split(' | ')[0]?.trim() ?? trimmed
  const primaryBase = basename(primary)

  if (
    trimmed === 'reverb'
    || REVERB_ASR_MODEL_TOKEN_PATTERN.test(trimmed)
    || primaryBase === REVERB_ASR_MODEL_ID
    || primaryBase === `${REVERB_ASR_MODEL_ID}.pt`
  ) {
    return REVERB_ASR_MODEL_ID
  }

  return trimmed
}
