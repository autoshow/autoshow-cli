import { commandExists, runCapture, runInherit, detectPlatform } from '../../../step-0-setup/setup-orchestrator/run-complete-setup'
import * as l from '~/logger'

const checkOcrmypdf = (): boolean => commandExists('ocrmypdf')

const installOcrmypdf = async (): Promise<void> => {
  l.info('Installing OCRmyPDF')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'ocrmypdf'])
    l.success('OCRmyPDF installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'ocrmypdf'])
    l.success('OCRmyPDF installed')
    return
  }

  l.error('Unsupported platform for OCRmyPDF auto-install')
  throw new Error('Unsupported platform for OCRmyPDF setup')
}

export const setupOcrmypdf = async (): Promise<void> => {
  if (checkOcrmypdf()) {
    l.success('OCRmyPDF already installed')
    return
  }

  await installOcrmypdf()

  const verify = await runCapture('ocrmypdf', ['--version'], { allowFailure: true })
  if (verify.exitCode !== 0) {
    l.error('OCRmyPDF validation failed after install')
    throw new Error('OCRmyPDF validation failed')
  }

  l.success('OCRmyPDF setup complete')
}

export const ensureOcrmypdfSetup = async (): Promise<void> => {
  if (checkOcrmypdf()) return
  await setupOcrmypdf()
}
