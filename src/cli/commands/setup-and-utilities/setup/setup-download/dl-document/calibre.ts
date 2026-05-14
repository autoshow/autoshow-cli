import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { commandExists, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { setupDocumentTools } from './document'

export const CALIBRE_REQUIRED_TOOLS = ['ebook-convert'] as const
const MACOS_CALIBRE_BIN = '/Applications/calibre.app/Contents/MacOS'

const shouldPrintCompletion = (): boolean => {
  return (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') !== '1'
}

const hasCalibreCliTools = (): boolean => {
  if (CALIBRE_REQUIRED_TOOLS.every((tool) => commandExists(tool))) {
    return true
  }
  // On macOS, Calibre installs CLI tools inside the app bundle which isn't on PATH
  if (detectPlatform() === 'darwin') {
    return CALIBRE_REQUIRED_TOOLS.every((tool) => existsSync(join(MACOS_CALIBRE_BIN, tool)))
  }
  return false
}

/**
 * Resolve the full path to a Calibre CLI tool, checking PATH first,
 * then falling back to the macOS app bundle location.
 */
export const calibreBin = (tool: string): string => {
  if (commandExists(tool)) return tool
  const macPath = join(MACOS_CALIBRE_BIN, tool)
  if (existsSync(macPath)) return macPath
  return tool
}

const installCalibreTools = async (): Promise<void> => {
  if (hasCalibreCliTools()) {
    return
  }

  l.write('info', 'Installing Calibre ebook-convert')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', '--cask', 'calibre'])
    if (hasCalibreCliTools()) {
      l.write('success', 'Calibre ebook-convert installed')
      return
    }
    // Homebrew may report "already installed" when the cask metadata exists
    // but the .app was removed — reinstall to restore it
    l.write('info', 'Calibre cask present but app missing, reinstalling...')
    await runInherit('brew', ['reinstall', '--cask', 'calibre'])
    if (hasCalibreCliTools()) {
      l.write('success', 'Calibre ebook-convert installed')
      return
    }
    throw new Error(
      'Calibre install completed but ebook-convert was not found. ' +
      'Expected at: /Applications/calibre.app/Contents/MacOS/ebook-convert'
    )
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'calibre'])
    if (hasCalibreCliTools()) {
      l.write('success', 'Calibre ebook-convert installed')
      return
    }
    throw new Error('Calibre install completed but ebook-convert was not found on PATH')
  }

  l.error('Unsupported platform for calibre auto-install')
  throw new Error('Unsupported platform for calibre setup')
}

export const setupCalibreTools = async (): Promise<void> => {
  await installCalibreTools()

  if (shouldPrintCompletion()) {
    l.write('success', 'Calibre ebook-convert setup complete')
  }
}

export const setupCalibreDocumentTools = async (): Promise<void> => {
  await setupDocumentTools()
  await setupCalibreTools()

  if (shouldPrintCompletion()) {
    l.write('success', 'Document foundation tools setup complete')
  }
}

export const ensureCalibreDocumentTools = async (): Promise<void> => {
  if (hasCalibreCliTools() && commandExists('mutool')) {
    return
  }
  l.write('info', 'Document conversion tools missing. Running setup step: calibre')
  await setupCalibreDocumentTools()
}
