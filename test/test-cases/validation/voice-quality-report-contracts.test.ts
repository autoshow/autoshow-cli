import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  aggregateWeightedScore,
  mosToPercentScore,
  rankVoiceQualityProviders
} from '~/utils/voice-quality-scoring'
import {
  buildVoiceQualityReport,
  buildOpenAiAudioJudgeRequestBody,
  parseOpenAiAudioJudgeResponseContent
} from '~/cli/commands/setup-and-utilities/benchmark/tts-voice-quality-report'
import { runCommand } from '../../test-utils/test-helpers'

const tempDirs: string[] = []
const originalFetch = globalThis.fetch
const envKeys = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'ASSEMBLYAI_API_KEY', 'ASSEMBLYAI_BASE_URL'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<typeof envKeys[number], string | undefined>

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

const makeMockFetch = (
  fn: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>
): typeof fetch => Object.assign(fn, { preconnect: () => undefined }) as typeof fetch

const writeSyntheticWav = async (
  path: string,
  options: { durationSeconds: number, amplitude: number, frequencyHz: number }
): Promise<void> => {
  const sampleRate = 16000
  const sampleCount = Math.floor(sampleRate * options.durationSeconds)
  const bytesPerSample = 2
  const dataSize = sampleCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < sampleCount; index += 1) {
    const seconds = index / sampleRate
    const envelope = seconds < 0.08 || seconds > options.durationSeconds - 0.08 ? 0 : 1
    const sample = Math.round(Math.sin(2 * Math.PI * options.frequencyHz * seconds) * options.amplitude * envelope * 32767)
    buffer.writeInt16LE(sample, 44 + index * bytesPerSample)
  }

  await writeFile(path, buffer)
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  for (const key of envKeys) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const makeSingleProviderTtsRun = async (): Promise<{
  runDir: string
  inputText: string
}> => {
  const runDir = await makeTempRoot('autoshow-voice-quality-strict-')
  const inputText = 'Hello world. This sample checks strict paid scoring behavior for text to speech benchmarks.'
  await writeFile(join(runDir, 'input.txt'), `${inputText}\n`)
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'tts',
    metadata: {
      input: inputText,
      tts: [
        {
          ttsService: 'gcloud',
          ttsModel: 'chirp3-hd',
          speaker: 'en-US-Chirp3-HD-Charon',
          processingTime: 1000,
          audioFileName: 'speech-gcloud-chirp3-hd.wav',
          audioFileSize: 100,
          chunkCount: 1
        }
      ]
    }
  })
  await writeSyntheticWav(join(runDir, 'speech-gcloud-chirp3-hd.wav'), {
    durationSeconds: 4.5,
    amplitude: 0.35,
    frequencyHz: 220
  })
  return { runDir, inputText }
}

const buildSingleProviderReport = async (
  runDir: string,
  inputText: string,
  overrides?: Partial<Parameters<typeof buildVoiceQualityReport>[0]>
) => buildVoiceQualityReport({
  runDir,
  inputText,
  inputTextLabel: 'test-input',
  mode: 'full',
  allowPaid: true,
  metricFixturesPath: null,
  roundtripDir: null,
  markdownOut: null,
  jsonOut: null,
  keepTemp: false,
  audioJudgeModel: 'gpt-audio',
  ...overrides
})

