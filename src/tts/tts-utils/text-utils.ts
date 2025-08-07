import { readFileSync } from 'node:fs'
import removeMd from 'remove-markdown'
import { l, err } from '@/logging'

const p = '[tts/tts-utils/text-utils]'

export const stripMarkdown = (file: string): string => {
  l.dim(`${p} Stripping markdown from ${file}`)
  const plain = removeMd(readFileSync(file, 'utf8').trim()).replace(/\s+/g, ' ').trim()
  l.dim(`${p} Plain text length=${plain.length}`)
  if (!plain) err(`${p} No narratable text after stripping Markdown`)
  return plain
}