import { l, err } from '@/logging'
import { existsSync } from '@/node-utils'
import { logMkdir } from './rss-logging.ts'
import type { ProcessingOptions } from '@/types'

const WORKFLOWS_DIR = 'output/workflows'

export function validateRSSOptions(options: ProcessingOptions): void {
  const p = '[text/process-commands/rss/validation]'
  l.dim(`${p} Starting RSS options validation`)
  
  if (options.last !== undefined) {
    if (!Number.isInteger(options.last) || options.last < 1) {
      err('Error: The --last option must be a positive integer.')
      process.exit(1)
    }
    if (options.order !== undefined) {
      err('Error: The --last option cannot be used with --order.')
      process.exit(1)
    }
    l.dim(`${p} Last option validated: ${options.last}`)
  }
  
  if (options.order !== undefined && !['newest', 'oldest'].includes(options.order)) {
    err("Error: The --order option must be either 'newest' or 'oldest'.")
    process.exit(1)
  }
  
  if (options.days !== undefined) {
    if (!Number.isInteger(options.days) || options.days < 1) {
      err('Error: The --days option must be a positive integer.')
      process.exit(1)
    }
    if (
      options.last !== undefined ||
      options.order !== undefined ||
      (options.date && options.date.length > 0)
    ) {
      err('Error: The --days option cannot be used with --last, --order, or --date.')
      process.exit(1)
    }
    l.dim(`${p} Days option validated: ${options.days}`)
  }
  
  if (options.date && options.date.length > 0) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const d of options.date) {
      if (!dateRegex.test(d)) {
        err(`Error: Invalid date format "${d}". Please use YYYY-MM-DD format.`)
        process.exit(1)
      }
    }
    if (
      options.last !== undefined ||
      options.order !== undefined
    ) {
      err('Error: The --date option cannot be used with --last or --order.')
      process.exit(1)
    }
    l.dim(`${p} Date filtering enabled for ${options.date.length} dates: ${options.date.join(', ')}`)
  }
  
  l.dim(`${p} RSS validation completed successfully`)
}

export async function ensureWorkflowDirectories(dirName: string): Promise<void> {
  const p = '[text/process-commands/rss/validation]'
  l.dim(`${p} Ensuring workflow directories for: ${dirName}`)
  
  const directories = [
    `${WORKFLOWS_DIR}/${dirName}`,
    `${WORKFLOWS_DIR}/${dirName}/${dirName}-info`,
    `${WORKFLOWS_DIR}/${dirName}/${dirName}-shownotes`
  ]
  
  for (const dir of directories) {
    await logMkdir(dir, 'ensureWorkflowDirectories')
  }
  
  l.dim(`${p} Workflow directories created successfully for: ${dirName}`)
}

export function validateFeedsFile(feedFilename: string): boolean {
  const p = '[text/process-commands/rss/validation]'
  const feedsDir = `./${WORKFLOWS_DIR}/feeds`
  const feedFile = `${feedsDir}/${feedFilename}`
  
  l.dim(`${p} Checking for feeds directory at: ${feedsDir}`)
  
  if (!existsSync(feedsDir)) {
    l.warn(`${p} Feeds directory not found at ${feedsDir}`)
    return false
  }
  
  l.dim(`${p} Checking for feed file at: ${feedFile}`)
  
  if (!existsSync(feedFile)) {
    l.warn(`${p} Feed file not found at ${feedFile}`)
    return false
  }
  
  l.dim(`${p} Feed file validation successful`)
  return true
}

export function getLLMService(options: ProcessingOptions): string | undefined {
  const p = '[text/process-commands/rss/services]'
  l.dim(`${p} Detecting LLM service from options`)
  
  if (options.chatgpt) {
    l.dim(`${p} ChatGPT service detected`)
    return 'chatgpt'
  }
  if (options.claude) {
    l.dim(`${p} Claude service detected`)
    return 'claude'
  }
  if (options.gemini) {
    l.dim(`${p} Gemini service detected`)
    return 'gemini'
  }
  
  l.dim(`${p} No LLM service detected`)
  return undefined
}

export function getTranscriptService(options: ProcessingOptions): string | undefined {
  const p = '[text/process-commands/rss/services]'
  l.dim(`${p} Detecting transcription service from options`)
  
  if (options.deepgram) {
    l.dim(`${p} Deepgram service detected`)
    return 'deepgram'
  }
  if (options.assembly) {
    l.dim(`${p} Assembly service detected`)
    return 'assembly'
  }
  if (options.whisper) {
    l.dim(`${p} Whisper service detected`)
    return 'whisper'
  }
  
  l.dim(`${p} No transcription service detected`)
  return undefined
}