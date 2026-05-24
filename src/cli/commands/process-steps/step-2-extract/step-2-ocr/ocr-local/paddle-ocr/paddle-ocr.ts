import { rm } from 'node:fs/promises'
import { pathExists, runCapture, runUvCapture, runUvInherit, paddleOcrUvEnvDir, setupUv } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { withProcessLock } from '~/utils/process-lock'

const PYTHON_VERSION = '3.10'
const PADDLE_OCR_SETUP_LOCK_NAME = 'paddle-ocr-setup'

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

const setupPaddleOcrEnvironmentUnlocked = async (): Promise<void> => {
  l.write('info', 'Setting up PaddleOCR environment')

  await setupUv()

  await runUvCapture(['python', 'install', PYTHON_VERSION], { allowFailure: true })

  await rm(paddleOcrUvEnvDir, { recursive: true, force: true })

  const venv = await runUvInherit(['venv', '--python', PYTHON_VERSION, paddleOcrUvEnvDir], { allowFailure: true })
  if (venv !== 0) {
    l.error('Failed to create PaddleOCR virtual environment')
    throw new Error('Failed to create PaddleOCR virtual environment')
  }

  l.write('info', 'Installing paddlepaddle (CPU) and paddleocr')
  const paddleInstallCode = await runUvInherit(
    ['pip', 'install', '-p', `${paddleOcrUvEnvDir}/bin/python`, 'paddlepaddle==3.0.0'],
    { allowFailure: true }
  )
  if (paddleInstallCode !== 0) {
    l.error('Failed to install paddlepaddle')
    throw new Error('Failed to install PaddlePaddle')
  }

  const ocrInstallCode = await runUvInherit(
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

export const setupPaddleOcrEnvironment = async (): Promise<void> => {
  await withProcessLock(PADDLE_OCR_SETUP_LOCK_NAME, async () => {
    if (await envExistsAndValid()) {
      return
    }

    await setupPaddleOcrEnvironmentUnlocked()
  })
}

export const ensurePaddleOcrSetup = async (): Promise<void> => {
  if (await envExistsAndValid()) {
    return
  }

  l.write('info', 'PaddleOCR not set up; running setup')
  await setupPaddleOcrEnvironment()
}