describe('voice quality scoring contracts', () => {
  test('normalizes MOS scores and aggregates missing weighted components', () => {
    expect(mosToPercentScore(1)).toBe(0)
    expect(mosToPercentScore(3)).toBe(50)
    expect(mosToPercentScore(5)).toBe(100)
    expect(mosToPercentScore(6)).toBe(100)
    expect(mosToPercentScore(0)).toBe(0)
    expect(mosToPercentScore(null)).toBeNull()

    const aggregate = aggregateWeightedScore([
      { key: 'available-high', score: 80, weight: 0.5 },
      { key: 'missing', score: null, weight: 0.25 },
      { key: 'available-low', score: 40, weight: 0.25 }
    ])

    expect(aggregate.score).toBeCloseTo(66.666666, 5)
    expect(aggregate.availableWeight).toBe(0.75)
    expect(aggregate.totalWeight).toBe(1)
    expect(aggregate.missingKeys).toEqual(['missing'])
  })

  test('ranks providers deterministically when scores tie', () => {
    const ranked = rankVoiceQualityProviders([
      { providerKey: 'z/provider', humanSpeechScore: 80, naturalnessScore: 80, speechQualityScore: 80 },
      { providerKey: 'a/provider', humanSpeechScore: 80, naturalnessScore: 80, speechQualityScore: 80 },
      { providerKey: 'm/provider', humanSpeechScore: 90, naturalnessScore: 70, speechQualityScore: 70 }
    ])

    expect(ranked.map((provider) => [provider.rank, provider.providerKey])).toEqual([
      [1, 'm/provider'],
      [2, 'a/provider'],
      [3, 'z/provider']
    ])
  })

  test('OpenAI audio judge request body uses audio input without response_format', () => {
    const body = buildOpenAiAudioJudgeRequestBody({
      model: 'gpt-audio',
      audioBase64: 'UklGRg==',
      inputText: 'Hello world.'
    })

    expect(body['model']).toBe('gpt-audio')
    expect(body['store']).toBe(false)
    expect(body['modalities']).toEqual(['text', 'audio'])
    expect(body['audio']).toEqual({ voice: 'alloy', format: 'wav' })
    expect(body['response_format']).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('response_format')
    const messages = body['messages'] as Array<Record<string, unknown>>
    const userContent = messages[1]?.['content'] as Array<Record<string, unknown>>
    expect(userContent.find((part) => part['type'] === 'input_audio')).toEqual({
      type: 'input_audio',
      input_audio: {
        data: 'UklGRg==',
        format: 'wav'
      }
    })
    expect(JSON.stringify(body)).toContain('Return exactly one compact JSON object')
  })

  test('OpenAI audio judge parser accepts fenced or prose-wrapped JSON', () => {
    const parsed = parseOpenAiAudioJudgeResponseContent([
      'Based on the supplied sample, here is the score:',
      '```json',
      '{"naturalnessScore":87,"pronunciationScore":90,"prosodyScore":82,"artifactScore":95,"confidence":0.74,"notes":"steady"}',
      '```'
    ].join('\n'))

    expect(parsed['naturalnessScore']).toBe(87)
    expect(parsed['confidence']).toBe(0.74)
  })

  test('OpenAI audio judge parser reports non-JSON prose clearly', () => {
    expect(() => parseOpenAiAudioJudgeResponseContent('Please provide the audio file to evaluate.')).toThrow(
      'OpenAI audio judge returned text without a JSON object'
    )
  })

  test('full TTS mode reads OpenAI audio judge JSON from audio transcript when content is null', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    const fixturesPath = join(runDir, 'voice-quality-fixtures.json')
    await writeJson(fixturesPath, {
      providers: {
        'gcloud/chirp3-hd': {
          stt: {
            'openai-stt/gpt-4o-transcribe': inputText
          }
        }
      }
    })
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    delete process.env['ASSEMBLYAI_API_KEY']
    let fetchCount = 0

    globalThis.fetch = makeMockFetch(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      fetchCount += 1
      expect(String(input)).toContain('/chat/completions')
      const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      expect(requestBody['modalities']).toEqual(['text', 'audio'])
      expect(requestBody['audio']).toEqual({ voice: 'alloy', format: 'wav' })
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: null,
              audio: {
                transcript: '{"naturalnessScore":91,"pronunciationScore":89,"prosodyScore":88,"artifactScore":94,"confidence":0.82,"notes":"clear"}'
              }
            }
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      metricFixturesPath: fixturesPath
    })

    expect(fetchCount).toBe(1)
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.score).toBe(91)
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.details).toMatchObject({
      pronunciationScore: 89,
      prosodyScore: 88,
      artifactScore: 94,
      confidence: 0.82
    })
  })

  test('full TTS mode fails when OpenAI audio judge returns prose-only text', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    delete process.env['ASSEMBLYAI_API_KEY']

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: 'Please provide the audio file to evaluate.'
          }
        }
      ]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))

    await expect(buildSingleProviderReport(runDir, inputText)).rejects.toThrow(
      'gcloud/chirp3-hd: OpenAI audio judge failed: OpenAI audio judge returned text without a JSON object'
    )
  })

  test('full TTS mode fails when a configured paid STT call fails', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    delete process.env['OPENAI_API_KEY']
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'

    globalThis.fetch = makeMockFetch(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      expect(String(input)).toContain('/v2/upload')
      return new Response('upload unavailable', { status: 503 })
    })

    await expect(buildSingleProviderReport(runDir, inputText)).rejects.toThrow(
      'gcloud/chirp3-hd: AssemblyAI roundtrip STT failed: AssemblyAI upload failed (503): upload unavailable'
    )
  })

  test('full TTS mode does not fail when paid credentials are absent', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    let fetchCount = 0
    delete process.env['OPENAI_API_KEY']
    delete process.env['ASSEMBLYAI_API_KEY']

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => {
      fetchCount += 1
      throw new Error('paid endpoint should not be called')
    })

    const report = await buildSingleProviderReport(runDir, inputText)

    expect(fetchCount).toBe(0)
    expect(report.reportJson.providerCount).toBe(1)
    expect(report.reportJson.providers[0]?.missingMetrics).toContain('naturalness.paidAudioJudgeRubric')
    expect(report.reportJson.providers[0]?.missingMetrics).toContain('speechQuality.roundtripSttIntelligibility')
  })

  test('local TTS mode ignores paid credentials and never calls paid endpoints', async () => {
    const { runDir, inputText } = await makeSingleProviderTtsRun()
    let fetchCount = 0
    process.env['OPENAI_API_KEY'] = 'test-openai-key'
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'

    globalThis.fetch = makeMockFetch(async (): Promise<Response> => {
      fetchCount += 1
      throw new Error('paid endpoint should not be called')
    })

    const report = await buildSingleProviderReport(runDir, inputText, {
      mode: 'local',
      allowPaid: false
    })

    expect(fetchCount).toBe(0)
    expect(report.reportJson.mode).toBe('local')
    expect(report.reportJson.providers[0]?.componentScores.naturalness['paidAudioJudgeRubric']?.source).toBe('paid-audio-judge-omitted')
  })

  test('benchmark --tts builds JSON and markdown reports with mocked model and STT metrics', async () => {
    const runDir = await makeTempRoot('autoshow-voice-quality-')
    const inputText = 'Hello world. This sample checks speech quality scoring with clear words and stable pacing.'
    const inputTextPath = join(runDir, 'input.txt')
    await writeFile(inputTextPath, `${inputText}\n`)

    const ttsEntries = [
      {
        ttsService: 'kitten',
        ttsModel: 'kitten-tts-nano',
        speaker: 'Jasper',
        processingTime: 1000,
        audioFileName: 'speech-kitten-kitten-tts-nano.wav',
        audioFileSize: 100,
        chunkCount: 1
      },
      {
        ttsService: 'openai',
        ttsModel: 'gpt-4o-mini-tts',
        speaker: 'alloy',
        processingTime: 900,
        audioFileName: 'speech-openai-gpt-4o-mini-tts.wav',
        audioFileSize: 100,
        chunkCount: 1
      },
      {
        ttsService: 'elevenlabs',
        ttsModel: 'eleven_v3',
        speaker: 'Rachel',
        processingTime: 800,
        audioFileName: 'speech-elevenlabs-eleven_v3.wav',
        audioFileSize: 100,
        chunkCount: 1
      }
    ]

    await writeJson(join(runDir, 'run.json'), {
      schemaVersion: 2,
      kind: 'tts',
      metadata: {
        input: inputText,
        tts: ttsEntries,
        timing: {
          actual: {
            steps: ttsEntries.map((entry) => ({
              provider: entry.ttsService,
              model: entry.ttsModel,
              processingTimeMs: entry.processingTime
            }))
          }
        }
      }
    })

    await mkdir(runDir, { recursive: true })
    await writeSyntheticWav(join(runDir, 'speech-kitten-kitten-tts-nano.wav'), {
      durationSeconds: 4.5,
      amplitude: 0.35,
      frequencyHz: 220
    })
    await writeSyntheticWav(join(runDir, 'speech-openai-gpt-4o-mini-tts.wav'), {
      durationSeconds: 4.7,
      amplitude: 0.32,
      frequencyHz: 260
    })
    await writeSyntheticWav(join(runDir, 'speech-elevenlabs-eleven_v3.wav'), {
      durationSeconds: 5.0,
      amplitude: 0.28,
      frequencyHz: 180
    })

    const fixturesPath = join(runDir, 'voice-quality-fixtures.json')
    await writeJson(fixturesPath, {
      providers: {
        'kitten/kitten-tts-nano': {
          utmosv2Mos: 4.2,
          nisqaTtsNaturalnessMos: 4.1,
          nisqaQualityMos: 4,
          dnsmosMos: 4,
          paidAudioJudge: { naturalnessScore: 82, confidence: 0.8 },
          stt: {
            'assemblyai/universal-3-pro': inputText,
            'openai-stt/gpt-4o-transcribe': inputText
          }
        },
        'openai/gpt-4o-mini-tts': {
          utmosv2Mos: 4.8,
          nisqaTtsNaturalnessMos: 4.6,
          nisqaQualityMos: 4.5,
          dnsmosMos: 4.6,
          paidAudioJudge: { naturalnessScore: 93, confidence: 0.9 },
          stt: {
            'assemblyai/universal-3-pro': inputText,
            'openai-stt/gpt-4o-transcribe': inputText
          }
        },
        'elevenlabs/eleven_v3': {
          utmosv2Mos: 2.6,
          nisqaTtsNaturalnessMos: 2.5,
          nisqaQualityMos: 2.7,
          dnsmosMos: 2.8,
          paidAudioJudge: { naturalnessScore: 45, confidence: 0.7 },
          stt: {
            'assemblyai/universal-3-pro': 'Hello world this sample missed several important words.',
            'openai-stt/gpt-4o-transcribe': 'Hello world this sample missed several important words.'
          }
        }
      }
    })

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'benchmark',
      runDir,
      '--tts',
      '--tts-mode',
      'local',
      '--tts-metric-fixtures',
      fixturesPath
    ], {
      env: {
        NO_COLOR: '1',
        OPENAI_API_KEY: '',
        ASSEMBLYAI_API_KEY: ''
      }
    })

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('TTS Benchmark Report')

    const report = await Bun.file(join(runDir, 'voice-quality-report.json')).json() as {
      metric: string
      providerCount: number
      local: { count: number }
      cloud: { count: number }
      weights: {
        naturalnessScore: { utmosv2Mos: number }
        speechQualityScore: { roundtripSttIntelligibility: number }
      }
      providers: Array<{
        rank: number
        providerKey: string
        humanSpeechScore: number
        componentScores: {
          naturalness: { utmosv2Mos: { mos: number }, paidAudioJudgeRubric: { score: number } }
          speechQuality: { roundtripSttIntelligibility: { score: number } }
        }
        missingMetrics: string[]
      }>
    }

    expect(report.metric).toBe('human-speech-quality')
    expect(report.providerCount).toBe(3)
    expect(report.local.count).toBe(1)
    expect(report.cloud.count).toBe(2)
    expect(report.weights.naturalnessScore.utmosv2Mos).toBe(0.45)
    expect(report.weights.speechQualityScore.roundtripSttIntelligibility).toBe(0.25)
    expect(report.providers[0]?.providerKey).toBe('openai/gpt-4o-mini-tts')
    expect(report.providers[0]?.componentScores.naturalness.utmosv2Mos.mos).toBe(4.8)
    expect(report.providers[0]?.componentScores.naturalness.paidAudioJudgeRubric.score).toBe(93)
    expect(report.providers[0]?.componentScores.speechQuality.roundtripSttIntelligibility.score).toBe(100)
    expect(report.providers[0]?.missingMetrics).toEqual([])
    expect(report.providers[2]?.providerKey).toBe('elevenlabs/eleven_v3')

    const markdown = await Bun.file(join(runDir, 'voice-quality-report.md')).text()
    expect(markdown).toContain('# TTS Voice Quality Report')
    expect(markdown).toContain('Cost, provider processing speed, and provider latency are not included')
    expect(markdown).toContain('`openai/gpt-4o-mini-tts`')
  })
})
