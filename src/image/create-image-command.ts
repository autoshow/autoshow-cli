import { Command } from 'commander'
import { l, err } from '@/logging'
import { handleError } from './image-utils.ts'
import { generateImageWithDallE } from './image-services/dalle.ts'
import { generateImageWithBlackForestLabs } from './image-services/bfl.ts'
import { generateImageWithNova } from './image-services/nova.ts'
import { generateImageWithRunway } from './image-services/runway.ts'
import { generateComparisonImages } from './comparison.ts'

const serviceGenerators = {
  dalle: generateImageWithDallE,
  bfl: generateImageWithBlackForestLabs,
  nova: generateImageWithNova,
  runway: generateImageWithRunway
} as const

export const createImageCommand = (): Command => {
  const image = new Command('image').description('AI image generation operations')

  image
    .command('generate')
    .description('Generate images using AI services')
    .requiredOption('-p, --prompt <text>', 'text prompt for image generation')
    .option('-s, --service <service>', 'service to use (dalle|bfl|nova|runway)', 'dalle')
    .option('-o, --output <path>', 'output path')
    .option('-w, --width <width>', 'image width (bfl/nova/runway only)')
    .option('-h, --height <height>', 'image height (bfl/nova/runway only)')
    .option('--seed <seed>', 'random seed for reproducibility')
    .option('--safety <tolerance>', 'safety tolerance 0-5 (bfl only)', '2')
    .option('-n, --negative <text>', 'negative prompt (nova only)')
    .option('-r, --resolution <res>', 'image resolution (nova only)', '1024x1024')
    .option('-q, --quality <quality>', 'image quality (nova only)', 'standard')
    .option('-c, --cfg-scale <number>', 'CFG scale 1.1-10 (nova only)', '6.5')
    .option('--count <number>', 'number of images 1-5 (nova only)', '1')
    .option('--style <style>', 'artistic style (runway only)')
    .option('--runway-model <model>', 'Runway text-to-image model (if available)')
    .action(async (options) => {
      try {
        l.dim(`Starting generation with service: ${options.service}`)
        
        const generator = serviceGenerators[options.service as keyof typeof serviceGenerators]
        if (!generator) {
          err(`Unknown service: ${options.service}. Use dalle, bfl, nova, or runway.`)
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
          : options.service === 'runway'
          ? generator(options.prompt, options.output, {
              ...(options.runwayModel && { model: options.runwayModel }),
              width: options.width ? parseInt(options.width) : undefined,
              height: options.height ? parseInt(options.height) : undefined,
              style: options.style
            })
          : generator(options.prompt, options.output))
        
        if (!result) {
          err(`Failed to generate image: result is undefined`)
        }
        
        if (result.success) {
          l.success(`Image saved to: ${result.path}`)
        } else {
          err(`Failed to generate image: ${result.error}`)
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
        l.success(`Comparison completed`)
        
        const services = { dalle: 'DALL-E', blackForest: 'Black Forest Labs', nova: 'AWS Nova Canvas', runway: 'Runway' }
        Object.entries(services).forEach(([key, name]) => {
          const res = result[key]
          if (res?.success) {
            l.success(`${name}: ${res.path}`)
          }
        })
      } catch (error) {
        handleError(error)
      }
    })

  return image
}