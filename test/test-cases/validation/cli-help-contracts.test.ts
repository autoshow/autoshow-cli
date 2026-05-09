import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const helpEnv = { NO_COLOR: '1' }

const getSection = (output: string, heading: string, nextHeading?: string): string => {
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const end = nextHeading ? output.indexOf(nextHeading, sectionStart) : output.length
  expect(end).toBeGreaterThan(sectionStart)

  return output.slice(sectionStart, end)
}

test('root help groups setup utilities separately from processing commands', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)

  const setupSection = getSection(result.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
  const processingSection = getSection(result.stdout, '  Processing & Generation\n')

  expect(setupSection).toContain('    links')
  expect(setupSection).toContain('    setup')
  expect(setupSection).toContain('    resume')
  expect(processingSection).toContain('    write')
  expect(processingSection.indexOf('    video')).toBeLessThan(processingSection.indexOf('    music'))
  expect(processingSection).not.toContain('    lyrics')
  expect(processingSection).not.toContain('    stt')
  expect(processingSection).not.toContain('    ocr')
  expect(processingSection).not.toContain('    links')
  expect(processingSection).not.toContain('    resume')
})

test('extract help exposes shared batch and all-provider flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'extract', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--batch-limit')
  expect(result.stdout).toContain('--batch-all')
  expect(result.stdout).toContain('--batch-concurrency')
  expect(result.stdout).toContain('--all-stt')
  expect(result.stdout).toContain('--all-ocr')
  expect(result.stdout).toContain('--grok-stt')
  expect(result.stdout).toContain('--ocr-provider-concurrency')
  expect(result.stdout).toContain('--ocr-local-concurrency')
})

test('download help exposes media preservation flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'download', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--keep-original-media')
  expect(result.stdout).toContain('--best-quality')
  expect(result.stdout).toContain('--flat-batch')
})

test('tts help exposes hosted TTS provider flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'tts', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--grok-tts')
  expect(result.stdout).toContain('--grok-tts-voice')
  expect(result.stdout).toContain('--mistral-tts')
  expect(result.stdout).toContain('--mistral-tts-voice')
  expect(result.stdout).toContain('--mistral-tts-ref-audio')
  expect(result.stdout).toContain('--minimax-tts-ref-audio')
  expect(result.stdout).toContain('--minimax-tts-prompt-audio')
  expect(result.stdout).toContain('--minimax-tts-prompt-text')
  expect(result.stdout).toContain('--minimax-tts-clone-noise-reduction')
  expect(result.stdout).toContain('--minimax-tts-clone-volume-normalization')
  expect(result.stdout).toContain('--openai-tts-ref-audio')
  expect(result.stdout).toContain('--openai-tts-consent-id')
  expect(result.stdout).toContain('--openai-tts-consent-audio')
  expect(result.stdout).toContain('--openai-tts-consent-language')
  expect(result.stdout).toContain('--openai-tts-consent-name')
  expect(result.stdout).toContain('--openai-tts-voice-name')
  expect(result.stdout).toContain('--deapi-tts')
  expect(result.stdout).toContain('--deapi-tts-ref-audio')
  expect(result.stdout).toContain('--deapi-tts-ref-text')
  expect(result.stdout).toContain('--runway-tts')
  expect(result.stdout).toContain('--runway-tts-voice')
  expect(result.stdout).toContain('--speechify-tts')
  expect(result.stdout).toContain('--speechify-voice')
  expect(result.stdout).toContain('--speechify-tts-ref-audio')
  expect(result.stdout).toContain('--speechify-tts-voice-name')
  expect(result.stdout).toContain('--speechify-tts-consent-name')
  expect(result.stdout).toContain('--speechify-tts-consent-email')
  expect(result.stdout).toContain('--speechify-tts-voice-locale')
  expect(result.stdout).toContain('--speechify-tts-voice-gender')
  expect(result.stdout).toContain('--gcloud-tts')
  expect(result.stdout).toContain('--gcloud-tts-voice')
  expect(result.stdout).toContain('--gcloud-tts-language')
  expect(result.stdout).toContain('--gcloud-tts-ref-audio')
  expect(result.stdout).toContain('--gcloud-tts-consent-audio')
  expect(result.stdout).toContain('--gcloud-tts-consent-language')
  expect(result.stdout).toContain('--gcloud-tts-voice-cloning-key')
  expect(result.stdout).toContain('--gcloud-tts-voice-cloning-key-out')
})

test('write and config help expose LLM concurrency flags', async () => {
  const writeResult = await runCommand(['src/cli/create-cli.ts', 'write', '--help'], { env: helpEnv })
  const configResult = await runCommand(['src/cli/create-cli.ts', 'config', '--help'], { env: helpEnv })

  expect(writeResult.exitCode).toBe(0)
  expect(configResult.exitCode).toBe(0)
  expect(writeResult.stdout).toContain('--llm-provider-concurrency')
  expect(writeResult.stdout).toContain('--llm-local-concurrency')
  expect(writeResult.stdout).toContain('--glm')
  expect(configResult.stdout).toContain('--llm-provider-concurrency')
  expect(configResult.stdout).toContain('--llm-local-concurrency')
  expect(configResult.stdout).toContain('--glm')
})

test('music help includes hosted generation and lyric-video flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'music', '--help'], { env: helpEnv })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--elevenlabs-music')
  expect(result.stdout).toContain('--minimax-music')
  expect(result.stdout).toContain('--gemini-music')
  expect(result.stdout).toContain('--music-duration')
  expect(result.stdout).toContain('--music-lyrics-file')
  expect(result.stdout).toContain('--price')
  expect(result.stdout).toContain('--audio')
  expect(result.stdout).toContain('--captions')
  expect(result.stdout).toContain('--batch')
  expect(result.stdout).toContain('--model')
  expect(result.stdout).toContain('--font')
  expect(result.stdout).toContain('--keep-tmp')
  expect(result.stdout).not.toContain('--openai')
  expect(result.stdout).not.toContain('--prompt')
  expect(result.stdout).not.toContain('--prompt-file')
  expect(result.stdout).not.toContain('--track-list')
})

test('image and video help expose BFL/deAPI provider flags', async () => {
  const imageResult = await runCommand(['src/cli/create-cli.ts', 'image', '--help'], { env: helpEnv })
  const videoResult = await runCommand(['src/cli/create-cli.ts', 'video', '--help'], { env: helpEnv })

  expect(imageResult.exitCode).toBe(0)
  expect(videoResult.exitCode).toBe(0)
  expect(imageResult.stdout).toContain('gpt-image-2')
  expect(imageResult.stdout).toContain('--bfl-image')
  expect(imageResult.stdout).toContain('--deapi-image')
  expect(videoResult.stdout).toContain('--deapi-video')
})
