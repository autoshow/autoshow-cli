import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildYoutubeCaptionTranscription,
  parseYoutubeVttCues,
  readStoredYoutubeCaptionSuccess,
  resolveYoutubeWatchUrl,
  selectYoutubeCaptionTrack,
  YOUTUBE_CAPTIONS_MODEL,
  YOUTUBE_CAPTIONS_SERVICE
} from '~/cli/commands/process-steps/step-2-stt/youtube-captions'
import { writeProviderResultFixture, writeRunManifestFixture } from '../../test-utils/manifest-helpers'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('YouTube caption URL and track selection', () => {
  test('resolveYoutubeWatchUrl normalizes short and shorts URLs to watch URLs', () => {
    expect(resolveYoutubeWatchUrl('https://youtu.be/abc123?t=1')).toBe('https://www.youtube.com/watch?v=abc123')
    expect(resolveYoutubeWatchUrl('https://www.youtube.com/shorts/xyz789')).toBe('https://www.youtube.com/watch?v=xyz789')
    expect(resolveYoutubeWatchUrl('https://example.com/watch?v=abc123')).toBeNull()
  })

  test('selectYoutubeCaptionTrack prefers manual English captions and prefers VTT when available', () => {
    const selected = selectYoutubeCaptionTrack({
      subtitles: {
        fr: [{ ext: 'vtt', url: 'https://example.com/fr.vtt', name: 'French' }],
        en: [
          { ext: 'ttml', url: 'https://example.com/en.ttml', name: 'English TTML' },
          { ext: 'vtt', url: 'https://example.com/en.vtt', name: 'English VTT' }
        ]
      },
      automatic_captions: {
        en: [{ ext: 'vtt', url: 'https://example.com/auto-en.vtt', name: 'Auto English' }]
      }
    })

    expect(selected).toEqual({
      kind: 'manual',
      language: 'en',
      track: {
        ext: 'vtt',
        url: 'https://example.com/en.vtt',
        name: 'English VTT'
      }
    })
  })

  test('selectYoutubeCaptionTrack falls back to automatic English and rejects non-English only inventories', () => {
    expect(selectYoutubeCaptionTrack({
      subtitles: {},
      automatic_captions: {
        'en-US': [{ ext: 'vtt', url: 'https://example.com/auto-en-us.vtt', name: 'Auto English US' }]
      }
    })).toEqual({
      kind: 'auto',
      language: 'en-US',
      track: {
        ext: 'vtt',
        url: 'https://example.com/auto-en-us.vtt',
        name: 'Auto English US'
      }
    })

    expect(selectYoutubeCaptionTrack({
      subtitles: {
        es: [{ ext: 'vtt', url: 'https://example.com/es.vtt', name: 'Spanish' }]
      },
      automatic_captions: {
        de: [{ ext: 'vtt', url: 'https://example.com/de.vtt', name: 'German' }]
      }
    })).toBeNull()
  })
})

describe('YouTube caption VTT normalization', () => {
  test('parseYoutubeVttCues strips NOTE and STYLE blocks, cue settings, and inline tags', () => {
    const cues = parseYoutubeVttCues(`WEBVTT

STYLE
::cue { color: lime; }

NOTE this block is ignored
metadata

00:00:00.000 --> 00:00:02.000 align:start position:0%
<c.colorE5E5E5>Hello</c> <00:00:01.000><c>world</c>

00:00:02.000 --> 00:00:04.000
Second &amp; final line
`)

    expect(cues).toEqual([
      { startSeconds: 0, endSeconds: 2, text: 'Hello world' },
      { startSeconds: 2, endSeconds: 4, text: 'Second & final line' }
    ])
  })

  test('buildYoutubeCaptionTranscription bounds overlapping cues for manual captions', () => {
    const transcription = buildYoutubeCaptionTranscription(`WEBVTT

00:00:00.000 --> 00:00:02.500
First line

00:00:02.000 --> 00:00:04.000
Second line
`, {
      kind: 'manual',
      language: 'en',
      track: { ext: 'vtt', url: 'https://example.com/manual.vtt', name: 'English' }
    })

    expect(transcription?.segments).toEqual([
      { start: '00:00:00', end: '00:00:02', text: 'First line' },
      { start: '00:00:02', end: '00:00:04', text: 'Second line' }
    ])
    expect(transcription?.text).toBe('First line Second line')
  })

  test('buildYoutubeCaptionTranscription collapses repeated auto-caption prefixes', () => {
    const transcription = buildYoutubeCaptionTranscription(`WEBVTT

00:00:00.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:04.000
Hello world again
`, {
      kind: 'auto',
      language: 'en',
      track: { ext: 'vtt', url: 'https://example.com/auto.vtt', name: 'English auto' }
    })

    expect(transcription?.text).toBe('Hello world again')
    expect(transcription?.segments.map((segment) => segment.text)).toEqual([
      'Hello world',
      'again'
    ])
    expect(transcription?.evidence?.rawResponse).toEqual({
      captionKind: 'auto',
      captionLanguage: 'en',
      captionFormat: 'vtt'
    })
  })
})

