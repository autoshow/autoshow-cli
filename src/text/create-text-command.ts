import { Command } from 'commander'
import { processVideo } from './process-commands/video'
import { processPlaylist } from './process-commands/playlist'
import { processChannel } from './process-commands/channel/process-channel'
import { processURLs } from './process-commands/urls'
import { processFile } from './process-commands/file'
import { processRSS } from './process-commands/rss/process-rss'
import { printPrompt } from './process-steps/03-select-prompts/print-prompt'
import { LLM_SERVICES_CONFIG } from './process-steps/04-run-llm/llm-models'
import { l, err, success } from '@/logging'
import { exit } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'

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
  const actionKeys = Object.keys(COMMAND_CONFIG) as Array<keyof typeof COMMAND_CONFIG>
  const selectedActions = actionKeys.filter(key => {
    const value = options[key]
    return value !== undefined &&
           value !== null &&
           value !== '' &&
           (typeof value !== 'boolean' || value === true)
  })
  
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
  
  const needsTranscription = !options.info && !options.feed && action !== undefined
  if (needsTranscription && !transcriptServices) {
    l("Defaulting to Whisper for transcription as no service was specified.")
    options.whisper = true
    transcriptServices = 'whisper'
  }
  
  // Validate music service options - only one allowed
  if (options.elevenlabs && options.minimax) {
    err('Cannot use both --elevenlabs and --minimax. Please specify only one music service.')
    exit(1)
  }
  
  const musicGenre = options.elevenlabs || options.minimax
  const musicService = options.elevenlabs ? 'elevenlabs' : options.minimax ? 'minimax' : undefined
  
  if (musicGenre) {
    const validGenres = ['rap', 'rock', 'folk', 'jazz', 'pop', 'country']
    if (!validGenres.includes(musicGenre)) {
      err(`Invalid --${musicService} genre: ${musicGenre}. Valid options: ${validGenres.join(', ')}`)
      exit(1)
    }
    if (!llmServices) {
      err(`--${musicService} requires an LLM option (--chatgpt, --claude, or --gemini)`)
      exit(1)
    }
  }
  
  return { action, llmServices, transcriptServices }
}

export async function processCommand(
  options: ProcessingOptions
): Promise<void> {
  if (options.printPrompt) {
    await printPrompt(options.printPrompt)
    exit(0)
  }
  
  if (!options.inputDir) {
    options.inputDir = 'input'
  }
  
  if (options.rss && Array.isArray(options.rss) && options.rss.length === 0) {
    options.rss = undefined
  }
  
  const { action, llmServices, transcriptServices } = validateCommandInput(options)
  
  if (!action && !options.feed) {
    err('Error: No action specified (e.g., --video, --rss, --feed). Use --help for options.')
    process.exit(1)
  }
  
  if (options.feed && !action) {
    await processRSS(options, llmServices, transcriptServices)
    exit(0)
  }
  
  if (action === 'rss' && options.feed) {
    await COMMAND_CONFIG.rss.handler(options, llmServices, transcriptServices)
    exit(0)
  }
  
  try {
    if (action === 'rss') {
      await COMMAND_CONFIG[action].handler(options, llmServices, transcriptServices)
    } else {
      if (!action) {
        throw new Error('No action specified for processing')
      }
      const input = options[action]
      if (!input || typeof input !== 'string') {
        throw new Error(`No valid input provided for ${action} processing`)
      }
      await COMMAND_CONFIG[action].handler(options, input, llmServices, transcriptServices)
    }
    
    success(`${action} processing completed successfully`)
    exit(0)
  } catch (error) {
    err(`Error processing ${action}: ${(error as Error).message}`)
    exit(1)
  }
}

export const createTextCommand = (): Command => {
  const textCommand = new Command('text')
    .description('Process audio/video content into text-based outputs')
    .option('--printPrompt <sections...>', 'Print selected prompt sections without processing (e.g., summary longChapters)')
    .option('--input-dir <directory>', 'Input directory for files (default: input)')
    .option('--output-dir <subdirectory>', 'Output subdirectory within output/ (optional)')
    .option('--video <url>', 'Process a single YouTube video')
    .option('--playlist <playlistUrl>', 'Process all videos in a YouTube playlist')
    .option('--channel <channelUrl>', 'Process all videos in a YouTube channel')
    .option('--urls <filePath>', 'Process YouTube videos from a list of URLs in a file')
    .option('--file <filePath>', 'Process a local audio or video file')
    .option('--rss [rssURLs...]', 'Process one or more podcast RSS feeds (optional when using --feed)')
    .option('--feed <feedFile>', 'Process workflow feed file (e.g., "01-ai-feeds.md") from input/workflows/feeds')
    .option('--metaInfo', 'Additionally run workflow for information gathering')
    .option('--item <itemUrls...>', 'Process specific items in the RSS feed by providing their audio URLs')
    .option('--order <order>', 'Specify the order for RSS feed and channel processing (newest or oldest)')
    .option('--last <number>', 'Number of most recent items to process (overrides --order)', parseInt)
    .option('--date <dates...>', 'Process items from these dates (YYYY-MM-DD) for RSS and channel processing')
    .option('--days <number>', 'Number of days to look back for items for RSS and channel processing', parseInt)
    .option('--info [type]', 'Skip processing and write metadata to JSON objects. Use "combined" to merge multiple RSS feeds.', false)
    .option('--whisper-coreml [model]', 'Use Whisper.cpp (CoreML) for transcription with optional model specification (e.g., base, base.en, large-v3-turbo)')
    .option('--whisper [model]', 'Use Whisper.cpp for transcription with optional model specification (e.g., base, large-v3-turbo)')
    .option('--deepgram [model]', 'Use Deepgram for transcription with optional model specification (e.g., nova-3)')
    .option('--assembly [model]', 'Use AssemblyAI for transcription with optional model specification (e.g., universal, nano)')
    .option('--groq-whisper [model]', 'Use Groq Whisper for transcription with optional model specification (e.g., whisper-large-v3-turbo, distil-whisper-large-v3-en, whisper-large-v3)')
    .option('--speakerLabels', 'Use speaker labels for AssemblyAI or Deepgram transcription')
    .option('--chatgpt [model]', 'Use OpenAI ChatGPT for processing with optional model specification')
    .option('--claude [model]', 'Use Anthropic Claude for processing with optional model specification')
    .option('--gemini [model]', 'Use Google Gemini for processing with optional model specification')
    .option('--prompt <sections...>', 'Specify prompt sections to include (e.g., summary longChapters)')
    .option('--customPrompt <filePath>', 'Use a custom prompt from a markdown file')
    .option('--elevenlabs <genre>', 'Generate music with ElevenLabs after LLM processing (rap, rock, folk, jazz, pop, country)')
    .option('--minimax <genre>', 'Generate music with MiniMax after LLM processing (rap, rock, folk, jazz, pop, country)')
    .option('--music-format <format>', 'Output format for generated music (service-specific)')
    .option('--music-style <hint>', 'Additional style hints for music generation (appended to genre prompt)')
    .option('--saveAudio', 'Do not delete intermediary audio files (e.g., .wav) after processing')
    .option('--keyMomentsCount <number>', 'Number of key moments to extract (default: 3)', parseInt)
    .option('--keyMomentDuration <number>', 'Duration of each key moment segment in seconds (default: 60)', parseInt)
    .action(async (options: ProcessingOptions) => {
      l('Text command options:', options)
      await processCommand(options)
    })
  
  return textCommand
}