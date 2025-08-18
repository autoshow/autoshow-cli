import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError, validateVideoModel, parseAspectRatio, validateRunwayModel, validateWanModel } from './video-utils.ts'
import { generateVideoWithVeo } from './video-services/veo.ts'
import { generateVideoWithRunway } from './video-services/runway.ts'
import { generateVideoWithWan } from './video-services/wan.ts'
import type { VeoModel, RunwayModel, WanModel, VeoGenerateOptions, RunwayGenerateOptions, WanGenerateOptions } from '@/video/video-types.ts'

export const createVideoCommand = (): Command => {
  const p = '[video/create-video-command]'
  const video = new Command('video').description('AI video generation operations')

  video
    .command('generate')
    .description('Generate videos using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for video generation')
    .option('-m, --model <model>', 'model to use (wan: t2v-1.3b|t2v-14b|vace-1.3b|vace-14b, veo: veo-3.0-generate-preview|veo-3.0-fast-generate-preview|veo-2.0-generate-001, runway: gen4_turbo|gen3a_turbo)', 't2v-1.3b')
    .option('-o, --output <path>', 'output path for generated video')
    .option('-i, --image <path>', 'reference image for image-to-video generation')
    .option('-a, --aspect-ratio <ratio>', 'aspect ratio (16:9|9:16)', '16:9')
    .option('-n, --negative <text>', 'negative prompt to exclude elements')
    .option('--person <mode>', 'person generation mode (allow_all|allow_adult|dont_allow) (Veo only)')
    .option('-d, --duration <seconds>', 'video duration in seconds (5|10) (Runway only)', '5')
    .option('--frames <number>', 'number of frames to generate (Wan only)', '81')
    .option('--guidance <scale>', 'guidance scale for generation (Wan only)')
    .action(async (options) => {
      try {
        l.opts(`${p} Starting video generation`)
        l.dim(`${p} Model: ${options.model}`)
        
        const isVeoModel = validateVideoModel(options.model)
        const isRunwayModel = validateRunwayModel(options.model)
        const isWanModel = validateWanModel(options.model)
        
        if (!isVeoModel && !isRunwayModel && !isWanModel) {
          err(`${p} Invalid model: ${options.model}. Use 'npm run as -- video list-models' to see available models`)
        }
        
        const aspectRatio = parseAspectRatio(options.aspectRatio)
        
        if (isWanModel) {
          l.dim(`${p} Using Wan2.1 model: ${options.model}`)
          
          const wanOptions: WanGenerateOptions = {
            model: options.model as WanModel,
            outputPath: options.output,
            image: options.image,
            negativePrompt: options.negative,
            numFrames: options.frames ? parseInt(options.frames) : 81,
            guidanceScale: options.guidance ? parseFloat(options.guidance) : undefined
          }
          
          if (aspectRatio === '9:16') {
            wanOptions.resolution = { width: 480, height: 832 }
          } else if (options.model.includes('14b')) {
            wanOptions.resolution = { width: 1280, height: 720 }
          }
          
          if (options.image) {
            l.dim(`${p} Using image-to-video mode with reference image: ${options.image}`)
          }
          
          const result = await generateVideoWithWan(options.prompt, wanOptions)
          
          if (!result) {
            err(`${p} Failed to generate video: result is undefined`)
          }
          
          if (result.success) {
            l.success(`${p} Video saved to: ${result.path}`)
            if (result.duration) {
              l.dim(`${p} Generation took ${result.duration} seconds`)
            }
          } else {
            err(`${p} Failed to generate video: ${result.error}`)
          }
        } else if (isVeoModel) {
          if (options.model !== 'veo-2.0-generate-001' && aspectRatio === '9:16') {
            l.warn(`${p} Portrait mode (9:16) is only supported by veo-2.0-generate-001. Using 16:9 instead.`)
            options.aspectRatio = '16:9'
          }
          
          const veoOptions: VeoGenerateOptions = {
            model: options.model as VeoModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: aspectRatio,
            negativePrompt: options.negative,
            personGeneration: options.person
          }
          
          if (options.image) {
            l.dim(`${p} Using image-to-video mode with reference image: ${options.image}`)
          }
          
          const result = await generateVideoWithVeo(options.prompt, veoOptions)
          
          if (!result) {
            err(`${p} Failed to generate video: result is undefined`)
          }
          
          if (result.success) {
            l.success(`${p} Video saved to: ${result.path}`)
            if (result.duration) {
              l.dim(`${p} Generation took ${result.duration} seconds`)
            }
          } else {
            err(`${p} Failed to generate video: ${result.error}`)
          }
        } else if (isRunwayModel) {
          const duration = parseInt(options.duration)
          if (duration !== 5 && duration !== 10) {
            err(`${p} Invalid duration: ${options.duration}. Must be 5 or 10 seconds`)
          }
          
          const runwayOptions: RunwayGenerateOptions = {
            model: options.model as RunwayModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: aspectRatio,
            duration: duration as 5 | 10
          }
          
          if (!options.image) {
            l.warn(`${p} Runway models require an input image. Please provide one with --image option`)
            err(`${p} Image is required for Runway model ${options.model}`)
          }
          
          l.dim(`${p} Using Runway image-to-video with reference image: ${options.image}`)
          
          const result = await generateVideoWithRunway(options.prompt, runwayOptions)
          
          if (!result) {
            err(`${p} Failed to generate video: result is undefined`)
          }
          
          if (result.success) {
            l.success(`${p} Video saved to: ${result.path}`)
            if (result.duration) {
              l.dim(`${p} Generation took ${result.duration} seconds`)
            }
          } else {
            err(`${p} Failed to generate video: ${result.error}`)
          }
        }
      } catch (error) {
        handleError(error)
      }
    })

  video
    .command('list-models')
    .description('List available video generation models')
    .action(() => {
      l.opts(`${p} Available video generation models:`)
      l.dim(`${p} `)
      l.dim(`${p} Wan2.1 models (Open-source):`)
      l.dim(`${p}   • t2v-1.3b - Text-to-Video 1.3B (Default, 480p, 5 seconds, consumer GPU friendly)`)
      l.dim(`${p}   • t2v-14b - Text-to-Video 14B (480p/720p, 5 seconds, high quality)`)
      l.dim(`${p}   • vace-1.3b - VACE 1.3B for video creation/editing (480p, 5 seconds)`)
      l.dim(`${p}   • vace-14b - VACE 14B for video creation/editing (480p/720p, 5 seconds)`)
      l.dim(`${p} `)
      l.dim(`${p} Google Veo models:`)
      l.dim(`${p}   • veo-3.0-generate-preview - Veo 3 with audio generation (8 seconds, 720p)`)
      l.dim(`${p}   • veo-3.0-fast-generate-preview - Veo 3 Fast for rapid generation`)
      l.dim(`${p}   • veo-2.0-generate-001 - Veo 2 stable version (5-8 seconds, supports portrait)`)
      l.dim(`${p} `)
      l.dim(`${p} Runway models:`)
      l.dim(`${p}   • gen4_turbo - Gen-4 Turbo (5-10 seconds, 720p, 5 credits/sec)`)
      l.dim(`${p}   • gen3a_turbo - Gen-3 Alpha Turbo (5-10 seconds, 720p, 5 credits/sec)`)
    })

  return video
}