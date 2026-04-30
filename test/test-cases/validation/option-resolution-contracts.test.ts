import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { runOcrProviderTargetPools, isLocalOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { runLlmProviderTargetPools, isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { validateDeapiTtsReferenceAudio } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/run-deapi-tts'
import {
  createMinimaxTtsCloneContext,
  MINIMAX_TTS_CLONE_COST_CENTS,
  MINIMAX_TTS_CLONE_SETUP_MS,
  runMinimaxTts,
  validateMinimaxTtsCloneAudio,
  validateMinimaxTtsCloneVoiceId
} from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/run-minimax-tts'
import { runOpenAITts } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/run-openai-tts'
import {
  createOpenAITtsCustomVoiceContext,
  OPENAI_TTS_CLONE_SETUP_MS,
  validateOpenAITtsCustomVoiceAudio
} from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/openai-custom-voices'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { DEEPGRAM_DEFAULT_VOICE, GROK_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/model-options'
import type { LLMTarget, OcrTarget, Step3Metadata } from '~/types'

describe('option resolution contracts', () => {
  test('buildOptsFromFlags maps representative CLI flags to runtime options', () => {
    const opts = buildOptsFromFlags(false, {
      openai: 'gpt-5.4-mini',
      glm: 'glm-5.1',
      kimi: 'kimi-k2.6',
      'openai-stt': 'gpt-4o-mini-transcribe',
      'grok-stt': 'speech-to-text',
      'together-stt': 'openai/whisper-large-v3',
      'deepgram-stt': 'nova-3',
      'grok-tts': 'grok-tts',
      'grok-tts-voice': 'EVE',
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice_abc123',
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'deapi-tts-ref-text': 'Reference transcript.',
      'runway-tts': 'eleven_multilingual_v2',
      'runway-tts-voice': 'Leslie',
      'deepinfra-ocr': 'allenai/olmOCR-2-7B-1025',
      'kimi-ocr': 'kimi-k2.6',
      'tesseract-ocr': true,
      'youtube-captions': true,
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
    expect(opts.grokTtsModel).toBe('grok-tts')
    expect(opts.grokTtsVoice).toBe('eve')
    expect(opts.mistralTtsModel).toBe('voxtral-mini-tts-2603')
    expect(opts.mistralTtsVoice).toBe('voice_abc123')
    expect(opts.minimaxTtsRefAudio).toBeUndefined()
    expect(opts.deapiTtsModel).toBe('Qwen3_TTS_12Hz_1_7B_Base')
    expect(opts.deapiTtsRefAudio).toBe('input/examples/audio/0-audio-short.mp3')
    expect(opts.deapiTtsRefText).toBe('Reference transcript.')
    expect(opts.runwayTtsModel).toBe('eleven_multilingual_v2')
    expect(opts.runwayTtsVoice).toBe('Leslie')
    expect(opts.deepinfraOcrModel).toBe('allenai/olmOCR-2-7B-1025')
    expect(opts.kimiOcrModel).toBe('kimi-k2.6')
    expect(opts.useTesseract).toBe(true)
    expect(opts.youtubeCaptions).toBe(true)
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

  test('bare provider flags resolve to cheapest defaults', () => {
    const openaiDefault = resolveCheapestModelForFlag('openai')
    const glmDefault = resolveCheapestModelForFlag('glm')
    const kimiDefault = resolveCheapestModelForFlag('kimi')
    const deepgramDefault = resolveCheapestModelForFlag('deepgram-stt')
    const deepinfraOcrDefault = resolveCheapestModelForFlag('deepinfra-ocr')
    const kimiOcrDefault = resolveCheapestModelForFlag('kimi-ocr')
    const opts = buildOptsFromFlags(false, {
      openai: true,
      glm: true,
      kimi: true,
      'deepgram-stt': true,
      'deepinfra-ocr': true,
      'kimi-ocr': true
    })

    expect(openaiDefault).toBeDefined()
    expect(glmDefault).toBeDefined()
    expect(kimiDefault).toBe('kimi-k2.6')
    expect(deepgramDefault).toBeDefined()
    expect(deepinfraOcrDefault).toBe('allenai/olmOCR-2-7B-1025')
    expect(kimiOcrDefault).toBe('kimi-k2.6')
    expect(opts.openaiModel).toBe(openaiDefault)
    expect(opts.glmModel).toBe(glmDefault)
    expect(opts.kimiModel).toBe(kimiDefault)
    expect(opts.deepgramSttModel).toBe(deepgramDefault)
    expect(opts.deepinfraOcrModel).toBe(deepinfraOcrDefault)
    expect(opts.kimiOcrModel).toBe(kimiOcrDefault)
  })

  test('--all-llm expands GLM and Kimi to their supported models', () => {
    const opts = buildOptsFromFlags(false, { 'all-llm': true })

    expect(opts.glmModels).toEqual(['glm-5.1'])
    expect(opts.kimiModels).toEqual(['kimi-k2.6'])
  })

  test('--all-stt and --all-ocr expand to non-empty expected provider lists', () => {
    const expansions = getStep2AllShortcutModelExpansions()
    const sttOpts = buildOptsFromFlags(false, { 'all-stt': true })
    const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })

    expect(expansions['deepgram-stt']?.shortcut).toBe('all-stt')
    expect(expansions['grok-stt']?.shortcut).toBe('all-stt')
    expect(expansions['openai-stt']?.shortcut).toBe('all-stt')
    expect(expansions['cloudflare-stt']?.shortcut).toBe('all-stt')
    expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['kimi-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['deepinfra-ocr']?.shortcut).toBe('all-ocr')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('deepgram')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('grok')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('openai-stt')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('cloudflare')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('whisper')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('tesseract')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('openai')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('kimi')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('deepinfra')
  })

  test('--all-tts expands deepgram, runway, grok, and mistral to default models', () => {
    const opts = buildOptsFromFlags(false, { 'all-tts': true })
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')
    const runwayTargets = collectTtsTargets(opts).filter((target) => target.service === 'runway')
    const grokTargets = collectTtsTargets(opts).filter((target) => target.service === 'grok')
    const mistralTargets = collectTtsTargets(opts).filter((target) => target.service === 'mistral')

    expect(opts.deepgramTtsModels).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(deepgramTargets.map((target) => target.model)).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(opts.runwayTtsModels).toEqual(['eleven_multilingual_v2'])
    expect(runwayTargets.map((target) => target.model)).toEqual(['eleven_multilingual_v2'])
    expect(opts.grokTtsModels).toEqual(['grok-tts'])
    expect(grokTargets.map((target) => target.model)).toEqual(['grok-tts'])
    expect(grokTargets.map((target) => target.voice)).toEqual([undefined])
    expect(opts.mistralTtsModels).toEqual(['voxtral-mini-tts-2603'])
    expect(mistralTargets.map((target) => target.model)).toEqual(['voxtral-mini-tts-2603'])
    expect(mistralTargets.map((target) => target.voice)).toEqual([undefined])
  })

  test('mistral tts voice and reference audio are mutually exclusive at target collection', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })

    expect(() => collectTtsTargets(opts)).toThrow('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
  })

  test('deapi voice clone target records reference audio speaker', () => {
    const opts = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3'
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

  test('minimax voice clone target records reference audio speaker and setup estimates', () => {
    const opts = buildOptsFromFlags(false, {
      'minimax-tts': ['speech-2.8-turbo', 'speech-2.8-hd'],
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-voice': 'AutoShowTestVoice',
      'minimax-tts-prompt-audio': 'input/examples/audio/0-audio-short.mp3',
      'minimax-tts-prompt-text': 'Reference transcript.',
      'minimax-tts-clone-noise-reduction': true,
      'minimax-tts-clone-volume-normalization': true
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'minimax')

    expect(opts.minimaxTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.minimaxTtsPromptAudio).toBe('input/examples/audio/0-audio-short.mp3')
    expect(opts.minimaxTtsPromptText).toBe('Reference transcript.')
    expect(opts.minimaxTtsCloneNoiseReduction).toBe(true)
    expect(opts.minimaxTtsCloneVolumeNormalization).toBe(true)
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs
    }))).toEqual([
      {
        model: 'speech-2.8-turbo',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: MINIMAX_TTS_CLONE_COST_CENTS,
        setupTimeMs: MINIMAX_TTS_CLONE_SETUP_MS
      },
      {
        model: 'speech-2.8-hd',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: undefined,
        setupTimeMs: undefined
      }
    ])
  })

  test('minimax clone options validate paired prompt inputs and clone voice_id rules', () => {
    expect(validateMinimaxTtsCloneVoiceId('AutoShow_123')).toBe('AutoShow_123')
    expect(() => validateMinimaxTtsCloneVoiceId('short')).toThrow('8-256')
    expect(() => validateMinimaxTtsCloneVoiceId('1AutoShow')).toThrow('start with an English letter')
    expect(() => validateMinimaxTtsCloneVoiceId('AutoShow!')).toThrow('only letters')
    expect(() => validateMinimaxTtsCloneVoiceId('AutoShow_')).toThrow('cannot end')

    const missingText = buildOptsFromFlags(false, {
      'minimax-tts': 'speech-2.8-turbo',
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-prompt-audio': 'input/examples/audio/0-audio-short.mp3'
    })
    const missingAudio = buildOptsFromFlags(false, {
      'minimax-tts': 'speech-2.8-turbo',
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-prompt-text': 'Reference transcript.'
    })
    const modifierWithoutClone = buildOptsFromFlags(false, {
      'minimax-tts': 'speech-2.8-turbo',
      'minimax-tts-clone-noise-reduction': true
    })

    expect(() => collectTtsTargets(missingText)).toThrow('requires --minimax-tts-prompt-text')
    expect(() => collectTtsTargets(missingAudio)).toThrow('requires --minimax-tts-prompt-audio')
    expect(() => collectTtsTargets(modifierWithoutClone)).toThrow('requires --minimax-tts-ref-audio')
  })

  test('minimax clone audio validation enforces file, extension, size, and duration', async () => {
    const source = await validateMinimaxTtsCloneAudio('input/examples/audio/anthony-voice.mp3', 'source')
    expect(source.basename).toBe('anthony-voice.mp3')
    expect(source.durationSeconds).toBeGreaterThanOrEqual(10)
    expect(source.durationSeconds).toBeLessThanOrEqual(5 * 60)

    const prompt = await validateMinimaxTtsCloneAudio('input/examples/audio/0-audio-short.mp3', 'prompt')
    expect(prompt.basename).toBe('0-audio-short.mp3')
    expect(prompt.durationSeconds).toBeLessThan(8)

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-minimax-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const largePath = join(tempDir, 'large.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(largePath, '')
    await truncate(largePath, 21 * 1024 * 1024)

    try {
      await expect(validateMinimaxTtsCloneAudio('input/examples/audio/missing.mp3', 'source')).rejects.toThrow('not found')
      await expect(validateMinimaxTtsCloneAudio(textPath, 'source')).rejects.toThrow('mp3, m4a, or wav')
      await expect(validateMinimaxTtsCloneAudio(emptyPath, 'source')).rejects.toThrow('is empty')
      await expect(validateMinimaxTtsCloneAudio(largePath, 'source')).rejects.toThrow('exceeds 20 MB')
      await expect(validateMinimaxTtsCloneAudio('input/examples/audio/0-audio-short.mp3', 'source')).rejects.toThrow('10 seconds to 5 minutes')
      await expect(validateMinimaxTtsCloneAudio('input/examples/audio/anthony-voice.mp3', 'prompt')).rejects.toThrow('less than 8 seconds')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('minimax clone flow uploads once and reuses cloned voice across models', async () => {
    const previousKey = process.env['MINIMAX_API_KEY']
    const previousBaseUrl = process.env['MINIMAX_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-minimax-clone-flow-'))
    const calls: Array<{ url: string, method: string, purpose?: string | undefined, body?: unknown }> = []

    try {
      process.env['MINIMAX_API_KEY'] = 'test-key'
      process.env['MINIMAX_BASE_URL'] = 'https://mock.minimax.local'
      const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.endsWith('/v1/files/upload') && body instanceof FormData) {
          const purpose = String(body.get('purpose') ?? '')
          calls.push({ url, method, purpose })
          return new Response(JSON.stringify({
            file: { file_id: purpose === 'voice_clone' ? 'source-file-id' : 'prompt-file-id' },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/voice_clone')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(JSON.stringify({
            demo_audio: '',
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/t2a_async_v2')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(JSON.stringify({
            task_id: `task-${calls.filter((call) => call.url.endsWith('/v1/t2a_async_v2')).length}`,
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.includes('/v1/query/t2a_async_query_v2')) {
          calls.push({ url, method })
          return new Response(JSON.stringify({
            status: 2,
            file_id: 'speech-file-id',
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.includes('/v1/files/retrieve_content')) {
          calls.push({ url, method })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const context = createMinimaxTtsCloneContext()
      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })
      const clone = {
        refAudioPath: 'input/examples/audio/anthony-voice.mp3',
        voiceId: 'AutoShowTestVoice',
        promptAudioPath: 'input/examples/audio/0-audio-short.mp3',
        promptText: 'Reference transcript.',
        needNoiseReduction: true,
        needVolumeNormalization: true,
        context
      }
      const first = await runMinimaxTts('Hello from the first model.', firstDir, {
        model: 'speech-2.8-turbo',
        clone
      })
      const second = await runMinimaxTts('Hello from the second model.', secondDir, {
        model: 'speech-2.8-hd',
        clone
      })

      expect(await Bun.file(first.audioPath).exists()).toBe(true)
      expect(await Bun.file(second.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/v1/files/upload')).map((call) => call.purpose)).toEqual(['voice_clone', 'prompt_audio'])
      expect(calls.filter((call) => call.url.endsWith('/v1/voice_clone'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.endsWith('/v1/t2a_async_v2'))).toHaveLength(2)
      expect(first.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'AutoShowTestVoice',
        cloneCostCents: MINIMAX_TTS_CLONE_COST_CENTS
      })
      expect(second.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'AutoShowTestVoice'
      })
      expect(second.metadata.cloneCostCents).toBeUndefined()

      const cloneRequest = calls.find((call) => call.url.endsWith('/v1/voice_clone'))?.body
      expect(cloneRequest).toEqual({
        file_id: 'source-file-id',
        voice_id: 'AutoShowTestVoice',
        clone_prompt: {
          prompt_audio: 'prompt-file-id',
          prompt_text: 'Reference transcript.'
        },
        need_noise_reduction: true,
        need_volume_normalization: true
      })
      expect(calls.filter((call) => call.url.endsWith('/v1/t2a_async_v2')).map((call) => call.body)).toEqual([
        expect.objectContaining({
          model: 'speech-2.8-turbo',
          voice_setting: { voice_id: 'AutoShowTestVoice' }
        }),
        expect.objectContaining({
          model: 'speech-2.8-hd',
          voice_setting: { voice_id: 'AutoShowTestVoice' }
        })
      ])
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['MINIMAX_API_KEY']
      else process.env['MINIMAX_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['MINIMAX_BASE_URL']
      else process.env['MINIMAX_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
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
      'openai-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3'
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
      const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
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
        consentAudioPath: 'input/examples/audio/0-audio-short.mp3',
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
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3'
    })

    expect(() => collectTtsTargets(opts)).toThrow('Use either --deapi-tts-voice or --deapi-tts-ref-audio, not both')
  })

  test('deapi tts rejects unsupported clone model combinations', () => {
    const cloneWithPresetModel = buildOptsFromFlags(false, {
      'deapi-tts': 'Kokoro',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3'
    })
    const cloneWithoutAudio = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base'
    })
    const voiceDesign = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_VoiceDesign'
    })

    expect(() => collectTtsTargets(cloneWithPresetModel)).toThrow('voice cloning is only supported for Qwen3_TTS_12Hz_1_7B_Base')
    expect(() => collectTtsTargets(cloneWithoutAudio)).toThrow('requires --deapi-tts-ref-audio')
    expect(() => collectTtsTargets(voiceDesign)).toThrow('requires voice design instruction inputs')
  })

  test('deapi tts reference audio validation enforces file, extension, size, and duration', async () => {
    const valid = await validateDeapiTtsReferenceAudio('input/examples/audio/0-audio-short.mp3')
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

  test('explicit deepgram tts flags can still select multiple voices', () => {
    const opts = buildOptsFromFlags(false, {
      'deepgram-tts': ['aura-2-thalia-en', 'aura-2-andromeda-en']
    })
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')

    expect(opts.deepgramTtsModels).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])
    expect(deepgramTargets.map((target) => target.model)).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])
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
