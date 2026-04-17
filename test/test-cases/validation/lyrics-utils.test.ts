import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildLyricsCues } from '~/cli/commands/process-steps/step-8-lyrics/cue-builder'
import {
  formatCaptionTimestamp,
  formatSrt,
  formatVtt,
  parseCaptionTimestamp,
  parseSrt,
  parseVtt
} from '~/cli/commands/process-steps/step-8-lyrics/captions'
import { extractTitle, findMatchingImage } from '~/cli/commands/process-steps/step-8-lyrics/render'
import { readBatchManifest as readRuntimeBatchManifest, readRunManifest as readRuntimeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { writeBatchManifestFixture, writeRunManifestFixture } from '../../test-utils/manifest-helpers'

const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-lyrics-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('lyrics caption utilities', () => {
  test('formats and parses caption timestamps', () => {
    expect(formatCaptionTimestamp(65.432, '.')).toBe('00:01:05.432')
    expect(formatCaptionTimestamp(65.432, ',')).toBe('00:01:05,432')
    expect(parseCaptionTimestamp('00:01:05.432')).toBeCloseTo(65.432, 3)
    expect(parseCaptionTimestamp('00:01:05,432')).toBeCloseTo(65.432, 3)
  })

  test('roundtrips VTT and SRT cues', () => {
    const cues = [
      { index: 0, start: 0, end: 1.2, text: 'hello world' },
      { index: 1, start: 1.5, end: 2.4, text: 'second line' }
    ]

    expect(parseVtt(formatVtt(cues))).toEqual(cues)
    expect(parseSrt(formatSrt(cues))).toEqual(cues)
  })

  test('builds short lyric cues from word timing evidence', () => {
    const result = buildLyricsCues({
      text: 'hello world again',
      segments: [],
      evidence: {
        words: [
          { startSeconds: 0, endSeconds: 0.3, text: 'hello', normalized: 'hello', timingSource: 'native' },
          { startSeconds: 0.31, endSeconds: 0.62, text: 'world', normalized: 'world', timingSource: 'native' },
          { startSeconds: 1.5, endSeconds: 1.8, text: 'again', normalized: 'again', timingSource: 'native' }
        ]
      }
    })

    expect(result.source).toBe('whisper-words')
    expect(result.cues).toEqual([
      { index: 0, start: 0, end: 0.62, text: 'hello world' },
      { index: 1, start: 1.5, end: 1.8, text: 'again' }
    ])
  })

  test('extracts lyric titles from track-number filenames', () => {
    expect(extractTitle('/tmp/01-Day on Earth.wav')).toBe('01 - Day on Earth')
    expect(extractTitle('/tmp/Song Title.mp3')).toBe('Song Title')
  })

  test('finds matching artwork by track number when basename differs', async () => {
    const dir = await createTempDir()
    const audioPath = join(dir, '01-song.mp3')
    const imagePath = join(dir, '01-cover.png')
    await writeFile(audioPath, 'audio')
    await writeFile(imagePath, 'image')

    expect(await findMatchingImage(audioPath, dir)).toBe(imagePath)
  })

  test('runtime manifest readers accept lyrics manifests', async () => {
    const dir = await createTempDir()
    await writeRunManifestFixture(dir, 'lyrics', { cueCount: 3 })
    await writeBatchManifestFixture(dir, 'lyrics', [{ status: 'completed' }])

    const runManifest = await readRuntimeRunManifest(dir, 'lyrics')
    const batchManifest = await readRuntimeBatchManifest(dir, 'lyrics')

    expect(runManifest?.kind).toBe('lyrics')
    expect(runManifest?.metadata['cueCount']).toBe(3)
    expect(batchManifest?.manifest.kind).toBe('lyrics')
    expect(batchManifest?.manifest.items).toEqual([{ status: 'completed' }])
  })
})
