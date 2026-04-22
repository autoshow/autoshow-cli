import { describe, expect, test } from 'bun:test'
import { createLogger } from '~/logger/core'
import type { LogSinkEvent } from '~/logger/types'
import {
  buildWriteManifestConsoleSummary,
  formatWriteManifestThroughput,
  logWriteManifestConsoleSummary
} from '~/cli/commands/process-steps/write-manifest-log'

const buildStep3 = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  llmService: 'openai',
  llmModel: 'gpt-4.1-mini',
  processingTime: 1_500,
  inputTokenCount: 200,
  outputTokenCount: 80,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: [],
  ...overrides
})

const buildMediaMetadata = (): Record<string, unknown> => ({
  step2: {
    transcriptionService: 'whisper',
    transcriptionModel: '/models/ggml-tiny.bin | coreml:/models/ggml-tiny-encoder.mlmodelc',
    processingTime: 40_000,
    tokenCount: 1_200
  },
  step3: buildStep3(),
  step4: {
    ttsService: 'openai',
    ttsModel: 'gpt-4o-mini-tts',
    processingTime: 5_000,
    audioFileName: 'speech.wav',
    audioFileSize: 10,
    chunkCount: 3
  },
  step5: {
    imageService: 'openai',
    imageModel: 'gpt-image-1',
    processingTime: 6_000,
    imageFileNames: ['cover.png'],
    imageCount: 1,
    imageFileSize: 20,
    imageWidth: 1024,
    imageHeight: 1024
  },
  cost: {
    estimated: {
      totalCost: 11.25,
      steps: [
        { step: 'stt', provider: 'whisper', model: 'tiny', cost: 1.25 },
        { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2.5 },
        { step: 'tts', provider: 'openai', model: 'gpt-4o-mini-tts', cost: 3.5 },
        { step: 'image', provider: 'openai', model: 'gpt-image-1', cost: 4 }
      ]
    },
    actual: {
      totalCost: 12.5,
      steps: [
        { step: 'stt', provider: 'whisper', model: 'tiny', cost: 1.5 },
        { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2.75 },
        { step: 'tts', provider: 'openai', model: 'gpt-4o-mini-tts', cost: 3.75, inputMetric: 'characters', inputValue: 900 },
        { step: 'image', provider: 'openai', model: 'gpt-image-1', cost: 4.5, inputMetric: 'images', inputValue: 1 }
      ]
    }
  },
  timing: {
    estimated: {
      totalProcessingTimeMs: 96_500,
      steps: [
        { step: 'stt', provider: 'whisper', model: 'tiny', processingTimeMs: 60_000, inputMetric: 'durationSeconds', inputValue: 60 },
        { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 2_000, inputMetric: 'tokens', inputValue: 280 },
        { step: 'tts', provider: 'openai', model: 'gpt-4o-mini-tts', processingTimeMs: 4_500, inputMetric: 'characters', inputValue: 900 },
        { step: 'image', provider: 'openai', model: 'gpt-image-1', processingTimeMs: 30_000, inputMetric: 'images', inputValue: 1 }
      ]
    },
    actual: {
      totalProcessingTimeMs: 52_500,
      steps: [
        { step: 'stt', provider: 'whisper', model: 'tiny', processingTimeMs: 40_000, inputMetric: 'durationSeconds', inputValue: 60 },
        { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 1_500, inputMetric: 'tokens', inputValue: 280 },
        { step: 'tts', provider: 'openai', model: 'gpt-4o-mini-tts', processingTimeMs: 5_000, inputMetric: 'characters', inputValue: 900 },
        { step: 'image', provider: 'openai', model: 'gpt-image-1', processingTimeMs: 6_000, inputMetric: 'images', inputValue: 1 }
      ]
    }
  }
})

const createCollector = (): { events: LogSinkEvent[], logger: ReturnType<typeof createLogger> } => {
  const events: LogSinkEvent[] = []
  const logger = createLogger({
    minLevel: 'debug',
    sinks: [event => {
      events.push(event)
    }]
  })

  return { events, logger }
}

