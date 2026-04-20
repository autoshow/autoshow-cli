import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { exec, fileExists } from '~/utils/cli-utils'

const SAMPLE_AUDIO_PATH = 'input/examples/audio/1-audio.mp3'
const tempDirs: string[] = []

const createRelativeTempDir = async (): Promise<string> => {
  await mkdir('output', { recursive: true })
  const dir = await mkdtemp('output/autoshow-tts-concat-')
  tempDirs.push(dir)
  return dir
}

const createChunk = async (
  inputPath: string,
  outputPath: string,
  startSeconds: number
): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-ss', String(startSeconds),
    '-t', '0.25',
    '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    outputPath
  ])

  expect(result.exitCode).toBe(0)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('concatAndConvertToWav handles relative output directories for multi-chunk audio', async () => {
  const outputDir = await createRelativeTempDir()
  const chunkPaths = [
    join(outputDir, 'speech-test-chunk-001.wav'),
    join(outputDir, 'speech-test-chunk-002.wav')
  ]

  await createChunk(SAMPLE_AUDIO_PATH, chunkPaths[0] as string, 0)
  await createChunk(SAMPLE_AUDIO_PATH, chunkPaths[1] as string, 0.25)

  const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Test')

  expect(basename(audioPath)).toBe('speech.wav')
  expect(await fileExists(audioPath)).toBe(true)
  expect(Bun.file(audioPath).size).toBeGreaterThan(0)
  expect(await fileExists(`${outputDir}/speech-test-chunks.txt`)).toBe(false)
})
