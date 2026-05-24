import type { CliFlagsDefinition } from '~/cli/native'
import { booleanAllProvidersFlag, sharedConcurrencyFlags, transcriptionFlags, promptFlag, batchFlags, priceFlag } from './shared-flags'

export const sttFlags = {
  ...booleanAllProvidersFlag,
  provider: {
    description: 'STT provider[=model]: whisper|reverb|deepinfra|elevenlabs|deepgram|soniox|speechmatics|rev|groq|grok|mistral|assemblyai|gladia|happyscribe|supadata|scrapecreators|openai|gemini|glm|together (default: whisper=tiny); repeatable',
    type: [String] as [StringConstructor]
  },
  ...sharedConcurrencyFlags,
  ...transcriptionFlags,
  ...promptFlag,
  ...batchFlags,
  ...priceFlag
} as const satisfies CliFlagsDefinition
