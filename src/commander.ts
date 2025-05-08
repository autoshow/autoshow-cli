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
import { LLM_SERVICES_CONFIG } from './utils/constants.ts'
import { l, err, logSeparator, logInitialFunctionCall } from './utils/logging.ts'
import { argv, exit, fileURLToPath, readFile, execPromise, mkdirSync, existsSync } from './utils/node-utils.ts'
import type { ProcessingOptions, HandlerFunction } from './utils/types.ts'
import path from 'node:path'

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
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
  },
  {
    name: 'playlist',
    description: 'YouTube Playlist',
    message: 'Enter the YouTube playlist URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
  },
  {
    name: 'channel',
    description: 'YouTube Channel',
    message: 'Enter the YouTube channel URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
  },
  {
    name: 'urls',
    description: 'List of URLs from File',
    message: 'Enter the file path containing URLs:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid file path.',
  },
  {
    name: 'file',
    description: 'Local Audio/Video File',
    message: 'Enter the local audio/video file path:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid file path.',
  },
  {
    name: 'rss',
    description: 'Podcast RSS Feed',
    message: 'Enter the podcast RSS feed URL:',
    validate: (input: string): boolean | string => input ? true : 'Please enter a valid URL.',
  },
]

async function logOperation(
  command: string,
  operationName: string,
  logFn: any,
  description: string
): Promise<void> {
  console.log('')
  logFn(`[${operationName}] Starting ${operationName}: ${description}`)
  logFn(`[${operationName}] Executing command: ${command}`)
  try {
    const { stdout, stderr } = await execPromise(command)
    logFn(`[${operationName}] stdout:`)
    console.log(stdout)
    if (stderr) {
      l.warn(`[${operationName}] stderr:`)
      console.warn(stderr)
    }
    logFn(`[${operationName}] Successfully finished ${operationName}: ${description}`)
  } catch (error: any) {
    err(`[${operationName}] Error during ${operationName}: ${error.message}`)
    throw error
  }
}

async function logCopy(source: string, destination: string, operationName: string, successMessage: string): Promise<void> {
  await logOperation(`cp -R "${source}" "${destination}"`, operationName, l, successMessage)
}

async function logMkdir(targetPath: string, operationName: string): Promise<void> {
  console.log('')
  l(`[${operationName}] Starting ${operationName}: Creating directory ${targetPath}`)
  try {
    if (!existsSync(targetPath)) {
      mkdirSync(targetPath, { recursive: true })
      l(`[${operationName}] Successfully created directory: ${targetPath}`)
    } else {
      l(`[${operationName}] Directory already exists: ${targetPath}`)
    }
  } catch (error: any) {
    err(`[${operationName}] Error creating directory ${targetPath}: ${error.message}`)
    throw error
  }
}

async function logFindMove(extension: string, sourceFolder: string, destFolder: string, operationName: string): Promise<void> {
  const command = `find "${sourceFolder}" -maxdepth 1 -type f -name '*${extension}' -exec mv {} "${destFolder}/" \\;`
  await logOperation(command, operationName, l, `Moving *${extension} files from ${sourceFolder} to ${destFolder}`)
}

async function logRemove(targetPath: string, operationName: string, extraDescription: string): Promise<void> {
  await logOperation(`rm -rf "${targetPath}"`, operationName, l, `Removing ${extraDescription} (${targetPath})`)
}

async function logMoveMd(subfolder: string, dirName: string, sourceDir: string, operationName: string): Promise<void> {
  const sourcePath = `./content/${subfolder}`
  const destPath = `./${sourceDir}/${dirName}/${subfolder}/`
  await logMkdir(destPath, `${operationName} (ensure_dest)`)
  const command = `find "${sourcePath}" -maxdepth 1 -type f -name '*.md' -exec mv {} "${destPath}" \\;`
  await logOperation(command, operationName, l, `Moving .md files from ${sourcePath} to ${destPath}`)
}

async function copyFeeds(sourceDir: string): Promise<void> {
  await logCopy(`./${sourceDir}/feeds`, './content', 'copyFeeds', 'feeds folder copied to ./content')
}

