import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STABLE_LOCAL_AUDIO_PATH, runCommand } from '../../test-utils/test-helpers'

const tempDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  const result = await runCommand(['src/cli/create-cli.ts', ...args], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain(expectedMessage)
}

test('unknown command exits 2', async () => {
  await expectUsageExit(['definitely-not-a-command'], 'Unknown command "definitely-not-a-command"')
})

test('benchmark --tts rejects missing TTS run directory', async () => {
  const root = await makeTempRoot('autoshow-tts-benchmark-missing-')

  await expectUsageExit(
    ['benchmark', join(root, 'missing-run'), '--tts'],
    'TTS run directory not found'
  )
})

test('benchmark --tts rejects non-TTS run manifests', async () => {
  const runDir = await makeTempRoot('autoshow-tts-benchmark-kind-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'extract',
    metadata: {}
  })

  await expectUsageExit(
    ['benchmark', runDir, '--tts'],
    'run.json kind is "extract", expected "tts"'
  )
})

test('benchmark --tts rejects missing source text without override', async () => {
  const runDir = await makeTempRoot('autoshow-tts-benchmark-text-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'tts',
    metadata: {
      tts: [{
        ttsService: 'kitten',
        ttsModel: 'kitten-tts-nano',
        speaker: 'Jasper',
        processingTime: 100,
        audioFileName: 'speech.wav',
        audioFileSize: 10,
        chunkCount: 1
      }]
    }
  })

  await expectUsageExit(
    ['benchmark', runDir, '--tts'],
    'TTS benchmark source text is missing'
  )
})

test('unknown flag exits 2', async () => {
  await expectUsageExit(['write', STABLE_LOCAL_AUDIO_PATH, '--structured'], 'Unexpected flag: structured')
})

test('legacy step-2 command names are not public commands', async () => {
  for (const command of ['stt', 'ocr'] as const) {
    await expectUsageExit([command, STABLE_LOCAL_AUDIO_PATH], `Unknown command "${command}`)
  }
})

test('extract rejects write LLM provider flags as unknown flags', async () => {
  await expectUsageExit(['extract', STABLE_LOCAL_AUDIO_PATH, '--glm'], 'Unexpected flag: glm')
})

test('extract rejects unsupported URL article option flags', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/article', '--url-include-selector', 'article', '--price'],
    'Unexpected flag: urlIncludeSelector'
  )
})

test('extract rejects invalid URL article backend names', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/article', '--url-backend', 'browserless', '--price'],
    'Invalid --url-backend value "browserless". Expected "defuddle", "firecrawl", "glm-reader", "spider", or "zyte".'
  )
})

test('write rejects all URL article backend mode', async () => {
  await expectUsageExit(
    ['write', STABLE_LOCAL_AUDIO_PATH, '--all-url', '--price'],
    '--all-url is only supported on extract for this release'
  )
})

test('extract rejects removed OpenAI OCR models', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--openai-ocr', 'gpt-5.4-mini', '--price'],
    'Invalid --openai-ocr model "gpt-5.4-mini". Allowed values: gpt-5.4, gpt-5.4-nano'
  )
})

test('extract rejects removed Anthropic Opus OCR model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--anthropic-ocr', 'claude-opus-4-7', '--price'],
    'Invalid --anthropic-ocr model "claude-opus-4-7". Allowed values: claude-haiku-4-5'
  )
})

test('extract rejects removed Google Document AI layout parser model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--gcloud-docai', 'layout-parser', '--price'],
    'Invalid --gcloud-docai model "layout-parser". Allowed values: ocr'
  )
})

test('extract rejects removed DeepInfra PaddleOCR model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--deepinfra-ocr', 'PaddlePaddle/PaddleOCR-VL-0.9B', '--price'],
    'Invalid --deepinfra-ocr model "PaddlePaddle/PaddleOCR-VL-0.9B". Allowed values: Qwen/Qwen3-VL-235B-A22B-Instruct, Qwen/Qwen3-VL-30B-A3B-Instruct'
  )
})

test('extract rejects removed AWS Textract analyze-document model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--aws-textract', 'analyze-document', '--price'],
    'Invalid --aws-textract model "analyze-document". Allowed values: detect-text'
  )
})

test('extract rejects removed deAPI OCR flag', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--deapi-ocr', 'Nanonets_Ocr_S_F16', '--price'],
    'Unexpected flag: deapiOcr'
  )
})

