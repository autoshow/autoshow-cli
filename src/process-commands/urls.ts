// src/process-commands/urls.ts

import { processVideo } from './video.ts'
import { saveInfo } from '../utils/save-info.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '../utils/logging.ts'
import { readFile } from '../utils/node-utils.ts'
import type { ProcessingOptions } from '../utils/types.ts'

export async function processURLs(
  options: ProcessingOptions,
  filePath: string,
  llmServices?: string,
  transcriptServices?: string
) {
  // Log the processing parameters for debugging purposes
  logInitialFunctionCall('processURLs', { llmServices, transcriptServices })

  try {
    // Read the file and extract valid URLs
    const content = await readFile(filePath, 'utf8')
    const urls = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    // Exit if no valid URLs were found in the file
    if (urls.length === 0) {
      err('Error: No URLs found in the file.')
      process.exit(1)
    }

    l.opts(`\nFound ${urls.length} URLs in the file...`)

    // If the --info option is provided, extract metadata for all videos
    if (options.info) {
      await saveInfo('urls', urls, '')
      return
    }

    // Process each URL sequentially, with error handling for individual videos
    for (const [index, url] of urls.entries()) {
      // Visual separator for each video in the console
      logSeparator({
        type: 'urls',
        index,
        total: urls.length,
        descriptor: url
      })
      try {
        // Process the video using the existing processVideo function
        await processVideo(options, url, llmServices, transcriptServices)
      } catch (error) {
        // Log error but continue processing remaining URLs
        err(`Error processing URL ${url}: ${(error as Error).message}`)
      }
    }
  } catch (error) {
    // Handle fatal errors that prevent file processing
    err(`Error reading or processing file ${filePath}: ${(error as Error).message}`)
    process.exit(1)
  }
}