async function removeDailySubfolder(dirName: string, subfolder: string, sourceDir: string): Promise<void> {
  await logRemove(`./${sourceDir}/${dirName}/${subfolder}`, 'removeDailySubfolder', `subfolder: ${subfolder} from ./${sourceDir}/${dirName}`)
}

async function copyBackToDaily(dirName: string, subfolder: string, sourceDir: string): Promise<void> {
  await logCopy(`./content/${subfolder}`, `./${sourceDir}/${dirName}`, 'copyBackToDaily', `${subfolder} copied to ./${sourceDir}/${dirName}`)
}

async function prepareShownotes(dirName: string, dateParam: string | undefined, sourceDir: string): Promise<void> {
  logInitialFunctionCall('prepareShownotes', { dirName, dateParam, sourceDir })
  const subfolder = `${dirName}-shownotes`
  const feedFile = `${dirName}-feeds.md`

  await copyFeeds(sourceDir)
  await logMkdir(`./content/${subfolder}`, 'createDirectoryForShownotes')

  const rssOptions: ProcessingOptions = {
    rss: [`./content/feeds/${feedFile}`],
    whisper: 'base',
  }
  if (dateParam) {
    rssOptions.date = [dateParam]
  }

  try {
    await validateRSSAction(rssOptions, processRSS, rssOptions.llmServices, rssOptions.transcriptServices)
  } catch (e) {
    err(`Error during RSS processing for shownotes: ${(e as Error).message}`)
    throw e
  }

  await logFindMove('.md', './content', `./content/${subfolder}`, 'moveGeneratedMdToSubfolder')
  await logMoveMd(subfolder, dirName, sourceDir, 'moveShownotesToSource')
  await logRemove('./content/feeds', 'cleanupShownotes', 'feeds folder from ./content')
  await logRemove(`./content/${subfolder}`, 'cleanupShownotes', `${subfolder} from ./content`)
  l.final(`prepareShownotes completed for ${dirName}`)
}

async function prepareInfo(dirName: string, sourceDir: string): Promise<void> {
  logInitialFunctionCall('prepareInfo', { dirName, sourceDir })
  const subfolder = `${dirName}-info`
  const feedFile = `${dirName}-feeds.md`

  await copyFeeds(sourceDir)
  await logMkdir(`./content/${subfolder}`, 'createDirectoryForInfo')

  const rssOptions: ProcessingOptions = {
    info: true,
    rss: [`./content/feeds/${feedFile}`],
  }

  try {
    await validateRSSAction(rssOptions, processRSS)
  } catch (e) {
    err(`Error during RSS processing for info: ${(e as Error).message}`)
    throw e
  }
  await logFindMove('.json', './content', `./content/${subfolder}`, 'moveGeneratedJsonToSubfolder')
  await removeDailySubfolder(dirName, subfolder, sourceDir)
  await copyBackToDaily(dirName, subfolder, sourceDir)
  await logRemove('./content/feeds', 'cleanupInfo', 'feeds folder from ./content')
  await logRemove(`./content/${subfolder}`, 'cleanupInfo', `${subfolder} from ./content`)
  l.final(`prepareInfo completed for ${dirName}`)
}

export async function estimateLLMCost(
  options: ProcessingOptions,
  llmService: string
): Promise<number> {
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

    const serviceConfig = LLM_SERVICES_CONFIG[llmService as keyof typeof LLM_SERVICES_CONFIG]
    if (userModel === undefined || userModel === 'true' || userModel.trim() === '') {
      userModel = serviceConfig?.models[0]?.modelId
    }

    l.dim('[estimateLLMCost] determined userModel:', userModel)
    const name = userModel || llmService
    const costInfo = logLLMCost({
      name,
      stopReason: 'n/a',
      tokenUsage: {
        input: tokenCount,
        output: 4000,
        total: tokenCount + 4000
      }
    })
    l.dim('[estimateLLMCost] final cost estimate (totalCost):', costInfo.totalCost)
    return costInfo.totalCost ?? 0
  } catch (error) {
    err(`Error estimating LLM cost: ${(error as Error).message}`)
    throw error
  }
}

function approximateTokens(text: string): number {
  const words = text.trim().split(/\s+/)
  return Math.max(1, words.length)
}