describe('write manifest console summary', () => {
  test('builds media write summary and prompt usage tables', () => {
    const summary = buildWriteManifestConsoleSummary(buildMediaMetadata(), {
      promptArtifact: 'prompt.md',
      step3RenderedOutput: 'text.md'
    })

    expect(summary.runSummary?.humanTable.rows).toEqual([
      {
        step: 'Transcribe',
        providerModel: 'whisper.cpp/tiny',
        predCost: '1.25000¢',
        actCost: '1.50000¢',
        predTime: '1m 0s',
        actTime: '40.0s',
        predSpeed: '1x',
        actSpeed: '1.5x'
      },
      {
        step: 'LLM',
        providerModel: 'openai/gpt-4.1-mini',
        predCost: '2.50000¢',
        actCost: '2.75000¢',
        predTime: '2.0s',
        actTime: '1.5s',
        predSpeed: '140 tok/s',
        actSpeed: '187 tok/s'
      },
      {
        step: 'TTS',
        providerModel: 'openai/gpt-4o-mini-tts',
        predCost: '3.50000¢',
        actCost: '3.75000¢',
        predTime: '4.5s',
        actTime: '5.0s',
        predSpeed: '200 char/s',
        actSpeed: '180 char/s'
      },
      {
        step: 'Image',
        providerModel: 'openai/gpt-image-1',
        predCost: '4.00000¢',
        actCost: '4.50000¢',
        predTime: '30.0s',
        actTime: '6.0s',
        predSpeed: '2 img/min',
        actSpeed: '10 img/min'
      }
    ])
    expect(summary.promptUsage?.rows).toEqual([
      {
        step: 'Transcribe',
        providerModel: 'whisper.cpp/tiny',
        promptSource: null,
        usage: '1200 tokens'
      },
      {
        step: 'LLM',
        providerModel: 'openai/gpt-4.1-mini',
        promptSource: 'prompt.md',
        usage: '200/80 tokens'
      },
      {
        step: 'TTS',
        providerModel: 'openai/gpt-4o-mini-tts',
        promptSource: 'text.md',
        usage: '900 chars / 3 chunks'
      },
      {
        step: 'Image',
        providerModel: 'openai/gpt-image-1',
        promptSource: 'text.md',
        usage: '1 image'
      }
    ])
  })

  test('builds document write summary with extract and llm prompt usage', () => {
    const metadata = {
      step1: { pageCount: 12 },
      step2: {
        extractionMethod: 'openai-ocr',
        totalPages: 12,
        ocrPages: 12,
        textPages: 0,
        processingTime: 75_000,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 4_500,
        ocrService: 'openai',
        ocrModel: 'gpt-5.4-nano',
        promptTokens: 4_000,
        completionTokens: 500
      },
      step3: buildStep3({ inputTokenCount: 450, outputTokenCount: 120 }),
      cost: {
        estimated: {
          totalCost: 5,
          steps: [
            { step: 'extract', provider: 'openai', model: 'gpt-5.4-nano', cost: 2.5 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2.5 }
          ]
        },
        actual: {
          totalCost: 5.5,
          steps: [
            { step: 'extract', provider: 'openai', model: 'gpt-5.4-nano', cost: 2.75, inputMetric: 'tokens', inputValue: 4_500 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2.75 }
          ]
        }
      },
      timing: {
        estimated: {
          totalProcessingTimeMs: 80_000,
          steps: [
            { step: 'extract', provider: 'openai', model: 'gpt-5.4-nano', processingTimeMs: 72_000, inputMetric: 'pages', inputValue: 12 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 8_000, inputMetric: 'tokens', inputValue: 570 }
          ]
        },
        actual: {
          totalProcessingTimeMs: 76_500,
          steps: [
            { step: 'extract', provider: 'openai', model: 'gpt-5.4-nano', processingTimeMs: 75_000, inputMetric: 'pages', inputValue: 12 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 1_500, inputMetric: 'tokens', inputValue: 570 }
          ]
        }
      }
    } satisfies Record<string, unknown>

    const summary = buildWriteManifestConsoleSummary(metadata, { promptArtifact: 'prompt.md' })

    expect(summary.runSummary?.rows.map(row => row.step)).toEqual(['Extract', 'LLM'])
    expect(summary.promptUsage?.rows).toEqual([
      {
        step: 'Extract',
        providerModel: 'openai/gpt-5.4-nano',
        promptSource: 'inline source',
        usage: '4000/500 tokens'
      },
      {
        step: 'LLM',
        providerModel: 'openai/gpt-4.1-mini',
        promptSource: 'prompt.md',
        usage: '450/120 tokens'
      }
    ])
  })

  test('handles text-input multi-model writes without downstream prompt usage rows', () => {
    const metadata = {
      step3: [
        buildStep3({ llmService: 'openai', llmModel: 'gpt-4.1-mini', inputTokenCount: 100, outputTokenCount: 20, outputFileName: 'text-openai.json' }),
        buildStep3({ llmService: 'gemini', llmModel: 'gemini-2.5-flash', inputTokenCount: 120, outputTokenCount: 25, outputFileName: 'text-gemini.json' })
      ],
      cost: {
        estimated: {
          totalCost: 3,
          steps: [
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 1.5 },
            { step: 'llm', provider: 'gemini', model: 'gemini-2.5-flash', cost: 1.5 }
          ]
        },
        actual: {
          totalCost: 3.3,
          steps: [
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 1.6 },
            { step: 'llm', provider: 'gemini', model: 'gemini-2.5-flash', cost: 1.7 }
          ]
        }
      },
      timing: {
        estimated: {
          totalProcessingTimeMs: 4_000,
          steps: [
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 2_000, inputMetric: 'tokens', inputValue: 120 },
            { step: 'llm', provider: 'gemini', model: 'gemini-2.5-flash', processingTimeMs: 2_000, inputMetric: 'tokens', inputValue: 145 }
          ]
        },
        actual: {
          totalProcessingTimeMs: 3_000,
          steps: [
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 1_250, inputMetric: 'tokens', inputValue: 120 },
            { step: 'llm', provider: 'gemini', model: 'gemini-2.5-flash', processingTimeMs: 1_750, inputMetric: 'tokens', inputValue: 145 }
          ]
        }
      }
    } satisfies Record<string, unknown>

    const summary = buildWriteManifestConsoleSummary(metadata, { promptArtifact: 'prompt.md' })

    expect(summary.runSummary?.rows.map(row => row.providerModel)).toEqual([
      'openai/gpt-4.1-mini',
      'gemini/gemini-2.5-flash'
    ])
    expect(summary.promptUsage?.rows).toEqual([
      {
        step: 'LLM',
        providerModel: 'openai/gpt-4.1-mini',
        promptSource: 'prompt.md',
        usage: '100/20 tokens'
      },
      {
        step: 'LLM',
        providerModel: 'gemini/gemini-2.5-flash',
        promptSource: 'prompt.md',
        usage: '120/25 tokens'
      }
    ])
  })

  test('matches whisper normalization and duplicate models by occurrence', () => {
    const metadata = {
      step2: {
        transcriptionService: 'whisper',
        transcriptionModel: '/tmp/models/ggml-tiny.bin | coreml:/tmp/models/ggml-tiny-encoder.mlmodelc',
        processingTime: 33_000,
        tokenCount: 900
      },
      step3: [
        buildStep3({ llmModel: 'gpt-4.1-mini', inputTokenCount: 100, outputTokenCount: 10, outputFileName: 'text-1.json' }),
        buildStep3({ llmModel: 'gpt-4.1-mini', inputTokenCount: 200, outputTokenCount: 20, outputFileName: 'text-2.json' })
      ],
      cost: {
        estimated: {
          totalCost: 6,
          steps: [
            { step: 'stt', provider: 'whisper', model: 'tiny', cost: 1 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 3 }
          ]
        },
        actual: {
          totalCost: 6.6,
          steps: [
            { step: 'stt', provider: 'whisper', model: 'tiny', cost: 1.1 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2.2 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 3.3 }
          ]
        }
      },
      timing: {
        estimated: {
          totalProcessingTimeMs: 38_000,
          steps: [
            { step: 'stt', provider: 'whisper', model: 'tiny', processingTimeMs: 60_000, inputMetric: 'durationSeconds', inputValue: 60 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 2_000, inputMetric: 'tokens', inputValue: 110 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 3_000, inputMetric: 'tokens', inputValue: 220 }
          ]
        },
        actual: {
          totalProcessingTimeMs: 37_000,
          steps: [
            { step: 'stt', provider: 'whisper', model: 'tiny', processingTimeMs: 33_000, inputMetric: 'durationSeconds', inputValue: 60 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 1_100, inputMetric: 'tokens', inputValue: 110 },
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 2_200, inputMetric: 'tokens', inputValue: 220 }
          ]
        }
      }
    } satisfies Record<string, unknown>

    const rows = buildWriteManifestConsoleSummary(metadata).runSummary?.rows ?? []
    expect(rows[0]?.providerModel).toBe('whisper.cpp/tiny')
    expect(rows[1]?.predictedCostCents).toBe(2)
    expect(rows[1]?.actualTimeMs).toBe(1_100)
    expect(rows[2]?.predictedCostCents).toBe(3)
    expect(rows[2]?.actualTimeMs).toBe(2_200)
  })

  test('renders blank cells when estimated or actual entries are missing', () => {
    const metadata = {
      step3: buildStep3({ inputTokenCount: 150, outputTokenCount: 50 }),
      cost: {
        actual: {
          totalCost: 2.25,
          steps: [
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', cost: 2.25 }
          ]
        }
      },
      timing: {
        actual: {
          totalProcessingTimeMs: 3_000,
          steps: [
            { step: 'llm', provider: 'openai', model: 'gpt-4.1-mini', processingTimeMs: 3_000, inputMetric: 'tokens', inputValue: 200 }
          ]
        }
      }
    } satisfies Record<string, unknown>

    const summary = buildWriteManifestConsoleSummary(metadata)

    expect(summary.runSummary?.rows).toEqual([
      {
        step: 'LLM',
        providerModel: 'openai/gpt-4.1-mini',
        predictedCostCents: null,
        actualCostCents: 2.25,
        predictedTimeMs: null,
        actualTimeMs: 3_000,
        predictedSpeed: null,
        actualSpeed: '66.7 tok/s',
        predictedInputMetric: null,
        predictedInputValue: null,
        actualInputMetric: 'tokens',
        actualInputValue: 200
      }
    ])
    expect(summary.runSummary?.humanTable.rows).toEqual([
      {
        step: 'LLM',
        providerModel: 'openai/gpt-4.1-mini',
        predCost: '',
        actCost: '2.25000¢',
        predTime: '',
        actTime: '3.0s',
        predSpeed: '',
        actSpeed: '66.7 tok/s'
      }
    ])
  })
})

