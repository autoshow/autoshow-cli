import type { ProcessCommand } from '~/types'

export const isSttCommand = (command: ProcessCommand): command is 'stt' =>
  command === 'stt'

export const isOcrCommand = (command: ProcessCommand): command is 'ocr' =>
  command === 'ocr'

export const canonicalizeProcessCommand = (command: ProcessCommand): ProcessCommand =>
  command
