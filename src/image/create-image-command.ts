import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError } from './image-utils.ts'
import { generateImageWithDallE } from './image-services/dalle.ts'
import { generateImageWithBlackForestLabs } from './image-services/bfl.ts'
import { generateImageWithNova } from './image-services/nova.ts'
import { generateImageWithStableDiffusionCpp } from './image-services/sdcpp.ts'
import { generateComparisonImages } from './image-services/comparison.ts'

const serviceGenerators = {
  dalle: generateImageWithDallE,
  bfl: generateImageWithBlackForestLabs,
  nova: generateImageWithNova,
  sdcpp: generateImageWithStableDiffusionCpp
} as const

export const createImageCommand = (): Command => {
  const p = '[image/create-image-command]'
  const image = new Command('image').description('AI image generation operations')

  image
    .command('generate')
    .description('Generate images using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for image generation')
    .option('-s, --service <service>', 'service to use (dalle|bfl|nova|sdcpp)', 'dalle')
    .option('-o, --output <path>', 'output path')
    .option('-w, --width <width>', 'image width (bfl/nova/sdcpp only)')
    .option('-h, --height <height>', 'image height (bfl/nova/sdcpp only)')
    .option('--seed <seed>', 'random seed for reproducibility')
    .option('--safety <tolerance>', 'safety tolerance 0-5 (bfl only)', '2')
    .option('-n, --negative <text>', 'negative prompt (nova/sdcpp only)')
    .option('-r, --resolution <res>', 'image resolution (nova only)', '1024x1024')
    .option('-q, --quality <quality>', 'image quality (nova only)', 'standard')
    .option('-c, --cfg-scale <number>', 'CFG scale 1.1-10 (nova/sdcpp only)', '6.5')
    .option('--count <number>', 'number of images 1-5 (nova only)', '1')
    .option('--model <model>', 'model type for sdcpp (sd1.5|sd3.5|flux-kontext)', 'sd1.5')
    .option('--steps <number>', 'number of sampling steps (sdcpp only)', '20')
    .option('--sampling-method <method>', 'sampling method (sdcpp only)', 'euler')
    .option('--lora', 'enable LoRA support (sdcpp only)')
    .option('--reference-image <path>', 'reference image for flux-kontext (sdcpp only)')
    .option('--flash-attention', 'use flash attention (sdcpp only)')
    .option('--quantization <type>', 'weight quantization (sdcpp only)', 'f16')
    .action(async (options) => {
      try {
        const generator = serviceGenerators[options.service as keyof typeof serviceGenerators]
        if (!generator) {
          err(`${p} Unknown service: ${options.service}. Use dalle, bfl, nova, or sdcpp.`)
        }
        
        const result = await (options.service === 'bfl' 
          ? generator(options.prompt, options.output, {
              ...(options.width && { width: parseInt(options.width) }),
              ...(options.height && { height: parseInt(options.height) }),
              ...(options.seed && { seed: parseInt(options.seed) }),
              safety_tolerance: parseInt(options.safety)
            })
          : options.service === 'nova'
          ? generator(options.prompt, options)
          : options.service === 'sdcpp'
          ? generator(options.prompt, options.output, {
              model: options.model,
              width: options.width ? parseInt(options.width) : undefined,
              height: options.height ? parseInt(options.height) : undefined,
              steps: options.steps ? parseInt(options.steps) : undefined,
              seed: options.seed ? parseInt(options.seed) : undefined,
              cfgScale: options.cfgScale ? parseFloat(options.cfgScale) : undefined,
              negativePrompt: options.negative,
              samplingMethod: options.samplingMethod,
              lora: options.lora,
              referenceImage: options.referenceImage,
              flashAttention: options.flashAttention,
              quantization: options.quantization
            })
          : generator(options.prompt, options.output))
        
        if (!result) {
          err(`${p} Failed to generate image: result is undefined`)
        }
        
        if (result.success) {
          l.success(`${p} Image saved to: ${result.path}`)
        } else {
          err(`${p} Failed to generate image: ${result.error}`)
        }
      } catch (error) {
        handleError(error)
      }
    })

  image
    .command('compare <prompt>')
    .description('Compare image generation across all services')
    .action(async (prompt) => {
      try {
        const result = await generateComparisonImages(prompt)
        l.success(`${p} Comparison completed`)
        
        const services = { dalle: 'DALL-E', blackForest: 'Black Forest Labs', nova: 'AWS Nova Canvas' }
        Object.entries(services).forEach(([key, name]) => {
          const res = result[key]
          if (res?.success) {
            l.success(`${p} ${name}: ${res.path}`)
          }
        })
      } catch (error) {
        handleError(error)
      }
    })

  return image
}