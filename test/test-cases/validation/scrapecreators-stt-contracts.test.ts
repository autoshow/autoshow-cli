import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isScrapeCreatorsSupportedSourceUrl
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/scrapecreators/scrapecreators'
import {
  runScrapeCreatorsStt
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/scrapecreators/run-scrapecreators-stt'

const withTempOutputDir = async <T>(fn: (outputDir: string) => Promise<T>): Promise<T> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-scrapecreators-'))
  try {
    return await fn(outputDir)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

const restoreEnv = (
  key: string,
  value: string | undefined
): void => {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

describe('ScrapeCreators STT contracts', () => {
  test('source support is restricted to YouTube URLs', () => {
    expect(isScrapeCreatorsSupportedSourceUrl('https://www.youtube.com/watch?v=MORMZXEaONk')).toBe(true)
    expect(isScrapeCreatorsSupportedSourceUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isScrapeCreatorsSupportedSourceUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isScrapeCreatorsSupportedSourceUrl('https://example.com/audio.mp3')).toBe(false)
    expect(isScrapeCreatorsSupportedSourceUrl('/tmp/audio.mp3')).toBe(false)
    expect(isScrapeCreatorsSupportedSourceUrl(undefined)).toBe(false)
  })

  test('mocked success response normalizes text, timestamps, evidence, artifact, and billing', async () => {
    const previousKey = process.env['SCRAPECREATORS_API_KEY']
    const previousBaseUrl = process.env['SCRAPECREATORS_BASE_URL']
    const previousFetch = globalThis.fetch
    const calls: Array<{ url: string, headers: unknown }> = []

    try {
      process.env['SCRAPECREATORS_API_KEY'] = 'test-scrapecreators-key'
      process.env['SCRAPECREATORS_BASE_URL'] = 'https://mock.scrapecreators.local'
      globalThis.fetch = (async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ): Promise<Response> => {
        calls.push({ url: String(input), headers: init?.headers })
        return new Response(JSON.stringify({
          transcript: [
            { startMs: '0', endMs: '1250', startTimeText: '0:00', text: ' Hello world. ' },
            { startMs: '1250', endMs: '3000', startTimeText: '0:01', text: 'Next line.' }
          ],
          videoId: 'dQw4w9WgXcQ',
          transcript_only_text: 'Hello world. Next line.',
          captionTracks: [{ languageCode: 'es', name: 'Spanish' }]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }) as unknown as typeof fetch

      await withTempOutputDir(async (outputDir) => {
        const { result, metadata } = await runScrapeCreatorsStt('unused.mp3', outputDir, {
          model: 'youtube-transcript',
          sourceUrl: 'https://www.youtube.com/watch?v=MORMZXEaONk',
          language: 'es',
          segmentOffsetMinutes: 0
        })
        const requestedUrl = new URL(calls[0]?.url ?? '')
        const headers = calls[0]?.headers as Record<string, string>

        expect(requestedUrl.origin).toBe('https://mock.scrapecreators.local')
        expect(requestedUrl.pathname).toBe('/v1/youtube/video/transcript')
        expect(requestedUrl.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=MORMZXEaONk')
        expect(requestedUrl.searchParams.get('language')).toBe('es')
        expect(headers['x-api-key']).toBe('test-scrapecreators-key')
        expect(result.text).toBe('Hello world. Next line.')
        expect(result.segments).toEqual([
          { start: '00:00:00', end: '00:00:01', text: 'Hello world.' },
          { start: '00:00:01', end: '00:00:03', text: 'Next line.' }
        ])
        expect(result.evidence?.capabilities).toEqual({
          hasNativeWordTiming: false,
          hasConfidence: false,
          hasSpeakerLabels: false
        })
        expect(result.evidence?.timingQuality).toBe('coarse')
        expect(result.evidence?.words).toBeUndefined()
        expect(result.evidence?.segments).toEqual([
          { startSeconds: 0, endSeconds: 1.25, text: 'Hello world.' },
          { startSeconds: 1.25, endSeconds: 3, text: 'Next line.' }
        ])
        expect(result.evidence?.rawResponse).toMatchObject({
          videoId: 'dQw4w9WgXcQ',
          transcript_only_text: 'Hello world. Next line.',
          captionTracks: [{ languageCode: 'es', name: 'Spanish' }],
          transcript: [
            { startMs: 0, endMs: 1250, startTimeText: '0:00' },
            { startMs: 1250, endMs: 3000, startTimeText: '0:01' }
          ]
        })
        expect(metadata).toMatchObject({
          transcriptionService: 'scrapecreators',
          transcriptionModel: 'youtube-transcript',
          captionLanguage: 'es',
          billing: {
            creditsUsed: 1,
            creditRateCents: 0.188,
            totalCost: 0.188,
            source: 'fallback-estimate',
            mode: 'url'
          }
        })
        expect(metadata.timings?.requestCount).toBe(1)
        await expect(readFile(join(outputDir, 'transcription.txt'), 'utf8')).resolves.toBe(
          '[00:00:00] Hello world.\n[00:00:01] Next line.'
        )
      })
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SCRAPECREATORS_API_KEY', previousKey)
      restoreEnv('SCRAPECREATORS_BASE_URL', previousBaseUrl)
    }
  })

  test('malformed transcript timing strings fail as an invalid payload', async () => {
    const previousKey = process.env['SCRAPECREATORS_API_KEY']
    const previousBaseUrl = process.env['SCRAPECREATORS_BASE_URL']
    const previousFetch = globalThis.fetch
    const invalidPayload = {
      transcript: [
        { startMs: 'not-a-number', endMs: '1250', text: 'Bad timing.' }
      ]
    }

    try {
      process.env['SCRAPECREATORS_API_KEY'] = 'test-scrapecreators-key'
      process.env['SCRAPECREATORS_BASE_URL'] = 'https://mock.scrapecreators.local'
      globalThis.fetch = (async (): Promise<Response> =>
        new Response(JSON.stringify(invalidPayload), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      ) as unknown as typeof fetch

      await withTempOutputDir(async (outputDir) => {
        try {
          await runScrapeCreatorsStt('unused.mp3', outputDir, {
            model: 'youtube-transcript',
            sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
            language: 'en',
            segmentOffsetMinutes: 0
          })
          throw new Error('expected ScrapeCreators invalid transcript payload error')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain('invalid transcript payload')
          expect((error as { stage?: string }).stage).toBe('create')
          expect((error as { rawResponse?: unknown }).rawResponse).toEqual(invalidPayload)
        }
      })
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SCRAPECREATORS_API_KEY', previousKey)
      restoreEnv('SCRAPECREATORS_BASE_URL', previousBaseUrl)
    }
  })

  test('mocked transcript null response is skipped and non-retryable', async () => {
    const previousKey = process.env['SCRAPECREATORS_API_KEY']
    const previousBaseUrl = process.env['SCRAPECREATORS_BASE_URL']
    const previousFetch = globalThis.fetch

    try {
      process.env['SCRAPECREATORS_API_KEY'] = 'test-scrapecreators-key'
      process.env['SCRAPECREATORS_BASE_URL'] = 'https://mock.scrapecreators.local'
      globalThis.fetch = (async (): Promise<Response> =>
        new Response(JSON.stringify({ transcript: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      ) as unknown as typeof fetch

      await withTempOutputDir(async (outputDir) => {
        try {
          await runScrapeCreatorsStt('unused.mp3', outputDir, {
            model: 'youtube-transcript',
            sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
            language: 'fr',
            segmentOffsetMinutes: 0
          })
          throw new Error('expected ScrapeCreators language unavailable error')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain('requested language "fr"')
          expect((error as { skipped?: boolean }).skipped).toBe(true)
          expect((error as { retryable?: boolean }).retryable).toBe(false)
          expect((error as { rawResponse?: unknown }).rawResponse).toEqual({ transcript: null })
        }
      })
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SCRAPECREATORS_API_KEY', previousKey)
      restoreEnv('SCRAPECREATORS_BASE_URL', previousBaseUrl)
    }
  })

  test('unsupported sources skip before reading credentials or calling fetch', async () => {
    const previousKey = process.env['SCRAPECREATORS_API_KEY']
    const previousFetch = globalThis.fetch
    let fetchCalled = false

    try {
      delete process.env['SCRAPECREATORS_API_KEY']
      globalThis.fetch = (async (): Promise<Response> => {
        fetchCalled = true
        return new Response('{}')
      }) as unknown as typeof fetch

      await withTempOutputDir(async (outputDir) => {
        try {
          await runScrapeCreatorsStt('unused.mp3', outputDir, {
            model: 'youtube-transcript',
            sourceUrl: 'https://example.com/audio.mp3',
            segmentOffsetMinutes: 0
          })
          throw new Error('expected ScrapeCreators unsupported source error')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain('only supports youtube.com and youtu.be URLs')
          expect((error as { skipped?: boolean }).skipped).toBe(true)
          expect((error as { retryable?: boolean }).retryable).toBe(false)
        }
      })
      expect(fetchCalled).toBe(false)
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SCRAPECREATORS_API_KEY', previousKey)
    }
  })
})
