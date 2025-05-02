// src/commander.ts

import { Command } from 'commander'
import { processVideo } from './process-commands/video.ts'
import { processPlaylist } from './process-commands/playlist.ts'
import { processChannel } from './process-commands/channel.ts'
import { processURLs } from './process-commands/urls.ts'
import { processFile } from './process-commands/file.ts'
import { processRSS, validateRSSAction } from './process-commands/rss.ts'
import { estimateTranscriptCost } from './process-steps/03-run-transcription.ts'
import { selectPrompts } from './process-steps/04-select-prompt.ts'
import { logLLMCost } from './process-steps/05-run-llm.ts'
// import { createEmbeds } from './utils/embeddings/create-embed.ts'
// import { queryEmbeddings } from './utils/embeddings/query-embed.ts'
import { LLM_SERVICES_CONFIG } from './utils/constants.ts'
import { l, err, logSeparator } from './utils/logging.ts'
import { argv, exit, fileURLToPath, readFile } from './utils/node-utils.ts'
import type { ProcessingOptions, HandlerFunction } from './utils/types.ts'

export const PROCESS_HANDLERS = {
  video: processVideo,
  playlist: processPlaylist,
  channel: processChannel,
  urls: processURLs,
  file: processFile,
  rss: processRSS,
}

export const ACTION_OPTIONS = [
  {
    name: 'video',
    description: 'Single YouTube Video',
    message: 'Enter the YouTube video URL:',
    validate: (input: string) => input ? true : 'Please enter a valid URL.',
  },
  {
    name: 'playlist',
    description: 'YouTube Playlist',
    message: 'Enter the YouTube playlist URL:',
    validate: (input: string) => input ? true : 'Please enter a valid URL.',
  },
  {
    name: 'channel',
    description: 'YouTube Channel',
    message: 'Enter the YouTube channel URL:',
    validate: (input: string) => input ? true : 'Please enter a valid URL.',
  },
  {
    name: 'urls',
    description: 'List of URLs from File',
    message: 'Enter the file path containing URLs:',
    validate: (input: string) => input ? true : 'Please enter a valid file path.',
  },
  {
    name: 'file',
    description: 'Local Audio/Video File',
    message: 'Enter the local audio/video file path:',
    validate: (input: string) => input ? true : 'Please enter a valid file path.',
  },
  {
    name: 'rss',
    description: 'Podcast RSS Feed',
    message: 'Enter the podcast RSS feed URL:',
    validate: (input: string) => input ? true : 'Please enter a valid URL.',
  },
]

export async function estimateLLMCost(
  options: ProcessingOptions,
  llmService: string
) {
  const filePath = options.llmCost
  if (!filePath) {
    throw new Error('No file path provided to estimate LLM cost.')
  }

  l.dim(`\nEstimating LLM cost for '${llmService}' with file: ${filePath}`)

  try {
    l.dim('[estimateLLMCost] reading file for cost estimate...')
    const content = await readFile(filePath, 'utf8')
    l.dim('[estimateLLMCost] file content length:', content.length)

    const tokenCount = approximateTokens(content)
    l.dim('[estimateLLMCost] approximate token count:', tokenCount)

    let userModel = typeof options[llmService] === 'string'
      ? options[llmService] as string
      : undefined

    if (llmService === 'chatgpt' && (userModel === undefined || userModel === 'true')) {
      userModel = 'gpt-4o-mini'
    }
    if (llmService === 'claude' && (userModel === undefined || userModel === 'true')) {
      userModel = 'claude-3-5-haiku-latest'
    }
    if (llmService === 'gemini' && (userModel === undefined || userModel === 'true')) {
      userModel = 'gemini-1.5-flash'
    }

    l.dim('[estimateLLMCost] determined userModel:', userModel)

    const name = userModel || llmService

    const costInfo = logLLMCost({
      name,
      stopReason: 'n/a',
      tokenUsage: {
        input: tokenCount,
        output: 4000,
        total: tokenCount
      }
    })

    l.dim('[estimateLLMCost] final cost estimate (totalCost):', costInfo.totalCost)
    return costInfo.totalCost ?? 0
  } catch (error) {
    err(`Error estimating LLM cost: ${(error as Error).message}`)
    throw error
  }
}

function approximateTokens(text: string) {
  const words = text.trim().split(/\s+/)
  return Math.max(1, words.length)
}

