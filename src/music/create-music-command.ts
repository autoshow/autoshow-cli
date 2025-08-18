import { Command } from 'commander'
import { l, err } from '@/logging'
import { generateMusicWithLyria } from './music-services/lyria'
import { handleError, parseWeightedPrompts, validateMusicConfig } from './music-utils'
import type { MusicGenerationOptions } from '@/types'

export const createMusicCommand = (): Command => {
  const p = '[music/create-music-command]'
  const music = new Command('music').description('AI music generation operations')

  music
    .command('generate')
    .description('Generate music using Lyria RealTime')
    .requiredOption('-p, --prompt <text>', 'text prompt for music generation (can be multiple comma-separated prompts with weights, e.g., "techno:1.0,ambient:0.5")')
    .option('-o, --output <path>', 'output path for generated music')
    .option('-d, --duration <seconds>', 'duration of music in seconds', '30')
    .option('--bpm <number>', 'beats per minute (60-200)')
    .option('--guidance <number>', 'guidance strength (0.0-6.0)', '4.0')
    .option('--density <number>', 'note density (0.0-1.0)')
    .option('--brightness <number>', 'tonal brightness (0.0-1.0)')
    .option('--scale <scale>', 'musical scale (e.g., C_MAJOR_A_MINOR)')
    .option('--mute-bass', 'mute bass frequencies')
    .option('--mute-drums', 'mute drums')
    .option('--only-bass-drums', 'only generate bass and drums')
    .option('--mode <mode>', 'generation mode (QUALITY|DIVERSITY|VOCALIZATION)', 'QUALITY')
    .option('--temperature <number>', 'sampling temperature (0.0-3.0)', '1.1')
    .option('--seed <number>', 'random seed for reproducibility')
    .action(async (options) => {
      try {
        l.opts(`${p} Starting music generation`)
        l.dim(`${p} Parsing prompts: ${options.prompt}`)
        
        const prompts = parseWeightedPrompts(options.prompt)
        l.dim(`${p} Parsed ${prompts.length} weighted prompts`)
        
        const config = validateMusicConfig({
          bpm: options.bpm ? parseInt(options.bpm) : undefined,
          guidance: options.guidance ? parseFloat(options.guidance) : undefined,
          density: options.density ? parseFloat(options.density) : undefined,
          brightness: options.brightness ? parseFloat(options.brightness) : undefined,
          scale: options.scale,
          muteBass: options.muteBass,
          muteDrums: options.muteDrums,
          onlyBassAndDrums: options.onlyBassDrums,
          musicGenerationMode: options.mode,
          temperature: options.temperature ? parseFloat(options.temperature) : undefined,
          seed: options.seed ? parseInt(options.seed) : undefined
        })
        
        const musicOptions: MusicGenerationOptions = {
          prompts,
          config,
          outputPath: options.output,
          duration: parseInt(options.duration)
        }
        
        l.dim(`${p} Generating ${options.duration} seconds of music`)
        const result = await generateMusicWithLyria(musicOptions)
        
        if (!result) {
          err(`${p} Failed to generate music: result is undefined`)
        }
        
        if (result.success) {
          l.success(`${p} Music saved to: ${result.path}`)
          if (result.duration) {
            l.dim(`${p} Generation took ${result.duration} seconds`)
          }
        } else {
          err(`${p} Failed to generate music: ${result.error}`)
        }
      } catch (error) {
        handleError(error)
      }
    })

  music
    .command('list-prompts')
    .description('List example prompts for music generation')
    .action(() => {
      l.opts(`${p} Example prompts for Lyria RealTime:`)
      l.dim(`${p} Instruments:`)
      l.dim(`${p}   • 303 Acid Bass, 808 Hip Hop Beat, Accordion, Alto Saxophone`)
      l.dim(`${p}   • Banjo, Cello, Didgeridoo, Flamenco Guitar, Harmonica`)
      l.dim(`${p}   • Marimba, Piano, Sitar, Synthesizer, Trumpet, Violin`)
      
      l.dim(`${p} Genres:`)
      l.dim(`${p}   • Acid Jazz, Afrobeat, Blues Rock, Bossa Nova, Chillout`)
      l.dim(`${p}   • Deep House, Drum & Bass, Jazz Fusion, Lo-Fi Hip Hop`)
      l.dim(`${p}   • Minimal Techno, Neo-Soul, Reggae, Salsa, Synthpop, Trap`)
      
      l.dim(`${p} Moods:`)
      l.dim(`${p}   • Ambient, Bright, Chill, Danceable, Dreamy, Emotional`)
      l.dim(`${p}   • Ethereal, Experimental, Funky, Psychedelic, Upbeat`)
      
      l.dim(`${p} Usage examples:`)
      l.dim(`${p}   npm run as -- music generate --prompt "minimal techno"`)
      l.dim(`${p}   npm run as -- music generate --prompt "jazz:1.0,ambient:0.5" --bpm 90`)
      l.dim(`${p}   npm run as -- music generate --prompt "piano,meditation" --duration 60`)
    })

  return music
}