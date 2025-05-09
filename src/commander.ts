// src/commander.ts

import { Command } from 'commander'
import { processVideo } from './process-commands/video.ts'
import { processPlaylist } from './process-commands/playlist.ts'
import { processChannel } from './process-commands/channel.ts'
import { processURLs } from './process-commands/urls.ts'
import { processFile } from './process-commands/file.ts'
import { processRSS } from './process-commands/rss.ts'
import { LLM_SERVICES_CONFIG } from './process-steps/05-run-llm.ts'
import { handleMetaWorkflow } from './utils/workflows.ts'
import { l, err, logSeparator, logInitialFunctionCall } from './utils/logging.ts'
import { argv, exit, fileURLToPath } from './utils/node-utils.ts'
import type { ProcessingOptions } from './utils/types.ts'
import path from 'node:path'

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

export function logCommandValidation(stage: string, detail: Record<string, unknown>): void {
  l.dim(`[CommandValidation:${stage}]`)
  Object.entries(detail).forEach(([key, value]) =>
    l.dim(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
  )
}

export function validateCommandInput(options: ProcessingOptions): {
  action?: keyof typeof COMMAND_CONFIG,
  llmServices?: string,
  transcriptServices?: string
} {
  logCommandValidation('start', { options: Object.keys(options).filter(k => options[k]) })
  const actionKeys = Object.keys(COMMAND_CONFIG) as Array<keyof typeof COMMAND_CONFIG>
  const selectedActions = actionKeys.filter(key => {
    const value = options[key]
    return value !== undefined &&
           value !== null &&
           value !== '' &&
           (typeof value !== 'boolean' || value === true)
  })
  logCommandValidation('actions', { selectedActions })
  if (selectedActions.length > 1) {
    err(`Error: Multiple input options provided (${selectedActions.join(', ')}). Please specify only one.`)
    exit(1)
  }
  const action = selectedActions[0]
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
  logCommandValidation('llms', { selectedLLMs })
  if (selectedLLMs.length > 1) {
    err(`Error: Multiple LLM options provided (${selectedLLMs.join(', ')}). Please specify only one.`)
    exit(1)
  }
  const llmServices = selectedLLMs[0]
  let transcriptServices: string | undefined
  if (options.deepgram) transcriptServices = 'deepgram'
  else if (options.assembly) transcriptServices = 'assembly'
  else if (options.whisper) transcriptServices = 'whisper'
  const needsTranscription = !options.info && !options['metaDir'] && action !== undefined
  if (needsTranscription && !transcriptServices) {
    l.warn("Defaulting to Whisper for transcription as no service was specified.")
    options.whisper = true
    transcriptServices = 'whisper'
  }
  logCommandValidation('result', { action, llmServices, transcriptServices })
  return { action, llmServices, transcriptServices }
}

export async function processCommand(
  options: ProcessingOptions
): Promise<void> {
  l.dim('[processCommand] Starting command processing')
  
  const workflowHandled = await handleMetaWorkflow(options)
  if (workflowHandled) {
    l.dim('[processCommand] Meta workflow handled')
    exit(0)
  }
  const { action, llmServices, transcriptServices } = validateCommandInput(options)
  if (!action) {
    if (!options['metaDir']) {
      err('Error: No action specified (e.g., --video, --rss, --metaDir). Use --help for options.')
      program.help()
    }
    exit(1)
  }
  l.dim(`[processCommand] Processing action: ${action} with LLM: ${llmServices || 'none'} and transcription: ${transcriptServices || 'none'}`)
  try {
    if (action === 'rss') {
      await COMMAND_CONFIG[action].handler(options, llmServices, transcriptServices)
    } else {
      const input = options[action]
      if (!input || typeof input !== 'string') {
        throw new Error(`No valid input provided for ${action} processing`)
      }
      await COMMAND_CONFIG[action].handler(options, input, llmServices, transcriptServices)
    }
    logSeparator({ type: 'completion', descriptor: action })
    exit(0)
  } catch (error) {
    err(`Error processing ${action}: ${(error as Error).message}`)
    exit(1)
  }
}

const program = new Command()
program
  .name('autoshow-cli')
  .description('Automate processing of audio/video content and manage meta-workflows.')
  .usage('[options]')
  .option('--video <url>', 'Process a single YouTube video')
  .option('--playlist <playlistUrl>', 'Process all videos in a YouTube playlist')
  .option('--channel <channelUrl>', 'Process all videos in a YouTube channel')
  .option('--urls <filePath>', 'Process YouTube videos from a list of URLs in a file')
  .option('--file <filePath>', 'Process a local audio or video file')
  .option('--rss <rssURLs...>', 'Process one or more podcast RSS feeds')
  .option('--item <itemUrls...>', 'Process specific items in the RSS feed by providing their audio URLs')
  .option('--order <order>', 'Specify the order for RSS feed processing (newest or oldest)')
  .option('--skip <number>', 'Number of items to skip when processing RSS feed', parseInt)
  .option('--last <number>', 'Number of most recent items to process (overrides --order and --skip)', parseInt)
  .option('--date <dates...>', 'Process items from these dates (YYYY-MM-DD) for RSS processing')
  .option('--lastDays <number>', 'Number of days to look back for items for RSS processing', parseInt)
  .option('--info', 'Skip processing and write metadata to JSON objects (supports --urls, --rss, --playlist, --channel)')
  .option('--whisper [model]', 'Use Whisper.cpp for transcription with optional model specification (e.g., base, large-v3-turbo)')
  .option('--deepgram [model]', 'Use Deepgram for transcription with optional model specification (e.g., nova-2)')
  .option('--assembly [model]', 'Use AssemblyAI for transcription with optional model specification (e.g., best, nano)')
  .option('--speakerLabels', 'Use speaker labels for AssemblyAI or Deepgram transcription')
  .option('--chatgpt [model]', 'Use OpenAI ChatGPT for processing with optional model specification')
  .option('--claude [model]', 'Use Anthropic Claude for processing with optional model specification')
  .option('--gemini [model]', 'Use Google Gemini for processing with optional model specification')
  .option('--prompt <sections...>', 'Specify prompt sections to include (e.g., summary longChapters)')
  .option('--customPrompt <filePath>', 'Use a custom prompt from a markdown file')
  .option('--saveAudio', 'Do not delete intermediary audio files (e.g., .wav) after processing')
  .option('--metaDir <dirName>', 'The meta-workflow directory name (e.g., "01-ai") located inside current directory')
  .option('--metaSrcDir <sourceDir>', 'The meta-workflow source data directory (e.g., "autoshow-daily", "mk-auto"), relative to current directory')
  .option('--metaDate <dateParam>', 'The date for the meta-workflow shownotes (YYYY-MM-DD); can be appended to npm script')
  .option('--metaInfo', 'Run the meta-workflow for information gathering')
  .option('--metaShownotes', 'Run the meta-workflow for shownotes generation')

program.action(async (options: ProcessingOptions & { metaDate?: string | string[] }) => {
  logInitialFunctionCall('autoshowCLI', options)
  await processCommand(options)
})

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`)
  exit(1)
})

const thisFilePath = fileURLToPath(import.meta.url)
if (argv[1] === thisFilePath || path.basename(argv[1] ?? '') === 'commander.ts') {
  program.parseAsync(argv)
}