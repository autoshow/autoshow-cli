import { processVideo } from './video.ts'
import { saveInfo } from '../utils/save-info.ts'
import { l, err, logSeparator } from '@/logging'
import { readFile } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function processURLs(
  options: ProcessingOptions,
  filePath: string,
  llmServices?: string,
  transcriptServices?: string
) {
  const p = '[text/process-commands/urls]'

  try {
    const content = await readFile(filePath, 'utf8')
    const urls = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    if (urls.length === 0) {
      err(`${p} Error: No URLs found in the file.`)
      process.exit(1)
    }

    l.opts(`\nFound ${urls.length} URLs in the file...`)

    if (options.info) {
      await saveInfo('urls', urls, '')
      return
    }

    for (const [index, url] of urls.entries()) {
      logSeparator({
        type: 'urls',
        index,
        total: urls.length,
        descriptor: url
      })
      try {
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        err(`${p} Error processing URL ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    err(`${p} Error reading or processing file ${filePath}: ${(error as Error).message}`)
    process.exit(1)
  }
}