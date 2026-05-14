import { rm } from 'node:fs/promises'
import { pathExists, runCapture, runUvCapture, runUvInherit, kittenTtsUvEnvDir, setupUv } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'

const PYTHON_VERSION = '3.12'

const envExistsAndValid = async (): Promise<boolean> => {
  if (!await pathExists(kittenTtsUvEnvDir)) {
    return false
  }

  if (!await pathExists(`${kittenTtsUvEnvDir}/bin/python`)) {
    return false
  }

  const required = [
    `${kittenTtsUvEnvDir}/lib/python${PYTHON_VERSION}/site-packages/kittentts`,
    `${kittenTtsUvEnvDir}/lib/python${PYTHON_VERSION}/site-packages/soundfile.py`
  ]

  for (const path of required) {
    if (!await pathExists(path)) {
      return false
    }
  }

  const check = await runCapture(
    `${kittenTtsUvEnvDir}/bin/python`,
    ['-c', 'from kittentts import KittenTTS; import soundfile'],
    { allowFailure: true }
  )
  return check.exitCode === 0
}

export const setupKittenTtsEnvironment = async (): Promise<void> => {
  l.write('info', 'Setting up Kitten TTS environment')

  await setupUv()

  await runUvCapture(['python', 'install', PYTHON_VERSION], { allowFailure: true })

  await rm(kittenTtsUvEnvDir, { recursive: true, force: true })

  const venv = await runUvInherit(['venv', '--python', PYTHON_VERSION, kittenTtsUvEnvDir], { allowFailure: true })
  if (venv !== 0) {
    l.error('Failed to create Kitten TTS virtual environment')
    throw new Error('Failed to create Kitten TTS virtual environment')
  }

  l.write('info', 'Installing kittentts and dependencies')
  const wheelUrl = 'https://github.com/KittenML/KittenTTS/releases/download/0.8/kittentts-0.8.0-py3-none-any.whl'
  const deps = [
    wheelUrl,
    'soundfile',
    'numpy'
  ]

  const installCode = await runUvInherit(
    ['pip', 'install', '-p', `${kittenTtsUvEnvDir}/bin/python`, ...deps],
    { allowFailure: true, env: { UV_SKIP_WHEEL_FILENAME_CHECK: '1' } }
  )
  if (installCode !== 0) {
    l.error('Failed to install kittentts dependencies')
    throw new Error('Failed to install Kitten TTS dependencies')
  }

  l.write('success', 'Kitten TTS environment ready')
}

export const setupKittenTts = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  await setupKittenTtsEnvironment()

  if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
    l.write('success', 'Kitten TTS setup complete')
  } else {
    l.write('success', 'Kitten TTS Setup', {
      category: 'command',
      humanTable: createHumanTable([
        { status: 'complete', command: 'bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-mini' },
        { status: 'complete', command: 'bun as write "URL" --kitten-tts kitten-tts-mini' }
      ], ['status', 'command'])
    })
  }
}

export const ensureKittenTtsSetup = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    l.write('success', 'Kitten TTS setup verified')
    return
  }

  l.write('info', 'Kitten TTS not set up; running setup')
  await setupKittenTtsEnvironment()
}
