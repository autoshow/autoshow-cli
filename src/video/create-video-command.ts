import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError, validateVideoModel, parseAspectRatio, validateRunwayModel, validateHunyuanModel, validateCogVideoModel } from './video-utils.ts'
import { generateVideoWithVeo } from './video-services/veo.ts'
import { generateVideoWithRunway } from './video-services/runway.ts'
// import { generateVideoWithHunyuan } from './video-services/hunyuan.ts'
import { generateVideoWithCogVideo } from './video-services/cogvideo.ts'
import type { VeoModel, RunwayModel, CogVideoModel, VeoGenerateOptions, RunwayGenerateOptions, CogVideoGenerateOptions } from '@/video/video-types.ts'

export const createVideoCommand = (): Command => {
  const p = '[video/create-video-command]'
  const video = new Command('video').description('AI video generation operations')

  video
    .command('generate')
    .description('Generate videos using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for video generation')
    .option('-m, --model <model>', 'model to use (cogvideo: cogvideo-2b|cogvideo-5b|cogvideo-5b-i2v, hunyuan: hunyuan-720p|hunyuan-540p|hunyuan-fp8, veo: veo-3.0-generate-preview|veo-3.0-fast-generate-preview|veo-2.0-generate-001, runway: gen4_turbo|gen3a_turbo)', 'hunyuan-720p')
    .option('-o, --output <path>', 'output path for generated video')
    .option('-i, --image <path>', 'reference image for image-to-video generation')
    .option('-a, --aspect-ratio <ratio>', 'aspect ratio (16:9|9:16|4:3|3:4|1:1)', '16:9')
    .option('-n, --negative <text>', 'negative prompt to exclude elements')
    .option('--person <mode>', 'person generation mode (allow_all|allow_adult|dont_allow) (Veo only)')
    .option('-d, --duration <seconds>', 'video duration in seconds (5|10) (Runway only)', '5')
    .option('--frames <number>', 'number of frames to generate (default: 49 for CogVideo, 129 for Hunyuan)')
    .option('--guidance <scale>', 'guidance scale for generation (default: 6.0)')
    .option('--flow-shift <value>', 'flow shift value (HunyuanVideo default: 7.0)')
    .option('--seed <number>', 'random seed for reproducible generation')
    .option('--steps <number>', 'number of inference steps (default: 50)')
    .option('--use-fp8', 'use FP8 quantization for reduced memory usage (HunyuanVideo only)')
    .option('--no-cpu-offload', 'disable CPU offload (HunyuanVideo only)')
    .action(async (options) => {
      try {
        l.opts(`${p} Starting video generation`)
        l.dim(`${p} Model: ${options.model}`)
        
        const isVeoModel = validateVideoModel(options.model)
        const isRunwayModel = validateRunwayModel(options.model)
        const isHunyuanModel = validateHunyuanModel(options.model)
        const isCogVideoModel = validateCogVideoModel(options.model)
        
        if (!isVeoModel && !isRunwayModel && !isHunyuanModel && !isCogVideoModel) {
          err(`${p} Invalid model: ${options.model}. Use 'npm run as -- video list-models' to see available models`)
        }
        
        const aspectRatio = parseAspectRatio(options.aspectRatio)
        
        if (isCogVideoModel) {
          l.dim(`${p} Using CogVideoX model: ${options.model}`)
          
          const cogvideoOptions: CogVideoGenerateOptions = {
            model: options.model as CogVideoModel,
            outputPath: options.output,
            image: options.image,
            negativePrompt: options.negative,
            numFrames: options.frames ? parseInt(options.frames) : 49,
            guidanceScale: options.guidance ? parseFloat(options.guidance) : 6.0,
            seed: options.seed ? parseInt(options.seed) : undefined,
            numInferenceSteps: options.steps ? parseInt(options.steps) : 50
          }
          
          if (options.image && !options.model.includes('i2v')) {
            l.warn(`${p} Image provided but model ${options.model} is text-to-video. Use cogvideo-5b-i2v for image-to-video.`)
          }
          
          const result = await generateVideoWithCogVideo(options.prompt, cogvideoOptions)
          
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
          
        // } else if (isHunyuanModel) {
        //   l.dim(`${p} Using HunyuanVideo model: ${options.model}`)
          
        //   const hunyuanOptions: HunyuanGenerateOptions = {
        //     model: options.model as HunyuanModel,
        //     outputPath: options.output,
        //     image: options.image,
        //     aspectRatio: aspectRatio,
        //     negativePrompt: options.negative,
        //     numFrames: options.frames ? parseInt(options.frames) : 129,
        //     guidanceScale: options.guidance ? parseFloat(options.guidance) : 6.0,
        //     flowShift: options.flowShift ? parseFloat(options.flowShift) : 7.0,
        //     seed: options.seed ? parseInt(options.seed) : undefined,
        //     numInferenceSteps: options.steps ? parseInt(options.steps) : 50,
        //     useFp8: options.useFp8 || options.model.includes('fp8'),
        //     useCpuOffload: options.cpuOffload !== false
        //   }
          
        //   if (options.image) {
        //     l.warn(`${p} Note: HunyuanVideo text-to-video model does not use image input. Image will be ignored.`)
        //     l.dim(`${p} Image-to-video models are coming soon in future updates.`)
        //   }
          
        //   const result = await generateVideoWithHunyuan(options.prompt, hunyuanOptions)
          
        //   if (!result) {
        //     err(`${p} Failed to generate video: result is undefined`)
        //   }
          
        //   if (result.success) {
        //     l.success(`${p} Video saved to: ${result.path}`)
        //     if (result.duration) {
        //       l.dim(`${p} Generation took ${result.duration} seconds`)
        //     }
        //   } else {
        //     err(`${p} Failed to generate video: ${result.error}`)
        //   }
        } else if (isVeoModel) {
          let veoAspectRatio: '16:9' | '9:16' | undefined = aspectRatio as any
          if (options.model !== 'veo-2.0-generate-001' && veoAspectRatio === '9:16') {
            l.warn(`${p} Portrait mode (9:16) is only supported by veo-2.0-generate-001. Using 16:9 instead.`)
            veoAspectRatio = '16:9'
          }

          if (veoAspectRatio !== '16:9' && veoAspectRatio !== '9:16') {
            l.warn(`${p} Unsupported aspect ratio for Veo model: ${veoAspectRatio}. Defaulting to 16:9.`)
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

          let runwayAspectRatio: '16:9' | '9:16' | undefined = aspectRatio as any
          if (runwayAspectRatio !== '16:9' && runwayAspectRatio !== '9:16') {
            l.warn(`${p} Unsupported aspect ratio for Runway model: ${runwayAspectRatio}. Defaulting to 16:9.`)
            runwayAspectRatio = '16:9'
          }
          
          const runwayOptions: RunwayGenerateOptions = {
            model: options.model as RunwayModel,
            outputPath: options.output,
            image: options.image,
            aspectRatio: runwayAspectRatio,
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
      l.dim(`${p} CogVideoX models (Open-source, THUDM):`)
      l.dim(`${p}   • cogvideo-2b - CogVideoX-2B (720x480, 49 frames, 4GB VRAM min)`)
      l.dim(`${p}   • cogvideo-5b - CogVideoX-5B (720x480, 49 frames, 5GB VRAM min)`)
      l.dim(`${p}   • cogvideo-5b-i2v - CogVideoX-5B Image-to-Video (720x480, 49 frames)`)
      l.dim(`${p} `)
      l.dim(`${p} HunyuanVideo models (Open-source, 13B+ parameters):`)
      l.dim(`${p}   • hunyuan-720p - Default model (1280x720, 129 frames, 60GB VRAM)`)
      l.dim(`${p}   • hunyuan-540p - Lower resolution (960x544, 129 frames, 45GB VRAM)`)
      l.dim(`${p}   • hunyuan-fp8 - FP8 quantized version (saves ~10GB memory)`)
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