describe('write manifest throughput formatting', () => {
  test('formats throughput for each supported metric type', () => {
    expect(formatWriteManifestThroughput('durationSeconds', 30, 15_000)).toBe('2x')
    expect(formatWriteManifestThroughput('tokens', 500, 2_000)).toBe('250 tok/s')
    expect(formatWriteManifestThroughput('characters', 1_200, 4_000)).toBe('300 char/s')
    expect(formatWriteManifestThroughput('pages', 12, 60_000)).toBe('12 p/min')
    expect(formatWriteManifestThroughput('images', 3, 90_000)).toBe('2 img/min')
    expect(formatWriteManifestThroughput('tokens', 0, 1_000)).toBeNull()
  })
})

describe('write manifest logging', () => {
  test('emits tables with structured metadata and keeps raw json at debug level', () => {
    const { events, logger } = createCollector()
    const metadata = buildMediaMetadata()

    logWriteManifestConsoleSummary('output/run', metadata, {
      promptArtifact: 'prompt.md',
      step3RenderedOutput: 'text.md'
    }, logger)

    const infoMessages = events.filter(event => event.level === 'info').map(event => event.message)
    expect(infoMessages).toEqual([
      'Locations',
      'Run Summary',
      'Prompt Usage'
    ])
    expect(events[0]?.humanTable?.rows).toEqual([
      { artifact: 'runManifest', path: 'output/run/run.json' }
    ])
    expect(events[0]?.metadata).toEqual({
      path: 'output/run/run.json',
      kind: 'write'
    })
    expect(events[1]?.humanTable?.rows).toHaveLength(4)
    expect(events[1]?.metadata?.['rows']).toEqual(buildWriteManifestConsoleSummary(metadata, {
      promptArtifact: 'prompt.md',
      step3RenderedOutput: 'text.md'
    }).runSummary?.rows)
    expect(events[2]?.humanTable?.rows).toHaveLength(4)
    expect(events[2]?.metadata?.['rows']).toEqual(buildWriteManifestConsoleSummary(metadata, {
      promptArtifact: 'prompt.md',
      step3RenderedOutput: 'text.md'
    }).promptUsage?.rows)

    const debugMessages = events.filter(event => event.level === 'debug').map(event => event.message)
    expect(debugMessages).toHaveLength(1)
    expect(debugMessages[0]).toContain('"kind": "write"')
    expect(infoMessages.some(message => message.startsWith('Run manifest:\n{'))).toBe(false)
  })
})
