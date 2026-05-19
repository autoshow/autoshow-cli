import { afterEach, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STABLE_LOCAL_AUDIO_PATH, runCommand } from '../../test-utils/test-helpers'

const tempDirs: string[] = []
const repoFixtureFiles: string[] = []
const repoFixtureDirs: string[] = []

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

afterEach(async () => {
  await Promise.all(repoFixtureFiles.splice(0).map((path) => rm(path, { force: true })))
  await Promise.all(repoFixtureDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  const result = await runCommand(['src/cli/create-cli.ts', ...args], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain(expectedMessage)
}

const ensureEpisodeTwoScriptFixture = async (): Promise<void> => {
  const dir = join('input', 'episode-scripts', '02-script')
  const path = join(dir, '01-co-work-smarter.md')

  if (!existsSync(dir)) {
    repoFixtureDirs.push(dir)
  }

  await mkdir(dir, { recursive: true })

  if (!existsSync(path)) {
    repoFixtureFiles.push(path)
    await writeFile(path, '# Co-Work Smarter\n')
  }
}

test('unknown command exits 2', async () => {
  await expectUsageExit(['definitely-not-a-command'], 'Unknown command "definitely-not-a-command"')
})

test('image command rejects removed imagen-count flag', async () => {
  await expectUsageExit(
    ['image', 'a sunset', '--gemini', 'imagen-4.0-generate-001', '--imagen-count', '2', '--price'],
    'Unexpected flag: imagenCount'
  )
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

test('extract rejects LLM-only provider flags as unknown flags', async () => {
  await expectUsageExit(['extract', STABLE_LOCAL_AUDIO_PATH, '--llama'], 'Unexpected flag: llama')
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

test('extract accepts OpenAI Mini OCR in price mode', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--openai', 'gpt-5.4-mini', '--price'],
    { env: { NO_COLOR: '1' } }
  )

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('gpt-5.4-mini')
})

test('extract accepts route-aware GLM OCR model in price mode', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--glm', 'glm-ocr', '--price'],
    { env: { NO_COLOR: '1' } }
  )

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('glm-ocr')
})

test('extract accepts route-aware GLM STT model in price mode', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', STABLE_LOCAL_AUDIO_PATH, '--glm', 'glm-asr-2512', '--price'],
    { env: { NO_COLOR: '1' } }
  )

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('glm-asr-2512')
})

test('extract rejects removed Anthropic Opus OCR model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--anthropic', 'claude-opus-4-7', '--price'],
    'Invalid --anthropic-ocr model "claude-opus-4-7". Allowed values: claude-haiku-4-5'
  )
})

test('extract rejects removed Google Document AI layout parser model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--gcloud', 'layout-parser', '--price'],
    'Invalid --gcloud-docai model "layout-parser". Allowed values: ocr'
  )
})

test('extract rejects removed DeepInfra PaddleOCR model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--deepinfra', 'PaddlePaddle/PaddleOCR-VL-0.9B', '--price'],
    'Invalid --deepinfra-ocr model "PaddlePaddle/PaddleOCR-VL-0.9B". Allowed values: Qwen/Qwen3-VL-235B-A22B-Instruct, Qwen/Qwen3-VL-30B-A3B-Instruct'
  )
})

test('extract rejects removed AWS Textract analyze-document model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--aws', 'analyze-document', '--price'],
    'Invalid --aws-textract model "analyze-document". Allowed values: detect-text'
  )
})

test('extract rejects old suffixed provider selector flags', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--glm-ocr', 'glm-ocr', '--price'],
    'Unexpected flag: glmOcr'
  )
  await expectUsageExit(
    ['extract', STABLE_LOCAL_AUDIO_PATH, '--glm-stt', 'glm-asr-2512', '--price'],
    'Unexpected flag: glmStt'
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
    'Unexpected flags: minimaxTts, minimaxTtsRefAudio'
  )
})

test('extract rejects removed Supadata STT modes', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/audio.mp3', '--supadata', 'native', '--price'],
    'Invalid --supadata-stt model "native". Allowed values: auto'
  )
  await expectUsageExit(
    ['extract', 'https://example.com/audio.mp3', '--supadata', 'generate', '--price'],
    'Invalid --supadata-stt model "generate". Allowed values: auto'
  )
})