export function validateOption(
  optionKeys: string[],
  options: ProcessingOptions,
  errorMessage: string
) {
  const selectedOptions = optionKeys.filter((opt) => {
    const value = options[opt as keyof ProcessingOptions]
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return value !== undefined && value !== null && value !== false
  })

  if (selectedOptions.length > 1) {
    err(`Error: Multiple ${errorMessage} provided (${selectedOptions.join(', ')}). Please specify only one.`)
    exit(1)
  }
  return selectedOptions[0] as string | undefined
}

export function validateInputCLI(options: ProcessingOptions): { action: 'video' | 'playlist' | 'channel' | 'urls' | 'file' | 'rss', llmServices: string | undefined, transcriptServices: string | undefined } {
  const actionValues = ACTION_OPTIONS.map((opt) => opt.name)
  const selectedAction = validateOption(actionValues, options, 'input option')
  if (!selectedAction || !(selectedAction in PROCESS_HANDLERS)) {
    err(`Invalid or missing action`)
    exit(1)
  }
  const action = selectedAction as 'video' | 'playlist' | 'channel' | 'urls' | 'file' | 'rss'
  const llmServices = validateLLM(options)
  const transcriptServices = validateTranscription(options)

  return { action, llmServices, transcriptServices }
}

export function validateLLM(options: ProcessingOptions) {
  // Collect all service values (excluding null) from LLM_SERVICES_CONFIG
  const llmKeys = Object.values(LLM_SERVICES_CONFIG)
    .map((service) => service.value)
    .filter((v) => v !== null) as string[]

  const llmKey = validateOption(llmKeys, options, 'LLM option')
  if (!llmKey) {
    return undefined
  }
  return llmKey
}

export function validateTranscription(options: ProcessingOptions) {
  if (options.deepgram) {
    return 'deepgram'
  } else if (options.assembly) {
    return 'assembly'
  } else if (options.whisper) {
    return 'whisper'
  }
  options.whisper = true
  return 'whisper'
}

export async function processAction(
  action: 'video' | 'playlist' | 'channel' | 'urls' | 'file' | 'rss',
  options: ProcessingOptions,
  llmServices?: string,
  transcriptServices?: string
) {
  const handler = PROCESS_HANDLERS[action] as HandlerFunction

  if (action === 'rss') {
    await validateRSSAction(options, handler, llmServices, transcriptServices)
    return
  }

  const input = options[action]
  if (!input || typeof input !== 'string') {
    throw new Error(`No valid input provided for ${action} processing`)
  }

  await handler(options, input, llmServices, transcriptServices)
}

export async function handleEarlyExitIfNeeded(options: ProcessingOptions): Promise<void> {
  // If the user just wants to print prompts, do that and exit
  if (options.printPrompt) {
    const prompt = await selectPrompts({ printPrompt: options.printPrompt })
    console.log(prompt)
    exit(0)
  }

  // const cliDirectory = options['directory']

  // if (options['createEmbeddings']) {
  //   try {
  //     await createEmbeds(cliDirectory)
  //     console.log('Embeddings created successfully.')
  //   } catch (error) {
  //     err(`Error creating embeddings: ${(error as Error).message}`)
  //     exit(1)
  //   }
  //   exit(0)
  // }

  // if (options['queryEmbeddings']) {
  //   const question = options['queryEmbeddings']
  //   try {
  //     await queryEmbeddings(question, cliDirectory)
  //   } catch (error) {
  //     err(`Error querying embeddings: ${(error as Error).message}`)
  //     exit(1)
  //   }
  //   exit(0)
  // }

  // Handle transcript cost estimation
  if (options.transcriptCost) {
    const transcriptServices = validateTranscription(options)

    if (!transcriptServices) {
      err('Please specify which transcription service to use (e.g., --deepgram, --assembly, --whisper).')
      exit(1)
    }

    await estimateTranscriptCost(options, transcriptServices)
    exit(0)
  }

  // Handle LLM cost estimation
  if (options.llmCost) {
    const llmService = validateLLM(options)

    if (!llmService) {
      err('Please specify which LLM service to use (e.g., --chatgpt, --claude, etc.).')
      exit(1)
    }

    await estimateLLMCost(options, llmService)
    exit(0)
  }
}

