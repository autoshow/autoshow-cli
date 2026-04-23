import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'

describe('option resolution contracts', () => {
  test('buildOptsFromFlags maps representative CLI flags to runtime options', () => {
    const opts = buildOptsFromFlags(false, {
      openai: 'gpt-5.4-mini',
      'deepgram-stt': 'nova-3',
      'tesseract-ocr': true,
      'youtube-captions': true,
      'batch-limit': '9',
      'stt-provider-concurrency': '3',
      'openai-voice': 'alloy'
    })

    expect(opts.openaiModel).toBe('gpt-5.4-mini')
    expect(opts.deepgramSttModel).toBe('nova-3')
    expect(opts.useTesseract).toBe(true)
    expect(opts.youtubeCaptions).toBe(true)
    expect(opts.batchLimit).toBe(9)
    expect(opts.sttProviderConcurrency).toBe(3)
    expect(opts.openaiVoiceId).toBe('alloy')
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
})
