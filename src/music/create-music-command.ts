import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError, validateDuration, parseDuration, isValidOutputFormat, getExtensionFromFormat } from './music-utils'
import { 
  generateMusicWithElevenLabs, 
  generateMusicDetailedWithElevenLabs,
  createCompositionPlan 
} from './music-services/elevenlabs-music'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { extname } from 'path'
import type { MusicGenerateOptions, MusicOutputFormat, MusicCompositionPlan } from './music-types'

export const createMusicCommand = (): Command => {
  const music = new Command('music').description('AI music generation operations')

  music
    .command('generate')
    .description('Generate music using ElevenLabs Music API')
    .option('-p, --prompt <text>', 'text prompt for music generation')
    .option('--plan-file <path>', 'JSON file containing a composition plan')
    .option('-o, --output <path>', 'output path for generated music')
    .option('-d, --duration <duration>', 'music duration (e.g., 30s, 2m, 2:30, or milliseconds)')
    .option('-i, --instrumental', 'generate instrumental only (no vocals)')
    .option('-l, --lyrics <text>', 'inline lyrics to include in the song')
    .option('--lyrics-file <path>', 'file containing lyrics')
    .option('-f, --format <format>', 'output format (mp3_44100_128, opus_48000_128, etc.)', 'mp3_44100_128')
    .option('--timestamps', 'include word timestamps in response')
    .option('--c2pa', 'sign output with C2PA (mp3 only)')
    .option('--respect-durations', 'strictly respect section durations from composition plan')
    .action(async (options) => {
      try {
        l.opts('Starting music generation')
        
        // Validate input: need either prompt or plan-file
        if (!options.prompt && !options.planFile) {
          err('Missing input. Provide --prompt or --plan-file')
        }
        
        if (options.prompt && options.planFile) {
          err('Conflicting input. Use either --prompt or --plan-file, not both')
        }
        
        // Validate output format
        if (options.format && !isValidOutputFormat(options.format)) {
          err(`Invalid --format: ${options.format}. Run "music list-formats" for valid values`)
        }
        
        const generateOptions: MusicGenerateOptions = {
          outputPath: options.output,
          outputFormat: options.format as MusicOutputFormat,
          instrumental: options.instrumental,
          withTimestamps: options.timestamps,
          signWithC2pa: options.c2pa,
          respectSectionDurations: options.respectDurations
        }
        
        // Warn if output extension conflicts with format
        if (options.output && options.format) {
          const expected = `.${getExtensionFromFormat(options.format)}`
          const actual = extname(options.output)
          if (actual && expected !== actual) {
            l.warn(`Output extension ${actual} does not match --format ${options.format} (${expected}). Using --output as-is.`)
          }
        }
        
        // Handle lyrics input
        if (options.lyrics && options.lyricsFile) {
          err('Conflicting lyrics input. Use --lyrics or --lyrics-file, not both')
        }
        
        let lyrics: string | undefined
        if (options.lyricsFile) {
          if (!existsSync(options.lyricsFile)) {
            err(`Lyrics file not found: ${options.lyricsFile}`)
          }
          lyrics = await readFile(options.lyricsFile, 'utf8')
          l.dim(`Loaded lyrics from: ${options.lyricsFile}`)
        } else if (options.lyrics) {
          lyrics = options.lyrics
        }
        
        if (lyrics) {
          generateOptions.lyrics = lyrics
        }
        
        // Handle composition plan from file
        let prompt = options.prompt || ''
        if (options.planFile) {
          if (!existsSync(options.planFile)) {
            err(`Plan file not found: ${options.planFile}`)
          }
          const planContent = await readFile(options.planFile, 'utf8')
          try {
            generateOptions.compositionPlan = JSON.parse(planContent) as MusicCompositionPlan
            l.dim(`Loaded composition plan from: ${options.planFile}`)
          } catch {
            err(`Invalid JSON in plan file: ${options.planFile}`)
          }
        }
        
        // Handle duration
        if (options.duration) {
          const durationMs = parseDuration(options.duration)
          if (Number.isNaN(durationMs)) {
            err(`Invalid duration: ${options.duration}. Use 30s, 2m, 2:30, or milliseconds`)
          }
          if (!validateDuration(durationMs)) {
            err(`Invalid duration: ${options.duration}. Must be between 3 seconds and 5 minutes (3000-600000ms)`)
          }
          generateOptions.durationMs = durationMs
          l.dim(`Duration: ${durationMs}ms`)
        }
        
        const result = options.timestamps
          ? await generateMusicDetailedWithElevenLabs(prompt, generateOptions)
          : await generateMusicWithElevenLabs(prompt, generateOptions)
        
        if (result.success) {
          l.success(`Music saved to: ${result.path}`)
          if (result.duration) {
            l.dim(`Generation took ${result.duration} seconds`)
          }
          if (result.songId) {
            l.dim(`Song ID: ${result.songId}`)
          }
        } else {
          err(`Failed to generate music: ${result.error}`)
        }
      } catch (error) {
        handleError(error)
      }
    })

  music
    .command('plan')
    .description('Create a composition plan from a prompt (no credits charged)')
    .requiredOption('-p, --prompt <text>', 'text prompt for composition plan')
    .option('-d, --duration <duration>', 'target duration (e.g., 30s, 2m, 2:30)')
    .option('-o, --output <path>', 'save plan to JSON file')
    .action(async (options) => {
      try {
        l.opts('Creating composition plan')
        
        const planOptions: { durationMs?: number } = {}
        
        if (options.duration) {
          const durationMs = parseDuration(options.duration)
          if (Number.isNaN(durationMs)) {
            err(`Invalid duration: ${options.duration}. Use 30s, 2m, 2:30, or milliseconds`)
          }
          if (!validateDuration(durationMs)) {
            err(`Invalid duration: ${options.duration}. Must be between 3 seconds and 5 minutes`)
          }
          planOptions.durationMs = durationMs
        }
        
        const result = await createCompositionPlan(options.prompt, planOptions)
        
        if (result.success && result.plan) {
          l.success('Composition plan created:')
          l.dim(JSON.stringify(result.plan, null, 2))
          
          if (options.output) {
            const { writeFile } = await import('fs/promises')
            await writeFile(options.output, JSON.stringify(result.plan, null, 2))
            l.success(`Plan saved to: ${options.output}`)
          }
        } else {
          err(`Failed to create plan: ${result.error}`)
        }
      } catch (error) {
        handleError(error)
      }
    })

  music
    .command('list-formats')
    .description('List available output formats')
    .action(() => {
      l.opts('Available music output formats:')
      l.dim(' ')
      l.dim('MP3 formats:')
      l.dim('  mp3_22050_32  - 22.05kHz, 32kbps')
      l.dim('  mp3_24000_48  - 24kHz, 48kbps')
      l.dim('  mp3_44100_32  - 44.1kHz, 32kbps')
      l.dim('  mp3_44100_64  - 44.1kHz, 64kbps')
      l.dim('  mp3_44100_96  - 44.1kHz, 96kbps')
      l.dim('  mp3_44100_128 - 44.1kHz, 128kbps (default)')
      l.dim('  mp3_44100_192 - 44.1kHz, 192kbps (Creator tier+)')
      l.dim(' ')
      l.dim('PCM formats (Pro tier+):')
      l.dim('  pcm_8000 to pcm_48000')
      l.dim(' ')
      l.dim('Opus formats:')
      l.dim('  opus_48000_32 to opus_48000_192')
      l.dim(' ')
      l.dim('Telephony formats:')
      l.dim('  ulaw_8000 - u-law (Twilio)')
      l.dim('  alaw_8000 - A-law')
    })

  return music
}
