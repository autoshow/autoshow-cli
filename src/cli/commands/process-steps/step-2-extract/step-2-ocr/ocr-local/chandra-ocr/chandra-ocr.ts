import { rm } from 'node:fs/promises'
import { commandExists, pathExists, runCapture, runInherit, chandraOcrUvEnvDir, setupUv } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'

const PYTHON_VERSION = '3.10'

const envExistsAndValid = async (): Promise<boolean> => {
  if (!await pathExists(chandraOcrUvEnvDir)) {
    return false
  }

  if (!await pathExists(`${chandraOcrUvEnvDir}/bin/python`)) {
    return false
  }

  const check = await runCapture(
    `${chandraOcrUvEnvDir}/bin/python`,
    ['-c', 'import chandra_ocr'],
    { allowFailure: true }
  )
  return check.exitCode === 0
}

export const setupChandraOcrEnvironment = async (): Promise<void> => {
  l.write('info', 'Setting up Chandra OCR environment')

  if (!commandExists('uv')) {
    await setupUv()
  }

  await runCapture('uv', ['python', 'install', PYTHON_VERSION], { allowFailure: true })

  await rm(chandraOcrUvEnvDir, { recursive: true, force: true })

  const venv = await runInherit('uv', ['venv', '--python', PYTHON_VERSION, chandraOcrUvEnvDir], { allowFailure: true })
  if (venv !== 0) {
    l.error('Failed to create Chandra OCR virtual environment')
    throw new Error('Failed to create Chandra OCR virtual environment')
  }

  l.write('info', 'Installing chandra-ocr[hf]')
  const installCode = await runInherit(
    'uv',
    ['pip', 'install', '-p', `${chandraOcrUvEnvDir}/bin/python`, 'chandra-ocr[hf]'],
    { allowFailure: true }
  )
  if (installCode !== 0) {
    l.error('Failed to install chandra-ocr')
    throw new Error('Failed to install chandra-ocr')
  }

  l.warn('Note: First Chandra OCR inference will download model weights (~several GB)')
  l.write('success', 'Chandra OCR environment ready')
}

export const setupChandraOcr = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  l.write('info', 'Creating new Chandra OCR environment')
  await setupChandraOcrEnvironment()

  if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
    l.write('success', 'Chandra OCR setup complete')
  } else {
    l.write('success', 'Chandra OCR Setup', {
      category: 'command',
      humanTable: createHumanTable([
        { status: 'complete', command: 'bun as extract input/examples/document/1-document.pdf --chandra-ocr' },
        { status: 'complete', command: 'bun as extract input/examples/document/1-document.jpg --chandra-ocr' }
      ], ['status', 'command'])
    })
  }
}

export const ensureChandraOcrSetup = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  l.write('info', 'Chandra OCR not set up; running setup')
  await setupChandraOcrEnvironment()
}
