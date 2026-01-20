import { processVideo } from './video'
import { saveInfo } from '../utils/save-info'
import { l, err } from '@/logging'
import { readFile } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function processURLs(
  options: ProcessingOptions,
  filePath: string,
  llmServices?: string,
  transcriptServices?: string
) {
  try {
    const content = await readFile(filePath, 'utf8')
    const urls = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    if (urls.length === 0) {
      err('Error: No URLs found in the file.')
      process.exit(1)
    }

    l.opts(`Found ${urls.length} URLs in the file...`)

    if (options.info) {
      await saveInfo('urls', urls, '')
      return
    }

    for (const [index, url] of urls.entries()) {
      l.final(`Processing URL ${index + 1}/${urls.length}: ${url}`)
      try {
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        err(`Error processing URL ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    err(`Error reading or processing file ${filePath}: ${(error as Error).message}`)
    process.exit(1)
  }
}