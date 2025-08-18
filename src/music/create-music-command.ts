import { Command } from 'commander'
import { l, err } from '@/logging'
import { generateMusicWithAudioCraft, listAvailableModels } from './music-services/audiocraft.ts'
import { validateMusicOptions, getModelDescription } from './music-utils.ts'

const p = '[music/create-music-command]'

export const createMusicCommand = (): Command => {
  const music = new Command('music').description('AI music generation with AudioCraft MusicGen')

  music
    .command('generate')
    .description('Generate music from text prompts')
    .requiredOption('-p, --prompt <text>', 'text prompt for music generation')
    .option('-o, --output <path>', 'output file path')
    .option('-m, --model <model>', 'model to use (e.g., facebook/musicgen-small)', 'facebook/musicgen-small')
    .option('-d, --duration <seconds>', 'duration in seconds (max 30)', '8')
    .option('-t, --temperature <value>', 'sampling temperature (0.0-2.0)', '1.0')
    .option('--top-k <value>', 'top-k sampling', '250')
    .option('--top-p <value>', 'nucleus sampling threshold', '0.0')
    .option('--cfg-coef <value>', 'classifier free guidance coefficient', '3.0')
    .option('--no-sampling', 'use greedy decoding instead of sampling')
    .option('--two-step-cfg', 'use two-step classifier free guidance')
    .option('--extend-stride <value>', 'stride for continuation', '18')
    .option('--melody <path>', 'path to melody audio file for conditioning')
    .option('--continuation <path>', 'path to audio file for continuation')
    .action(async (options) => {
      try {
        l.dim(`${p} Starting music generation with model: ${options.model}`)
        
        const validation = validateMusicOptions(options)
        if (!validation.valid) {
          validation.errors.forEach(error => l.warn(`${p} ${error}`))
          err(`${p} Invalid options provided`)
        }
        
        if (options.melody && options.continuation) {
          err(`${p} Cannot use both melody and continuation options simultaneously`)
        }
        
        l.opts(`${p} Prompt: ${options.prompt}`)
        l.dim(`${p} Model: ${getModelDescription(options.model)}`)
        l.dim(`${p} Duration: ${options.duration}s`)
        
        const result = await generateMusicWithAudioCraft(
          options.prompt,
          options.output,
          {
            model: options.model,
            duration: parseFloat(options.duration),
            temperature: parseFloat(options.temperature),
            topK: parseInt(options.topK, 10),
            topP: parseFloat(options.topP),
            cfgCoef: parseFloat(options.cfgCoef),
            useSampling: options.sampling !== false,
            twoStepCfg: options.twoStepCfg,
            extendStride: parseInt(options.extendStride, 10),
            melodyPath: options.melody,
            continuationPath: options.continuation
          }
        )
        
        if (result.success) {
          l.success(`${p} Music saved to: ${result.path}`)
        } else {
          err(`${p} Failed to generate music: ${result.error || 'Unknown error'}`)
        }
      } catch (error) {
        err(`${p} Error generating music: ${error}`)
      }
    })

  music
    .command('list')
    .description('List available MusicGen models')
    .action(async () => {
      try {
        l.dim(`${p} Available MusicGen models:`)
        const models = await listAvailableModels()
        models.forEach(model => {
          console.log(`  ${model} - ${getModelDescription(model)}`)
        })
        l.dim(`${p} Use a model with: npm run as -- music generate --prompt "..." --model <model>`)
      } catch (error) {
        err(`${p} Error listing models: ${error}`)
      }
    })

  music
    .command('download <model>')
    .description('Download a specific MusicGen model')
    .action(async (model) => {
      try {
        l.dim(`${p} Downloading model: ${model}`)
        
        const result = await generateMusicWithAudioCraft(
          'test prompt',
          '/tmp/test.wav',
          { model, duration: 0.1 }
        )
        
        if (result.success) {
          l.success(`${p} Model ${model} downloaded successfully`)
        } else {
          err(`${p} Failed to download model: ${model}`)
        }
      } catch (error) {
        err(`${p} Error downloading model: ${error}`)
      }
    })

  return music
}