import { commandExists } from '~/utils/cli-utils'
import { calibreBin } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import type { ToolName, ToolStatus } from '~/types'

const TOOL_DEFS: Record<ToolName, { command: string, remediation: string }> = {
  ffmpeg: {
    command: 'ffmpeg',
    remediation: 'Install ffmpeg: bun as setup'
  },
  ffprobe: {
    command: 'ffprobe',
    remediation: 'Install ffprobe (included with ffmpeg): bun as setup'
  },
  libreoffice: {
    command: 'soffice',
    remediation: 'Install LibreOffice: bun as setup'
  },
  calibre: {
    command: 'ebook-convert',
    remediation: 'Install Calibre: bun as setup'
  },
  imagemagick: {
    command: 'convert',
    remediation: 'Install ImageMagick: bun as setup'
  }
}

export const checkTool = (name: ToolName): ToolStatus => {
  const def = TOOL_DEFS[name]
  // For calibre, also check the macOS app bundle path
  const resolved = name === 'calibre' ? calibreBin(def.command) : def.command
  return {
    available: name === 'calibre' ? resolved !== def.command || commandExists(def.command) : commandExists(def.command),
    command: resolved,
    remediation: def.remediation
  }
}

export const checkAllTools = (): Record<ToolName, ToolStatus> => {
  const result = {} as Record<ToolName, ToolStatus>
  for (const name of Object.keys(TOOL_DEFS) as ToolName[]) {
    result[name] = checkTool(name)
  }
  return result
}

export const requireTool = (name: ToolName): void => {
  const status = checkTool(name)
  if (!status.available) {
    throw new Error(
      `Required tool '${status.command}' is not installed. ${status.remediation}`
    )
  }
}
