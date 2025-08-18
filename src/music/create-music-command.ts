import { Command } from 'commander'
import { l, err } from '@/logging'
import { generateMusicWithLyria } from './music-services/lyria'
import { generateMusicWithSageMaker, checkSageMakerAvailability } from './music-services/sagemaker-musicgen'
import { handleError, parseWeightedPrompts, validateMusicConfig } from './music-utils'
import type { MusicGenerationOptions, MusicService, SageMakerMusicConfig, SageMakerMusicGenModel } from '@/types'

export const createMusicCommand = (): Command => {
  const p = '[music/create-music-command]'
  const music = new Command('music').description('AI music generation operations')

  music
    .command('generate')
    .description('Generate music using Lyria RealTime or SageMaker MusicGen')
    .requiredOption('-p, --prompt <text>', 'text prompt for music generation (can be multiple comma-separated prompts with weights, e.g., "techno:1.0,ambient:0.5")')
    .option('-s, --service <service>', 'music generation service (lyria|sagemaker)', 'lyria')
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
    .option('--sagemaker-model <model>', 'SageMaker model size (musicgen-small|musicgen-medium|musicgen-large)', 'musicgen-large')
    .option('--sagemaker-endpoint <name>', 'SageMaker endpoint name (overrides env variable)')
    .option('--sagemaker-bucket <name>', 'S3 bucket for SageMaker (overrides env variable)')
    .action(async (options) => {
      try {
        const service = options.service?.toLowerCase() as MusicService
        l.opts(`${p} Starting music generation with ${service}`)
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
        
        let result: any
        
        if (service === 'sagemaker') {
          const sagemakerConfig: SageMakerMusicConfig = {
            model: options.sagemakerModel as SageMakerMusicGenModel,
            endpointName: options.sagemakerEndpoint,
            s3BucketName: options.sagemakerBucket,
            guidance: config.guidance,
            temperature: config.temperature
          }
          
          result = await generateMusicWithSageMaker(musicOptions, sagemakerConfig)
        } else {
          result = await generateMusicWithLyria(musicOptions)
        }
        
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
    .command('check')
    .description('Check availability of music generation services')
    .option('-s, --service <service>', 'service to check (lyria|sagemaker|all)', 'all')
    .action(async (options) => {
      const service = options.service?.toLowerCase()
      
      if (service === 'all' || service === 'lyria') {
        l.opts(`${p} Checking Lyria RealTime availability...`)
        const lyriaAvailable = await import('./music-services/lyria').then(m => m.checkLyriaAvailability())
        if (lyriaAvailable) {
          l.success(`${p} ✓ Lyria RealTime is available`)
        } else {
          l.warn(`${p} ✗ Lyria RealTime is not available`)
        }
      }
      
      if (service === 'all' || service === 'sagemaker') {
        l.opts(`${p} Checking SageMaker MusicGen availability...`)
        const sagemakerAvailable = await checkSageMakerAvailability()
        if (sagemakerAvailable) {
          l.success(`${p} ✓ SageMaker MusicGen is available`)
        } else {
          l.warn(`${p} ✗ SageMaker MusicGen is not available`)
        }
      }
    })

  music
    .command('list-prompts')
    .description('List example prompts for music generation')
    .option('-s, --service <service>', 'service-specific prompts (lyria|sagemaker|all)', 'all')
    .action((options) => {
      const service = options.service?.toLowerCase()
      
      if (service === 'all' || service === 'lyria') {
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
      }
      
      if (service === 'all' || service === 'sagemaker') {
        l.opts(`${p} Example prompts for SageMaker MusicGen:`)
        l.dim(`${p} Simple prompts:`)
        l.dim(`${p}   • "80s pop track with bassy drums and synth"`)
        l.dim(`${p}   • "90s rock song with loud guitars and heavy drums"`)
        l.dim(`${p}   • "Earthy tones, environmentally conscious, ukulele-infused"`)
        l.dim(`${p}   • "Lofi slow bpm electro chill with organic samples"`)
        
        l.dim(`${p} Complex prompts:`)
        l.dim(`${p}   • "Warm and vibrant weather on a sunny day, feeling the vibes of hip hop and synth"`)
        l.dim(`${p}   • "Catchy funky beats with drums and bass, synthesized pop for an upbeat pop game"`)
        l.dim(`${p}   • "A cheerful country song with acoustic guitars"`)
        l.dim(`${p}   • "Violins and synths that inspire awe at the finiteness of life and the universe"`)
      }
      
      l.dim(`${p}`)
      l.dim(`${p} Usage examples:`)
      l.dim(`${p}   npm run as -- music generate --prompt "minimal techno"`)
      l.dim(`${p}   npm run as -- music generate --service sagemaker --prompt "jazz:1.0,ambient:0.5"`)
      l.dim(`${p}   npm run as -- music generate --service lyria --prompt "piano,meditation" --duration 60`)
    })

  return music
}