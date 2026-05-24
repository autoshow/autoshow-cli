import { expect, test } from 'bun:test'
import {
  runCommand,
  STABLE_TTS_MD_PATH,
} from '../../../../../test-utils/test-helpers'
import { mistralTtsModel } from './cases'

test('rejects invalid mistral model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'mistral=invalid-model'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid --mistral-tts model')
})

test('mistral execution requires a voice source before API key validation', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${mistralTtsModel}`
  ], {
    env: {
      MISTRAL_API_KEY: '',
      MISTRAL_TTS_VOICE: '',
      MISTRAL_TTS_REF_AUDIO: ''
    }
  })

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Mistral TTS requires a saved voice ID or reference audio')
})

