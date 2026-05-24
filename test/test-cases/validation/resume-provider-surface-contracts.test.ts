import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resumeFlags } from '~/cli/flags'
import { sttFlags } from '~/cli/flags/stt-flags'
import { ocrCommandFlags } from '~/cli/flags/ocr-flags'
import { ttsFlags } from '~/cli/flags/tts-flags'
import { imageGenFlags } from '~/cli/flags/image-flags'
import { videoGenFlags } from '~/cli/flags/video-flags'
import { musicGenFlags } from '~/cli/flags/music-flags'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { normalizeResumeSelectorFlagsForTarget } from '~/cli/commands/process-steps/resume/resume-dispatch'
import { hasResumableTtsWork } from '~/cli/commands/process-steps/step-4-tts/resume'
import { hasResumableImageWork } from '~/cli/commands/process-steps/step-5-image/resume'
import { hasResumableVideoWork } from '~/cli/commands/process-steps/step-6-video/resume'
import { hasResumableMusicWork } from '~/cli/commands/process-steps/step-7-music/resume'
import type { ResumeTarget, RuntimeOptions } from '~/types'

const without = (
  flags: Record<string, unknown>,
  omitted: readonly string[]
): string[] => Object.keys(flags).filter((name) => !omitted.includes(name))

const expectResumeHasFlags = (flags: readonly string[]): void => {
  for (const flag of flags) {
    expect(resumeFlags, `resumeFlags should include --${flag}`).toHaveProperty(flag)
  }
}

const target = (
  kind: ResumeTarget['kind'],
  dir = '/tmp/autoshow-resume-test',
  extractRoute?: ResumeTarget['extractRoute']
): ResumeTarget => ({
  kind,
  ...(extractRoute ? { extractRoute } : {}),
  scope: 'single',
  dir,
  manifestPath: join(dir, 'run.json')
})

const buildOpts = (
  flags: Record<string, unknown>,
  explicit: Set<string>,
  rawArgs: string[]
): RuntimeOptions =>
  buildOptsFromFlags(false, flags, [], {}, explicit, rawArgs)

const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('resume provider flag surface', () => {
  test('resume exposes canonical resumable flag groups and excludes non-resume flags', () => {
    expectResumeHasFlags(without(sttFlags, ['batch-limit', 'batch-all', 'batch-order', 'price']))
    expectResumeHasFlags(without(ocrCommandFlags, [
      'batch-limit',
      'batch-all',
      'batch-order',
      'all-url',
      'url-backend',
      'url-provider-concurrency',
      'url-request-timeout-ms',
      'url-request-attempts',
      'primary-ocr',
      'price'
    ]))
    expectResumeHasFlags(without(ttsFlags, [
      'price',
      'all-tts',
      'tts-provider-concurrency',
      'tts-local-concurrency',
      'kitten-tts',
      'elevenlabs-tts',
      'minimax-tts',
      'groq-tts',
      'grok-tts',
      'mistral-tts',
      'openai-tts',
      'gemini-tts',
      'deepgram-tts',
      'speechify-tts',
      'hume-tts',
      'cartesia-tts',
      'kitten-voice',
      'minimax-tts-voice',
      'minimax-tts-speed',
      'openai-voice',
      'openai-tts-instructions',
      'openai-tts-speed',
      'openai-tts-ref-audio',
      'openai-tts-consent-audio',
      'openai-tts-consent-language',
      'openai-tts-consent-name',
      'openai-tts-voice-name',
      'gemini-voice',
      'deepgram-voice',
      'deepgram-tts-speed',
      'speechify-voice',
      'speechify-tts-language',
      'speechify-tts-ref-audio',
      'speechify-tts-voice-name',
      'speechify-tts-consent-name',
      'speechify-tts-consent-email',
      'hume-tts-voice',
      'cartesia-tts-voice',
      'cartesia-tts-language',
      'grok-tts-voice',
      'grok-tts-language',
      'grok-tts-text-normalization',
      'groq-voice',
      'mistral-tts-voice',
      'mistral-tts-ref-audio',
      'mistral-tts-voice-name',
      'elevenlabs-voice',
      'elevenlabs-tts-ref-audio',
      'elevenlabs-tts-voice-name',
      'elevenlabs-tts-language-code',
      'elevenlabs-tts-speed',
      'elevenlabs-tts-text-normalization',
      'minimax-tts-english-normalization',
      'elevenlabs-tts-output-format',
      'speechify-tts-audio-format',
      'deepgram-tts-encoding',
    ]))
    expectResumeHasFlags([
      'tts-voice', 'tts-speed', 'tts-language', 'tts-ref-audio',
      'tts-voice-name', 'tts-consent-audio', 'tts-consent-language',
      'tts-consent-name', 'tts-consent-email', 'tts-text-normalization',
      'tts-instructions', 'tts-output-format'
    ])
    expectResumeHasFlags(without(imageGenFlags, ['price']))
    expectResumeHasFlags(without(videoGenFlags, ['price']))
    expectResumeHasFlags(without(musicGenFlags, ['price']))

    for (const excluded of ['price', 'batch-limit', 'batch-all', 'batch-order', 'all-url', 'url-backend', 'url-provider-concurrency', 'url-request-timeout-ms', 'url-request-attempts', 'output-dir']) {
      expect(resumeFlags, `resumeFlags should not include --${excluded}`).not.toHaveProperty(excluded)
    }
  })

  test('resume accepts generic TTS flags and provider-specific flags without generic equivalents', () => {
    expectResumeHasFlags([
      'tts-voice', 'tts-speed', 'tts-language', 'tts-ref-audio',
      'tts-voice-name', 'tts-consent-audio', 'tts-consent-language',
      'tts-consent-name', 'tts-consent-email', 'tts-text-normalization',
      'tts-instructions', 'tts-output-format',
      'elevenlabs-tts-stability', 'elevenlabs-tts-similarity-boost',
      'openai-tts-consent-id', 'hume-tts-voice-provider',
      'minimax-tts-language-boost', 'minimax-tts-emotion',
    ])
  })

  test('resume accepts video mode, input, and storage flags', () => {
    expectResumeHasFlags([
      'video-mode',
      'video-input-image',
      'video-last-frame',
      'video-reference-image',
      'video-input-video',
      'grok-video-storage-filename',
      'grok-video-storage-expires-after'
    ])
  })
})

