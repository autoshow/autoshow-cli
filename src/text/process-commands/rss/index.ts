import { validateRSSOptions } from './validation.ts'
import { getLLMService, getTranscriptService } from './services.ts'
import { processRSSFeeds } from './processor.ts'
import { handleWorkflow } from './workflows.ts'
import { l, err, logInitialFunctionCall } from '@/logging'
import type { ProcessingOptions } from '@/types'

export async function processRSS(
  options: ProcessingOptions,
  llmServicesParam?: string,
  transcriptServicesParam?: string
): Promise<void> {
  const p = '[text/process-commands/rss/index]'
  logInitialFunctionCall('processRSS', { llmServicesParam, transcriptServicesParam, options })
  
  if (options.feed) {
    l.dim(`${p} Feed option detected, handling as workflow`)
    const workflowHandled = await handleWorkflow(options)
    if (workflowHandled) {
      l.dim(`${p} Workflow completed successfully`)
      return
    }
  }
  
  if (!options.rss || (Array.isArray(options.rss) && options.rss.length === 0)) {
    err(`${p} No RSS URLs provided for processing`)
    process.exit(1)
  }
  
  l.dim(`${p} Starting RSS processing`)
  
  const llmServices = llmServicesParam || getLLMService(options)
  const transcriptServices = transcriptServicesParam || getTranscriptService(options)
  l.dim(`${p} Using LLM: ${llmServices || 'none'}, Transcription: ${transcriptServices || 'none'}`)
  
  if (options.item && !Array.isArray(options.item)) {
    options.item = [options.item]
    l.dim(`${p} Converted item to array: ${options.item.length} items`)
  }
  
  if (typeof options.rss === 'string') {
    options.rss = [options.rss]
    l.dim(`${p} Converted rss to array: ${options.rss.length} URLs`)
  }
  
  const expandedRssUrls: string[] = []
  const fsPromises = await import('node:fs/promises')
  const path = await import('node:path')
  
  for (const rssUrl of options.rss || []) {
    l.dim(`${p} Expanding URL: ${rssUrl}`)
    try {
      await fsPromises.access(rssUrl)
      const ext = path.extname(rssUrl).toLowerCase()
      if (ext === '.md') {
        l.dim(`${p} Processing markdown file: ${rssUrl}`)
        const content = await fsPromises.readFile(rssUrl, 'utf8')
        const lines = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
        if (lines.length === 0) {
          err(`Error: No RSS URLs found in the .md file: ${rssUrl}`)
          process.exit(1)
        }
        l.dim(`${p} Found ${lines.length} URLs in markdown file`)
        expandedRssUrls.push(...lines)
      } else {
        expandedRssUrls.push(rssUrl)
      }
    } catch {
      l.dim(`${p} URL not a local file, treating as remote: ${rssUrl}`)
      expandedRssUrls.push(rssUrl)
    }
  }
  
  options.rss = expandedRssUrls
  validateRSSOptions(options)
  
  const rssUrls = options.rss
  if (!rssUrls || rssUrls.length === 0) {
    l.dim(`${p} No valid RSS URLs found`)
    throw new Error(`No valid RSS URLs provided for processing`)
  }
  
  l.dim(`${p} Processing ${rssUrls.length} RSS URLs`)
  await processRSSFeeds(options, rssUrls, llmServices, transcriptServices)
  l.dim(`${p} RSS processing completed successfully`)
}