import type { CliFlagDefinition, CliFlagsDefinition } from '~/cli/native'
import {
  batchFlags,
  promptFlag
} from './shared-flags'
import { ocrCommandFlags } from './ocr-flags'
import { sttFlags } from './stt-flags'
import { TTS_COMMAND_SELECTOR_FLAGS, ttsFlags } from './tts-flags'
import { IMAGE_COMMAND_SELECTOR_FLAGS, imageGenFlags } from './image-flags'
import { VIDEO_COMMAND_SELECTOR_FLAGS, videoGenFlags } from './video-flags'
import { MUSIC_COMMAND_SELECTOR_FLAGS, musicGenFlags } from './music-flags'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from '~/cli/commands/process-steps/service-selector-normalization'
import { getStep2ProviderEntry } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const omitFlags = (
  flags: CliFlagsDefinition,
  omittedKeys: readonly string[]
): CliFlagsDefinition => {
  const omitted = new Set(omittedKeys)
  return Object.fromEntries(
    Object.entries(flags).filter(([name]) => !omitted.has(name))
  ) as CliFlagsDefinition
}

const hideFlag = (definition: CliFlagDefinition): CliFlagDefinition => ({
  ...definition,
  help: {
    ...(definition.help ?? {}),
    hidden: true
  }
})

const modelSelectorDefinition = (name: string): CliFlagDefinition => ({
  description: `Target-aware resume provider/model selector for --${name}`,
  type: [String] as [StringConstructor],
  help: { hidden: true }
})

const extractPublicSelectorHasModel = (publicName: string): boolean => {
  const target = EXTRACT_PUBLIC_SELECTOR_FLAGS[publicName as keyof typeof EXTRACT_PUBLIC_SELECTOR_FLAGS]
  return [target?.stt, target?.ocr].some((flagName) => {
    const entry = typeof flagName === 'string' ? getStep2ProviderEntry(flagName) : undefined
    return entry?.selection.type === 'models'
  })
}

const buildPublicSelectorFlags = (): CliFlagsDefinition => {
  const ttsPublicNames = Object.values(TTS_COMMAND_SELECTOR_FLAGS) as readonly string[]
  const imagePublicNames = Object.values(IMAGE_COMMAND_SELECTOR_FLAGS) as readonly string[]
  const videoPublicNames = Object.values(VIDEO_COMMAND_SELECTOR_FLAGS) as readonly string[]
  const musicPublicNames = Object.values(MUSIC_COMMAND_SELECTOR_FLAGS) as readonly string[]
  const publicNames = new Set([
    ...ttsPublicNames,
    ...imagePublicNames,
    ...videoPublicNames,
    ...musicPublicNames,
    ...Object.keys(EXTRACT_PUBLIC_SELECTOR_FLAGS)
  ])

  const flags: CliFlagsDefinition = {}
  for (const publicName of publicNames) {
    if (extractPublicSelectorHasModel(publicName)
      || ttsPublicNames.includes(publicName)
      || imagePublicNames.includes(publicName)
      || videoPublicNames.includes(publicName)
      || musicPublicNames.includes(publicName)) {
      flags[publicName] = modelSelectorDefinition(publicName)
      continue
    }

    const extractTarget = EXTRACT_PUBLIC_SELECTOR_FLAGS[publicName as keyof typeof EXTRACT_PUBLIC_SELECTOR_FLAGS]
    const extractEntry = extractTarget?.stt
      ? getStep2ProviderEntry(extractTarget.stt)
      : extractTarget?.ocr
        ? getStep2ProviderEntry(extractTarget.ocr)
        : undefined
    flags[publicName] = hideFlag((extractEntry?.flag ?? {
      description: `Target-aware resume provider selector for --${publicName}`,
      type: Boolean,
      default: false,
      negatable: false
    }) as CliFlagDefinition)
  }

  return flags
}

const resumeSttFlags = omitFlags(sttFlags, [
  'batch-limit',
  'batch-all',
  'batch-order',
  'price'
])

const resumeOcrFlags = omitFlags(ocrCommandFlags, [
  'batch-limit',
  'batch-all',
  'batch-order',
  'all-url',
  'url-backend',
  'url-provider-concurrency',
  'url-request-timeout-ms',
  'url-request-attempts',
  'primary-ocr',
  'price'
])

const resumeTtsFlags = omitFlags(ttsFlags, ['price'])
const resumeImageFlags = omitFlags(imageGenFlags, ['price'])
const resumeVideoFlags = omitFlags(videoGenFlags, ['price'])
const resumeMusicFlags = omitFlags(musicGenFlags, ['price'])

const resumePublicSelectorFlags = buildPublicSelectorFlags()

export const resumeFlags = {
  ...resumePublicSelectorFlags,
  ...resumeSttFlags,
  ...promptFlag,
  'batch-concurrency': batchFlags['batch-concurrency'],
  ...resumeOcrFlags,
  ...resumeTtsFlags,
  ...resumeImageFlags,
  ...resumeVideoFlags,
  ...resumeMusicFlags
} as const satisfies CliFlagsDefinition