export function validateOption(
  optionKeys: string[],
  options: ProcessingOptions,
  errorMessage: string
): string | undefined {
  const selectedOptions = optionKeys.filter((opt) => {
    const value = options[opt as keyof ProcessingOptions]
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return value !== undefined && value !== null && value !== false && value !== ''
  })

  if (selectedOptions.length > 1) {
    err(`Error: Multiple ${errorMessage} provided (${selectedOptions.join(', ')}). Please specify only one.`)
    exit(1)
  }
  return selectedOptions[0] as string | undefined
}

export function validateInputCLI(options: ProcessingOptions): {
  action?: 'video' | 'playlist' | 'channel' | 'urls' | 'file' | 'rss',
  llmServices?: string,
  transcriptServices?: string
} {
  const actionValues = ACTION_OPTIONS.map((opt) => opt.name)
  const selectedAction = validateOption(actionValues, options, 'input option')

  const action = selectedAction as 'video' | 'playlist' | 'channel' | 'urls' | 'file' | 'rss' | undefined
  const llmServices = validateLLM(options)
  const transcriptServices = validateTranscription(options)
  return { action, llmServices, transcriptServices }
}

export function validateLLM(options: ProcessingOptions): string | undefined {
  const llmKeys = Object.values(LLM_SERVICES_CONFIG)
    .map((service) => service.value)
    .filter((v) => v !== null) as string[]
  const llmKey = validateOption(llmKeys, options, 'LLM option')
  return llmKey
}

export function validateTranscription(options: ProcessingOptions): string | undefined {
  if (options.deepgram) return 'deepgram'
  if (options.assembly) return 'assembly'
  if (options.whisper) return 'whisper'
  
  const hasAnyTranscriptionFlag = options.deepgram || options.assembly || options.whisper
  const needsTranscriptionForCoreAction = !options.info && !options.printPrompt && !options.llmCost && !options.transcriptCost && !options['metaDir'] && (options.video || options.playlist || options.channel || options.urls || options.file || options.rss)

  if(needsTranscriptionForCoreAction && !hasAnyTranscriptionFlag ) {
    l.warn("Defaulting to Whisper for transcription for core action as no service was specified.")
    options.whisper = true // Set the option so it's recognized later
    return 'whisper'
  }
  return undefined
}