describe('resume target-aware provider selectors', () => {
  test('normalizes --provider and generic TTS options for TTS resume targets', () => {
    const tts = normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { provider: ['kitten=kitten-tts-nano'], 'tts-voice': ['Luna'] },
      new Set(['provider', 'tts-voice']),
      ['resume', 'out', '--provider', 'kitten=kitten-tts-nano', '--tts-voice', 'Luna']
    )
    expect(tts.flags['kitten-tts']).toBe('kitten-tts-nano')
    expect(tts.flags['kitten-voice']).toBe('Luna')
    expect(tts.explicitFlags.has('kitten-tts')).toBe(true)
    expect(tts.explicitFlags.has('kitten-voice')).toBe(true)
  })

  test('normalizes --provider for generation resume targets', () => {
    const image = normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { provider: ['openai=gpt-image-2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'openai=gpt-image-2']
    )
    expect(image.flags['openai-image']).toBe('gpt-image-2')
    expect(buildOpts(image.flags, image.explicitFlags, image.rawArgs).openaiImageModels).toEqual(['gpt-image-2'])

    const video = normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['runway=gen4.5'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'runway=gen4.5']
    )
    expect(video.flags['runway-video']).toBe('gen4.5')
    expect(buildOpts(video.flags, video.explicitFlags, video.rawArgs).runwayVideoModels).toEqual(['gen4.5'])

    const music = normalizeResumeSelectorFlagsForTarget(
      target('music'),
      { provider: ['elevenlabs=music_v1'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'elevenlabs=music_v1']
    )
    expect(music.flags['elevenlabs-music']).toBe('music_v1')
    expect(buildOpts(music.flags, music.explicitFlags, music.rawArgs).elevenlabsMusicModels).toEqual(['music_v1'])
  })

  test('normalizes extract --provider selectors by route', () => {
    const stt = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-media', 'media'),
      { provider: ['deepgram=nova-3'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'deepgram=nova-3']
    )
    expect(stt.flags['deepgram-stt']).toBe('nova-3')
    expect(stt.flags['deepinfra-ocr']).toBeUndefined()
    expect(buildOpts(stt.flags, stt.explicitFlags, stt.rawArgs).deepgramSttModels).toEqual(['nova-3'])

    const ocr = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { provider: ['deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct']
    )
    expect(ocr.flags['deepinfra-ocr']).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(ocr.flags['deepgram-stt']).toBeUndefined()
    expect(buildOpts(ocr.flags, ocr.explicitFlags, ocr.rawArgs).deepinfraOcrModels).toEqual(['Qwen/Qwen3-VL-30B-A3B-Instruct'])
  })

  test('rejects providers that do not apply to the resolved target', () => {
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['openai=gpt-image-2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'openai=gpt-image-2']
    )).toThrow('Unknown provider "openai" for --provider')
  })

  test('rejects legacy resume selector aliases', () => {
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { 'all-image': true },
      new Set(['all-image']),
      ['resume', 'out', '--all-image']
    )).toThrow('--all-image is no longer supported for resume')

    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { 'gemini-image': 'gemini-3.1-flash-image-preview' },
      new Set(['gemini-image']),
      ['resume', 'out', '--gemini-image', 'gemini-3.1-flash-image-preview']
    )).toThrow('--gemini-image is no longer supported for resume')

    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { openai: 'gpt-5.4-mini' },
      new Set(['openai']),
      ['resume', 'out', '--openai', 'gpt-5.4-mini']
    )).toThrow('--openai is no longer supported for resume')
  })
})

