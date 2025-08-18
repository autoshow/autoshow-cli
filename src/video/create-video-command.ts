import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError, validateVideoModel, parseAspectRatio } from './video-utils.ts'
import { generateVideoWithVeo } from './video-services/veo.ts'
import type { VeoModel, VeoGenerateOptions } from '@/types'

export const createVideoCommand = (): Command => {
  const p = '[video/create-video-command]'
  const video = new Command('video').description('AI video generation operations')

  video
    .command('generate')
    .description('Generate videos using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for video generation')
    .option('-m, --model <model>', 'model to use (veo-3.0-generate-preview|veo-3.0-fast-generate-preview|veo-2.0-generate-001)', 'veo-3.0-generate-preview')
    .option('-o, --output <path>', 'output path for generated video')
    .option('-i, --image <path>', 'reference image for image-to-video generation')
    .option('-a, --aspect-ratio <ratio>', 'aspect ratio (16:9|9:16)', '16:9')
    .option('-n, --negative <text>', 'negative prompt to exclude elements')
    .option('--person <mode>', 'person generation mode (allow_all|allow_adult|dont_allow)')
    .action(async (options) => {
      try {
        l.opts(`${p} Starting video generation`)
        
        if (!validateVideoModel(options.model)) {
          err(`${p} Invalid model: ${options.model}. Use veo-3.0-generate-preview, veo-3.0-fast-generate-preview, or veo-2.0-generate-001`)
        }
        
        const aspectRatio = parseAspectRatio(options.aspectRatio)
        
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
      } catch (error) {
        handleError(error)
      }
    })

  video
    .command('list-models')
    .description('List available video generation models')
    .action(() => {
      l.opts(`${p} Available Veo models:`)
      l.dim(`${p}   • veo-3.0-generate-preview - Veo 3 with audio generation (8 seconds, 720p)`)
      l.dim(`${p}   • veo-3.0-fast-generate-preview - Veo 3 Fast for rapid generation`)
      l.dim(`${p}   • veo-2.0-generate-001 - Veo 2 stable version (5-8 seconds, supports portrait)`)
    })

  return video
}