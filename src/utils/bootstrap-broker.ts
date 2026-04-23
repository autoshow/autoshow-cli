import { ensureAssemblyAiSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/assemblyai'
import { ensureAwsSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'
import { ensureDeepgramSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deepgram/deepgram'
import { ensureDeepinfraSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deepinfra/deepinfra'
import { ensureDeapiSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deapi/deapi'
import { ensureElevenLabsSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/elevenlabs/elevenlabs'
import { ensureGcloudSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'
import { ensureGladiaSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gladia/gladia'
import { ensureGroqSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/groq/groq'
import { ensureHappyScribeSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/happyscribe'
import { ensureMistralSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/mistral/mistral'
import { ensureRevSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/rev/rev'
import { ensureSonioxSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/soniox'
import { ensureSupadataSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/supadata/supadata'
import { ensureSpeechmaticsSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/speechmatics/speechmatics'
import { ensureReverbRuntimeSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb'
import { ensureWhisperReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { ensureGlmOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { ensureGeminiOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/gemini'
import { ensureMistralOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/mistral-ocr/mistral'
import { ensureOpenAIOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/openai-ocr/openai-ocr'
import { ensureAnthropicOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/anthropic-ocr/anthropic-ocr'
import { ensureOcrmypdfSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/ocrmypdf/ocrmypdf'
import { ensurePaddleOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/paddle-ocr/paddle-ocr'
import { ensureTesseractSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/tesseract-utils'
import type { BootstrapHandler } from '~/types'

const DEFAULT_WHISPER_MODEL = 'tiny'
const cache = new Map<string, Promise<void>>()

const parseProviderToken = (
  provider: string
): { key: string, model?: string } => {
  const trimmed = provider.trim()
  if (trimmed.length === 0) {
    throw new Error('Provider name is required')
  }

  const parts = trimmed.split(':')
  const rawKey = parts[0]
  if (typeof rawKey !== 'string') {
    throw new Error('Provider name is required')
  }

  const key = rawKey.trim().toLowerCase()
  const model = parts.slice(1).join(':').trim()
  return {
    key,
    ...(model.length > 0 ? { model } : {})
  }
}

const handlers: Record<string, BootstrapHandler> = {
  whisper: {
    ensure: async (model) => await ensureWhisperReady(model ?? DEFAULT_WHISPER_MODEL)
  },
  reverb: {
    ensure: async () => await ensureReverbRuntimeSetup()
  },
  'aws-stt': {
    ensure: async () => { await ensureAwsSttSetup() }
  },
  'gcloud-stt': {
    ensure: async () => { await ensureGcloudSttSetup() }
  },
  'elevenlabs-stt': {
    ensure: async () => await ensureElevenLabsSttSetup()
  },
  'deepgram-stt': {
    ensure: async () => await ensureDeepgramSttSetup()
  },
  'deepinfra-stt': {
    ensure: async () => await ensureDeepinfraSttSetup()
  },
  'deapi-stt': {
    ensure: async () => await ensureDeapiSttSetup()
  },
  'soniox-stt': {
    ensure: async () => await ensureSonioxSttSetup()
  },
  'speechmatics-stt': {
    ensure: async () => await ensureSpeechmaticsSttSetup()
  },
  'rev-stt': {
    ensure: async () => await ensureRevSttSetup()
  },
  'groq-stt': {
    ensure: async () => await ensureGroqSttSetup()
  },
  'mistral-stt': {
    ensure: async () => await ensureMistralSttSetup()
  },
  'assemblyai-stt': {
    ensure: async () => await ensureAssemblyAiSttSetup()
  },
  'gladia-stt': {
    ensure: async () => await ensureGladiaSttSetup()
  },
  'happyscribe-stt': {
    ensure: async () => await ensureHappyScribeSttSetup()
  },
  'supadata-stt': {
    ensure: async () => await ensureSupadataSttSetup()
  },
  tesseract: {
    ensure: async () => await ensureTesseractSetup()
  },
  ocrmypdf: {
    ensure: async () => await ensureOcrmypdfSetup()
  },
  'paddle-ocr': {
    ensure: async () => await ensurePaddleOcrSetup()
  },
  'mistral-ocr': {
    ensure: async () => await ensureMistralOcrSetup()
  },
  'glm-ocr': {
    ensure: async () => await ensureGlmOcrSetup()
  },
  'openai-ocr': {
    ensure: async () => await ensureOpenAIOcrSetup()
  },
  'anthropic-ocr': {
    ensure: async () => await ensureAnthropicOcrSetup()
  },
  'gemini-ocr': {
    ensure: async () => await ensureGeminiOcrSetup()
  }
}

const resolveHandler = (provider: string): { cacheKey: string, handler: BootstrapHandler, model?: string } => {
  const { key, model } = parseProviderToken(provider)
  const handler = handlers[key]
  if (!handler) {
    throw new Error(`Unsupported bootstrap provider: ${provider}`)
  }

  return {
    cacheKey: model ? `${key}:${model}` : key,
    handler,
    ...(model ? { model } : {})
  }
}

const runCached = async (
  cacheKey: string,
  operation: () => Promise<void>
): Promise<void> => {
  let pending = cache.get(cacheKey)
  if (!pending) {
    pending = operation().catch((error) => {
      cache.delete(cacheKey)
      throw error
    })
    cache.set(cacheKey, pending)
  }

  await pending
}

export const ensureProviderReady = async (provider: string): Promise<void> => {
  const resolved = resolveHandler(provider)
  await runCached(resolved.cacheKey, async () => {
    await resolved.handler.ensure(resolved.model)
  })
}
