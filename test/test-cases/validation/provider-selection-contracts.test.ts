import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import {
  collectStep2ProviderSpecs,
  getStep2ProviderSelectionFlagNames
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  normalizeCommandSelectorArgs,
  normalizeCommandSelectorFlags,
  normalizeExtractPublicSelectorFlags
} from '~/cli/commands/process-steps/service-selector-normalization'
import { IMAGE_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/image-flags'
import { MUSIC_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/music-flags'
import { TTS_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/tts-flags'
import { VIDEO_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/video-flags'

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
      'scrapecreators-stt',
      'openai-stt',
      'gemini-stt',
      'glm-stt',
      'together-stt',
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
      'kimi-ocr',
      'openai-ocr',
      'anthropic-ocr',
      'gemini-ocr',
      'deepinfra-ocr',
      'aws-textract',
      'gcloud-docai'
    ])
  })

  test('target collection preserves provider ordering and deduplicates repeated models', () => {
    const sttOpts = buildOptsFromFlags(false, {
      'whisper-stt': ['base', 'base'],
      'assemblyai-stt': ['universal-3-pro', 'universal-3-pro']
    })
    const ocrSpecs = collectStep2ProviderSpecs('ocr', {
      useTesseract: true,
      openaiOcrModels: ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.4']
    })
    const ocrOpts = buildOptsFromFlags(false, {
      'tesseract-ocr': true,
      'openai-ocr': ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.4']
    })

    expect(collectSttTargets(sttOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'assemblyai:universal-3-pro',
      'whisper:base'
    ])
    expect(ocrSpecs).toEqual([
      { provider: 'tesseract', model: 'tesseract' },
      { provider: 'openai-ocr', model: 'gpt-5.4-nano' },
      { provider: 'openai-ocr', model: 'gpt-5.4' }
    ])
    expect(collectExplicitOcrTargets(ocrOpts)).toEqual([
      { service: 'tesseract', model: 'tesseract' },
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.4' }
    ])
  })

  test('--all-stt expands Supadata to auto only and excludes ScrapeCreators', () => {
    const opts = buildOptsFromFlags(false, { 'all-stt': true })
    const supadataTargets = collectSttTargets(opts).filter((target) => target.service === 'supadata')
    const scrapeCreatorsTargets = collectSttTargets(opts).filter((target) => target.service === 'scrapecreators')

    expect(supadataTargets).toEqual([{
      service: 'supadata',
      model: 'auto',
      local: false
    }])
    expect(scrapeCreatorsTargets).toEqual([])

    const explicitOpts = buildOptsFromFlags(false, {
      'scrapecreators-stt': 'youtube-transcript'
    })
    expect(collectSttTargets(explicitOpts).filter((target) => target.service === 'scrapecreators')).toEqual([{
      service: 'scrapecreators',
      model: 'youtube-transcript',
      local: false
    }])
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
    expect(allOpts.geminiImageModels).toEqual([
      'gemini-3.1-flash-image-preview',
      'imagen-4.0-fast-generate-001',
      'imagen-4.0-generate-001',
      'imagen-4.0-ultra-generate-001'
    ])
    expect(allOpts.openaiImageModels).toEqual([
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
      'minimax:music-2.6',
      'minimax:music-2.6-free',
      'deapi:AceStep_1_5_Turbo',
      'deapi:AceStep_1_5_Base',
      'deapi:AceStep_1_5_XL_Turbo_INT8',
      'gemini:lyria-3-clip-preview',
      'gemini:lyria-3-pro-preview'
    ])
  })

  test('dedicated command bare provider selectors normalize to existing runtime option keys', () => {
    const ttsNormalized = normalizeCommandSelectorFlags({
      openai: ['gpt-4o-mini-tts'],
      elevenlabs: ['eleven_v3']
    }, new Set(['openai', 'elevenlabs']), TTS_COMMAND_SELECTOR_FLAGS)
    const imageNormalized = normalizeCommandSelectorFlags({
      minimax: ['image-01'],
      glm: ['glm-image']
    }, new Set(['minimax', 'glm']), IMAGE_COMMAND_SELECTOR_FLAGS)
    const videoNormalized = normalizeCommandSelectorFlags({
      gemini: ['veo-3.1-lite-generate-preview'],
      runway: ['gen4.5']
    }, new Set(['gemini', 'runway']), VIDEO_COMMAND_SELECTOR_FLAGS)
    const musicNormalized = normalizeCommandSelectorFlags({
      minimax: ['music-2.5'],
      gemini: ['lyria-3-clip-preview']
    }, new Set(['minimax', 'gemini']), MUSIC_COMMAND_SELECTOR_FLAGS)

    const ttsOpts = buildOptsFromFlags(false, ttsNormalized.flags, [], {}, ttsNormalized.explicitFlags)
    const imageOpts = buildOptsFromFlags(false, imageNormalized.flags, [], {}, imageNormalized.explicitFlags)
    const videoOpts = buildOptsFromFlags(false, videoNormalized.flags, [], {}, videoNormalized.explicitFlags)
    const musicOpts = buildOptsFromFlags(false, musicNormalized.flags, [], {}, musicNormalized.explicitFlags)

    expect(ttsOpts.openaiTtsModels).toEqual(['gpt-4o-mini-tts'])
    expect(ttsOpts.elevenlabsTtsModels).toEqual(['eleven_v3'])
    expect(collectImageTargets(imageOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'minimax:image-01',
      'glm:glm-image'
    ])
    expect(collectVideoTargets(videoOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:veo-3.1-lite-generate-preview',
      'runway:gen4.5'
    ])
    expect(collectMusicTargets(musicOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'minimax:music-2.5',
      'gemini:lyria-3-clip-preview'
    ])

    expect(normalizeCommandSelectorArgs([
      'image',
      'a sunset',
      '--openai',
      'gpt-image-1.5',
      '--gemini=imagen-4.0-generate-001'
    ], IMAGE_COMMAND_SELECTOR_FLAGS)).toEqual([
      'image',
      'a sunset',
      '--openai-image',
      'gpt-image-1.5',
      '--gemini-image=imagen-4.0-generate-001'
    ])
  })

  test('extract bare provider selectors route to STT or OCR internal keys', () => {
    const mediaNormalized = normalizeExtractPublicSelectorFlags({
      glm: ['glm-asr-2512']
    }, new Set(['glm']), { media: true, document: false })
    const documentNormalized = normalizeExtractPublicSelectorFlags({
      glm: ['glm-ocr']
    }, new Set(['glm']), { media: false, document: true })
    const mixedDefaultNormalized = normalizeExtractPublicSelectorFlags({
      glm: [true]
    }, new Set(['glm']), { media: true, document: true })

    expect(buildOptsFromFlags(false, mediaNormalized.flags, [], {}, mediaNormalized.explicitFlags).glmSttModels).toEqual(['glm-asr-2512'])
    expect(buildOptsFromFlags(false, documentNormalized.flags, [], {}, documentNormalized.explicitFlags).glmOcrModels).toEqual(['glm-ocr'])
    const mixedDefaultOpts = buildOptsFromFlags(false, mixedDefaultNormalized.flags, [], {}, mixedDefaultNormalized.explicitFlags)
    expect(mixedDefaultOpts.glmSttModels).toEqual(['glm-asr-2512'])
    expect(mixedDefaultOpts.glmOcrModels).toEqual(['glm-ocr'])

    expect(() => normalizeExtractPublicSelectorFlags({
      glm: ['glm-ocr']
    }, new Set(['glm']), { media: true, document: true })).toThrow('--glm <model> is ambiguous')
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

    const fixedSizeOpts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-1.5'],
      'image-size': '2048x1152'
    })
    expect(() => collectImageTargets(fixedSizeOpts)).toThrow('Expected auto, 1024x1024, 1536x1024, or 1024x1536')
  })

  test('gpt-image-2 rejects transparent background', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-2'],
      'image-background': 'transparent'
    })

    expect(() => collectImageTargets(opts)).toThrow('--image-background transparent is not supported by OpenAI/gpt-image-2')
  })

  test('image-count maps only to providers with native multi-image request support', () => {
    const multiOpts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-1.5'],
      'gemini-image': ['imagen-4.0-generate-001'],
      'grok-image': ['grok-imagine-image-quality'],
      'image-count': '3'
    })
    const targets = collectImageTargets(multiOpts)
    expect(targets.map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:imagen-4.0-generate-001',
      'openai:gpt-image-1.5',
      'grok:grok-imagine-image-quality'
    ])

    for (const [flag, model, providerName] of [
      ['minimax-image', 'image-01', 'MiniMax'],
      ['glm-image', 'glm-image', 'GLM'],
      ['runway-image', 'gen4_image', 'Runway'],
      ['bfl-image', 'flux-2-pro-preview', 'BFL'],
      ['deapi-image', 'Flux1schnell', 'deAPI']
    ] as const) {
      const opts = buildOptsFromFlags(false, {
        [flag]: [model],
        'image-count': '2'
      })
      expect(() => collectImageTargets(opts)).toThrow(`${providerName}/${model}`)
    }
  })

  test('image edit/reference flags validate provider and model support', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'autoshow-image-input-'))
    const imagePath = join(tempDir, 'reference.png')
    writeFileSync(imagePath, new Uint8Array([1, 2, 3]))

    const openaiEditOpts = buildOptsFromFlags(false, {
      'openai-image': ['gpt-image-1.5'],
      'image-input': [imagePath]
    })
    try {
      expect(collectImageTargets(openaiEditOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
        'openai:gpt-image-1.5'
      ])

      const openaiUnsupportedModel = buildOptsFromFlags(false, {
        'openai-image': ['gpt-image-2'],
        'image-input': [imagePath]
      })
      expect(() => collectImageTargets(openaiUnsupportedModel)).toThrow('OpenAI/gpt-image-2')

      const minimaxEditOpts = buildOptsFromFlags(false, {
        'minimax-image': ['image-01'],
        'image-input': [imagePath]
      })
      expect(() => collectImageTargets(minimaxEditOpts)).toThrow('MiniMax/image-01')

      const missingPath = join(tempDir, 'missing.png')
      const missingInputOpts = buildOptsFromFlags(false, {
        'openai-image': ['gpt-image-1.5'],
        'image-input': [missingPath]
      })
      expect(() => collectImageTargets(missingInputOpts)).toThrow(`--image-input file "${missingPath}" does not exist`)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
