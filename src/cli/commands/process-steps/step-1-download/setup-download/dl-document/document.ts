import { commandExists, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import * as l from '~/utils/logger'

const shouldPrintCompletion = (): boolean => {
  return (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') !== '1'
}

const installMutool = async (): Promise<void> => {
  if (commandExists('mutool')) {
    return
  }

  l.write('info', 'Installing MuPDF tools')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await runInherit('brew', ['install', 'mupdf-tools'])
    l.write('success', 'MuPDF tools installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'mupdf-tools'])
    l.write('success', 'MuPDF tools installed')
    return
  }

  l.error('Unsupported platform for mutool auto-install')
  throw new Error('Unsupported platform for mutool setup')
}

export const setupDocumentTools = async (): Promise<void> => {
  await installMutool()

  if (shouldPrintCompletion()) {
    l.write('success', 'Document tools setup complete')
  }
}
