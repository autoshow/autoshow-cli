import { Command } from 'commander'
import { processRSS } from './process-commands/rss'
import { COMMAND_CONFIG, validateCommandInput } from './utils/text-validation.ts'
import { processEmbedCommand } from '../embeddings/embed-command.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '@/logging'
import { exit } from '@/node-utils'
import type { EmbeddingOptions } from "@/embeddings/embed-types.ts"
import type { ProcessingOptions } from '@/text/text-types'

export async function processCommand(
  options: ProcessingOptions
): Promise<void> {
  const p = '[text/create-text-command]'
  
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
    
    logSeparator({ type: 'completion', descriptor: action })
    exit(0)
  } catch (error) {
    err(`Error processing ${action}: ${(error as Error).message}`)
    exit(1)
  }
}

export const createTextCommand = (): Command => {
  const textCommand = new Command('text')
    .description('Process audio/video content into text-based outputs')
    .option('--input-dir <directory>', 'Input directory for files (default: input)')
    .option('--output-dir <subdirectory>', 'Output subdirectory within output/ (optional)')
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
    .option('--save <service>', 'Save output to cloud storage (s3 or r2)')
    .option('--s3-bucket-prefix <prefix>', 'Custom prefix for S3 bucket name (default: autoshow)')
    .action(async (options: ProcessingOptions) => {
      logInitialFunctionCall('textCommand', options)
      if (options.save) {
        if (options.save !== 's3' && options.save !== 'r2') {
          err(`Invalid save option: ${options.save}. Must be 's3' or 'r2'`)
          exit(1)
        }
      }
      await processCommand(options)
    })
  
  const embedCommand = new Command('embed')
    .description('Create or query vector embeddings using Cloudflare Vectorize')
    .option('--create [directory]', 'Create embeddings from markdown files in directory (default: input)')
    .option('--query <question>', 'Query embeddings with a question')
    .action(async (options: EmbeddingOptions) => {
      logInitialFunctionCall('embedCommand', options as Record<string, unknown>)
      try {
        await processEmbedCommand(options)
        l.success('Embed command completed successfully')
      } catch (error) {
        err(`Embed command failed: ${(error as Error).message}`)
        exit(1)
      }
    })
  
  textCommand.addCommand(embedCommand)
  
  return textCommand
}