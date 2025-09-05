import { readdir, join } from '@/node-utils'

const SAFE_CONTENT_CHARS = 8000

export async function getAllMarkdownFiles(dir: string): Promise<string[]> {
  const dirEntries = await readdir(dir, { withFileTypes: true })
  const mdFiles: string[] = []

  await Promise.all(
    dirEntries.map(async (entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const nestedFiles = await getAllMarkdownFiles(fullPath)
        mdFiles.push(...nestedFiles)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        mdFiles.push(fullPath)
      }
    })
  )

  return mdFiles
}

export function truncateContentSafely(content: string, _filename: string): string {
  if (content.length <= SAFE_CONTENT_CHARS) {
    return content
  }
  
  let truncated = content.substring(0, SAFE_CONTENT_CHARS)
  
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const lastSpace = truncated.lastIndexOf(' ')
  
  const bestCutoff = Math.max(lastPeriod, lastNewline, lastSpace)
  
  if (bestCutoff > SAFE_CONTENT_CHARS * 0.8) {
    truncated = truncated.substring(0, bestCutoff + 1)
  }
  
  return truncated
}