import { l, err } from '@/logging'
import { existsSync } from '@/node-utils'
import { logMkdir } from './rss-logging'
import type { ProcessingOptions } from '@/text/text-types'
import { EXIT_USAGE } from '@/utils'

const WORKFLOWS_DIR = 'input/workflows'

export function validateRSSOptions(options: ProcessingOptions): void {
  if (options.last !== undefined) {
    if (!Number.isInteger(options.last) || options.last < 1) {
      err('Error: The --last option must be a positive integer.', undefined, EXIT_USAGE)
    }
    if (options.order !== undefined) {
      err('Error: The --last option cannot be used with --order.', undefined, EXIT_USAGE)
    }
  }
  
  if (options.order !== undefined && !['newest', 'oldest'].includes(options.order)) {
    err("Error: The --order option must be either 'newest' or 'oldest'.", undefined, EXIT_USAGE)
  }
  
  if (options.days !== undefined) {
    if (!Number.isInteger(options.days) || options.days < 1) {
      err('Error: The --days option must be a positive integer.', undefined, EXIT_USAGE)
    }
    if (
      options.last !== undefined ||
      options.order !== undefined ||
      (options.date && options.date.length > 0)
    ) {
      err('Error: The --days option cannot be used with --last, --order, or --date.', undefined, EXIT_USAGE)
    }
  }
  
  if (options.date && options.date.length > 0) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const d of options.date) {
      if (!dateRegex.test(d)) {
        err('Error: Invalid date format. Please use YYYY-MM-DD format', { date: d }, EXIT_USAGE)
      }
    }
    if (
      options.last !== undefined ||
      options.order !== undefined
    ) {
      err('Error: The --date option cannot be used with --last or --order.', undefined, EXIT_USAGE)
    }
  }
}

export async function ensureWorkflowDirectories(dirName: string): Promise<void> {
  const directories = [
    `${WORKFLOWS_DIR}/${dirName}`,
    `${WORKFLOWS_DIR}/${dirName}/${dirName}-info`,
    `${WORKFLOWS_DIR}/${dirName}/${dirName}-shownotes`
  ]
  
  for (const dir of directories) {
    await logMkdir(dir, 'ensureWorkflowDirectories')
  }
}

export function validateFeedsFile(feedFilename: string): boolean {
  const p = '[text/process-commands/rss/validation]'
  const feedsDir = `./${WORKFLOWS_DIR}/feeds`
  const feedFile = `${feedsDir}/${feedFilename}`
  
  if (!existsSync(feedsDir)) {
    l('Feeds directory not found', { prefix: p, feedsDir })
    return false
  }
  
  if (!existsSync(feedFile)) {
    l('Feed file not found', { prefix: p, feedFile })
    return false
  }
  
  return true
}

export function getLLMService(options: ProcessingOptions): string | undefined {
  if (options.chatgpt) return 'chatgpt'
  if (options.claude) return 'claude'
  if (options.gemini) return 'gemini'
  return undefined
}

export function getTranscriptService(options: ProcessingOptions): string | undefined {
  if (options.reverb) return 'reverb'
  if (options.deepgram) return 'deepgram'
  if (options.assembly) return 'assembly'
  if (options.whisperCoreml) return 'whisperCoreml'
  if (options.whisper) return 'whisper'
  if (options.groqWhisper) return 'groqWhisper'
  return undefined
}
