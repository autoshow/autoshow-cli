import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { runOcrProviderTargetPools, isLocalOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { runLlmProviderTargetPools, isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import type { LLMTarget, OcrTarget, Step3Metadata } from '~/types'

describe('option resolution contracts', () => {
  test('buildOptsFromFlags maps representative CLI flags to runtime options', () => {
    const opts = buildOptsFromFlags(false, {
      openai: 'gpt-5.4-mini',
      'deepgram-stt': 'nova-3',
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
    expect(opts.deepgramSttModel).toBe('nova-3')
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
    const deepgramDefault = resolveCheapestModelForFlag('deepgram-stt')
    const opts = buildOptsFromFlags(false, {
      openai: true,
      'deepgram-stt': true
    })

    expect(openaiDefault).toBeDefined()
    expect(deepgramDefault).toBeDefined()
    expect(opts.openaiModel).toBe(openaiDefault)
    expect(opts.deepgramSttModel).toBe(deepgramDefault)
  })

  test('--all-stt and --all-ocr expand to non-empty expected provider lists', () => {
    const expansions = getStep2AllShortcutModelExpansions()
    const sttOpts = buildOptsFromFlags(false, { 'all-stt': true })
    const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })

    expect(expansions['deepgram-stt']?.shortcut).toBe('all-stt')
    expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('deepgram')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('whisper')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('tesseract')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('openai')
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
