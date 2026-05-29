import { commandExists, runCapture, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'

const checkOcrmypdf = (): boolean => commandExists('ocrmypdf')

const installOcrmypdf = async (): Promise<void> => {
  l.write('info', 'Installing OCRmyPDF')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'ocrmypdf'])
    l.write('success', 'OCRmyPDF installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'ocrmypdf'])
    l.write('success', 'OCRmyPDF installed')
    return
  }

  l.error('Unsupported platform for OCRmyPDF auto-install')
  throw new Error('Unsupported platform for OCRmyPDF setup')
}

const setupOcrmypdf = async (): Promise<void> => {
  if (checkOcrmypdf()) {
    return
  }

  await installOcrmypdf()

  const verify = await runCapture('ocrmypdf', ['--version'], { allowFailure: true })
  if (verify.exitCode !== 0) {
    l.error('OCRmyPDF validation failed after install')
    throw new Error('OCRmyPDF validation failed')
  }

  l.write('success', 'OCRmyPDF setup complete')
}

export const ensureOcrmypdfSetup = async (): Promise<void> => {
  if (checkOcrmypdf()) return
  await setupOcrmypdf()
}
