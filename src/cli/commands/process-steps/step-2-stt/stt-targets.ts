import type { DiarizationOptions, RuntimeOptions, TranscribeEngine } from '~/types'
import { resolveDiarizationOptions } from './run-stt'

export type SttTarget = {
  service: TranscribeEngine
  model: string
  local: boolean
  diarizationOptions?: DiarizationOptions | undefined
}

const sanitizeSegment = (value: string): string =>
  value.replace(/[/\\:*?"<>|]+/g, '_')

export const getSttTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

export const formatSttTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

export const getSttTargetDirectoryName = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${sanitizeSegment(target.service)}-${sanitizeSegment(target.model)}`

export const collectSttTargets = (options: RuntimeOptions): SttTarget[] => {
  const targets: SttTarget[] = []

  if (options.useReverb) {
    targets.push({
      service: 'reverb',
      model: 'reverb',
      local: true
    })
  }

  if (options.elevenlabsSttModel) {
    targets.push({
      service: 'elevenlabs',
      model: options.elevenlabsSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'elevenlabs')
    })
  }

  if (options.deepgramSttModel) {
    targets.push({
      service: 'deepgram',
      model: options.deepgramSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'deepgram')
    })
  }

  if (options.sonioxSttModel) {
    targets.push({
      service: 'soniox',
      model: options.sonioxSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'soniox')
    })
  }

  if (options.speechmaticsSttModel) {
    targets.push({
      service: 'speechmatics',
      model: options.speechmaticsSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'speechmatics')
    })
  }

  if (options.revSttModel) {
    targets.push({
      service: 'rev',
      model: options.revSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'rev')
    })
  }

  if (options.groqSttModel) {
    targets.push({
      service: 'groq',
      model: options.groqSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'groq')
    })
  }

  if (options.openaiSttModel) {
    targets.push({
      service: 'openai',
      model: options.openaiSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'openai')
    })
  }

  if (options.mistralSttModel) {
    targets.push({
      service: 'mistral',
      model: options.mistralSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'mistral')
    })
  }

  if (options.assemblyaiSttModel) {
    targets.push({
      service: 'assemblyai',
      model: options.assemblyaiSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'assemblyai')
    })
  }

  if (options.gladiaSttModel) {
    targets.push({
      service: 'gladia',
      model: options.gladiaSttModel,
      local: false,
      diarizationOptions: resolveDiarizationOptions(options, 'gladia')
    })
  }

  if (options.whisperExplicit || targets.length === 0) {
    targets.push({
      service: 'whisper',
      model: options.whisperModel,
      local: true
    })
  }

  return targets
}
