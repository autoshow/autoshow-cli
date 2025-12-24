import { validateRSSOptions, getLLMService, getTranscriptService } from './rss-validation.ts'
import { processRSSFeeds } from './processor.ts'
import { handleWorkflow } from './workflows.ts'
import { err } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'

export async function processRSS(
  options: ProcessingOptions,
  llmServicesParam?: string,
  transcriptServicesParam?: string
): Promise<void> {
  
  if (options.feed) {
    const workflowHandled = await handleWorkflow(options)
    if (workflowHandled) {
      return
    }
  }
  
  if (!options.rss || (Array.isArray(options.rss) && options.rss.length === 0)) {
    err('No RSS URLs provided for processing')
    process.exit(1)
  }
  
  const llmServices = llmServicesParam || getLLMService(options)
  const transcriptServices = transcriptServicesParam || getTranscriptService(options)
  
  if (options.item && !Array.isArray(options.item)) {
    options.item = [options.item]
  }
  
  if (typeof options.rss === 'string') {
    options.rss = [options.rss]
  }
  
  const expandedRssUrls: string[] = []
  const fsPromises = await import('node:fs/promises')
  const path = await import('node:path')
  
  for (const rssUrl of options.rss || []) {
    try {
      await fsPromises.access(rssUrl)
      const ext = path.extname(rssUrl).toLowerCase()
      if (ext === '.md') {
        const content = await fsPromises.readFile(rssUrl, 'utf8')
        const lines = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
        if (lines.length === 0) {
          err(`Error: No RSS URLs found in the .md file: ${rssUrl}`)
          process.exit(1)
        }
        expandedRssUrls.push(...lines)
      } else {
        expandedRssUrls.push(rssUrl)
      }
    } catch {
      expandedRssUrls.push(rssUrl)
    }
  }
  
  options.rss = expandedRssUrls
  validateRSSOptions(options)
  
  const rssUrls = options.rss
  if (!rssUrls || rssUrls.length === 0) {
    throw new Error(`No valid RSS URLs provided for processing`)
  }
  
  await processRSSFeeds(options, rssUrls, llmServices, transcriptServices)
}