test('tts rejects removed MiniMax clone flags as unknown flags', async () => {
  await expectUsageExit(
    ['tts', 'input/examples/tts/1-tts.md', '--minimax-tts', 'speech-2.8-turbo', '--minimax-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price'],
    'Unexpected flag: minimaxTtsRefAudio'
  )
})

test('extract rejects removed Supadata STT modes', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/audio.mp3', '--supadata-stt', 'native', '--price'],
    'Invalid --supadata-stt model "native". Allowed values: auto'
  )
  await expectUsageExit(
    ['extract', 'https://example.com/audio.mp3', '--supadata-stt', 'generate', '--price'],
    'Invalid --supadata-stt model "generate". Allowed values: auto'
  )
})

test('extract rejects unsupported ScrapeCreators STT modes', async () => {
  await expectUsageExit(
    ['extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--scrapecreators-stt', 'auto', '--price'],
    'Invalid --scrapecreators-stt model "auto". Allowed values: youtube-transcript'
  )
})

test('extract transcript-video flags require transcript-video mode', async () => {
  await expectUsageExit(
    ['extract', STABLE_LOCAL_AUDIO_PATH, '--transcript-result', 'output/run/result.json'],
    '--transcript-result require --transcript-video'
  )
})

test('extract transcript-video manual mode requires audio and one transcript source', async () => {
  await expectUsageExit(
    ['extract', '--transcript-video', '--transcript-result', 'output/run/result.json'],
    'Manual transcript-video mode requires --audio'
  )
  await expectUsageExit(
    ['extract', '--transcript-video', '--audio', STABLE_LOCAL_AUDIO_PATH],
    'Manual transcript-video mode requires exactly one of --transcript-result or --transcript-text'
  )
})

test('music lyric-video mode rejects missing audio or batch', async () => {
  await expectUsageExit(['music', '--model', 'tiny'], 'Missing --audio (or use --batch)')
})

test('music rejects mixed hosted generation and lyric-video modes', async () => {
  await expectUsageExit(
    ['music', '--audio', STABLE_LOCAL_AUDIO_PATH, '--minimax-music', 'music-2.5'],
    'Do not combine hosted music flags'
  )
  await expectUsageExit(
    ['music', 'ambient piano', '--model', 'tiny'],
    'Do not combine lyric-video flags'
  )
})

test('music lyric-video mode rejects price mode', async () => {
  await expectUsageExit(
    ['music', '--audio', STABLE_LOCAL_AUDIO_PATH, '--price'],
    'Do not combine hosted music flags'
  )
})

test('comic generate-images rejects invalid page selection flags', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panels', '4-2', '--price'],
    'Invalid panels "4-2"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panels-per-image', '0', '--price'],
    'Invalid panels per image "0"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panel-limit', 'nope', '--price'],
    '--panel-limit was removed'
  )
})

test('comic generate-images rejects invalid and duplicate image models', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--image-model', 'not-a-model', '--price'],
    'Invalid image model "not-a-model"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--image-model', 'gpt-image-2,gpt-image-2', '--price'],
    'Duplicate image model "gpt-image-2" is not allowed'
  )
})

test('comic generate-images rejects removed --panel flag', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panel', '1', '--price'],
    '--panel was removed'
  )
})

test('comic generate-images rejects --panels-per-image with sketch target', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--target', 'sketches', '--panels-per-image', '4', '--price'],
    '--panels-per-image only applies when --target is images or both'
  )
})

test('comic generate-images rejects removed prompts target with migration', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--target', 'prompts', '--price'],
    'bun as comic draft-scenes <script-path> --only panel-prompts'
  )
})

test('comic generate-images rejects variations with non-final targets', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--target', 'sketches', '--variation', 'cinematic-depth', '--price'],
    '--variation only applies when --target is images or both'
  )
})

test('comic generate-images rejects invalid page selection flags', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panels-per-image', '0', '--price'],
    'Invalid panels per image "0"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panel-limit', 'nope', '--price'],
    '--panel-limit was removed'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/ep02-scripts/01-co-work-smarter.md','--panels', '4-2', '--price'],
    'Invalid panels "4-2"'
  )
})

test('comic draft-scenes rejects removed flags', async () => {
  await expectUsageExit(
    ['comic', 'draft-scenes', '--episode', 'ep02', '--price'],
    '--episode was removed'
  )
  await expectUsageExit(
    ['comic', 'draft-scenes', '--concurrency', '3', '--price'],
    '--concurrency was removed'
  )
})