describe('YouTube caption cached results', () => {
  test('readStoredYoutubeCaptionSuccess restores root artifacts from the provider directory', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-youtube-caption-cache-'))
    tempDirs.push(outputDir)

    const providerDir = join(outputDir, 'providers', `${YOUTUBE_CAPTIONS_SERVICE}-${YOUTUBE_CAPTIONS_MODEL}`)
    await mkdir(providerDir, { recursive: true })

    await Bun.write(join(providerDir, 'transcription.txt'), '[00:00:00] Hello from captions\n')
    await Bun.write(join(providerDir, 'youtube-captions.vtt'), `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello from captions
`)
    await Bun.write(join(providerDir, 'youtube-captions.json'), `${JSON.stringify({
      captionKind: 'manual',
      captionLanguage: 'en',
      sourceUrl: 'https://example.com/en.vtt',
      trackName: 'English',
      subtitleInventory: {
        en: [{ ext: 'vtt', name: 'English' }]
      },
      automaticCaptionInventory: {}
    }, null, 2)}\n`)
    await writeRunManifestFixture(outputDir, 'stt', {})

    await writeProviderResultFixture(providerDir, YOUTUBE_CAPTIONS_SERVICE, YOUTUBE_CAPTIONS_MODEL, {
      transcriptionService: YOUTUBE_CAPTIONS_SERVICE,
      transcriptionModel: YOUTUBE_CAPTIONS_MODEL,
      processingTime: 123,
      tokenCount: 3,
      captionKind: 'manual',
      captionLanguage: 'en',
      captionFormat: 'vtt'
    }, {
      text: 'Hello from captions',
      segments: [{ start: '00:00:00', end: '00:00:01', text: 'Hello from captions' }]
    })

    const success = await readStoredYoutubeCaptionSuccess(outputDir)

    expect(success?.relativeDir).toBe(`providers/${YOUTUBE_CAPTIONS_SERVICE}-${YOUTUBE_CAPTIONS_MODEL}`)
    expect(success?.metadata).toMatchObject({
      transcriptionService: YOUTUBE_CAPTIONS_SERVICE,
      transcriptionModel: YOUTUBE_CAPTIONS_MODEL,
      captionKind: 'manual',
      captionLanguage: 'en',
      captionFormat: 'vtt'
    })
    expect(await Bun.file(join(outputDir, 'transcription.txt')).text()).toContain('Hello from captions')
    expect(await Bun.file(join(outputDir, 'youtube-captions.vtt')).text()).toContain('WEBVTT')
    expect(await Bun.file(join(outputDir, 'youtube-captions.json')).json()).toMatchObject({
      captionKind: 'manual',
      captionLanguage: 'en'
    })
    expect(await Bun.file(join(outputDir, 'result.json')).json()).toMatchObject({
      provider: YOUTUBE_CAPTIONS_SERVICE,
      model: YOUTUBE_CAPTIONS_MODEL
    })
  })
})
