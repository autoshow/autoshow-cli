import type { InputFamily, ProcessCommand, ProcessCommandCapabilities } from '~/types'

const PROCESS_COMMAND_CAPABILITIES: Record<ProcessCommand, ProcessCommandCapabilities> = {
  metadata: {
    supportsBatchSourceExpansion: true
  },
  download: {
    supportsBatchSourceExpansion: true
  },
  extract: {
    supportsBatchSourceExpansion: true,
    supportedInputFamilies: ['media', 'document', 'html_article', 'x_space']
  },
  stt: {
    supportsBatchSourceExpansion: true,
    supportedInputFamilies: ['media']
  },
  write: {
    supportsBatchSourceExpansion: true,
    supportedInputFamilies: ['media', 'document', 'html_article']
  },
  ocr: {
    supportsBatchSourceExpansion: false,
    supportedInputFamilies: ['document', 'html_article']
  },
  tts: {
    supportsBatchSourceExpansion: false
  },
  image: {
    supportsBatchSourceExpansion: false
  },
  music: {
    supportsBatchSourceExpansion: false
  },
  video: {
    supportsBatchSourceExpansion: false
  }
}

export const isSttCommand = (command: ProcessCommand): command is 'stt' =>
  command === 'stt'

export const isOcrCommand = (command: ProcessCommand): command is 'ocr' =>
  command === 'ocr'

export const isExtractCommand = (command: ProcessCommand): command is 'extract' =>
  command === 'extract'

export const canonicalizeProcessCommand = (command: ProcessCommand): ProcessCommand =>
  command

export const getProcessCommandCapabilities = (
  command: ProcessCommand
): ProcessCommandCapabilities => PROCESS_COMMAND_CAPABILITIES[command]

export const commandSupportsBatchSourceExpansion = (
  command: ProcessCommand
): boolean => getProcessCommandCapabilities(command).supportsBatchSourceExpansion

export const commandSupportsInputFamily = (
  command: ProcessCommand,
  family: InputFamily
): boolean => {
  const supported = getProcessCommandCapabilities(command).supportedInputFamilies
  return supported ? supported.includes(family) : true
}
