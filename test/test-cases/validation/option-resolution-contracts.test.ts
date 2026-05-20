import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { buildExpectedFilesList } from '~/cli/commands/process-steps/step-1-download/targets/expected-output'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { runOcrProviderTargetPools, isLocalOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { runLlmProviderTargetPools, isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import {
  buildComicPagePrompt,
  buildComicPagePromptData,
  chunkComicGridPanels,
  chunkComicPagePanels,
  DEFAULT_PANELS_PER_IMAGE,
  parseComicGridSpec,
  panelSelectionToSketchRange,
  parsePanelSelector,
  selectComicPanels
} from '~/cli/commands/process-steps/step-8-comic/commands/generate-images/comic-page-utils'
import { applyImagePromptVariation } from '~/cli/commands/process-steps/step-8-comic/commands/generate-images/prompt-variations'
import {
  buildSketchPrompt,
  resolveSketchChunks,
  selectSketchPanelRange
} from '~/cli/commands/process-steps/step-8-comic/commands/generate-sketches/generate-scene-sketches'
import { parseDraftScenesArgs, parseGenerateImagesArgs } from '~/cli/commands/process-steps/step-8-comic/utils/cli-args'
import { LLM_MODELS } from '~/cli/commands/process-steps/step-8-comic/models/model-registry'
import {
  getPageComicImageFilename,
  getPageComicImagePath,
  getPanelComicImagePath
} from '~/cli/commands/process-steps/step-8-comic/utils/scene-utils'
import {
  resolveComicScriptReference
} from '~/cli/commands/process-steps/step-8-comic/utils/project-paths'
import { buildExtractionCallOpts } from '~/cli/commands/process-steps/step-1-download/targets/single/document-write'
import { validateDeapiTtsReferenceAudio } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/run-deapi-tts'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/run-elevenlabs-tts'
import {
  createElevenLabsTtsIvcContext,
  ELEVENLABS_TTS_IVC_SETUP_MS,
  validateElevenLabsTtsIvcAudio
} from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-ivc'
import {
  ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS,
  runElevenLabsTtsPvcSetup,
  validateElevenLabsTtsPvcAudio,
  validateElevenLabsTtsPvcSamples,
  writeElevenLabsTtsPvcStatusArtifact
} from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-pvc'
import { runOpenAITts } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/run-openai-tts'
import {
  createOpenAITtsCustomVoiceContext,
  OPENAI_TTS_CLONE_SETUP_MS,
  validateOpenAITtsCustomVoiceAudio
} from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/openai-custom-voices'
import {
  SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS
} from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  GCLOUD_DEFAULT_TTS_VOICES,
  getGroqDefaultTtsVoiceForModel,
  DEEPGRAM_DEFAULT_VOICE,
  GROK_DEFAULT_TTS_VOICE,
  SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import type { LLMTarget, OcrTarget, Step3Metadata } from '~/types'
import type { ExpandedScenePromptData, PromptsConfig } from '~/cli/commands/process-steps/step-8-comic/types'

const SHORT_AUDIO_URL = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'
const LOCAL_SHORT_AUDIO_PATH = join('input/examples/audio', '0-audio-short.mp3')
const REMOVED_GROQ_TTS_MODEL = ['canopylabs/orpheus', 'arabic-saudi'].join('-')
const REMOVED_GROQ_TTS_VOICE = ['no', 'ura'].join('')

describe('option resolution contracts', () => {
  test('comic generate-images args parse page image options', () => {
    const opts = parseGenerateImagesArgs([
      'input/episode-scripts/02-script/01-co-work-smarter.md',
      '--image-model', 'gpt-image-2,gemini-3.1-flash-image-preview',
      '--panels', '1-4,9',
      '--panels-per-image', String(DEFAULT_PANELS_PER_IMAGE),
      '--variation', 'animation-polish,cinematic-depth',
      '--size', '1536x1024',
      '--quality', 'high',
      '--force'
    ])

    expect(opts.scriptPath).toBe('input/episode-scripts/02-script/01-co-work-smarter.md')
    expect(opts.imageModels).toEqual(['gpt-image-2', 'gemini-3.1-flash-image-preview'])
    expect(opts.panels).toEqual([1, 2, 3, 4, 9])
    expect(opts.panelsPerImage).toBe(DEFAULT_PANELS_PER_IMAGE)
    expect(opts.variations).toEqual(['animation-polish', 'cinematic-depth'])
    expect(opts.size).toBe('1536x1024')
    expect(opts.quality).toBe('high')
    expect(opts.force).toBe(true)
  })

  test('comic generate-images args parse grid page composition options', () => {
    const opts = parseGenerateImagesArgs([
      'input/episode-scripts/02-script/01-co-work-smarter.md',
      '--target', 'images',
      '--panels', '1-6',
      '--panels-per-image', '1',
      '--grid', '2x3',
      '--size', '1536x1024',
    ])

    expect(opts.grid).toEqual({ columns: 2, rows: 3 })
    expect(opts.panelsPerImage).toBe(1)
  })

  test('comic generate-images grid args reject invalid values and combinations', () => {
    expect(() => parseComicGridSpec('2x3')).not.toThrow()
    expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '0x3'])).toThrow('Invalid grid "0x3"')
    expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '2x3', '--grid', '3x2'])).toThrow('Grid can only be specified once')
    expect(() => parseGenerateImagesArgs(['script.md', '--target', 'sketches', '--panels-per-image', '1', '--grid', '2x3'])).toThrow('--grid only applies when --target is images or both')
    expect(() => parseGenerateImagesArgs(['script.md', '--grid', '2x3'])).toThrow('--grid requires --panels-per-image 1')
    expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '2x3', '--size', '1024x1024'])).toThrow('--grid requires --size 1536x1024')
  })

  test('comic generate-images removed options throw deprecation errors', () => {
    expect(() => parseGenerateImagesArgs(['script.md', '--panel-limit', '3'])).toThrow('--panel-limit was removed')
    expect(() => parseGenerateImagesArgs(['script.md', '--panel', '2'])).toThrow('--panel was removed')
    expect(() => parseGenerateImagesArgs(['script.md', '--chunk', '2'])).toThrow('--chunk was removed')
    expect(() => parseGenerateImagesArgs(['script.md', '--sketch-group-size', '8'])).toThrow('--sketch-group-size was removed')
    expect(() => parseGenerateImagesArgs(['script.md', '--sketch-panels', '1-4'])).toThrow('--sketch-panels was removed')
  })

  test('comic generate-images variation args reject duplicates and unknown values', () => {
    expect(() => parseGenerateImagesArgs(['script.md', '--variation', 'animation-polish,animation-polish'])).toThrow('Duplicate variation "animation-polish" is not allowed')
    expect(() => parseGenerateImagesArgs(['script.md', '--variation', 'unknown'])).toThrow('Invalid variation "unknown"')
  })

  test('comic draft-scenes args parse llm model and panel prompt stage', () => {
    const opts = parseDraftScenesArgs([
      'input/episode-scripts/05-script/01-paddy-goes-on-vacation.md',
      '--llm-model', LLM_MODELS[0],
      '--only', 'panel-prompts',
    ])

    expect(opts.scriptPath).toBe('input/episode-scripts/05-script/01-paddy-goes-on-vacation.md')
    expect(opts.llmModel).toBe(LLM_MODELS[0])
    expect(opts.only).toBe('panel-prompts')
  })

  test('comic generate-images args parse target', () => {
    const opts = parseGenerateImagesArgs([
      'input/episode-scripts/05-script/01-paddy-goes-on-vacation.md',
      '--target', 'sketches',
      '--panels-per-image', String(DEFAULT_PANELS_PER_IMAGE),
      '--quality', 'high',
    ])

    expect(opts.scriptPath).toBe('input/episode-scripts/05-script/01-paddy-goes-on-vacation.md')
    expect(opts.target).toBe('sketches')
    expect(opts.panelsPerImage).toBe(DEFAULT_PANELS_PER_IMAGE)
    expect(opts.quality).toBe('high')
    expect(() => parseGenerateImagesArgs(['script.md', '--target', 'prompts'])).toThrow(
      'bun as comic draft-scenes <script-path> --only panel-prompts'
    )
  })

  test('comic generate-images args parse page image options with target', () => {
    const opts = parseGenerateImagesArgs([
      'input/episode-scripts/02-script/01-co-work-smarter.md',
      '--target', 'images',
      '--panels', '1-6',
      '--panels-per-image', String(DEFAULT_PANELS_PER_IMAGE),
      '--image-model', 'gpt-image-2',
      '--size', '1536x1024',
      '--quality', 'high',
      '--force'
    ])

    expect(opts.scriptPath).toBe('input/episode-scripts/02-script/01-co-work-smarter.md')
    expect(opts.target).toBe('images')
    expect(opts.panels).toEqual([1, 2, 3, 4, 5, 6])
    expect(opts.panelsPerImage).toBe(DEFAULT_PANELS_PER_IMAGE)
    expect(opts.imageModels).toEqual(['gpt-image-2'])
    expect(opts.size).toBe('1536x1024')
    expect(opts.quality).toBe('high')
    expect(opts.force).toBe(true)
  })

  test('comic script shorthand resolves only strict NN-SC references', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-comic-script-ref-'))
    const episodeDir = join(tempDir, '02-script')
    const fullPath = 'input/episode-scripts/02-script/01-co-work-smarter.md'

    try {
      await mkdir(episodeDir, { recursive: true })
      await writeFile(join(episodeDir, '01-co-work-smarter.md'), '# Co-Work Smarter\n')

      expect(parseDraftScenesArgs(['02-01']).scriptPath).toBe('02-01')
      expect(parseGenerateImagesArgs(['02-01']).scriptPath).toBe('02-01')
      await expect(resolveComicScriptReference('02-01', { episodeScriptsRoot: tempDir }))
        .resolves.toBe(join(episodeDir, '01-co-work-smarter.md'))
      await expect(resolveComicScriptReference(fullPath, { episodeScriptsRoot: tempDir }))
        .resolves.toBe(fullPath)
      await expect(resolveComicScriptReference('2-1', { episodeScriptsRoot: tempDir }))
        .resolves.toBe('2-1')
      await expect(resolveComicScriptReference('02-02', { episodeScriptsRoot: tempDir }))
        .rejects.toThrow('Comic script shorthand "02-02" could not be resolved')

      await writeFile(join(episodeDir, '01-alt.md'), '# Alternate Scene\n')

      await expect(resolveComicScriptReference('02-01', { episodeScriptsRoot: tempDir }))
        .rejects.toThrow('Expected exactly one Markdown file')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('comic panel selectors dedupe, sort, and chunk page groups', () => {
    expect(parsePanelSelector('all')).toBe('all')
    expect(parsePanelSelector('3,1,3,2-4')).toEqual([1, 2, 3, 4])

    const selected = selectComicPanels(
      [1, 2, 3, 4, 5].map(panelNumber => ({ panelNumber })),
      parsePanelSelector('1-4'),
      undefined,
      'ep02/scene'
    )
    const chunks = chunkComicPagePanels(selected, 2)

    expect(selected.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4])
    expect(chunks.map(chunk => ({
      pageNumber: chunk.pageNumber,
      panelNumbers: chunk.panelNumbers
    }))).toEqual([
      { pageNumber: 1, panelNumbers: [1, 2] },
      { pageNumber: 2, panelNumbers: [3, 4] }
    ])
  })

  test('comic grid chunks preserve selected panel order and full grid capacity', () => {
    const grid = { columns: 2, rows: 3 }
    const exact = chunkComicGridPanels(
      Array.from({ length: 6 }, (_, index) => ({ panelNumber: index + 1 })),
      grid
    )
    const fewer = chunkComicGridPanels(
      [1, 2, 3, 4].map(panelNumber => ({ panelNumber })),
      grid
    )
    const more = chunkComicGridPanels(
      Array.from({ length: 8 }, (_, index) => ({ panelNumber: index + 1 })),
      grid
    )
    const nonContiguous = chunkComicGridPanels(
      [1, 3, 7, 9, 11, 13, 15].map(panelNumber => ({ panelNumber })),
      grid
    )

    expect(exact.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4, 5, 6]])
    expect(fewer.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4]])
    expect(more.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4, 5, 6], [7, 8]])
    expect(nonContiguous.map(chunk => ({
      pageNumber: chunk.pageNumber,
      panelNumbers: chunk.panelNumbers,
    }))).toEqual([
      { pageNumber: 1, panelNumbers: [1, 3, 7, 9, 11, 13] },
      { pageNumber: 2, panelNumbers: [15] },
    ])
  })

  test('comic sketch chunks default to six panels per image', () => {
    const panels = Array.from({ length: 13 }, (_, index) => ({ panelNumber: index + 1 }))
    const defaultChunks = resolveSketchChunks(panels, {}, 'ep02/scene')
    const selectedChunks = resolveSketchChunks(
      panels,
      {
        sketchPanels: { startPanelNumber: 1, endPanelNumber: 12 },
        panelsPerImage: DEFAULT_PANELS_PER_IMAGE,
      },
      'ep02/scene'
    )

    expect(defaultChunks.selectedChunks.map(chunk => [
      chunk.startPanelNumber,
      chunk.endPanelNumber
    ])).toEqual([
      [1, 6],
      [7, 12],
      [13, 13],
    ])
    expect(selectedChunks.selectedChunks.map(chunk => [
      chunk.startPanelNumber,
      chunk.endPanelNumber
    ])).toEqual([
      [1, 6],
      [7, 12],
    ])
  })

  test('comic panel selectors clamp overlong contiguous ranges to available overlap', () => {
    const panels = Array.from({ length: 11 }, (_, index) => ({ panelNumber: index + 1 }))

    const selected = selectComicPanels(
      panels,
      parsePanelSelector('9-16'),
      undefined,
      'ep02/scene'
    )
    const sketchChunk = selectSketchPanelRange(
      panels,
      { startPanelNumber: 9, endPanelNumber: 16 },
      'ep02/scene'
    )

    expect(selected.map(panel => panel.panelNumber)).toEqual([9, 10, 11])
    expect(sketchChunk.startPanelNumber).toBe(9)
    expect(sketchChunk.endPanelNumber).toBe(11)
    expect(sketchChunk.panels.map(panel => panel.panelNumber)).toEqual([9, 10, 11])
  })

  test('comic panel selectors reject no-overlap and non-contiguous missing selections', () => {
    const panels = Array.from({ length: 11 }, (_, index) => ({ panelNumber: index + 1 }))
    const gappedPanels = [1, 2, 4, 5].map(panelNumber => ({ panelNumber }))

    expect(() => selectComicPanels(
      panels,
      parsePanelSelector('12-16'),
      undefined,
      'ep02/scene'
    )).toThrow('Selected panels 12, 13, 14, 15, 16 were not found')
    expect(() => selectComicPanels(
      gappedPanels,
      parsePanelSelector('1-5'),
      undefined,
      'ep02/scene'
    )).toThrow('Selected panel 3 was not found')
    expect(() => selectComicPanels(
      panels,
      parsePanelSelector('1,99'),
      undefined,
      'ep02/scene'
    )).toThrow('Selected panel 99 was not found')
    expect(() => selectSketchPanelRange(
      gappedPanels,
      { startPanelNumber: 1, endPanelNumber: 5 },
      'ep02/scene'
    )).toThrow('Sketch panel range "1-5" was not found')
    expect(() => selectSketchPanelRange(
      panels,
      { startPanelNumber: 12, endPanelNumber: 16 },
      'ep02/scene'
    )).toThrow('Sketch panel range "12-16" was not found')
    expect(() => panelSelectionToSketchRange(parsePanelSelector('1,99'))).toThrow(
      'Sketch panel selection must be contiguous'
    )
  })

  test('comic page image filenames preserve contiguous and non-contiguous panel labels', () => {
    expect(getPageComicImageFilename(1, [1, 2, 3, 4])).toBe('page-01-panels-01-04.png')
    expect(getPageComicImageFilename(2, [5, 6, 7, 8])).toBe('page-02-panels-05-08.png')
    expect(getPageComicImageFilename(1, [1, 3, 7])).toBe('page-01-panels-01_03_07.png')
  })

  test('comic final image paths preserve legacy paths unless variations are explicit', () => {
    expect(getPanelComicImagePath('scene-one', 1)).toBe(join('output', 'comic', 'scene-one', 'panels', 'panel-01.png'))
    expect(getPanelComicImagePath('scene-one', 1, 'gpt-image-2')).toBe(join('output', 'comic', 'scene-one', 'panels', 'gpt-image-2', 'panel-01.png'))
    expect(getPanelComicImagePath('scene-one', 1, 'gpt-image-2', 'animation-polish')).toBe(join('output', 'comic', 'scene-one', 'panels', 'animation-polish', 'gpt-image-2', 'panel-01.png'))
    expect(getPageComicImagePath('scene-one', 1, [1, 2], 'gpt-image-2', 'cinematic-depth')).toBe(join('output', 'comic', 'scene-one', 'pages', 'cinematic-depth', 'gpt-image-2', 'page-01-panels-01-02.png'))
  })

  test('comic final image prompt variations apply only non-canonical prompt prefixes', () => {
    const prompts = {
      'Image Prompt Variations': {
        'animation-polish': 'Production animation instruction.',
        'cinematic-depth': 'Cinematic depth instruction.',
      },
    } as unknown as PromptsConfig
    const basePrompt = 'Base final prompt.'

    expect(applyImagePromptVariation(basePrompt, 'canonical', prompts)).toBe(basePrompt)

    const animationPrompt = applyImagePromptVariation(basePrompt, 'animation-polish', prompts)
    const cinematicPrompt = applyImagePromptVariation(basePrompt, 'cinematic-depth', prompts)

    expect(animationPrompt.startsWith('Production animation instruction.')).toBe(true)
    expect(cinematicPrompt.startsWith('Cinematic depth instruction.')).toBe(true)
    expect(animationPrompt).toContain(`\n\n${basePrompt}`)
    expect(cinematicPrompt).toContain(`\n\n${basePrompt}`)
    expect(animationPrompt).not.toBe(cinematicPrompt)
  })

  test('comic final page prompt preserves panel order and speech text', () => {
    const promptData = buildComicPagePromptData([
      {
        title: 'Co-Work Smarter',
        location: 'Engineering Bay',
        panels: [{
          number: 1,
          description: 'Peaches points at the dashboard.',
          characters: [],
          speech: [{ character: 'Peaches', line: 'We need the exact text.', tone: 'firm' }],
          sourceSegmentIds: ['beat-0001'],
          sourceSegments: [{
            id: 'beat-0001',
            type: 'dialogue',
            text: 'We need the exact text.',
            beatIndex: 1,
            speaker: 'Peaches',
            speakerLabel: 'PEACHES',
          }]
        }]
      },
      {
        title: 'Co-Work Smarter',
        location: 'Engineering Bay',
        panels: [{
          number: 3,
          description: 'Duco nods.',
          characters: [],
          speech: [{ character: 'Duco', line: 'Then do not rewrite it.', tone: 'dry' }],
          sourceSegmentIds: ['beat-0002'],
          sourceSegments: [{
            id: 'beat-0002',
            type: 'dialogue',
            text: 'Then do not rewrite it.',
            beatIndex: 2,
            speaker: 'Duco',
            speakerLabel: 'DUCO',
          }]
        }]
      }
    ])
    const prompt = buildComicPagePrompt(promptData)

    expect(promptData.panels.map(panel => panel.number)).toEqual([1, 3])
    expect(prompt).toContain('Render exactly 2 sub-panels')
    expect(prompt).toContain('We need the exact text.')
    expect(prompt).toContain('Then do not rewrite it.')
    expect(prompt.indexOf('"number": 1')).toBeLessThan(prompt.indexOf('"number": 3'))
  })

  test('comic sketch prompt asks for numeric panel labels only', () => {
    const promptData: ExpandedScenePromptData = {
      title: 'Paddy Repairs Everything',
      location: 'Engineering Bay',
      panels: [{
        number: 4,
        description: 'Paddy kicks the laser cutter panel as steam escapes.',
        characters: [],
        speech: [{ character: 'Paddy', line: 'I need the exact text.', tone: 'muttering' }],
        sourceSegmentIds: ['beat-0004'],
        sourceSegments: [{
          id: 'beat-0004',
          type: 'dialogue',
          text: 'I need the exact text.',
          beatIndex: 4,
          speaker: 'Paddy',
          speakerLabel: 'PADDY',
        }]
      }]
    }
    const sketchPrompts: PromptsConfig['Sketch Prompts'] = {
      Prefix: 'Generate a black-and-white rough sketch review image for comic layout approval.',
      Chunk: 'Use the ordered panel data below to produce one review sketch image with one sub-panel per source panel.',
    }

    const prompt = buildSketchPrompt(promptData, sketchPrompts)

    expect(prompt).toContain('Label each sub-panel only with its source panel number')
    expect(prompt).toContain('small boxed numeral in the upper-left corner')
    expect(prompt).toContain('caption banners such as "Wide opening shot..." or "Action panel..."')
    expect(prompt).toContain('Keep visible text limited to story content explicitly present in the panel data')
    expect(prompt).toContain('Include the exact speech bubble text')
    expect(prompt).toContain('I need the exact text.')
  })

  test('buildOptsFromFlags maps representative CLI flags to runtime options', () => {
    const opts = buildOptsFromFlags(false, {
      openai: 'gpt-5.4-mini',
      glm: 'glm-5.1',
      kimi: 'kimi-k2.6',
      'openai-stt': 'gpt-4o-mini-transcribe',
      'grok-stt': 'speech-to-text',
      'together-stt': 'openai/whisper-large-v3',
      'deepgram-stt': 'nova-3',
      'scrapecreators-stt': 'youtube-transcript',
      'scrapecreators-lang': 'fr',
      'grok-tts': 'grok-tts',
      'grok-tts-voice': 'EVE',
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-voice-name': 'Saved Voice Name',
      'deepgram-tts': 'aura-2-fujin-ja',
      'deepgram-tts-encoding': 'linear16',
      'deepgram-tts-container': 'wav',
      'deepgram-tts-bit-rate': '128000',
      'deepgram-tts-sample-rate': '24000',
      'deepgram-tts-speed': '1.1',
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-ref-audio': SHORT_AUDIO_URL,
      'deapi-tts-ref-text': 'Reference transcript.',
      'deapi-tts-language': 'English',
      'deapi-tts-speed': '1.25',
      'deapi-tts-format': 'mp3',
      'deapi-tts-sample-rate': '24000',
      'deapi-tts-instruction': 'A documentary narrator.',
      'speechify-tts': 'simba-english',
      'speechify-voice': 'narrator_voice',
      'speechify-tts-audio-format': 'wav',
      'speechify-tts-language': 'en-US',
      'hume-tts': 'octave-2',
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': 'sonic-3.5',
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en',
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-output-format': 'mp3_22050_32',
      'elevenlabs-tts-language-code': 'en',
      'elevenlabs-tts-stability': '0.4',
      'elevenlabs-tts-similarity-boost': '0.8',
      'elevenlabs-tts-style': '0.2',
      'elevenlabs-tts-use-speaker-boost': true,
      'elevenlabs-tts-speed': '1.1',
      'elevenlabs-tts-seed': '12345',
      'elevenlabs-tts-text-normalization': 'ON',
      'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2', 'dict_3'],
      'elevenlabs-tts-optimize-streaming-latency': '2',
      'elevenlabs-tts-pvc-as-ivc': true,
      'gcloud-tts': 'chirp3-hd',
      'gcloud-tts-voice': 'en-US-Chirp3-HD-Charon',
      'gcloud-tts-language': 'en-US',
      'deepinfra-ocr': 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      'kimi-ocr': 'kimi-k2.6',
      'unstructured-ocr': 'hi_res_and_enrichment',
      'tesseract-ocr': true,
      'youtube-captions': true,
      'best-quality': true,
      'batch-limit': '9',
      'stt-provider-concurrency': '3',
      'ocr-provider-concurrency': '4',
      'ocr-local-concurrency': '2',
      'llm-provider-concurrency': '5',
      'llm-local-concurrency': '3',
      'openai-voice': 'alloy',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-language': 'en-US',
      'openai-tts-consent-name': 'Anthony Consent',
      'openai-tts-voice-name': 'AutoShow Anthony'
    })

    expect(opts.openaiModel).toBe('gpt-5.4-mini')
    expect(opts.glmModel).toBe('glm-5.1')
    expect(opts.kimiModel).toBe('kimi-k2.6')
    expect(opts.openaiSttModel).toBe('gpt-4o-mini-transcribe')
    expect(opts.grokSttModel).toBe('speech-to-text')
    expect(opts.togetherSttModel).toBe('openai/whisper-large-v3')
    expect(opts.deepgramSttModel).toBe('nova-3')
    expect(opts.scrapecreatorsSttModel).toBe('youtube-transcript')
    expect(opts.scrapecreatorsLang).toBe('fr')
    expect(opts.grokTtsModel).toBe('grok-tts')
    expect(opts.grokTtsVoice).toBe('eve')
    expect(opts.mistralTtsModel).toBe('voxtral-mini-tts-2603')
    expect(opts.mistralTtsVoice).toBe('voice_abc123')
    expect(opts.mistralTtsVoiceName).toBe('Saved Voice Name')
    expect(opts.deepgramTtsModel).toBe('aura-2-fujin-ja')
    expect(opts.deepgramTtsEncoding).toBe('linear16')
    expect(opts.deepgramTtsContainer).toBe('wav')
    expect(opts.deepgramTtsBitRate).toBe(128000)
    expect(opts.deepgramTtsSampleRate).toBe(24000)
    expect(opts.deepgramTtsSpeed).toBe(1.1)
    expect(opts.deapiTtsModel).toBe('Qwen3_TTS_12Hz_1_7B_Base')
    expect(opts.deapiTtsRefAudio).toBe(SHORT_AUDIO_URL)
    expect(opts.deapiTtsRefText).toBe('Reference transcript.')
    expect(opts.deapiTtsLanguage).toBe('English')
    expect(opts.deapiTtsSpeed).toBe(1.25)
    expect(opts.deapiTtsFormat).toBe('mp3')
    expect(opts.deapiTtsSampleRate).toBe(24000)
    expect(opts.deapiTtsInstruction).toBe('A documentary narrator.')
    expect(opts.speechifyTtsModel).toBe('simba-english')
    expect(opts.speechifyVoice).toBe('narrator_voice')
    expect(opts.speechifyTtsAudioFormat).toBe('wav')
    expect(opts.speechifyTtsLanguage).toBe('en-US')
    expect(opts.humeTtsModel).toBe('octave-2')
    expect(opts.humeTtsVoice).toBe('Studio Voice')
    expect(opts.humeTtsVoiceProvider).toBe('CUSTOM_VOICE')
    expect(opts.cartesiaTtsModel).toBe('sonic-3.5')
    expect(opts.cartesiaTtsVoice).toBe('cartesia-voice-id')
    expect(opts.cartesiaTtsLanguage).toBe('en')
    expect(opts.elevenlabsTtsModel).toBe('eleven_v3')
    expect(opts.elevenlabsTtsOutputFormat).toBe('mp3_22050_32')
    expect(opts.elevenlabsTtsLanguageCode).toBe('en')
    expect(opts.elevenlabsTtsStability).toBe(0.4)
    expect(opts.elevenlabsTtsSimilarityBoost).toBe(0.8)
    expect(opts.elevenlabsTtsStyle).toBe(0.2)
    expect(opts.elevenlabsTtsUseSpeakerBoost).toBe(true)
    expect(opts.elevenlabsTtsSpeed).toBe(1.1)
    expect(opts.elevenlabsTtsSeed).toBe(12345)
    expect(opts.elevenlabsTtsTextNormalization).toBe('on')
    expect(opts.elevenlabsTtsPronunciationDictionaryLocators).toEqual(['dict_1:version_2', 'dict_3'])
    expect(opts.elevenlabsTtsOptimizeStreamingLatency).toBe(2)
    expect(opts.elevenlabsTtsPvcAsIvc).toBe(true)
    expect(opts.gcloudTtsModel).toBe('chirp3-hd')
    expect(opts.gcloudTtsVoice).toBe('en-US-Chirp3-HD-Charon')
    expect(opts.gcloudTtsLanguage).toBe('en-US')
    expect(opts.deepinfraOcrModel).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(opts.kimiOcrModel).toBe('kimi-k2.6')
    expect(opts.unstructuredOcrModel).toBe('hi_res_and_enrichment')
    expect(opts.useTesseract).toBe(true)
    expect(opts.youtubeCaptions).toBe(true)
    expect(opts.bestQuality).toBe(true)
    expect(opts.batchLimit).toBe(9)
    expect(opts.sttProviderConcurrency).toBe(3)
    expect(opts.ocrProviderConcurrency).toBe(4)
    expect(opts.ocrLocalConcurrency).toBe(2)
    expect(opts.llmProviderConcurrency).toBe(5)
    expect(opts.llmLocalConcurrency).toBe(3)
    expect(opts.openaiVoiceId).toBe('alloy')
    expect(opts.openaiTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.openaiTtsConsentId).toBe('cons_123')
    expect(opts.openaiTtsConsentLanguage).toBe('en-US')
    expect(opts.openaiTtsConsentName).toBe('Anthony Consent')
    expect(opts.openaiTtsVoiceName).toBe('AutoShow Anthony')
  })

  test('AWS region and bucket flags reach OCR extraction options', () => {
    const opts = buildOptsFromFlags(false, {
      'aws-textract': 'detect-text',
      'aws-region': 'us-west-2',
      'aws-bucket': 'autoshow-textract-existing'
    })
    const extractionOpts = buildExtractionCallOpts('input/examples/document/1-document.pdf', 'output/test', opts)

    expect(opts.awsRegion).toBe('us-west-2')
    expect(opts.awsBucket).toBe('autoshow-textract-existing')
    expect(extractionOpts.awsTextractModel).toBe('detect-text')
    expect(extractionOpts.awsRegion).toBe('us-west-2')
    expect(extractionOpts.awsBucket).toBe('autoshow-textract-existing')
  })

  test('buildOptsFromFlags only accepts canonical flags before the positional separator', () => {
    const camelCaseFlags = buildOptsFromFlags(false, {
      openaiStt: 'gpt-4o-mini-transcribe',
      deepinfraOcr: 'Qwen/Qwen3-VL-30B-A3B-Instruct'
    })
    const separatedFlags = buildOptsFromFlags(false, {}, [
      '--openai-stt',
      'gpt-4o-mini-transcribe'
    ], {}, new Set(), [
      'extract',
      'https://ajc.pics/autoshow/examples/1-audio.mp3',
      '--',
      '--openai-stt',
      'gpt-4o-mini-transcribe',
      '--speechify-tts-voice-name',
      'AfterSeparator'
    ])
    const canonicalFlags = buildOptsFromFlags(false, {
      'openai-stt': 'gpt-4o-mini-transcribe',
      'deepinfra-ocr': 'Qwen/Qwen3-VL-30B-A3B-Instruct'
    })

    expect(camelCaseFlags.openaiSttModel).toBeUndefined()
    expect(camelCaseFlags.deepinfraOcrModel).toBeUndefined()
    expect(separatedFlags.openaiSttModel).toBeUndefined()
    expect(separatedFlags.speechifyTtsVoiceName).toBeUndefined()
    expect(canonicalFlags.openaiSttModel).toBe('gpt-4o-mini-transcribe')
    expect(canonicalFlags.deepinfraOcrModel).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
  })

  test('buildOptsFromFlags accepts URL article backend names', () => {
    for (const backend of ['defuddle', 'firecrawl', 'glm-reader', 'spider', 'zyte'] as const) {
      const opts = buildOptsFromFlags(false, { 'url-backend': backend })
      expect(opts.urlBackend).toBe(backend)
      expect(opts.urlBackendExplicit).toBe(true)
    }
  })

  test('--all-url expands URL article backends and defaults hosted concurrency', () => {
    const opts = buildOptsFromFlags(false, { 'all-url': true })
    const explicitConcurrency = buildOptsFromFlags(false, {
      'all-url': true,
      'url-provider-concurrency': '3'
    }, [], {}, new Set(['url-provider-concurrency']))

    expect(opts.urlBackends).toEqual([...URL_ARTICLE_BACKENDS])
    expect(opts.urlProviderConcurrency).toBe(4)
    expect(explicitConcurrency.urlBackends).toEqual([...URL_ARTICLE_BACKENDS])
    expect(explicitConcurrency.urlProviderConcurrency).toBe(3)
  })

  test('--all-url conflicts with single URL backend selection', () => {
    expect(() => buildOptsFromFlags(false, {
      'all-url': true,
      'url-backend': 'firecrawl'
    })).toThrow('Cannot use --all-url with --url-backend')
  })

  test('--all-url article extraction reports provider artifact expectations', async () => {
    const opts = buildOptsFromFlags(false, { 'all-url': true })

    await expect(buildExpectedFilesList(
      'extract',
      opts,
      'https://example.com/articles/story.html'
    )).resolves.toEqual([
      'providers/<backend>/result.json',
      'providers/<backend>/extraction.txt',
      'run.json'
    ])
  })

  test('OCR provider concurrency defaults, falls back, and clamps like STT concurrency flags', () => {
    const defaults = buildOptsFromFlags(false, {})
    const fallback = buildOptsFromFlags(false, {
      'ocr-provider-concurrency': 'not-a-number',
      'ocr-local-concurrency': 'nope'
    })
    const clamped = buildOptsFromFlags(false, {
      'ocr-provider-concurrency': '0',
      'ocr-local-concurrency': '-4'
    })

    expect(defaults.ocrProviderConcurrency).toBe(2)
    expect(defaults.ocrLocalConcurrency).toBe(1)
    expect(fallback.ocrProviderConcurrency).toBe(2)
    expect(fallback.ocrLocalConcurrency).toBe(1)
    expect(clamped.ocrProviderConcurrency).toBe(1)
    expect(clamped.ocrLocalConcurrency).toBe(1)
  })

  test('buildOptsFromFlags maps repeatable dialogue speaker reference audio flags', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'screenplay',
      'tts-speaker-ref-audio': [
        'DUCO=input/examples/audio/anthony-voice.mp3',
        'CHAT=https://ajc.pics/autoshow/examples/0-audio-short.mp3'
      ]
    })

    expect(opts.ttsDialogueFormat).toBe('screenplay')
    expect(opts.ttsSpeakerRefAudios).toEqual([
      'DUCO=input/examples/audio/anthony-voice.mp3',
      'CHAT=https://ajc.pics/autoshow/examples/0-audio-short.mp3'
    ])
  })

  test('buildOptsFromFlags maps and validates provider-specific TTS request controls', () => {
    const opts = buildOptsFromFlags(false, {
      'grok-tts': 'grok-tts',
      'grok-tts-voice': 'AB12CD34',
      'grok-tts-language': 'pt-br',
      'grok-tts-text-normalization': true,
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-instructions': 'Speak with calm narration.',
      'openai-tts-speed': '1.25',
      'minimax-tts': 'speech-2.8-hd',
      'minimax-tts-language-boost': 'english',
      'minimax-tts-speed': '1.2',
      'minimax-tts-volume': '2.5',
      'minimax-tts-pitch': '-2',
      'minimax-tts-emotion': 'CALM',
      'minimax-tts-english-normalization': true,
      'minimax-tts-pronunciation': ['AutoShow/auto show', 'TTS/tee tee ess'],
      'deepgram-tts': 'aura-2-thalia-en',
      'deepgram-tts-encoding': 'linear16',
      'deepgram-tts-container': 'wav',
      'deepgram-tts-bit-rate': '128000',
      'deepgram-tts-sample-rate': '24000',
      'deepgram-tts-speed': '1.1',
      'speechify-tts': 'simba-multilingual',
      'speechify-tts-audio-format': 'PCM',
      'speechify-tts-language': 'es-ES',
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-output-format': 'mp3_22050_32',
      'elevenlabs-tts-language-code': 'en',
      'elevenlabs-tts-stability': '0.4',
      'elevenlabs-tts-similarity-boost': '0.8',
      'elevenlabs-tts-style': '0.2',
      'elevenlabs-tts-use-speaker-boost': true,
      'elevenlabs-tts-speed': '1.1',
      'elevenlabs-tts-seed': '12345',
      'elevenlabs-tts-text-normalization': 'AUTO',
      'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2'],
      'elevenlabs-tts-optimize-streaming-latency': '2',
      'elevenlabs-tts-pvc-as-ivc': true,
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_VoiceDesign',
      'deapi-tts-language': 'English',
      'deapi-tts-speed': '1.2',
      'deapi-tts-format': 'mp3',
      'deapi-tts-sample-rate': '24000',
      'deapi-tts-instruction': 'A calm narrator.'
    })

    expect(opts.grokTtsVoice).toBe('ab12cd34')
    expect(opts.grokTtsLanguage).toBe('pt-BR')
    expect(opts.grokTtsTextNormalization).toBe(true)
    expect(opts.openaiTtsInstructions).toBe('Speak with calm narration.')
    expect(opts.openaiTtsSpeed).toBe(1.25)
    expect(opts.minimaxTtsModel).toBe('speech-2.8-hd')
    expect(opts.minimaxTtsLanguageBoost).toBe('English')
    expect(opts.minimaxTtsSpeed).toBe(1.2)
    expect(opts.minimaxTtsVolume).toBe(2.5)
    expect(opts.minimaxTtsPitch).toBe(-2)
    expect(opts.minimaxTtsEmotion).toBe('calm')
    expect(opts.minimaxTtsEnglishNormalization).toBe(true)
    expect(opts.minimaxTtsPronunciations).toEqual(['AutoShow/auto show', 'TTS/tee tee ess'])
    expect(opts.deepgramTtsEncoding).toBe('linear16')
    expect(opts.deepgramTtsContainer).toBe('wav')
    expect(opts.deepgramTtsBitRate).toBe(128000)
    expect(opts.deepgramTtsSampleRate).toBe(24000)
    expect(opts.deepgramTtsSpeed).toBe(1.1)
    expect(opts.speechifyTtsAudioFormat).toBe('pcm')
    expect(opts.speechifyTtsLanguage).toBe('es-ES')
    expect(opts.elevenlabsTtsOutputFormat).toBe('mp3_22050_32')
    expect(opts.elevenlabsTtsLanguageCode).toBe('en')
    expect(opts.elevenlabsTtsStability).toBe(0.4)
    expect(opts.elevenlabsTtsSimilarityBoost).toBe(0.8)
    expect(opts.elevenlabsTtsStyle).toBe(0.2)
    expect(opts.elevenlabsTtsUseSpeakerBoost).toBe(true)
    expect(opts.elevenlabsTtsSpeed).toBe(1.1)
    expect(opts.elevenlabsTtsSeed).toBe(12345)
    expect(opts.elevenlabsTtsTextNormalization).toBe('auto')
    expect(opts.elevenlabsTtsPronunciationDictionaryLocators).toEqual(['dict_1:version_2'])
    expect(opts.elevenlabsTtsOptimizeStreamingLatency).toBe(2)
    expect(opts.elevenlabsTtsPvcAsIvc).toBe(true)
    expect(opts.deapiTtsLanguage).toBe('English')
    expect(opts.deapiTtsSpeed).toBe(1.2)
    expect(opts.deapiTtsFormat).toBe('mp3')
    expect(opts.deapiTtsSampleRate).toBe(24000)
    expect(opts.deapiTtsInstruction).toBe('A calm narrator.')

    expect(() => buildOptsFromFlags(false, { 'grok-tts-language': 'xx' })).toThrow('Invalid --grok-tts-language "xx"')
    expect(() => buildOptsFromFlags(false, { 'openai-tts-speed': '0.1' })).toThrow('Invalid --openai-tts-speed value "0.1"')
    expect(() => buildOptsFromFlags(false, { 'minimax-tts-language-boost': 'Klingon' })).toThrow('Invalid --minimax-tts-language-boost "Klingon"')
    expect(() => buildOptsFromFlags(false, { 'minimax-tts-speed': '0.4' })).toThrow('Invalid --minimax-tts-speed value "0.4"')
    expect(() => buildOptsFromFlags(false, { 'minimax-tts-volume': '0' })).toThrow('Invalid --minimax-tts-volume value "0"')
    expect(() => buildOptsFromFlags(false, { 'minimax-tts-pitch': '1.5' })).toThrow('Invalid --minimax-tts-pitch value "1.5"')
    expect(() => buildOptsFromFlags(false, { 'minimax-tts-emotion': 'bored' })).toThrow('Invalid --minimax-tts-emotion "bored"')
    expect(() => buildOptsFromFlags(false, { 'speechify-tts-audio-format': 'flac' })).toThrow('Invalid --speechify-tts-audio-format "flac"')
    expect(() => buildOptsFromFlags(false, { 'hume-tts': 'octave-1' })).toThrow('Invalid --hume-tts model "octave-1"')
    expect(() => buildOptsFromFlags(false, { 'hume-tts-voice-provider': 'PRIVATE' })).toThrow('Invalid --hume-tts-voice-provider "PRIVATE"')
    expect(() => buildOptsFromFlags(false, { 'cartesia-tts': 'sonic-2' })).toThrow('Invalid --cartesia-tts model "sonic-2"')
    expect(() => buildOptsFromFlags(false, { 'deepgram-tts-sample-rate': '1.5' })).toThrow('Invalid --deepgram-tts-sample-rate value "1.5"')
    expect(() => buildOptsFromFlags(false, { 'deapi-tts-speed': '0.4' })).toThrow('Invalid --deapi-tts-speed value "0.4"')
    expect(() => buildOptsFromFlags(false, { 'elevenlabs-tts-text-normalization': 'always' })).toThrow('Invalid --elevenlabs-tts-text-normalization "always"')
    expect(() => buildOptsFromFlags(false, { 'elevenlabs-tts-optimize-streaming-latency': '5' })).toThrow('Invalid --elevenlabs-tts-optimize-streaming-latency value "5"')
  })

  test('TTS request control flags require their matching provider selection', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'openai-tts-speed': '1.1'
    }))).toThrow('OpenAI TTS request control flags require --openai-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'grok-tts-text-normalization': true
    }))).toThrow('Grok TTS request control flags require --grok-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'minimax-tts-emotion': 'calm'
    }))).toThrow('MiniMax TTS request control flags require --minimax-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'deepgram-tts-speed': '1.1'
    }))).toThrow('Deepgram TTS request control flags require --deepgram-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'elevenlabs-tts-output-format': 'mp3_22050_32'
    }))).toThrow('ElevenLabs TTS request control flags require --elevenlabs-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts-audio-format': 'wav'
    }))).toThrow('Speechify TTS request control flags require --speechify-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'hume-tts-voice': 'Studio Voice'
    }))).toThrow('Hume TTS voice flags require --hume-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'cartesia-tts-language': 'en'
    }))).toThrow('Cartesia TTS request control flags require --cartesia-tts <model> or --all-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'deapi-tts-language': 'English'
    }))).toThrow('deAPI TTS request control flags require --deapi-tts <model> or --all-tts')
  })

  test('Hume and Cartesia TTS target collection preserves model and voice controls', () => {
    const targets = collectTtsTargets(buildOptsFromFlags(false, {
      'hume-tts': 'octave-2',
      'hume-tts-voice': 'Studio Voice',
      'hume-tts-voice-provider': 'CUSTOM_VOICE',
      'cartesia-tts': 'sonic-3.5',
      'cartesia-tts-voice': 'cartesia-voice-id',
      'cartesia-tts-language': 'en'
    }))

    expect(targets.map((target) => ({
      service: target.service,
      model: target.model,
      voice: target.voice
    }))).toEqual([
      {
        service: 'hume',
        model: 'octave-2',
        voice: 'Studio Voice'
      },
      {
        service: 'cartesia',
        model: 'sonic-3.5',
        voice: 'cartesia-voice-id'
      }
    ])
  })

  test('LLM provider concurrency defaults, falls back, and clamps like STT/OCR concurrency flags', () => {
    const defaults = buildOptsFromFlags(false, {})
    const fallback = buildOptsFromFlags(false, {
      'llm-provider-concurrency': 'not-a-number',
      'llm-local-concurrency': 'nope'
    })
    const clamped = buildOptsFromFlags(false, {
      'llm-provider-concurrency': '0',
      'llm-local-concurrency': '-4'
    })

    expect(defaults.llmProviderConcurrency).toBe(2)
    expect(defaults.llmLocalConcurrency).toBe(1)
    expect(fallback.llmProviderConcurrency).toBe(2)
    expect(fallback.llmLocalConcurrency).toBe(1)
    expect(clamped.llmProviderConcurrency).toBe(1)
    expect(clamped.llmLocalConcurrency).toBe(1)
  })

  test('generation provider concurrency defaults, falls back, and clamps like other provider concurrency flags', () => {
    const defaults = buildOptsFromFlags(false, {})
    const fallback = buildOptsFromFlags(false, {
      'tts-provider-concurrency': 'not-a-number',
      'tts-local-concurrency': 'nope',
      'image-provider-concurrency': 'bad',
      'image-local-concurrency': 'bad',
      'video-provider-concurrency': 'bad',
      'video-local-concurrency': 'bad',
      'music-provider-concurrency': 'bad',
      'music-local-concurrency': 'bad'
    })
    const clamped = buildOptsFromFlags(false, {
      'tts-provider-concurrency': '0',
      'tts-local-concurrency': '-1',
      'image-provider-concurrency': '0',
      'image-local-concurrency': '-1',
      'video-provider-concurrency': '0',
      'video-local-concurrency': '-1',
      'music-provider-concurrency': '0',
      'music-local-concurrency': '-1'
    })

    expect(defaults.ttsProviderConcurrency).toBe(2)
    expect(defaults.ttsLocalConcurrency).toBe(1)
    expect(defaults.imageProviderConcurrency).toBe(2)
    expect(defaults.imageLocalConcurrency).toBe(1)
    expect(defaults.videoProviderConcurrency).toBe(2)
    expect(defaults.videoLocalConcurrency).toBe(1)
    expect(defaults.musicProviderConcurrency).toBe(2)
    expect(defaults.musicLocalConcurrency).toBe(1)
    expect(fallback.ttsProviderConcurrency).toBe(2)
    expect(fallback.imageProviderConcurrency).toBe(2)
    expect(fallback.videoProviderConcurrency).toBe(2)
    expect(fallback.musicProviderConcurrency).toBe(2)
    expect(clamped.ttsProviderConcurrency).toBe(1)
    expect(clamped.ttsLocalConcurrency).toBe(1)
    expect(clamped.imageProviderConcurrency).toBe(1)
    expect(clamped.imageLocalConcurrency).toBe(1)
    expect(clamped.videoProviderConcurrency).toBe(1)
    expect(clamped.videoLocalConcurrency).toBe(1)
    expect(clamped.musicProviderConcurrency).toBe(1)
    expect(clamped.musicLocalConcurrency).toBe(1)
  })

  test('bare provider flags resolve to cheapest defaults', () => {
    const openaiDefault = resolveCheapestModelForFlag('openai')
    const glmDefault = resolveCheapestModelForFlag('glm')
    const kimiDefault = resolveCheapestModelForFlag('kimi')
    const deepgramDefault = resolveCheapestModelForFlag('deepgram-stt')
    const scrapeCreatorsDefault = resolveCheapestModelForFlag('scrapecreators-stt')
    const deepinfraOcrDefault = resolveCheapestModelForFlag('deepinfra-ocr')
    const kimiOcrDefault = resolveCheapestModelForFlag('kimi-ocr')
    const unstructuredOcrDefault = resolveCheapestModelForFlag('unstructured-ocr')
    const speechifyTtsDefault = resolveCheapestModelForFlag('speechify-tts')
    const humeTtsDefault = resolveCheapestModelForFlag('hume-tts')
    const cartesiaTtsDefault = resolveCheapestModelForFlag('cartesia-tts')
    const gcloudTtsDefault = resolveCheapestModelForFlag('gcloud-tts')
    const opts = buildOptsFromFlags(false, {
      openai: true,
      glm: true,
      kimi: true,
      'deepgram-stt': true,
      'scrapecreators-stt': true,
      'deepinfra-ocr': true,
      'kimi-ocr': true,
      'unstructured-ocr': true,
      'speechify-tts': true,
      'hume-tts': true,
      'cartesia-tts': true,
      'gcloud-tts': true
    })

    expect(openaiDefault).toBeDefined()
    expect(glmDefault).toBeDefined()
    expect(kimiDefault).toBe('kimi-k2.6')
    expect(deepgramDefault).toBeDefined()
    expect(scrapeCreatorsDefault).toBe('youtube-transcript')
    expect(deepinfraOcrDefault).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(kimiOcrDefault).toBe('kimi-k2.6')
    expect(unstructuredOcrDefault).toBe('hi_res_and_enrichment')
    expect(speechifyTtsDefault).toBe('simba-english')
    expect(humeTtsDefault).toBe('octave-2')
    expect(cartesiaTtsDefault).toBe('sonic-3')
    expect(gcloudTtsDefault).toBe('chirp3-hd')
    expect(opts.openaiModel).toBe(openaiDefault)
    expect(opts.glmModel).toBe(glmDefault)
    expect(opts.kimiModel).toBe(kimiDefault)
    expect(opts.deepgramSttModel).toBe(deepgramDefault)
    expect(opts.scrapecreatorsSttModel).toBe(scrapeCreatorsDefault)
    expect(opts.deepinfraOcrModel).toBe(deepinfraOcrDefault)
    expect(opts.kimiOcrModel).toBe(kimiOcrDefault)
    expect(opts.unstructuredOcrModel).toBe(unstructuredOcrDefault)
    expect(opts.speechifyTtsModel).toBe(speechifyTtsDefault)
    expect(opts.humeTtsModel).toBe(humeTtsDefault)
    expect(opts.cartesiaTtsModel).toBe(cartesiaTtsDefault)
    expect(opts.gcloudTtsModel).toBe(gcloudTtsDefault)
  })

  test('--all-llm expands GLM and Kimi to their supported models', () => {
    const opts = buildOptsFromFlags(false, { 'all-llm': true })

    expect(opts.glmModels).toEqual(['glm-5.1'])
    expect(opts.kimiModels).toEqual(['kimi-k2.6'])
  })

  test('--all shortcuts use aggressive hosted concurrency only when concurrency is not explicit', () => {
    const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })
    const llmOpts = buildOptsFromFlags(false, { 'all-llm': true })
    const ttsOpts = buildOptsFromFlags(false, { 'all-tts': true })
    const imageOpts = buildOptsFromFlags(false, { 'all-image': true })
    const videoOpts = buildOptsFromFlags(false, { 'all-video': true })
    const musicOpts = buildOptsFromFlags(false, { 'all-music': true })
    const explicitVideoOpts = buildOptsFromFlags(false, {
      'all-video': true,
      'video-provider-concurrency': '3'
    }, [], {}, new Set(['video-provider-concurrency']))

    expect(ocrOpts.ocrProviderConcurrency).toBe(8)
    expect(llmOpts.llmProviderConcurrency).toBe(8)
    expect(ttsOpts.ttsProviderConcurrency).toBe(8)
    expect(imageOpts.imageProviderConcurrency).toBe(Math.min(8, collectImageTargets(imageOpts).length))
    expect(videoOpts.videoProviderConcurrency).toBe(Math.min(8, collectVideoTargets(videoOpts).length))
    expect(musicOpts.musicProviderConcurrency).toBe(Math.min(8, collectMusicTargets(musicOpts).length))
    expect(explicitVideoOpts.videoProviderConcurrency).toBe(3)
    expect(ocrOpts.ocrLocalConcurrency).toBe(1)
    expect(ttsOpts.ttsLocalConcurrency).toBe(1)
  })

  test('--all-stt and --all-ocr expand to non-empty expected provider lists', () => {
    const expansions = getStep2AllShortcutModelExpansions()
    const sttOpts = buildOptsFromFlags(false, { 'all-stt': true })
    const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })

    expect(expansions['deepgram-stt']?.shortcut).toBe('all-stt')
    expect(expansions['grok-stt']?.shortcut).toBe('all-stt')
    expect(expansions['openai-stt']?.shortcut).toBe('all-stt')
    expect(expansions['scrapecreators-stt']).toBeUndefined()
    expect(expansions['cloudflare-stt']).toBeUndefined()
    expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['kimi-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['deepinfra-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['unstructured-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['deapi-ocr']).toBeUndefined()
    expect(ocrOpts.openaiOcrModels).toEqual(['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'])
    expect(ocrOpts.anthropicOcrModels).toEqual(['claude-haiku-4-5'])
    expect(ocrOpts.deepinfraOcrModels).toEqual(['Qwen/Qwen3-VL-235B-A22B-Instruct', 'Qwen/Qwen3-VL-30B-A3B-Instruct'])
    expect(ocrOpts.awsTextractModels).toEqual(['detect-text'])
    expect(ocrOpts.gcloudDocaiModels).toEqual(['ocr'])
    expect(ocrOpts.unstructuredOcrModels).toEqual(['hi_res_and_enrichment'])
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('deepgram')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('grok')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('openai-stt')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).not.toContain('scrapecreators')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).not.toContain('cloudflare')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('whisper')
    const ocrTargets = collectExplicitOcrTargets(ocrOpts)
    expect(ocrTargets.map((target) => target.service)).toContain('tesseract')
    expect(ocrTargets.map((target) => target.service)).toContain('openai')
    expect(ocrTargets.map((target) => target.service)).toContain('kimi')
    expect(ocrTargets.map((target) => target.service)).toContain('deepinfra')
    expect(ocrTargets.map((target) => target.service)).toContain('unstructured')
    expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('openai:gpt-5.4-mini')
    expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('anthropic:claude-opus-4-7')
    expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('gcloud-docai:layout-parser')
    expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('anthropic:claude-sonnet-4-6')
    expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('deepinfra:PaddlePaddle/PaddleOCR-VL-0.9B')
    expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('aws-textract:analyze-document')
    expect(ocrTargets.map((target) => target.service)).not.toContain('deapi')
  })

  test('OpenAI Mini OCR is available while removed provider OCR models stay rejected', () => {
    const openaiWriteOpts = buildOptsFromFlags(false, { openai: 'gpt-5.4-mini' })
    const openaiOcrOpts = buildOptsFromFlags(false, { 'openai-ocr': 'gpt-5.4-mini' })
    const writeOpts = buildOptsFromFlags(false, { anthropic: 'claude-sonnet-4-6' })

    expect(openaiWriteOpts.openaiModel).toBe('gpt-5.4-mini')
    expect(openaiOcrOpts.openaiOcrModel).toBe('gpt-5.4-mini')
    expect(openaiOcrOpts.openaiOcrModels).toEqual(['gpt-5.4-mini'])
    expect(writeOpts.anthropicModel).toBe('claude-sonnet-4-6')
    expect(() => buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-opus-4-7' })).toThrow(
      'Invalid --anthropic-ocr model "claude-opus-4-7". Allowed values: claude-haiku-4-5'
    )
    expect(() => buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-sonnet-4-6' })).toThrow(
      'Invalid --anthropic-ocr model "claude-sonnet-4-6". Allowed values: claude-haiku-4-5'
    )
    expect(() => buildOptsFromFlags(false, { 'gcloud-docai': 'layout-parser' })).toThrow(
      'Invalid --gcloud-docai model "layout-parser". Allowed values: ocr'
    )
  })

  test('--all-tts expands every self-contained TTS model and excludes special-input modes', () => {
    const opts = buildOptsFromFlags(false, { 'all-tts': true })
    const targets = collectTtsTargets(opts)
    const services = targets.map((target) => target.service)
    const targetModelsFor = (service: string) => targets
      .filter((target) => target.service === service)
      .map((target) => target.model)
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')
    const grokTargets = collectTtsTargets(opts).filter((target) => target.service === 'grok')
    const mistralTargets = collectTtsTargets(opts).filter((target) => target.service === 'mistral')
    const speechifyTargets = collectTtsTargets(opts).filter((target) => target.service === 'speechify')
    const humeTargets = collectTtsTargets(opts).filter((target) => target.service === 'hume')
    const cartesiaTargets = collectTtsTargets(opts).filter((target) => target.service === 'cartesia')
    const gcloudTargets = collectTtsTargets(opts).filter((target) => target.service === 'gcloud')

    expect(services).not.toContain('runway')
    expect(opts.kittenTtsModels).toEqual([...SUPPORTED_KITTEN_TTS_MODELS])
    expect(targetModelsFor('kitten')).toEqual([...SUPPORTED_KITTEN_TTS_MODELS])
    expect(opts.elevenlabsTtsModels).toEqual([...SUPPORTED_ELEVENLABS_TTS_MODELS])
    expect(targetModelsFor('elevenlabs')).toEqual([...SUPPORTED_ELEVENLABS_TTS_MODELS])
    expect(opts.minimaxTtsModels).toEqual([...SUPPORTED_MINIMAX_TTS_MODELS])
    expect(targetModelsFor('minimax')).toEqual([...SUPPORTED_MINIMAX_TTS_MODELS])
    expect(opts.groqTtsModels).toEqual([...SUPPORTED_GROQ_TTS_MODELS])
    expect(targetModelsFor('groq')).toEqual([...SUPPORTED_GROQ_TTS_MODELS])
    expect(opts.grokTtsModels).toEqual([...SUPPORTED_GROK_TTS_MODELS])
    expect(grokTargets.map((target) => target.model)).toEqual([...SUPPORTED_GROK_TTS_MODELS])
    expect(grokTargets.map((target) => target.voice)).toEqual([undefined])
    expect(opts.mistralTtsModels).toEqual([...SUPPORTED_MISTRAL_TTS_MODELS])
    expect(mistralTargets.map((target) => target.model)).toEqual([...SUPPORTED_MISTRAL_TTS_MODELS])
    expect(mistralTargets.map((target) => target.voice)).toEqual([undefined])
    expect(opts.openaiTtsModels).toEqual([...SUPPORTED_OPENAI_TTS_MODELS])
    expect(targetModelsFor('openai')).toEqual([...SUPPORTED_OPENAI_TTS_MODELS])
    expect(opts.geminiTtsModels).toEqual([...SUPPORTED_GEMINI_TTS_MODELS])
    expect(targetModelsFor('gemini')).toEqual([...SUPPORTED_GEMINI_TTS_MODELS])
    expect(opts.deepgramTtsModels).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(deepgramTargets.map((target) => target.model)).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(opts.speechifyTtsModels).toEqual([...SUPPORTED_SPEECHIFY_TTS_MODELS])
    expect(speechifyTargets.map((target) => target.model)).toEqual([...SUPPORTED_SPEECHIFY_TTS_MODELS])
    expect(opts.humeTtsModels).toEqual([...SUPPORTED_HUME_TTS_MODELS])
    expect(humeTargets.map((target) => target.model)).toEqual([...SUPPORTED_HUME_TTS_MODELS])
    expect(opts.cartesiaTtsModels).toEqual([...SUPPORTED_CARTESIA_TTS_MODELS])
    expect(cartesiaTargets.map((target) => target.model)).toEqual([...SUPPORTED_CARTESIA_TTS_MODELS])
    expect(opts.gcloudTtsModels).toEqual([...SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS])
    expect(gcloudTargets.map((target) => target.model)).toEqual([...SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS])
    expect(gcloudTargets.map((target) => target.voice)).toEqual(
      SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS.map((model) => GCLOUD_DEFAULT_TTS_VOICES[model])
    )
    expect(gcloudTargets.map((target) => target.model)).not.toContain('instant-custom-voice')
    expect(opts.deapiTtsModels).toEqual([...SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS])
    expect(targetModelsFor('deapi')).toEqual([...SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS])
    expect(targetModelsFor('deapi')).not.toContain('Qwen3_TTS_12Hz_1_7B_Base')
    expect(targetModelsFor('deapi')).not.toContain('Qwen3_TTS_12Hz_1_7B_VoiceDesign')
  })

  test('--all-tts rejects special-input modes that need an explicit model', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'all-tts': true,
      'gcloud-tts-ref-audio': SHORT_AUDIO_URL,
      'gcloud-tts-consent-audio': SHORT_AUDIO_URL
    }))).toThrow('require --gcloud-tts instant-custom-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'all-tts': true,
      'deapi-tts-ref-audio': SHORT_AUDIO_URL
    }))).toThrow('requires --deapi-tts Qwen3_TTS_12Hz_1_7B_Base')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'all-tts': true,
      'deapi-tts-instruction': 'Design a calm documentary voice.'
    }))).toThrow('requires --deapi-tts Qwen3_TTS_12Hz_1_7B_VoiceDesign')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'all-tts': true,
      'groq-voice': REMOVED_GROQ_TTS_VOICE
    }))).toThrow(`Invalid --groq-voice "${REMOVED_GROQ_TTS_VOICE}"`)

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'all-tts': true,
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'labeled',
      'tts-speaker-ref-audio': ['Host=input/examples/audio/anthony-voice.mp3']
    }))).toThrow('cannot be combined with other TTS providers')
  })

  test('Groq TTS exposes only English Orpheus model and voices', () => {
    const englishTargets = collectTtsTargets(buildOptsFromFlags(false, {
      'groq-tts': 'canopylabs/orpheus-v1-english'
    })).filter((target) => target.service === 'groq')
    const explicitEnglishTargets = collectTtsTargets(buildOptsFromFlags(false, {
      'groq-tts': 'canopylabs/orpheus-v1-english',
      'groq-voice': 'HANNAH'
    })).filter((target) => target.service === 'groq')

    expect(getGroqDefaultTtsVoiceForModel('canopylabs/orpheus-v1-english')).toBe('troy')
    expect(englishTargets.map((target) => target.voice)).toEqual(['troy'])
    expect(explicitEnglishTargets.map((target) => target.voice)).toEqual(['hannah'])
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'groq-tts': REMOVED_GROQ_TTS_MODEL
    }))).toThrow(`Invalid --groq-tts model "${REMOVED_GROQ_TTS_MODEL}"`)
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'groq-tts': 'canopylabs/orpheus-v1-english',
      'groq-voice': REMOVED_GROQ_TTS_VOICE
    }))).toThrow(`Invalid --groq-voice "${REMOVED_GROQ_TTS_VOICE}"`)
  })

  test('Google Cloud instant custom voice flags validate model and key generation mode', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts-ref-audio': SHORT_AUDIO_URL,
      'gcloud-tts-consent-audio': SHORT_AUDIO_URL
    }))).toThrow('require --gcloud-tts instant-custom-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'chirp3-hd',
      'gcloud-tts-ref-audio': SHORT_AUDIO_URL,
      'gcloud-tts-consent-audio': SHORT_AUDIO_URL
    }))).toThrow('require --gcloud-tts instant-custom-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'instant-custom-voice'
    }))).toThrow('requires --gcloud-tts-voice-cloning-key or both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'instant-custom-voice',
      'gcloud-tts-voice-cloning-key': 'existing-key',
      'gcloud-tts-ref-audio': SHORT_AUDIO_URL,
      'gcloud-tts-consent-audio': SHORT_AUDIO_URL
    }))).toThrow('cannot be combined with key generation flags')

    expect(collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'instant-custom-voice',
      'gcloud-tts-voice-cloning-key': 'existing-key'
    })).map((target) => ({
      service: target.service,
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      service: 'gcloud',
      model: 'instant-custom-voice',
      voice: 'instant-custom-voice'
    }])

    expect(collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': ['chirp3-hd', 'instant-custom-voice'],
      'gcloud-tts-voice-cloning-key': 'existing-key'
    })).map((target) => ({
      service: target.service,
      model: target.model,
      voice: target.voice
    }))).toEqual([
      {
        service: 'gcloud',
        model: 'chirp3-hd',
        voice: GCLOUD_DEFAULT_TTS_VOICES['chirp3-hd']
      },
      {
        service: 'gcloud',
        model: 'instant-custom-voice',
        voice: 'instant-custom-voice'
      }
    ])
  })

  test('Speechify custom voice flags build reference-audio targets and validate required consent', () => {
    const opts = buildOptsFromFlags(false, {
      'speechify-tts': ['simba-english', 'simba-multilingual'],
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-voice-name': 'FallbackName',
      'speechify-tts-consent-name': 'Fallback Consent',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-locale': 'en-US',
      'speechify-tts-voice-gender': 'notSpecified'
    }, [], {}, new Set(), [
      '--speechify-tts-voice-name',
      'AutoShow Anthony',
      '--speechify-tts-consent-name',
      'Anthony Example'
    ])
    const speechifyTargets = collectTtsTargets(opts).filter((target) => target.service === 'speechify')

    expect(opts.speechifyTtsRefAudio).toBe('input/voices/my-voice-sample.mp3')
    expect(opts.speechifyTtsVoiceName).toBe('AutoShow Anthony')
    expect(opts.speechifyTtsConsentName).toBe('Anthony Example')
    expect(opts.speechifyTtsConsentEmail).toBe('anthony@example.com')
    expect(opts.speechifyTtsVoiceLocale).toBe('en-US')
    expect(opts.speechifyTtsVoiceGender).toBe('notSpecified')
    expect(speechifyTargets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([
      {
        model: 'simba-english',
        voice: 'ref_audio:my-voice-sample.mp3',
        setupCostCents: 0,
        setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
        setupNote: 'Speechify custom voice creation setup'
      },
      {
        model: 'simba-multilingual',
        voice: 'ref_audio:my-voice-sample.mp3',
        setupCostCents: undefined,
        setupTimeMs: undefined,
        setupNote: undefined
      }
    ])

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('require --speechify-tts <model>')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-tts-voice-name': 'AutoShow Anthony',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('requires --speechify-tts-ref-audio')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-voice': 'george',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('cannot be combined with --speechify-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('requires --speechify-tts-consent-name')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-gender': 'unknown'
    }))).toThrow('Invalid --speechify-tts-voice-gender')
  })

  test('elevenlabs voice clone target records reference audio speaker and setup estimate', () => {
    const opts = buildOptsFromFlags(false, {
      'elevenlabs-tts': ['eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    }, [], {}, new Set(), [
      '--elevenlabs-tts',
      'eleven_v3',
      '--elevenlabs-tts-ref-audio',
      'input/examples/audio/anthony-voice.mp3',
      '--elevenlabs-tts-voice-name',
      'AutoShow Anthony',
      '--elevenlabs-tts-clone-remove-background-noise'
    ])
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'elevenlabs')

    expect(opts.elevenlabsTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.elevenlabsTtsVoiceName).toBe('AutoShow Anthony')
    expect(opts.elevenlabsTtsCloneRemoveBackgroundNoise).toBe(true)
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([
      {
        model: 'eleven_v3',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: 0,
        setupTimeMs: ELEVENLABS_TTS_IVC_SETUP_MS,
        setupNote: 'ElevenLabs instant voice clone setup'
      }
    ])
  })

  test('elevenlabs clone options validate provider selection and voice reuse', () => {
    const missingElevenLabsModel = buildOptsFromFlags(false, {
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
    const voiceNameWithoutReference = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony'
    })
    const voiceWithClone = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-voice': 'voice_existing123',
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
    const existingVoice = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-voice': 'voice_existing123'
    })

    expect(() => collectTtsTargets(missingElevenLabsModel)).toThrow('require --elevenlabs-tts <model> or --all-tts')
    expect(() => collectTtsTargets(voiceNameWithoutReference)).toThrow('requires --elevenlabs-tts-ref-audio')
    expect(() => collectTtsTargets(voiceWithClone)).toThrow('cannot be combined with --elevenlabs-voice')
    expect(collectTtsTargets(existingVoice).map((target) => target.voice)).toEqual(['voice_existing123'])
  })

  test('elevenlabs clone audio validation enforces file and extension while warning on duration guidance', async () => {
    const sample = await validateElevenLabsTtsIvcAudio('input/examples/audio/anthony-voice.mp3')
    expect(sample.basename).toBe('anthony-voice.mp3')
    expect(sample.mimeType).toBe('audio/mpeg')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')

    try {
      await expect(validateElevenLabsTtsIvcAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
      await expect(validateElevenLabsTtsIvcAudio(textPath)).rejects.toThrow('mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm')
      await expect(validateElevenLabsTtsIvcAudio(emptyPath)).rejects.toThrow('is empty')
      await expect(validateElevenLabsTtsIvcAudio(LOCAL_SHORT_AUDIO_PATH)).resolves.toMatchObject({
        basename: '0-audio-short.mp3'
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs clone flow creates once and reuses cloned voice across runs', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-clone-flow-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body

        if (url.endsWith('/v1/voices/add') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              name: body.get('name'),
              hasFile: body.get('files') instanceof Blob,
              removeBackgroundNoise: body.get('remove_background_noise')
            }
          })
          return new Response(JSON.stringify({
            voice_id: 'voice_elevenlabs_mock',
            requires_verification: false
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.includes('/v1/text-to-speech/')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected ElevenLabs mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const context = createElevenLabsTtsIvcContext()
      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })
      const clone = {
        refAudioPath: 'input/examples/audio/anthony-voice.mp3',
        voiceName: 'AutoShowTestVoice',
        removeBackgroundNoise: true,
        context
      }
      const first = await runElevenLabsTts('Hello from the first run.', firstDir, {
        model: 'eleven_v3',
        clone
      })
      const second = await runElevenLabsTts('Hello from the second run.', secondDir, {
        model: 'eleven_v3',
        clone
      })

      expect(await Bun.file(first.audioPath).exists()).toBe(true)
      expect(await Bun.file(second.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/v1/voices/add'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/'))).toHaveLength(2)
      expect(calls.find((call) => call.url.endsWith('/v1/voices/add'))?.body).toEqual({
        name: 'AutoShowTestVoice',
        hasFile: true,
        removeBackgroundNoise: 'true'
      })
      expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/')).map((call) => ({
        url: call.url,
        body: call.body
      }))).toEqual([
        {
          url: 'https://mock.elevenlabs.local/v1/text-to-speech/voice_elevenlabs_mock?output_format=mp3_44100_128',
          body: { text: 'Hello from the first run.', model_id: 'eleven_v3' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/text-to-speech/voice_elevenlabs_mock?output_format=mp3_44100_128',
          body: { text: 'Hello from the second run.', model_id: 'eleven_v3' }
        }
      ])
      expect(first.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_elevenlabs_mock',
        cloneCostCents: 0
      })
      expect(second.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_elevenlabs_mock',
        cloneCostCents: 0
      })
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs clone flow fails clearly when verification is required', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-verify-'))

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/voices/add')) {
          return new Response(JSON.stringify({
            voice_id: 'voice_requires_verify',
            requires_verification: true
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected ElevenLabs verification mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch

      await expect(runElevenLabsTts('Hello.', tempDir, {
        model: 'eleven_v3',
        clone: {
          refAudioPath: 'input/examples/audio/anthony-voice.mp3',
          context: createElevenLabsTtsIvcContext()
        }
      })).rejects.toThrow('Verify it in ElevenLabs, then rerun with --elevenlabs-voice voice_requires_verify')
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs clone flow surfaces API errors without synthesis', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-error-'))
    let synthesisCalls = 0

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/voices/add')) {
          return new Response(JSON.stringify({ detail: { message: 'bad reference audio' } }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.includes('/v1/text-to-speech/')) {
          synthesisCalls += 1
        }
        throw new Error(`Unexpected ElevenLabs error mock fetch: ${url}`)
      }) as typeof fetch

      await expect(runElevenLabsTts('Hello.', tempDir, {
        model: 'eleven_v3',
        clone: {
          refAudioPath: 'input/examples/audio/anthony-voice.mp3',
          context: createElevenLabsTtsIvcContext()
        }
      })).rejects.toThrow('ElevenLabs IVC voice creation failed (400): bad reference audio')
      expect(synthesisCalls).toBe(0)
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs PVC ready voice maps to synthesis speaker and rejects conflicting voice modes', () => {
    const readyPvc = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    })
    const targets = collectTtsTargets(readyPvc).filter((target) => target.service === 'elevenlabs')

    expect(readyPvc.elevenlabsTtsPvcVoice).toBe('pvc_voice_123')
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents
    }))).toEqual([{
      model: 'eleven_v3',
      voice: 'pvc:pvc_voice_123',
      setupCostCents: undefined
    }])

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-voice': 'voice_existing123',
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    }))).toThrow('PVC voice cannot be combined with --elevenlabs-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    }))).toThrow('PVC voice cannot be combined with ElevenLabs IVC flags')
  })

  test('elevenlabs PVC setup target records setup estimate and runtime-only setup flags', () => {
    const opts = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-pvc-sample': ['input/examples/audio/anthony-voice.mp3'],
      'elevenlabs-tts-voice-name': 'AutoShow PVC',
      'elevenlabs-tts-pvc-language': 'en',
      'elevenlabs-tts-pvc-description': 'Narration PVC',
      'elevenlabs-tts-pvc-captcha-out': '/tmp/autoshow-pvc-captcha.png',
      'elevenlabs-tts-pvc-wait': true
    }, [], {}, new Set(), [
      '--elevenlabs-tts',
      'eleven_v3',
      '--elevenlabs-tts-pvc-sample',
      'input/examples/audio/anthony-voice.mp3',
      '--elevenlabs-tts-voice-name',
      'AutoShow PVC',
      '--elevenlabs-tts-pvc-language',
      'en',
      '--elevenlabs-tts-pvc-description',
      'Narration PVC',
      '--elevenlabs-tts-pvc-captcha-out',
      '/tmp/autoshow-pvc-captcha.png',
      '--elevenlabs-tts-pvc-wait'
    ])
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'elevenlabs')

    expect(opts.elevenlabsTtsPvcSamples).toEqual(['input/examples/audio/anthony-voice.mp3'])
    expect(opts.elevenlabsTtsVoiceName).toBe('AutoShow PVC')
    expect(opts.elevenlabsTtsPvcLanguage).toBe('en')
    expect(opts.elevenlabsTtsPvcDescription).toBe('Narration PVC')
    expect(opts.elevenlabsTtsPvcCaptchaOut).toBe('/tmp/autoshow-pvc-captcha.png')
    expect(opts.elevenlabsTtsPvcWait).toBe(true)
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([{
      model: 'eleven_v3',
      voice: 'pvc_setup:AutoShow PVC',
      setupCostCents: 0,
      setupTimeMs: ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS,
      setupNote: 'ElevenLabs professional voice clone training'
    }])
  })

  test('elevenlabs PVC sample validation accepts directories and enforces file checks', async () => {
    const sample = await validateElevenLabsTtsPvcAudio('input/examples/audio/anthony-voice.mp3')
    expect(sample.basename).toBe('anthony-voice.mp3')
    expect(sample.mimeType).toBe('audio/mpeg')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-pvc-samples-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const sampleCopyPath = join(tempDir, 'sample.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(sampleCopyPath, new Uint8Array(await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()))

    try {
      await expect(validateElevenLabsTtsPvcAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
      await expect(validateElevenLabsTtsPvcAudio(textPath)).rejects.toThrow('mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm')
      await expect(validateElevenLabsTtsPvcAudio(emptyPath)).rejects.toThrow('is empty')
      await rm(emptyPath, { force: true })
      const samples = await validateElevenLabsTtsPvcSamples(undefined, tempDir)
      expect(samples.map((entry) => entry.basename)).toEqual(['sample.mp3'])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs PVC setup creates a voice, uploads samples, writes captcha and status artifact', async () => {
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-pvc-create-'))
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url === SHORT_AUDIO_URL) {
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.endsWith('/v1/voices/pvc')) {
          calls.push({ url, method, body: JSON.parse(String(body ?? '{}')) as unknown })
          return new Response(JSON.stringify({ voice_id: 'pvc_new_voice' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/v1/voices/pvc/pvc_new_voice/samples') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              hasFile: body.get('files') instanceof Blob,
              removeBackgroundNoise: body.get('remove_background_noise')
            }
          })
          return new Response(JSON.stringify([{
            sample_id: 'sample_1',
            file_name: '0-audio-short.mp3',
            mime_type: 'audio/mpeg',
            size_bytes: 10,
            duration_secs: 5
          }]), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/voices/pvc/pvc_new_voice/captcha')) {
          calls.push({ url, method })
          return new Response(Buffer.from('captcha-bytes').toString('base64'), {
            status: 200,
            headers: { 'content-type': 'text/plain' }
          })
        }
        throw new Error(`Unexpected ElevenLabs PVC create mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const captchaPath = join(tempDir, 'captcha.png')
      const result = await runElevenLabsTtsPvcSetup('https://mock.elevenlabs.local/v1', 'test-key', {
        model: 'eleven_v3',
        samplePaths: [SHORT_AUDIO_URL],
        voiceName: 'AutoShow PVC',
        language: 'en',
        description: 'Narration PVC',
        captchaOut: captchaPath
      })
      const artifact = await writeElevenLabsTtsPvcStatusArtifact(tempDir, result)

      expect(result).toMatchObject({
        voiceId: 'pvc_new_voice',
        voiceName: 'AutoShow PVC',
        language: 'en',
        description: 'Narration PVC',
        createdVoice: true,
        readyForSynthesis: false,
        actions: ['create_voice', 'upload_samples', 'write_captcha']
      })
      expect(result.uploadedSamples).toEqual([{
        sampleId: 'sample_1',
        fileName: '0-audio-short.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 10,
        durationSeconds: 5
      }])
      expect(await Bun.file(captchaPath).text()).toBe('captcha-bytes')
      expect(await Bun.file(join(tempDir, artifact.statusFileName)).exists()).toBe(true)
      expect(calls.map((call) => ({ url: call.url, method: call.method, body: call.body }))).toEqual([
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc',
          method: 'POST',
          body: { name: 'AutoShow PVC', language: 'en', description: 'Narration PVC' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_new_voice/samples',
          method: 'POST',
          body: { hasFile: true, removeBackgroundNoise: 'false' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_new_voice/captcha',
          method: 'GET',
          body: undefined
        }
      ])
    } finally {
      globalThis.fetch = previousFetch
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs PVC setup verifies, trains, and waits for fine tuning', async () => {
    const previousFetch = globalThis.fetch
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{ url: string, method: string, body?: unknown }> = []
    let statusPolls = 0

    try {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url === SHORT_AUDIO_URL) {
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.endsWith('/v1/voices/pvc/pvc_existing/captcha') && method === 'POST' && body instanceof FormData) {
          calls.push({ url, method, body: { hasRecording: body.get('recording') instanceof Blob } })
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/v1/voices/pvc/pvc_existing/train')) {
          calls.push({ url, method, body: JSON.parse(String(body ?? '{}')) as unknown })
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/v1/voices/pvc_existing')) {
          statusPolls += 1
          calls.push({ url, method })
          return new Response(JSON.stringify({
            voice_id: 'pvc_existing',
            fine_tuning: {
              state: {
                eleven_v3: statusPolls === 1 ? 'fine_tuning' : 'fine_tuned'
              },
              progress: {
                eleven_v3: statusPolls === 1 ? 0.5 : 1
              }
            }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected ElevenLabs PVC verify mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runElevenLabsTtsPvcSetup('https://mock.elevenlabs.local/v1', 'test-key', {
        model: 'eleven_v3',
        pvcVoiceId: 'pvc_existing',
        verifyAudioPath: SHORT_AUDIO_URL,
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 1000
      })

      expect(result).toMatchObject({
        voiceId: 'pvc_existing',
        verificationStatus: 'ok',
        trainingStatus: 'ok',
        fineTuningState: 'fine_tuned',
        fineTuningProgress: 1,
        readyForSynthesis: true,
        actions: ['verify_captcha', 'start_training', 'wait_for_training']
      })
      expect(calls.map((call) => ({ url: call.url, method: call.method, body: call.body }))).toEqual([
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_existing/captcha',
          method: 'POST',
          body: { hasRecording: true }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_existing/train',
          method: 'POST',
          body: { model_id: 'eleven_v3' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc_existing',
          method: 'GET',
          body: undefined
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc_existing',
          method: 'GET',
          body: undefined
        }
      ])
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  test('elevenlabs PVC setup surfaces failed training state', async () => {
    const previousFetch = globalThis.fetch

    try {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url.endsWith('/v1/voices/pvc_failed')) {
          return new Response(JSON.stringify({
            voice_id: 'pvc_failed',
            fine_tuning: {
              state: {
                eleven_v3: 'failed'
              }
            }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected ElevenLabs PVC failed mock fetch: ${method} ${url}`)
      }) as typeof fetch

      await expect(runElevenLabsTtsPvcSetup('https://mock.elevenlabs.local/v1', 'test-key', {
        model: 'eleven_v3',
        pvcVoiceId: 'pvc_failed',
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 100
      })).rejects.toThrow('ElevenLabs PVC training failed')
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  test('elevenlabs ready PVC synthesis uses pvc speaker metadata', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-pvc-synthesis-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.includes('/v1/text-to-speech/')) {
          calls.push({ url, method, body: JSON.parse(String(body ?? '{}')) as unknown })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected ElevenLabs PVC synthesis mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runElevenLabsTts('Hello from a PVC voice.', tempDir, {
        model: 'eleven_v3',
        pvcVoiceId: 'pvc_voice_123'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        speaker: 'pvc:pvc_voice_123'
      })
      expect(calls).toEqual([{
        url: 'https://mock.elevenlabs.local/v1/text-to-speech/pvc_voice_123?output_format=mp3_44100_128',
        method: 'POST',
        body: { text: 'Hello from a PVC voice.', model_id: 'eleven_v3' }
      }])
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('mistral tts voice and reference audio are mutually exclusive at target collection', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })

    expect(() => collectTtsTargets(opts)).toThrow('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
  })

  test('mistral tts voice name creates a saved-voice target from reference audio', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'mistral')

    expect(opts.mistralTtsVoiceName).toBe('AutoShow Saved Voice')
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      model: 'voxtral-mini-tts-2603',
      voice: 'saved_voice:AutoShow Saved Voice'
    }])
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice-name': 'AutoShow Saved Voice'
    }))).toThrow('requires --mistral-tts-ref-audio')
  })

  test('deapi voice clone target records reference audio speaker', () => {
    const opts = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-ref-audio': SHORT_AUDIO_URL
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'deapi')

    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      model: 'Qwen3_TTS_12Hz_1_7B_Base',
      voice: 'ref_audio:0-audio-short.mp3'
    }])
  })

  test('deapi VoiceDesign target requires and records an instruction', () => {
    const opts = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_VoiceDesign',
      'deapi-tts-instruction': 'A calm documentary narrator.'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'deapi')

    expect(opts.deapiTtsInstruction).toBe('A calm documentary narrator.')
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      model: 'Qwen3_TTS_12Hz_1_7B_VoiceDesign',
      voice: 'voice_design'
    }])
  })

  test('openai custom voice target records reference audio speaker and setup estimate', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-voice-name': 'AutoShowTestVoice'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'openai')

    expect(opts.openaiTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.openaiTtsConsentId).toBe('cons_123')
    expect(opts.openaiTtsVoiceName).toBe('AutoShowTestVoice')
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([{
      model: 'gpt-4o-mini-tts',
      voice: 'ref_audio:anthony-voice.mp3',
      setupCostCents: 0,
      setupTimeMs: OPENAI_TTS_CLONE_SETUP_MS,
      setupNote: 'OpenAI custom voice creation setup'
    }])
  })

  test('openai custom voice options validate provider selection, consent source, and voice reuse', () => {
    const missingOpenAIModel = buildOptsFromFlags(false, {
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123'
    })
    const missingConsent = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
    const tooManyConsentSources = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-audio': SHORT_AUDIO_URL
    })
    const voiceWithClone = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-voice': 'alloy',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123'
    })
    const consentWithoutReference = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-consent-id': 'cons_123'
    })
    const existingCustomVoice = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-voice': 'voice_existing123'
    })

    expect(() => collectTtsTargets(missingOpenAIModel)).toThrow('require --openai-tts <model> or --all-tts')
    expect(() => collectTtsTargets(missingConsent)).toThrow('requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio')
    expect(() => collectTtsTargets(tooManyConsentSources)).toThrow('requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio')
    expect(() => collectTtsTargets(voiceWithClone)).toThrow('cannot be combined with --openai-voice')
    expect(() => collectTtsTargets(consentWithoutReference)).toThrow('requires --openai-tts-ref-audio')
    expect(collectTtsTargets(existingCustomVoice).map((target) => target.voice)).toEqual(['voice_existing123'])
  })

  test('openai custom voice audio validation enforces file, extension, and size', async () => {
    const sample = await validateOpenAITtsCustomVoiceAudio('input/examples/audio/anthony-voice.mp3', 'sample audio')
    expect(sample.basename).toBe('anthony-voice.mp3')
    expect(sample.mimeType).toBe('audio/mpeg')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-openai-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const largePath = join(tempDir, 'large.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(largePath, '')
    await truncate(largePath, 11 * 1024 * 1024)

    try {
      await expect(validateOpenAITtsCustomVoiceAudio('input/examples/audio/missing.mp3', 'sample audio')).rejects.toThrow('not found')
      await expect(validateOpenAITtsCustomVoiceAudio(textPath, 'sample audio')).rejects.toThrow('mp3/mpeg, wav, ogg, aac, flac, webm, mp4, or m4a')
      await expect(validateOpenAITtsCustomVoiceAudio(emptyPath, 'sample audio')).rejects.toThrow('is empty')
      await expect(validateOpenAITtsCustomVoiceAudio(largePath, 'sample audio')).rejects.toThrow('exceeds 10 MiB')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('openai custom voice flow uploads consent once and reuses cloned voice across runs', async () => {
    const previousKey = process.env['OPENAI_API_KEY']
    const previousBaseUrl = process.env['OPENAI_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-openai-clone-flow-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      process.env['OPENAI_API_KEY'] = 'test-key'
      process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
      const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
        if (url === SHORT_AUDIO_URL) {
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        const method = init?.method ?? 'GET'
        const body = init?.body

        if (url.endsWith('/audio/voice_consents') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              name: body.get('name'),
              language: body.get('language'),
              hasRecording: body.get('recording') instanceof Blob
            }
          })
          return new Response(JSON.stringify({ id: 'cons_mock' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/audio/voices') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              name: body.get('name'),
              consent: body.get('consent'),
              hasAudioSample: body.get('audio_sample') instanceof Blob
            }
          })
          return new Response(JSON.stringify({
            id: 'voice_mock123',
            object: 'audio.voice',
            name: 'AutoShowTestVoice',
            created_at: 1
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/audio/speech')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected OpenAI mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const context = createOpenAITtsCustomVoiceContext()
      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })
      const clone = {
        refAudioPath: 'input/examples/audio/anthony-voice.mp3',
        consentAudioPath: SHORT_AUDIO_URL,
        consentLanguage: 'en-US',
        consentName: 'Consent Test',
        voiceName: 'AutoShowTestVoice',
        context
      }
      const first = await runOpenAITts('Hello from the first model.', firstDir, {
        model: 'gpt-4o-mini-tts',
        clone
      })
      const second = await runOpenAITts('Hello from the second model.', secondDir, {
        model: 'gpt-4o-mini-tts',
        clone
      })

      expect(await Bun.file(first.audioPath).exists()).toBe(true)
      expect(await Bun.file(second.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/audio/voice_consents'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.endsWith('/audio/voices'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.endsWith('/audio/speech'))).toHaveLength(2)
      expect(calls.find((call) => call.url.endsWith('/audio/voice_consents'))?.body).toEqual({
        name: 'Consent Test',
        language: 'en-US',
        hasRecording: true
      })
      expect(calls.find((call) => call.url.endsWith('/audio/voices'))?.body).toEqual({
        name: 'AutoShowTestVoice',
        consent: 'cons_mock',
        hasAudioSample: true
      })
      expect(calls.filter((call) => call.url.endsWith('/audio/speech')).map((call) => call.body)).toEqual([
        expect.objectContaining({ model: 'gpt-4o-mini-tts', voice: { id: 'voice_mock123' } }),
        expect.objectContaining({ model: 'gpt-4o-mini-tts', voice: { id: 'voice_mock123' } })
      ])
      expect(first.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_mock123',
        cloneCostCents: 0
      })
      expect(second.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_mock123',
        cloneCostCents: 0
      })
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['OPENAI_API_KEY']
      else process.env['OPENAI_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['OPENAI_BASE_URL']
      else process.env['OPENAI_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('deapi tts voice and reference audio are mutually exclusive at target collection', () => {
    const opts = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-voice': 'Vivian',
      'deapi-tts-ref-audio': SHORT_AUDIO_URL
    })

    expect(() => collectTtsTargets(opts)).toThrow('Use either --deapi-tts-voice or --deapi-tts-ref-audio, not both')
  })

  test('deapi tts rejects unsupported clone model combinations', () => {
    const cloneWithPresetModel = buildOptsFromFlags(false, {
      'deapi-tts': 'Kokoro',
      'deapi-tts-ref-audio': SHORT_AUDIO_URL
    })
    const cloneWithoutAudio = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base'
    })
    const voiceDesign = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_VoiceDesign'
    })

    expect(() => collectTtsTargets(cloneWithPresetModel)).toThrow('requires --deapi-tts Qwen3_TTS_12Hz_1_7B_Base')
    expect(() => collectTtsTargets(cloneWithoutAudio)).toThrow('requires --deapi-tts-ref-audio')
    expect(() => collectTtsTargets(voiceDesign)).toThrow('requires --deapi-tts-instruction')
  })

  test('deapi tts reference audio validation enforces file, extension, size, and duration', async () => {
    const valid = await validateDeapiTtsReferenceAudio(LOCAL_SHORT_AUDIO_PATH)
    expect(valid.basename).toBe('0-audio-short.mp3')
    expect(valid.durationSeconds).toBeGreaterThanOrEqual(3)
    expect(valid.durationSeconds).toBeLessThanOrEqual(10)

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-deapi-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const largePath = join(tempDir, 'large.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(largePath, '')
    await truncate(largePath, 11 * 1024 * 1024)

    try {
      await expect(validateDeapiTtsReferenceAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
      await expect(validateDeapiTtsReferenceAudio(textPath)).rejects.toThrow('mp3, wav, flac, ogg, or m4a')
      await expect(validateDeapiTtsReferenceAudio(emptyPath)).rejects.toThrow('is empty')
      await expect(validateDeapiTtsReferenceAudio(largePath)).rejects.toThrow('exceeds 10 MB')
      await expect(validateDeapiTtsReferenceAudio('input/examples/audio/anthony-voice.mp3')).rejects.toThrow('must be 3-10 seconds long')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('grok tts voice validation normalizes case', () => {
    const opts = buildOptsFromFlags(false, {
      'grok-tts': ['grok-tts'],
      'grok-tts-voice': 'EVE'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'grok')

    expect(opts.grokTtsVoice).toBe(GROK_DEFAULT_TTS_VOICE)
    expect(targets.map((target) => target.voice)).toEqual([GROK_DEFAULT_TTS_VOICE])
  })

  test('explicit deepgram tts flags can still select multiple voices and apply voice overrides', () => {
    const opts = buildOptsFromFlags(false, {
      'deepgram-tts': ['aura-2-thalia-en', 'aura-2-andromeda-en']
    })
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')

    expect(opts.deepgramTtsModels).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])
    expect(deepgramTargets.map((target) => target.model)).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])

    const overrideOpts = buildOptsFromFlags(false, {
      'deepgram-tts': ['aura-2-thalia-en'],
      'deepgram-voice': 'aura-2-andromeda-en'
    })
    const overrideTargets = collectTtsTargets(overrideOpts).filter((target) => target.service === 'deepgram')

    expect(overrideOpts.deepgramVoiceId).toBe('aura-2-andromeda-en')
    expect(overrideTargets.map((target) => ({
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      model: 'aura-2-thalia-en',
      voice: 'aura-2-andromeda-en'
    }])
  })

  test('video mode defaults to text and validates media inputs', () => {
    const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
    const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-fast-generate-preview',
      'video-input-image': imageDataUrl
    }))).toThrow('--video-input-image is not valid with --video-mode text')

    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-fast-generate-preview'
    })).map(target => target.service)).toEqual(['gemini'])

    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-fast-generate-preview',
      'video-mode': 'image-to-video',
      'video-input-image': imageDataUrl
    })).map(target => target.service)).toEqual(['gemini'])

    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'minimax-video': 'I2V-01',
      'video-mode': 'image-to-video',
      'video-input-image': imageDataUrl
    })).map(target => target.service)).toEqual(['minimax'])

    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'glm-video': 'vidu2-image',
      'video-mode': 'image-to-video',
      'video-input-image': imageDataUrl
    })).map(target => target.service)).toEqual(['glm'])

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'grok-video': 'grok-imagine-video',
      'video-mode': 'reference-to-video',
      'video-reference-image': [imageDataUrl, imageDataUrl, imageDataUrl, imageDataUrl]
    }))).toThrow('--video-reference-image supports at most 3 reference images')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-fast-generate-preview',
      'video-mode': 'interpolate',
      'video-input-image': imageDataUrl
    }))).toThrow('--video-mode interpolate requires --video-last-frame')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'grok-video': 'grok-imagine-video',
      'video-mode': 'edit',
      'video-input-video': videoDataUrl,
      'video-duration': '8'
    }))).toThrow('--video-duration is not valid with --video-mode edit')
  })

  test('GLM and MiniMax video media modes enforce model capability limits', () => {
    const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'minimax-video': 'S2V-01'
    }))).toThrow('--video-mode text is not supported by minimax/S2V-01')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'minimax-video': 'T2V-01',
      'video-mode': 'image-to-video',
      'video-input-image': imageDataUrl
    }))).toThrow('--video-mode image-to-video is not supported by minimax/T2V-01')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'minimax-video': 'S2V-01',
      'video-mode': 'reference-to-video',
      'video-reference-image': [imageDataUrl, imageDataUrl]
    }))).toThrow('MiniMax S2V-01 supports exactly one --video-reference-image')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'glm-video': 'vidu2-reference',
      'video-mode': 'image-to-video',
      'video-input-image': imageDataUrl
    }))).toThrow('--video-mode image-to-video is not supported by glm/vidu2-reference')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'glm-video': 'viduq1-start-end'
    }))).toThrow('--video-mode text is not supported by glm/viduq1-start-end')

    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'glm-video': 'vidu2-reference',
      'video-mode': 'reference-to-video',
      'video-reference-image': [imageDataUrl, imageDataUrl, imageDataUrl]
    })).map(target => target.model)).toEqual(['vidu2-reference'])

    const allReferenceTargets = collectVideoTargets(buildOptsFromFlags(false, {
      'all-video': true,
      'video-mode': 'reference-to-video',
      'video-reference-image': imageDataUrl
    }))
    expect(allReferenceTargets.map(target => `${target.service}/${target.model}`)).toEqual([
      'gemini/veo-3.1-fast-generate-preview',
      'gemini/veo-3.1-generate-preview',
      'minimax/S2V-01',
      'glm/vidu2-reference',
      'grok/grok-imagine-video'
    ])
  })

  test('Gemini video media modes enforce Lite and 4k capability limits', () => {
    const imageDataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
    const videoDataUrl = `data:video/mp4;base64,${Buffer.from([4, 5, 6]).toString('base64')}`

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-lite-generate-preview',
      'video-resolution': '4k'
    }))).toThrow('Veo 3.1 Lite does not support --video-resolution 4k')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-lite-generate-preview',
      'video-mode': 'reference-to-video',
      'video-reference-image': imageDataUrl
    }))).toThrow('--video-mode reference-to-video is not supported by gemini/veo-3.1-lite-generate-preview')

    expect(() => collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-lite-generate-preview',
      'video-mode': 'extend',
      'video-input-video': videoDataUrl
    }))).toThrow('--video-mode extend is not supported by gemini/veo-3.1-lite-generate-preview')

    expect(collectVideoTargets(buildOptsFromFlags(false, {
      'gemini-video': 'veo-3.1-generate-preview',
      'video-resolution': '4k'
    }))).toHaveLength(1)
  })

  test('OCR provider pools enforce hosted and local limits independently', async () => {
    const targets: OcrTarget[] = [
      { service: 'tesseract', model: 'tesseract' },
      { service: 'mistral', model: 'mistral-ocr-2512' },
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'paddle-ocr', model: 'paddle-ocr' },
      { service: 'gemini', model: 'gemini-3.1-flash-lite-preview' }
    ]
    const active = { local: 0, hosted: 0, total: 0 }
    const max = { local: 0, hosted: 0, total: 0 }
    const completedIndices: number[] = []

    await runOcrProviderTargetPools(targets, targets, { provider: 2, local: 1 }, async (index, target) => {
      const group = isLocalOcrTarget(target) ? 'local' : 'hosted'
      active[group] += 1
      active.total += 1
      max[group] = Math.max(max[group], active[group])
      max.total = Math.max(max.total, active.total)

      await Bun.sleep(5)

      completedIndices.push(index)
      active[group] -= 1
      active.total -= 1
    })

    expect(max.local).toBe(1)
    expect(max.hosted).toBe(2)
    expect(max.total).toBe(3)
    expect([...completedIndices].sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4])
  })

  test('LLM provider pools enforce hosted and local limits independently and preserve target indexes', async () => {
    const metadata = (service: Step3Metadata['llmService'], model: string): Step3Metadata => ({
      llmService: service,
      llmModel: model,
      processingTime: 0,
      inputTokenCount: 0,
      outputTokenCount: 0,
      outputFileName: 'text.json',
      outputFormat: 'json',
      structuredMode: 'native',
      structuredPresetNames: []
    })
    const target = (service: Step3Metadata['llmService'], model: string): LLMTarget => ({
      service,
      model,
      label: service,
      run: async () => ({ result: '{}', metadata: metadata(service, model) })
    })
    const targets: LLMTarget[] = [
      target('llama.cpp', 'local-a'),
      target('openai', 'hosted-a'),
      target('groq', 'hosted-b'),
      target('glm', 'hosted-glm'),
      target('llama.cpp', 'local-b'),
      target('gemini', 'hosted-c')
    ]
    const active = { local: 0, hosted: 0, total: 0 }
    const max = { local: 0, hosted: 0, total: 0 }
    const orderedModels: string[] = []

    await runLlmProviderTargetPools(targets, { provider: 2, local: 1 }, async (index, llmTarget) => {
      const group = isLocalLlmTarget(llmTarget) ? 'local' : 'hosted'
      active[group] += 1
      active.total += 1
      max[group] = Math.max(max[group], active[group])
      max.total = Math.max(max.total, active.total)

      await Bun.sleep(5)

      orderedModels[index] = llmTarget.model
      active[group] -= 1
      active.total -= 1
    })

    expect(max.local).toBe(1)
    expect(max.hosted).toBe(2)
    expect(max.total).toBe(3)
    expect(orderedModels).toEqual(targets.map((entry) => entry.model))
  })
})
