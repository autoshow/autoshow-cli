import { expect, test } from 'bun:test'
import { defineMusicServicePriceTests } from '../../test-utils/define-music-service-test'
import { runCommand } from '../../test-utils/test-helpers'

defineMusicServicePriceTests({
  models: [
    { model: 'music_v1', prompt: 'upbeat electronic instrumental with warm synth pads', extraArgs: ['--music-duration', '12', '--music-instrumental'] },
  ],
  cliFlag: '--elevenlabs',
  musicService: 'elevenlabs',
})

defineMusicServicePriceTests({
  models: [
    { model: 'music-2.5', prompt: 'uplifting indie rock with bright guitars', extraArgs: ['--music-lyrics-file', 'input/examples/tts/0-tts-short.txt'] },
  ],
  cliFlag: '--minimax',
  musicService: 'minimax',
})

defineMusicServicePriceTests({
  models: [
    { model: 'lyria-3-clip-preview', prompt: 'bright synthwave instrumental with pulsing bass' },
    { model: 'lyria-3-pro-preview', prompt: 'ambient orchestral cue with soft piano' },
  ],
  cliFlag: '--gemini',
  musicService: 'gemini',
})

test('--price with both providers shows two cost rows and per-provider filenames', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--elevenlabs', 'music_v1', '--minimax', 'music-2.5', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('elevenlabs')
  expect(output).toContain('minimax')
  expect(output).toContain('generated-music-elevenlabs-music_v1.mp3')
  expect(output).toContain('generated-music-minimax-music-2.5.mp3')
})

test('write --price includes MiniMax music estimate for a real input', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', 'input/examples/audio/1-audio.mp3', '--minimax-music', 'music-2.5', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('music')
  expect(output).toContain('minimax')
  expect(output).toContain('music-2.5')
  expect(output).toContain('Music file')
})
