import { rm } from 'node:fs/promises'
import { commandExists, pathExists, runCapture, runInherit, paddleOcrUvEnvDir, setupUv } from '../../../step-0-setup/setup-orchestrator/run-complete-setup'
import * as l from '~/logger'

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
  l.info('Setting up PaddleOCR environment')

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

  l.info('Installing paddlepaddle (CPU) and paddleocr')
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
  l.success('PaddleOCR environment ready')
}

export const setupPaddleOcr = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    l.success('PaddleOCR environment already set up and validated')
    return
  }

  l.info('Creating new PaddleOCR environment')
  await setupPaddleOcrEnvironment()

  if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
    l.success('PaddleOCR setup complete')
  } else {
    l.success('========================================')
    l.success('PaddleOCR setup complete!')
    l.success('')
    l.success('You can now use PaddleOCR:')
    l.success('bun as extract input/1-document.pdf --paddle-ocr')
    l.success('bun as extract input/1-document.jpg --paddle-ocr')
    l.success('========================================')
  }
}

export const ensurePaddleOcrSetup = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  l.info('PaddleOCR not set up; running setup')
  await setupPaddleOcrEnvironment()
}
