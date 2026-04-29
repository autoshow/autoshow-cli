import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { runOcrProviderTargetPools, isLocalOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { runLlmProviderTargetPools, isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
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
      'openai-voice': 'alloy'
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

  test('--all-tts expands deepgram, runway, and grok to default models', () => {
    const opts = buildOptsFromFlags(false, { 'all-tts': true })
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')
    const runwayTargets = collectTtsTargets(opts).filter((target) => target.service === 'runway')
    const grokTargets = collectTtsTargets(opts).filter((target) => target.service === 'grok')

    expect(opts.deepgramTtsModels).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(deepgramTargets.map((target) => target.model)).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(opts.runwayTtsModels).toEqual(['eleven_multilingual_v2'])
    expect(runwayTargets.map((target) => target.model)).toEqual(['eleven_multilingual_v2'])
    expect(opts.grokTtsModels).toEqual(['grok-tts'])
    expect(grokTargets.map((target) => target.model)).toEqual(['grok-tts'])
    expect(grokTargets.map((target) => target.voice)).toEqual([undefined])
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
