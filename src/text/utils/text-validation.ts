import { processVideo } from '../process-commands/video.ts'
import { processPlaylist } from '../process-commands/playlist.ts'
import { processChannel } from '../process-commands/channel'
import { processURLs } from '../process-commands/urls.ts'
import { processFile } from '../process-commands/file.ts'
import { processRSS } from '../process-commands/rss'
import { LLM_SERVICES_CONFIG } from '../process-steps/04-run-llm/llm-models.ts'
import { l, err, logCommandValidation } from '@/logging'
import { exit } from '@/node-utils'
import type { ProcessingOptions } from '@/types'

export const COMMAND_CONFIG = {
  video: {
    description: 'Single YouTube Video',
    message: 'Enter the YouTube video URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
    handler: processVideo,
  },
  playlist: {
    description: 'YouTube Playlist',
    message: 'Enter the YouTube playlist URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
    handler: processPlaylist,
  },
  channel: {
    description: 'YouTube Channel',
    message: 'Enter the YouTube channel URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
    handler: processChannel,
  },
  urls: {
    description: 'List of URLs from File',
    message: 'Enter the file path containing URLs:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid file path.',
    handler: processURLs,
  },
  file: {
    description: 'Local Audio/Video File',
    message: 'Enter the local audio/video file path:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid file path.',
    handler: processFile,
  },
  rss: {
    description: 'Podcast RSS Feed',
    message: 'Enter the podcast RSS feed URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
    handler: processRSS,
  }
}

export function validateCommandInput(options: ProcessingOptions): {
  action?: keyof typeof COMMAND_CONFIG,
  llmServices?: string,
  transcriptServices?: string
} {
  const p = '[text/utils/text-validation]'
  l.dim(`${p} Starting command input validation`)
  logCommandValidation('start', { options: Object.keys(options).filter(k => options[k]) })
  
  const actionKeys = Object.keys(COMMAND_CONFIG) as Array<keyof typeof COMMAND_CONFIG>
  const selectedActions = actionKeys.filter(key => {
    const value = options[key]
    return value !== undefined &&
           value !== null &&
           value !== '' &&
           (typeof value !== 'boolean' || value === true)
  })
  
  l.dim(`${p} Found ${selectedActions.length} selected actions: ${selectedActions.join(', ')}`)
  logCommandValidation('actions', { selectedActions })
  
  if (selectedActions.length > 1) {
    err(`Error: Multiple input options provided (${selectedActions.join(', ')}). Please specify only one.`)
    exit(1)
  }
  
  const action = selectedActions[0]
  l.dim(`${p} Selected action: ${action || 'none'}`)
  
  const llmKeys = Object.values(LLM_SERVICES_CONFIG)
    .map(service => service.value)
    .filter(value => value !== null) as string[]
  const selectedLLMs = llmKeys.filter(key => {
    const value = options[key as keyof ProcessingOptions]
    return value !== undefined &&
           value !== null &&
           value !== '' &&
           (typeof value !== 'boolean' || value === true)
  })
  
  l.dim(`${p} Found ${selectedLLMs.length} selected LLMs: ${selectedLLMs.join(', ')}`)
  logCommandValidation('llms', { selectedLLMs })
  
  if (selectedLLMs.length > 1) {
    err(`Error: Multiple LLM options provided (${selectedLLMs.join(', ')}). Please specify only one.`)
    exit(1)
  }
  
  const llmServices = selectedLLMs[0]
  let transcriptServices: string | undefined
  
  if (options.whisperCoreml) transcriptServices = 'whisperCoreml'
  else if (options.deepgram) transcriptServices = 'deepgram'
  else if (options.assembly) transcriptServices = 'assembly'
  else if (options.whisper) transcriptServices = 'whisper'
  else if (options.groqWhisper) transcriptServices = 'groqWhisper'
  
  l.dim(`${p} Selected transcription service: ${transcriptServices || 'none'}`)
  
  const needsTranscription = !options.info && !options.feed && action !== undefined
  if (needsTranscription && !transcriptServices) {
    l.warn("Defaulting to Whisper for transcription as no service was specified.")
    options.whisper = true
    transcriptServices = 'whisper'
  }
  
  logCommandValidation('result', { action, llmServices, transcriptServices })
  return { action, llmServices, transcriptServices }
}