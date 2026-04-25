import type { Step3Metadata } from './process-types'
import type { StructuredRequestOptions } from '../cli/commands/process-steps/step-3-write/write-types'

export type TranscribeEngine = 'reverb' | 'gcloud' | 'aws' | 'deepgram' | 'deepinfra' | 'deapi' | 'elevenlabs' | 'soniox' | 'speechmatics' | 'rev' | 'groq' | 'mistral' | 'assemblyai' | 'gladia' | 'happyscribe' | 'supadata' | 'openai-stt' | 'gemini-stt' | 'glm-stt' | 'together' | 'fireworks' | 'cloudflare' | 'whisper' | 'youtube-captions'

export type ProviderTargetBase<TService> = {
  service: TService
  model: string
}

export type LLMTarget = ProviderTargetBase<Step3Metadata['llmService']> & {
  label: string
  run: (prompt: string, model: string, structuredOpts?: StructuredRequestOptions) => Promise<{ result: string; metadata: Step3Metadata }>
}

export type { ZipEntry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-types'
