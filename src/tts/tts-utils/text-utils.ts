import { readFileSync } from 'node:fs'
import removeMd from 'remove-markdown'
import { l, err } from '@/logging'

export const stripMarkdown = (file: string): string => {
  l.dim(`Stripping markdown from ${file}`)
  const plain = removeMd(readFileSync(file, 'utf8').trim()).replace(/\s+/g, ' ').trim()
  l.dim(`Plain text length=${plain.length}`)
  if (!plain) err('No narratable text after stripping Markdown')
  return plain
}