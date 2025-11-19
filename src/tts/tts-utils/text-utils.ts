import { readFileSync } from 'node:fs'
import { removeMarkdown } from './remove-markdown'
import { err } from '@/logging'

const p = '[tts/tts-utils/text-utils]'

export const stripMarkdown = (file: string): string => {
  const plain = removeMarkdown(readFileSync(file, 'utf8').trim()).replace(/\s+/g, ' ').trim()
  if (!plain) err(`${p} No narratable text after stripping Markdown`)
  return plain
}