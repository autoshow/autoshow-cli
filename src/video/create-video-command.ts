import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError, validateVideoModel, parseAspectRatio, validateRunwayModel } from './video-utils.ts'
import { generateVideoWithVeo } from './video-services/veo.ts'
import { generateVideoWithRunway } from './video-services/runway.ts'
import type { VeoModel, RunwayModel, VeoGenerateOptions, RunwayGenerateOptions } from '@/video/video-types.ts'

export const createVideoCommand = (): Command => {
  const video = new Command('video').description('AI video generation operations')

  video
    .command('generate')
    .description('Generate videos using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for video generation')
    .option('-m, --model <model>', 'model to use (veo: veo-3.0-generate-preview|veo-3.0-fast-generate-preview|veo-2.0-generate-001, runway: gen4_turbo|gen3a_turbo)', 'veo-3.0-fast-generate-preview')
    .option('-o, --output <path>', 'output path for generated video')
    .option('-i, --image <path>', 'reference image for image-to-video generation')
    .option('-a, --aspect-ratio <ratio>', 'aspect ratio (16:9|9:16)', '16:9')
    .option('-n, --negative <text>', 'negative prompt to exclude elements')
    .option('--person <mode>', 'person generation mode (allow_all|allow_adult|dont_allow) (Veo only)')
    .option('-d, --duration <seconds>', 'video duration in seconds (5|10) (Runway only)', '5')
    .action(async (options) => {
      try {
        l.opts('Starting video generation')
        l.dim(`Model: ${options.model}`)
        
        const isVeoModel = validateVideoModel(options.model)
        const isRunwayModel = validateRunwayModel(options.model)
        
        if (!isVeoModel && !isRunwayModel) {
          err(`Invalid model: ${options.model}. Use 'npm run as -- video list-models' to see available models`)
        }
        
        const aspectRatio = parseAspectRatio(options.aspectRatio)
        
        if (isRunwayModel && !options.image) {
          err('Runway models require an input image. Please provide one with --image option')
        }
        
        if (isVeoModel) {
          let veoAspectRatio: '16:9' | '9:16' | undefined = aspectRatio as any
          if (options.model !== 'veo-2.0-generate-001' && veoAspectRatio === '9:16') {
            l.warn('Portrait mode (9:16) is only supported by veo-2.0-generate-001. Using 16:9 instead.')
            veoAspectRatio = '16:9'
          }

          if (veoAspectRatio !== '16:9' && veoAspectRatio !== '9:16') {
            l.warn(`Unsupported aspect ratio for Veo model: ${veoAspectRatio}. Defaulting to 16:9.`)
            veoAspectRatio = '16:9'
          }
          
          const veoOptions: VeoGenerateOptions = {
            model: options.model as VeoModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: veoAspectRatio,
            negativePrompt: options.negative,
            personGeneration: options.person
          }
          
          if (options.image) {
            l.dim(`Using image-to-video mode with reference image: ${options.image}`)
          }
          
          const result = await generateVideoWithVeo(options.prompt, veoOptions)
          
          if (!result) {
            err('Failed to generate video: result is undefined')
          }
          
          if (result.success) {
            l.success(`Video saved to: ${result.path}`)
            if (result.duration) {
              l.dim(`Generation took ${result.duration} seconds`)
            }
          } else {
            err(`Failed to generate video: ${result.error}`)
          }
        } else if (isRunwayModel) {
          const duration = parseInt(options.duration)
          if (duration !== 5 && duration !== 10) {
            err(`Invalid duration: ${options.duration}. Must be 5 or 10 seconds`)
          }

          let runwayAspectRatio: '16:9' | '9:16' | undefined = aspectRatio as any
          if (runwayAspectRatio !== '16:9' && runwayAspectRatio !== '9:16') {
            l.warn(`Unsupported aspect ratio for Runway model: ${runwayAspectRatio}. Defaulting to 16:9.`)
            runwayAspectRatio = '16:9'
          }
          
          const runwayOptions: RunwayGenerateOptions = {
            model: options.model as RunwayModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: runwayAspectRatio,
            duration: duration as 5 | 10
          }
          
          l.dim(`Using Runway image-to-video with reference image: ${options.image}`)
          
          const result = await generateVideoWithRunway(options.prompt, runwayOptions)
          
          if (!result) {
            err('Failed to generate video: result is undefined')
          }
          
          if (result.success) {
            l.success(`Video saved to: ${result.path}`)
            if (result.duration) {
              l.dim(`Generation took ${result.duration} seconds`)
            }
          } else {
            err(`Failed to generate video: ${result.error}`)
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
      l.opts('Available video generation models:')
      l.dim(' ')
      l.dim('Google Veo models (cloud-based, requires GEMINI_API_KEY):')
      l.dim('  • veo-3.0-generate-preview - Veo 3 with audio generation (8 seconds, 720p)')
      l.dim('  • veo-3.0-fast-generate-preview - Veo 3 Fast for rapid generation')
      l.dim('  • veo-2.0-generate-001 - Veo 2 stable version (5-8 seconds, supports portrait)')
      l.dim(' ')
      l.dim('Runway models (cloud-based, requires RUNWAYML_API_SECRET):')
      l.dim('  • gen4_turbo - Gen-4 Turbo (5-10 seconds, 720p, 5 credits/sec)')
      l.dim('  • gen3a_turbo - Gen-3 Alpha Turbo (5-10 seconds, 720p, 5 credits/sec)')
      l.dim(' ')
      l.dim('Note: All models run on cloud servers and require API keys.')
    })

  return video
}