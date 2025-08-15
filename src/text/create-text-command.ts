import { Command } from 'commander'
import { processRSS } from './process-commands/rss'
import { COMMAND_CONFIG, validateCommandInput } from './utils/text-validation.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '@/logging'
import { exit } from '@/node-utils'
import type { ProcessingOptions } from '@/types'

export async function processCommand(
  options: ProcessingOptions
): Promise<void> {
  const p = '[text/create-text-command]'
  l.dim(`${p} Starting command processing`)
  
  if (options.rss && Array.isArray(options.rss) && options.rss.length === 0) {
    options.rss = undefined
    l.dim(`${p} Cleared empty RSS array`)
  }
  
  const { action, llmServices, transcriptServices } = validateCommandInput(options)
  
  if (!action && !options.feed) {
    err('Error: No action specified (e.g., --video, --rss, --feed). Use --help for options.')
    process.exit(1)
  }
  
  if (options.feed && !action) {
    l.dim(`${p} Processing workflow with --feed option via RSS handler`)
    await processRSS(options, llmServices, transcriptServices)
    exit(0)
  }
  
  if (action === 'rss' && options.feed) {
    l.dim(`${p} Processing RSS with workflow feed`)
    await COMMAND_CONFIG.rss.handler(options, llmServices, transcriptServices)
    exit(0)
  }
  
  l.dim(`${p} Processing action: ${action} with LLM: ${llmServices || 'none'} and transcription: ${transcriptServices || 'none'}`)
  
  try {
    if (action === 'rss') {
      l.dim(`${p} Calling RSS handler`)
      await COMMAND_CONFIG[action].handler(options, llmServices, transcriptServices)
    } else {
      if (!action) {
        throw new Error('No action specified for processing')
      }
      const input = options[action]
      if (!input || typeof input !== 'string') {
        throw new Error(`No valid input provided for ${action} processing`)
      }
      l.dim(`${p} Calling ${action} handler with input: ${input}`)
      await COMMAND_CONFIG[action].handler(options, input, llmServices, transcriptServices)
    }
    
    l.dim(`${p} Successfully completed ${action} processing`)
    logSeparator({ type: 'completion', descriptor: action })
    exit(0)
  } catch (error) {
    err(`Error processing ${action}: ${(error as Error).message}`)
    exit(1)
  }
}

export const createTextCommand = (): Command => {
  const p = '[text/create-text-command]'
  l.dim(`${p} Creating text command with all options`)
  
  const textCommand = new Command('text')
    .description('Process audio/video content into text-based outputs')
    .option('--video <url>', 'Process a single YouTube video')
    .option('--playlist <playlistUrl>', 'Process all videos in a YouTube playlist')
    .option('--channel <channelUrl>', 'Process all videos in a YouTube channel')
    .option('--urls <filePath>', 'Process YouTube videos from a list of URLs in a file')
    .option('--file <filePath>', 'Process a local audio or video file')
    .option('--rss [rssURLs...]', 'Process one or more podcast RSS feeds (optional when using --feed)')
    .option('--feed <feedFile>', 'Process workflow feed file (e.g., "01-ai-feeds.md") from output/workflows/feeds')
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
    .option('--saveAudio', 'Do not delete intermediary audio files (e.g., .wav) after processing')
    .option('--keyMomentsCount <number>', 'Number of key moments to extract (default: 3)', parseInt)
    .option('--keyMomentDuration <number>', 'Duration of each key moment segment in seconds (default: 60)', parseInt)
    .action(async (options: ProcessingOptions) => {
      logInitialFunctionCall('textCommand', options)
      if (options.keyMomentsCount !== undefined) {
        l.dim(`${p} Key moments count configured: ${options.keyMomentsCount}`)
      }
      if (options.keyMomentDuration !== undefined) {
        l.dim(`${p} Key moment duration configured: ${options.keyMomentDuration} seconds`)
      }
      await processCommand(options)
    })

  l.dim(`${p} Text command created successfully`)
  return textCommand
}