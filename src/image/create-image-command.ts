import { Command } from 'commander'
import { l, err, success } from '@/logging'
import { handleError } from './image-utils'
import { generateImageWithChatGPT } from './image-services/chatgpt-image'
import { generateImageWithBlackForestLabs } from './image-services/bfl'
import { generateImageWithNova } from './image-services/nova'
import { generateImageWithRunway } from './image-services/runway'
import { generateComparisonImages } from './comparison'
import { createJsonOutput, setJsonError, outputJson, getCliContext, withPager, type ImageJsonOutput } from '@/utils'

const serviceGenerators = {
  'gpt-image-1': (prompt: string, output?: string) => generateImageWithChatGPT(prompt, output, 'gpt-image-1'),
  'gpt-image-1.5': (prompt: string, output?: string) => generateImageWithChatGPT(prompt, output, 'gpt-image-1.5'),
  'gpt-image-1-mini': (prompt: string, output?: string) => generateImageWithChatGPT(prompt, output, 'gpt-image-1-mini'),
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
    .option('-s, --service <service>', 'service to use (gpt-image-1|gpt-image-1.5|gpt-image-1-mini|bfl|nova|runway)', 'gpt-image-1.5')
    .option('-o, --output <path>', 'output path')
    .option('-w, --width <width>', 'image width (bfl/nova/runway only)')
    .option('-H, --height <height>', 'image height (bfl/nova/runway only)')
    .option('--seed <seed>', 'random seed for reproducibility')
    .option('--safety <tolerance>', 'safety tolerance 0-5 (bfl only)', '2')
    .option('-n, --negative <text>', 'negative prompt (nova only)')
    .option('-r, --resolution <res>', 'image resolution (nova only)', '1024x1024')
    .option('-q, --quality <quality>', 'image quality (nova only)', 'standard')
    .option('-c, --cfg-scale <number>', 'CFG scale 1.1-10 (nova only)', '6.5')
    .option('--count <number>', 'number of images 1-5 (nova only)', '1')
    .option('--style <style>', 'artistic style (runway only)')
    .option('--runway-model <model>', 'Runway text-to-image model (if available)')
    .option('--openai-key-file <path>', 'Path to file containing OpenAI API key (for ChatGPT Image)')
    .option('--bfl-key-file <path>', 'Path to file containing Black Forest Labs API key')
    .option('--runway-key-file <path>', 'Path to file containing Runway API key')
    .action(async (options) => {
      const jsonBuilder = createJsonOutput<ImageJsonOutput>('image')
      
      try {
        l('Starting generation with service', { service: options.service })
        
        const generator = serviceGenerators[options.service as keyof typeof serviceGenerators]
        if (!generator) {
          setJsonError(jsonBuilder, `Unknown service: ${options.service}. Use gpt-image-1, gpt-image-1.5, gpt-image-1-mini, bfl, nova, or runway`)
          outputJson(jsonBuilder)
          err('Unknown service. Use gpt-image-1, gpt-image-1.5, gpt-image-1-mini, bfl, nova, or runway', { service: options.service })
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
          setJsonError(jsonBuilder, 'Failed to generate image: result is undefined')
          outputJson(jsonBuilder)
          err('Failed to generate image: result is undefined')
        }
        
        if (result.success) {
          jsonBuilder.output.data = {
            prompt: options.prompt,
            outputPath: result.path || '',
            service: options.service,
            ...(options.width && { width: parseInt(options.width) }),
            ...(options.height && { height: parseInt(options.height) })
          }
          outputJson(jsonBuilder)
          success('Image saved', { path: result.path })
        } else {
          setJsonError(jsonBuilder, result.error || 'Unknown error')
          outputJson(jsonBuilder)
          err('Failed to generate image', { error: result.error })
        }
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
        handleError(error)
      }
    })

  image
    .command('list')
    .description('List available image generation services')
    .action(async () => {
      const ctx = getCliContext()
      
      const servicesData = {
        'gpt-image-1': { name: 'ChatGPT Image 1', provider: 'OpenAI', envKey: 'OPENAI_API_KEY' },
        'gpt-image-1.5': { name: 'ChatGPT Image 1.5', provider: 'OpenAI', envKey: 'OPENAI_API_KEY' },
        'gpt-image-1-mini': { name: 'ChatGPT Image 1 Mini', provider: 'OpenAI', envKey: 'OPENAI_API_KEY' },
        bfl: { name: 'Flux Pro 1.1', provider: 'Black Forest Labs', envKey: 'BFL_API_KEY' },
        nova: { name: 'Nova Canvas', provider: 'AWS Bedrock', envKey: 'AWS credentials' },
        runway: { name: 'Gen-3', provider: 'Runway', envKey: 'RUNWAYML_API_SECRET' }
      }
      
      if (ctx.format === 'json') {
        console.log(JSON.stringify({
          success: true,
          command: 'image list',
          timestamp: new Date().toISOString(),
          data: { services: servicesData }
        }, null, 2))
        return
      }
      
      const lines = [
        'Available image generation services:',
        '',
        '  gpt-image-1      - ChatGPT Image 1 (OpenAI, requires OPENAI_API_KEY)',
        '  gpt-image-1.5    - ChatGPT Image 1.5 (OpenAI, requires OPENAI_API_KEY)',
        '  gpt-image-1-mini - ChatGPT Image 1 Mini (OpenAI, requires OPENAI_API_KEY)',
        '  bfl              - Flux Pro 1.1 (Black Forest Labs, requires BFL_API_KEY)',
        '  nova             - Nova Canvas (AWS Bedrock, requires AWS credentials)',
        '  runway           - Gen-3 (Runway, requires RUNWAYML_API_SECRET)',
        '',
        'Usage: autoshow-cli image generate -p "prompt" -s <service>'
      ]
      
      await withPager(lines.join('\n'))
    })

  image
    .command('compare')
    .description('Compare image generation across all services')
    .argument('[prompt]', 'prompt for comparison')
    .option('-p, --prompt <text>', 'prompt for comparison (alternative to positional argument)')
    .action(async (promptArg, options) => {
      const prompt = options.prompt || promptArg
      if (!prompt) {
        err('Error: prompt is required. Provide as argument or with -p/--prompt flag')
        return
      }
      try {
        const result = await generateComparisonImages(prompt)
        success('Comparison completed')
        
        const services = { chatgptImage1: 'ChatGPT Image 1', chatgptImage1_5: 'ChatGPT Image 1.5', chatgptImageMini: 'ChatGPT Image 1 Mini', blackForest: 'Black Forest Labs', nova: 'AWS Nova Canvas', runway: 'Runway' }
        Object.entries(services).forEach(([key, name]) => {
          const res = result[key]
          if (res?.success) {
            success('Service result', { service: name, path: res.path })
          }
        })
      } catch (error) {
        handleError(error)
      }
    })

  image.addHelpText('after', `
Examples:
  $ autoshow-cli image list
  $ autoshow-cli image generate -p "a sunset over mountains"
  $ autoshow-cli image generate -p "cyberpunk city" -s bfl -o ./output/city.png
  $ autoshow-cli image generate -p "forest landscape" -s nova -r 1024x1024
  $ autoshow-cli image compare "a forest in autumn"
`)

  return image
}