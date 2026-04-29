import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import {
  collectStep2ProviderSpecs,
  getStep2ProviderSelectionFlagNames,
  normalizeStep2ArgvAliases
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

describe('provider selection contracts', () => {
  test('STT provider canonical ordering is stable', () => {
    expect(getStep2ProviderSelectionFlagNames('stt')).toEqual([
      'reverb-stt',
      'gcloud-stt',
      'aws-stt',
      'deepinfra-stt',
      'deapi-stt',
      'elevenlabs-stt',
      'deepgram-stt',
      'soniox-stt',
      'speechmatics-stt',
      'rev-stt',
      'groq-stt',
      'grok-stt',
      'mistral-stt',
      'assemblyai-stt',
      'gladia-stt',
      'happyscribe-stt',
      'supadata-stt',
      'openai-stt',
      'gemini-stt',
      'glm-stt',
      'together-stt',
      'fireworks-stt',
      'cloudflare-stt',
      'whisper-stt'
    ])
  })

  test('OCR provider canonical ordering is stable', () => {
    expect(getStep2ProviderSelectionFlagNames('ocr')).toEqual([
      'tesseract-ocr',
      'ocrmypdf',
      'paddle-ocr',
      'mistral-ocr',
      'glm-ocr',
      'openai-ocr',
      'anthropic-ocr',
      'gemini-ocr',
      'deepinfra-ocr',
      'aws-textract',
      'gcloud-docai',
      'deapi-ocr'
    ])
  })

  test('legacy aliases normalize to canonical provider flags', () => {
    expect(normalizeStep2ArgvAliases(['extract', 'file.mp3', '--whisper', 'base', '--tesseract'])).toEqual([
      'extract',
      'file.mp3',
      '--whisper-stt',
      'base',
      '--tesseract-ocr'
    ])
  })

  test('target collection preserves provider ordering and deduplicates repeated models', () => {
    const sttOpts = buildOptsFromFlags(false, {
      'whisper-stt': ['base', 'base'],
      'assemblyai-stt': ['universal-3-pro', 'universal-3-pro']
    })
    const ocrSpecs = collectStep2ProviderSpecs('ocr', {
      useTesseract: true,
      openaiOcrModels: ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.4-mini']
    })
    const ocrOpts = buildOptsFromFlags(false, {
      'tesseract-ocr': true,
      'openai-ocr': ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.4-mini']
    })

    expect(collectSttTargets(sttOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'assemblyai:universal-3-pro',
      'whisper:base'
    ])
    expect(ocrSpecs).toEqual([
      { provider: 'tesseract', model: 'tesseract' },
      { provider: 'openai-ocr', model: 'gpt-5.4-nano' },
      { provider: 'openai-ocr', model: 'gpt-5.4-mini' }
    ])
    expect(collectExplicitOcrTargets(ocrOpts)).toEqual([
      { service: 'tesseract', model: 'tesseract' },
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.4-mini' }
    ])
  })

  test('BFL/deAPI image and deAPI video flags select targets and participate in all-provider shortcuts', () => {
    const explicitOpts = buildOptsFromFlags(false, {
      'bfl-image': ['flux-2-pro-preview'],
      'deapi-image': ['Flux1schnell'],
      'deapi-video': ['Ltxv_13B_0_9_8_Distilled_FP8']
    })

    expect(explicitOpts.bflImageModels).toEqual(['flux-2-pro-preview'])
    expect(explicitOpts.deapiImageModels).toEqual(['Flux1schnell'])
    expect(explicitOpts.deapiVideoModels).toEqual(['Ltxv_13B_0_9_8_Distilled_FP8'])
    expect(collectImageTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'bfl:flux-2-pro-preview',
      'deapi:Flux1schnell'
    ])
    expect(collectVideoTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'deapi:Ltxv_13B_0_9_8_Distilled_FP8'
    ])

    const allOpts = buildOptsFromFlags(false, {
      'all-image': true,
      'all-video': true
    })

    expect(allOpts.geminiVideoModels).toEqual([
      'veo-3.1-fast-generate-preview',
      'veo-3.1-generate-preview',
      'veo-3.1-lite-generate-preview'
    ])
    expect(allOpts.openaiImageModels).toEqual([
      'gpt-image-1-mini',
      'gpt-image-1',
      'gpt-image-1.5',
      'gpt-image-2'
    ])
    expect(allOpts.bflImageModels).toEqual([
      'flux-2-klein-4b',
      'flux-2-klein-9b-preview',
      'flux-2-klein-9b',
      'flux-2-pro-preview',
      'flux-2-pro',
      'flux-2-max',
      'flux-2-flex'
    ])
    expect(allOpts.deapiImageModels).toEqual([
      'Flux1schnell',
      'ZImageTurbo_INT8',
      'Flux_2_Klein_4B_BF16'
    ])
    expect(allOpts.deapiVideoModels).toEqual([
      'Ltxv_13B_0_9_8_Distilled_FP8',
      'Ltx2_19B_Dist_FP8',
      'Ltx2_3_22B_Dist_INT8'
    ])
  })

  test('Gemini music flag selects targets and participates in all-music shortcut', () => {
    const explicitOpts = buildOptsFromFlags(false, {
      'gemini-music': ['lyria-3-clip-preview', 'lyria-3-pro-preview']
    })

    expect(explicitOpts.geminiMusicModels).toEqual([
      'lyria-3-clip-preview',
      'lyria-3-pro-preview'
    ])
    expect(collectMusicTargets(explicitOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:lyria-3-clip-preview',
      'gemini:lyria-3-pro-preview'
    ])

    const allOpts = buildOptsFromFlags(false, {
      'all-music': true
    })

    expect(allOpts.geminiMusicModels).toEqual([
      'lyria-3-clip-preview',
      'lyria-3-pro-preview'
    ])
    expect(collectMusicTargets(allOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'elevenlabs:music_v1',
      'minimax:music-2.5',
      'deapi:AceStep_1_5_Turbo',
      'deapi:AceStep_1_5_Base',
      'deapi:AceStep_1_5_XL_Turbo_INT8',
      'gemini:lyria-3-clip-preview',
      'gemini:lyria-3-pro-preview'
    ])
  })

  test('gpt-image-2 accepts flexible valid OpenAI image sizes', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'image-size': '2048x1152'
    })

    expect(collectImageTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'openai:gpt-image-2'
    ])
  })

  test('OpenAI image size validation is model-specific', () => {
    for (const invalidSize of ['1025x1024', '4096x1024', '3840x1024', '800x800', '3840x3840']) {
      const opts = buildOptsFromFlags(false, {
        'openai-image': ['gpt-image-2'],
        'image-size': invalidSize
      })
      expect(() => collectImageTargets(opts)).toThrow(`Invalid --image-size value "${invalidSize}" for gpt-image-2`)
    }

    const legacyOpts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-1'],
      'image-size': '2048x1152'
    })
    expect(() => collectImageTargets(legacyOpts)).toThrow('Expected auto, 1024x1024, 1536x1024, or 1024x1536')
  })

  test('gpt-image-2 rejects transparent background', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'image-background': 'transparent'
    })

    expect(() => collectImageTargets(opts)).toThrow('--image-background transparent is not supported by gpt-image-2')
  })
})