test('extract rejects unsupported ScrapeCreators STT modes', async () => {
  await expectUsageExit(
    ['extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--scrapecreators', 'auto', '--price'],
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
    ['music', '--audio', STABLE_LOCAL_AUDIO_PATH, '--minimax', 'music-2.5'],
    'Do not combine hosted music flags'
  )
  await expectUsageExit(
    ['music', '--audio', STABLE_LOCAL_AUDIO_PATH, '--out', 'output/music-run'],
    'Do not combine hosted music flags'
  )
  await expectUsageExit(
    ['music', 'ambient piano', '--model', 'tiny'],
    'Do not combine lyric-video flags'
  )
})

test('standalone generation output directory aliases are mutually exclusive', async () => {
  await expectUsageExit(
    ['image', 'a sunset', '--openai', 'gpt-image-1.5', '--output-dir', 'output/image-a', '--out', 'output/image-b', '--price'],
    'Use only one of --output-dir or --out.'
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
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panels', '4-2', '--price'],
    'Invalid panels "4-2"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panels-per-image', '0', '--price'],
    'Invalid panels per image "0"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panel-limit', 'nope', '--price'],
    '--panel-limit was removed'
  )
})

test('comic generate-images rejects invalid and duplicate image models', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--image-model', 'not-a-model', '--price'],
    'Invalid image model "not-a-model"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--image-model', 'gpt-image-2,gpt-image-2', '--price'],
    'Duplicate image model "gpt-image-2" is not allowed'
  )
})

test('comic generate-images rejects removed --panel flag', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panel', '1', '--price'],
    '--panel was removed'
  )
})

test('comic generate-images accepts --panels-per-image with sketch target', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'generate-images',
    'input/episode-scripts/02-script/01-co-work-smarter.md',
    '--target',
    'sketches',
    '--panels-per-image',
    '6',
    '--quality',
    'high',
    '--price'
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Price Estimate: generate-images --target sketches')
  expect(result.stdout).toContain('Panels per sketch: 6')
})

test('comic commands accept strict episode-scene shorthand for price preflight', async () => {
  await ensureEpisodeTwoScriptFixture()

  const draftResult = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'draft-scenes',
    '02-01',
    '--price',
  ], {
    env: { NO_COLOR: '1' }
  })
  const imageResult = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'generate-images',
    '02-01',
    '--target',
    'sketches',
    '--panels-per-image',
    '6',
    '--price',
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(draftResult.exitCode).toBe(0)
  expect(draftResult.stdout).toContain('Price Estimate: draft-scenes')
  expect(imageResult.exitCode).toBe(0)
  expect(imageResult.stdout).toContain('Price Estimate: generate-images --target sketches')
})

test('comic shorthand resolution errors name the expected directory and prefix', async () => {
  await expectUsageExit(
    ['comic', 'draft-scenes', '99-01', '--price'],
    'Expected exactly one Markdown file in "input/episode-scripts/99-script" beginning with "01-"'
  )
})

test('comic non-strict shorthand remains an ordinary script path', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'draft-scenes',
    '2-1',
    '--price',
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Price Estimate: draft-scenes')
})

test('comic generate-images rejects removed prompts target with migration', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--target', 'prompts', '--price'],
    'bun as comic draft-scenes <script-path> --only panel-prompts'
  )
})

test('comic generate-images rejects variations with non-final targets', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--target', 'sketches', '--variation', 'cinematic-depth', '--price'],
    '--variation only applies when --target is images or both'
  )
})

test('comic generate-images rejects invalid grid options', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md', '--panels-per-image', '1', '--grid', '0x3', '--price'],
    'Invalid grid "0x3"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md', '--panels-per-image', '1', '--grid', '2x3', '--grid', '3x2', '--price'],
    'Grid can only be specified once'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md', '--target', 'sketches', '--panels-per-image', '1', '--grid', '2x3', '--price'],
    '--grid only applies when --target is images or both'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md', '--grid', '2x3', '--price'],
    '--grid requires --panels-per-image 1'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md', '--panels-per-image', '1', '--grid', '2x3', '--size', '1024x1024', '--price'],
    '--grid requires --size 1536x1024'
  )
})

test('comic generate-images rejects invalid page selection flags', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panels-per-image', '0', '--price'],
    'Invalid panels per image "0"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panel-limit', 'nope', '--price'],
    '--panel-limit was removed'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/episode-scripts/02-script/01-co-work-smarter.md','--panels', '4-2', '--price'],
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
