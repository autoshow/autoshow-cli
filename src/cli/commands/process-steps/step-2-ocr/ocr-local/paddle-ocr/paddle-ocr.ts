import { rm } from 'node:fs/promises'
import { commandExists, pathExists, runCapture, runInherit, paddleOcrUvEnvDir, setupUv } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import * as l from '~/logger'
import { createHumanTable } from '~/logger/human-table'

const PYTHON_VERSION = '3.10'

const envExistsAndValid = async (): Promise<boolean> => {
  if (!await pathExists(paddleOcrUvEnvDir)) {
    return false
  }

  if (!await pathExists(`${paddleOcrUvEnvDir}/bin/python`)) {
    return false
  }

  const check = await runCapture(
    `${paddleOcrUvEnvDir}/bin/python`,
    ['-c', 'from paddleocr import PaddleOCR'],
    { allowFailure: true }
  )
  return check.exitCode === 0
}

export const setupPaddleOcrEnvironment = async (): Promise<void> => {
  l.write('info', 'Setting up PaddleOCR environment')

  if (!commandExists('uv')) {
    await setupUv()
  }

  await runCapture('uv', ['python', 'install', PYTHON_VERSION], { allowFailure: true })

  await rm(paddleOcrUvEnvDir, { recursive: true, force: true })

  const venv = await runInherit('uv', ['venv', '--python', PYTHON_VERSION, paddleOcrUvEnvDir], { allowFailure: true })
  if (venv !== 0) {
    l.error('Failed to create PaddleOCR virtual environment')
    throw new Error('Failed to create PaddleOCR virtual environment')
  }

  l.write('info', 'Installing paddlepaddle (CPU) and paddleocr')
  const paddleInstallCode = await runInherit(
    'uv',
    ['pip', 'install', '-p', `${paddleOcrUvEnvDir}/bin/python`, 'paddlepaddle==3.0.0'],
    { allowFailure: true }
  )
  if (paddleInstallCode !== 0) {
    l.error('Failed to install paddlepaddle')
    throw new Error('Failed to install PaddlePaddle')
  }

  const ocrInstallCode = await runInherit(
    'uv',
    ['pip', 'install', '-p', `${paddleOcrUvEnvDir}/bin/python`, 'paddleocr'],
    { allowFailure: true }
  )
  if (ocrInstallCode !== 0) {
    l.error('Failed to install paddleocr')
    throw new Error('Failed to install PaddleOCR')
  }

  l.warn('Note: First PaddleOCR inference will download model weights (~150MB+)')
  l.write('success', 'PaddleOCR environment ready')
}

export const setupPaddleOcr = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  l.write('info', 'Creating new PaddleOCR environment')
  await setupPaddleOcrEnvironment()

  if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
    l.write('success', 'PaddleOCR setup complete')
  } else {
    l.write('success', 'PaddleOCR Setup', {
      category: 'command',
      humanTable: createHumanTable([
        { status: 'complete', command: 'bun as ocr input/examples/document/1-document.pdf --paddle-ocr' },
        { status: 'complete', command: 'bun as ocr input/examples/document/1-document.jpg --paddle-ocr' }
      ], ['status', 'command'])
    })
  }
}

export const ensurePaddleOcrSetup = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  l.write('info', 'PaddleOCR not set up; running setup')
  await setupPaddleOcrEnvironment()
}