describe('resume all-shortcut additive selection', () => {
  test('explicit all shortcuts make full generation runs resumable without provider calls', async () => {
    await withTempDir('autoshow-resume-all-shortcuts-', async (dir) => {
      const cases = [
        {
          kind: 'tts' as const,
          metadataKey: 'tts',
          requestedProvider: { service: 'kitten', model: 'kitten-tts-mini' },
          metadata: {
            ttsService: 'kitten',
            ttsModel: 'kitten-tts-mini',
            processingTime: 1,
            audioFileName: 'speech.wav',
            audioFileSize: 1,
            chunkCount: 1
          },
          hasWork: hasResumableTtsWork
        },
        {
          kind: 'image' as const,
          metadataKey: 'image',
          requestedProvider: { service: 'gemini', model: 'gemini-3.1-flash-image-preview' },
          metadata: {
            imageService: 'gemini',
            imageModel: 'gemini-3.1-flash-image-preview',
            processingTime: 1,
            imageFileNames: ['generated-image.png'],
            imageCount: 1,
            imageFileSize: 1,
            imageWidth: 1,
            imageHeight: 1,
            requestMode: 'generation'
          },
          hasWork: hasResumableImageWork
        },
        {
          kind: 'video' as const,
          metadataKey: 'video',
          requestedProvider: { service: 'gemini', model: 'veo-3.1-fast-generate-preview' },
          metadata: {
            videoGenService: 'gemini',
            videoGenModel: 'veo-3.1-fast-generate-preview',
            processingTime: 1,
            videoFileName: 'generated-video.mp4',
            videoFileSize: 1,
            videoDuration: 5
          },
          hasWork: hasResumableVideoWork
        },
        {
          kind: 'music' as const,
          metadataKey: 'music',
          requestedProvider: { service: 'elevenlabs', model: 'music_v1' },
          metadata: {
            musicService: 'elevenlabs',
            musicModel: 'music_v1',
            processingTime: 1,
            musicFileName: 'music.mp3',
            musicFileSize: 1,
            musicDurationMs: 1000,
            lyricsSource: 'none'
          },
          hasWork: hasResumableMusicWork
        }
      ]

      for (const entry of cases) {
        const runDir = join(dir, entry.kind)
        await mkdir(runDir, { recursive: true })
        await writeRunManifest(runDir, entry.kind, {
          input: 'prompt',
          requestedProviders: [entry.requestedProvider],
          [entry.metadataKey]: [entry.metadata]
        })
        const explicit = new Set(['all-providers'])
        const normalized = normalizeResumeSelectorFlagsForTarget(
          target(entry.kind, runDir),
          { 'all-providers': true },
          explicit,
          ['resume', runDir, '--all-providers']
        )
        const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.rawArgs)
        await expect(entry.hasWork(target(entry.kind, runDir), opts, normalized.explicitFlags)).resolves.toBe(true)
      }
    })
  })
})
