import { test, expect } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const expectOrderedFragments = (text: string, fragments: string[]): void => {
  const normalizedText = text.replace(/[ \t]+/g, ' ')
  let lastIndex = -1

  for (const fragment of fragments) {
    const normalizedFragment = fragment.replace(/[ \t]+/g, ' ')
    const nextIndex = normalizedText.indexOf(normalizedFragment)
    expect(nextIndex).toBeGreaterThan(lastIndex)
    lastIndex = nextIndex
  }
}

test('transcribe aliases resolve to stt help', async () => {
  for (const alias of ['transcribe', 'transcript', 'transcription']) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      alias,
      '--help'
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--speaker-count')
    expect(result.stdout).toContain('--openai-stt')
  }
})

test('extract aliases resolve to ocr help', async () => {
  for (const alias of ['extract', 'document']) {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      alias,
      '--help'
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--mistral-ocr')
    expect(result.stdout).toContain('--epub-bun')
  }
})

test('stt and ocr canonical commands expose their help output', async () => {
  const sttResult = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    '--help'
  ])

  expect(sttResult.exitCode).toBe(0)
  expect(sttResult.stdout).toContain('--speaker-count')
  expect(sttResult.stdout).toContain('--openai-stt')

  const ocrResult = await runCommand([
    'src/cli/create-cli.ts',
    'ocr',
    '--help'
  ])

  expect(ocrResult.exitCode).toBe(0)
  expect(ocrResult.stdout).toContain('--mistral-ocr')
  expect(ocrResult.stdout).toContain('--epub-bun')
})

test('voice alias resolves to tts help', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'voice',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--tts-speaker')
  expect(result.stdout).toContain('--openai-tts')
})

test('download-llama no longer resolves to the models command', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'download-llama',
    'ggml-org/Qwen3-0.6B-GGUF',
    '--help'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Default command (equivalent to write <input>)')
  expect(result.stdout).not.toContain('Download a model without running inference')
})

test('top-level help groups commands into the expected sections and order', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    '--help'
  ])

  expect(result.exitCode).toBe(0)

  const output = result.stdout
  const coreIndex = output.indexOf('Core Commands')
  const setupIndex = output.indexOf('Setup & Utilities')
  const processingIndex = output.indexOf('Processing & Generation')

  expect(coreIndex).toBeGreaterThan(-1)
  expect(setupIndex).toBeGreaterThan(coreIndex)
  expect(processingIndex).toBeGreaterThan(setupIndex)

  const coreSection = output.slice(coreIndex, setupIndex)
  const setupSection = output.slice(setupIndex, processingIndex)
  const processingSection = output.slice(processingIndex)

  expectOrderedFragments(coreSection, [
    '(root)    Default command (equivalent to write <input>)',
    'version   Prints current version',
    'help      Show help'
  ])

  expectOrderedFragments(setupSection, [
    'config    View or set default CLI options saved to config/autoshow.json',
    'setup     Install local dependencies and required tools',
    'sample    Generate and validate deterministic fixture files for all supported formats',
    'models    Download a model without running inference (llama.cpp repo ID or whisper model ID)',
    'links     Fetch provider documentation markdown and write a combined file'
  ])

  expectOrderedFragments(processingSection, [
    'download  Download media or document and collect metadata only',
    'ocr       Extract text from PDF, EPUB, and image files',
    'stt       Download audio and run speech-to-text only',
    'write     Download audio, transcribe, and run LLM summary pipeline',
    'tts       Generate speech audio from a text file (.md or .txt)',
    'image     Generate an image from a text prompt',
    'music     Generate music from a text prompt',
    'video     Generate a video from a text prompt'
  ])
})
