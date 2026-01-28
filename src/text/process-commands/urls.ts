import { processVideo } from './video'
import { saveInfo, sanitizeTitle, outputExists } from '../utils/save-info'
import { l, err } from '@/logging'
import { readFile, execFilePromise } from '@/node-utils'
import { getCliContext, createBatchProgress } from '@/utils'
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

    l('Found URLs in the file', { count: urls.length })

    if (options.info) {
      await saveInfo('urls', urls, '')
      return
    }

    const ctx = getCliContext()
    const progress = createBatchProgress({ label: 'URLs', total: urls.length })

    for (const [index, url] of urls.entries()) {
      if (ctx.network.skipExisting) {
        try {
          const { stdout: metaStdout } = await execFilePromise('yt-dlp', [
            '--restrict-filenames',
            '--print', '%(title)s',
            '--print', '%(upload_date>%Y-%m-%d)s',
            url,
          ])
          const [vidTitle = '', formattedDate = ''] = metaStdout.trim().split('\n')
          const expectedFilename = `${formattedDate}-${sanitizeTitle(vidTitle)}`
          
          if (outputExists(expectedFilename, options)) {
            l('Skipping (output exists)', { current: index + 1, total: urls.length, title: vidTitle })
            progress.skip()
            continue
          }
        } catch {
        }
      }
      
      l('Processing URL', { current: index + 1, total: urls.length, url })
      try {
        await processVideo(options, url, llmServices, transcriptServices)
        progress.complete(true)
      } catch (error) {
        err('Error processing URL', { url, error: (error as Error).message })
        progress.complete(false)
      }
    }
    
    progress.printSummary()
  } catch (error) {
    err('Error reading or processing file', { filePath, error: (error as Error).message })
    process.exit(1)
  }
}