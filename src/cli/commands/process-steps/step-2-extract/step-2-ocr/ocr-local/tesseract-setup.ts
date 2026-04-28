import { commandExists, runCapture, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'

const shouldPrintCompletion = (): boolean => {
  return (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') !== '1'
}

const installTesseract = async (): Promise<void> => {
  if (commandExists('tesseract')) {
    return
  }

  l.write('info', 'Installing Tesseract')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'tesseract'])
    l.write('success', 'Tesseract installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'tesseract-ocr'])
    l.write('success', 'Tesseract installed')
    return
  }

  l.error('Unsupported platform for tesseract auto-install')
  throw new Error('Unsupported platform for tesseract setup')
}

const ensureEnglishLanguageData = async (): Promise<void> => {
  const result = await runCapture('tesseract', ['--list-langs'], { allowFailure: true })
  const langs = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (langs.includes('eng')) {
    l.write('success', 'Tesseract language data (eng) found')
    return
  }

  l.warn('Could not find eng.traineddata in tessdata path')
  l.write('info', 'Set TESSDATA_PREFIX if your language files are in a custom directory')
}

export const setupTesseractOcr = async (): Promise<void> => {
  await installTesseract()
  await ensureEnglishLanguageData()

  if (shouldPrintCompletion()) {
    l.write('success', 'Extraction OCR setup complete')
  }
}
