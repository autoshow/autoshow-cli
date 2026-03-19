import { Command } from 'commander'
import { l, err, success } from '@/logging'
import { handleError, validateVideoModel, parseAspectRatio, validateRunwayModel, validateResolution } from './video-utils'
import { generateVideoWithVeo } from './video-services/veo'
import { generateVideoWithRunway } from './video-services/runway'
import type { VeoModel, RunwayModel, VeoGenerateOptions, RunwayGenerateOptions } from '@/video/video-types'
import { createJsonOutput, setJsonError, outputJson, getCliContext, withPager, type VideoJsonOutput } from '@/utils'

export const createVideoCommand = (): Command => {
  const video = new Command('video').description('AI video generation operations')

  video
    .command('generate')
    .description('Generate videos using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for video generation')
    .option('-m, --model <model>', 'model to use (veo: veo-3.1-generate-preview|veo-3.1-fast-generate-preview, runway: gen4_turbo|gen3a_turbo)', 'veo-3.1-fast-generate-preview')
    .option('-o, --output <path>', 'output path for generated video')
    .option('-i, --image <path>', 'starting frame image for image-to-video generation')
    .option('-a, --aspect-ratio <ratio>', 'aspect ratio (16:9|9:16)', '16:9')
    .option('-r, --resolution <resolution>', 'video resolution (720p|1080p|4k) (Veo only)', '720p')
    .option('-n, --negative <text>', 'negative prompt to exclude elements')
    .option('--reference <paths...>', 'reference images for content guidance, up to 3 (Veo only)')
    .option('--person <mode>', 'person generation mode (allow_all|allow_adult|dont_allow) (Veo only)')
    .option('-d, --duration <seconds>', 'video duration in seconds (5|10) (Runway only)', '5')
    .option('--gemini-key-file <path>', 'Path to file containing Gemini API key (for Veo)')
    .option('--runway-key-file <path>', 'Path to file containing Runway API key')
    .action(async (options) => {
      const jsonBuilder = createJsonOutput<VideoJsonOutput>('video')
      
      try {
        l('Starting video generation')
        l('Model', { model: options.model })
        
        const isVeoModel = validateVideoModel(options.model)
        const isRunwayModel = validateRunwayModel(options.model)
        
        if (!isVeoModel && !isRunwayModel) {
          setJsonError(jsonBuilder, `Invalid model: ${options.model}`)
          outputJson(jsonBuilder)
          err('Invalid model. Use \'bun as -- video list\' to see available models', { model: options.model })
        }
        
        const aspectRatio = parseAspectRatio(options.aspectRatio)
        
        if (isRunwayModel && !options.image) {
          setJsonError(jsonBuilder, 'Runway models require an input image')
          outputJson(jsonBuilder)
          err('Runway models require an input image. Please provide one with --image option')
        }
        
        if (isVeoModel) {
          let veoAspectRatio: '16:9' | '9:16' | undefined = aspectRatio as any
          if (veoAspectRatio !== '16:9' && veoAspectRatio !== '9:16') {
            l('Unsupported aspect ratio for Veo model. Defaulting to 16:9', { aspectRatio: veoAspectRatio })
            veoAspectRatio = '16:9'
          }
          
          const veoOptions: VeoGenerateOptions = {
            model: options.model as VeoModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: veoAspectRatio,
            resolution: validateResolution(options.resolution),
            negativePrompt: options.negative,
            personGeneration: options.person,
            referenceImages: options.reference
          }
          
          if (options.image) {
            l('Using image-to-video mode with starting frame', { image: options.image })
          }
          
          if (options.reference && options.reference.length > 0) {
            l('Using reference images for content guidance', { count: Math.min(options.reference.length, 3) })
          }
          
          const result = await generateVideoWithVeo(options.prompt, veoOptions)
          
          if (!result) {
            setJsonError(jsonBuilder, 'Failed to generate video: result is undefined')
            outputJson(jsonBuilder)
            err('Failed to generate video: result is undefined')
          }
          
          if (result.success) {
            jsonBuilder.output.data = {
              prompt: options.prompt,
              outputPath: result.path || '',
              service: 'veo',
              model: options.model,
              duration: result.duration
            }
            outputJson(jsonBuilder)
            success('Video saved', { path: result.path })
            if (result.duration) {
              l('Generation took', { duration: `${result.duration} seconds` })
            }
          } else {
            setJsonError(jsonBuilder, result.error || 'Unknown error')
            outputJson(jsonBuilder)
            err('Failed to generate video', { error: result.error })
          }
        } else if (isRunwayModel) {
          const duration = parseInt(options.duration)
          if (duration !== 5 && duration !== 10) {
            setJsonError(jsonBuilder, 'Invalid duration. Must be 5 or 10 seconds')
            outputJson(jsonBuilder)
            err('Invalid duration. Must be 5 or 10 seconds', { duration: options.duration })
          }

          let runwayAspectRatio: '16:9' | '9:16' | undefined = aspectRatio as any
          if (runwayAspectRatio !== '16:9' && runwayAspectRatio !== '9:16') {
            l('Unsupported aspect ratio for Runway model. Defaulting to 16:9', { aspectRatio: runwayAspectRatio })
            runwayAspectRatio = '16:9'
          }
          
          const runwayOptions: RunwayGenerateOptions = {
            model: options.model as RunwayModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: runwayAspectRatio,
            duration: duration as 5 | 10
          }
          
          l('Using Runway image-to-video with reference image', { image: options.image })
          
          const result = await generateVideoWithRunway(options.prompt, runwayOptions)
          
          if (!result) {
            setJsonError(jsonBuilder, 'Failed to generate video: result is undefined')
            outputJson(jsonBuilder)
            err('Failed to generate video: result is undefined')
          }
          
          if (result.success) {
            jsonBuilder.output.data = {
              prompt: options.prompt,
              outputPath: result.path || '',
              service: 'runway',
              model: options.model,
              duration: result.duration
            }
            outputJson(jsonBuilder)
            success('Video saved', { path: result.path })
            if (result.duration) {
              l('Generation took', { duration: `${result.duration} seconds` })
            }
          } else {
            setJsonError(jsonBuilder, result.error || 'Unknown error')
            outputJson(jsonBuilder)
            err('Failed to generate video', { error: result.error })
          }
        }
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
        handleError(error)
      }
    })

  video
    .command('list')
    .description('List available video generation models')
    .action(async () => {
      const ctx = getCliContext()
      
      const modelsData = {
        veo: [
          { id: 'veo-3.1-generate-preview', description: 'Veo 3.1 with audio, portrait mode, 720p/1080p/4k, reference images' },
          { id: 'veo-3.1-fast-generate-preview', description: 'Veo 3.1 Fast for rapid generation with full feature support' }
        ],
        runway: [
          { id: 'gen4_turbo', description: 'Gen-4 Turbo (5-10 seconds, 720p, 5 credits/sec)' },
          { id: 'gen3a_turbo', description: 'Gen-3 Alpha Turbo (5-10 seconds, 720p, 5 credits/sec)' }
        ]
      }
      
      if (ctx.format === 'json') {
        console.log(JSON.stringify({
          success: true,
          command: 'video list',
          timestamp: new Date().toISOString(),
          data: { models: modelsData }
        }, null, 2))
        return
      }
      
      const lines = [
        'Available video generation models:',
        '',
        'Google Veo models (cloud-based, requires GEMINI_API_KEY):',
        '  • veo-3.1-generate-preview - Veo 3.1 with audio, portrait mode, 720p/1080p/4k, reference images',
        '  • veo-3.1-fast-generate-preview - Veo 3.1 Fast for rapid generation with full feature support',
        '',
        'Runway models (cloud-based, requires RUNWAYML_API_SECRET):',
        '  • gen4_turbo - Gen-4 Turbo (5-10 seconds, 720p, 5 credits/sec)',
        '  • gen3a_turbo - Gen-3 Alpha Turbo (5-10 seconds, 720p, 5 credits/sec)',
        '',
        'Note: All models run on cloud servers and require API keys.'
      ]
      
      await withPager(lines.join('\n'))
    })

  video.addHelpText('after', `
Examples:
  $ autoshow-cli video list
  $ autoshow-cli video generate -p "ocean waves crashing on rocks"
  $ autoshow-cli video generate -p "timelapse of clouds" -m veo-3.1-generate-preview -a 9:16
  $ autoshow-cli video generate -p "woman in dress" --reference dress.jpg woman.jpg -r 1080p
  $ autoshow-cli video generate -p "person walking" -m gen4_turbo -i ./input/image.jpg
`)

  return video
}