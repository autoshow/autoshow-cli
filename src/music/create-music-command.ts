import { Command } from 'commander'
import { l, err, success } from '@/logging'
import { 
  handleError, 
  validateDuration, 
  parseDuration, 
  isValidOutputFormat, 
  getExtensionFromFormat,
  isMinimaxFormat,
  convertFormatForService,
  parseMinimaxFormat,
  getExtensionFromMinimaxFormat,
} from './music-utils'
import { 
  generateMusicWithElevenLabs, 
  generateMusicDetailedWithElevenLabs,
  createCompositionPlan 
} from './music-services/elevenlabs-music'
import { generateMusicWithMinimax } from './music-services/minimax-music'
import { isValidMusicService, VALID_MUSIC_SERVICES } from './music-config'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { extname } from 'path'
import type { MusicGenerateOptions, MusicOutputFormat, MusicCompositionPlan, MusicService } from './music-types'
import { withPager, getCliContext, createJsonOutput, setJsonError, outputJson, type MusicJsonOutput } from '@/utils'

export const createMusicCommand = (): Command => {
  const music = new Command('music').description('AI music generation operations')

  music
    .command('generate')
    .description('Generate music using AI music services')
    .option('-s, --service <service>', 'music service (elevenlabs, minimax)', 'elevenlabs')
    .option('-p, --prompt <text>', 'text prompt for music generation')
    .option('--plan-file <path>', 'JSON file containing a composition plan (ElevenLabs only)')
    .option('-o, --output <path>', 'output path for generated music')
    .option('-d, --duration <duration>', 'music duration (e.g., 30s, 2m, 2:30, or milliseconds) (ElevenLabs only)')
    .option('-i, --instrumental', 'generate instrumental only (no vocals) (ElevenLabs only)')
    .option('-l, --lyrics <text>', 'inline lyrics to include in the song')
    .option('--lyrics-file <path>', 'file containing lyrics')
    .option('-f, --format <format>', 'output format (service-specific, run "music list-formats" for options)')
    .option('--timestamps', 'include word timestamps in response (ElevenLabs only)')
    .option('--c2pa', 'sign output with C2PA (ElevenLabs mp3 only)')
    .option('--respect-durations', 'strictly respect section durations from composition plan (ElevenLabs only)')
    .option('--elevenlabs-key-file <path>', 'Path to file containing ElevenLabs API key')
    .option('--minimax-key-file <path>', 'Path to file containing MiniMax API key')
    .action(async (options) => {
      const jsonBuilder = createJsonOutput<MusicJsonOutput>('music')
      
      try {
        l('Starting music generation')
        
        const service = (options.service || 'elevenlabs') as MusicService
        if (!isValidMusicService(service)) {
          setJsonError(jsonBuilder, `Invalid service: ${service}`)
          outputJson(jsonBuilder)
          err('Invalid --service', { service, validOptions: VALID_MUSIC_SERVICES.join(', ') })
        }
        
        l('Using service', { service })
        
        if (service === 'minimax') {
          if (!options.lyrics && !options.lyricsFile) {
            err('MiniMax requires lyrics. Use --lyrics or --lyrics-file')
          }
          if (options.planFile) {
            l('--plan-file is not supported by MiniMax, ignoring')
          }
          if (options.instrumental) {
            l('--instrumental is not supported by MiniMax, ignoring')
          }
          if (options.timestamps) {
            l('--timestamps is not supported by MiniMax, ignoring')
          }
          if (options.duration) {
            l('--duration is not supported by MiniMax, ignoring')
          }
        } else {
          if (!options.prompt && !options.planFile) {
            err('Missing input. Provide --prompt or --plan-file')
          }
          if (options.prompt && options.planFile) {
            err('Conflicting input. Use either --prompt or --plan-file, not both')
          }
        }
        
        if (options.lyrics && options.lyricsFile) {
          err('Conflicting lyrics input. Use --lyrics or --lyrics-file, not both')
        }
        
        let lyrics: string | undefined
        if (options.lyricsFile) {
          if (!existsSync(options.lyricsFile)) {
            err('Lyrics file not found', { lyricsFile: options.lyricsFile })
          }
          lyrics = await readFile(options.lyricsFile, 'utf8')
          l('Loaded lyrics from', { lyricsFile: options.lyricsFile })
        } else if (options.lyrics) {
          lyrics = options.lyrics
        }
        
        let format = options.format
        if (format) {
          format = convertFormatForService(format, service)
        } else {
          format = service === 'minimax' ? 'mp3_44100_256000' : 'mp3_44100_128'
        }
        
        if (service === 'minimax' && !isMinimaxFormat(format)) {
          format = convertFormatForService(format, 'minimax')
        } else if (service === 'elevenlabs' && !isValidOutputFormat(format)) {
          err('Invalid --format for ElevenLabs', { format, help: 'Run "music list --service elevenlabs" for valid values' })
        }
        
        if (service === 'minimax') {
          const audioSetting = parseMinimaxFormat(format)
          const ext = getExtensionFromMinimaxFormat(format)
          
          if (options.output) {
            const expected = `.${ext}`
            const actual = extname(options.output)
            if (actual && expected !== actual) {
              l('Output extension does not match --format. Using --output as-is.', { actual, expected, format })
            }
          }
          
          const result = await generateMusicWithMinimax({
            prompt: options.prompt,
            lyrics: lyrics!,
            outputPath: options.output,
            audioSetting,
          })
          
          if (result.success) {
            jsonBuilder.output.data = {
              outputPath: result.path || '',
              service: 'minimax',
              duration: result.duration,
              format: format
            }
            outputJson(jsonBuilder)
            success('Music saved to', { path: result.path })
            if (result.duration) {
              l('Generation took', { duration: result.duration, unit: 'seconds' })
            }
          } else {
            setJsonError(jsonBuilder, result.error || 'Unknown error')
            outputJson(jsonBuilder)
            err('Failed to generate music', { error: result.error })
          }
        } else {
          const generateOptions: MusicGenerateOptions = {
            outputPath: options.output,
            outputFormat: format as MusicOutputFormat,
            instrumental: options.instrumental,
            withTimestamps: options.timestamps,
            signWithC2pa: options.c2pa,
            respectSectionDurations: options.respectDurations
          }
          
          if (options.output && format) {
            const expected = `.${getExtensionFromFormat(format as MusicOutputFormat)}`
            const actual = extname(options.output)
            if (actual && expected !== actual) {
              l('Output extension does not match --format. Using --output as-is.', { actual, expected, format })
            }
          }
          
          if (lyrics) {
            generateOptions.lyrics = lyrics
          }
          
          let prompt = options.prompt || ''
          if (options.planFile) {
            if (!existsSync(options.planFile)) {
              err('Plan file not found', { planFile: options.planFile })
            }
            const planContent = await readFile(options.planFile, 'utf8')
            try {
              generateOptions.compositionPlan = JSON.parse(planContent) as MusicCompositionPlan
              l('Loaded composition plan from', { planFile: options.planFile })
            } catch {
              err('Invalid JSON in plan file', { planFile: options.planFile })
            }
          }
          
          if (options.duration) {
            const durationMs = parseDuration(options.duration)
            if (Number.isNaN(durationMs)) {
              err('Invalid duration. Use 30s, 2m, 2:30, or milliseconds', { duration: options.duration })
            }
            if (!validateDuration(durationMs)) {
              err('Invalid duration. Must be between 3 seconds and 5 minutes (3000-600000ms)', { duration: options.duration })
            }
            generateOptions.durationMs = durationMs
            l('Duration', { durationMs, unit: 'ms' })
          }
          
          const result = options.timestamps
            ? await generateMusicDetailedWithElevenLabs(prompt, generateOptions)
            : await generateMusicWithElevenLabs(prompt, generateOptions)
          
          if (result.success) {
            jsonBuilder.output.data = {
              prompt: prompt || undefined,
              outputPath: result.path || '',
              service: 'elevenlabs',
              duration: result.duration,
              format: format
            }
            outputJson(jsonBuilder)
            success('Music saved to', { path: result.path })
            if (result.duration) {
              l('Generation took', { duration: result.duration, unit: 'seconds' })
            }
            if (result.songId) {
              l('Song ID', { songId: result.songId })
            }
          } else {
            setJsonError(jsonBuilder, result.error || 'Unknown error')
            outputJson(jsonBuilder)
            err('Failed to generate music', { error: result.error })
          }
        }
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
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
        l('Creating composition plan')
        
        const planOptions: { durationMs?: number } = {}
        
        if (options.duration) {
          const durationMs = parseDuration(options.duration)
          if (Number.isNaN(durationMs)) {
            err('Invalid duration. Use 30s, 2m, 2:30, or milliseconds', { duration: options.duration })
          }
          if (!validateDuration(durationMs)) {
            err('Invalid duration. Must be between 3 seconds and 5 minutes', { duration: options.duration })
          }
          planOptions.durationMs = durationMs
        }
        
        const result = await createCompositionPlan(options.prompt, planOptions)
        
        if (result.success && result.plan) {
          success('Composition plan created:')
          l(JSON.stringify(result.plan, null, 2))
          
          if (options.output) {
            const { writeFile } = await import('fs/promises')
            await writeFile(options.output, JSON.stringify(result.plan, null, 2))
            success('Plan saved to', { output: options.output })
          }
        } else {
          err('Failed to create plan', { error: result.error })
        }
      } catch (error) {
        handleError(error)
      }
    })

  music
    .command('list')
    .description('List available output formats')
    .option('-s, --service <service>', 'show formats for specific service (elevenlabs, minimax)')
    .action(async (options) => {
      const showAll = !options.service
      const service = options.service as MusicService | undefined
      
      if (service && !isValidMusicService(service)) {
        err('Invalid --service', { service, validOptions: VALID_MUSIC_SERVICES.join(', ') })
      }
      
      const ctx = getCliContext()
      
      const formatData: Record<string, Record<string, string[]>> = {}
      
      if (showAll || service === 'elevenlabs') {
        formatData['elevenlabs'] = {
          mp3: [
            'mp3_22050_32  - 22.05kHz, 32kbps',
            'mp3_24000_48  - 24kHz, 48kbps',
            'mp3_44100_32  - 44.1kHz, 32kbps',
            'mp3_44100_64  - 44.1kHz, 64kbps',
            'mp3_44100_96  - 44.1kHz, 96kbps',
            'mp3_44100_128 - 44.1kHz, 128kbps (default)',
            'mp3_44100_192 - 44.1kHz, 192kbps (Creator tier+)',
          ],
          pcm: ['pcm_8000 to pcm_48000 (Pro tier+)'],
          opus: ['opus_48000_32 to opus_48000_192'],
          telephony: [
            'ulaw_8000 - u-law (Twilio)',
            'alaw_8000 - A-law',
          ],
        }
      }
      
      if (showAll || service === 'minimax') {
        formatData['minimax'] = {
          mp3: [
            'mp3_44100_256000 - 44.1kHz, 256kbps (default, highest quality)',
            'mp3_44100_128000 - 44.1kHz, 128kbps',
            'mp3_44100_64000  - 44.1kHz, 64kbps',
            'mp3_44100_32000  - 44.1kHz, 32kbps',
            '(Also available with 16000, 24000, 32000 Hz sample rates)',
          ],
          wav: [
            'wav_44100 - 44.1kHz WAV (uncompressed)',
            'wav_32000 - 32kHz WAV',
            'wav_24000 - 24kHz WAV',
            'wav_16000 - 16kHz WAV',
          ],
          pcm: [
            'pcm_44100 - 44.1kHz PCM',
            'pcm_32000 - 32kHz PCM',
            'pcm_24000 - 24kHz PCM',
            'pcm_16000 - 16kHz PCM',
          ],
        }
      }
      
      if (ctx.format === 'json') {
        console.log(JSON.stringify({
          success: true,
          command: 'music list',
          timestamp: new Date().toISOString(),
          data: { formats: formatData }
        }, null, 2))
        return
      }
      
      const lines: string[] = []
      
      if (showAll || service === 'elevenlabs') {
        lines.push('ElevenLabs formats:')
        lines.push('')
        lines.push('MP3 formats:')
        lines.push('  mp3_22050_32  - 22.05kHz, 32kbps')
        lines.push('  mp3_24000_48  - 24kHz, 48kbps')
        lines.push('  mp3_44100_32  - 44.1kHz, 32kbps')
        lines.push('  mp3_44100_64  - 44.1kHz, 64kbps')
        lines.push('  mp3_44100_96  - 44.1kHz, 96kbps')
        lines.push('  mp3_44100_128 - 44.1kHz, 128kbps (default)')
        lines.push('  mp3_44100_192 - 44.1kHz, 192kbps (Creator tier+)')
        lines.push('')
        lines.push('PCM formats (Pro tier+):')
        lines.push('  pcm_8000 to pcm_48000')
        lines.push('')
        lines.push('Opus formats:')
        lines.push('  opus_48000_32 to opus_48000_192')
        lines.push('')
        lines.push('Telephony formats:')
        lines.push('  ulaw_8000 - u-law (Twilio)')
        lines.push('  alaw_8000 - A-law')
      }
      
      if (showAll || service === 'minimax') {
        if (showAll) {
          lines.push('')
          lines.push('─'.repeat(50))
          lines.push('')
        }
        lines.push('MiniMax formats:')
        lines.push('')
        lines.push('MP3 formats (format_samplerate_bitrate):')
        lines.push('  mp3_44100_256000 - 44.1kHz, 256kbps (default, highest quality)')
        lines.push('  mp3_44100_128000 - 44.1kHz, 128kbps')
        lines.push('  mp3_44100_64000  - 44.1kHz, 64kbps')
        lines.push('  mp3_44100_32000  - 44.1kHz, 32kbps')
        lines.push('  (Also available with 16000, 24000, 32000 Hz sample rates)')
        lines.push('')
        lines.push('WAV formats:')
        lines.push('  wav_44100 - 44.1kHz WAV (uncompressed)')
        lines.push('  wav_32000 - 32kHz WAV')
        lines.push('  wav_24000 - 24kHz WAV')
        lines.push('  wav_16000 - 16kHz WAV')
        lines.push('')
        lines.push('PCM formats:')
        lines.push('  pcm_44100 - 44.1kHz PCM')
        lines.push('  pcm_32000 - 32kHz PCM')
        lines.push('  pcm_24000 - 24kHz PCM')
        lines.push('  pcm_16000 - 16kHz PCM')
      }
      
      await withPager(lines.join('\n'))
    })

  music.addHelpText('after', `
Examples:
  $ autoshow-cli music list
  $ autoshow-cli music generate -p "upbeat electronic dance track"
  $ autoshow-cli music generate -p "sad ballad" -d 2m -i
  $ autoshow-cli music generate --lyrics "Hello world, this is my song" -s minimax
  $ autoshow-cli music plan -p "epic orchestral piece" -d 3m -o ./output/plan.json
`)

  return music
}