export async function processAction(
  action: 'video' | 'playlist' | 'channel' | 'urls' | 'file' | 'rss',
  options: ProcessingOptions,
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
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
  if (options.printPrompt) {
    const prompt = await selectPrompts({ ...options, printPrompt: options.printPrompt })
    console.log(prompt)
    exit(0)
  }

  if (options.transcriptCost) {
    let transcriptServiceForCost = validateTranscription(options)
    if (!transcriptServiceForCost) {
      if(options.whisper === true || typeof options.whisper === 'string') transcriptServiceForCost = 'whisper'
      else if(options.deepgram === true || typeof options.deepgram === 'string') transcriptServiceForCost = 'deepgram'
      else if(options.assembly === true || typeof options.assembly === 'string') transcriptServiceForCost = 'assembly'
      else {
        err('Please specify which transcription service to use for cost estimation (e.g., --deepgram, --assembly, --whisper).')
        exit(1)
      }
    }
    await estimateTranscriptCost(options, transcriptServiceForCost)
    exit(0)
  }


  if (options.llmCost) {
    const llmService = validateLLM(options)
    if (!llmService) {
      err('Please specify which LLM service to use for cost estimation (e.g., --chatgpt, --claude, etc.).')
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
  .name('autoshow-cli')
  .version('0.0.3')
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
  .option('--transcriptCost <filePath>', 'Estimate transcription cost for the given audio/video file path')
  .option('--llmCost <filePath>', 'Estimate LLM cost for the given text file (prompt + transcript)')
  .option('--chatgpt [model]', 'Use OpenAI ChatGPT for processing with optional model specification')
  .option('--claude [model]', 'Use Anthropic Claude for processing with optional model specification')
  .option('--gemini [model]', 'Use Google Gemini for processing with optional model specification')
  .option('--prompt <sections...>', 'Specify prompt sections to include (e.g., summary longChapters)')
  .option('--printPrompt <sections...>', 'Print the prompt sections without processing and exit')
  .option('--customPrompt <filePath>', 'Use a custom prompt from a markdown file')
  .option('--saveAudio', 'Do not delete intermediary audio files (e.g., .wav) after processing')
  .option('--openaiApiKey <key>', 'Specify OpenAI API key (overrides .env variable)')
  .option('--anthropicApiKey <key>', 'Specify Anthropic API key (overrides .env variable)')
  .option('--deepgramApiKey <key>', 'Specify Deepgram API key (overrides .env variable)')
  .option('--assemblyApiKey <key>', 'Specify AssemblyAI API key (overrides .env variable)')
  .option('--geminiApiKey <key>', 'Specify Gemini API key (overrides .env variable)')

  .option('--metaDir <dirName>', 'The meta-workflow directory name (e.g., "01-ai") located inside current directory')
  .option('--metaSrcDir <sourceDir>', 'The meta-workflow source data directory (e.g., "autoshow-daily", "mk-auto"), relative to current directory')
  .option('--metaDate <dateParam>', 'The date for the meta-workflow shownotes (YYYY-MM-DD); can be appended to npm script')
  .option('--metaInfo', 'Run the meta-workflow for information gathering')
  .option('--metaShownotes', 'Run the meta-workflow for shownotes generation')

program.action(async (options: ProcessingOptions & { metaDate?: string | string[] }) => {
  Object.entries(ENV_VARS_MAP).forEach(([key, envKey]) => {
    const value = (options as Record<string, string | undefined>)[key]
    if (value) process.env[envKey] = value
  })

  logInitialFunctionCall('autoshowCLI', options)
  await handleEarlyExitIfNeeded(options)

  if (options['metaDir']) {
    if (!options['metaSrcDir']) {
      err('Error: --metaSrcDir is required when --metaDir is specified.')
      exit(1)
    }
    if (options['metaInfo'] && options['metaShownotes']) {
      err('Error: Both --metaInfo and --metaShownotes were provided. Choose one.')
      exit(1)
    }
    if (!options['metaInfo'] && !options['metaShownotes']) {
      err('Error: Neither --metaInfo nor --metaShownotes was provided for the meta-workflow.')
      exit(1)
    }

    let metaDateToUse: string | undefined = undefined
    if (options.metaDate) {
      metaDateToUse = Array.isArray(options.metaDate) ? options.metaDate[0] : options.metaDate
    }


    try {
      if (options['metaInfo']) {
        l.final(`Starting meta-workflow: Info for ${options['metaDir']} from ${options['metaSrcDir']}`)
        await prepareInfo(options['metaDir'], options['metaSrcDir'])
        logSeparator({ type: 'completion', descriptor: `Meta-Workflow Info for ${options['metaDir']}` })
      } else if (options['metaShownotes']) {
        l.final(`Starting meta-workflow: Shownotes for ${options['metaDir']} from ${options['metaSrcDir']} (Date: ${metaDateToUse || 'latest available'})`)
        await prepareShownotes(options['metaDir'], metaDateToUse, options['metaSrcDir'])
        logSeparator({ type: 'completion', descriptor: `Meta-Workflow Shownotes for ${options['metaDir']}` })
      }
      exit(0)
    } catch (error) {
      err(`Error in meta-workflow for ${options['metaDir']}: ${(error as Error).message}`)
      exit(1)
    }
  } else {
    const { action, llmServices, transcriptServices } = validateInputCLI(options)
    if (!action) {
      if(!options['metaDir'] && !options.printPrompt && !options.transcriptCost && !options.llmCost) {
        err('Error: No action specified (e.g., --video, --rss, --metaDir). Use --help for options.')
        program.help()
      }
      exit(1)
    }
    try {
      await processAction(action, options, llmServices, transcriptServices)
      logSeparator({ type: 'completion', descriptor: action })
      exit(0)
    } catch (error) {
      err(`Error processing ${action}: ${(error as Error).message}`)
      exit(1)
    }
  }
})

program.on('command:*', () => {
  err(`Error: Invalid command '${program.args.join(' ')}'. Use --help to see available commands.`)
  exit(1)
})

const thisFilePath = fileURLToPath(import.meta.url)

if (argv[1] === thisFilePath || path.basename(argv[1]) === 'commander.ts') {
  program.parseAsync(argv)
}