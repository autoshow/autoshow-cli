import { expect, test } from 'bun:test'
import { STABLE_LOCAL_AUDIO_PATH, runCommand } from '../../test-utils/test-helpers'

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
