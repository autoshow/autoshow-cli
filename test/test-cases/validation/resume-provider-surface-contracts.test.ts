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
      'primary-ocr',
      'price'
    ]))
    expectResumeHasFlags(without(ttsFlags, ['price']))
    expectResumeHasFlags(without(imageGenFlags, ['price']))
    expectResumeHasFlags(without(videoGenFlags, ['price']))
    expectResumeHasFlags(without(musicGenFlags, ['price']))

    for (const excluded of ['price', 'batch-limit', 'batch-all', 'batch-order', 'all-url', 'url-backend', 'url-provider-concurrency', 'output-dir']) {
      expect(resumeFlags, `resumeFlags should not include --${excluded}`).not.toHaveProperty(excluded)
    }
  })

  test('resume accepts newer TTS provider and control flags', () => {
    expectResumeHasFlags([
      'grok-tts',
      'grok-tts-voice',
      'grok-tts-language',
      'grok-tts-text-normalization',
      'speechify-tts',
      'speechify-voice',
      'speechify-tts-audio-format',
      'speechify-tts-ref-audio',
      'gcloud-tts',
      'gcloud-tts-voice',
      'gcloud-tts-language',
      'gcloud-tts-ref-audio',
      'gcloud-tts-consent-audio',
      'gcloud-tts-voice-cloning-key',
      'deapi-tts',
      'deapi-tts-voice',
      'deapi-tts-ref-audio',
      'deapi-tts-instruction'
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

describe('resume target-aware public selector aliases', () => {
  test('normalizes public aliases for generation resume targets', () => {
    const tts = normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { gcloud: 'chirp3-hd' },
      new Set(['gcloud']),
      ['resume', 'out', '--gcloud', 'chirp3-hd']
    )
    expect(tts.flags['gcloud-tts']).toBe('chirp3-hd')
    expect(tts.explicitFlags.has('gcloud-tts')).toBe(true)
    expect(buildOpts(tts.flags, tts.explicitFlags, tts.rawArgs).gcloudTtsModels).toEqual(['chirp3-hd'])

    const image = normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { openai: 'gpt-image-2' },
      new Set(['openai']),
      ['resume', 'out', '--openai', 'gpt-image-2']
    )
    expect(image.flags['openai-image']).toBe('gpt-image-2')
    expect(buildOpts(image.flags, image.explicitFlags, image.rawArgs).openaiImageModels).toEqual(['gpt-image-2'])

    const video = normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { runway: 'gen4.5' },
      new Set(['runway']),
      ['resume', 'out', '--runway', 'gen4.5']
    )
    expect(video.flags['runway-video']).toBe('gen4.5')
    expect(buildOpts(video.flags, video.explicitFlags, video.rawArgs).runwayVideoModels).toEqual(['gen4.5'])

    const music = normalizeResumeSelectorFlagsForTarget(
      target('music'),
      { elevenlabs: 'music_v1' },
      new Set(['elevenlabs']),
      ['resume', 'out', '--elevenlabs', 'music_v1']
    )
    expect(music.flags['elevenlabs-music']).toBe('music_v1')
    expect(buildOpts(music.flags, music.explicitFlags, music.rawArgs).elevenlabsMusicModels).toEqual(['music_v1'])
  })

  test('normalizes extract public aliases by route', () => {
    const stt = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-media', 'media'),
      { gcloud: 'chirp_3' },
      new Set(['gcloud']),
      ['resume', 'out', '--gcloud', 'chirp_3']
    )
    expect(stt.flags['gcloud-stt']).toBe('chirp_3')
    expect(stt.flags['gcloud-docai']).toBeUndefined()
    expect(buildOpts(stt.flags, stt.explicitFlags, stt.rawArgs).gcloudSttModels).toEqual(['chirp_3'])

    const ocr = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { gcloud: 'ocr' },
      new Set(['gcloud']),
      ['resume', 'out', '--gcloud', 'ocr']
    )
    expect(ocr.flags['gcloud-docai']).toBe('ocr')
    expect(ocr.flags['gcloud-stt']).toBeUndefined()
    expect(buildOpts(ocr.flags, ocr.explicitFlags, ocr.rawArgs).gcloudDocaiModels).toEqual(['ocr'])
  })

  test('rejects selectors that do not apply to the resolved target', () => {
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { openai: 'gpt-image-2' },
      new Set(['openai']),
      ['resume', 'out', '--openai', 'gpt-image-2']
    )).toThrow('--openai does not apply to video resume targets')

    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { 'all-image': true },
      new Set(['all-image']),
      ['resume', 'out', '--all-image']
    )).toThrow('--all-image does not apply to TTS resume targets')
  })
})

describe('resume all-shortcut additive selection', () => {
  test('explicit all shortcuts make full generation runs resumable without provider calls', async () => {
    await withTempDir('autoshow-resume-all-shortcuts-', async (dir) => {
      const cases = [
        {
          kind: 'tts' as const,
          flag: 'all-tts',
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
          flag: 'all-image',
          metadataKey: 'image',
          requestedProvider: { service: 'gemini', model: 'imagen-4.0-fast-generate-001' },
          metadata: {
            imageService: 'gemini',
            imageModel: 'imagen-4.0-fast-generate-001',
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
          flag: 'all-video',
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
          flag: 'all-music',
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
        const explicit = new Set([entry.flag])
        const opts = buildOpts({ [entry.flag]: true }, explicit, ['resume', runDir, `--${entry.flag}`])
        await expect(entry.hasWork(target(entry.kind, runDir), opts, explicit)).resolves.toBe(true)
      }
    })
  })
})