export const ENV_VARS_MAP = {
  openaiApiKey: 'OPENAI_API_KEY',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  deepgramApiKey: 'DEEPGRAM_API_KEY',
  assemblyApiKey: 'ASSEMBLY_API_KEY',
  geminiApiKey: 'GEMINI_API_KEY',
}

const program = new Command()

program
  .name('autoshow')
  .version('0.0.1')
  .description('Automate processing of audio and video content from various sources.')
  .usage('[options]')
  // Input source options
  .option('--video <url>', 'Process a single YouTube video')
  .option('--playlist <playlistUrl>', 'Process all videos in a YouTube playlist')
  .option('--channel <channelUrl>', 'Process all videos in a YouTube channel')
  .option('--urls <filePath>', 'Process YouTube videos from a list of URLs in a file')
  .option('--file <filePath>', 'Process a local audio or video file')
  .option('--rss <rssURLs...>', 'Process one or more podcast RSS feeds')
  // RSS feed specific options
  .option('--item <itemUrls...>', 'Process specific items in the RSS feed by providing their audio URLs')
  .option('--order <order>', 'Specify the order for RSS feed processing (newest or oldest)')
  .option('--skip <number>', 'Number of items to skip when processing RSS feed', parseInt)
  .option('--last <number>', 'Number of most recent items to process (overrides --order and --skip)', parseInt)
  .option('--date <dates...>', 'Process items from these dates (YYYY-MM-DD)')
  .option('--lastDays <number>', 'Number of days to look back for items', parseInt)
  .option('--info', 'Skip processing and write metadata to JSON objects (supports --urls, --rss, --playlist, --channel)')
  // Transcription service options
  .option('--whisper [model]', 'Use Whisper.cpp for transcription with optional model specification')
  .option('--deepgram [model]', 'Use Deepgram for transcription with optional model specification')
  .option('--assembly [model]', 'Use AssemblyAI for transcription with optional model specification')
  .option('--speakerLabels', 'Use speaker labels for AssemblyAI transcription')
  .option('--transcriptCost <filePath>', 'Estimate transcription cost for the given file')
  .option('--llmCost <filePath>', 'Estimate LLM cost for the given prompt and transcript file')
  // LLM service options
  .option('--chatgpt [model]', 'Use ChatGPT for processing with optional model specification')
  .option('--claude [model]', 'Use Claude for processing with optional model specification')
  .option('--gemini [model]', 'Use Gemini for processing with optional model specification')
  // Utility options
  .option('--prompt <sections...>', 'Specify prompt sections to include')
  .option('--printPrompt <sections...>', 'Print the prompt sections without processing')
  .option('--customPrompt <filePath>', 'Use a custom prompt from a markdown file')
  .option('--saveAudio', 'Do not delete intermediary files after processing')
  // Options to override environment variables from CLI
  .option('--openaiApiKey <key>', 'Specify OpenAI API key (overrides .env variable)')
  .option('--anthropicApiKey <key>', 'Specify Anthropic API key (overrides .env variable)')
  .option('--deepgramApiKey <key>', 'Specify Deepgram API key (overrides .env variable)')
  .option('--assemblyApiKey <key>', 'Specify AssemblyAI API key (overrides .env variable)')
  .option('--geminiApiKey <key>', 'Specify Gemini API key (overrides .env variable)')
  // Create and query embeddings based on show notes
  .option('--createEmbeddings [directory]', 'Create embeddings for .md content (optionally specify directory)')
  .option('--queryEmbeddings <question>', 'Query embeddings by question from embeddings.db')

program.action(async (options: ProcessingOptions) => {
  Object.entries(ENV_VARS_MAP).forEach(([key, envKey]) => {
    const value = (options as Record<string, string | undefined>)[key]
    if (value) process.env[envKey] = value
  })
  l.opts(`Options received at beginning of command:\n`)
  l.opts(JSON.stringify(options, null, 2))
  l.opts(``)
  await handleEarlyExitIfNeeded(options)
  const { action, llmServices, transcriptServices } = validateInputCLI(options)
  try {
    await processAction(action, options, llmServices, transcriptServices)
    logSeparator({ type: 'completion', descriptor: action })
    exit(0)
  } catch (error) {
    err(`Error processing ${action}:`, (error as Error).message)
    exit(1)
  }
})

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`)
  exit(1)
})

const thisFilePath = fileURLToPath(import.meta.url)
if (process.argv[1] === thisFilePath) {
  program.parse(argv)
}